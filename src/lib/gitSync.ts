import { invoke } from "@tauri-apps/api/core";
import type { GitPullResult, GitSyncSettings, GitSyncStatus } from "../types/settings";

export function isPathInVault(filePath: string, vaultPath: string): boolean {
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const normalizedFile = filePath.replace(/\\/g, "/").toLowerCase();
  return (
    normalizedFile === normalizedVault ||
    normalizedFile.startsWith(`${normalizedVault}/`)
  );
}

export function toRustGitConfig(settings: GitSyncSettings) {
  return {
    enabled: settings.enabled,
    remoteUrl: settings.remoteUrl.trim(),
    token: settings.token,
    branch: settings.branch.trim() || "main",
    authorName: settings.authorName.trim(),
    authorEmail: settings.authorEmail.trim(),
    commitMessageTemplate: settings.commitMessageTemplate.trim(),
  };
}

export async function pullVaultGit(
  vaultPath: string,
  settings: GitSyncSettings,
): Promise<GitPullResult> {
  if (!settings.enabled) {
    return { updated: false, message: "Git 同步未启用", hasConflicts: false };
  }
  return invoke<GitPullResult>("git_sync_pull", {
    vaultPath,
    config: toRustGitConfig(settings),
  });
}

export async function pushVaultGit(
  vaultPath: string,
  settings: GitSyncSettings,
  fileName?: string,
): Promise<void> {
  if (!settings.enabled) return;
  const template = settings.commitMessageTemplate.trim() || "备份: {{date}}";
  const message = template
    .replace("{{date}}", new Date().toLocaleString())
    .replace("{{datetime}}", new Date().toLocaleString())
    .replace("{{file}}", fileName ?? "");
  await invoke("git_sync_push", {
    vaultPath,
    config: toRustGitConfig(settings),
    commitMessage: message,
  });
}

export async function testVaultGit(
  vaultPath: string,
  settings: GitSyncSettings,
): Promise<string> {
  return invoke<string>("git_sync_test", {
    vaultPath,
    config: toRustGitConfig({ ...settings, enabled: true }),
  });
}

export async function getVaultGitStatus(
  vaultPath: string,
  settings: GitSyncSettings,
): Promise<GitSyncStatus> {
  return invoke<GitSyncStatus>("git_sync_status", {
    vaultPath,
    config: toRustGitConfig(settings),
  });
}
