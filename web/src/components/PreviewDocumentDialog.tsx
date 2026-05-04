import { ExternalLink, FileSpreadsheetIcon, FileTextIcon, LoaderCircleIcon, PanelLeftIcon, X } from "lucide-react";
import mammoth from "mammoth";
import type { PdfDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { getDocumentPreviewMode } from "@/utils/document-preview";
import { getPdfWorkerSrc, loadPdfDocumentFromUrl } from "@/utils/pdfjs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment?: Attachment;
}

interface SpreadsheetPreview {
  sheets: {
    name: string;
    rows: string[][];
  }[];
}

const isPdfRenderCancelled = (error: unknown): boolean =>
  error instanceof Error && (error.name === "RenderingCancelledException" || error.message.toLowerCase().includes("rendering cancelled"));

const formatPreviewError = (label: string, error: unknown): string => {
  if (error instanceof Error) {
    const stack = error.stack ? `\n${error.stack}` : "";
    return `${label}: ${error.name}: ${error.message}\nPDF.js worker URL: ${getPdfWorkerSrc()}${stack}`;
  }
  return `${label}: ${String(error)}\nPDF.js worker URL: ${getPdfWorkerSrc()}`;
};

function PreviewDocumentDialog({ open, onOpenChange, attachment }: Props) {
  const [textContent, setTextContent] = useState<string>("");
  const [wordHtml, setWordHtml] = useState<string>("");
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<SpreadsheetPreview | undefined>();
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "error" | "loaded">("idle");
  const [previewError, setPreviewError] = useState<string>("");

  const attachmentUrl = attachment ? getAttachmentUrl(attachment) : "";
  const mimeType = attachment?.type ?? "";
  const filename = attachment?.filename ?? "";
  const mode = useMemo(() => getDocumentPreviewMode({ mimeType, filename }), [filename, mimeType]);

  useEffect(() => {
    if (!open || !attachment) {
      if (!open) {
        setTextContent("");
        setWordHtml("");
        setSpreadsheetPreview(undefined);
        setPreviewError("");
        setLoadingState("idle");
      }
      return;
    }

    if (mode === "fallback") {
      setLoadingState("loaded");
      return;
    }

    const controller = new AbortController();
    setPreviewError("");
    setLoadingState("loading");

    const loadPreview = async () => {
      if (mode === "pdf") {
        setLoadingState("loaded");
        return;
      }

      const response = await fetch(attachmentUrl, { credentials: "include", signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
      }

      if (mode === "text") {
        const text = await response.text();
        setTextContent(text);
        setLoadingState("loaded");
        return;
      }

      const arrayBuffer = await response.arrayBuffer();

      if (mode === "word") {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setWordHtml(result.value);
        setLoadingState("loaded");
        return;
      }

      if (mode === "sheet") {
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheets = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            blankrows: false,
            defval: "",
            raw: false,
          }) as string[][];

          return {
            name: sheetName,
            rows: rows.map((row) => row.map((cell) => String(cell ?? ""))),
          };
        });

        setSpreadsheetPreview({ sheets });
        setLoadingState("loaded");
        return;
      }
    };

    void loadPreview().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return;
      }

      if (mode === "pdf") {
        console.warn("Failed to fetch PDF for preview.", error);
        setPreviewError(error instanceof Error ? error.message : "PDF 加载失败");
        setLoadingState("error");
        return;
      }

      console.error(error);
      setPreviewError(error instanceof Error ? error.message : "文档加载失败");
      setLoadingState("error");
    });

    return () => controller.abort();
  }, [attachment, attachmentUrl, mode, open]);

  if (!attachment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        size="2xl"
        className={
          mode === "pdf"
            ? "h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] !w-[min(100vw-1rem,72rem)] !max-w-[72rem] overflow-hidden p-0 sm:h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] md:max-h-[calc(100vh-3rem)]"
            : "max-h-[calc(100vh-2rem)] !w-[min(100vw-1rem,72rem)] !max-w-[72rem] overflow-hidden p-0"
        }
        bodyClassName={mode === "pdf" ? "h-full min-h-0 overflow-hidden gap-0" : undefined}
        aria-describedby="document-preview-description"
      >
        <VisuallyHidden>
          <DialogTitle>{attachment.filename}</DialogTitle>
        </VisuallyHidden>

        {mode !== "pdf" ? (
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/82 px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">{attachment.filename}</div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
                <a href={attachmentUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  新窗口打开
                </a>
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close document preview">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="h-full min-h-0 flex-1 overflow-hidden bg-[var(--memo-surface)]">
          {loadingState === "loading" ? <LoadingView /> : null}
          {loadingState === "error" ? <FallbackMessage attachmentUrl={attachmentUrl} detail={previewError} /> : null}
          {loadingState === "loaded" && mode === "pdf" ? (
            <PdfPreviewView attachmentUrl={attachmentUrl} filename={attachment.filename} onClose={() => onOpenChange(false)} />
          ) : null}
          {loadingState === "loaded" && mode === "text" ? <TextPreview textContent={textContent} /> : null}
          {loadingState === "loaded" && mode === "word" ? <WordPreview html={wordHtml} /> : null}
          {loadingState === "loaded" && mode === "sheet" ? <SpreadsheetPreviewView preview={spreadsheetPreview} /> : null}
          {loadingState === "loaded" && mode === "fallback" ? <UnsupportedPreview attachmentUrl={attachmentUrl} /> : null}
        </div>

        <div id="document-preview-description" className="sr-only">
          Document preview dialog.
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LoadingView = () => (
  <div className="flex h-[78vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-full bg-background/82 px-5 py-3 text-sm text-muted-foreground shadow-xs">
      <LoaderCircleIcon className="h-4 w-4 animate-spin" />
      正在加载文档预览…
    </div>
  </div>
);

const TextPreview = ({ textContent }: { textContent: string }) => (
  <div className="h-[78vh] overflow-auto p-5">
    <pre className="whitespace-pre-wrap break-words rounded-[1.25rem] border border-border/55 bg-background/75 p-4 text-sm leading-7 text-foreground">
      {textContent}
    </pre>
  </div>
);

const WordPreview = ({ html }: { html: string }) => (
  <div className="h-[78vh] overflow-auto p-5">
    <div
      className="prose prose-neutral max-w-none rounded-[1.25rem] border border-border/55 bg-background/75 p-6 text-sm leading-7 text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  </div>
);

const SpreadsheetPreviewView = ({ preview }: { preview?: SpreadsheetPreview }) => {
  if (!preview || preview.sheets.length === 0) {
    return <FallbackMessage attachmentUrl="" />;
  }

  return (
    <div className="h-[78vh] overflow-auto p-5">
      <div className="flex flex-col gap-5">
        {preview.sheets.map((sheet) => (
          <div key={sheet.name} className="overflow-hidden rounded-[1.25rem] border border-border/55 bg-background/75">
            <div className="flex items-center gap-2 border-b border-border/55 px-4 py-3 text-sm font-medium text-foreground">
              <FileSpreadsheetIcon className="h-4 w-4" />
              {sheet.name}
            </div>
            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <tbody>
                  {sheet.rows.map((row, rowIndex) => (
                    <tr key={`${sheet.name}-${rowIndex}`} className="border-b border-border/40 align-top last:border-b-0">
                      {row.map((cell, cellIndex) => (
                        <td key={`${sheet.name}-${rowIndex}-${cellIndex}`} className="min-w-32 px-3 py-2 text-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PDF_PAGE_GAP = 16;
const PDF_THUMBNAIL_WIDTH = 112;
const PDF_SCALE_STEP = 1.2;
const PDF_MIN_SCALE = 0.4;
const PDF_MAX_SCALE = 3;
const PDF_VIEWPORT_PADDING = 32;
const PDF_PAGE_RENDER_AHEAD = 1;
const PDF_THUMBNAIL_BACKGROUND_DELAY = 160;
const PDF_PREVIEW_RENDER_SCALE_FACTOR = 0.45;
const PDF_PREVIEW_MIN_SCALE = 0.55;
const PDF_FULL_RENDER_DELAY = 120;
const PDF_PAGE_DOM_OVERSCAN = 3;

type PdfZoomMode = "fit-width" | "custom";

type PdfPageSize = {
  pageNumber: number;
  width: number;
  height: number;
};

type PdfPageMetric = PdfPageSize & {
  scaledWidth: number;
  scaledHeight: number;
  offsetTop: number;
  offsetBottom: number;
};

type PdfRenderTask = {
  cancel: () => void;
  promise: Promise<unknown>;
};

type PdfRenderQuality = "preview" | "full";

type PdfPinchState = {
  active: boolean;
  distance: number;
  scale: number;
  centerX: number;
  centerY: number;
  scrollLeft: number;
  scrollTop: number;
};

type PdfTouchList = {
  length: number;
  item: (index: number) => React.Touch | null;
};

const clampNumber = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const getTouchDistance = (touches: PdfTouchList): number => {
  const firstTouch = touches.item(0);
  const secondTouch = touches.item(1);
  if (!firstTouch || !secondTouch) {
    return 0;
  }

  return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
};

const getTouchCenter = (touches: PdfTouchList): { x: number; y: number } => {
  const firstTouch = touches.item(0);
  const secondTouch = touches.item(1);
  if (!firstTouch || !secondTouch) {
    return { x: 0, y: 0 };
  }

  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  };
};

const getPdfPageRenderBaseKey = (pageMetric: PdfPageMetric, effectiveScale: number): string =>
  `${Math.round(effectiveScale * 1000)}:${pageMetric.scaledWidth}x${pageMetric.scaledHeight}`;

const getPdfPageRenderKey = (baseKey: string, quality: PdfRenderQuality): string => `${quality}:${baseKey}`;

const hasPdfPageRenderAtQuality = (renderedKey: string | undefined, baseKey: string, quality: PdfRenderQuality): boolean => {
  if (!renderedKey) {
    return false;
  }

  if (renderedKey === getPdfPageRenderKey(baseKey, "full")) {
    return true;
  }

  return quality === "preview" && renderedKey === getPdfPageRenderKey(baseKey, "preview");
};

const cancelPdfRenderTask = (renderTask?: PdfRenderTask) => {
  try {
    renderTask?.cancel();
  } catch {
    // Ignore cancellation errors from already-finished tasks.
  }
};

const clearPdfRenderTasks = (renderTasks: Map<number, PdfRenderTask>) => {
  for (const renderTask of renderTasks.values()) {
    cancelPdfRenderTask(renderTask);
  }
  renderTasks.clear();
};

const buildPdfPageMetrics = (pageSizes: PdfPageSize[], scale: number): PdfPageMetric[] => {
  let offsetTop = 0;
  return pageSizes.map((page, index) => {
    const scaledWidth = Math.ceil(page.width * scale);
    const scaledHeight = Math.ceil(page.height * scale);
    const nextPage = {
      ...page,
      scaledWidth,
      scaledHeight,
      offsetTop,
      offsetBottom: offsetTop + scaledHeight,
    };

    offsetTop += scaledHeight;
    if (index < pageSizes.length - 1) {
      offsetTop += PDF_PAGE_GAP;
    }

    return nextPage;
  });
};

const getCurrentPageFromMetrics = (pageMetrics: PdfPageMetric[], scrollTop: number, viewportHeight: number): number => {
  if (pageMetrics.length === 0) {
    return 1;
  }

  const focusLine = scrollTop + viewportHeight * 0.35;
  const currentPage = pageMetrics.find((page) => page.offsetTop <= focusLine && page.offsetBottom >= focusLine);
  if (currentPage) {
    return currentPage.pageNumber;
  }

  const nextPage = pageMetrics.find((page) => page.offsetTop > focusLine);
  return nextPage?.pageNumber ?? pageMetrics[pageMetrics.length - 1]?.pageNumber ?? 1;
};

export const PdfPreviewView = ({ attachmentUrl, filename, onClose }: { attachmentUrl: string; filename: string; onClose: () => void }) => {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const pageCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const thumbnailCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const thumbnailButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const renderedPagesRef = useRef(new Map<number, string>());
  const renderedThumbnailsRef = useRef(new Set<number>());
  const renderGenerationRef = useRef(0);
  const pageRenderTasksRef = useRef(new Map<number, PdfRenderTask>());
  const thumbnailRenderTasksRef = useRef(new Map<number, PdfRenderTask>());
  const pageRenderTimeoutRef = useRef<number | undefined>(undefined);
  const panStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const pinchStateRef = useRef<PdfPinchState>({
    active: false,
    distance: 0,
    scale: 1,
    centerX: 0,
    centerY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | undefined>();
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<PdfPageSize[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [zoomMode, setZoomMode] = useState<PdfZoomMode>("fit-width");
  const [customScale, setCustomScale] = useState(1);
  const [loadingState, setLoadingState] = useState<"loading" | "fallback" | "loaded">("loading");
  const [previewError, setPreviewError] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [isThumbnailSidebarOpen, setIsThumbnailSidebarOpen] = useState(false);

  const updatePageSize = (pageNumber: number, width: number, height: number) => {
    setPageSizes((current) => {
      if (current.length === 0 || !current[pageNumber - 1]) {
        return current;
      }

      const currentPageSize = current[pageNumber - 1];
      if (Math.abs(currentPageSize.width - width) < 0.5 && Math.abs(currentPageSize.height - height) < 0.5) {
        return current;
      }

      const next = [...current];
      next[pageNumber - 1] = {
        pageNumber,
        width,
        height,
      };
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PdfDocumentProxy | undefined;
    setLoadingState("loading");
    setPreviewError("");
    setPdfDocument(undefined);
    setPageCount(0);
    setPageSizes([]);
    setCurrentPage(1);
    setZoomMode("fit-width");
    setCustomScale(1);
    setIsThumbnailSidebarOpen(false);
    renderedPagesRef.current = new Map<number, string>();
    renderedThumbnailsRef.current = new Set<number>();
    clearPdfRenderTasks(pageRenderTasksRef.current);
    clearPdfRenderTasks(thumbnailRenderTasksRef.current);
    if (pageRenderTimeoutRef.current !== undefined) {
      window.clearTimeout(pageRenderTimeoutRef.current);
      pageRenderTimeoutRef.current = undefined;
    }

    const loadPdf = async () => {
      loadedDocument = await loadPdfDocumentFromUrl(attachmentUrl);
      if (!cancelled) {
        setPageCount(loadedDocument.numPages);
        setPdfDocument(loadedDocument);
      }
    };

    void loadPdf().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      console.warn("Failed to load PDF preview.", error);
      setPreviewError(formatPreviewError("PDF.js 加载失败", error));
      setLoadingState("fallback");
    });

    return () => {
      cancelled = true;
      clearPdfRenderTasks(pageRenderTasksRef.current);
      clearPdfRenderTasks(thumbnailRenderTasksRef.current);
      if (pageRenderTimeoutRef.current !== undefined) {
        window.clearTimeout(pageRenderTimeoutRef.current);
        pageRenderTimeoutRef.current = undefined;
      }
      void loadedDocument?.destroy();
    };
  }, [attachmentUrl]);

  useEffect(() => {
    if (!pdfDocument || pageCount === 0) {
      return;
    }

    let cancelled = false;
    const loadPageSizes = async () => {
      const firstPage = await pdfDocument.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1 });
      const firstPageSize = {
        pageNumber: 1,
        width: firstViewport.width,
        height: firstViewport.height,
      };

      if (cancelled) {
        return;
      }

      setPageSizes(
        Array.from({ length: pageCount }, (_, index) => ({
          pageNumber: index + 1,
          width: firstPageSize.width,
          height: firstPageSize.height,
        })),
      );
    };

    void loadPageSizes().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      console.warn("Failed to read PDF page sizes.", error);
      setPreviewError(formatPreviewError("PDF.js 页面尺寸读取失败", error));
      setLoadingState("fallback");
    });

    return () => {
      cancelled = true;
    };
  }, [pageCount, pdfDocument]);

  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) {
      return;
    }

    const updateAvailableWidth = () => {
      setAvailableWidth(Math.max(container.clientWidth - PDF_VIEWPORT_PADDING, 240));
    };

    updateAvailableWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateAvailableWidth();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const maxBasePageWidth = useMemo(() => pageSizes.reduce((width, page) => Math.max(width, page.width), 0), [pageSizes]);

  const fitWidthScale = useMemo(() => {
    if (availableWidth === 0 || maxBasePageWidth === 0) {
      return 1;
    }
    return availableWidth / maxBasePageWidth;
  }, [availableWidth, maxBasePageWidth]);

  const effectiveScale = zoomMode === "fit-width" ? fitWidthScale : customScale;
  const pageMetrics = useMemo(() => buildPdfPageMetrics(pageSizes, effectiveScale), [effectiveScale, pageSizes]);
  const totalContentHeight = pageMetrics.length > 0 ? pageMetrics[pageMetrics.length - 1].offsetBottom : 0;
  const maxScaledPageWidth = pageMetrics.reduce((width, page) => Math.max(width, page.scaledWidth), 0);
  const contentWidth = Math.max(availableWidth, maxScaledPageWidth);
  const zoomLabel = `${Math.round(effectiveScale * 100)}%`;
  const pageRenderTargets = useMemo(() => {
    if (pageCount === 0) {
      return [] as number[];
    }

    const targets = new Set<number>();
    targets.add(currentPage);

    for (let distance = 1; distance <= PDF_PAGE_RENDER_AHEAD; distance++) {
      const previousPage = currentPage - distance;
      const nextPage = currentPage + distance;
      if (previousPage >= 1) {
        targets.add(previousPage);
      }
      if (nextPage <= pageCount) {
        targets.add(nextPage);
      }
    }

    if (currentPage === 1 && pageCount >= 2) {
      targets.add(2);
    }

    return Array.from(targets);
  }, [currentPage, pageCount]);
  const visiblePageMetrics = useMemo(
    () => pageMetrics.filter((pageMetric) => Math.abs(pageMetric.pageNumber - currentPage) <= PDF_PAGE_DOM_OVERSCAN),
    [currentPage, pageMetrics],
  );

  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container || pageMetrics.length === 0) {
      return;
    }

    const updateViewportState = () => {
      const nextCurrentPage = getCurrentPageFromMetrics(pageMetrics, container.scrollTop, container.clientHeight);
      setCurrentPage((current) => (current === nextCurrentPage ? current : nextCurrentPage));
    };

    updateViewportState();
    container.addEventListener("scroll", updateViewportState, { passive: true });
    window.addEventListener("resize", updateViewportState);

    return () => {
      container.removeEventListener("scroll", updateViewportState);
      window.removeEventListener("resize", updateViewportState);
    };
  }, [pageMetrics]);

  useEffect(() => {
    if (!pdfDocument || pageMetrics.length === 0) {
      return;
    }

    let cancelled = false;
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;
    clearPdfRenderTasks(pageRenderTasksRef.current);
    if (pageRenderTimeoutRef.current !== undefined) {
      window.clearTimeout(pageRenderTimeoutRef.current);
      pageRenderTimeoutRef.current = undefined;
    }

    const renderPage = async (pageNumber: number, quality: PdfRenderQuality) => {
      const pageMetric = pageMetrics[pageNumber - 1];
      if (!pageMetric) {
        return;
      }

      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      updatePageSize(pageNumber, baseViewport.width, baseViewport.height);
      const canvas = pageCanvasRefs.current[pageNumber - 1];
      const context = canvas?.getContext("2d", { alpha: false });
      if (!canvas || !context) {
        return;
      }

      const renderBaseKey = getPdfPageRenderBaseKey(pageMetric, effectiveScale);
      const renderedKey = renderedPagesRef.current.get(pageNumber);
      if (hasPdfPageRenderAtQuality(renderedKey, renderBaseKey, quality)) {
        if (loadingState !== "loaded" && pageNumber === currentPage) {
          setLoadingState("loaded");
        }
        return;
      }

      const renderScale =
        quality === "preview"
          ? Math.min(effectiveScale, Math.max(PDF_PREVIEW_MIN_SCALE, effectiveScale * PDF_PREVIEW_RENDER_SCALE_FACTOR))
          : effectiveScale;
      const viewport = page.getViewport({ scale: renderScale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${pageMetric.scaledWidth}px`;
      canvas.style.height = `${pageMetric.scaledHeight}px`;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      cancelPdfRenderTask(pageRenderTasksRef.current.get(pageNumber));
      const renderTask = page.render({ canvasContext: context, viewport });
      pageRenderTasksRef.current.set(pageNumber, renderTask);

      try {
        await renderTask.promise;
      } finally {
        if (pageRenderTasksRef.current.get(pageNumber) === renderTask) {
          pageRenderTasksRef.current.delete(pageNumber);
        }
      }

      if (cancelled || renderGenerationRef.current !== generation) {
        return;
      }

      renderedPagesRef.current.set(pageNumber, getPdfPageRenderKey(renderBaseKey, quality));
      if (pageNumber === 1 || pageNumber === currentPage) {
        setLoadingState("loaded");
      }
    };

    const renderVisiblePages = async () => {
      setPreviewError("");

      const currentPageMetric = pageMetrics[currentPage - 1];
      const currentRenderBaseKey = currentPageMetric ? getPdfPageRenderBaseKey(currentPageMetric, effectiveScale) : undefined;
      if (currentRenderBaseKey && !hasPdfPageRenderAtQuality(renderedPagesRef.current.get(currentPage), currentRenderBaseKey, "preview")) {
        setLoadingState("loading");
      }

      if (currentPageMetric) {
        const currentRenderBaseKey = getPdfPageRenderBaseKey(currentPageMetric, effectiveScale);
        await renderPage(currentPage, "preview");
        if (cancelled) {
          return;
        }

        const fullRenderKey = getPdfPageRenderKey(currentRenderBaseKey, "full");
        if (renderedPagesRef.current.get(currentPage) !== fullRenderKey) {
          await new Promise<void>((resolve) => {
            pageRenderTimeoutRef.current = window.setTimeout(() => {
              pageRenderTimeoutRef.current = undefined;
              resolve();
            }, PDF_FULL_RENDER_DELAY);
          });
          if (cancelled || renderGenerationRef.current !== generation) {
            return;
          }
          await renderPage(currentPage, "full");
        }
      }

      for (const pageNumber of pageRenderTargets) {
        if (cancelled || pageNumber === currentPage) {
          continue;
        }

        await renderPage(pageNumber, "preview");
      }
    };

    void renderVisiblePages().catch((error: unknown) => {
      if (cancelled || isPdfRenderCancelled(error)) {
        return;
      }

      console.warn("Failed to render PDF pages.", error);
      setPreviewError(formatPreviewError("PDF.js 页面渲染失败", error));
      setLoadingState("fallback");
    });

    return () => {
      cancelled = true;
      clearPdfRenderTasks(pageRenderTasksRef.current);
      if (pageRenderTimeoutRef.current !== undefined) {
        window.clearTimeout(pageRenderTimeoutRef.current);
        pageRenderTimeoutRef.current = undefined;
      }
    };
  }, [currentPage, effectiveScale, pageCount, pageMetrics, pageRenderTargets, pdfDocument]);

  useEffect(() => {
    if (!pdfDocument || pageCount === 0 || pageSizes.length === 0 || loadingState !== "loaded") {
      return;
    }

    let cancelled = false;
    clearPdfRenderTasks(thumbnailRenderTasksRef.current);
    const renderThumbnail = async (pageNumber: number) => {
      if (cancelled || renderedThumbnailsRef.current.has(pageNumber)) {
        return;
      }

      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      updatePageSize(pageNumber, baseViewport.width, baseViewport.height);
      const canvas = thumbnailCanvasRefs.current[pageNumber - 1];
      const context = canvas?.getContext("2d", { alpha: false });
      const pageSize = pageSizes[pageNumber - 1];
      if (!canvas || !context || !pageSize) {
        return;
      }

      const thumbnailScale = PDF_THUMBNAIL_WIDTH / pageSize.width;
      const viewport = page.getViewport({ scale: thumbnailScale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      cancelPdfRenderTask(thumbnailRenderTasksRef.current.get(pageNumber));
      const renderTask = page.render({ canvasContext: context, viewport });
      thumbnailRenderTasksRef.current.set(pageNumber, renderTask);

      try {
        await renderTask.promise;
      } finally {
        if (thumbnailRenderTasksRef.current.get(pageNumber) === renderTask) {
          thumbnailRenderTasksRef.current.delete(pageNumber);
        }
      }

      if (cancelled) {
        return;
      }
      renderedThumbnailsRef.current.add(pageNumber);
    };

    const renderThumbnails = async () => {
      const targetPages = Array.from({ length: pageCount }, (_, index) => index + 1);
      for (const pageNumber of targetPages) {
        if (cancelled) {
          return;
        }

        await renderThumbnail(pageNumber);
        await new Promise((resolve) => {
          window.setTimeout(resolve, PDF_THUMBNAIL_BACKGROUND_DELAY);
        });
      }
    };

    void renderThumbnails().catch((error: unknown) => {
      if (!cancelled) {
        console.warn("Failed to render PDF thumbnails.", error);
      }
    });

    return () => {
      cancelled = true;
      clearPdfRenderTasks(thumbnailRenderTasksRef.current);
    };
  }, [loadingState, pageCount, pageSizes, pdfDocument]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = mainScrollRef.current;
      const panState = panStateRef.current;
      if (!container || !panState.active) {
        return;
      }

      container.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
      container.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
      event.preventDefault();
    };

    const stopPanning = () => {
      if (!panStateRef.current.active) {
        return;
      }

      panStateRef.current.active = false;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopPanning);
    window.addEventListener("blur", stopPanning);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopPanning);
      window.removeEventListener("blur", stopPanning);
    };
  }, []);

  useEffect(() => {
    if (!isThumbnailSidebarOpen) {
      return;
    }

    const currentThumbnailButton = thumbnailButtonRefs.current[currentPage - 1];
    currentThumbnailButton?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentPage, isThumbnailSidebarOpen]);

  const scrollToPage = (pageNumber: number, behavior: ScrollBehavior = "auto") => {
    const container = mainScrollRef.current;
    const pageContainer = pageContainerRefs.current[pageNumber - 1];
    if (!container) {
      return;
    }

    setCurrentPage((current) => (current === pageNumber ? current : pageNumber));

    if (pageContainer) {
      container.scrollTo({
        top: Math.max(pageContainer.offsetTop - 12, 0),
        behavior,
      });
      return;
    }

    const pageMetric = pageMetrics[pageNumber - 1];
    if (!pageMetric) {
      return;
    }

    container.scrollTo({
      top: pageMetric.offsetTop,
      behavior,
    });
  };

  const applyZoom = (nextScale: number, anchor?: { clientX: number; clientY: number; baseScale?: number }) => {
    const container = mainScrollRef.current;
    const previousScale = anchor?.baseScale ?? effectiveScale;
    const clampedScale = clampNumber(nextScale, PDF_MIN_SCALE, PDF_MAX_SCALE);

    if (container && anchor && previousScale > 0) {
      const rect = container.getBoundingClientRect();
      const anchorX = anchor.clientX - rect.left;
      const anchorY = anchor.clientY - rect.top;
      const contentX = container.scrollLeft + anchorX;
      const contentY = container.scrollTop + anchorY;
      const scaleRatio = clampedScale / previousScale;

      requestAnimationFrame(() => {
        container.scrollLeft = Math.max(contentX * scaleRatio - anchorX, 0);
        container.scrollTop = Math.max(contentY * scaleRatio - anchorY, 0);
      });
    }

    setZoomMode("custom");
    setCustomScale(clampedScale);
  };

  const handleZoomIn = () => {
    applyZoom(effectiveScale * PDF_SCALE_STEP);
  };

  const handleZoomOut = () => {
    applyZoom(effectiveScale / PDF_SCALE_STEP);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) {
      pinchStateRef.current.active = false;
      return;
    }

    const container = mainScrollRef.current;
    const distance = getTouchDistance(event.touches);
    const center = getTouchCenter(event.touches);
    if (!container || distance <= 0) {
      return;
    }

    pinchStateRef.current = {
      active: true,
      distance,
      scale: effectiveScale,
      centerX: center.x,
      centerY: center.y,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    panStateRef.current.active = false;
    setIsPanning(false);
    event.preventDefault();
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const pinchState = pinchStateRef.current;
    if (!pinchState.active || event.touches.length !== 2 || pinchState.distance <= 0) {
      return;
    }

    const distance = getTouchDistance(event.touches);
    const center = getTouchCenter(event.touches);
    if (distance <= 0) {
      return;
    }

    const nextScale = pinchState.scale * (distance / pinchState.distance);
    applyZoom(nextScale, {
      clientX: center.x,
      clientY: center.y,
      baseScale: effectiveScale,
    });
    event.preventDefault();
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchStateRef.current.active = false;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border/50 bg-background px-3 py-2">
        <div className="flex h-8 min-w-0 flex-1 items-center pr-2 text-sm font-medium text-foreground">
          <span className="truncate">{filename}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 md:inline-flex"
          onClick={() => setIsThumbnailSidebarOpen((open) => !open)}
          aria-expanded={isThumbnailSidebarOpen}
          aria-controls="pdf-thumbnail-sidebar"
        >
          <PanelLeftIcon className="h-4 w-4" />
          页缩略图
        </Button>
        <div className="hidden items-center gap-1 rounded-md border border-border/50 bg-background px-1 py-1 md:flex">
          <Button type="button" variant="ghost" size="icon" onClick={handleZoomOut} aria-label="缩小">
            <span className="text-base leading-none">-</span>
          </Button>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-xs tabular-nums text-foreground transition hover:bg-accent/55"
            onClick={() => {
              setZoomMode("fit-width");
            }}
          >
            {zoomMode === "fit-width" ? `适配宽度 ${zoomLabel}` : zoomLabel}
          </button>
          <Button type="button" variant="ghost" size="icon" onClick={handleZoomIn} aria-label="放大">
            <span className="text-base leading-none">+</span>
          </Button>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-xs tabular-nums text-muted-foreground transition hover:bg-accent/55 hover:text-foreground"
            onClick={() => {
              setZoomMode("custom");
              setCustomScale(1);
            }}
          >
            100%
          </button>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
          <a href={attachmentUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            新窗口打开
          </a>
        </Button>
        <div className="flex-1 md:hidden" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close document preview">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="relative flex h-full min-h-0">
          {!isThumbnailSidebarOpen ? (
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-5 md:hidden"
              aria-label="打开页缩略图"
              onClick={() => setIsThumbnailSidebarOpen(true)}
            />
          ) : null}
          {isThumbnailSidebarOpen ? (
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/18 md:bg-transparent"
              aria-label="隐藏页缩略图"
              onClick={() => setIsThumbnailSidebarOpen(false)}
            />
          ) : null}
          <aside
            id="pdf-thumbnail-sidebar"
            data-pdf-thumbnail-sidebar="true"
            className={`absolute inset-y-0 left-0 z-30 w-40 shrink-0 overflow-y-auto border-r border-border/50 bg-background/96 px-2 py-3 shadow-lg transition-transform duration-200 ${
              isThumbnailSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            aria-hidden={!isThumbnailSidebarOpen}
          >
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: pageCount }, (_, index) => {
                const pageSize = pageSizes[index];
                const thumbnailHeight = pageSize ? Math.max(Math.round((pageSize.height / pageSize.width) * PDF_THUMBNAIL_WIDTH), 96) : 112;

                return (
                  <button
                    key={index + 1}
                    ref={(node) => {
                      thumbnailButtonRefs.current[index] = node;
                    }}
                    data-pdf-thumbnail-button={index + 1}
                    type="button"
                    onClick={() => {
                      scrollToPage(index + 1);
                      setIsThumbnailSidebarOpen(false);
                    }}
                    className={`w-full border-l-2 px-2 py-1 text-center transition ${
                      currentPage === index + 1 ? "border-l-foreground/45 bg-accent/35" : "border-l-transparent hover:bg-accent/20"
                    }`}
                    aria-label={`跳转到第 ${index + 1} 页`}
                  >
                    <div
                      className="mx-auto overflow-hidden bg-white"
                      style={{ width: `${PDF_THUMBNAIL_WIDTH}px`, minHeight: `${thumbnailHeight}px` }}
                    >
                      <canvas
                        ref={(node) => {
                          thumbnailCanvasRefs.current[index] = node;
                        }}
                        draggable={false}
                        className="pointer-events-none block select-none bg-white"
                      />
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">{index + 1}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div
            ref={mainScrollRef}
            data-pdf-main-scroll="true"
            role="region"
            aria-label="PDF 阅读区"
            tabIndex={0}
            className={`min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto px-3 py-3 outline-hidden ${
              isPanning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }

              const container = mainScrollRef.current;
              if (!container) {
                return;
              }

              panStateRef.current = {
                active: true,
                startX: event.clientX,
                startY: event.clientY,
                scrollLeft: container.scrollLeft,
                scrollTop: container.scrollTop,
              };
              setIsPanning(true);
              event.preventDefault();
            }}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) {
                return;
              }

              if (event.deltaY < 0) {
                handleZoomIn();
              } else if (event.deltaY > 0) {
                handleZoomOut();
              }
              event.preventDefault();
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onKeyDown={(event) => {
              const container = mainScrollRef.current;
              if (!container) {
                return;
              }

              if (event.key === "PageDown" || event.key === "ArrowDown") {
                container.scrollBy({ top: container.clientHeight * 0.9, behavior: "smooth" });
                event.preventDefault();
                return;
              }

              if (event.key === "PageUp" || event.key === "ArrowUp") {
                container.scrollBy({ top: -container.clientHeight * 0.9, behavior: "smooth" });
                event.preventDefault();
                return;
              }

              if (event.key === "Home") {
                scrollToPage(1);
                event.preventDefault();
                return;
              }

              if (event.key === "End") {
                scrollToPage(pageCount);
                event.preventDefault();
                return;
              }

              if (event.key === "+" || event.key === "=") {
                handleZoomIn();
                event.preventDefault();
                return;
              }

              if (event.key === "-") {
                handleZoomOut();
                event.preventDefault();
              }
            }}
          >
            <div
              className="relative mx-auto"
              style={{ width: `${Math.ceil(contentWidth)}px`, minHeight: `${Math.ceil(totalContentHeight)}px` }}
            >
              {visiblePageMetrics.map((pageMetric) => (
                <div
                  key={pageMetric.pageNumber}
                  ref={(node) => {
                    pageContainerRefs.current[pageMetric.pageNumber - 1] = node;
                  }}
                  data-pdf-page-container={pageMetric.pageNumber}
                  className="absolute left-0 flex w-full justify-center"
                  style={{
                    top: `${pageMetric.offsetTop}px`,
                    height: `${pageMetric.scaledHeight}px`,
                  }}
                >
                  <canvas
                    ref={(node) => {
                      const pageIndex = pageMetric.pageNumber - 1;
                      if (node && pageCanvasRefs.current[pageIndex] !== node) {
                        renderedPagesRef.current.delete(pageMetric.pageNumber);
                      }
                      pageCanvasRefs.current[pageIndex] = node;
                    }}
                    draggable={false}
                    className="pointer-events-none block select-none bg-white shadow-md"
                    style={{
                      width: `${pageMetric.scaledWidth}px`,
                      height: `${pageMetric.scaledHeight}px`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {loadingState === "loading" ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-xs">
              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              正在渲染 PDF…
            </div>
          </div>
        ) : null}
        {loadingState === "fallback" ? <NativePdfFallback attachmentUrl={attachmentUrl} detail={previewError} /> : null}
      </div>
    </div>
  );
};

const NativePdfFallback = ({ attachmentUrl, detail }: { attachmentUrl: string; detail?: string }) => {
  return (
    <div className="absolute inset-0 bg-background">
      {detail ? (
        <div className="max-h-32 overflow-auto whitespace-pre-wrap border-b border-border/60 bg-background/95 px-4 py-2 font-mono text-xs leading-5 text-muted-foreground">
          已切换到兼容预览：
          {"\n"}
          {detail}
        </div>
      ) : null}
      <object data={attachmentUrl} type="application/pdf" className="h-full w-full bg-white">
        <FallbackMessage attachmentUrl={attachmentUrl} detail={detail} />
      </object>
    </div>
  );
};

const UnsupportedPreview = ({ attachmentUrl }: { attachmentUrl: string }) => (
  <div className="flex h-[78vh] items-center justify-center p-6">
    <div className="max-w-md rounded-[1.5rem] border border-border/55 bg-background/82 p-6 text-center shadow-xs">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/55 text-foreground">
        <FileTextIcon className="h-5 w-5" />
      </div>
      <div className="text-sm font-medium text-foreground">该文档格式暂不支持应用内完整预览</div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        可以先在新窗口打开。如果浏览器或系统已安装处理程序，会直接显示对应文档。
      </div>
      <div className="mt-4">
        <Button asChild>
          <a href={attachmentUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            打开文档
          </a>
        </Button>
      </div>
    </div>
  </div>
);

const FallbackMessage = ({ attachmentUrl, detail }: { attachmentUrl: string; detail?: string }) => (
  <div className="flex h-[78vh] items-center justify-center p-6">
    <div className="max-w-md rounded-[1.5rem] border border-border/55 bg-background/82 p-6 text-center shadow-xs">
      <div className="text-sm font-medium text-foreground">文档预览失败</div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        这个文件可能损坏、格式异常，或者当前浏览器环境不支持对应解析器。你仍然可以直接打开它。
      </div>
      {detail ? <div className="mt-2 break-words text-xs leading-5 text-muted-foreground">{detail}</div> : null}
      <div className="mt-4">
        <Button asChild>
          <a href={attachmentUrl || "#"} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            打开文档
          </a>
        </Button>
      </div>
    </div>
  </div>
);

export default PreviewDocumentDialog;
