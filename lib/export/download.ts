/** Hand a file to the browser.
 *
 * The object URL is revoked immediately after the synthetic click: the click
 * has already handed the blob to the download manager by the time this
 * returns, and leaving the URL alive pins the blob in memory for the life of
 * the document. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A filename that survives Windows, macOS and a shared drive. */
export function safeFilename(name: string, extension: string): string {
  const base =
    name
      .trim()
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "ductforge-takeoff";
  return `${base}.${extension}`;
}
