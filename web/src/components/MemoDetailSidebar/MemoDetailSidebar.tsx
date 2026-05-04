import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { CheckCircleIcon, ChevronRightIcon, Code2Icon, HashIcon, ImageIcon, LinkIcon, type LucideIcon, Share2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Memo, Memo_PropertySchema } from "@/types/proto/api/v1/memo_service_pb";
import { type Translations, useTranslate } from "@/utils/i18n";
import { extractHeadings } from "@/utils/markdown-manipulation";
import { isSuperUser } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  className?: string;
  onShareImageOpen?: () => void;
}

interface PropertyBadge {
  icon: LucideIcon;
  labelKey: Translations;
}

const SidebarSection = ({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) => (
  <div className="w-full space-y-2 rounded-[1.4rem] border border-border/55 bg-[var(--memo-surface)] p-4 shadow-xs">
    <div className="flex items-center gap-1.5">
      <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">{label}</p>
      {count != null && <span className="text-xs text-muted-foreground/30">({count})</span>}
    </div>
    {children}
  </div>
);

const PROPERTY_BADGE_CLASSES =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/55 bg-background/72 text-xs text-muted-foreground";

const TAG_BADGE_CLASSES =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/55 bg-background/72 text-sm text-muted-foreground hover:bg-accent/55 hover:text-foreground/80 transition-colors cursor-pointer";

const SHARE_ACTION_ROW_CLASSES =
  "h-auto min-h-0 w-full justify-between rounded-xl px-3 py-2 text-xs font-normal leading-tight text-muted-foreground transition-colors hover:bg-accent/45 hover:text-muted-foreground focus-visible:ring-offset-0 gap-1.5";

const MemoDetailSidebar = ({ memo, className, onShareImageOpen }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const property = create(Memo_PropertySchema, memo.property || {});
  const canManageShares = !memo.parent && (memo.creator === currentUser?.name || isSuperUser(currentUser));
  const hasUpdated = !isEqual(memo.createTime, memo.updateTime);
  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);

  const propertyBadges = useMemo(() => {
    const badges: PropertyBadge[] = [];
    if (property.hasLink) badges.push({ icon: LinkIcon, labelKey: "memo.links" });
    if (property.hasTaskList) badges.push({ icon: CheckCircleIcon, labelKey: "memo.to-do" });
    if (property.hasCode) badges.push({ icon: Code2Icon, labelKey: "memo.code" });
    return badges;
  }, [property.hasLink, property.hasTaskList, property.hasCode]);

  return (
    <aside className={cn("relative w-full h-auto max-h-screen overflow-auto flex flex-col gap-4", className)}>
      {headings.length > 0 && (
        <SidebarSection label={t("memo.outline")}>
          <MemoOutline headings={headings} />
        </SidebarSection>
      )}

      {(canManageShares || onShareImageOpen) && (
        <SidebarSection label={t("memo.share.section-label")}>
          <div className="overflow-hidden rounded-[1rem] border border-border/50 bg-background/40 p-1">
            {onShareImageOpen && (
              <Button variant="ghost" size="sm" className={SHARE_ACTION_ROW_CLASSES} onClick={onShareImageOpen}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ImageIcon className="size-3.5 shrink-0 text-muted-foreground/90" />
                  <span className="truncate">{t("memo.share.open-image")}</span>
                </span>
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/35" />
              </Button>
            )}
            {onShareImageOpen && canManageShares && <div className="my-1 border-t border-border/50" />}
            {canManageShares && (
              <Button variant="ghost" size="sm" className={SHARE_ACTION_ROW_CLASSES} onClick={() => setSharePanelOpen(true)}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Share2Icon className="size-3.5 shrink-0 text-muted-foreground/90" />
                  <span className="truncate">{t("memo.share.open-panel")}</span>
                </span>
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/35" />
              </Button>
            )}
          </div>
        </SidebarSection>
      )}

      <SidebarSection label={t("common.created-at")}>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-foreground/70">{memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "—"}</p>
          {hasUpdated && (
            <p className="text-xs text-muted-foreground">
              {t("common.last-updated-at")}: {memo.updateTime ? timestampDate(memo.updateTime).toLocaleString() : "—"}
            </p>
          )}
        </div>
      </SidebarSection>

      {propertyBadges.length > 0 && (
        <SidebarSection label={t("common.properties")}>
          <div className="flex flex-wrap gap-1.5">
            {propertyBadges.map(({ icon: Icon, labelKey }) => (
              <span key={labelKey} className={PROPERTY_BADGE_CLASSES}>
                <Icon className="w-3.5 h-3.5" />
                {t(labelKey)}
              </span>
            ))}
          </div>
        </SidebarSection>
      )}

      {memo.tags.length > 0 && (
        <SidebarSection label={t("common.tags")} count={memo.tags.length}>
          <div className="flex flex-wrap gap-1.5">
            {memo.tags.map((tag) => (
              <span key={tag} className={TAG_BADGE_CLASSES}>
                <HashIcon className="w-3 h-3 opacity-50" />
                {tag}
              </span>
            ))}
          </div>
        </SidebarSection>
      )}

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </aside>
  );
};

export default MemoDetailSidebar;
