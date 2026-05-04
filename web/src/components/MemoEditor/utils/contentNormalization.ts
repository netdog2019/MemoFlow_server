function decodeHtmlEntitiesOnce(value: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

export function normalizeEditorContent(content: string): string {
  let normalized = content.replace(/\r\n?/g, "\n");

  for (let i = 0; i < 5; i += 1) {
    const decoded = decodeHtmlEntitiesOnce(normalized);
    if (decoded === normalized) {
      break;
    }
    normalized = decoded;
  }

  return normalized;
}
