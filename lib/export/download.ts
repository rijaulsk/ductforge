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

/**
 * A filename that survives Windows, macOS and a shared drive — and that still
 * says what it is a week later, sitting in a Downloads folder among exports
 * from four other apps.
 *
 * `ductforge-<project>-<what>-<yyyy-mm-dd>.<ext>`. The prefix is the brand, the
 * middle is the job, and the date is what makes two exports of the same job on
 * different days sort next to each other instead of colliding into
 * "Office Tower (2).csv".
 */
export function safeFilename(name: string, extension: string, what = "takeoff"): string {
  const base = name
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48)
    .replace(/-$/, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${["ductforge", base, what, date].filter(Boolean).join("-")}.${extension}`;
}
