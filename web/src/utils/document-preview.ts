export type DocumentPreviewMode = "pdf" | "word" | "sheet" | "text" | "fallback";

const PDF_TYPES = new Set(["application/pdf"]);
const WORD_TYPES = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const SPREADSHEET_TYPES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
]);
const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/x-yaml",
  "text/yaml",
]);

const PDF_EXTENSIONS = new Set(["pdf"]);
const WORD_EXTENSIONS = new Set(["docx"]);
const SPREADSHEET_EXTENSIONS = new Set(["csv", "tsv", "xls", "xlsx", "xlsm", "xlsb", "ods"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "yaml",
  "yml",
  "log",
  "sql",
  "go",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
]);

export const normalizeMimeType = (mimeType?: string): string => (mimeType ?? "").toLowerCase().split(";")[0].trim();

export const getFilenameExtension = (filename?: string): string => {
  const normalizedFilename = (filename ?? "").toLowerCase().split(/[?#]/, 1)[0].trim();
  const lastDotIndex = normalizedFilename.lastIndexOf(".");
  if (lastDotIndex < 0 || lastDotIndex === normalizedFilename.length - 1) {
    return "";
  }
  return normalizedFilename.slice(lastDotIndex + 1);
};

export const getDocumentPreviewMode = ({ mimeType, filename }: { mimeType?: string; filename?: string }): DocumentPreviewMode => {
  const normalized = normalizeMimeType(mimeType);
  const extension = getFilenameExtension(filename);

  if (PDF_TYPES.has(normalized) || PDF_EXTENSIONS.has(extension)) {
    return "pdf";
  }
  if (WORD_TYPES.has(normalized) || WORD_EXTENSIONS.has(extension)) {
    return "word";
  }
  if (SPREADSHEET_TYPES.has(normalized) || SPREADSHEET_EXTENSIONS.has(extension)) {
    return "sheet";
  }
  if (TEXT_TYPES.has(normalized) || TEXT_EXTENSIONS.has(extension) || normalized.startsWith("text/")) {
    return "text";
  }
  return "fallback";
};

export const isPdfDocument = (input: { mimeType?: string; filename?: string }): boolean => getDocumentPreviewMode(input) === "pdf";
