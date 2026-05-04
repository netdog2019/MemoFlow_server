import { toJpeg } from "html-to-image";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { fetchPdfData, loadPdfDocument } from "@/utils/pdfjs";
import { type DocumentPreviewMode, getDocumentPreviewMode, getFilenameExtension } from "./document-preview";

const DOCUMENT_THUMBNAIL_CACHE_VERSION = "v1";
const THUMBNAIL_RENDER_WIDTH = 320;
const THUMBNAIL_OUTPUT_SIZE = 320;
const THUMBNAIL_TOP_FOCUS_BIAS = 0.18;
const DOM_THUMBNAIL_WIDTH = 640;
const DOM_THUMBNAIL_HEIGHT = 820;

const thumbnailCache = new Map<string, string>();
const thumbnailPromiseCache = new Map<string, Promise<string>>();

const isPersistableSourceUrl = (url: string): boolean => !url.startsWith("blob:") && !url.startsWith("data:");
const getThumbnailStorageKey = (sourceUrl: string, filename: string, mimeType?: string): string =>
  `document-thumbnail:${DOCUMENT_THUMBNAIL_CACHE_VERSION}:${encodeURIComponent(sourceUrl)}:${encodeURIComponent(filename)}:${encodeURIComponent(
    mimeType ?? "",
  )}`;

const getCacheKey = (sourceUrl: string, filename: string, mimeType?: string): string => `${sourceUrl}\n${filename}\n${mimeType ?? ""}`;

const getStoredThumbnail = (sourceUrl: string, filename: string, mimeType?: string): string | undefined => {
  if (!isPersistableSourceUrl(sourceUrl)) {
    return undefined;
  }

  try {
    return sessionStorage.getItem(getThumbnailStorageKey(sourceUrl, filename, mimeType)) ?? undefined;
  } catch {
    return undefined;
  }
};

const storeThumbnail = (sourceUrl: string, filename: string, thumbnailSrc: string, mimeType?: string) => {
  if (!isPersistableSourceUrl(sourceUrl)) {
    return;
  }

  try {
    sessionStorage.setItem(getThumbnailStorageKey(sourceUrl, filename, mimeType), thumbnailSrc);
  } catch {
    // Ignore storage quota and availability errors.
  }
};

const buildSquareThumbnailCanvas = (contentCanvas: HTMLCanvasElement): HTMLCanvasElement => {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = THUMBNAIL_OUTPUT_SIZE;
  outputCanvas.height = THUMBNAIL_OUTPUT_SIZE;

  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("Failed to create document thumbnail canvas");
  }

  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, THUMBNAIL_OUTPUT_SIZE, THUMBNAIL_OUTPUT_SIZE);

  const scaleToCover = Math.max(THUMBNAIL_OUTPUT_SIZE / contentCanvas.width, THUMBNAIL_OUTPUT_SIZE / contentCanvas.height);
  const drawWidth = contentCanvas.width * scaleToCover;
  const drawHeight = contentCanvas.height * scaleToCover;
  const offsetX = (THUMBNAIL_OUTPUT_SIZE - drawWidth) / 2;
  const overflowY = Math.max(drawHeight - THUMBNAIL_OUTPUT_SIZE, 0);
  const offsetY = -overflowY * THUMBNAIL_TOP_FOCUS_BIAS;

  outputContext.drawImage(contentCanvas, offsetX, offsetY, drawWidth, drawHeight);
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

const appendHiddenThumbnailHost = (): HTMLDivElement => {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${DOM_THUMBNAIL_WIDTH}px`;
  host.style.height = `${DOM_THUMBNAIL_HEIGHT}px`;
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  document.body.appendChild(host);
  return host;
};

const createDocumentShell = (label: string, filename: string): HTMLDivElement => {
  const shell = document.createElement("div");
  shell.style.width = `${DOM_THUMBNAIL_WIDTH}px`;
  shell.style.minHeight = `${DOM_THUMBNAIL_HEIGHT}px`;
  shell.style.boxSizing = "border-box";
  shell.style.background = "#ffffff";
  shell.style.color = "#1f2937";
  shell.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  shell.style.padding = "46px 50px";
  shell.style.lineHeight = "1.55";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "12px";
  header.style.marginBottom = "28px";
  header.style.paddingBottom = "18px";
  header.style.borderBottom = "2px solid #e5e7eb";

  const badge = document.createElement("div");
  badge.textContent = label;
  badge.style.flex = "0 0 auto";
  badge.style.borderRadius = "999px";
  badge.style.background = "#111827";
  badge.style.color = "#ffffff";
  badge.style.fontSize = "18px";
  badge.style.fontWeight = "700";
  badge.style.letterSpacing = "0";
  badge.style.padding = "5px 12px";

  const title = document.createElement("div");
  title.textContent = filename;
  title.style.minWidth = "0";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  title.style.whiteSpace = "nowrap";
  title.style.fontSize = "24px";
  title.style.fontWeight = "700";
  title.style.color = "#111827";

  header.append(badge, title);
  shell.append(header);
  return shell;
};

const renderElementThumbnail = async (element: HTMLElement): Promise<string> => {
  const host = appendHiddenThumbnailHost();
  host.appendChild(element);

  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    return await toJpeg(element, {
      backgroundColor: "#ffffff",
      cacheBust: false,
      quality: 0.86,
      pixelRatio: 1,
      width: DOM_THUMBNAIL_WIDTH,
      height: DOM_THUMBNAIL_HEIGHT,
      canvasWidth: THUMBNAIL_OUTPUT_SIZE,
      canvasHeight: THUMBNAIL_OUTPUT_SIZE,
      style: {
        transform: `scale(${THUMBNAIL_OUTPUT_SIZE / DOM_THUMBNAIL_WIDTH})`,
        transformOrigin: "top left",
      },
    });
  } finally {
    host.remove();
  }
};

const renderWordThumbnail = async (sourceUrl: string, filename: string): Promise<string> => {
  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }

  const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
  const shell = createDocumentShell("DOCX", filename);
  const content = document.createElement("div");
  content.innerHTML = result.value;
  content.style.fontSize = "25px";
  content.style.overflow = "hidden";
  content.style.maxHeight = "660px";
  content.querySelectorAll("img").forEach((image) => {
    image.style.maxWidth = "100%";
    image.style.height = "auto";
  });
  shell.appendChild(content);
  return renderElementThumbnail(shell);
};

const renderSheetThumbnail = async (sourceUrl: string, filename: string): Promise<string> => {
  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
  }

  const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const rows = firstSheetName
    ? (XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      }) as string[][])
    : [];

  const shell = createDocumentShell(getFilenameExtension(filename).toUpperCase() || "XLS", filename);
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.tableLayout = "fixed";
  table.style.fontSize = "20px";

  rows.slice(0, 14).forEach((row) => {
    const tr = document.createElement("tr");
    row.slice(0, 5).forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = String(cell ?? "");
      td.style.border = "1px solid #d1d5db";
      td.style.padding = "9px 10px";
      td.style.overflow = "hidden";
      td.style.textOverflow = "ellipsis";
      td.style.whiteSpace = "nowrap";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  shell.appendChild(table);
  return renderElementThumbnail(shell);
};

const renderTextThumbnail = async (sourceUrl: string, filename: string): Promise<string> => {
  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch text document: ${response.status}`);
  }

  const shell = createDocumentShell(getFilenameExtension(filename).toUpperCase() || "TXT", filename);
  const pre = document.createElement("pre");
  pre.textContent = (await response.text()).slice(0, 3200);
  pre.style.margin = "0";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.overflow = "hidden";
  pre.style.maxHeight = "660px";
  pre.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  pre.style.fontSize = "22px";
  pre.style.lineHeight = "1.45";
  pre.style.color = "#111827";
  shell.appendChild(pre);
  return renderElementThumbnail(shell);
};

const renderDocumentThumbnail = async (sourceUrl: string, filename: string, mimeType?: string): Promise<string> => {
  const mode = getDocumentPreviewMode({ mimeType, filename });
  if (mode === "pdf") {
    return renderPdfFirstPageThumbnail(sourceUrl);
  }
  if (mode === "word") {
    return renderWordThumbnail(sourceUrl, filename);
  }
  if (mode === "sheet") {
    return renderSheetThumbnail(sourceUrl, filename);
  }
  if (mode === "text") {
    return renderTextThumbnail(sourceUrl, filename);
  }
  throw new Error(`Unsupported document thumbnail mode: ${mode satisfies DocumentPreviewMode}`);
};

export const getCachedDocumentThumbnail = async ({
  sourceUrl,
  filename,
  mimeType,
}: {
  sourceUrl: string;
  filename: string;
  mimeType?: string;
}): Promise<string> => {
  const cacheKey = getCacheKey(sourceUrl, filename, mimeType);
  const memoryCachedThumbnail = thumbnailCache.get(cacheKey);
  if (memoryCachedThumbnail) {
    return memoryCachedThumbnail;
  }

  const storedThumbnail = getStoredThumbnail(sourceUrl, filename, mimeType);
  if (storedThumbnail) {
    thumbnailCache.set(cacheKey, storedThumbnail);
    return storedThumbnail;
  }

  const cachedPromise = thumbnailPromiseCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = renderDocumentThumbnail(sourceUrl, filename, mimeType)
    .then((thumbnailSrc) => {
      thumbnailCache.set(cacheKey, thumbnailSrc);
      storeThumbnail(sourceUrl, filename, thumbnailSrc, mimeType);
      thumbnailPromiseCache.delete(cacheKey);
      return thumbnailSrc;
    })
    .catch((error) => {
      thumbnailPromiseCache.delete(cacheKey);
      throw error;
    });

  thumbnailPromiseCache.set(cacheKey, nextPromise);
  return nextPromise;
};

export const prewarmDocumentThumbnail = (input: { sourceUrl: string; filename: string; mimeType?: string }): void => {
  void getCachedDocumentThumbnail(input).catch((error) => {
    console.warn("Failed to prewarm document thumbnail:", error);
  });
};
