import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import type { VaultTreeNode } from "../types/vault";

const STORE_PATH = "settings.json";
const VAULT_PATH_KEY = "vault_path";
const VAULT_EXPANDED_KEY = "vault_expanded_folders";
const SIDEBAR_OPEN_KEY = "vault_sidebar_open";

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

export async function getSavedVaultPath(): Promise<string | null> {
  const store = await getStore();
  const value = await store.get<string>(VAULT_PATH_KEY);
  return value ?? null;
}

export async function saveVaultPath(path: string | null): Promise<void> {
  const store = await getStore();
  if (path) {
    await store.set(VAULT_PATH_KEY, path);
  } else {
    await store.delete(VAULT_PATH_KEY);
  }
  await store.save();
}

export async function getExpandedFolders(): Promise<string[]> {
  const store = await getStore();
  const value = await store.get<string[]>(VAULT_EXPANDED_KEY);
  return Array.isArray(value) ? value : [];
}

export async function saveExpandedFolders(folders: string[]): Promise<void> {
  const store = await getStore();
  await store.set(VAULT_EXPANDED_KEY, folders);
  await store.save();
}

export async function getSidebarOpen(): Promise<boolean> {
  const store = await getStore();
  const value = await store.get<boolean>(SIDEBAR_OPEN_KEY);
  return value ?? true;
}

export async function saveSidebarOpen(open: boolean): Promise<void> {
  const store = await getStore();
  await store.set(SIDEBAR_OPEN_KEY, open);
  await store.save();
}

export async function scanVaultTree(vaultPath: string): Promise<VaultTreeNode[]> {
  return invoke<VaultTreeNode[]>("scan_vault_tree", { vaultPath });
}

export async function createVaultFolder(vaultPath: string, relativePath: string): Promise<void> {
  await invoke("create_vault_folder_cmd", { vaultPath, relativePath });
}

export async function createVaultDocument(
  vaultPath: string,
  relativePath: string,
): Promise<string> {
  return invoke<string>("create_vault_document_cmd", { vaultPath, relativePath });
}

export async function suggestVaultDocumentName(
  vaultPath: string,
  folderRelative: string,
  baseName: string,
): Promise<string> {
  return invoke<string>("suggest_vault_document_name", {
    vaultPath,
    folderRelative,
    baseName,
  });
}

export function isPathInVault(filePath: string | null, vaultPath: string | null): boolean {
  if (!filePath || !vaultPath) return false;
  const normalizedFile = filePath.replace(/\\/g, "/").toLowerCase();
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return normalizedFile.startsWith(`${normalizedVault}/`) || normalizedFile === normalizedVault;
}
