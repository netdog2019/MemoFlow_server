import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export const randomSeed = () => Math.random().toString(36).slice(2);

export const shuffleMemos = (memos: Memo[], seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const nextRandom = () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return (hash >>> 0) / 4294967296;
  };

  return [...memos].sort(() => nextRandom() - 0.5);
};

export const getTopTags = (memos: Memo[]) => {
  const tagCounts = new Map<string, number>();
  memos.forEach((memo) => memo.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)));

  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
};

export const getInsightStats = (memos: Memo[]) => {
  const withLink = memos.filter((memo) => memo.property?.hasLink).length;
  const withTask = memos.filter((memo) => memo.property?.hasTaskList).length;
  const withCode = memos.filter((memo) => memo.property?.hasCode).length;
  const withAttachment = memos.filter((memo) => memo.attachments.length > 0).length;
  const topTags = getTopTags(memos);
  const activeDays = new Set(memos.flatMap((memo) => (memo.createTime ? [timestampDate(memo.createTime).toDateString()] : []))).size;
  const totalWords = memos.reduce((sum, memo) => sum + memo.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const avgWords = memos.length > 0 ? Math.round(totalWords / memos.length) : 0;

  return { withLink, withTask, withCode, withAttachment, topTags, activeDays, avgWords };
};
