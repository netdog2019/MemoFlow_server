import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { PreviewMediaItem } from "@/utils/media-item";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls?: string[];
  items?: PreviewMediaItem[];
  initialIndex?: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const SWIPE_THRESHOLD = 48;
const SWIPE_DOWN_CLOSE_THRESHOLD = 92;
const SWIPE_ANIMATION_MS = 220;

function PreviewImageDialog({ open, onOpenChange, imgUrls = [], items, initialIndex = 0 }: Props) {
  const sm = useMediaQuery("sm");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeViewportRef = useRef<HTMLDivElement>(null);
  const swipeTimeoutRef = useRef<number | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeTransition, setSwipeTransition] = useState(false);
  const previewItems = useMemo(
    () => items ?? imgUrls.map((url) => ({ id: url, kind: "image" as const, sourceUrl: url, posterUrl: url, filename: "Image" })),
    [imgUrls, items],
  );

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setDragOffset(0);
      setIsDragging(false);
      setSwipeTransition(false);
    }
  }, [initialIndex, open]);

  useEffect(() => {
    return () => {
      if (swipeTimeoutRef.current) {
        window.clearTimeout(swipeTimeoutRef.current);
      }
    };
  }, []);

  const itemCount = previewItems.length;
  const safeIndex = Math.max(0, Math.min(currentIndex, itemCount - 1));
  const currentItem = previewItems[safeIndex];
  const hasMultiple = itemCount > 1;
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < itemCount - 1;
  const previousItem = canGoPrevious ? previewItems[safeIndex - 1] : undefined;
  const nextItem = canGoNext ? previewItems[safeIndex + 1] : undefined;
  const isZoomable = currentItem?.kind === "image" || currentItem?.kind === "motion";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) {
        return;
      }

      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }

      if (event.key === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
        setScale(1);
        return;
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(prev + 1, itemCount - 1));
        setScale(1);
        return;
      }

      if ((event.key === "+" || event.key === "=") && isZoomable) {
        setScale((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP));
        return;
      }

      if (event.key === "-" && isZoomable) {
        setScale((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isZoomable, itemCount, onOpenChange, open]);

  if (!itemCount || !currentItem) {
    return null;
  }

  const handleClose = () => onOpenChange(false);
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setScale(1);
    setDragOffset(0);
  };
  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, itemCount - 1));
    setScale(1);
    setDragOffset(0);
  };
  const handleZoomIn = () => setScale((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP));
  const handleZoomOut = () => setScale((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP));
  const handleResetZoom = () => setScale(1);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isZoomable) {
      return;
    }

    event.preventDefault();
    if (event.deltaY < 0) {
      handleZoomIn();
      return;
    }
    handleZoomOut();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    setIsDragging(true);
    setSwipeTransition(false);
    if (swipeTimeoutRef.current) {
      window.clearTimeout(swipeTimeoutRef.current);
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || sm || scale > 1) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      return;
    }

    const viewportWidth = swipeViewportRef.current?.clientWidth || window.innerWidth;
    const edgeResistance = (deltaX > 0 && !canGoPrevious) || (deltaX < 0 && !canGoNext) ? 0.28 : 1;
    const limitedOffset = Math.max(-viewportWidth, Math.min(viewportWidth, deltaX * edgeResistance));
    setDragOffset(limitedOffset);
    event.preventDefault();
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartRef.current === null) {
      return;
    }

    const touchEnd = event.changedTouches[0];
    const deltaX = (touchEnd?.clientX ?? touchStartRef.current.x) - touchStartRef.current.x;
    const deltaY = (touchEnd?.clientY ?? touchStartRef.current.y) - touchStartRef.current.y;
    touchStartRef.current = null;

    if (!sm && deltaY > SWIPE_DOWN_CLOSE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      handleClose();
      return;
    }

    const finishSwipe = (targetOffset: number, nextIndex?: number) => {
      setIsDragging(false);
      setSwipeTransition(true);
      setDragOffset(targetOffset);
      if (swipeTimeoutRef.current) {
        window.clearTimeout(swipeTimeoutRef.current);
      }
      swipeTimeoutRef.current = window.setTimeout(() => {
        if (nextIndex !== undefined) {
          setCurrentIndex(nextIndex);
          setScale(1);
        }
        setDragOffset(0);
        setSwipeTransition(false);
      }, SWIPE_ANIMATION_MS);
    };

    if (!hasMultiple) {
      finishSwipe(0);
      return;
    }

    const viewportWidth = swipeViewportRef.current?.clientWidth || window.innerWidth;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
      finishSwipe(0);
      return;
    }

    if (deltaX > 0 && canGoPrevious) {
      finishSwipe(viewportWidth, safeIndex - 1);
      return;
    }

    if (deltaX < 0 && canGoNext) {
      finishSwipe(-viewportWidth, safeIndex + 1);
      return;
    }

    finishSwipe(0);
  };

  const mediaTransform = isZoomable ? { transform: `scale(${scale})` } : undefined;
  const swipeTrackStyle = !sm
    ? {
        transform: `translateX(calc(-33.333333% + ${dragOffset}px))`,
        transition: isDragging || !swipeTransition ? "none" : `transform ${SWIPE_ANIMATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
      }
    : undefined;
  const zoomLabel = `${Math.round(scale * 100)}%`;
  const renderPreviewMedia = (item: PreviewMediaItem, index: number, active: boolean) => {
    const itemIsZoomable = item.kind === "image" || item.kind === "motion";
    const itemTransform = active && itemIsZoomable ? mediaTransform : undefined;
    const itemCountText = itemCount;

    if (item.kind === "video") {
      return (
        <video
          key={item.id}
          src={item.sourceUrl}
          poster={item.posterUrl}
          className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-none object-contain sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
          controls={active}
          autoPlay={active}
          playsInline
        />
      );
    }

    if (item.kind === "motion") {
      return (
        <div style={itemTransform} className="transition-transform duration-150 ease-out">
          <MotionPhotoPreview
            key={item.id}
            posterUrl={item.posterUrl}
            motionUrl={item.motionUrl}
            alt={`Preview live photo ${index + 1} of ${itemCountText}`}
            presentationTimestampUs={item.presentationTimestampUs}
            badgeClassName="left-3 top-3 sm:left-4 sm:top-4"
            mediaClassName="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-none object-contain sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
          />
        </div>
      );
    }

    return (
      <img
        key={item.id}
        src={item.sourceUrl}
        alt={`Preview image ${index + 1} of ${itemCountText}`}
        className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-none object-contain select-none transition-transform duration-150 ease-out sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
        style={itemTransform}
        draggable={false}
        loading="eager"
        decoding="async"
        onDoubleClick={active ? handleResetZoom : undefined}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        bodyClassName="overflow-hidden rounded-none"
        className="!h-[100vh] !w-[100vw] !max-h-[100vh] !max-w-[100vw] overflow-hidden rounded-none border-0 bg-black/45 p-0 shadow-none backdrop-blur-sm"
        aria-describedby="image-preview-description"
      >
        <VisuallyHidden>
          <DialogTitle>{currentItem.filename || "Attachment preview"}</DialogTitle>
        </VisuallyHidden>

        <div className="absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/62 via-black/24 to-transparent px-3 pb-6 pt-3 sm:px-5 sm:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-white">
              <div className="truncate text-sm font-medium">{currentItem.filename || "Attachment"}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                {hasMultiple ? (
                  <span>
                    {safeIndex + 1} / {itemCount}
                  </span>
                ) : null}
                {isZoomable ? <span>{zoomLabel}</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isZoomable ? (
                <div className="hidden items-center gap-1 rounded-full bg-white/12 px-1.5 py-1 backdrop-blur-sm sm:flex">
                  <IconButton label="Zoom out" onClick={handleZoomOut} disabled={scale <= MIN_SCALE} icon={<Minus className="h-4 w-4" />} />
                  <IconButton
                    label="Reset zoom"
                    onClick={handleResetZoom}
                    disabled={scale === 1}
                    icon={<RotateCcw className="h-4 w-4" />}
                  />
                  <IconButton label="Zoom in" onClick={handleZoomIn} disabled={scale >= MAX_SCALE} icon={<Plus className="h-4 w-4" />} />
                </div>
              ) : null}

              <Button
                type="button"
                onClick={handleClose}
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full bg-white/12 text-white hover:bg-white/18 hover:text-white"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={swipeViewportRef}
          className="flex h-full w-full items-center justify-center overflow-hidden px-3 pb-20 pt-16 [touch-action:none] sm:px-16 sm:pb-8 sm:pt-20 sm:[touch-action:auto]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleClose();
            }
          }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex h-full w-[300%] shrink-0 items-center sm:h-auto sm:w-auto"
            style={swipeTrackStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full w-1/3 shrink-0 items-center justify-center px-2 sm:hidden">
              {previousItem ? renderPreviewMedia(previousItem, safeIndex - 1, false) : null}
            </div>
            <div className="flex h-full w-1/3 shrink-0 items-center justify-center px-2 sm:w-auto sm:px-0">
              {renderPreviewMedia(currentItem, safeIndex, true)}
            </div>
            <div className="flex h-full w-1/3 shrink-0 items-center justify-center px-2 sm:hidden">
              {nextItem ? renderPreviewMedia(nextItem, safeIndex + 1, false) : null}
            </div>
          </div>
        </div>

        {hasMultiple && sm && (
          <>
            <NavButton
              side="left"
              disabled={!canGoPrevious}
              label="Previous item"
              onClick={handlePrevious}
              icon={<ChevronLeft className="h-5 w-5" />}
            />
            <NavButton
              side="right"
              disabled={!canGoNext}
              label="Next item"
              onClick={handleNext}
              icon={<ChevronRight className="h-5 w-5" />}
            />
          </>
        )}

        {hasMultiple && !sm && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-6">
            <div className="mx-auto flex max-w-xs items-center justify-between rounded-full bg-black/55 px-2 py-2 backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={!canGoPrevious}
                className="rounded-full px-3 text-white hover:bg-white/10 hover:text-white disabled:text-white/35"
              >
                Prev
              </Button>
              <div className="px-3 text-xs text-white/75">
                {safeIndex + 1} / {itemCount}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNext}
                disabled={!canGoNext}
                className="rounded-full px-3 text-white hover:bg-white/10 hover:text-white disabled:text-white/35"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <div id="image-preview-description" className="sr-only">
          Attachment preview dialog. Press Escape to close, use left or right arrow keys to switch items, and use plus or minus keys to
          zoom.
        </div>
      </DialogContent>
    </Dialog>
  );
}

const IconButton = ({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white disabled:text-white/35"
  >
    {icon}
  </Button>
);

interface NavButtonProps {
  side: "left" | "right";
  disabled: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}

const NavButton = ({ side, disabled, label, onClick, icon }: NavButtonProps) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    disabled={disabled}
    onClick={onClick}
    aria-label={label}
    className={cn(
      "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white disabled:opacity-25 sm:flex",
      side === "left" ? "left-4" : "right-4",
    )}
  >
    {icon}
  </Button>
);

export default PreviewImageDialog;
