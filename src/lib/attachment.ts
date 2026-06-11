import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { fileNameFromPath, normalizeAssetPath } from "./media";

export async function openAttachmentWithConfirm(
  workspaceId: string | null,
  relativePath: string,
  displayName?: string,
): Promise<void> {
  if (!workspaceId) return;

  const normalized = normalizeAssetPath(relativePath);
  if (!normalized.startsWith("asset/")) return;

  const name =
    displayName?.replace(/^📎\s*/, "").trim() ||
    fileNameFromPath(normalized);

  const confirmed = await ask(`是否使用外部应用打开附件「${name}」？`, {
    title: "打开附件",
    kind: "info",
    okLabel: "打开",
    cancelLabel: "取消",
  });
  if (!confirmed) return;

  const absolutePath = await invoke<string>("get_asset_absolute_path", {
    workspaceId,
    relativePath: normalized,
  });
  await openPath(absolutePath);
}
