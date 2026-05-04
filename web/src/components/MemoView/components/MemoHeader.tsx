import { BookmarkIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import MemoActionMenu from "../../MemoActionMenu";
import { ReactionSelector } from "../../MemoReactionListView";
import UserAvatar from "../../UserAvatar";
import VisibilityIcon from "../../VisibilityIcon";
import { useMemoActions } from "../hooks";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import type { MemoHeaderProps } from "../types";

const MemoHeader: React.FC<MemoHeaderProps> = ({ showCreator, showVisibility, showPinned }) => {
  const t = useTranslate();
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);

  const { memo, creator, currentUser, parentPage, isArchived, readonly, openEditor } = useMemoViewContext();
  const { displayTime: memoDisplayTime } = useMemoViewDerived();

  const navigateTo = useNavigateTo();
  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memo.name}`, { state: { from: parentPage } });
  }, [memo.name, parentPage, navigateTo]);

  const { unpinMemo } = useMemoActions(memo);

  const displayTime = memoDisplayTime
    ? `${memoDisplayTime.getFullYear()}-${String(memoDisplayTime.getMonth() + 1).padStart(2, "0")}-${String(memoDisplayTime.getDate()).padStart(2, "0")} ${String(
        memoDisplayTime.getHours(),
      ).padStart(2, "0")}:${String(memoDisplayTime.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <div className="w-full flex flex-row justify-between items-start gap-2">
      <div className="w-auto max-w-[calc(100%-7rem)] grow flex flex-row justify-start items-center">
        {showCreator && creator ? (
          <CreatorDisplay creator={creator} displayTime={displayTime} onGotoDetail={handleGotoMemoDetailPage} />
        ) : (
          <TimeDisplay displayTime={displayTime} onGotoDetail={handleGotoMemoDetailPage} />
        )}
      </div>

      <div className="flex flex-row justify-end items-center select-none shrink-0 gap-1">
        {currentUser && !isArchived && (
          <ReactionSelector
            className={cn("border-none w-auto h-auto", reactionSelectorOpen && "block!", "block sm:hidden sm:group-hover:block")}
            memo={memo}
            onOpenChange={setReactionSelectorOpen}
          />
        )}

        {showVisibility && memo.visibility !== Visibility.PRIVATE && (
          <Tooltip>
            <TooltipTrigger>
              <span className="flex justify-center items-center rounded-md hover:opacity-80">
                <VisibilityIcon visibility={memo.visibility} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as Parameters<typeof t>[0])}
            </TooltipContent>
          </Tooltip>
        )}

        {showPinned && memo.pinned && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer">
                  <BookmarkIcon className="w-4 h-auto text-primary" onClick={unpinMemo} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("common.unpin")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <MemoActionMenu memo={memo} readonly={readonly} onEdit={openEditor} />
      </div>
    </div>
  );
};

interface CreatorDisplayProps {
  creator: User;
  displayTime: React.ReactNode;
  onGotoDetail: () => void;
}

const CreatorDisplay: React.FC<CreatorDisplayProps> = ({ creator, displayTime, onGotoDetail }) => (
  <div className="w-full flex flex-row justify-start items-center">
    <Link className="w-auto hover:opacity-80 rounded-md transition-colors" to={`/u/${encodeURIComponent(creator.username)}`} viewTransition>
      <UserAvatar className="mr-2 shrink-0" avatarUrl={creator.avatarUrl} />
    </Link>
    <div className="w-full flex flex-col justify-center items-start gap-0">
      <Link
        className="block leading-tight hover:opacity-80 rounded-md transition-colors truncate text-[12px] font-medium text-foreground/72"
        to={`/u/${encodeURIComponent(creator.username)}`}
        viewTransition
      >
        {creator.displayName || creator.username}
      </Link>
      <button
        type="button"
        className="w-auto text-[11px] leading-tight text-muted-foreground select-none cursor-pointer hover:text-foreground/72 transition-colors text-left"
        onClick={onGotoDetail}
      >
        {displayTime}
      </button>
    </div>
  </div>
);

interface TimeDisplayProps {
  displayTime: React.ReactNode;
  onGotoDetail: () => void;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ displayTime, onGotoDetail }) => (
  <button
    type="button"
    className="w-full text-[12px] leading-tight text-muted-foreground select-none cursor-pointer hover:text-foreground/72 transition-colors text-left"
    onClick={onGotoDetail}
  >
    {displayTime}
  </button>
);

export default MemoHeader;
