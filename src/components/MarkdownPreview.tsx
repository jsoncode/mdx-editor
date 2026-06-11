import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { openAttachmentWithConfirm } from "../lib/attachment";
import { resolveAssetUrl } from "../lib/assetResolver";
import {
  extensionFromPath,
  fileNameFromPath,
  isAttachmentPath,
  isAudioExtension,
  isVideoExtension,
  normalizeAssetPath,
} from "../lib/media";

interface MarkdownPreviewProps {
  content: string;
  workspaceId: string | null;
  onHtmlChange?: (html: string) => void;
}

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

function useResolvedAssetUrl(workspaceId: string | null, src?: string) {
  const [resolvedSrc, setResolvedSrc] = useState(src ?? "");

  useEffect(() => {
    if (!src) {
      setResolvedSrc("");
      return;
    }
    void resolveAssetUrl(workspaceId, src).then(setResolvedSrc);
  }, [src, workspaceId]);

  return resolvedSrc;
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
  const resolvedSrc = useResolvedAssetUrl(workspaceId, src);
  return <img src={resolvedSrc} alt={alt ?? ""} />;
}

function AssetVideo({
  src,
  workspaceId,
}: {
  src?: string;
  workspaceId: string | null;
}) {
  const resolvedSrc = useResolvedAssetUrl(workspaceId, src);
  if (!resolvedSrc) return null;
  return <video controls src={resolvedSrc} style={{ maxWidth: "100%" }} />;
}

function AssetAudio({
  src,
  workspaceId,
}: {
  src?: string;
  workspaceId: string | null;
}) {
  const resolvedSrc = useResolvedAssetUrl(workspaceId, src);
  if (!resolvedSrc) return null;
  return <audio controls src={resolvedSrc} />;
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
  const resolvedHref = useResolvedAssetUrl(workspaceId, href);

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
      return <AssetVideo src={href} workspaceId={workspaceId} />;
    }
    if (isAudioExtension(ext)) {
      return <AssetAudio src={href} workspaceId={workspaceId} />;
    }
  }

  return (
    <a href={resolvedHref} target="_blank" rel="noreferrer">
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

  useEffect(() => {
    if (containerRef.current && onHtmlChange) {
      onHtmlChange(containerRef.current.innerHTML);
    }
  }, [content, workspaceId, onHtmlChange]);

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
      ) => <AssetVideo src={props.src} workspaceId={workspaceId} />,
      audio: (
        props: React.AudioHTMLAttributes<HTMLAudioElement> & ExtraProps,
      ) => <AssetAudio src={props.src} workspaceId={workspaceId} />,
    }),
    [workspaceId],
  );

  return (
    <div ref={containerRef} className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
