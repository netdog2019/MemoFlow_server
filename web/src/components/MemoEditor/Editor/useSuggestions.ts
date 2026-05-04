import { useEffect, useMemo, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { EDITOR_FORCE_SUGGESTIONS_EVENT, EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, EDITOR_UI_SYNC_EVENT, type EditorRefActions } from ".";

export interface Position {
  left: number;
  top: number;
  height: number;
}

export interface UseSuggestionsOptions<T> {
  editorRef: React.RefObject<EditorRefActions | null>;
  triggerChar: string;
  items: T[];
  filterItems: (items: T[], searchQuery: string) => T[];
  onAutocomplete: (item: T, word: string, startIndex: number, endIndex: number, actions: EditorRefActions) => void;
}

export interface UseSuggestionsReturn<T> {
  position: Position | null;
  suggestions: T[];
  selectedIndex: number;
  isVisible: boolean;
  searchQuery: string;
  handleItemSelect: (item: T) => void;
}

const FORCED_SUGGESTIONS_GRACE_MS = 280;
type SyncSource = "input" | "selection" | "ui" | "focus" | "force";

function getSuggestionsRoot(editorElement: HTMLElement | null): HTMLElement | null {
  return editorElement?.closest<HTMLElement>("[data-editor-suggestions-root='true']") ?? null;
}

function toFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function getContentEditableCaretPosition(suggestionsRoot: HTMLElement): Position | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  if (!rect) {
    return null;
  }

  const rootRect = suggestionsRoot.getBoundingClientRect();

  return {
    left: toFiniteNumber(rect.left - rootRect.left, 0),
    top: toFiniteNumber(rect.top - rootRect.top, 0),
    height: toFiniteNumber(rect.height, 24),
  };
}

function getTextareaCaretPosition(editorElement: HTMLTextAreaElement, suggestionsRoot: HTMLElement): Position {
  const cursor = editorElement.selectionEnd ?? editorElement.selectionStart ?? 0;
  const caret = getCaretCoordinates(editorElement, cursor);
  const editorRect = editorElement.getBoundingClientRect();
  const rootRect = suggestionsRoot.getBoundingClientRect();

  return {
    left: toFiniteNumber(editorRect.left - rootRect.left + caret.left - editorElement.scrollLeft, 0),
    top: toFiniteNumber(editorRect.top - rootRect.top + caret.top - editorElement.scrollTop, 0),
    height: toFiniteNumber(caret.height, 24),
  };
}

function getCaretPosition(editorElement: HTMLElement | null): Position | null {
  const suggestionsRoot = getSuggestionsRoot(editorElement);
  if (!editorElement || !suggestionsRoot) {
    return null;
  }

  if (editorElement instanceof HTMLTextAreaElement) {
    return getTextareaCaretPosition(editorElement, suggestionsRoot);
  }

  return getContentEditableCaretPosition(suggestionsRoot);
}

function getTriggeredWord(content: string, cursor: number, triggerChar: string) {
  const safeCursor = Math.max(0, Math.min(cursor, content.length));
  let start = safeCursor;
  let end = safeCursor;

  while (start > 0 && !/\s/.test(content[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < content.length && !/\s/.test(content[end] ?? "")) {
    end += 1;
  }

  const segment = content.slice(start, end);
  const triggerIndex = segment.lastIndexOf(triggerChar, Math.max(0, safeCursor - start - 1));
  if (triggerIndex < 0) {
    return null;
  }

  let normalizedTriggerIndex = triggerIndex;
  while (normalizedTriggerIndex > 0 && segment[normalizedTriggerIndex - 1] === triggerChar) {
    normalizedTriggerIndex -= 1;
  }

  const wordStart = start + normalizedTriggerIndex;
  const word = content.slice(wordStart, end);
  if (!word.startsWith(triggerChar)) {
    return null;
  }

  return {
    text: word,
    start: wordStart,
    end,
  };
}

export function useSuggestions<T>({
  editorRef,
  triggerChar,
  items,
  filterItems,
  onAutocomplete,
}: UseSuggestionsOptions<T>): UseSuggestionsReturn<T> {
  const [editorElement, setEditorElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [word, setWord] = useState("");
  const [wordStart, setWordStart] = useState(0);
  const [wordEnd, setWordEnd] = useState(0);
  const forcedAnchorRef = useRef<Position | null>(null);
  const forceSyncFrameRef = useRef<number | null>(null);
  const lastForceTriggerAtRef = useRef(0);
  const suppressSyncUntilRef = useRef(0);
  const lastKnownPositionRef = useRef<Position | null>(null);
  const isVisible = Boolean(position);

  const isWithinForcedSuggestionsGrace = () =>
    Date.now() < Math.max(suppressSyncUntilRef.current, lastForceTriggerAtRef.current + FORCED_SUGGESTIONS_GRACE_MS);

  const suggestions = useMemo(() => {
    if (!word.startsWith(triggerChar)) {
      return [];
    }
    return filterItems(items, word.slice(triggerChar.length).toLowerCase());
  }, [filterItems, items, triggerChar, word]);

  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;

  const cancelForcedSync = () => {
    if (forceSyncFrameRef.current !== null) {
      cancelAnimationFrame(forceSyncFrameRef.current);
      forceSyncFrameRef.current = null;
    }
  };

  const hide = () => {
    cancelForcedSync();
    setPosition(null);
    setSelectedIndex(0);
  };

  useEffect(() => {
    let frame = 0;

    const syncEditorElement = () => {
      const nextEditorElement = editorRef.current?.getEditor() ?? null;
      setEditorElement((current) => {
        if (current === nextEditorElement) {
          return current;
        }
        return nextEditorElement;
      });

      if (!nextEditorElement) {
        frame = requestAnimationFrame(syncEditorElement);
      }
    };

    syncEditorElement();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [editorRef]);

  const isEditorFocused = () => {
    const activeElement = document.activeElement;
    if (!editorElement) {
      return false;
    }

    if (activeElement && (activeElement === editorElement || editorElement.contains(activeElement))) {
      return true;
    }

    if (editorElement instanceof HTMLTextAreaElement) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    return editorElement.contains(range.startContainer) || editorElement.contains(range.endContainer);
  };

  const sync = (source: SyncSource, allowWithoutFocus = false, bypassSuppression = false) => {
    try {
      const editor = editorRef.current;
      if (!editor) {
        hide();
        return false;
      }

      if (!allowWithoutFocus && !isEditorFocused()) {
        if (isWithinForcedSuggestionsGrace()) {
          return false;
        }
        hide();
        return false;
      }

      if (!bypassSuppression && Date.now() < suppressSyncUntilRef.current) {
        return false;
      }

      const currentWord = getTriggeredWord(editor.getContent(), editor.getCursorPosition(), triggerChar);
      if (!currentWord || !currentWord.text.startsWith(triggerChar)) {
        if (isWithinForcedSuggestionsGrace()) {
          return false;
        }
        hide();
        return false;
      }

      setWord(currentWord.text);
      setWordStart(currentWord.start);
      setWordEnd(currentWord.end);
      setSelectedIndex(0);
      const canOpenSuggestions = source === "input" || source === "force" || isVisible;
      if (!canOpenSuggestions) {
        return false;
      }
      const nextPosition = forcedAnchorRef.current ?? getCaretPosition(editorElement) ?? lastKnownPositionRef.current;
      if (nextPosition) {
        lastKnownPositionRef.current = nextPosition;
      }
      setPosition(nextPosition);
      forcedAnchorRef.current = null;
      return true;
    } catch (error) {
      console.error("Failed to sync editor suggestions:", error);
      hide();
      return false;
    }
  };

  const handleItemSelect = (item: T) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    suppressSyncUntilRef.current = Date.now() + 160;
    forcedAnchorRef.current = null;
    onAutocomplete(item, word, wordStart, wordEnd, editor);
    setWord("");
    hide();
    requestAnimationFrame(() => editor.focus());
  };

  useEffect(() => {
    if (!editorElement) {
      return;
    }

    const handleSelectionChange = () => {
      if (!isEditorFocused()) {
        if (isWithinForcedSuggestionsGrace()) {
          return;
        }
        hide();
        return;
      }
      sync("selection");
    };

    const handleEditorUiSync = () => {
      sync("ui");
    };

    const handleSetSuggestionsAnchor = (event: Event) => {
      const customEvent = event as CustomEvent<Position>;
      const suggestionsRoot = getSuggestionsRoot(editorElement);
      if (!suggestionsRoot) {
        forcedAnchorRef.current = customEvent.detail;
        return;
      }

      const rootRect = suggestionsRoot.getBoundingClientRect();
      forcedAnchorRef.current = {
        left: customEvent.detail.left - (rootRect.left + window.scrollX),
        top: customEvent.detail.top - (rootRect.top + window.scrollY),
        height: customEvent.detail.height,
      };
    };

    const handleForceSuggestions = (event: Event) => {
      const customEvent = event as CustomEvent<{ triggerChar?: string; word?: string; start?: number; end?: number }>;
      if (customEvent.detail?.triggerChar !== triggerChar) {
        return;
      }

      if (customEvent.detail.word?.startsWith(triggerChar)) {
        lastForceTriggerAtRef.current = Date.now();
        suppressSyncUntilRef.current = Math.max(suppressSyncUntilRef.current, Date.now() + FORCED_SUGGESTIONS_GRACE_MS);
        cancelForcedSync();
        setWord(customEvent.detail.word);
        setWordStart(customEvent.detail.start ?? editorRef.current?.getCursorPosition() ?? 0);
        setWordEnd(customEvent.detail.end ?? customEvent.detail.start ?? editorRef.current?.getCursorPosition() ?? 0);
        setSelectedIndex(0);
        const nextPosition = forcedAnchorRef.current ?? getCaretPosition(editorElement) ?? lastKnownPositionRef.current;
        if (nextPosition) {
          lastKnownPositionRef.current = nextPosition;
        }
        setPosition(nextPosition);
        forcedAnchorRef.current = null;
        return;
      }

      cancelForcedSync();
      lastForceTriggerAtRef.current = Date.now();
      suppressSyncUntilRef.current = Math.max(suppressSyncUntilRef.current, Date.now() + FORCED_SUGGESTIONS_GRACE_MS);

      let attemptsLeft = 8;
      const retrySync = () => {
        const synced = sync("force", true, true);
        if (synced || attemptsLeft <= 0) {
          forceSyncFrameRef.current = null;
          return;
        }

        attemptsLeft -= 1;
        forceSyncFrameRef.current = requestAnimationFrame(retrySync);
      };

      forceSyncFrameRef.current = requestAnimationFrame(retrySync);
    };

    const handleInput = () => {
      sync("input");
    };

    const handleFocusIn = () => {
      sync("focus");
    };

    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        if (!isEditorFocused()) {
          if (isWithinForcedSuggestionsGrace()) {
            return;
          }
          hide();
        }
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) {
        return;
      }

      if (event.key === "Escape" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
        hide();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % suggestions.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        handleItemSelect(suggestions[selectedRef.current]);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener(EDITOR_UI_SYNC_EVENT, handleEditorUiSync as EventListener);
    document.addEventListener(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, handleSetSuggestionsAnchor as EventListener);
    document.addEventListener(EDITOR_FORCE_SUGGESTIONS_EVENT, handleForceSuggestions as EventListener);
    editorElement.addEventListener("input", handleInput);
    editorElement.addEventListener("keydown", handleKeyDown);
    editorElement.addEventListener("focusin", handleFocusIn);
    editorElement.addEventListener("focusout", handleFocusOut);

    return () => {
      cancelForcedSync();
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener(EDITOR_UI_SYNC_EVENT, handleEditorUiSync as EventListener);
      document.removeEventListener(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, handleSetSuggestionsAnchor as EventListener);
      document.removeEventListener(EDITOR_FORCE_SUGGESTIONS_EVENT, handleForceSuggestions as EventListener);
      editorElement.removeEventListener("input", handleInput);
      editorElement.removeEventListener("keydown", handleKeyDown);
      editorElement.removeEventListener("focusin", handleFocusIn);
      editorElement.removeEventListener("focusout", handleFocusOut);
    };
  }, [editorElement, editorRef, isVisible, suggestions]);

  return {
    position,
    suggestions,
    selectedIndex,
    isVisible: isVisible && suggestions.length > 0,
    searchQuery: word.startsWith(triggerChar) ? word.slice(triggerChar.length).toLowerCase() : "",
    handleItemSelect,
  };
}
