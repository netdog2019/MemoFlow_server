import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getFilenameExtension } from "@/utils/document-preview";
import { getCachedDocumentThumbnail } from "@/utils/document-thumbnail";

interface DocumentThumbnailProps {
  sourceUrl: string;
  filename: string;
  mimeType?: string;
  className?: string;
  badgeClassName?: string;
  contentClassName?: string;
}

const DocumentThumbnail = ({ sourceUrl, filename, mimeType, className, badgeClassName, contentClassName }: DocumentThumbnailProps) => {
  const [thumbnailSrc, setThumbnailSrc] = useState<string>("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const fileExtension = getFilenameExtension(filename).toUpperCase() || "DOC";

  useEffect(() => {
    let cancelled = false;
    setThumbnailSrc("");
    setHasLoaded(false);

    void getCachedDocumentThumbnail({ sourceUrl, filename, mimeType })
      .then((src) => {
        if (cancelled) {
          return;
        }

        setThumbnailSrc(src);
        setHasLoaded(true);
      })
      .catch((error) => {
        console.warn("Failed to render document thumbnail:", error);
        if (!cancelled) {
          setHasLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filename, mimeType, sourceUrl]);

  return (
    <div className={cn("relative h-full w-full shrink-0 overflow-hidden rounded-[inherit] bg-transparent", className)}>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-white">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={`${filename} preview`}
            className={cn("h-full w-full object-cover", contentClassName)}
            loading="lazy"
            decoding="async"
          />
        ) : hasLoaded ? (
          <div className="absolute inset-0 bg-white" />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,250,0.95))]" />
        )}
      </div>

      <div
        className={cn(
          "absolute right-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center rounded-full bg-background/88 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-foreground shadow-xs",
          badgeClassName,
        )}
      >
        <span className="truncate">{fileExtension}</span>
      </div>
    </div>
  );
};

export default DocumentThumbnail;
