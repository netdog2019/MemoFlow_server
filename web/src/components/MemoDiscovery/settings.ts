export const RANDOM_MEMOS_COUNT_KEY = "memo-discovery-random-count";
export const RANDOM_MEMOS_SAMPLE_SIZE_KEY = "memo-discovery-random-sample-scope";
export const AI_INSIGHTS_SAMPLE_SIZE_KEY = "memo-discovery-insights-sample-scope";
export const AI_INSIGHTS_SHOW_TAGS_KEY = "memo-discovery-insights-show-tags";
export const AI_INSIGHTS_SHOW_CONTENT_KEY = "memo-discovery-insights-show-content";

export const DISCOVERY_SCOPE_ALL = "all";
export type DiscoverySampleScope = typeof DISCOVERY_SCOPE_ALL | number;

export const RANDOM_MEMOS_DEFAULT_COUNT = 3;
export const RANDOM_MEMOS_DEFAULT_SAMPLE_SIZE: DiscoverySampleScope = DISCOVERY_SCOPE_ALL;
export const AI_INSIGHTS_DEFAULT_SAMPLE_SIZE: DiscoverySampleScope = DISCOVERY_SCOPE_ALL;
export const DISCOVERY_ALL_PAGE_SIZE = 1000;

export const randomMemoCountOptions = [3, 5, 10] as const;
export const sampleSizeOptions = [100, 300, 500] as const;

export const normalizeDiscoverySampleScope = (
  value: unknown,
  fallback: DiscoverySampleScope = DISCOVERY_SCOPE_ALL,
): DiscoverySampleScope => {
  if (value === DISCOVERY_SCOPE_ALL) {
    return DISCOVERY_SCOPE_ALL;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
};

export const getDiscoveryScopeLabel = (scope: DiscoverySampleScope) => (scope === DISCOVERY_SCOPE_ALL ? "全部" : `最近 ${scope} 条`);
