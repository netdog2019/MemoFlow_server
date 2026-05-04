import { DownloadIcon, PlayIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import PreviewDocumentDialog from "@/components/PreviewDocumentDialog";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { getDocumentPreviewMode } from "@/utils/document-preview";
import { prewarmDocumentThumbnail } from "@/utils/document-thumbnail";
import type { AttachmentVisualItem, PreviewMediaItem } from "@/utils/media-item";
import { buildAttachmentVisualItems } from "@/utils/media-item";
import LocationMapThumbnail from "../Location/LocationMapThumbnail";
import LocationPreviewDialog from "../Location/LocationPreviewDialog";
import { getLocationDisplayText, getLocationThumbnailLabel } from "../Location/locationHelpers";
import AudioThumbnailTile from "./AudioThumbnailTile";
import { getAttachmentMetadata, isAudioAttachment, separateAttachments } from "./attachmentHelpers";
import DocumentThumbnail from "./DocumentThumbnail";

interface AttachmentListViewProps {
  attachments: Attachment[];
  location?: Location;
  onImagePreview?: (items: PreviewMediaItem[], index: number) => void;
  expanded?: boolean;
}

type VisualItem = AttachmentVisualItem;
type OrderedTileBackground = {
  kind: "image" | "file" | "audio" | "map";
  item?: VisualItem;
  attachment?: Attachment;
  location?: Location;
};

const MAX_VISIBLE_TILES = 4;
const ATTACHMENT_FLOW_CLASS = "mt-1 flex w-full items-start gap-2 overflow-hidden";
const TILE_CLASS =
  "group relative isolate flex h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-[0.9rem] border border-border/55 bg-[var(--memo-surface-strong)] shadow-xs transition-[transform,border-color,box-shadow] hover:-translate-y-[1px] hover:shadow-sm";
const TILE_MEDIA_CLASS = "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]";
const TILE_OVERLAY_CLASS = "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/42 via-black/8 to-transparent";
const TILE_CAPTION_CLASS = "absolute inset-x-0 bottom-0 p-2";
const TILE_TITLE_CLASS = "truncate text-[11px] font-medium leading-tight text-white";
const TILE_SUBTITLE_CLASS = "mt-0.5 truncate text-[10px] leading-tight text-white/78";
const MAP_LABEL_CLASS =
  "absolute inset-x-1.5 top-1.5 z-[2] flex min-h-6 items-center justify-center truncate rounded-lg border border-white/80 bg-white/88 px-2 py-1 text-center text-[12px] font-semibold leading-none text-slate-950 shadow-sm backdrop-blur-[1px]";
const TILE_ICON_SHELL_CLASS =
  "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-2xl bg-background/86 text-foreground shadow-xs";

const TileCaption = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <>
    <div className={TILE_OVERLAY_CLASS} />
    <div className={TILE_CAPTION_CLASS}>
      <div className={TILE_TITLE_CLASS}>{title}</div>
      {subtitle ? <div className={TILE_SUBTITLE_CLASS}>{subtitle}</div> : null}
    </div>
  </>
);

const ImageTileContent = ({ item }: { item: VisualItem }) => {
  const motionPreviewProps = item.kind === "motion" ? getMotionPreviewProps(item) : undefined;

  return item.kind === "video" ? (
    <>
      <video src={item.sourceUrl} className={TILE_MEDIA_CLASS} preload="metadata" />
      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/86 text-foreground shadow-xs">
        <PlayIcon className="h-3.5 w-3.5 fill-current" />
      </div>
    </>
  ) : item.kind === "motion" && motionPreviewProps ? (
    <MotionPhotoPreview
      posterUrl={item.posterUrl}
      motionUrl={motionPreviewProps.motionUrl}
      alt={item.filename}
      presentationTimestampUs={motionPreviewProps.presentationTimestampUs}
      containerClassName="h-full w-full"
      mediaClassName={TILE_MEDIA_CLASS}
      badgeClassName="left-2 top-2 px-1.5 py-0 text-[9px]"
    />
  ) : (
    <img src={item.posterUrl} alt={item.filename} className={TILE_MEDIA_CLASS} loading="lazy" decoding="async" />
  );
};

const ImageTile = ({ item, onPreview }: { item: VisualItem; onPreview?: () => void }) => (
  <button type="button" className={cn(TILE_CLASS, "cursor-pointer")} onClick={onPreview}>
    <ImageTileContent item={item} />
    <TileCaption title={item.filename} />
  </button>
);

const FileTileContent = ({ attachment }: { attachment: Attachment }) => {
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);
  const subtitle = [fileTypeLabel, fileSizeLabel].filter(Boolean).join(" · ");

  return (
    <>
      <DocumentThumbnail sourceUrl={getAttachmentUrl(attachment)} filename={attachment.filename} mimeType={attachment.type} />
      <TileCaption title={attachment.filename} subtitle={subtitle} />
    </>
  );
};

const FileTile = ({ attachment, onOpen }: { attachment: Attachment; onOpen?: () => void }) => (
  <button type="button" onClick={onOpen} className={cn(TILE_CLASS, "cursor-pointer")} title={attachment.filename}>
    <FileTileContent attachment={attachment} />
  </button>
);

const AudioTileContent = ({ attachment }: { attachment: Attachment }) => {
  const { fileSizeLabel } = getAttachmentMetadata(attachment);

  return (
    <AudioThumbnailTile
      filename={attachment.filename}
      sourceUrl={getAttachmentUrl(attachment)}
      title={attachment.filename}
      subtitle={fileSizeLabel || "Audio"}
    />
  );
};

const AudioTileBackdrop = ({ attachment }: { attachment: Attachment }) => {
  const { fileSizeLabel } = getAttachmentMetadata(attachment);

  return (
    <>
      <div className="absolute inset-0 bg-linear-to-br from-secondary/78 via-background/34 to-accent/54" />
      <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.32),transparent_48%)]" />
      <div className={TILE_ICON_SHELL_CLASS}>
        <PlayIcon className="h-3.5 w-3.5 translate-x-[0.5px] fill-current" />
      </div>
      <TileCaption title={attachment.filename} subtitle={fileSizeLabel || "Audio"} />
    </>
  );
};

const AudioTile = ({ attachment }: { attachment: Attachment }) => (
  <div className={TILE_CLASS} title={attachment.filename}>
    <AudioTileContent attachment={attachment} />
    <a
      href={getAttachmentUrl(attachment)}
      download
      className="absolute right-2 top-2 z-[4] flex h-7 w-7 items-center justify-center rounded-full bg-background/88 text-foreground shadow-xs transition-colors hover:bg-background"
      aria-label={`Download ${attachment.filename}`}
      onClick={(event) => event.stopPropagation()}
    >
      <DownloadIcon className="h-3.5 w-3.5" />
    </a>
  </div>
);

const MapTileContent = ({ location }: { location: Location }) => {
  const label = getLocationThumbnailLabel(location);

  return (
    <>
      <LocationMapThumbnail location={location} />
      <div className={MAP_LABEL_CLASS}>{label}</div>
    </>
  );
};

const MapTile = ({ location, onOpen }: { location: Location; onOpen?: () => void }) => (
  <button type="button" className={cn(TILE_CLASS, "cursor-pointer")} title={getLocationDisplayText(location)} onClick={onOpen}>
    <MapTileContent location={location} />
  </button>
);

const getMotionPreviewProps = (item: VisualItem) => ({
  motionUrl: item.previewItem.kind === "motion" ? item.previewItem.motionUrl : item.sourceUrl,
  presentationTimestampUs: item.previewItem.kind === "motion" ? item.previewItem.presentationTimestampUs : undefined,
});

const OverflowTile = ({
  hiddenCount,
  onClick,
  background,
}: {
  hiddenCount: number;
  onClick: () => void;
  background?: OrderedTileBackground;
}) => (
  <button type="button" className={cn(TILE_CLASS, "cursor-pointer")} onClick={onClick} title={`还有 ${hiddenCount} 个附件`}>
    {background?.kind === "image" && background.item ? <ImageTileContent item={background.item} /> : null}
    {background?.kind === "file" && background.attachment ? <FileTileContent attachment={background.attachment} /> : null}
    {background?.kind === "audio" && background.attachment ? <AudioTileBackdrop attachment={background.attachment} /> : null}
    {background?.kind === "map" && background.location ? <MapTileContent location={background.location} /> : null}
    <div className="absolute inset-0 bg-black/35" />
    <div className="absolute inset-0 flex items-center justify-center text-white">
      <span className="text-xl font-semibold leading-none drop-shadow-sm">+{hiddenCount}</span>
    </div>
  </button>
);

const AttachmentListView = ({ attachments, location, onImagePreview, expanded: expandedProp }: AttachmentListViewProps) => {
  const [previewDocument, setPreviewDocument] = useState<Attachment | undefined>();
  const [previewLocation, setPreviewLocation] = useState<Location | undefined>();
  const [expanded, setExpanded] = useState(false);
  const { visual, audio, docs } = useMemo(() => separateAttachments(attachments), [attachments]);
  const visualItems = useMemo(() => buildAttachmentVisualItems(visual), [visual]);
  const previewItems = useMemo(() => visualItems.map((item) => item.previewItem), [visualItems]);
  const audioItems = useMemo(() => audio.filter(isAudioAttachment), [audio]);
  const totalTileCount = visualItems.length + docs.length + audioItems.length + (location ? 1 : 0);
  const showCollapseToggle = totalTileCount > MAX_VISIBLE_TILES;

  useEffect(() => {
    if (expandedProp === undefined) {
      return;
    }

    setExpanded(expandedProp);
  }, [expandedProp]);

  useEffect(() => {
    docs.forEach((attachment) => {
      if (getDocumentPreviewMode({ mimeType: attachment.type, filename: attachment.filename }) !== "fallback") {
        prewarmDocumentThumbnail({ sourceUrl: getAttachmentUrl(attachment), filename: attachment.filename, mimeType: attachment.type });
      }
    });
  }, [docs]);

  if (visualItems.length === 0 && docs.length === 0 && audioItems.length === 0 && !location) {
    return null;
  }

  const handlePreview = (itemId: string) => {
    const index = previewItems.findIndex((item) => item.id === itemId);
    onImagePreview?.(previewItems, index >= 0 ? index : 0);
  };

  const orderedTiles = [
    ...visualItems.map((item) => <ImageTile key={item.id} item={item} onPreview={() => handlePreview(item.id)} />),
    ...docs.map((attachment) => <FileTile key={attachment.name} attachment={attachment} onOpen={() => setPreviewDocument(attachment)} />),
    ...audioItems.map((attachment) => <AudioTile key={attachment.name} attachment={attachment} />),
    ...(location ? [<MapTile key="memo-location" location={location} onOpen={() => setPreviewLocation(location)} />] : []),
  ];
  const orderedTileBackgrounds: OrderedTileBackground[] = [
    ...visualItems.map((item) => ({ kind: "image" as const, item })),
    ...docs.map((attachment) => ({ kind: "file" as const, attachment })),
    ...audioItems.map((attachment) => ({ kind: "audio" as const, attachment })),
    ...(location ? [{ kind: "map" as const, location }] : []),
  ];

  const hiddenCount = Math.max(totalTileCount - MAX_VISIBLE_TILES, 0);
  const visibleTiles = expanded
    ? orderedTiles
    : showCollapseToggle
      ? [
          ...orderedTiles.slice(0, MAX_VISIBLE_TILES - 1),
          <OverflowTile
            key="overflow-tile"
            hiddenCount={hiddenCount}
            onClick={() => setExpanded(true)}
            background={orderedTileBackgrounds[MAX_VISIBLE_TILES - 1]}
          />,
        ]
      : orderedTiles;

  return (
    <div className="mt-1 flex w-full flex-col gap-2">
      <div className={ATTACHMENT_FLOW_CLASS}>{visibleTiles}</div>

      <PreviewDocumentDialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => !open && setPreviewDocument(undefined)}
        attachment={previewDocument}
      />
      <LocationPreviewDialog
        open={Boolean(previewLocation)}
        onOpenChange={(open) => !open && setPreviewLocation(undefined)}
        location={previewLocation}
      />
    </div>
  );
};

export default AttachmentListView;
