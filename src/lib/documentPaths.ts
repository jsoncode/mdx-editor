import { extensionFromPath } from "./media";
import { isEditableTextExtension } from "./fileTypes";

export function isPlainMdPath(path: string): boolean {
  return extensionFromPath(path) === "md";
}

export function isPlainHtmlPath(path: string): boolean {
  const ext = extensionFromPath(path);
  return ext === "html" || ext === "htm";
}

export function isDirectSavePath(path: string): boolean {
  return extensionFromPath(path) !== "mdx";
}

export function isMdxDocumentPath(path: string): boolean {
  return extensionFromPath(path) === "mdx";
}

export function isMarkdownDocumentPath(path: string): boolean {
  const ext = extensionFromPath(path);
  return ext === "md" || ext === "mdx";
}

export function isEditableDocumentPath(path: string): boolean {
  return isEditableTextExtension(extensionFromPath(path));
}

export function defaultSavePath(basePath: string | null | undefined, extension: "md" | "mdx"): string {
  if (!basePath) return extension === "mdx" ? "未命名文档.mdx" : "未命名文档.md";
  const normalized = basePath.replace(/\\/g, "/");
  const name = normalized.split("/").pop() ?? basePath;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${extension}`;
}

export function mdPathToMdxPath(mdPath: string): string {
  return mdPath.replace(/\.md$/i, ".mdx");
}

export function htmlPathToMdxPath(htmlPath: string): string {
  return htmlPath.replace(/\.html?$/i, ".mdx");
}

export const TEXT_FILE_OPEN_EXTENSIONS = [
  "txt", "text", "log", "json", "xml", "csv", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "env", "css", "scss", "less", "js", "jsx", "ts", "tsx", "mjs", "cjs", "html", "htm", "svg",
  "rs", "py", "go", "java", "c", "cpp", "h", "hpp", "cs", "kt", "swift", "rb", "php", "lua",
  "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql", "graphql", "vue", "svelte", "r", "dart",
];

export const MARKDOWN_DOCUMENT_OPEN_FILTERS = [
  { name: "Markdown / MDX", extensions: ["md", "mdx"] },
  { name: "HTML 文档", extensions: ["html", "htm"] },
  { name: "文本文件", extensions: TEXT_FILE_OPEN_EXTENSIONS },
  { name: "MDX 文档", extensions: ["mdx"] },
  { name: "Markdown 文档", extensions: ["md"] },
  { name: "所有文件", extensions: ["*"] },
];

export const MARKDOWN_DOCUMENT_SAVE_FILTERS = [
  { name: "MDX 文档", extensions: ["mdx"] },
  { name: "Markdown 文档", extensions: ["md"] },
  { name: "HTML 文档", extensions: ["html", "htm"] },
  { name: "文本文件", extensions: TEXT_FILE_OPEN_EXTENSIONS },
];

export const MDX_SAVE_FILTER = [{ name: "MDX 文档", extensions: ["mdx"] }];
