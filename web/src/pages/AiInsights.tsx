import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  FileIcon,
  HashIcon,
  LinkIcon,
  ListChecksIcon,
  PaperclipIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { getInsightStats } from "@/components/MemoDiscovery/discovery-utils";
import {
  AI_INSIGHTS_DEFAULT_SAMPLE_SIZE,
  AI_INSIGHTS_SAMPLE_SIZE_KEY,
  AI_INSIGHTS_SHOW_CONTENT_KEY,
  AI_INSIGHTS_SHOW_TAGS_KEY,
  DISCOVERY_ALL_PAGE_SIZE,
  DISCOVERY_SCOPE_ALL,
  type DiscoverySampleScope,
  getDiscoveryScopeLabel,
  normalizeDiscoverySampleScope,
} from "@/components/MemoDiscovery/settings";
import Skeleton from "@/components/Skeleton";
import { buildMemoCreatorFilter } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMemoDate = (memo: Memo) => (memo.createTime ? timestampDate(memo.createTime) : undefined);

const getDetailedInsightStats = (memos: Memo[]) => {
  const dayCounts = new Map<string, number>();
  let totalWords = 0;
  let longestMemoWords = 0;

  for (const memo of memos) {
    const date = getMemoDate(memo);
    if (date) {
      const key = formatDateKey(date);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
    const words = memo.content.trim().split(/\s+/).filter(Boolean).length;
    totalWords += words;
    longestMemoWords = Math.max(longestMemoWords, words);
  }

  const sortedDays = [...dayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const recentTrend = sortedDays.slice(-14).map(([date, count]) => ({ date: date.slice(5), count }));
  const maxTrendCount = Math.max(1, ...recentTrend.map((item) => item.count));
  const maxDayCount = Math.max(1, ...dayCounts.values());
  const busiestDay = sortedDays.reduce<{ date: string; count: number } | undefined>(
    (best, [date, count]) => (!best || count > best.count ? { date, count } : best),
    undefined,
  );
  const heatmapDays = Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));
    const key = formatDateKey(date);
    return { date: key.slice(5), count: dayCounts.get(key) ?? 0 };
  });

  return {
    totalWords,
    longestMemoWords,
    recentTrend,
    maxTrendCount,
    heatmapDays,
    maxDayCount,
    busiestDay,
  };
};

const AiInsights = () => {
  const currentUser = useCurrentUser();
  const [sampleSize] = useLocalStorage<DiscoverySampleScope>(AI_INSIGHTS_SAMPLE_SIZE_KEY, AI_INSIGHTS_DEFAULT_SAMPLE_SIZE);
  const [showTags] = useLocalStorage<boolean>(AI_INSIGHTS_SHOW_TAGS_KEY, true);
  const [showContent] = useLocalStorage<boolean>(AI_INSIGHTS_SHOW_CONTENT_KEY, true);
  const sampleScope = normalizeDiscoverySampleScope(sampleSize, AI_INSIGHTS_DEFAULT_SAMPLE_SIZE);
  const creatorFilter = currentUser ? buildMemoCreatorFilter(currentUser.name) : undefined;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos({
    state: State.NORMAL,
    orderBy: "create_time desc",
    pageSize: sampleScope === DISCOVERY_SCOPE_ALL ? DISCOVERY_ALL_PAGE_SIZE : sampleScope,
    filter: creatorFilter,
  });
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) ?? [], [data]);
  const stats = getInsightStats(memos);
  const detailedStats = useMemo(() => getDetailedInsightStats(memos), [memos]);

  useEffect(() => {
    if (sampleScope === DISCOVERY_SCOPE_ALL && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, sampleScope]);

  return (
    <div className="w-full min-h-full bg-transparent text-foreground">
      <div className="mx-auto flex w-full max-w-[58rem] flex-col">
        <div className="mb-3 overflow-hidden rounded-xl border border-border/60 bg-card/70 sm:mb-4 sm:rounded-2xl">
          <div className="relative p-4 sm:p-5">
            <div className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-primary/10 text-primary sm:size-12">
              <SparklesIcon className="size-5 sm:size-6" />
            </div>
            <div className="pr-14">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Memo Report</div>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">AI洞察统计报告</h1>
              <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                基于{getDiscoveryScopeLabel(sampleScope)} memos 自动整理，包含趋势、标签、内容构成和活跃度统计。
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton count={4} />
        ) : memos.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              <InsightCard icon={BarChart3Icon} label="近期 memo" value={memos.length} />
              <InsightCard icon={FileIcon} label="活跃天数" value={stats.activeDays} />
              <InsightCard icon={TrendingUpIcon} label="总字数" value={detailedStats.totalWords} />
              <InsightCard icon={PaperclipIcon} label="有附件" value={stats.withAttachment} />
              <InsightCard icon={LinkIcon} label="链接" value={stats.withLink} />
              <InsightCard icon={ListChecksIcon} label="清单" value={stats.withTask} />
              {showContent ? <InsightCard icon={FileIcon} label="平均字数" value={stats.avgWords} /> : null}
              {showContent ? <InsightCard icon={FileIcon} label="最长 memo" value={detailedStats.longestMemoWords} /> : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              <TrendPanel trend={detailedStats.recentTrend} maxCount={detailedStats.maxTrendCount} />
              <SummaryPanel memos={memos.length} activeDays={stats.activeDays} busiestDay={detailedStats.busiestDay} />
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <CompositionPanel
                total={memos.length}
                items={[
                  { label: "附件", value: stats.withAttachment, icon: PaperclipIcon },
                  { label: "链接", value: stats.withLink, icon: LinkIcon },
                  { label: "清单", value: stats.withTask, icon: ListChecksIcon },
                  { label: "代码", value: stats.withCode, icon: FileIcon },
                ]}
              />
              <ActivityPanel days={detailedStats.heatmapDays} maxCount={detailedStats.maxDayCount} />
            </div>

            {showTags ? <TopTagsPanel tags={stats.topTags} /> : null}
          </div>
        ) : (
          <div className="mt-12 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            记录更多 memo 后会显示洞察
          </div>
        )}
      </div>
    </div>
  );
};

const TopTagsPanel = ({ tags }: { tags: Array<{ tag: string; count: number }> }) => (
  <div className="rounded-xl border border-border/60 bg-card/58 p-3 sm:rounded-2xl sm:p-4">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold sm:mb-3">
      <HashIcon className="size-4 text-primary" />
      高频标签
    </div>
    {tags.length > 0 ? (
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {tags.map(({ tag, count }) => (
          <span
            key={tag}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            <HashIcon className="size-3 shrink-0 text-muted-foreground sm:size-3.5" />
            <span className="truncate">{tag}</span>
            <span className="shrink-0 text-muted-foreground">{count}</span>
          </span>
        ))}
      </div>
    ) : (
      <div className="text-sm text-muted-foreground">近期 memo 还没有标签。</div>
    )}
  </div>
);

const TrendPanel = ({ trend, maxCount }: { trend: Array<{ date: string; count: number }>; maxCount: number }) => (
  <ReportPanel icon={TrendingUpIcon} title="最近趋势" description="近 14 个活跃日期的 memo 数量变化">
    <div className="flex h-40 items-end gap-1.5 pt-4 sm:h-48 sm:gap-2">
      {trend.length > 0 ? (
        trend.map((item) => (
          <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end sm:h-34">
              <div
                className="w-full rounded-t-md bg-primary text-center text-[10px] font-medium text-primary-foreground shadow-sm"
                style={{ height: `${Math.max(12, (item.count / maxCount) * 100)}%` }}
              >
                {item.count}
              </div>
            </div>
            <span className="max-w-full truncate text-[10px] text-muted-foreground">{item.date}</span>
          </div>
        ))
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">暂无趋势数据</div>
      )}
    </div>
  </ReportPanel>
);

const SummaryPanel = ({
  memos,
  activeDays,
  busiestDay,
}: {
  memos: number;
  activeDays: number;
  busiestDay?: { date: string; count: number };
}) => (
  <ReportPanel icon={SparklesIcon} title="文字总结" description="从记录频率和内容形态生成的简要观察">
    <div className="space-y-3 text-sm leading-6 text-foreground/86">
      <p>
        这段时间共记录 <span className="font-semibold text-primary">{memos}</span> 条 memo，覆盖{" "}
        <span className="font-semibold text-primary">{activeDays}</span> 个活跃日期。
      </p>
      <p>{busiestDay ? `最活跃的一天是 ${busiestDay.date}，当天记录了 ${busiestDay.count} 条。` : "暂时还没有形成明显的高峰日期。"}</p>
      <p className="rounded-xl bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
        默认展示完整统计报告；可以在左侧 AI 洞察设置中调整分析范围。
      </p>
    </div>
  </ReportPanel>
);

const CompositionPanel = ({
  total,
  items,
}: {
  total: number;
  items: Array<{ label: string; value: number; icon: typeof BarChart3Icon }>;
}) => (
  <ReportPanel icon={BarChart3Icon} title="内容构成" description="不同类型 memo 在整体中的占比">
    <div className="space-y-3">
      {items.map(({ label, value, icon: Icon }) => {
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-foreground">
                <Icon className="size-4 text-primary" />
                {label}
              </span>
              <span className="text-muted-foreground">
                {value} · {percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  </ReportPanel>
);

const ActivityPanel = ({ days, maxCount }: { days: Array<{ date: string; count: number }>; maxCount: number }) => (
  <ReportPanel icon={CalendarDaysIcon} title="活跃热力" description="最近 28 天记录分布">
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const ratio = day.count / maxCount;
        const opacity = day.count === 0 ? "bg-muted/25" : ratio > 0.75 ? "bg-primary" : ratio > 0.45 ? "bg-primary/78" : "bg-primary/55";
        return (
          <div
            key={day.date}
            className={`grid aspect-square place-items-center rounded-md text-[10px] ${day.count > 0 ? `${opacity} text-primary-foreground` : `${opacity} text-muted-foreground`}`}
            title={`${day.date}: ${day.count}`}
          >
            {day.count > 0 ? day.count : ""}
          </div>
        );
      })}
    </div>
  </ReportPanel>
);

const InsightCard = ({ icon: Icon, label, value }: { icon: typeof BarChart3Icon; label: string; value: number }) => (
  <div className="rounded-xl border border-border/60 bg-card/58 p-2.5 sm:rounded-2xl sm:p-4">
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      <div>
        <div className="truncate text-xs text-muted-foreground sm:text-sm">{label}</div>
        <div className="mt-0.5 text-xl font-semibold text-foreground sm:mt-1 sm:text-2xl">{value}</div>
      </div>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:size-9">
        <Icon className="size-3.5 sm:size-4" />
      </span>
    </div>
  </div>
);

const ReportPanel = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof BarChart3Icon;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-xl border border-border/60 bg-card/58 p-3 sm:rounded-2xl sm:p-4">
    <div className="mb-3 flex items-start gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

export default AiInsights;
