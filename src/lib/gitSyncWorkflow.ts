import { message } from "@tauri-apps/plugin-dialog";
import {
  describeGitSyncConfig,
  isGitSyncConfigured,
  pullVaultGit,
  pushVaultGit,
} from "./gitSync";
import { diag } from "./diagnosticLog";
import { useSettingsStore } from "../stores/settingsStore";

const GIT_PULL_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label}超时（${Math.round(timeoutMs / 1000)} 秒），已跳过`));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function runVaultGitPull(vaultPath: string): Promise<void> {
  const { gitSync } = useSettingsStore.getState();
  if (!isGitSyncConfigured(gitSync)) return;

  try {
    const result = await withTimeout(
      pullVaultGit(vaultPath, gitSync),
      GIT_PULL_TIMEOUT_MS,
      "Git 拉取",
    );
    if (result.hasConflicts) {
      await message(result.message, { title: "Git 同步", kind: "warning" });
      return;
    }
    if (result.updated) {
      console.info("[git]", result.message);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    diag("git", "pull_failed", { vaultPath, error: detail }, "warn");
    await message(detail, { title: "Git 拉取失败", kind: "warning" });
  }
}

/** 打开工作区前拉取远程（带超时，可能阻塞数秒） */
export async function pullVaultBeforeAccess(vaultPath: string): Promise<void> {
  await runVaultGitPull(vaultPath);
}

/** 后台拉取远程，不阻塞 UI；完成后调用 onSynced */
export function pullVaultInBackground(
  vaultPath: string,
  onSynced?: () => void | Promise<void>,
): void {
  const { gitSync } = useSettingsStore.getState();
  if (!isGitSyncConfigured(gitSync)) return;

  void (async () => {
    try {
      const result = await withTimeout(
        pullVaultGit(vaultPath, gitSync),
        GIT_PULL_TIMEOUT_MS,
        "Git 拉取",
      );
      if (result.hasConflicts) {
        await message(result.message, { title: "Git 同步", kind: "warning" });
        return;
      }
      if (result.updated) {
        console.info("[git]", result.message);
        await onSynced?.();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      diag("git", "pull_background_failed", { vaultPath, error: detail }, "warn");
      console.warn("[git] 后台拉取失败:", detail);
    }
  })();
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
