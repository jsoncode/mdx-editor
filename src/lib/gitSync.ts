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
    token: settings.token.trim(),
    branch: settings.branch.trim() || "main",
    authorName: settings.authorName.trim(),
    authorEmail: settings.authorEmail.trim(),
    commitMessageTemplate: settings.commitMessageTemplate.trim(),
  };
}

/** Git 同步已开启且远程地址、Token 均已配置 */
export function isGitSyncConfigured(settings: GitSyncSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.remoteUrl.trim()) return false;
  if (!settings.token.trim()) return false;
  return true;
}

export function describeGitSyncConfig(settings: GitSyncSettings) {
  return {
    enabled: settings.enabled,
    hasRemoteUrl: Boolean(settings.remoteUrl.trim()),
    hasToken: Boolean(settings.token.trim()),
    configured: isGitSyncConfigured(settings),
  };
}

export async function pullVaultGit(
  vaultPath: string,
  settings: GitSyncSettings,
): Promise<GitPullResult> {
  if (!isGitSyncConfigured(settings)) {
    return { updated: false, message: "Git 同步未配置完整", hasConflicts: false };
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
  if (!isGitSyncConfigured(settings)) return;
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
