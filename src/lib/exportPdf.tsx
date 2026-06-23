import { invoke } from "@tauri-apps/api/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import rehypeRaw from "rehype-raw";
import { buildRemarkPlugins } from "./markdownPlugins";
import { rehypeUnwrapMedia } from "./rehypeUnwrapMedia";
import {
  extensionFromPath,
  fileNameFromPath,
  isAttachmentPath,
  isAudioExtension,
  isImageExtension,
  isVideoExtension,
  normalizeAssetPath,
} from "./media";

export interface PdfAssetEntry {
  dataUrl?: string;
  label: string;
  kind: "image" | "video" | "audio" | "attachment" | "link";
}

export type PdfAssetMap = Map<string, PdfAssetEntry>;

function flattenText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(flattenText).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>;
    return flattenText(element.props.children);
  }
  return String(children ?? "");
}

function mediaSrcFromProps(
  props: (React.VideoHTMLAttributes<HTMLVideoElement> | React.AudioHTMLAttributes<HTMLAudioElement>) &
    ExtraProps,
): string | undefined {
  if (typeof props.src === "string" && props.src.trim()) {
    return props.src;
  }

  const node = props.node;
  if (!node || node.type !== "element") return undefined;

  const direct = node.properties?.src;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (Array.isArray(direct)) {
    const first = direct.find((value) => typeof value === "string" && value.trim());
    if (typeof first === "string") return first;
  }

  for (const child of node.children) {
    if (child.type !== "element" || child.tagName !== "source") continue;
    const nested = child.properties?.src;
    if (typeof nested === "string" && nested.trim()) return nested;
    if (Array.isArray(nested)) {
      const first = nested.find((value) => typeof value === "string" && value.trim());
      if (typeof first === "string") return first;
    }
  }

  return undefined;
}

function imageMimeType(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

function renderVideoPoster(entry: PdfAssetEntry | undefined) {
  const label = entry?.label ?? "视频";
  if (entry?.dataUrl) {
    return (
      <div className="pdf-video-cover">
        <img src={entry.dataUrl} alt={label} className="pdf-video-poster" />
        <span className="pdf-video-badge">▶ 视频</span>
      </div>
    );
  }
  return (
    <div className="pdf-media-fallback">
      <span>▶</span>
      <span>{label}</span>
    </div>
  );
}

function renderAudioStatic(entry: PdfAssetEntry | undefined) {
  const label = entry?.label ?? "音频";
  return (
    <div className="pdf-audio-static">
      <span className="attachment-icon">🔊</span>
      <span className="attachment-name">{label}</span>
    </div>
  );
}

function renderAttachment(label: string) {
  return (
    <span className="attachment-link">
      <span className="attachment-icon">📎</span>
      <span className="attachment-name">{label}</span>
    </span>
  );
}

function buildPdfComponents(assets: PdfAssetMap) {
  const resolveEntry = (src?: string) => {
    if (!src) return undefined;
    return assets.get(normalizeAssetPath(src));
  };

  return {
    h1: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>,
    h5: ({ children }: { children?: React.ReactNode }) => <h5>{children}</h5>,
    h6: ({ children }: { children?: React.ReactNode }) => <h6>{children}</h6>,
    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
      const normalized = normalizeAssetPath(props.src ?? "");
      const entry = assets.get(normalized);
      const alt = props.alt ?? entry?.label ?? "";
      if (entry?.dataUrl) {
        return <img src={entry.dataUrl} alt={alt} />;
      }
      return <img src={props.src} alt={alt} />;
    },
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const href = props.href ?? "";
      const normalized = normalizeAssetPath(href);
      const label =
        flattenText(props.children).replace(/^📎\s*/, "").trim() ||
        fileNameFromPath(normalized);

      if (isAttachmentPath(normalized)) {
        return renderAttachment(label);
      }

      if (normalized.startsWith("asset/")) {
        const ext = extensionFromPath(normalized);
        if (isVideoExtension(ext)) {
          return renderVideoPoster(assets.get(normalized));
        }
        if (isAudioExtension(ext)) {
          return renderAudioStatic(assets.get(normalized));
        }
      }

      return <a href={href}>{props.children}</a>;
    },
    video: (props: React.VideoHTMLAttributes<HTMLVideoElement> & ExtraProps) =>
      renderVideoPoster(resolveEntry(mediaSrcFromProps(props))),
    audio: (props: React.AudioHTMLAttributes<HTMLAudioElement> & ExtraProps) =>
      renderAudioStatic(resolveEntry(mediaSrcFromProps(props))),
  };
}

export async function preparePdfAssets(
  workspaceId: string,
  content: string,
  ffmpegPath: string,
): Promise<PdfAssetMap> {
  const refs = await invoke<string[]>("collect_content_asset_refs", { content });
  const map = new Map<string, PdfAssetEntry>();

  for (const ref of refs) {
    const normalized = normalizeAssetPath(ref);
    const ext = extensionFromPath(normalized);
    const label = fileNameFromPath(normalized);

    if (isImageExtension(ext)) {
      const absolutePath = await invoke<string>("get_asset_absolute_path", {
        workspaceId,
        relativePath: normalized,
      });
      const base64 = await invoke<string>("read_file_base64", { path: absolutePath });
      const mime = imageMimeType(ext);
      map.set(normalized, {
        dataUrl: `data:${mime};base64,${base64}`,
        label,
        kind: "image",
      });
      continue;
    }

    if (isVideoExtension(ext)) {
      try {
        const base64 = await invoke<string>("extract_video_thumbnail_base64", {
          workspaceId,
          relativePath: normalized,
          ffmpegPath: ffmpegPath.trim() || null,
        });
        map.set(normalized, {
          dataUrl: `data:image/jpeg;base64,${base64}`,
          label,
          kind: "video",
        });
      } catch {
        map.set(normalized, { label, kind: "video" });
      }
      continue;
    }

    if (isAudioExtension(ext)) {
      map.set(normalized, { label, kind: "audio" });
      continue;
    }

    if (isAttachmentPath(normalized)) {
      map.set(normalized, { label, kind: "attachment" });
    }
  }

  return map;
}

export function renderPdfBodyHtml(
  content: string,
  singleLineBreaks: boolean,
  assets: PdfAssetMap,
): string {
  const remarkPlugins = buildRemarkPlugins(singleLineBreaks);
  const components = buildPdfComponents(assets);
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
      remarkPlugins,
      rehypePlugins: [rehypeRaw, rehypeUnwrapMedia],
      components,
      children: content,
    }),
  );
}
