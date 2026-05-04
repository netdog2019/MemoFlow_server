import { fetchPdfData, loadPdfDocument } from "@/utils/pdfjs";

const PDF_THUMBNAIL_CACHE_VERSION = "v2";
const THUMBNAIL_RENDER_WIDTH = 320;
const THUMBNAIL_OUTPUT_SIZE = 320;
const THUMBNAIL_TOP_FOCUS_BIAS = 0.18;

const pdfThumbnailCache = new Map<string, string>();
const pdfThumbnailPromiseCache = new Map<string, Promise<string>>();

const isPersistableSourceUrl = (url: string): boolean => !url.startsWith("blob:") && !url.startsWith("data:");
const getPdfThumbnailStorageKey = (sourceUrl: string): string =>
  `pdf-thumbnail:${PDF_THUMBNAIL_CACHE_VERSION}:${encodeURIComponent(sourceUrl)}`;

const getStoredPdfThumbnail = (sourceUrl: string): string | undefined => {
  if (!isPersistableSourceUrl(sourceUrl)) {
    return undefined;
  }

  try {
    return sessionStorage.getItem(getPdfThumbnailStorageKey(sourceUrl)) ?? undefined;
  } catch {
    return undefined;
  }
};

const storePdfThumbnail = (sourceUrl: string, thumbnailSrc: string) => {
  if (!isPersistableSourceUrl(sourceUrl)) {
    return;
  }

  try {
    sessionStorage.setItem(getPdfThumbnailStorageKey(sourceUrl), thumbnailSrc);
  } catch {
    // Ignore storage quota and availability errors.
  }
};

const buildSquareThumbnailCanvas = (pageCanvas: HTMLCanvasElement): HTMLCanvasElement => {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = THUMBNAIL_OUTPUT_SIZE;
  outputCanvas.height = THUMBNAIL_OUTPUT_SIZE;

  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("Failed to create PDF thumbnail canvas");
  }

  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, THUMBNAIL_OUTPUT_SIZE, THUMBNAIL_OUTPUT_SIZE);

  const scaleToCover = Math.max(THUMBNAIL_OUTPUT_SIZE / pageCanvas.width, THUMBNAIL_OUTPUT_SIZE / pageCanvas.height);
  const drawWidth = pageCanvas.width * scaleToCover;
  const drawHeight = pageCanvas.height * scaleToCover;
  const offsetX = (THUMBNAIL_OUTPUT_SIZE - drawWidth) / 2;
  const overflowY = Math.max(drawHeight - THUMBNAIL_OUTPUT_SIZE, 0);
  const offsetY = -overflowY * THUMBNAIL_TOP_FOCUS_BIAS;

  outputContext.drawImage(pageCanvas, offsetX, offsetY, drawWidth, drawHeight);
  return outputCanvas;
};

const renderPdfFirstPageThumbnail = async (sourceUrl: string): Promise<string> => {
  const pdfData = await fetchPdfData(sourceUrl);
  const pdf = await loadPdfDocument(pdfData);

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_RENDER_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create PDF thumbnail canvas");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const thumbnailCanvas = buildSquareThumbnailCanvas(canvas);
    return thumbnailCanvas.toDataURL("image/jpeg", 0.88);
  } finally {
    await pdf.destroy();
  }
};

export const getCachedPdfThumbnail = async (sourceUrl: string): Promise<string> => {
  const memoryCachedThumbnail = pdfThumbnailCache.get(sourceUrl);
  if (memoryCachedThumbnail) {
    return memoryCachedThumbnail;
  }

  const storedThumbnail = getStoredPdfThumbnail(sourceUrl);
  if (storedThumbnail) {
    pdfThumbnailCache.set(sourceUrl, storedThumbnail);
    return storedThumbnail;
  }

  const cachedPromise = pdfThumbnailPromiseCache.get(sourceUrl);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = renderPdfFirstPageThumbnail(sourceUrl)
    .then((thumbnailSrc) => {
      pdfThumbnailCache.set(sourceUrl, thumbnailSrc);
      storePdfThumbnail(sourceUrl, thumbnailSrc);
      pdfThumbnailPromiseCache.delete(sourceUrl);
      return thumbnailSrc;
    })
    .catch((error) => {
      pdfThumbnailPromiseCache.delete(sourceUrl);
      throw error;
    });

  pdfThumbnailPromiseCache.set(sourceUrl, nextPromise);
  return nextPromise;
};

export const prewarmPdfThumbnail = (sourceUrl: string): void => {
  void getCachedPdfThumbnail(sourceUrl).catch((error) => {
    console.warn("Failed to prewarm PDF thumbnail:", error);
  });
};
