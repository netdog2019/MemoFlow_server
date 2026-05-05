import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { extractMentionUsernames } from "@/utils/remark-plugins/remark-mention";
import { COMPACT_MODE_CONFIG } from "./constants";
import { useCompactLabel, useCompactMode } from "./hooks";
import MemoMarkdownRenderer from "./MemoMarkdownRenderer";
import { useResolvedMentionUsernames } from "./MentionResolutionContext";
import type { MemoContentProps } from "./types";

const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content, onClick, onDoubleClick, expanded, onExpandedChange } = props;
  const t = useTranslate();
  const {
    containerRef: memoContentContainerRef,
    mode: showCompactMode,
    toggle: toggleCompactMode,
  } = useCompactMode(Boolean(props.compact), expanded);
  const mentionUsernames = useMemo(() => extractMentionUsernames(content), [content]);
  const resolvedMentionUsernames = useResolvedMentionUsernames(mentionUsernames);

  const compactLabel = useCompactLabel(showCompactMode, t as (key: string) => string);
  const handleToggle = () => {
    if (onExpandedChange) {
      onExpandedChange(!expanded);
      return;
    }
    toggleCompactMode();
  };

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        data-memo-content
        className={cn(
          "relative w-full max-w-full wrap-break-word text-[15px] leading-7 transition-[max-height] duration-300 ease-out",
          "[&>*:first-child]:mt-[-0.18rem]",
          "[&>*:last-child]:mb-0",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          showCompactMode === "ALL" && "overflow-hidden",
          contentClassName,
        )}
        style={showCompactMode === "ALL" ? { maxHeight: `${COMPACT_MODE_CONFIG.maxHeightPx}px` } : undefined}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <MemoMarkdownRenderer content={content} resolvedMentionUsernames={resolvedMentionUsernames} />
      </div>
      {showCompactMode !== undefined && (
        <div className="relative w-full mt-2">
          <button
            type="button"
            className="inline-flex p-0 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            onClick={handleToggle}
          >
            <span>{onExpandedChange ? (expanded ? "折叠" : "展开") : compactLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(MemoContent);
