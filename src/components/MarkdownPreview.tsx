import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import rehypeRaw from "rehype-raw";
import { buildRemarkPlugins } from "../lib/markdownPlugins";
import { rehypeUnwrapMedia } from "../lib/rehypeUnwrapMedia";
import { openAttachmentWithConfirm } from "../lib/attachment";
import { resolveAssetUrl, resolveMediaPreviewUrl, peekMediaPreviewUrl, getMediaPreviewRevision, subscribeMediaPreviewRevision } from "../lib/assetResolver";
import { useSettingsStore } from "../stores/settingsStore";
import {
  audioMimeFallbacks,
  extensionFromPath,
  fileNameFromPath,
  isAttachmentPath,
  isAudioExtension,
  isVideoExtension,
  needsMediaTranscode,
  normalizeAssetPath,
  videoMimeType,
} from "../lib/media";

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

interface MarkdownPreviewProps {
  content: string;
  workspaceId: string | null;
  onHtmlChange?: (html: string) => void;
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

function useResolvedAssetUrl(workspaceId: string | null, src?: string) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc("");
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    void resolveAssetUrl(workspaceId, src).then((url) => {
      if (cancelled) return;
      setResolvedSrc(url);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [src, workspaceId]);

  return { resolvedSrc, ready };
}

function useResolvedMediaUrl(workspaceId: string | null, src?: string) {
  const ffmpegPath = useSettingsStore((s) => s.ffmpegPath);
  const [resolvedSrc, setResolvedSrc] = useState("");
  const [ready, setReady] = useState(false);
  const [transcoding, setTranscoding] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(getMediaPreviewRevision);

  useEffect(() => subscribeMediaPreviewRevision(() => {
    setPreviewRevision(getMediaPreviewRevision());
  }), []);

  useEffect(() => {
    if (!src) {
      setResolvedSrc("");
      setReady(true);
      setTranscoding(false);
      setMediaError(null);
      return;
    }

    let cancelled = false;
    const normalized = normalizeAssetPath(src);

    const applyUrl = (url: string, isTranscoding: boolean) => {
      if (cancelled) return;
      setResolvedSrc(url);
      setReady(true);
      setTranscoding(isTranscoding);
      setMediaError(null);
    };

    const applyError = (error: unknown) => {
      if (cancelled) return;
      setResolvedSrc("");
      setReady(true);
      setTranscoding(false);
      setMediaError(String(error));
    };

    if (!needsMediaTranscode(normalized)) {
      setReady(false);
      setTranscoding(false);
      void resolveAssetUrl(workspaceId, src).then((url) => applyUrl(url, false));
      return () => {
        cancelled = true;
      };
    }

    const cached = peekMediaPreviewUrl(workspaceId, src, ffmpegPath);
    if (cached) {
      applyUrl(cached, false);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    setTranscoding(true);
    setMediaError(null);
    void resolveMediaPreviewUrl(workspaceId, src, ffmpegPath).then((url) => {
      applyUrl(url, false);
    }).catch(applyError);

    return () => {
      cancelled = true;
    };
  }, [src, workspaceId, ffmpegPath, previewRevision]);

  return { resolvedSrc, ready, transcoding, mediaError };
}

function previewMimeFromPath(
  playbackPath: string,
  kind: "audio" | "video",
): string | undefined {
  const previewExt = extensionFromPath(playbackPath);
  if (kind === "video") {
    return videoMimeType(previewExt) ?? "video/mp4";
  }
  if (previewExt === "m4a" || previewExt === "mp4") {
    return "audio/mp4";
  }
  const fallbacks = audioMimeFallbacks(previewExt);
  return fallbacks[0];
}

function AssetMedia({
  src,
  workspaceId,
  kind,
}: {
  src?: string;
  workspaceId: string | null;
  kind: "audio" | "video";
}) {
  const { resolvedSrc, ready, transcoding, mediaError } = useResolvedMediaUrl(workspaceId, src);
  if (!src) return null;

  const playbackSrc = ready ? resolvedSrc : "";
  const label = kind === "video" ? "视频" : "音频";

  if (mediaError) {
    return (
      <p className="media-preview-status media-preview-error" aria-live="polite">
        {label}预览失败：{mediaError}
      </p>
    );
  }

  if (transcoding || !playbackSrc) {
    return (
      <p className="media-preview-status" aria-live="polite">
        正在准备{label}…
      </p>
    );
  }

  if (kind === "video") {
    return (
      <video
        controls
        className="preview-video"
        preload="metadata"
        src={playbackSrc}
        style={{ maxWidth: "100%" }}
      />
    );
  }

  const mimeTypes = [previewMimeFromPath(playbackSrc, "audio")].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <audio controls className="preview-audio" preload="metadata" src={playbackSrc}>
      {mimeTypes.map((type) => (
        <source key={type} src={playbackSrc} type={type} />
      ))}
    </audio>
  );
}

function AssetImage({
  src,
  alt,
  workspaceId,
}: {
  src?: string;
  alt?: string;
  workspaceId: string | null;
}) {
  const { resolvedSrc } = useResolvedAssetUrl(workspaceId, src);
  return <img src={resolvedSrc || src} alt={alt ?? ""} />;
}

function AttachmentLink({
  href,
  children,
  workspaceId,
}: {
  href: string;
  children?: React.ReactNode;
  workspaceId: string | null;
}) {
  const label = flattenText(children).replace(/^📎\s*/, "").trim();

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    void openAttachmentWithConfirm(workspaceId, href, label);
  };

  return (
    <button type="button" className="attachment-link" onClick={handleClick}>
      <span className="attachment-icon" aria-hidden="true">
        📎
      </span>
      <span className="attachment-name">{label || fileNameFromPath(href)}</span>
    </button>
  );
}

function AssetLink({
  href,
  children,
  workspaceId,
}: {
  href?: string;
  children?: React.ReactNode;
  workspaceId: string | null;
}) {
  const { resolvedSrc } = useResolvedAssetUrl(workspaceId, href);

  if (!href) {
    return <a>{children}</a>;
  }

  const normalized = normalizeAssetPath(href);
  if (isAttachmentPath(normalized)) {
    return (
      <AttachmentLink href={normalized} workspaceId={workspaceId}>
        {children}
      </AttachmentLink>
    );
  }

  const ext = extensionFromPath(normalized);
  if (normalized.startsWith("asset/")) {
    if (isVideoExtension(ext)) {
      return <AssetMedia src={href} workspaceId={workspaceId} kind="video" />;
    }
    if (isAudioExtension(ext)) {
      return <AssetMedia src={href} workspaceId={workspaceId} kind="audio" />;
    }
  }

  return (
    <a href={resolvedSrc || href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function MarkdownPreview({
  content,
  workspaceId,
  onHtmlChange,
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markdownSingleLineBreaks = useSettingsStore((s) => s.markdownSingleLineBreaks);

  const remarkPlugins = useMemo(
    () => buildRemarkPlugins(markdownSingleLineBreaks),
    [markdownSingleLineBreaks],
  );

  const isEmpty = content.trim().length === 0;

  useEffect(() => {
    if (!onHtmlChange) return;
    if (isEmpty) {
      onHtmlChange("");
      return;
    }
    if (containerRef.current) {
      onHtmlChange(containerRef.current.innerHTML);
    }
  }, [content, isEmpty, workspaceId, markdownSingleLineBreaks, onHtmlChange]);

  const components = useMemo(
    () => ({
      h1: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
      h2: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
      h3: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
      h4: ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>,
      h5: ({ children }: { children?: React.ReactNode }) => <h5>{children}</h5>,
      h6: ({ children }: { children?: React.ReactNode }) => <h6>{children}</h6>,
      img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <AssetImage src={props.src} alt={props.alt} workspaceId={workspaceId} />
      ),
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <AssetLink href={props.href} workspaceId={workspaceId}>
          {props.children}
        </AssetLink>
      ),
      video: (
        props: React.VideoHTMLAttributes<HTMLVideoElement> & ExtraProps,
      ) => <AssetMedia src={mediaSrcFromProps(props)} workspaceId={workspaceId} kind="video" />,
      audio: (
        props: React.AudioHTMLAttributes<HTMLAudioElement> & ExtraProps,
      ) => <AssetMedia src={mediaSrcFromProps(props)} workspaceId={workspaceId} kind="audio" />,
    }),
    [workspaceId],
  );

  return (
    <div ref={containerRef} className="markdown-preview">
      {isEmpty ? (
        <p className="markdown-preview-empty">请在左侧编辑区插入内容</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={[rehypeRaw, rehypeUnwrapMedia]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
}
