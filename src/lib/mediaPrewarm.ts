import { invoke } from "@tauri-apps/api/core";
import {
  extensionFromPath,
  isAudioExtension,
  isDirectPlayable,
  isVideoExtension,
  normalizeAssetPath,
} from "./media";
import { seedMediaPreviewUrl } from "./assetResolver";

/** Markdown / HTML 中的 asset 引用 */
const ASSET_REF_PATTERN =
  /(?:!\[[^\]]*\]\(|\[[^\]]*\]\(|(?:src|href)\s*=\s*["'])([^"')\s]+)/gi;

export function extractMediaAssetPaths(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(ASSET_REF_PATTERN)) {
    const normalized = normalizeAssetPath(match[1] ?? "");
    if (!normalized.startsWith("asset/")) continue;
    const ext = extensionFromPath(normalized);
    if (isAudioExtension(ext) || isVideoExtension(ext)) {
      found.add(normalized);
    }
  }
  return [...found];
}

export function extractTranscodableMediaPaths(content: string): string[] {
  return extractMediaAssetPaths(content).filter(
    (path) => !isDirectPlayable(extensionFromPath(path)),
  );
}

let prewarmGeneration = 0;

export function cancelMediaPrewarm(): void {
  prewarmGeneration += 1;
}

export interface MediaPrewarmProgress {
  total: number;
  done: number;
  current?: string;
}

type ProgressListener = (progress: MediaPrewarmProgress | null) => void;
const progressListeners = new Set<ProgressListener>();

function notifyProgress(progress: MediaPrewarmProgress | null) {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

export function subscribeMediaPrewarmProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

/**
 * 打开文档后在后台预转码不可直接播放的媒体，结果写入预览缓存。
 */
export async function prewarmDocumentMedia(
  workspaceId: string,
  content: string,
  ffmpegPath: string,
): Promise<void> {
  const paths = extractTranscodableMediaPaths(content);
  if (paths.length === 0) {
    notifyProgress(null);
    return;
  }

  const generation = ++prewarmGeneration;
  notifyProgress({ total: paths.length, done: 0 });

  try {
    const available = await invoke<boolean>("ffmpeg_available", {
      ffmpegPath: ffmpegPath.trim() || null,
    });
    if (!available) {
      notifyProgress(null);
      return;
    }

    for (let index = 0; index < paths.length; index += 1) {
      if (generation !== prewarmGeneration) return;

      const relativePath = paths[index];
      notifyProgress({ total: paths.length, done: index, current: relativePath });

      try {
        const previewPath = await invoke<string>("resolve_media_preview", {
          workspaceId,
          relativePath,
          ffmpegPath: ffmpegPath.trim() || null,
        });
        if (generation !== prewarmGeneration) return;
        seedMediaPreviewUrl(workspaceId, relativePath, ffmpegPath, previewPath);
      } catch (error) {
        console.warn(`媒体预转码失败 (${relativePath}):`, error);
      }
    }

    if (generation === prewarmGeneration) {
      notifyProgress(null);
    }
  } catch (error) {
    if (generation === prewarmGeneration) {
      notifyProgress(null);
      console.warn("媒体预转码失败:", error);
    }
  }
}
