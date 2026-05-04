import type { SlashCommandsProps } from "../types";
import type { EditorRefActions } from ".";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

const SlashCommands = ({ editorRef, commands }: SlashCommandsProps) => {
  const handleCommandAutocomplete = (cmd: (typeof commands)[0], _word: string, start: number, end: number, actions: EditorRefActions) => {
    // Remove trigger char + word, then insert command output
    actions.replaceRange(start, end, cmd.run());
    // Position cursor relative to insertion point, if specified
    if (cmd.cursorOffset) {
      actions.setCursorPosition(start + cmd.cursorOffset);
    }
  };

  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    triggerChar: "/",
    items: commands,
    filterItems: (items, query) => (!query ? items : items.filter((cmd) => cmd.name.toLowerCase().startsWith(query))),
    onAutocomplete: handleCommandAutocomplete,
  });

  if (!isVisible || !position) return null;

  return (
    <SuggestionsPopup
      position={position}
      suggestions={suggestions}
      selectedIndex={selectedIndex}
      onItemSelect={handleItemSelect}
      getItemKey={(cmd) => cmd.name}
      renderItem={(cmd) => (
        <span className="tracking-wide">
          <span className="text-muted-foreground">/</span>
          {cmd.name}
        </span>
      )}
    />
  );
};

export default SlashCommands;
