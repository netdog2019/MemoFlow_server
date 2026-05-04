import { isEqual } from "lodash-es";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  CodeIcon,
  EyeIcon,
  FileIcon,
  HashIcon,
  ImageIcon,
  LinkIcon,
  LucideIcon,
  MicIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagsIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { FilterFactor, getMemoFilterKey, MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useTranslate } from "@/utils/i18n";

interface FilterConfig {
  icon: LucideIcon;
  getLabel: (value: string, t: ReturnType<typeof useTranslate>) => string;
}

const FILTER_CONFIGS: Record<FilterFactor, FilterConfig> = {
  tagSearch: {
    icon: HashIcon,
    getLabel: (value) => value,
  },
  tagSearchOperator: {
    icon: HashIcon,
    getLabel: (value) => `标签 ${value === "or" ? "OR" : "AND"}`,
  },
  visibility: {
    icon: EyeIcon,
    getLabel: (value) => value,
  },
  contentSearch: {
    icon: SearchIcon,
    getLabel: (value) => value,
  },
  startDate: {
    icon: CalendarIcon,
    getLabel: (value) => `从 ${value}`,
  },
  endDate: {
    icon: CalendarIcon,
    getLabel: (value) => `到 ${value}`,
  },
  displayTime: {
    icon: CalendarIcon,
    getLabel: (value) => value,
  },
  tagExclude: {
    icon: HashIcon,
    getLabel: (value) => `不含 #${value}`,
  },
  pinned: {
    icon: BookmarkIcon,
    getLabel: (value) => value,
  },
  "property.hasLink": {
    icon: LinkIcon,
    getLabel: (_, t) => t("memo.filters.has-link"),
  },
  "property.hasTaskList": {
    icon: CheckCircleIcon,
    getLabel: (_, t) => t("memo.filters.has-task-list"),
  },
  "property.hasCode": {
    icon: CodeIcon,
    getLabel: (_, t) => t("memo.filters.has-code"),
  },
  "property.hasIncompleteTasks": {
    icon: CheckCircleIcon,
    getLabel: () => "未完成清单",
  },
  "property.hasAttachment": {
    icon: FileIcon,
    getLabel: () => "有附件",
  },
  "property.hasImage": {
    icon: ImageIcon,
    getLabel: () => "有图片",
  },
  "property.hasAudio": {
    icon: MicIcon,
    getLabel: () => "有音频",
  },
  "property.hasVideo": {
    icon: VideoIcon,
    getLabel: () => "有视频",
  },
  "property.noTag": {
    icon: TagsIcon,
    getLabel: () => "无标签",
  },
  advancedFilter: {
    icon: SlidersHorizontalIcon,
    getLabel: (value) => `高级筛选：${value}`,
  },
};

const MemoFilters = () => {
  const t = useTranslate();
  const { filters, removeFilter } = useMemoFilterContext();

  const handleRemoveFilter = (filter: MemoFilter) => {
    removeFilter((f: MemoFilter) => isEqual(f, filter));
  };

  const getFilterDisplayText = (filter: MemoFilter): string => {
    const config = FILTER_CONFIGS[filter.factor];
    if (!config) {
      return filter.value || filter.factor;
    }
    return config.getLabel(filter.value, t);
  };

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-3 flex flex-row justify-start items-center flex-wrap gap-2">
      {filters.map((filter) => {
        const config = FILTER_CONFIGS[filter.factor];
        const Icon = config?.icon;

        return (
          <div
            key={getMemoFilterKey(filter)}
            className="group inline-flex items-center gap-1.5 h-8 px-3 bg-[var(--memo-chip)] hover:bg-accent/88 border border-border/45 rounded-full text-sm transition-all duration-200 hover:shadow-xs"
          >
            {Icon && <Icon className="w-3.5 h-3.5 text-[var(--memo-chip-foreground)] shrink-0" />}
            <span className="text-[var(--memo-chip-foreground)] font-medium max-w-32 truncate">{getFilterDisplayText(filter)}</span>
            <button
              onClick={() => handleRemoveFilter(filter)}
              className="ml-0.5 -mr-1 p-0.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              aria-label="Remove filter"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

MemoFilters.displayName = "MemoFilters";

export default MemoFilters;
