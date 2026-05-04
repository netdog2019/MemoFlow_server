import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { stringifyFilters } from "@/contexts/MemoFilterContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorProps } from "../types";
import { normalizeEditorContent } from "../utils/contentNormalization";
import WysiwygOverlay from "./WysiwygOverlay";

export interface EditorWord {
  text: string;
  start: number;
  end: number;
}

export interface EditorRefActions {
  getEditor: () => HTMLElement | null;
  focus: () => void;
  blur: () => void;
  scrollToCursor: () => void;
  insertText: (text: string, prefix?: string, suffix?: string) => void;
  removeText: (start: number, length: number) => void;
  replaceRange: (start: number, end: number, text: string) => void;
  setContent: (text: string) => void;
  resetToInitialState: () => void;
  getContent: () => string;
  getSelectedContent: () => string;
  wrapSelection: (prefix: string, suffix?: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (startPos: number, endPos?: number) => void;
  getCursorLineNumber: () => number;
  getLine: (lineNumber: number) => string;
  setLine: (lineNumber: number, text: string) => void;
  getWordAroundCursor: () => EditorWord;
  replaceWordAroundCursor: (replacement: string) => void;
  toggleInlineStyle: (style: "bold" | "italic") => void;
  insertTagTrigger: () => void;
  toggleTaskList: () => void;
  toggleBulletedList: () => void;
  toggleNumberedList: () => void;
  indentList: () => void;
  outdentList: () => void;
  isInlineStyleActive: (style: "bold" | "italic") => boolean;
}

export const EDITOR_UI_SYNC_EVENT = "memo-editor-ui-sync";
export const EDITOR_FORCE_SUGGESTIONS_EVENT = "memo-editor-force-suggestions";
export const EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT = "memo-editor-set-suggestions-anchor";

const MIN_HEIGHT = 108;
const COMPACT_INACTIVE_MIN_HEIGHT = MIN_HEIGHT / 2;
const BOLD_OPEN = "\u2060";
const BOLD_CLOSE = "\u2005";
const ITALIC_OPEN = "\u2062";
const ITALIC_CLOSE = "\u200A";
const LEGACY_TASK_TODO = "\u2003\u2006";
const LEGACY_TASK_DONE = "\u2003\u2005";
const SPACED_TASK_TODO = "\u2003\u2004\u2006";
const SPACED_TASK_DONE = "\u2003\u2004\u2005";
const TASK_TODO = "- [ ] ";
const LIST_INDENT = "    ";
const BULLETED_LIST_MARKER = "-   ";
const UNORDERED_LIST_SYMBOLS = ["-", "*", "+"] as const;

const INLINE_STYLE_TOKENS = {
  bold: { open: BOLD_OPEN, close: BOLD_CLOSE, markdown: "**" },
  italic: { open: ITALIC_OPEN, close: ITALIC_CLOSE, markdown: "*" },
} as const;

const isWindowsPlatform = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /win/i.test(navigator.platform || navigator.userAgent);
};

const isMobilePlatform = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1);
};

export function serializeEditorContent(content: string) {
  return content
    .replaceAll(BOLD_OPEN, "**")
    .replaceAll(BOLD_CLOSE, "**")
    .replaceAll(ITALIC_OPEN, "*")
    .replaceAll(ITALIC_CLOSE, "*")
    .replaceAll(LEGACY_TASK_TODO, "- [ ] ")
    .replaceAll(LEGACY_TASK_DONE, "- [x] ")
    .replaceAll(SPACED_TASK_TODO, "- [ ] ")
    .replaceAll(SPACED_TASK_DONE, "- [x] ");
}

export function deserializeEditorContent(content: string) {
  return content
    .replace(/\*\*([\s\S]*?)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`)
    .replace(/\*(?!\*)([^*\n]*?)\*(?!\*)/g, `${ITALIC_OPEN}$1${ITALIC_CLOSE}`)
    .replace(/^(\s*)-\s+(?!\[[ xX]\]\s)(.*)$/gm, `$1${BULLETED_LIST_MARKER}$2`)
    .replace(/^(\s*)(\d+)([.)])\s+(.*)$/gm, (_match, indent: string, number: string, delimiter: string, text: string) => {
      return `${indent}${getOrderedListMarker(Number.parseInt(number, 10), delimiter)}${text}`;
    });
}

function getLineRanges(content: string) {
  const lines = content.split("\n");
  let offset = 0;

  return lines.map((line) => {
    const current = { text: line, start: offset, end: offset + line.length };
    offset += line.length + 1;
    return current;
  });
}

function getSelection(textarea: HTMLTextAreaElement | null, fallback: { start: number; end: number }) {
  if (!textarea) {
    return fallback;
  }

  return {
    start: textarea.selectionStart ?? fallback.start,
    end: textarea.selectionEnd ?? fallback.end,
  };
}

function getWordAtCursor(content: string, cursor: number): EditorWord {
  let start = cursor;
  let end = cursor;

  while (start > 0 && !/\s/.test(content[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < content.length && !/\s/.test(content[end] ?? "")) {
    end += 1;
  }

  return {
    text: content.slice(start, end),
    start,
    end,
  };
}

function getCurrentLine(content: string, cursor: number) {
  const start = content.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const nextBreak = content.indexOf("\n", cursor);
  const end = nextBreak === -1 ? content.length : nextBreak;
  const lineNumber = content.slice(0, start).split("\n").length - 1;

  return {
    start,
    end,
    lineNumber,
    text: content.slice(start, end),
  };
}

function updateLine(content: string, cursor: number, transform: (line: string) => { nextLine: string; cursorOffset: number }) {
  const line = getCurrentLine(content, cursor);
  const { nextLine, cursorOffset } = transform(line.text);
  const nextContent = `${content.slice(0, line.start)}${nextLine}${content.slice(line.end)}`;

  return {
    content: nextContent,
    cursor: line.start + cursorOffset,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getListIndentLevel(indent: string) {
  return Math.floor(indent.replace(/\t/g, LIST_INDENT).length / LIST_INDENT.length);
}

function getUnorderedListMarker(indent: string) {
  const symbol = UNORDERED_LIST_SYMBOLS[getListIndentLevel(indent) % UNORDERED_LIST_SYMBOLS.length] ?? "-";
  return `${symbol}   `;
}

function getOrderedListMarker(number: number, delimiter = ".") {
  return `${number}${delimiter}   `;
}

function getOutdentedIndent(indent: string) {
  const removed = indent.endsWith(LIST_INDENT) ? LIST_INDENT.length : Math.min(indent.length, LIST_INDENT.length);
  return indent.slice(0, Math.max(0, indent.length - removed));
}

function getPreviousOrderedNumberAtIndent(contentBeforeLine: string, indent: string) {
  const lines = contentBeforeLine.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i]?.match(/^(\s*)(\d+)([.)])\s+/);
    if (match && match[1] === indent) {
      return Number.parseInt(match[2], 10);
    }
  }

  return 0;
}

function isWrappedByDelimiter(content: string, start: number, end: number, openDelimiter: string, closeDelimiter: string) {
  if (start !== end) {
    return (
      content.slice(Math.max(0, start - openDelimiter.length), start) === openDelimiter &&
      content.slice(end, end + closeDelimiter.length) === closeDelimiter
    );
  }

  const line = getCurrentLine(content, start);
  const offsetInLine = start - line.start;
  const leftIndex = line.text.lastIndexOf(openDelimiter, Math.max(0, offsetInLine - 1));
  const rightIndex = line.text.indexOf(closeDelimiter, offsetInLine);

  if (leftIndex < 0 || rightIndex < 0 || rightIndex <= leftIndex) {
    return false;
  }

  const between = line.text.slice(leftIndex + openDelimiter.length, rightIndex);
  return between.trim().length > 0;
}

export function getInlineStyleEnterTransition(content: string, cursor: number) {
  const line = getCurrentLine(content, cursor);
  const cursorInLine = cursor - line.start;

  const delimiterPairs = [
    { open: INLINE_STYLE_TOKENS.bold.open, close: INLINE_STYLE_TOKENS.bold.close },
    { open: INLINE_STYLE_TOKENS.italic.open, close: INLINE_STYLE_TOKENS.italic.close },
    { open: "**", close: "**" },
    { open: "*", close: "*" },
  ];

  for (const pair of delimiterPairs) {
    if (line.text.slice(cursorInLine, cursorInLine + pair.close.length) !== pair.close) {
      continue;
    }

    const leftIndex = line.text.lastIndexOf(pair.open, Math.max(0, cursorInLine - pair.open.length));
    if (leftIndex < 0 || leftIndex >= cursorInLine) {
      continue;
    }

    const between = line.text.slice(leftIndex + pair.open.length, cursorInLine);
    const openingStart = line.start + leftIndex;
    const closingEnd = cursor + pair.close.length;

    if (between.length === 0) {
      return {
        content: `${content.slice(0, openingStart)}\n${content.slice(closingEnd)}`,
        cursor: openingStart + 1,
      };
    }

    return {
      content: `${content.slice(0, closingEnd)}\n${content.slice(closingEnd)}`,
      cursor: closingEnd + 1,
    };
  }

  return null;
}

export function getTaskListToggleTransition(content: string, cursor: number) {
  const currentLine = getCurrentLine(content, cursor);
  const cursorInLine = cursor - currentLine.start;

  return updateLine(content, cursor, (line) => {
    const taskInfo = getTaskListLineInfo(line);
    if (taskInfo) {
      const nextLine = `${taskInfo.indent}${taskInfo.text}`;
      const cursorOffset = Math.max(taskInfo.indent.length, cursorInLine - taskInfo.marker.length);
      return { nextLine, cursorOffset: Math.min(nextLine.length, cursorOffset) };
    }

    const nextLine = `${TASK_TODO}${line}`;
    return {
      nextLine,
      cursorOffset: Math.min(nextLine.length, cursorInLine + TASK_TODO.length),
    };
  });
}

function getTaskListLineInfo(line: string) {
  const internalMatch = line.match(
    new RegExp(`^(\\s*)(${[LEGACY_TASK_TODO, LEGACY_TASK_DONE, SPACED_TASK_TODO, SPACED_TASK_DONE].map(escapeRegExp).join("|")})(.*)$`),
  );
  if (internalMatch) {
    const [, indent, marker, text] = internalMatch;
    return {
      indent,
      marker,
      text,
      contentStart: indent.length + marker.length,
      continuationMarker: TASK_TODO,
    };
  }

  const markdownMatch = line.match(/^(\s*)(([-*+])\s+\[([ xX])\]\s?)(.*)$/);
  if (!markdownMatch) {
    return null;
  }

  const [, indent, marker, symbol, , text] = markdownMatch;
  return {
    indent,
    marker,
    text,
    contentStart: indent.length + marker.length,
    continuationMarker: symbol ? `${symbol} [ ] ` : TASK_TODO,
  };
}

export function getTaskListEnterTransition(content: string, cursor: number) {
  const line = getCurrentLine(content, cursor);
  const taskInfo = getTaskListLineInfo(line.text);
  if (!taskInfo) {
    return null;
  }

  const cursorInLine = cursor - line.start;
  if (cursorInLine < taskInfo.contentStart) {
    return null;
  }

  const textBeforeCursor = line.text.slice(taskInfo.contentStart, cursorInLine);
  const textAfterCursor = line.text.slice(cursorInLine);

  if (textBeforeCursor.trim().length === 0 && textAfterCursor.trim().length === 0) {
    const targetIndent = taskInfo.indent.length > 0 ? getOutdentedIndent(taskInfo.indent) : taskInfo.indent;
    const nextLine = taskInfo.indent.length > 0 ? `${targetIndent}${TASK_TODO}` : targetIndent;
    return {
      content: `${content.slice(0, line.start)}${nextLine}${content.slice(line.end)}`,
      cursor: line.start + nextLine.length,
    };
  }

  const continuation = `${taskInfo.indent}${taskInfo.continuationMarker}`;
  return {
    content: `${content.slice(0, cursor)}\n${continuation}${content.slice(cursor)}`,
    cursor: cursor + 1 + continuation.length,
  };
}

function getPlainListLineInfo(line: string) {
  const unorderedMatch = line.match(/^(\s*)(([-*+])\s+)(.*)$/);
  if (unorderedMatch && !unorderedMatch[4].match(/^\[[ xX]\]\s?/)) {
    const [, indent, marker, , text] = unorderedMatch;
    return {
      type: "unordered" as const,
      indent,
      marker,
      text,
      contentStart: indent.length + marker.length,
      continuationMarker: getUnorderedListMarker(indent),
    };
  }

  const orderedMatch = line.match(/^(\s*)((\d+)([.)])\s+)(.*)$/);
  if (orderedMatch) {
    const [, indent, marker, numberText, delimiter, text] = orderedMatch;
    return {
      type: "ordered" as const,
      indent,
      marker,
      number: Number.parseInt(numberText, 10),
      text,
      contentStart: indent.length + marker.length,
      delimiter,
    };
  }

  return null;
}

export function getPlainListEnterTransition(content: string, cursor: number) {
  const line = getCurrentLine(content, cursor);
  const listInfo = getPlainListLineInfo(line.text);
  if (!listInfo) {
    return null;
  }

  const cursorInLine = cursor - line.start;
  if (cursorInLine < listInfo.contentStart) {
    return null;
  }

  const textBeforeCursor = line.text.slice(listInfo.contentStart, cursorInLine);
  const textAfterCursor = line.text.slice(cursorInLine);

  if (textBeforeCursor.trim().length === 0 && textAfterCursor.trim().length === 0) {
    const nextLine =
      listInfo.indent.length > 0
        ? (() => {
            const targetIndent = getOutdentedIndent(listInfo.indent);
            if (listInfo.type === "ordered") {
              const nextNumber = getPreviousOrderedNumberAtIndent(content.slice(0, line.start), targetIndent) + 1;
              return `${targetIndent}${getOrderedListMarker(nextNumber, listInfo.delimiter)}`;
            }

            return `${targetIndent}${getUnorderedListMarker(targetIndent)}`;
          })()
        : listInfo.indent;

    return {
      content: `${content.slice(0, line.start)}${nextLine}${content.slice(line.end)}`,
      cursor: line.start + nextLine.length,
    };
  }

  const continuationMarker =
    "continuationMarker" in listInfo ? listInfo.continuationMarker : getOrderedListMarker(listInfo.number + 1, listInfo.delimiter);
  const continuation = `${listInfo.indent}${continuationMarker}`;
  return {
    content: `${content.slice(0, cursor)}\n${continuation}${content.slice(cursor)}`,
    cursor: cursor + 1 + continuation.length,
  };
}

function rewritePlainListMarkerForIndent(lineText: string, targetIndent: string, contentBeforeLine: string) {
  const listInfo = getPlainListLineInfo(lineText);
  if (!listInfo) {
    return `${targetIndent}${lineText.trimStart()}`;
  }

  const marker =
    listInfo.type === "unordered"
      ? getUnorderedListMarker(targetIndent)
      : getOrderedListMarker(getPreviousOrderedNumberAtIndent(contentBeforeLine, targetIndent) + 1, listInfo.delimiter);

  return `${targetIndent}${marker}${listInfo.text}`;
}

const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorRefActions>) {
  const {
    className,
    initialContent,
    placeholder,
    onContentChange,
    onPaste,
    isFocusMode = false,
    isActive = false,
    onCompositionStart,
    onCompositionEnd,
    onFocusChange,
  } = props;

  const location = useLocation();
  const navigateTo = useNavigateTo();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(deserializeEditorContent(normalizeEditorContent(initialContent)));
  const selectionRef = useRef({ start: 0, end: 0 });
  const onContentChangeRef = useRef(onContentChange);
  const onPasteRef = useRef(onPaste);
  const onCompositionStartRef = useRef(onCompositionStart);
  const onCompositionEndRef = useRef(onCompositionEnd);
  const onFocusChangeRef = useRef(onFocusChange);
  const [value, setValue] = useState(contentRef.current);
  const [scrollTop, setScrollTop] = useState(0);
  const shouldUseCompactInactiveEditor =
    (isWindowsPlatform() || isMobilePlatform()) && !isFocusMode && !isActive && value.trim().length === 0;
  const editorMinHeight = shouldUseCompactInactiveEditor ? COMPACT_INACTIVE_MIN_HEIGHT : MIN_HEIGHT;

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
    onPasteRef.current = onPaste;
    onCompositionStartRef.current = onCompositionStart;
    onCompositionEndRef.current = onCompositionEnd;
    onFocusChangeRef.current = onFocusChange;
  }, [onCompositionEnd, onCompositionStart, onContentChange, onFocusChange, onPaste]);

  const emitUiSync = useCallback(() => {
    const element = textareaRef.current;
    if (element) {
      element.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT, { bubbles: true }));
    }
    document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
  }, []);

  const syncSelection = useCallback(() => {
    selectionRef.current = getSelection(textareaRef.current, selectionRef.current);
  }, []);

  const applyContent = useCallback(
    (next: string, start: number, end = start, focus = true) => {
      const normalized = normalizeEditorContent(next);
      contentRef.current = normalized;
      selectionRef.current = { start, end };
      setValue(normalized);
      onContentChangeRef.current(serializeEditorContent(normalized));

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        textarea.value = normalized;
        if (focus) {
          textarea.focus();
        }
        textarea.setSelectionRange(start, end);
        textarea.scrollTop = textarea.scrollHeight;
        setScrollTop(textarea.scrollTop);
        emitUiSync();
      });
    },
    [emitUiSync],
  );

  const getContentSnapshot = useCallback(() => textareaRef.current?.value ?? contentRef.current, []);

  useEffect(() => {
    const normalizedInitialContent = normalizeEditorContent(initialContent);
    if (normalizedInitialContent === serializeEditorContent(contentRef.current)) {
      return;
    }

    const next = deserializeEditorContent(normalizedInitialContent);
    if (next === contentRef.current) {
      return;
    }

    contentRef.current = next;
    setValue(next);
  }, [initialContent]);

  const actions: EditorRefActions = useMemo(
    () => ({
      getEditor: () => textareaRef.current,
      focus: () => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        textarea.focus();
        textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
      },
      blur: () => {
        textareaRef.current?.blur();
      },
      scrollToCursor: () => {
        textareaRef.current?.scrollIntoView({ block: "nearest" });
      },
      insertText: (text, prefix = "", suffix = "") => {
        const textarea = textareaRef.current;
        const content = getContentSnapshot();
        const { start, end } = getSelection(textarea, selectionRef.current);
        const inserted = `${prefix}${text}${suffix}`;
        const next = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
        const nextCursor = start + inserted.length;
        applyContent(next, nextCursor, nextCursor);
      },
      removeText: (start, length) => {
        const content = getContentSnapshot();
        const next = `${content.slice(0, start)}${content.slice(start + length)}`;
        applyContent(next, start, start);
      },
      replaceRange: (start, end, text) => {
        const content = getContentSnapshot();
        const next = `${content.slice(0, start)}${text}${content.slice(end)}`;
        const nextCursor = start + text.length;
        applyContent(next, nextCursor, nextCursor);
      },
      setContent: (text) => {
        const next = deserializeEditorContent(normalizeEditorContent(text));
        contentRef.current = next;
        setValue(next);
      },
      resetToInitialState: () => {
        applyContent("", 0, 0, false);
      },
      getContent: () => getContentSnapshot(),
      getSelectedContent: () => {
        const textarea = textareaRef.current;
        const content = getContentSnapshot();
        const { start, end } = getSelection(textarea, selectionRef.current);
        return content.slice(start, end);
      },
      wrapSelection: (prefix, suffix = prefix) => {
        const textarea = textareaRef.current;
        const content = getContentSnapshot();
        const { start, end } = getSelection(textarea, selectionRef.current);
        const selected = content.slice(start, end);
        const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
        const selectionStart = start + prefix.length;
        const selectionEnd = selected.length === 0 ? selectionStart : selectionStart + selected.length;
        applyContent(next, selectionStart, selectionEnd);
      },
      getCursorPosition: () => getSelection(textareaRef.current, selectionRef.current).start,
      setCursorPosition: (startPos, endPos = startPos) => {
        selectionRef.current = { start: startPos, end: endPos };
        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) {
            return;
          }
          textarea.focus();
          textarea.setSelectionRange(startPos, endPos);
          emitUiSync();
        });
      },
      getCursorLineNumber: () => {
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        return getContentSnapshot().slice(0, cursor).split("\n").length - 1;
      },
      getLine: (lineNumber) => getLineRanges(getContentSnapshot())[lineNumber]?.text ?? "",
      setLine: (lineNumber, text) => {
        const content = getContentSnapshot();
        const line = getLineRanges(content)[lineNumber];
        if (!line) {
          return;
        }
        const next = `${content.slice(0, line.start)}${text}${content.slice(line.end)}`;
        applyContent(next, line.start + text.length, line.start + text.length);
      },
      getWordAroundCursor: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        return getWordAtCursor(content, cursor);
      },
      replaceWordAroundCursor: (replacement) => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const word = getWordAtCursor(content, cursor);
        const next = `${content.slice(0, word.start)}${replacement}${content.slice(word.end)}`;
        const nextCursor = word.start + replacement.length;
        applyContent(next, nextCursor, nextCursor);
      },
      toggleInlineStyle: (style) => {
        const tokens = INLINE_STYLE_TOKENS[style];
        const textarea = textareaRef.current;
        const content = getContentSnapshot();
        const { start, end } = getSelection(textarea, selectionRef.current);
        const selected = content.slice(start, end);

        if (
          selected.startsWith(tokens.open) &&
          selected.endsWith(tokens.close) &&
          selected.length >= tokens.open.length + tokens.close.length
        ) {
          const unwrapped = selected.slice(tokens.open.length, selected.length - tokens.close.length);
          const next = `${content.slice(0, start)}${unwrapped}${content.slice(end)}`;
          applyContent(next, start, start + unwrapped.length);
          return;
        }

        const next = `${content.slice(0, start)}${tokens.open}${selected}${tokens.close}${content.slice(end)}`;
        const selectionStart = start + tokens.open.length;
        const selectionEnd = selected.length === 0 ? selectionStart : selectionStart + selected.length;
        applyContent(next, selectionStart, selectionEnd);
      },
      insertTagTrigger: () => {
        const content = getContentSnapshot();
        const { start, end } = getSelection(textareaRef.current, selectionRef.current);
        const word = getWordAtCursor(content, start);
        if (word.text.startsWith("#")) {
          return;
        }
        const next = `${content.slice(0, start)}#${content.slice(end)}`;
        applyContent(next, start + 1, start + 1);
      },
      toggleTaskList: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const result = getTaskListToggleTransition(content, cursor);
        applyContent(result.content, result.cursor, result.cursor);
      },
      toggleBulletedList: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const currentLine = getCurrentLine(content, cursor);
        const match = currentLine.text.match(/^(\s*)[-*+]\s+(.*)$/);
        const nextLine = match ? `${match[1]}${match[2]}` : `${BULLETED_LIST_MARKER}${currentLine.text}`;
        const next = `${content.slice(0, currentLine.start)}${nextLine}${content.slice(currentLine.end)}`;
        const markerLength = match ? currentLine.text.length - match[1].length - match[2].length : BULLETED_LIST_MARKER.length;
        const cursorOffset = match
          ? Math.max(match[1].length, cursor - currentLine.start - markerLength)
          : Math.min(nextLine.length, cursor - currentLine.start + BULLETED_LIST_MARKER.length);
        applyContent(next, currentLine.start + cursorOffset, currentLine.start + cursorOffset);
      },
      toggleNumberedList: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const currentLine = getCurrentLine(content, cursor);
        const match = currentLine.text.match(/^(\s*)\d+\.\s+(.*)$/);
        const orderedMarker = getOrderedListMarker(1);
        const nextLine = match ? `${match[1]}${match[2]}` : `${orderedMarker}${currentLine.text}`;
        const next = `${content.slice(0, currentLine.start)}${nextLine}${content.slice(currentLine.end)}`;
        const cursorOffset = match
          ? Math.max(0, cursor - currentLine.start - (currentLine.text.length - match[1].length - match[2].length))
          : Math.min(nextLine.length, cursor - currentLine.start + orderedMarker.length);
        applyContent(next, currentLine.start + cursorOffset, currentLine.start + cursorOffset);
      },
      indentList: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const line = getCurrentLine(content, cursor);
        const targetIndent = `${line.text.match(/^\s*/)?.[0] ?? ""}${LIST_INDENT}`;
        const nextLine = rewritePlainListMarkerForIndent(line.text, targetIndent, content.slice(0, line.start));
        const next = `${content.slice(0, line.start)}${nextLine}${content.slice(line.end)}`;
        const nextCursor = line.start + Math.min(nextLine.length, cursor - line.start + LIST_INDENT.length);
        applyContent(next, nextCursor, nextCursor);
      },
      outdentList: () => {
        const content = getContentSnapshot();
        const cursor = getSelection(textareaRef.current, selectionRef.current).start;
        const line = getCurrentLine(content, cursor);
        const indent = line.text.match(/^\s*/)?.[0] ?? "";
        if (indent.length === 0) {
          return;
        }
        const removed = indent.length - getOutdentedIndent(indent).length;
        const targetIndent = getOutdentedIndent(indent);
        const nextLine = rewritePlainListMarkerForIndent(line.text, targetIndent, content.slice(0, line.start));
        const next = `${content.slice(0, line.start)}${nextLine}${content.slice(line.end)}`;
        const nextCursor = Math.max(line.start, cursor - removed);
        applyContent(next, nextCursor, nextCursor);
      },
      isInlineStyleActive: (style) => {
        const tokens = INLINE_STYLE_TOKENS[style];
        const content = getContentSnapshot();
        const { start, end } = getSelection(textareaRef.current, selectionRef.current);
        return isWrappedByDelimiter(content, start, end, tokens.open, tokens.close);
      },
    }),
    [applyContent, emitUiSync, getContentSnapshot],
  );

  useImperativeHandle(ref, () => actions, [actions]);

  const handleTagClick = useCallback(
    (tagName: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: tagName }]));
      const pathname = location.pathname.startsWith("/memos/") ? Routes.HOME : location.pathname;
      navigateTo(`${pathname}?${searchParams.toString()}`);
    },
    [location.pathname, location.search, navigateTo],
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[0.7rem] bg-transparent",
        isFocusMode ? "flex-1" : EDITOR_HEIGHT.normal,
        className,
      )}
    >
      {value && <WysiwygOverlay content={value} scrollTop={scrollTop} onTagClick={handleTagClick} />}
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => {
          contentRef.current = event.target.value;
          selectionRef.current = {
            start: event.target.selectionStart ?? event.target.value.length,
            end: event.target.selectionEnd ?? event.target.value.length,
          };
          setValue(event.target.value);
          onContentChangeRef.current(serializeEditorContent(event.target.value));
          emitUiSync();
        }}
        onFocus={() => onFocusChangeRef.current?.(true)}
        onBlur={() => {
          syncSelection();
          onFocusChangeRef.current?.(false);
          emitUiSync();
        }}
        onPaste={(event) => onPasteRef.current(event)}
        onSelect={syncSelection}
        onKeyUp={() => {
          syncSelection();
          emitUiSync();
        }}
        onMouseUp={() => {
          syncSelection();
          emitUiSync();
        }}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
        onCompositionStart={() => onCompositionStartRef.current?.()}
        onCompositionEnd={() => {
          onCompositionEndRef.current?.();
          emitUiSync();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
            const lowerKey = event.key.toLowerCase();
            if (lowerKey === "b") {
              event.preventDefault();
              actions.toggleInlineStyle("bold");
              return;
            }
            if (lowerKey === "i") {
              event.preventDefault();
              actions.toggleInlineStyle("italic");
              return;
            }
          }

          if (event.key === "Enter" && !event.shiftKey) {
            const { start, end } = getSelection(textareaRef.current, selectionRef.current);
            if (start === end) {
              const content = getContentSnapshot();
              const transition =
                getInlineStyleEnterTransition(content, start) ??
                getTaskListEnterTransition(content, start) ??
                getPlainListEnterTransition(content, start);
              if (transition) {
                event.preventDefault();
                applyContent(transition.content, transition.cursor, transition.cursor);
                return;
              }
            }
          }

          if (event.key === "Tab") {
            event.preventDefault();
            if (event.shiftKey) {
              actions.outdentList();
            } else {
              actions.indentList();
            }
          }
        }}
        className={cn(
          "relative z-10 w-full resize-none rounded-[0.7rem] bg-transparent px-0 py-1 text-[0.94rem] leading-[1.7] outline-none caret-foreground selection:bg-primary/20 selection:text-transparent selection:[-webkit-text-fill-color:transparent] placeholder:text-muted-foreground",
          value ? "text-transparent" : "text-foreground",
          isFocusMode && "h-full flex-1",
        )}
        style={{ minHeight: editorMinHeight }}
      />
    </div>
  );
});

export default memo(Editor);
