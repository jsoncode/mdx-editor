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
  "mpg",
  "mpeg",
  "3gp",
  "ts",
]);

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "flac",
  "aac",
  "m4a",
  "weba",
  "aiff",
  "aif",
  "wma",
]);

export const AUDIO_INSERT_EXTENSIONS = [...AUDIO_EXTENSIONS];

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

export function audioMimeType(ext: string): string | undefined {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    case "m4a":
      return "audio/mp4";
    case "weba":
      return "audio/webm";
    case "aiff":
    case "aif":
      return "audio/aiff";
    default:
      return undefined;
  }
}

/** 部分浏览器对 flac/ogg 识别更稳的备用 MIME */
export function audioMimeFallbacks(ext: string): string[] {
  const primary = audioMimeType(ext);
  const types = primary ? [primary] : [];
  if (ext === "flac") types.push("audio/x-flac");
  if (ext === "ogg" || ext === "oga") types.push("application/ogg");
  return types;
}

export function videoMimeType(ext: string): string | undefined {
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "mkv":
      return "video/x-matroska";
    case "wmv":
      return "video/x-ms-wmv";
    case "flv":
      return "video/x-flv";
    default:
      return undefined;
  }
}

export function isRenderableInPreview(ext: string): boolean {
  return (
    IMAGE_EXTENSIONS.has(ext) ||
    VIDEO_EXTENSIONS.has(ext) ||
    AUDIO_EXTENSIONS.has(ext)
  );
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

export function isPlainMdPath(path: string): boolean {
  return extensionFromPath(path) === "md";
}

export function isMarkdownDocumentPath(path: string): boolean {
  const ext = extensionFromPath(path);
  return ext === "md" || ext === "mdx";
}

export function isInsertablePath(path: string): boolean {
  if (isMarkdownDocumentPath(path)) return false;
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
