import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { isVaultFolder, type VaultTreeNode, type VaultItemInfo } from "../types/vault";

const STORE_PATH = "settings.json";
const VAULT_PATH_KEY = "vault_path";
const VAULT_EXPANDED_KEY = "vault_expanded_folders";
const SIDEBAR_OPEN_KEY = "vault_sidebar_open";
const RECENT_VAULTS_KEY = "recent_vaults";
const MAX_RECENT_VAULTS = 10;

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

export async function getRecentVaults(): Promise<string[]> {
  const store = await getStore();
  const value = await store.get<string[]>(RECENT_VAULTS_KEY);
  return Array.isArray(value) ? value : [];
}

export async function addRecentVault(path: string): Promise<string[]> {
  const store = await getStore();
  const current = (await store.get<string[]>(RECENT_VAULTS_KEY)) ?? [];
  const next = [path, ...current.filter((item) => item !== path)].slice(0, MAX_RECENT_VAULTS);
  await store.set(RECENT_VAULTS_KEY, next);
  await store.save();
  return next;
}

export async function removeRecentVault(path: string): Promise<string[]> {
  const store = await getStore();
  const next = ((await store.get<string[]>(RECENT_VAULTS_KEY)) ?? []).filter((item) => item !== path);
  await store.set(RECENT_VAULTS_KEY, next);
  await store.save();
  return next;
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

export async function getVaultItemInfo(
  vaultPath: string,
  itemPath: string,
): Promise<VaultItemInfo> {
  return invoke("get_vault_item_info_cmd", { vaultPath, itemPath });
}

export async function deleteVaultFile(vaultPath: string, filePath: string): Promise<void> {
  await invoke("delete_vault_file_cmd", { vaultPath, filePath });
}

export async function deleteVaultFolder(vaultPath: string, relativePath: string): Promise<void> {
  await invoke("delete_vault_folder_cmd", { vaultPath, relativePath });
}

export async function renameVaultItem(
  vaultPath: string,
  relativePath: string,
  newName: string,
  isFolder: boolean,
): Promise<string> {
  return invoke<string>("rename_vault_item_cmd", {
    vaultPath,
    relativePath,
    newName,
    isFolder,
  });
}

export async function moveVaultItem(
  vaultPath: string,
  relativePath: string,
  targetFolderRelative: string,
  isFolder: boolean,
): Promise<string> {
  return invoke<string>("move_vault_item_cmd", {
    vaultPath,
    relativePath,
    targetFolderRelative,
    isFolder,
  });
}

export async function revealVaultItem(itemPath: string): Promise<void> {
  await invoke("reveal_vault_item_cmd", { itemPath });
}

export function getRelativeVaultPath(vaultPath: string, itemPath: string): string {
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedItem = itemPath.replace(/\\/g, "/");
  if (normalizedItem.toLowerCase().startsWith(`${normalizedVault.toLowerCase()}/`)) {
    return normalizedItem.slice(normalizedVault.length + 1);
  }
  return normalizedItem;
}

export function collectFolderPaths(nodes: VaultTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (!isVaultFolder(node)) continue;
    paths.push(node.relative_path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""));
    paths.push(...collectFolderPaths(node.children));
  }
  return paths;
}
