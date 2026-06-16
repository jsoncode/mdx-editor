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

/** 与 Rust `is_blocked_non_media_ext` 保持一致 */
const BLOCKED_NON_MEDIA_EXTENSIONS = new Set([
  "md",
  "mdx",
  "txt",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
  "exe",
  "dll",
  "html",
  "htm",
  "css",
  "js",
  "json",
  "xml",
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
  "m2ts",
  "mts",
  "vob",
  "rmvb",
  "ogv",
  "asf",
  "divx",
]);

const AUDIO_EXTENSIONS = new Set([
  // 常见有损
  "mp3",
  "aac",
  "m4a",
  "wma",
  "ogg",
  "oga",
  "opus",
  "weba",
  "amr",
  "3ga",
  "ra",
  // 常见无损 / PCM
  "wav",
  "flac",
  "aiff",
  "aif",
  "alac",
  "caf",
  "au",
  "snd",
  "voc",
  // DSD / 高解析
  "dsf",
  "dff",
  // 其他无损压缩
  "ape",
  "mac",
  "tta",
  "wv",
  "tak",
  "ofr",
  "ofs",
  "shn",
  "mpc",
  "mpp",
  // 环绕声 / 纯音频轨
  "ac3",
  "eac3",
  "dts",
  "dtshd",
  "spx",
]);

/** 文件选择器「无损与高解析」分组（均为 AUDIO_EXTENSIONS 子集） */
export const LOSSLESS_AUDIO_INSERT_EXTENSIONS = [
  "dsf",
  "dff",
  "flac",
  "ape",
  "tta",
  "wv",
  "alac",
  "tak",
  "ofr",
  "ofs",
  "shn",
  "mpc",
  "aiff",
  "aif",
  "wav",
  "ac3",
  "eac3",
  "dts",
  "dtshd",
  "caf",
];

const COMMON_AUDIO_INSERT_EXTENSIONS = [
  "mp3",
  "wav",
  "flac",
  "aac",
  "m4a",
  "ogg",
  "oga",
  "opus",
  "wma",
  "amr",
  "weba",
];

export const AUDIO_INSERT_EXTENSIONS = [...AUDIO_EXTENSIONS];

export const VIDEO_INSERT_EXTENSIONS = [...VIDEO_EXTENSIONS];

const COMMON_MEDIA_EXTENSIONS = [
  ...new Set([...VIDEO_INSERT_EXTENSIONS, ...AUDIO_INSERT_EXTENSIONS]),
];

export const MEDIA_INSERT_OPEN_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "常见音视频", extensions: COMMON_MEDIA_EXTENSIONS },
  { name: "所有文件", extensions: ["*"] },
];

export const VIDEO_INSERT_OPEN_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "常见视频", extensions: VIDEO_INSERT_EXTENSIONS },
  { name: "所有文件", extensions: ["*"] },
];

export const AUDIO_INSERT_OPEN_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "常见音频", extensions: COMMON_AUDIO_INSERT_EXTENSIONS },
  { name: "无损与高解析", extensions: LOSSLESS_AUDIO_INSERT_EXTENSIONS },
  { name: "所有文件", extensions: ["*"] },
];

export const IMAGE_INSERT_EXTENSIONS = [...IMAGE_EXTENSIONS];

export const IMAGE_INSERT_OPEN_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "常见图片", extensions: IMAGE_INSERT_EXTENSIONS },
  { name: "所有文件", extensions: ["*"] },
];

export const ATTACHMENT_INSERT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
  "txt",
];

export const ATTACHMENT_INSERT_OPEN_FILTERS: { name: string; extensions: string[] }[] = [
  { name: "常见附件", extensions: ATTACHMENT_INSERT_EXTENSIONS },
  { name: "所有文件", extensions: ["*"] },
];

export function extensionFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function extensionFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  let name = normalized.split("/").pop() ?? path;
  const query = name.indexOf("?");
  if (query !== -1) name = name.slice(0, query);
  const hash = name.indexOf("#");
  if (hash !== -1) name = name.slice(0, hash);
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

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext);
}

export function isBlockedNonMediaExtension(ext: string): boolean {
  return BLOCKED_NON_MEDIA_EXTENSIONS.has(ext);
}

/** 浏览器 / WebView 可直接播放，无需 FFmpeg 转码 */
export function isDirectPlayable(ext: string): boolean {
  return (
    ext === "mp3" ||
    ext === "wav" ||
    ext === "ogg" ||
    ext === "oga" ||
    ext === "opus" ||
    ext === "weba" ||
    ext === "mp4" ||
    ext === "webm" ||
    ext === "m4a" ||
    ext === "flac" ||
    ext === "aac"
  );
}

export function needsMediaTranscode(path: string): boolean {
  const ext = extensionFromPath(path);
  if (isDirectPlayable(ext) || isImageExtension(ext) || isBlockedNonMediaExtension(ext)) {
    return false;
  }
  return true;
}

/** 转码后的目标扩展名（与 Rust 端一致） */
export function transcodeTargetExtension(path: string): string {
  const ext = extensionFromPath(path);
  if (isVideoExtension(ext)) return "mp4";
  if (isAudioExtension(ext)) return "m4a";
  // 未列入清单的容器/编码，与 Rust 端一致默认转为 MP4
  return "mp4";
}

/** 如 WMA → M4A，用于转码进度展示 */
export function describeTranscodeFormats(path: string): string {
  const source = extensionFromPath(path);
  if (!source) return "";
  const target = transcodeTargetExtension(path);
  if (source === target) return source.toUpperCase();
  return `${source.toUpperCase()} → ${target.toUpperCase()}`;
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

/** 超过此大小的转码插入需用户确认 */
export const TRANSCODE_SIZE_CONFIRM_BYTES = 100 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
