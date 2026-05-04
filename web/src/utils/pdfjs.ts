import type { PdfDocumentProxy } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { getAccessToken } from "@/auth-state";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PreparedPdfRuntime = {
  workerStatus: string;
  pdfjs: PdfJsModule;
};
type PdfDocumentLoadResult = {
  source: "url" | "data";
  document: PdfDocumentProxy;
};

let pdfJsPromise: Promise<PdfJsModule> | undefined;
let pdfWorkerCheckPromise: Promise<string> | undefined;
const pdfDataPromiseCache = new Map<string, Promise<Uint8Array>>();
const PDF_DATA_FALLBACK_DELAY_MS = 5000;

const formatPdfError = (label: string, error: unknown): string => {
  if (error instanceof Error) {
    return `${label}: ${error.name}: ${error.message}`;
  }
  return `${label}: ${String(error)}`;
};

export const getPdfWorkerSrc = (): string => pdfWorkerSrc;

const PDFJS_RESOURCE_BASE_URL = "/pdfjs";
const getPdfResourceUrl = (directoryName: "cmaps" | "iccs" | "standard_fonts" | "wasm"): string =>
  `${PDFJS_RESOURCE_BASE_URL}/${directoryName}/`;

const getPdfDocumentOptions = () => ({
  cMapUrl: getPdfResourceUrl("cmaps"),
  cMapPacked: true,
  iccUrl: getPdfResourceUrl("iccs"),
  standardFontDataUrl: getPdfResourceUrl("standard_fonts"),
  wasmUrl: getPdfResourceUrl("wasm"),
  useWorkerFetch: true,
  useWasm: true,
  isEvalSupported: false,
  // ImageDecoder/OffscreenCanvas acceleration is unreliable for scanned/image-heavy PDFs in Chrome-like environments.
  isImageDecoderSupported: false,
  isOffscreenCanvasSupported: false,
  useSystemFonts: true,
});

const getPdfRequestHeaders = (): Headers | undefined => {
  const token = getAccessToken();
  if (!token) {
    return undefined;
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

export const checkPdfWorker = async (): Promise<string> => {
  pdfWorkerCheckPromise ??= fetch(pdfWorkerSrc, {
    cache: "no-store",
    credentials: "same-origin",
  }).then(async (response) => {
    const contentType = response.headers.get("content-type") || "unknown content type";
    if (!response.ok) {
      throw new Error(
        `PDF.js worker failed to load: ${response.status} ${response.statusText}; url=${pdfWorkerSrc}; content-type=${contentType}`,
      );
    }

    return `PDF.js worker OK: ${response.status}; url=${pdfWorkerSrc}; content-type=${contentType}`;
  });

  return pdfWorkerCheckPromise;
};

export const loadPdfJs = async (): Promise<PdfJsModule> => {
  pdfJsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    return pdfjs;
  });
  return pdfJsPromise;
};

const preparePdfRuntime = async (): Promise<PreparedPdfRuntime> => {
  const [workerStatus, pdfjs] = await Promise.all([
    checkPdfWorker().catch((error: unknown) => {
      throw new Error(formatPdfError("PDF.js worker self-check failed", error));
    }),
    loadPdfJs().catch((error: unknown) => {
      throw new Error(formatPdfError("PDF.js module import failed", error));
    }),
  ]);

  return {
    workerStatus,
    pdfjs,
  };
};

const fetchPdfDataUncached = async (sourceUrl: string, signal?: AbortSignal): Promise<Uint8Array> => {
  const response = await fetch(sourceUrl, {
    credentials: "include",
    headers: getPdfRequestHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }

  const pdfData = new Uint8Array(await response.arrayBuffer());
  const headerScanLimit = Math.min(pdfData.length - 3, 1024);
  let looksLikePdf = false;
  for (let index = 0; index < headerScanLimit; index++) {
    if (pdfData[index] === 0x25 && pdfData[index + 1] === 0x50 && pdfData[index + 2] === 0x44 && pdfData[index + 3] === 0x46) {
      looksLikePdf = true;
      break;
    }
  }
  if (!looksLikePdf) {
    throw new Error(`Fetched file is not a PDF: ${response.headers.get("content-type") || "unknown content type"}`);
  }

  return pdfData;
};

export const fetchPdfData = async (sourceUrl: string, signal?: AbortSignal): Promise<Uint8Array> => {
  if (signal) {
    return fetchPdfDataUncached(sourceUrl, signal);
  }

  const cachedPromise = pdfDataPromiseCache.get(sourceUrl);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = fetchPdfDataUncached(sourceUrl).catch((error: unknown) => {
    pdfDataPromiseCache.delete(sourceUrl);
    throw error;
  });

  pdfDataPromiseCache.set(sourceUrl, nextPromise);
  return nextPromise;
};

export const loadPdfDocumentFromUrl = async (sourceUrl: string): Promise<PdfDocumentProxy> => {
  const runtimePromise = preparePdfRuntime();
  const { pdfjs } = await runtimePromise;
  const fallbackAbortController = new AbortController();
  let fallbackTimeoutId: number | undefined;
  const urlLoadingTask = pdfjs.getDocument({
    ...getPdfDocumentOptions(),
    url: sourceUrl,
    httpHeaders: getPdfRequestHeaders(),
    withCredentials: true,
    rangeChunkSize: 256 * 1024,
  });

  const loadDataFallback = async (triggerError: unknown): Promise<PdfDocumentProxy> => {
    const pdfData = await fetchPdfData(sourceUrl, fallbackAbortController.signal).catch((error: unknown) => {
      throw new Error(`${formatPdfError("PDF URL document load failed", triggerError)}; ${formatPdfError("PDF fetch failed", error)}`);
    });

    return loadPdfDocument(pdfData, runtimePromise).catch((error: unknown) => {
      throw new Error(
        `${formatPdfError("PDF URL document load failed", triggerError)}; ${formatPdfError("PDF.js data document load failed", error)}`,
      );
    });
  };

  const urlDocument = urlLoadingTask.promise.then((document) => ({
    source: "url" as const,
    document,
  }));
  const delayedDataFallback = new Promise<PdfDocumentLoadResult>((resolve, reject) => {
    fallbackTimeoutId = window.setTimeout(() => {
      fallbackTimeoutId = undefined;
      void loadDataFallback(new Error(`PDF URL document load still pending after ${PDF_DATA_FALLBACK_DELAY_MS}ms`)).then(
        (document) => resolve({ source: "data", document }),
        reject,
      );
    }, PDF_DATA_FALLBACK_DELAY_MS);
  });
  void delayedDataFallback.catch(() => {
    // The fallback can reject after the URL document has already won the race.
  });

  try {
    const result = await Promise.race([urlDocument, delayedDataFallback]);
    if (result.source === "url") {
      fallbackAbortController.abort();
    } else {
      void urlLoadingTask.destroy().catch(() => {
        // Ignore destroy failures after data fallback wins.
      });
    }
    return result.document;
  } catch (loadError) {
    if (fallbackTimeoutId !== undefined) {
      window.clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = undefined;
    }
    void urlLoadingTask.destroy().catch(() => {
      // Ignore destroy failures during fallback.
    });

    return loadDataFallback(loadError);
  } finally {
    if (fallbackTimeoutId !== undefined) {
      window.clearTimeout(fallbackTimeoutId);
    }
  }
};

export const loadPdfDocument = async (
  pdfData: Uint8Array,
  preparedRuntime?: PreparedPdfRuntime | Promise<PreparedPdfRuntime>,
): Promise<PdfDocumentProxy> => {
  const { workerStatus, pdfjs } = await (preparedRuntime ?? preparePdfRuntime());
  const loadingTask = pdfjs.getDocument({
    ...getPdfDocumentOptions(),
    data: pdfData.slice(),
  });

  return loadingTask.promise.catch((error: unknown) => {
    throw new Error(`${formatPdfError("PDF.js document load failed", error)}; ${workerStatus}`);
  });
};
