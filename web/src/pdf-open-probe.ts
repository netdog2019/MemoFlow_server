import { loadPdfDocumentFromUrl } from "@/utils/pdfjs";

const app = document.querySelector("#app");

const runProbe = async (label: string, url: string) => {
  const startedAt = performance.now();
  const pdf = await loadPdfDocumentFromUrl(url);
  const loadMs = Math.round(performance.now() - startedAt);
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  await pdf.destroy();
  return {
    label,
    loadMs,
    numPages: pdf.numPages,
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
  };
};

const run = async () => {
  if (!app) {
    return;
  }

  const results = await Promise.all([runProbe("text", "/probe-text.pdf"), runProbe("ocr", "/probe-ocr.pdf")]);

  app.textContent = JSON.stringify(results, null, 2);
};

void run().catch((error) => {
  if (app) {
    app.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
});
