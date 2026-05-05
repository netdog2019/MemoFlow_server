import { EllipsisIcon, HashIcon, TagsIcon } from "lucide-react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Switch } from "@/components/ui/switch";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TagTree from "../TagTree";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface Props {
  readonly?: boolean;
  tagCount: Record<string, number>;
}

const TagsSection = (props: Props) => {
  const t = useTranslate();
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const [treeAutoExpand, setTreeAutoExpand] = useLocalStorage<boolean>("tag-tree-auto-expand", false);

  const tags = Object.entries(props.tagCount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1]);

  const handleTagClick = (tag: string) => {
    const isActive = getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "tagSearch");
      addFilter({
        factor: "tagSearch",
        value: tag,
      });
    }
  };

  return (
    <div className="w-full flex flex-col justify-start items-start mt-3 px-1 pt-3 h-auto shrink-0 flex-nowrap border-t border-border/35 first:border-t-0 first:pt-0">
      <div className="flex flex-row justify-between items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
        <span className="inline-flex min-w-0 items-center gap-2">
          <TagsIcon className="size-4 shrink-0" />
          <span className="truncate">{t("common.tags")}</span>
        </span>
        {tags.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] text-muted-foreground hover:bg-accent/45 hover:text-foreground"
                aria-label={`${t("common.tags")}设置`}
              >
                <EllipsisIcon className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" alignOffset={-12}>
              <div className="w-auto flex flex-row justify-between items-center gap-2 p-1">
                <span className="text-sm shrink-0">{t("common.tree-mode")}</span>
                <Switch checked={treeMode} onCheckedChange={(checked) => setTreeMode(checked)} />
              </div>
              <div className="w-auto flex flex-row justify-between items-center gap-2 p-1">
                <span className="text-sm shrink-0">{t("common.auto-expand")}</span>
                <Switch disabled={!treeMode} checked={treeAutoExpand} onCheckedChange={(checked) => setTreeAutoExpand(checked)} />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {tags.length > 0 ? (
        treeMode ? (
          <TagTree tagAmounts={tags} expandSubTags={!!treeAutoExpand} />
        ) : (
          <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1.5">
            {tags.map(([tag, amount]) => {
              const isActive = getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
              return (
                <div
                  key={tag}
                  className={cn(
                    "shrink-0 w-auto max-w-full text-sm rounded-[0.35rem] leading-6 flex flex-row justify-start items-center select-none cursor-pointer px-1.5 py-0.5 transition-colors",
                    isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => handleTagClick(tag)}
                >
                  <HashIcon className="w-4 h-auto shrink-0" />
                  <div className="inline-flex flex-nowrap ml-0.5 gap-0.5 max-w-[calc(100%-16px)]">
                    <span className="truncate">{tag}</span>
                    {amount > 1 && <span className="opacity-60 shrink-0">({amount})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        !props.readonly && (
          <div className="p-2 border border-dashed rounded-md flex flex-row justify-start items-start gap-2 text-muted-foreground">
            <TagsIcon className="w-5 h-5 shrink-0" />
            <p className="text-sm leading-snug italic">{t("tag.create-tags-guide")}</p>
          </div>
        )
      )}
    </div>
  );
};

export default TagsSection;
