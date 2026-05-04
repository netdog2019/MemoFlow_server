import { useMemo, useState } from "react";
import { AttachmentListView, RelationListView } from "@/components/MemoMetadata";
import { cn } from "@/lib/utils";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoHandlers } from "../hooks";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";

const BlurOverlay: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 z-10 pt-4 flex items-center justify-center" onClick={onClick}>
      <button
        type="button"
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
      >
        {t("memo.click-to-show-sensitive-content")}
      </button>
    </div>
  );
};

const MemoBody: React.FC<MemoBodyProps> = ({ compact }) => {
  const { memo, parentPage, showBlurredContent, blurred, readonly, openEditor, openPreview, toggleBlurVisibility } = useMemoViewContext();
  const [expanded, setExpanded] = useState(false);

  const { handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({ readonly, openEditor, openPreview });

  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const contentIsExpandable = useMemo(() => memo.content.length > 220 || memo.content.split("\n").length > 6, [memo.content]);
  const isCollapsible = Boolean(compact) && !memo.pinned && contentIsExpandable;

  const handleCardToggle = (event: React.MouseEvent) => {
    if (!isCollapsible || event.defaultPrevented || event.detail > 1) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, label, video, audio, img")) {
      return;
    }

    if (window.getSelection()?.toString().trim()) {
      return;
    }

    setExpanded((prev) => !prev);
  };

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-2.5",
          blurred && !showBlurredContent && "blur-lg transition-all duration-200",
          isCollapsible && "cursor-pointer",
        )}
        onClick={handleCardToggle}
      >
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          content={memo.content}
          onClick={handleMemoContentClick}
          onDoubleClick={handleMemoContentDoubleClick}
          compact={memo.pinned ? false : compact} // Always show full content when pinned
          expanded={expanded}
          onExpandedChange={isCollapsible ? setExpanded : undefined}
        />
        <AttachmentListView attachments={memo.attachments} location={memo.location} onImagePreview={openPreview} expanded={expanded} />
        <RelationListView relations={referencedMemos} currentMemoName={memo.name} parentPage={parentPage} />
        <MemoReactionListView memo={memo} reactions={memo.reactions} />
      </div>

      {blurred && !showBlurredContent && <BlurOverlay onClick={toggleBlurVisibility} />}
    </>
  );
};

export default MemoBody;
