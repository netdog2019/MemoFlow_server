import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EDITOR_FORCE_SUGGESTIONS_EVENT,
  EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT,
  EDITOR_UI_SYNC_EVENT,
  type EditorRefActions,
} from "@/components/MemoEditor/Editor";
import { useSuggestions } from "@/components/MemoEditor/Editor/useSuggestions";

interface FakeEditorState {
  content: string;
  cursor: number;
}

function SuggestionsHarness({ state }: { state: FakeEditorState }) {
  const editorElementRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorRefActions | null>({
    getEditor: () => editorElementRef.current,
    focus: () => editorElementRef.current?.focus(),
    blur: () => editorElementRef.current?.blur(),
    scrollToCursor: () => undefined,
    insertText: () => undefined,
    removeText: () => undefined,
    replaceRange: () => undefined,
    setContent: () => undefined,
    resetToInitialState: () => undefined,
    getContent: () => state.content,
    getSelectedContent: () => "",
    wrapSelection: () => undefined,
    getCursorPosition: () => state.cursor,
    setCursorPosition: () => undefined,
    getCursorLineNumber: () => 0,
    getLine: () => "",
    setLine: () => undefined,
    getWordAroundCursor: () => ({ text: "", start: 0, end: 0 }),
    replaceWordAroundCursor: () => undefined,
    toggleInlineStyle: () => undefined,
    insertTagTrigger: () => undefined,
    toggleTaskList: () => undefined,
    toggleBulletedList: () => undefined,
    toggleNumberedList: () => undefined,
    indentList: () => undefined,
    outdentList: () => undefined,
    isInlineStyleActive: () => false,
  });

  const { isVisible, position, suggestions, searchQuery } = useSuggestions({
    editorRef,
    triggerChar: "#",
    items: ["alpha", "beta"],
    filterItems: (items, query) => (!query ? items : items.filter((item) => item.includes(query))),
    onAutocomplete: () => undefined,
  });

  return (
    <div data-editor-suggestions-root="true">
      <div ref={editorElementRef} data-testid="editor" contentEditable suppressContentEditableWarning tabIndex={0}>
        {state.content}
      </div>
      <div data-testid="visibility">{isVisible && position ? "visible" : "hidden"}</div>
      <div data-testid="count">{suggestions.length}</div>
      <div data-testid="query">{searchQuery}</div>
    </div>
  );
}

function InteractiveSuggestionsHarness() {
  const editorElementRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("#");
  const [reportedContent, setReportedContent] = useState("#");
  const [cursor, setCursor] = useState(1);

  const editorRef = useRef<EditorRefActions | null>(null);
  editorRef.current = {
    getEditor: () => editorElementRef.current,
    focus: () => editorElementRef.current?.focus(),
    blur: () => editorElementRef.current?.blur(),
    scrollToCursor: () => undefined,
    insertText: () => undefined,
    removeText: () => undefined,
    replaceRange: (start, end, text) => {
      const next = `${reportedContent.slice(0, start)}${text}${reportedContent.slice(end)}`;
      setContent(next);
      setReportedContent(next);
      setCursor(start + text.length);
    },
    setContent: () => undefined,
    resetToInitialState: () => undefined,
    getContent: () => reportedContent,
    getSelectedContent: () => "",
    wrapSelection: () => undefined,
    getCursorPosition: () => cursor,
    setCursorPosition: () => undefined,
    getCursorLineNumber: () => 0,
    getLine: () => "",
    setLine: () => undefined,
    getWordAroundCursor: () => ({ text: "", start: 0, end: 0 }),
    replaceWordAroundCursor: () => undefined,
    toggleInlineStyle: () => undefined,
    insertTagTrigger: () => undefined,
    toggleTaskList: () => undefined,
    toggleBulletedList: () => undefined,
    toggleNumberedList: () => undefined,
    indentList: () => undefined,
    outdentList: () => undefined,
    isInlineStyleActive: () => false,
  };

  const { isVisible, position, suggestions, searchQuery, handleItemSelect } = useSuggestions({
    editorRef,
    triggerChar: "#",
    items: ["alpha", "beta"],
    filterItems: (items, query) => (!query ? items : items.filter((item) => item.includes(query))),
    onAutocomplete: (tag, _word, start, end, actions) => {
      actions.replaceRange(start, end, `#${tag} `);
    },
  });

  const dispatchAnchor = () => {
    document.dispatchEvent(new CustomEvent(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, { detail: { left: 16, top: 12, height: 20 } }));
  };

  return (
    <div data-editor-suggestions-root="true">
      <div ref={editorElementRef} data-testid="interactive-editor" contentEditable suppressContentEditableWarning tabIndex={0}>
        {content}
      </div>
      <div data-testid="interactive-content">{content}</div>
      <div data-testid="interactive-visibility">{isVisible && position ? "visible" : "hidden"}</div>
      <div data-testid="interactive-query">{searchQuery}</div>
      <button
        type="button"
        data-testid="open-first-tag-popup"
        onClick={() => {
          dispatchAnchor();
          document.dispatchEvent(
            new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, {
              detail: { triggerChar: "#", word: "#", start: 0, end: 1 },
            }),
          );
        }}
      >
        open first tag popup
      </button>
      <button
        type="button"
        data-testid="type-second-hash"
        onClick={() => {
          const next = `${content}#`;
          const hashStart = content.length;
          setContent(next);
          setReportedContent(next);
          setCursor(next.length);
          dispatchAnchor();
          document.dispatchEvent(
            new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, {
              detail: { triggerChar: "#", word: "#", start: hashStart, end: next.length },
            }),
          );
          document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
        }}
      >
        type second hash
      </button>
      <button
        type="button"
        data-testid="type-second-hash-with-stale-sync"
        onClick={() => {
          const previous = content;
          const next = `${content}#`;
          const hashStart = content.length;
          setContent(next);
          setReportedContent(previous);
          setCursor(next.length);
          dispatchAnchor();
          document.dispatchEvent(
            new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, {
              detail: { triggerChar: "#", word: "#", start: hashStart, end: next.length },
            }),
          );
          document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
          setReportedContent(next);
          document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
        }}
      >
        type second hash with stale sync
      </button>
      {suggestions.map((item) => (
        <button key={item} type="button" data-testid={`suggestion-${item}`} onClick={() => handleItemSelect(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}


function TextareaSuggestionsHarness() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [cursor, setCursor] = useState(0);

  const editorRef = useRef<EditorRefActions | null>(null);
  editorRef.current = {
    getEditor: () => textareaRef.current,
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    scrollToCursor: () => undefined,
    insertText: () => undefined,
    removeText: () => undefined,
    replaceRange: () => undefined,
    setContent: () => undefined,
    resetToInitialState: () => undefined,
    getContent: () => textareaRef.current?.value ?? content,
    getSelectedContent: () => "",
    wrapSelection: () => undefined,
    getCursorPosition: () => textareaRef.current?.selectionEnd ?? cursor,
    setCursorPosition: () => undefined,
    getCursorLineNumber: () => 0,
    getLine: () => "",
    setLine: () => undefined,
    getWordAroundCursor: () => ({ text: "", start: 0, end: 0 }),
    replaceWordAroundCursor: () => undefined,
    toggleInlineStyle: () => undefined,
    insertTagTrigger: () => undefined,
    toggleTaskList: () => undefined,
    toggleBulletedList: () => undefined,
    toggleNumberedList: () => undefined,
    indentList: () => undefined,
    outdentList: () => undefined,
    isInlineStyleActive: () => false,
  };

  const { isVisible, position, suggestions, searchQuery } = useSuggestions({
    editorRef,
    triggerChar: "#",
    items: ["alpha", "beta"],
    filterItems: (items, query) => (!query ? items : items.filter((item) => item.includes(query))),
    onAutocomplete: () => undefined,
  });

  return (
    <div data-editor-suggestions-root="true">
      <textarea
        ref={textareaRef}
        data-testid="textarea-editor"
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setCursor(event.target.selectionEnd ?? event.target.value.length);
        }}
        style={{ lineHeight: "20px", width: 240, height: 80 }}
      />
      <div data-testid="textarea-visibility">{isVisible && position ? "visible" : "hidden"}</div>
      <div data-testid="textarea-count">{suggestions.length}</div>
      <div data-testid="textarea-query">{searchQuery}</div>
      <button
        type="button"
        data-testid="textarea-type-hash"
        onClick={() => {
          requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            textarea.focus();
            fireEvent.input(textarea, {
              target: {
                value: "#",
                selectionStart: 1,
                selectionEnd: 1,
              },
            });
            setContent("#");
            setCursor(1);
            textarea.setSelectionRange(1, 1);
          });
        }}
      >
        textarea type hash
      </button>
      <button
        type="button"
        data-testid="textarea-click-existing-tag"
        onClick={() => {
          setContent("#alpha ");
          setCursor(3);
          requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            textarea.focus();
            textarea.setSelectionRange(3, 3);
            document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
          });
        }}
      >
        textarea click existing tag
      </button>
    </div>
  );
}

const nextFrame = async () => {
  await act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
};

describe("memo editor tag suggestions", () => {
  const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;

  beforeEach(() => {
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 12,
        y: 18,
        width: 0,
        height: 20,
        top: 18,
        right: 12,
        bottom: 38,
        left: 12,
        toJSON: () => ({}),
      }),
    });
  });

  afterEach(() => {
    if (originalGetBoundingClientRect) {
      Object.defineProperty(Range.prototype, "getBoundingClientRect", {
        configurable: true,
        value: originalGetBoundingClientRect,
      });
      return;
    }

    // @ts-expect-error jsdom may not implement this API natively.
    delete Range.prototype.getBoundingClientRect;
  });

  it("keeps the popup open when the immediate sync after the second # still sees stale content", async () => {
    const state: FakeEditorState = {
      content: "#alpha ",
      cursor: "#alpha ".length,
    };

    render(<SuggestionsHarness state={state} />);

    const editor = screen.getByTestId("editor");
    editor.focus();
    await nextFrame();

    act(() => {
      document.dispatchEvent(new CustomEvent(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, { detail: { left: 16, top: 12, height: 20 } }));
      state.content = "#alpha #";
      state.cursor = state.content.length;
      document.dispatchEvent(
        new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, {
          detail: { triggerChar: "#", word: "#", start: "#alpha ".length, end: "#alpha #".length },
        }),
      );
    });

    expect(screen.getByTestId("visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    expect(screen.getByTestId("query")).toHaveTextContent("");

    act(() => {
      state.content = "#alpha ";
      state.cursor = state.content.length;
      document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
    });

    expect(screen.getByTestId("visibility")).toHaveTextContent("visible");

    act(() => {
      state.content = "#alpha #";
      state.cursor = state.content.length;
      document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
    });

    expect(screen.getByTestId("visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("keeps the popup open when selecting the first tag and immediately typing a second #", async () => {
    render(<InteractiveSuggestionsHarness />);

    const editor = screen.getByTestId("interactive-editor");
    editor.focus();
    await nextFrame();

    act(() => {
      fireEvent.click(screen.getByTestId("open-first-tag-popup"));
    });

    expect(screen.getByTestId("interactive-visibility")).toHaveTextContent("visible");

    act(() => {
      fireEvent.click(screen.getByTestId("suggestion-alpha"));
    });

    expect(screen.getByTestId("interactive-content")).toHaveTextContent("#alpha");
    expect(screen.getByTestId("interactive-visibility")).toHaveTextContent("hidden");

    act(() => {
      fireEvent.click(screen.getByTestId("type-second-hash"));
    });

    expect(screen.getByTestId("interactive-content")).toHaveTextContent("#alpha #");
    expect(screen.getByTestId("interactive-visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("interactive-query")).toHaveTextContent("");
  });

  it("keeps the popup open when the second # initially syncs against stale content after selecting a tag", async () => {
    render(<InteractiveSuggestionsHarness />);

    const editor = screen.getByTestId("interactive-editor");
    editor.focus();
    await nextFrame();

    act(() => {
      fireEvent.click(screen.getByTestId("open-first-tag-popup"));
      fireEvent.click(screen.getByTestId("suggestion-alpha"));
    });

    expect(screen.getByTestId("interactive-content")).toHaveTextContent("#alpha");
    expect(screen.getByTestId("interactive-visibility")).toHaveTextContent("hidden");

    act(() => {
      fireEvent.click(screen.getByTestId("type-second-hash-with-stale-sync"));
    });

    expect(screen.getByTestId("interactive-content")).toHaveTextContent("#alpha #");
    expect(screen.getByTestId("interactive-visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("interactive-query")).toHaveTextContent("");
  });

  it("shows the popup for a textarea editor after typing #", async () => {
    render(<TextareaSuggestionsHarness />);

    act(() => {
      fireEvent.click(screen.getByTestId("textarea-type-hash"));
    });

    await nextFrame();

    expect(screen.getByTestId("textarea-visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("textarea-count")).toHaveTextContent("2");
    expect(screen.getByTestId("textarea-query")).toHaveTextContent("");
  });

  it("does not reopen the popup when clicking into an existing tag in the textarea editor", async () => {
    render(<TextareaSuggestionsHarness />);

    act(() => {
      fireEvent.click(screen.getByTestId("textarea-click-existing-tag"));
    });

    await nextFrame();

    expect(screen.getByTestId("textarea-visibility")).toHaveTextContent("hidden");
  });

  it("does not hide the popup if a transient blur/selection loss happens immediately after the second #", async () => {
    const state: FakeEditorState = {
      content: "#alpha #",
      cursor: "#alpha #".length,
    };

    render(<SuggestionsHarness state={state} />);

    const editor = screen.getByTestId("editor");
    editor.focus();
    await nextFrame();

    act(() => {
      document.dispatchEvent(new CustomEvent(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, { detail: { left: 16, top: 12, height: 20 } }));
      document.dispatchEvent(
        new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, {
          detail: { triggerChar: "#", word: "#", start: "#alpha ".length, end: "#alpha #".length },
        }),
      );
    });

    expect(screen.getByTestId("visibility")).toHaveTextContent("visible");

    await act(async () => {
      editor.blur();
      editor.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      document.dispatchEvent(new Event("selectionchange"));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(screen.getByTestId("visibility")).toHaveTextContent("visible");
  });
});
