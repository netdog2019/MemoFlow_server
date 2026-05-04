import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { buildMemoCreatorFilter } from "@/helpers/resource-names";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const getVisibilityName = (visibility: Visibility): string => {
  switch (visibility) {
    case Visibility.PUBLIC:
      return "PUBLIC";
    case Visibility.PROTECTED:
      return "PROTECTED";
    case Visibility.PRIVATE:
      return "PRIVATE";
    default:
      return "PRIVATE";
  }
};

const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

const escapeFilterValue = (value: string): string => JSON.stringify(value);

const buildTagSearchCondition = (tags: string[], operator: string): string | undefined => {
  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  if (normalizedTags.length === 0) {
    return undefined;
  }

  const conditions = normalizedTags.map((tag) => `tag in [${escapeFilterValue(tag)}]`);
  return conditions.length === 1 ? conditions[0] : `(${conditions.join(operator === "or" ? " || " : " && ")})`;
};

const getLocalDateTimestamp = (value: string, offsetDays = 0): number | undefined => {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  return Math.floor(new Date(year, month - 1, day + offsetDays).getTime() / 1000);
};

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeShortcuts?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeShortcuts = false, includePinned = false, visibilities } = options;

  const { shortcuts } = useAuth();
  const { filters, shortcut: currentShortcut } = useMemoFilterContext();

  // Get selected shortcut if needed
  const selectedShortcut = useMemo(() => {
    if (!includeShortcuts) return undefined;
    return shortcuts.find((shortcut) => getShortcutId(shortcut.name) === currentShortcut);
  }, [includeShortcuts, currentShortcut, shortcuts]);

  // Build filter
  return useMemo(() => {
    const conditions: string[] = [];

    // Add creator filter if provided
    if (creatorName) {
      const creatorFilter = buildMemoCreatorFilter(creatorName);
      if (creatorFilter) {
        conditions.push(creatorFilter);
      }
    }

    // Add shortcut filter if enabled and selected
    if (includeShortcuts && selectedShortcut?.filter) {
      conditions.push(selectedShortcut.filter);
    }

    const tagSearchValues: string[] = [];
    const tagSearchOperator = filters.find((filter) => filter.factor === "tagSearchOperator")?.value === "or" ? "or" : "and";

    // Add active filters from context
    for (const filter of filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains(${escapeFilterValue(filter.value)})`);
      } else if (filter.factor === "tagSearch") {
        tagSearchValues.push(filter.value);
      } else if (filter.factor === "tagExclude") {
        conditions.push(`!tags.exists(t, t.startsWith(${escapeFilterValue(filter.value)}))`);
      } else if (filter.factor === "pinned") {
        if (includePinned) {
          conditions.push(`pinned`);
        }
      } else if (filter.factor === "property.hasLink") {
        conditions.push(`has_link`);
      } else if (filter.factor === "property.hasTaskList") {
        conditions.push(`has_task_list`);
      } else if (filter.factor === "property.hasCode") {
        conditions.push(`has_code`);
      } else if (filter.factor === "property.hasIncompleteTasks") {
        conditions.push(`has_incomplete_tasks`);
      } else if (filter.factor === "property.hasAttachment") {
        conditions.push(`has_attachment`);
      } else if (filter.factor === "property.hasImage") {
        conditions.push(`has_image`);
      } else if (filter.factor === "property.hasAudio") {
        conditions.push(`has_audio`);
      } else if (filter.factor === "property.hasVideo") {
        conditions.push(`has_video`);
      } else if (filter.factor === "property.noTag") {
        conditions.push(`size(tags) == 0`);
      } else if (filter.factor === "startDate") {
        const timestamp = getLocalDateTimestamp(filter.value);
        if (timestamp !== undefined) {
          conditions.push(`created_ts >= ${timestamp}`);
        }
      } else if (filter.factor === "endDate") {
        const timestamp = getLocalDateTimestamp(filter.value, 1);
        if (timestamp !== undefined) {
          conditions.push(`created_ts < ${timestamp}`);
        }
      } else if (filter.factor === "displayTime") {
        const timestampAfter = getLocalDateTimestamp(filter.value);
        if (timestampAfter !== undefined) {
          conditions.push(`created_ts >= ${timestampAfter} && created_ts < ${timestampAfter + 60 * 60 * 24}`);
        }
      } else if (filter.factor === "advancedFilter" && filter.value.trim()) {
        conditions.push(`(${filter.value.trim()})`);
      }
    }

    const tagSearchCondition = buildTagSearchCondition(tagSearchValues, tagSearchOperator);
    if (tagSearchCondition) {
      conditions.push(tagSearchCondition);
    }

    // Add visibility filter if specified
    if (visibilities && visibilities.length > 0) {
      const visibilityValues = visibilities.map((v) => `"${getVisibilityName(v)}"`).join(", ");
      conditions.push(`visibility in [${visibilityValues}]`);
    }

    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [creatorName, includeShortcuts, includePinned, visibilities, selectedShortcut, filters]);
};
