import {
  extensionFromPath,
  isAssetExtension,
  isAttachmentPath,
  isAudioExtension,
  isImageExtension,
  isRenderableInPreview,
  isVideoExtension,
} from "./media";
import { isMarkdownDocumentPath } from "./documentPaths";

export type ContentFormat = "markdown" | "html" | "text";

export type VaultFileCategory =
  | "document"
  | "html"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "attachment"
  | "other";

const EDITABLE_TEXT_EXTENSIONS = new Set([
  "txt", "text", "log", "json", "xml", "csv", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "env", "css", "scss", "less", "js", "jsx", "ts", "tsx", "mjs", "cjs", "html", "htm", "svg",
  "rs", "py", "go", "java", "c", "cpp", "h", "hpp", "cs", "kt", "swift", "rb", "php", "lua",
  "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql", "graphql", "vue", "svelte", "r", "dart",
  "md", "mdx",
]);

export function isEditableTextExtension(ext: string): boolean {
  return EDITABLE_TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export function isEditableTextPath(path: string): boolean {
  return isEditableTextExtension(extensionFromPath(path));
}

export function isEditableInEditor(path: string): boolean {
  return isEditableTextPath(path);
}

export function isPlainHtmlPath(path: string): boolean {
  const ext = extensionFromPath(path);
  return ext === "html" || ext === "htm";
}

export function isFullHtmlDocument(content: string): boolean {
  const trimmed = content.trimStart();
  const sample = trimmed.slice(0, 1024).toLowerCase();
  return sample.startsWith("<!doctype html") || sample.includes("<html");
}

export function contentFormatFromPath(path: string | null, content: string): ContentFormat {
  if (!path) return "markdown";
  const ext = extensionFromPath(path);
  if (ext === "md" || ext === "mdx") return "markdown";
  if ((ext === "html" || ext === "htm") && isFullHtmlDocument(content)) return "html";
  return "text";
}

export function normalizeContentFormat(value?: string | null): ContentFormat {
  if (value === "html" || value === "text") return value;
  return "markdown";
}

export function getVaultFileCategory(path: string, extension?: string): VaultFileCategory {
  const ext = (extension ?? extensionFromPath(path)).toLowerCase();
  if (ext === "md" || ext === "mdx") return "document";
  if (ext === "html" || ext === "htm") return "html";
  if (isEditableTextExtension(ext) && !isMarkdownDocumentPath(path)) return "text";
  if (isImageExtension(ext)) return "image";
  if (isVideoExtension(ext)) return "video";
  if (isAudioExtension(ext)) return "audio";
  if (isAssetExtension(ext) || isAttachmentPath(`asset/file.${ext}`)) return "attachment";
  return "other";
}

export function isVaultFileEditable(category: VaultFileCategory): boolean {
  return category === "document" || category === "html" || category === "text";
}

export function vaultFileCategoryLabel(category: VaultFileCategory): string {
  switch (category) {
    case "document":
      return "Markdown / MDX 文档";
    case "html":
      return "HTML 文档";
    case "text":
      return "文本文件";
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "音频";
    case "attachment":
      return "附件";
    default:
      return "其他文件";
  }
}

export type EditorMode = "markdown" | "html" | "text";

export function editorModeForContent(
  contentFormat: ContentFormat,
  filePath: string | null,
): EditorMode {
  if (contentFormat === "html") return "html";
  if (contentFormat === "markdown") return "markdown";
  if (filePath && isPlainHtmlPath(filePath)) return "html";
  return "text";
}

export function isPreviewRenderablePath(path: string): boolean {
  return isRenderableInPreview(extensionFromPath(path));
}
