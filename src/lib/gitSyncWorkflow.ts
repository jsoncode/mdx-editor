import { message } from "@tauri-apps/plugin-dialog";
import { pullVaultGit, pushVaultGit } from "./gitSync";
import { useSettingsStore } from "../stores/settingsStore";

export async function pullVaultBeforeAccess(vaultPath: string): Promise<void> {
  const { gitSync } = useSettingsStore.getState();
  if (!gitSync.enabled) return;

  try {
    const result = await pullVaultGit(vaultPath, gitSync);
    if (result.hasConflicts) {
      await message(result.message, { title: "Git 同步", kind: "warning" });
      return;
    }
    if (result.updated) {
      console.info("[git]", result.message);
    }
  } catch (error) {
    await message(String(error), { title: "Git 拉取失败", kind: "error" });
  }
}

export function pushVaultAfterSave(vaultPath: string, filePath: string): void {
  const { gitSync } = useSettingsStore.getState();
  if (!gitSync.enabled) return;

  const fileName = filePath.split(/[/\\]/).pop() ?? "document";
  void pushVaultGit(vaultPath, gitSync, fileName).catch((error) => {
    console.error("Git push failed:", error);
  });
}
