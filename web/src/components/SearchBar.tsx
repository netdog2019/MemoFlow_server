import {
  CalendarIcon,
  CheckCircleIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  MicIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagsIcon,
  VideoIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type FilterFactor, type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTagCounts } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const DATE_FILTER_FACTORS: FilterFactor[] = ["displayTime", "startDate", "endDate"];
const SEARCH_OPTION_FACTORS: FilterFactor[] = [
  "advancedFilter",
  "property.hasAttachment",
  "property.hasImage",
  "property.hasAudio",
  "property.hasVideo",
  "property.hasLink",
  "property.noTag",
  "property.hasTaskList",
  "property.hasIncompleteTasks",
  "property.hasCode",
  "pinned",
];

type AdvancedFilterKind =
  | "content"
  | "tagTree"
  | "tagExact"
  | "tagStartsWith"
  | "createdAfter"
  | "createdBefore"
  | "updatedAfter"
  | "updatedBefore"
  | "visibility"
  | "pinned"
  | "hasAttachment"
  | "hasImage"
  | "hasVideo"
  | "hasAudio"
  | "hasLink"
  | "hasTaskList"
  | "hasIncompleteTasks"
  | "hasCode"
  | "noTag";

interface AdvancedFilterCondition {
  id: string;
  kind: AdvancedFilterKind;
  value: string;
  negate: boolean;
}

const advancedFilterOptions: Array<{ value: AdvancedFilterKind; label: string; placeholder?: string }> = [
  { value: "content", label: "内容包含", placeholder: "关键词" },
  { value: "tagTree", label: "包含标签" },
  { value: "tagExact", label: "精确标签" },
  { value: "tagStartsWith", label: "标签前缀" },
  { value: "createdAfter", label: "创建日期起" },
  { value: "createdBefore", label: "创建日期止" },
  { value: "updatedAfter", label: "更新日期起" },
  { value: "updatedBefore", label: "更新日期止" },
  { value: "visibility", label: "可见性" },
  { value: "pinned", label: "置顶" },
  { value: "hasAttachment", label: "有附件" },
  { value: "hasImage", label: "有图片" },
  { value: "hasVideo", label: "有视频" },
  { value: "hasAudio", label: "有音频" },
  { value: "hasLink", label: "有链接" },
  { value: "hasTaskList", label: "有清单" },
  { value: "hasIncompleteTasks", label: "未完成清单" },
  { value: "hasCode", label: "有代码" },
  { value: "noTag", label: "无标签" },
];

const advancedBooleanKinds = new Set<AdvancedFilterKind>([
  "pinned",
  "hasAttachment",
  "hasImage",
  "hasVideo",
  "hasAudio",
  "hasLink",
  "hasTaskList",
  "hasIncompleteTasks",
  "hasCode",
  "noTag",
]);
const advancedTagKinds = new Set<AdvancedFilterKind>(["tagTree", "tagExact", "tagStartsWith"]);
const advancedDateKinds = new Set<AdvancedFilterKind>(["createdAfter", "createdBefore", "updatedAfter", "updatedBefore"]);

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addYears = (date: Date, years: number): Date => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
};

const filterExists = (filters: MemoFilter[], factor: FilterFactor, value: string) =>
  filters.some((filter) => filter.factor === factor && filter.value === value);

const createAdvancedFilterCondition = (): AdvancedFilterCondition => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  kind: "tagTree",
  value: "",
  negate: false,
});

const escapeCELString = (value: string): string => JSON.stringify(value);

const dateInputToEpochSeconds = (value: string): number | undefined => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!matched) return undefined;
  const [, year, month, day] = matched;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.floor(timestamp / 1000);
};

const getAdvancedDefaultValue = (kind: AdvancedFilterKind): string => {
  if (kind === "visibility") return "PUBLIC";
  return "";
};

const advancedConditionToExpression = (condition: AdvancedFilterCondition): string | undefined => {
  const value = condition.value.trim();
  let expression = "";

  switch (condition.kind) {
    case "content":
      if (!value) return undefined;
      expression = `content.contains(${escapeCELString(value)})`;
      break;
    case "tagTree":
      if (!value) return undefined;
      expression = `tag in [${escapeCELString(value.replace(/^#+/u, ""))}]`;
      break;
    case "tagExact":
      if (!value) return undefined;
      expression = `${escapeCELString(value.replace(/^#+/u, ""))} in tags`;
      break;
    case "tagStartsWith":
      if (!value) return undefined;
      expression = `tags.exists(t, t.startsWith(${escapeCELString(value.replace(/^#+/u, ""))}))`;
      break;
    case "createdAfter": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `created_ts >= ${epochSeconds}`;
      break;
    }
    case "createdBefore": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `created_ts < ${epochSeconds + 86400}`;
      break;
    }
    case "updatedAfter": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `updated_ts >= ${epochSeconds}`;
      break;
    }
    case "updatedBefore": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `updated_ts < ${epochSeconds + 86400}`;
      break;
    }
    case "visibility":
      if (!value) return undefined;
      expression = `visibility == ${escapeCELString(value)}`;
      break;
    case "pinned":
      expression = "pinned";
      break;
    case "hasAttachment":
      expression = "has_attachment";
      break;
    case "hasImage":
      expression = "has_image";
      break;
    case "hasVideo":
      expression = "has_video";
      break;
    case "hasAudio":
      expression = "has_audio";
      break;
    case "hasLink":
      expression = "has_link";
      break;
    case "hasTaskList":
      expression = "has_task_list";
      break;
    case "hasIncompleteTasks":
      expression = "has_incomplete_tasks";
      break;
    case "hasCode":
      expression = "has_code";
      break;
    case "noTag":
      expression = "size(tags) == 0";
      break;
  }

  return condition.negate ? `!(${expression})` : expression;
};

const buildAdvancedFilterExpression = (conditions: AdvancedFilterCondition[], logic: "and" | "or") => {
  const expressions = conditions.flatMap((condition) => advancedConditionToExpression(condition) ?? []);
  return expressions.join(logic === "or" ? " || " : " && ");
};

const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Some browsers only allow showPicker from direct user activation.
  }
};

const SearchBar = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { filters, addFilter, setFilters, removeFilter, clearAllFilters } = useMemoFilterContext();
  const { data: tagCount = {} } = useTagCounts(Boolean(currentUser));
  const [queryText, setQueryText] = useState("");
  const [startDate, setStartDate] = useState(filters.find((filter) => filter.factor === "startDate")?.value || "");
  const [endDate, setEndDate] = useState(filters.find((filter) => filter.factor === "endDate")?.value || "");
  const [advancedConditions, setAdvancedConditions] = useState<AdvancedFilterCondition[]>([createAdvancedFilterCondition()]);
  const [advancedLogic, setAdvancedLogic] = useState<"and" | "or">("and");
  const inputRef = useRef<HTMLInputElement>(null);
  const optionScrollRef = useRef<HTMLDivElement>(null);
  const optionTouchRef = useRef({ startY: 0, scrollTop: 0 });

  const tagOptions = useMemo(
    () =>
      Object.entries(tagCount)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .sort((a, b) => b[1] - a[1]),
    [tagCount],
  );

  const activeSearchOptionCount = filters.filter((filter) =>
    [...DATE_FILTER_FACTORS, ...SEARCH_OPTION_FACTORS].includes(filter.factor),
  ).length;

  const addContentFilters = () => {
    const words = queryText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return;
    }

    words.forEach((word) => {
      addFilter({
        factor: "contentSearch",
        value: word,
      });
    });
    setQueryText("");
  };

  const onTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addContentFilters();
    }
  };

  const setSingleDateFilter = (date: string) => {
    setFilters([...filters.filter((filter) => !DATE_FILTER_FACTORS.includes(filter.factor)), { factor: "displayTime", value: date }]);
    setStartDate("");
    setEndDate("");
  };

  const setDateRangeFilter = () => {
    const nextFilters = filters.filter((filter) => !DATE_FILTER_FACTORS.includes(filter.factor));
    if (startDate) {
      nextFilters.push({ factor: "startDate", value: startDate });
    }
    if (endDate) {
      nextFilters.push({ factor: "endDate", value: endDate });
    }
    setFilters(nextFilters);
  };

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
    removeFilter((filter) => DATE_FILTER_FACTORS.includes(filter.factor));
  };

  const toggleFilter = (filter: MemoFilter) => {
    if (filterExists(filters, filter.factor, filter.value)) {
      removeFilter((item) => item.factor === filter.factor && item.value === filter.value);
    } else {
      addFilter(filter);
    }
  };

  const updateAdvancedCondition = (id: string, partial: Partial<AdvancedFilterCondition>) => {
    setAdvancedConditions((current) => current.map((condition) => (condition.id === id ? { ...condition, ...partial } : condition)));
  };

  const applyAdvancedFilter = () => {
    const expression = buildAdvancedFilterExpression(advancedConditions, advancedLogic);
    if (!expression) {
      return;
    }
    setFilters([...filters.filter((filter) => filter.factor !== "advancedFilter"), { factor: "advancedFilter", value: expression }]);
  };

  const clearAdvancedFilter = () => {
    setAdvancedConditions([createAdvancedFilterCondition()]);
    setAdvancedLogic("and");
    removeFilter((filter) => filter.factor === "advancedFilter");
  };

  const handleOptionTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const scrollElement = optionScrollRef.current;
    if (!scrollElement) return;
    optionTouchRef.current = {
      startY: event.touches[0]?.clientY ?? 0,
      scrollTop: scrollElement.scrollTop,
    };
  };

  const handleOptionTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const scrollElement = optionScrollRef.current;
    const touch = event.touches[0];
    if (!scrollElement || !touch || scrollElement.scrollHeight <= scrollElement.clientHeight) return;

    const deltaY = touch.clientY - optionTouchRef.current.startY;
    scrollElement.scrollTop = optionTouchRef.current.scrollTop - deltaY;
    event.preventDefault();
  };

  const quickSearchOptions: Array<{ label: string; description: string; icon: typeof ImageIcon; onClick: () => void }> = [
    {
      label: "今天",
      description: "只看今天记录",
      icon: CalendarIcon,
      onClick: () => setSingleDateFilter(formatDateInput(new Date())),
    },
    {
      label: "最近 7 天",
      description: "从 7 天前到今天",
      icon: CalendarIcon,
      onClick: () => {
        setStartDate(formatDateInput(addDays(new Date(), -6)));
        setEndDate(formatDateInput(new Date()));
        setFilters([
          ...filters.filter((filter) => !DATE_FILTER_FACTORS.includes(filter.factor)),
          { factor: "startDate", value: formatDateInput(addDays(new Date(), -6)) },
          { factor: "endDate", value: formatDateInput(new Date()) },
        ]);
      },
    },
    {
      label: "去年今日",
      description: "回看去年的今天",
      icon: CalendarIcon,
      onClick: () => setSingleDateFilter(formatDateInput(addYears(new Date(), -1))),
    },
    {
      label: "图片",
      description: "包含图片附件",
      icon: ImageIcon,
      onClick: () => toggleFilter({ factor: "property.hasImage", value: "true" }),
    },
    {
      label: "音频",
      description: "包含音频附件",
      icon: MicIcon,
      onClick: () => toggleFilter({ factor: "property.hasAudio", value: "true" }),
    },
    {
      label: "链接",
      description: "内容里有链接",
      icon: LinkIcon,
      onClick: () => toggleFilter({ factor: "property.hasLink", value: "true" }),
    },
    {
      label: "无标签",
      description: "还没有加标签",
      icon: TagsIcon,
      onClick: () => toggleFilter({ factor: "property.noTag", value: "true" }),
    },
  ];

  const moreOptions: Array<{ factor: FilterFactor; label: string; icon: typeof FileIcon }> = [
    { factor: "property.hasAttachment", label: "有附件", icon: FileIcon },
    { factor: "property.hasVideo", label: "视频", icon: VideoIcon },
    { factor: "property.hasTaskList", label: "清单", icon: CheckCircleIcon },
    { factor: "property.hasIncompleteTasks", label: "未完成清单", icon: CheckCircleIcon },
    { factor: "property.hasCode", label: "代码", icon: FileIcon },
    { factor: "pinned", label: "置顶", icon: FileIcon },
  ];

  return (
    <div className="relative w-full h-auto flex flex-row justify-start items-center">
      <SearchIcon className="absolute left-4 w-4 h-auto opacity-40 text-sidebar-foreground" />
      <input
        className={cn(
          "w-full text-sidebar-foreground leading-5 bg-card/84 border border-border/70 text-sm rounded-[1.1rem] py-2.5 pl-11 pr-12 outline-0 shadow-xs placeholder:text-muted-foreground",
        )}
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        ref={inputRef}
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-sidebar-foreground">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground"
              aria-label="打开搜索选项"
            >
              <SlidersHorizontalIcon className="size-4" />
              {activeSearchOptionCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                  {activeSearchOptionCount}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            alignOffset={-8}
            collisionPadding={12}
            className="max-h-[calc(var(--radix-popover-content-available-height)-0.5rem)] w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-lg p-0"
          >
            <div
              ref={optionScrollRef}
              className="max-h-[calc(var(--radix-popover-content-available-height)-0.5rem)] overflow-y-auto overscroll-contain p-3 [touch-action:none] [-webkit-overflow-scrolling:touch]"
              onTouchStart={handleOptionTouchStart}
              onTouchMove={handleOptionTouchMove}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">搜索选项</div>
                  <div className="text-xs text-muted-foreground">快捷搜索、日期、标签和更多条件</div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  清空
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {quickSearchOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      className="flex min-h-14 items-center gap-2 rounded-2xl border border-border/70 bg-background/72 px-3 py-2 text-left transition-colors hover:bg-accent/45"
                      onClick={option.onClick}
                    >
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{option.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2">
                <SectionTitle icon={CalendarIcon} title="日期" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 text-sm" />
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 text-sm" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={clearDateFilters}>
                    清除日期
                  </Button>
                  <Button size="sm" onClick={setDateRangeFilter}>
                    应用日期
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <SectionTitle icon={SlidersHorizontalIcon} title="高级筛选" />
                <div className="flex items-center justify-between gap-2 rounded-[0.85rem] border border-border/70 bg-background/72 px-2.5 py-2">
                  <span className="text-xs text-muted-foreground">条件逻辑</span>
                  <div className="grid grid-cols-2 rounded-[0.7rem] border border-border/60 bg-muted/30 p-0.5 text-xs">
                    <button
                      type="button"
                      className={cn(
                        "h-7 rounded-[0.55rem] px-3 transition-colors",
                        advancedLogic === "and" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setAdvancedLogic("and")}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-7 rounded-[0.55rem] px-3 transition-colors",
                        advancedLogic === "or" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setAdvancedLogic("or")}
                    >
                      OR
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {advancedConditions.map((condition) => {
                    const needsValue = !advancedBooleanKinds.has(condition.kind);
                    const isTagCondition = advancedTagKinds.has(condition.kind);
                    const isDateCondition = advancedDateKinds.has(condition.kind);
                    return (
                      <div key={condition.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 max-sm:grid-cols-1">
                        <Select
                          value={condition.kind}
                          onValueChange={(value) =>
                            updateAdvancedCondition(condition.id, {
                              kind: value as AdvancedFilterKind,
                              value: getAdvancedDefaultValue(value as AdvancedFilterKind),
                              negate: false,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {advancedFilterOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {condition.kind === "visibility" ? (
                          <Select
                            value={condition.value || "PUBLIC"}
                            onValueChange={(value) => updateAdvancedCondition(condition.id, { value })}
                          >
                            <SelectTrigger className="h-9 w-full text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                              <SelectItem value="PROTECTED">PROTECTED</SelectItem>
                              <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : isTagCondition ? (
                          <Select
                            value={condition.value}
                            onValueChange={(value) => updateAdvancedCondition(condition.id, { value })}
                            disabled={tagOptions.length === 0}
                          >
                            <SelectTrigger className="h-9 w-full text-sm">
                              <SelectValue placeholder={tagOptions.length > 0 ? "选择标签" : "暂无标签"} />
                            </SelectTrigger>
                            <SelectContent>
                              {tagOptions.map(([tag, amount]) => (
                                <SelectItem key={tag} value={tag}>
                                  #{tag}
                                  {amount > 1 ? ` (${amount})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={isDateCondition ? "date" : "text"}
                            className="h-9 w-full text-sm"
                            disabled={!needsValue}
                            value={needsValue ? condition.value : ""}
                            placeholder={
                              needsValue ? advancedFilterOptions.find((option) => option.value === condition.kind)?.placeholder : "无需填写"
                            }
                            onClick={isDateCondition ? openDatePicker : undefined}
                            onFocus={isDateCondition ? openDatePicker : undefined}
                            onChange={(event) => updateAdvancedCondition(condition.id, { value: event.target.value })}
                          />
                        )}
                        <Button
                          type="button"
                          variant={condition.negate ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAdvancedCondition(condition.id, { negate: !condition.negate })}
                        >
                          排除
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAdvancedConditions((current) => current.filter((item) => item.id !== condition.id))}
                          disabled={advancedConditions.length === 1}
                        >
                          删除
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-[0.85rem] border border-border/70 bg-background/72 p-2">
                  <div className="mb-1 text-xs text-muted-foreground">高级过滤表达式</div>
                  <div className="min-h-8 break-all rounded-[0.55rem] bg-muted/30 px-2 py-1.5 text-xs text-foreground">
                    {buildAdvancedFilterExpression(advancedConditions, advancedLogic) || "选择条件后生成表达式"}
                  </div>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdvancedConditions((current) => [...current, createAdvancedFilterCondition()])}
                  >
                    添加条件
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={clearAdvancedFilter}>
                      清除高级筛选
                    </Button>
                    <Button type="button" size="sm" onClick={applyAdvancedFilter}>
                      应用高级筛选
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <SectionTitle icon={SlidersHorizontalIcon} title="更多" />
                <div className="grid grid-cols-2 gap-2">
                  {moreOptions.map((option) => {
                    const Icon = option.icon;
                    const checked = filterExists(filters, option.factor, "true");
                    return (
                      <label
                        key={option.factor}
                        className="flex h-9 cursor-pointer items-center gap-2 rounded-2xl border border-border/70 bg-background/72 px-3 text-sm"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleFilter({ factor: option.factor, value: "true" })} />
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="truncate">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

const SectionTitle = ({ icon: Icon, title }: { icon: typeof CalendarIcon; title: string }) => (
  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
    <Icon className="size-3.5" />
    <span>{title}</span>
  </div>
);

export default SearchBar;
