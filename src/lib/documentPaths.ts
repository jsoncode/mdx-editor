import { extensionFromPath } from "./media";

export function isPlainMdPath(path: string): boolean {
  return extensionFromPath(path) === "md";
}

export function isMdxDocumentPath(path: string): boolean {
  return extensionFromPath(path) === "mdx";
}

export function isMarkdownDocumentPath(path: string): boolean {
  const ext = extensionFromPath(path);
  return ext === "md" || ext === "mdx";
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

export const MARKDOWN_DOCUMENT_OPEN_FILTERS = [
  { name: "Markdown / MDX", extensions: ["md", "mdx"] },
  { name: "MDX 文档", extensions: ["mdx"] },
  { name: "Markdown 文档", extensions: ["md"] },
];

export const MARKDOWN_DOCUMENT_SAVE_FILTERS = [
  { name: "MDX 文档", extensions: ["mdx"] },
  { name: "Markdown 文档", extensions: ["md"] },
];

export const MDX_SAVE_FILTER = [{ name: "MDX 文档", extensions: ["mdx"] }];
