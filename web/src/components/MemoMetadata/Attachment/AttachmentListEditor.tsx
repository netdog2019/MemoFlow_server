import { FileAudioIcon, FileIcon, PlayIcon, XIcon } from "lucide-react";
import { type FC, type MouseEvent, useEffect, useMemo, useState } from "react";
import type { AttachmentItem, LocalFile } from "@/components/MemoEditor/types/attachment";
import { getAudioRecordingTimeLabel, toAttachmentItems } from "@/components/MemoEditor/types/attachment";
import PreviewDocumentDialog from "@/components/PreviewDocumentDialog";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getDocumentPreviewMode } from "@/utils/document-preview";
import { prewarmDocumentThumbnail } from "@/utils/document-thumbnail";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import type { PreviewMediaItem } from "@/utils/media-item";
import AudioThumbnailTile from "./AudioThumbnailTile";
import { formatAudioTime } from "./attachmentHelpers";
import DocumentThumbnail from "./DocumentThumbnail";

interface AttachmentListEditorProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onLocalFilesChange?: (localFiles: LocalFile[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const GRID_CLASS = "flex w-full flex-wrap gap-2";
const TILE_CLASS =
  "group relative flex h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-[1.15rem] border border-border/55 bg-[var(--memo-surface-strong)] shadow-xs transition-[transform,border-color,box-shadow] hover:-translate-y-[1px] hover:shadow-sm";
const TILE_MEDIA_CLASS = "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]";
const TILE_OVERLAY_CLASS = "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/42 via-black/8 to-transparent";
const TILE_CAPTION_CLASS = "absolute inset-x-0 bottom-0 p-2";
const TILE_TITLE_CLASS = "truncate text-[11px] font-medium leading-tight text-white";
const TILE_SUBTITLE_CLASS = "mt-0.5 truncate text-[10px] leading-tight text-white/78";
const TILE_ACTIONS_CLASS = "absolute right-1.5 top-1.5 z-[3] flex items-center gap-1";
const TILE_ACTION_BUTTON_CLASS =
  "flex h-6 w-6 items-center justify-center rounded-full bg-background/88 text-foreground shadow-xs transition-colors hover:bg-background";
const TILE_ICON_SHELL_CLASS =
  "absolute left-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-2xl bg-background/86 text-foreground shadow-xs";

const TileCaption = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <>
    <div className={TILE_OVERLAY_CLASS} />
    <div className={TILE_CAPTION_CLASS}>
      <div className={TILE_TITLE_CLASS}>{title}</div>
      {subtitle ? <div className={TILE_SUBTITLE_CLASS}>{subtitle}</div> : null}
    </div>
  </>
);

const TileActions: FC<{
  onRemove?: () => void;
}> = ({ onRemove }) => {
  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div className={TILE_ACTIONS_CLASS}>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            stopPropagation(event);
            onRemove();
          }}
          className={cn(TILE_ACTION_BUTTON_CLASS, "hover:bg-destructive/12 hover:text-destructive")}
          aria-label="Remove attachment"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

const AttachmentTile: FC<{
  item: AttachmentItem;
  onPreview?: () => void;
  onRemove?: () => void;
}> = ({ item, onPreview, onRemove }) => {
  const t = useTranslate();
  const { category, filename, thumbnailUrl, mimeType, size, sourceUrl, isVoiceNote, audioMeta } = item;

  const fileTypeLabel = item.category === "motion" ? "Live Photo" : getFileTypeLabel(mimeType);
  const recordingTimeLabel = isVoiceNote ? getAudioRecordingTimeLabel(filename) : undefined;
  const titleLabel =
    isVoiceNote && recordingTimeLabel
      ? t("editor.audio-recorder.attachment-label-with-time", { time: recordingTimeLabel })
      : isVoiceNote
        ? t("editor.audio-recorder.attachment-label")
        : filename;
  const subtitle = [
    audioMeta?.durationSeconds ? formatAudioTime(audioMeta.durationSeconds) : undefined,
    fileTypeLabel,
    size ? formatFileSize(size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn(TILE_CLASS)}>
      <TileActions onRemove={onRemove} />

      {(category === "image" || category === "motion") && thumbnailUrl ? (
        <button type="button" onClick={onPreview} className="h-full w-full cursor-pointer">
          <img src={thumbnailUrl} alt={filename} className={TILE_MEDIA_CLASS} />
          {category === "motion" ? (
            <span className="absolute left-2 top-2 z-[2] rounded-full bg-background/88 px-1.5 py-0 text-[9px] font-medium text-foreground shadow-xs">
              Live
            </span>
          ) : null}
          <TileCaption title={titleLabel} />
        </button>
      ) : category === "video" ? (
        <button type="button" onClick={onPreview} className="h-full w-full cursor-pointer">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={filename} className={TILE_MEDIA_CLASS} />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-muted/80 to-secondary/65" />
          )}
          <div className="absolute left-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-background/88 text-foreground shadow-xs">
            <PlayIcon className="h-3.5 w-3.5 fill-current" />
          </div>
          <TileCaption title={titleLabel} />
        </button>
      ) : isVoiceNote ? (
        <AudioThumbnailTile filename={filename} sourceUrl={sourceUrl} title={titleLabel} subtitle={subtitle} />
      ) : category === "document" && getDocumentPreviewMode({ mimeType, filename }) !== "fallback" ? (
        <>
          <DocumentThumbnail sourceUrl={sourceUrl} filename={filename} mimeType={mimeType} />
          <TileCaption title={titleLabel} subtitle={subtitle} />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-linear-to-br from-accent/60 via-background/42 to-secondary/54" />
          <div className={TILE_ICON_SHELL_CLASS}>
            {category === "audio" ? <FileAudioIcon className="h-3.5 w-3.5" /> : <FileIcon className="h-3.5 w-3.5" />}
          </div>
          <TileCaption title={titleLabel} subtitle={subtitle} />
        </>
      )}
    </div>
  );
};

const AttachmentListEditor: FC<AttachmentListEditorProps> = ({
  attachments,
  localFiles = [],
  onAttachmentsChange,
  onLocalFilesChange,
  onRemoveLocalFile,
}) => {
  const [previewState, setPreviewState] = useState<{ open: boolean; initialIndex: number }>({ open: false, initialIndex: 0 });
  const [previewDocument, setPreviewDocument] = useState<Attachment | undefined>();
  const items = toAttachmentItems(attachments, localFiles);
  const previewItems = useMemo<PreviewMediaItem[]>(
    () =>
      items.reduce<PreviewMediaItem[]>((acc, item) => {
        if (item.category === "image") {
          acc.push({ id: item.id, kind: "image", sourceUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        if (item.category === "video") {
          acc.push({ id: item.id, kind: "video", sourceUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        if (item.category === "motion") {
          acc.push({ id: item.id, kind: "motion", motionUrl: item.sourceUrl, posterUrl: item.thumbnailUrl, filename: item.filename });
          return acc;
        }

        return acc;
      }, []),
    [items],
  );

  useEffect(() => {
    items.forEach((item) => {
      if (item.category === "document" && getDocumentPreviewMode({ mimeType: item.mimeType, filename: item.filename }) !== "fallback") {
        prewarmDocumentThumbnail({ sourceUrl: item.sourceUrl, filename: item.filename, mimeType: item.mimeType });
      }
    });
  }, [items]);

  const handleRemoveItem = (item: AttachmentItem) => {
    if (item.isLocal) {
      const nextLocalFiles = localFiles.filter((file) => !item.memberIds.includes(file.previewUrl));
      onLocalFilesChange?.(nextLocalFiles);
      if (!onLocalFilesChange) {
        item.memberIds.forEach((previewUrl) => onRemoveLocalFile?.(previewUrl));
      }
      return;
    }

    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => !item.memberIds.includes(attachment.name)));
    }
  };

  const handlePreviewItem = (item: AttachmentItem) => {
    const previewIndex = previewItems.findIndex((previewItem) => previewItem.id === item.id);
    if (previewIndex < 0) {
      return;
    }

    setPreviewState({ open: true, initialIndex: previewIndex });
  };

  const handlePreviewDocument = (item: AttachmentItem) => {
    if (item.isLocal) {
      window.open(item.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const target = attachments.find((attachment) => item.memberIds.includes(attachment.name));
    if (target) {
      setPreviewDocument(target);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className={GRID_CLASS}>
        {items.map((item) => {
          return (
            <AttachmentTile
              key={item.id}
              item={item}
              onPreview={
                item.category === "image" || item.category === "video" || item.category === "motion"
                  ? () => handlePreviewItem(item)
                  : item.category !== "audio"
                    ? () => handlePreviewDocument(item)
                    : undefined
              }
              onRemove={() => handleRemoveItem(item)}
            />
          );
        })}
      </div>

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={(open) => setPreviewState((state) => ({ ...state, open }))}
        items={previewItems}
        initialIndex={previewState.initialIndex}
      />
      <PreviewDocumentDialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => !open && setPreviewDocument(undefined)}
        attachment={previewDocument}
      />
    </>
  );
};

export default AttachmentListEditor;
