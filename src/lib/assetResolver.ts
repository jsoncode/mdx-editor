import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const assetPathCache = new Map<string, string>();

export function clearAssetCache() {
  assetPathCache.clear();
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
