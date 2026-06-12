import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  extensionFromPath,
  isAudioExtension,
  isVideoExtension,
  normalizeAssetPath,
} from "./media";

const assetPathCache = new Map<string, string>();
const mediaPreviewCache = new Map<string, string>();

export function clearAssetCache() {
  assetPathCache.clear();
  mediaPreviewCache.clear();
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
  const cacheKey = `${workspaceId}:${normalized}:${trimmedFfmpegPath}`;
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
    return url;
  } catch {
    return resolveAssetUrl(workspaceId, src);
  }
}
