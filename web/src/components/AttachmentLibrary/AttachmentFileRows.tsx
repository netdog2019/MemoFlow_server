import { FileAudioIcon, FileIcon, PlayIcon } from "lucide-react";
import AudioAttachmentItem from "@/components/MemoMetadata/Attachment/AudioAttachmentItem";
import DocumentThumbnail from "@/components/MemoMetadata/Attachment/DocumentThumbnail";
import type { AttachmentLibraryListItem } from "@/hooks/useAttachmentLibrary";
import { cn } from "@/lib/utils";
import { getAttachmentThumbnailUrl, getAttachmentType, isMotionAttachment } from "@/utils/attachment";
import { getDocumentPreviewMode } from "@/utils/document-preview";
import { AttachmentMetadataLine, AttachmentOpenButton, AttachmentSourceChip } from "./AttachmentLibraryPrimitives";

const AttachmentThumb = ({ item, className }: { item: AttachmentLibraryListItem; className?: string }) => {
  const type = getAttachmentType(item.attachment);
  const isMotion = isMotionAttachment(item.attachment);

  if (type === "image/*" || isMotion) {
    return (
      <div className={cn("overflow-hidden rounded-xl bg-muted/35", className)}>
        <img
          src={getAttachmentThumbnailUrl(item.attachment)}
          alt={item.attachment.filename}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (type === "video/*") {
    return (
      <div className={cn("relative overflow-hidden rounded-xl bg-muted/35", className)}>
        <video src={item.sourceUrl} className="h-full w-full object-cover" preload="metadata" />
        <span className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm">
          <PlayIcon className="h-3.5 w-3.5 fill-current" />
        </span>
      </div>
    );
  }

  if (getDocumentPreviewMode({ mimeType: item.attachment.type, filename: item.attachment.filename }) !== "fallback") {
    return (
      <DocumentThumbnail
        sourceUrl={item.sourceUrl}
        filename={item.attachment.filename}
        mimeType={item.attachment.type}
        className={cn("bg-transparent", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center justify-center rounded-xl bg-muted/45 text-muted-foreground", className)}>
      {type === "audio/*" ? <FileAudioIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
    </div>
  );
};

export const AttachmentDocumentRows = ({
  items,
  onOpenDocument,
}: {
  items: AttachmentLibraryListItem[];
  onOpenDocument?: (item: AttachmentLibraryListItem) => void;
}) => {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.attachment.name}
          className="flex items-center gap-2.5 rounded-[18px] border border-border/60 bg-background/90 p-3 shadow-sm shadow-black/[0.02] transition-colors hover:bg-muted/25"
        >
          <button type="button" className="shrink-0 cursor-pointer" onClick={() => onOpenDocument?.(item)} title={item.attachment.filename}>
            <AttachmentThumb item={item} className="h-10 w-10" />
          </button>

          <div className="min-w-0 flex-1">
            <button type="button" className="block min-w-0 max-w-full cursor-pointer text-left" onClick={() => onOpenDocument?.(item)}>
              <div className="truncate text-sm font-medium text-foreground" title={item.attachment.filename}>
                {item.attachment.filename}
              </div>
              <AttachmentMetadataLine
                className="mt-0.5 min-w-0 max-w-full"
                items={[item.fileTypeLabel, item.fileSizeLabel, item.createdLabel]}
              />
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <AttachmentSourceChip memoName={item.memoName} />
            </div>
          </div>

          <AttachmentOpenButton href={item.sourceUrl} onClick={() => onOpenDocument?.(item)} />
        </article>
      ))}
    </div>
  );
};

export const AttachmentAudioRows = ({ items }: { items: AttachmentLibraryListItem[] }) => {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <article
          key={item.attachment.name}
          className="rounded-[18px] border border-border/60 bg-background/90 p-2.5 shadow-sm shadow-black/[0.02]"
        >
          <AudioAttachmentItem
            filename={item.attachment.filename}
            sourceUrl={item.sourceUrl}
            mimeType={item.attachment.type}
            size={Number(item.attachment.size)}
          />
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 px-0.5 pt-2.5">
            <div className="min-w-0 flex flex-wrap items-center gap-1.5">
              <AttachmentMetadataLine className="min-w-0 max-w-full" items={[item.createdLabel]} />
              <AttachmentSourceChip memoName={item.memoName} />
            </div>
            <AttachmentOpenButton href={item.sourceUrl} />
          </div>
        </article>
      ))}
    </div>
  );
};

export const AttachmentUnusedRows = ({ items }: { items: AttachmentLibraryListItem[] }) => {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <article
          key={item.attachment.name}
          className="flex items-center gap-2.5 rounded-[18px] border border-amber-200/70 bg-amber-50/50 p-3 shadow-sm shadow-black/[0.02] dark:border-amber-900/50 dark:bg-amber-950/10"
        >
          <AttachmentThumb item={item} className="h-10 w-10 shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground" title={item.attachment.filename}>
              {item.attachment.filename}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <AttachmentMetadataLine className="min-w-0 max-w-full" items={[item.fileTypeLabel, item.fileSizeLabel, item.createdLabel]} />
              <AttachmentSourceChip unlinkedLabelKey="attachment-library.labels.not-linked" />
            </div>
          </div>

          <AttachmentOpenButton
            className="text-amber-900/80 hover:text-amber-950 dark:text-amber-100/80 dark:hover:text-amber-50"
            href={item.sourceUrl}
          />
        </article>
      ))}
    </div>
  );
};
