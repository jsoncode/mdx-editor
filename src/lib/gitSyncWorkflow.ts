import { message } from "@tauri-apps/plugin-dialog";
import {
  describeGitSyncConfig,
  isGitSyncConfigured,
  pullVaultGit,
  pushVaultGit,
} from "./gitSync";
import { diag } from "./diagnosticLog";
import { useSettingsStore } from "../stores/settingsStore";

export async function pullVaultBeforeAccess(vaultPath: string): Promise<void> {
  const { gitSync } = useSettingsStore.getState();
  if (!isGitSyncConfigured(gitSync)) return;

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
    await message(String(error), { title: "Git 拉取失败", kind: "warning" });
  }
}

export function pushVaultAfterSave(vaultPath: string, filePath: string): void {
  const { gitSync } = useSettingsStore.getState();
  const configInfo = describeGitSyncConfig(gitSync);

  if (!configInfo.configured) {
    diag("git", "push_skipped", configInfo);
    return;
  }

  const fileName = filePath.split(/[/\\]/).pop() ?? "document";
  diag("git", "push_scheduled", { vaultPath, fileName });

  void pushVaultGit(vaultPath, gitSync, fileName).catch(async (error) => {
    const detail = error instanceof Error ? error.message : String(error);
    diag("git", "push_invoke_failed", { error: detail }, "error");
    await message(
      `文档已保存，但 Git 推送未能启动：${detail}`,
      { title: "Git 推送失败", kind: "warning" },
    );
  });
}

/** 后台 push 失败时的兜底提示（由 App 监听 git-push-failed 事件） */
export async function notifyGitPushFailed(reason: string): Promise<void> {
  diag("git", "push_background_failed", { reason }, "warn");
  await message(
    `文档已保存，但 Git 推送失败：${reason}`,
    { title: "Git 推送失败", kind: "warning" },
  );
}
