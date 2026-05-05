import { RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import { randomSeed, shuffleMemos } from "@/components/MemoDiscovery/discovery-utils";
import {
  DISCOVERY_ALL_PAGE_SIZE,
  DISCOVERY_SCOPE_ALL,
  type DiscoverySampleScope,
  getDiscoveryScopeLabel,
  normalizeDiscoverySampleScope,
  RANDOM_MEMOS_COUNT_KEY,
  RANDOM_MEMOS_DEFAULT_COUNT,
  RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE,
  RANDOM_MEMOS_SAMPLE_SIZE_KEY,
} from "@/components/MemoDiscovery/settings";
import MemoView from "@/components/MemoView";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { buildMemoCreatorFilter } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const RandomMemos = () => {
  const currentUser = useCurrentUser();
  const [randomCount] = useLocalStorage<number>(RANDOM_MEMOS_COUNT_KEY, RANDOM_MEMOS_DEFAULT_COUNT);
  const [sampleSize] = useLocalStorage<DiscoverySampleScope>(RANDOM_MEMOS_SAMPLE_SIZE_KEY, RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE);
  const sampleScope = normalizeDiscoverySampleScope(sampleSize, RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE);
  const creatorFilter = currentUser ? buildMemoCreatorFilter(currentUser.name) : undefined;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos({
    state: State.NORMAL,
    orderBy: "create_time desc",
    pageSize: sampleScope === DISCOVERY_SCOPE_ALL ? DISCOVERY_ALL_PAGE_SIZE : sampleScope,
    filter: creatorFilter,
  });
  const [seed, setSeed] = useState(randomSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) ?? [], [data]);
  const displayCount = randomCount ?? RANDOM_MEMOS_DEFAULT_COUNT;
  const randomMemos = useMemo(() => shuffleMemos(memos, seed).slice(0, displayCount), [displayCount, memos, seed]);

  useEffect(() => {
    if (sampleScope === DISCOVERY_SCOPE_ALL && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, sampleScope]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setSeed(randomSeed());
    window.setTimeout(() => setIsRefreshing(false), 420);
  };

  return (
    <div className="w-full min-h-full bg-transparent text-foreground">
      <div className="mx-auto flex w-full max-w-[44rem] flex-col">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/58 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold">随机漫游</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              从{getDiscoveryScopeLabel(sampleScope)} memos 中随机出现 {displayCount} 条，可以继续刷新。
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing} className={isRefreshing ? "scale-[0.98]" : undefined}>
            <RefreshCwIcon className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
            刷新
          </Button>
        </div>

        {isLoading ? (
          <Skeleton count={3} />
        ) : randomMemos.length > 0 ? (
          <MentionResolutionProvider contents={randomMemos.map((memo) => memo.content)}>
            <div className="flex flex-col gap-3">
              {randomMemos.map((memo: Memo) => (
                <MemoView key={`${memo.name}-${seed}`} memo={memo} showVisibility showPinned compact parentPage="/random" />
              ))}
            </div>
          </MentionResolutionProvider>
        ) : (
          <div className="mt-12 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            还没有可漫游的 memo
          </div>
        )}
      </div>
    </div>
  );
};

export default RandomMemos;
