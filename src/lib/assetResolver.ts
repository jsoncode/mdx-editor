import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  extensionFromPath,
  isAudioExtension,
  isVideoExtension,
  normalizeAssetPath,
} from "./media";

const assetPathCache = new Map<string, string>();
const mediaPreviewCache = new Map<string, string>();

let mediaPreviewRevision = 0;
const revisionListeners = new Set<() => void>();

function bumpMediaPreviewRevision() {
  mediaPreviewRevision += 1;
  for (const listener of revisionListeners) {
    listener();
  }
}

export function getMediaPreviewRevision(): number {
  return mediaPreviewRevision;
}

export function subscribeMediaPreviewRevision(listener: () => void): () => void {
  revisionListeners.add(listener);
  return () => revisionListeners.delete(listener);
}

export function clearAssetCache() {
  assetPathCache.clear();
  mediaPreviewCache.clear();
  bumpMediaPreviewRevision();
}

function mediaCacheKey(
  workspaceId: string,
  normalized: string,
  ffmpegPath: string,
): string {
  return `${workspaceId}:${normalized}:${ffmpegPath.trim()}`;
}

/** 由后台预转码写入缓存，供预览区直接播放 */
export function seedMediaPreviewUrl(
  workspaceId: string,
  relativePath: string,
  ffmpegPath: string,
  previewAbsolutePath: string,
): void {
  const normalized = normalizeAssetPath(relativePath);
  const cacheKey = mediaCacheKey(workspaceId, normalized, ffmpegPath);
  const url = convertFileSrc(previewAbsolutePath);
  const existing = mediaPreviewCache.get(cacheKey);
  if (existing === url) return;
  mediaPreviewCache.set(cacheKey, url);
  bumpMediaPreviewRevision();
}

export async function resolveAssetUrl(
  workspaceId: string | null,
  src: string,
): Promise<string> {
  if (!workspaceId || !src) return src;

  const normalized = src.replace(/^\.\//, "");
  if (!normalized.startsWith("asset/")) {
    return src;
  }

  const cacheKey = `${workspaceId}:${normalized}`;
  const cached = assetPathCache.get(cacheKey);
  if (cached) return cached;

  try {
    const absolutePath = await invoke<string>("get_asset_absolute_path", {
      workspaceId,
      relativePath: normalized,
    });
    const url = convertFileSrc(absolutePath);
    assetPathCache.set(cacheKey, url);
    return url;
  } catch {
    return src;
  }
}

export async function resolveMediaPreviewUrl(
  workspaceId: string | null,
  src: string,
  ffmpegPath?: string,
): Promise<string> {
  if (!workspaceId || !src) return src;

  const normalized = normalizeAssetPath(src);
  if (!normalized.startsWith("asset/")) {
    return src;
  }

  const ext = extensionFromPath(normalized);
  if (!isAudioExtension(ext) && !isVideoExtension(ext)) {
    return resolveAssetUrl(workspaceId, src);
  }

  const trimmedFfmpegPath = ffmpegPath?.trim() ?? "";
  const cacheKey = mediaCacheKey(workspaceId, normalized, trimmedFfmpegPath);
  const cached = mediaPreviewCache.get(cacheKey);
  if (cached) return cached;

  try {
    const previewPath = await invoke<string>("resolve_media_preview", {
      workspaceId,
      relativePath: normalized,
      ffmpegPath: trimmedFfmpegPath || null,
    });
    const url = convertFileSrc(previewPath);
    mediaPreviewCache.set(cacheKey, url);
    bumpMediaPreviewRevision();
    return url;
  } catch {
    return resolveAssetUrl(workspaceId, src);
  }
}

export function peekMediaPreviewUrl(
  workspaceId: string | null,
  src: string,
  ffmpegPath?: string,
): string | undefined {
  if (!workspaceId || !src) return undefined;
  const normalized = normalizeAssetPath(src);
  if (!normalized.startsWith("asset/")) return undefined;
  const cacheKey = mediaCacheKey(workspaceId, normalized, ffmpegPath?.trim() ?? "");
  return mediaPreviewCache.get(cacheKey);
}
