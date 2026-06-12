const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "tif",
  "tiff",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
  "m4v",
  "wmv",
  "flv",
]);

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "flac",
  "aac",
  "m4a",
  "wma",
]);

export function extensionFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function extensionFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop() ?? path;
  return extensionFromName(name);
}

export function isAssetExtension(ext: string): boolean {
  return (
    IMAGE_EXTENSIONS.has(ext) ||
    VIDEO_EXTENSIONS.has(ext) ||
    AUDIO_EXTENSIONS.has(ext)
  );
}

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext);
}

export function isAudioExtension(ext: string): boolean {
  return AUDIO_EXTENSIONS.has(ext);
}

export function isRenderableInPreview(ext: string): boolean {
  return isAssetExtension(ext);
}

export function isRenderablePath(path: string): boolean {
  return isRenderableInPreview(extensionFromPath(path));
}

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? path;
}

export function isMdxPath(path: string): boolean {
  return extensionFromPath(path) === "mdx";
}

export function isInsertablePath(path: string): boolean {
  if (isMdxPath(path)) return false;
  return fileNameFromPath(path).length > 0;
}

export function isInsertableFileName(name: string): boolean {
  return name.trim().length > 0;
}

export function normalizeAssetPath(src: string): string {
  return src.replace(/^\.\//, "");
}

export function isAttachmentPath(path: string): boolean {
  const normalized = normalizeAssetPath(path);
  if (!normalized.startsWith("asset/")) return false;
  return !isRenderableInPreview(extensionFromPath(normalized));
}

export function isAssetFileName(name: string): boolean {
  return isAssetExtension(extensionFromName(name));
}

export function isAssetPath(path: string): boolean {
  return isAssetExtension(extensionFromPath(path));
}

export function normalizeImageExt(mime: string): string {
  const sub = mime.split("/")[1]?.toLowerCase() ?? "png";
  if (sub === "jpeg") return "jpg";
  if (sub === "svg+xml") return "svg";
  return sub.replace(/[^a-z0-9]/g, "") || "png";
}

export function normalizeClipboardPath(path: string): string {
  return path
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function getFilePath(file: File): string | undefined {
  const path = (file as File & { path?: string }).path;
  return path?.trim() || undefined;
}

export function clipboardHasFiles(data: DataTransfer): boolean {
  if (data.files.length > 0) return true;
  const types = Array.from(data.types);
  return types.includes("Files") || types.includes("application/x-moz-file");
}

/** Avoid loading very large blobs into JS when native path copy is available. */
export const MAX_PASTE_BYTES = 64 * 1024 * 1024;
