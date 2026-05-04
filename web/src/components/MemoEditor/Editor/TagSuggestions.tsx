import { useMemo } from "react";
import { matchPath } from "react-router-dom";
import { useTagCounts } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import type { TagSuggestionsProps } from "../types";
import { SuggestionsPopup } from "./SuggestionsPopup";
import { useSuggestions } from "./useSuggestions";

const normalizeTagName = (tag: string) => tag.replace(/^#+/u, "").trim();

interface TagSuggestionItem {
  name: string;
  count: number;
}

export default function TagSuggestions({ editorRef }: TagSuggestionsProps) {
  // On explore page, show all users' tags; otherwise show current user's tags
  const isExplorePage = Boolean(matchPath(Routes.EXPLORE, window.location.pathname));
  const { data: tagCount = {} } = useTagCounts(!isExplorePage);

  const sortedTags = useMemo<TagSuggestionItem[]>(() => {
    const mergedTagCounts = new Map<string, number>();

    for (const [rawTag, count] of Object.entries(tagCount)) {
      const tag = normalizeTagName(rawTag);
      if (!tag) {
        continue;
      }
      mergedTagCounts.set(tag, (mergedTagCounts.get(tag) ?? 0) + count);
    }

    return Array.from(mergedTagCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [tagCount]);

  const { position, suggestions, selectedIndex, isVisible, handleItemSelect } = useSuggestions({
    editorRef,
    triggerChar: "#",
    items: sortedTags,
    filterItems: (items, query) => (!query ? items : items.filter((tag) => tag.name.toLowerCase().includes(query))),
    onAutocomplete: (tag, _word, start, end, actions) => {
      actions.replaceRange(start, end, `#${normalizeTagName(tag.name)} `);
    },
  });

  if (!isVisible || !position) return null;

  return (
    <SuggestionsPopup
      position={position}
      suggestions={suggestions}
      selectedIndex={selectedIndex}
      onItemSelect={handleItemSelect}
      getItemKey={(tag) => tag.name}
      renderItem={(tag) => (
        <span className="truncate">
          <span className="text-muted-foreground mr-1">#</span>
          {tag.name}
        </span>
      )}
    />
  );
}
