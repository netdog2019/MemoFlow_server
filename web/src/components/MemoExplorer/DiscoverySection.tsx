import { DicesIcon, EllipsisIcon, SparklesIcon } from "lucide-react";
import { NavLink, useMatch } from "react-router-dom";
import useLocalStorage from "react-use/lib/useLocalStorage";
import {
  AI_INSIGHTS_DEFAULT_SAMPLE_SIZE,
  AI_INSIGHTS_SAMPLE_SIZE_KEY,
  AI_INSIGHTS_SHOW_CONTENT_KEY,
  AI_INSIGHTS_SHOW_TAGS_KEY,
  DISCOVERY_SCOPE_ALL,
  type DiscoverySampleScope,
  normalizeDiscoverySampleScope,
  RANDOM_MEMOS_COUNT_KEY,
  RANDOM_MEMOS_DEFAULT_COUNT,
  RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE,
  RANDOM_MEMOS_SAMPLE_SIZE_KEY,
  randomMemoCountOptions,
  sampleSizeOptions,
} from "@/components/MemoDiscovery/settings";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const DiscoverySection = () => {
  const [randomCount, setRandomCount] = useLocalStorage<number>(RANDOM_MEMOS_COUNT_KEY, RANDOM_MEMOS_DEFAULT_COUNT);
  const [randomSampleSize, setRandomSampleSize] = useLocalStorage<DiscoverySampleScope>(
    RANDOM_MEMOS_SAMPLE_SIZE_KEY,
    RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE,
  );
  const [insightSampleSize, setInsightSampleSize] = useLocalStorage<DiscoverySampleScope>(
    AI_INSIGHTS_SAMPLE_SIZE_KEY,
    AI_INSIGHTS_DEFAULT_SAMPLE_SIZE,
  );
  const [showInsightTags, setShowInsightTags] = useLocalStorage<boolean>(AI_INSIGHTS_SHOW_TAGS_KEY, true);
  const [showInsightContent, setShowInsightContent] = useLocalStorage<boolean>(AI_INSIGHTS_SHOW_CONTENT_KEY, true);
  const { setShortcut } = useMemoFilterContext();
  const randomScope = normalizeDiscoverySampleScope(randomSampleSize, RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE);
  const insightScope = normalizeDiscoverySampleScope(insightSampleSize, AI_INSIGHTS_DEFAULT_SAMPLE_SIZE);

  return (
    <div className="w-full flex flex-col justify-start items-start mt-3 px-1 pt-3 h-auto shrink-0 flex-nowrap border-t border-border/35 first:border-t-0 first:pt-0">
      <div className="w-full flex flex-col justify-start items-center relative gap-y-1">
        <DiscoveryRow to="/random" label="随机漫游" icon={DicesIcon} onNavigate={() => setShortcut(undefined)}>
          <DropdownMenuLabel>随机漫游设置</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">每次显示</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(randomCount ?? RANDOM_MEMOS_DEFAULT_COUNT)}
            onValueChange={(value) => setRandomCount(Number(value))}
          >
            {randomMemoCountOptions.map((count) => (
              <DropdownMenuRadioItem key={count} value={String(count)}>
                {count} 条
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">抽样范围</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(randomScope)}
            onValueChange={(value) => setRandomSampleSize(value === DISCOVERY_SCOPE_ALL ? DISCOVERY_SCOPE_ALL : Number(value))}
          >
            <DropdownMenuRadioItem value={DISCOVERY_SCOPE_ALL}>全部</DropdownMenuRadioItem>
            {sampleSizeOptions.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)}>
                最近 {size} 条
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DiscoveryRow>

        <DiscoveryRow to="/insights" label="AI洞察" icon={SparklesIcon} onNavigate={() => setShortcut(undefined)}>
          <DropdownMenuLabel>AI洞察设置</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">分析范围</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(insightScope)}
            onValueChange={(value) => setInsightSampleSize(value === DISCOVERY_SCOPE_ALL ? DISCOVERY_SCOPE_ALL : Number(value))}
          >
            <DropdownMenuRadioItem value={DISCOVERY_SCOPE_ALL}>全部</DropdownMenuRadioItem>
            {sampleSizeOptions.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)}>
                最近 {size} 条
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showInsightTags ?? true} onCheckedChange={(checked) => setShowInsightTags(Boolean(checked))}>
            高频标签
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={showInsightContent ?? true}
            onCheckedChange={(checked) => setShowInsightContent(Boolean(checked))}
          >
            内容统计
          </DropdownMenuCheckboxItem>
        </DiscoveryRow>
      </div>
    </div>
  );
};

const DiscoveryRow = ({
  to,
  label,
  icon: Icon,
  onNavigate,
  children,
}: {
  to: string;
  label: string;
  icon: typeof DicesIcon;
  onNavigate?: () => void;
  children: React.ReactNode;
}) => {
  const isActive = Boolean(useMatch({ path: to, end: true }));

  return (
    <div
      className={cn(
        "shrink-0 w-full text-sm rounded-[0.35rem] leading-6 flex flex-row justify-between items-center select-none gap-2 transition-colors",
        isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground",
      )}
    >
      <NavLink
        to={isActive ? Routes.HOME : to}
        onClick={onNavigate}
        className={cn(
          "min-w-0 flex-1 inline-flex items-center gap-2 rounded-[0.3rem] px-1.5 py-0.5 transition-colors",
          isActive ? "text-primary-foreground" : "hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </NavLink>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-[0.3rem]",
              isActive ? "text-primary-foreground hover:bg-white/12" : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
            )}
            aria-label={`${label}设置`}
          >
            <EllipsisIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" alignOffset={-12} className="w-44">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default DiscoverySection;
