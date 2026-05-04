declare module "pdfjs-dist" {
  export interface PdfLoadingTask<TDocument = PdfDocumentProxy> {
    promise: Promise<TDocument>;
    destroy(): Promise<void>;
  }

  export interface PdfGlobalWorkerOptions {
    workerSrc: string;
  }

  export const GlobalWorkerOptions: PdfGlobalWorkerOptions;

  export interface PdfDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
    destroy(): Promise<void>;
  }

  export interface PdfPageViewport {
    width: number;
    height: number;
  }

  export interface PdfRenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  export interface PdfPageProxy {
    getViewport(params: { scale: number }): PdfPageViewport;
    render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfPageViewport }): PdfRenderTask;
  }

  export function getDocument(params: {
    url?: string;
    data?: Uint8Array;
    httpHeaders?: Headers;
    withCredentials?: boolean;
    rangeChunkSize?: number;
    disableAutoFetch?: boolean;
    disableWorker?: boolean;
    disableRange?: boolean;
    disableStream?: boolean;
    isEvalSupported?: boolean;
    isImageDecoderSupported?: boolean;
    isOffscreenCanvasSupported?: boolean;
    useSystemFonts?: boolean;
    useWorkerFetch?: boolean;
    useWasm?: boolean;
    cMapUrl?: string;
    cMapPacked?: boolean;
    iccUrl?: string;
    standardFontDataUrl?: string;
    wasmUrl?: string;
  }): PdfLoadingTask;
}

declare module "pdfjs-dist/build/pdf.mjs" {
  export * from "pdfjs-dist";
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist";
}

declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}
