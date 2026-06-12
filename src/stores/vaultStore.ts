import { create } from "zustand";
import { mkdir } from "@tauri-apps/plugin-fs";
import {
  addRecentVault,
  createVaultDocument,
  createVaultFolder,
  getExpandedFolders,
  getSavedVaultPath,
  getSidebarOpen,
  saveExpandedFolders,
  saveSidebarOpen,
  saveVaultPath,
  scanVaultTree,
  suggestVaultDocumentName,
  collectFolderPaths,
} from "../lib/vault";
import { pullVaultBeforeAccess } from "../lib/gitSyncWorkflow";
import type { VaultTreeNode } from "../types/vault";

interface VaultStore {
  vaultPath: string | null;
  tree: VaultTreeNode[];
  expandedFolders: Set<string>;
  selectedFolder: string;
  sidebarOpen: boolean;
  loading: boolean;
  initialized: boolean;
  setSelectedFolder: (relativePath: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleFolder: (relativePath: string) => void;
  initialize: () => Promise<void>;
  openVault: (path: string) => Promise<void>;
  closeVault: () => Promise<void>;
  refreshTree: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  createDocument: (baseName?: string, format?: "mdx" | "md", folderRelative?: string) => Promise<string | null>;
  createWorkspace: (parentPath: string, name: string) => Promise<void>;
  expandToFile: (filePath: string) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;
}

function normalizeFolderPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultPath: null,
  tree: [],
  expandedFolders: new Set<string>(),
  selectedFolder: "",
  sidebarOpen: true,
  loading: false,
  initialized: false,

  setSelectedFolder: (relativePath) => {
    set({ selectedFolder: normalizeFolderPath(relativePath) });
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
    void saveSidebarOpen(open);
  },

  toggleFolder: (relativePath) => {
    const key = normalizeFolderPath(relativePath);
    const next = new Set(get().expandedFolders);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    set({ expandedFolders: next });
    void saveExpandedFolders(Array.from(next));
  },

  initialize: async () => {
    if (get().initialized) return;

    const [savedPath, expanded, sidebarOpen] = await Promise.all([
      getSavedVaultPath(),
      getExpandedFolders(),
      getSidebarOpen(),
    ]);

    set({
      expandedFolders: new Set(expanded),
      sidebarOpen,
      initialized: true,
    });

    if (savedPath) {
      await get().openVault(savedPath);
    }
  },

  openVault: async (path) => {
    set({ loading: true, vaultPath: path });
    try {
      await pullVaultBeforeAccess(path);
      const tree = await scanVaultTree(path);
      await saveVaultPath(path);
      await addRecentVault(path);
      set({ tree, vaultPath: path, loading: false });
    } catch (error) {
      console.error("打开工作区失败:", error);
      await saveVaultPath(null);
      set({ vaultPath: null, tree: [], loading: false });
      throw error;
    }
  },

  closeVault: async () => {
    await saveVaultPath(null);
    set({ vaultPath: null, tree: [], selectedFolder: "" });
  },

  refreshTree: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const tree = await scanVaultTree(vaultPath);
    set({ tree });
  },

  createFolder: async (name) => {
    const { vaultPath, selectedFolder } = get();
    if (!vaultPath) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    const relativePath = selectedFolder
      ? `${normalizeFolderPath(selectedFolder)}/${trimmed}`
      : trimmed;

    await createVaultFolder(vaultPath, relativePath);

    const expanded = new Set(get().expandedFolders);
    if (selectedFolder) {
      expanded.add(normalizeFolderPath(selectedFolder));
    }
    set({ expandedFolders: expanded });
    await saveExpandedFolders(Array.from(expanded));
    await get().refreshTree();
    set({ selectedFolder: normalizeFolderPath(relativePath) });
  },

  createDocument: async (baseName = "未命名", format: "mdx" | "md" = "mdx", folderRelative?: string) => {
    const { vaultPath, selectedFolder } = get();
    if (!vaultPath) return null;

    const folder = normalizeFolderPath(folderRelative ?? selectedFolder);
    const relativePath = await suggestVaultDocumentName(
      vaultPath,
      folder,
      `${baseName}.${format}`,
    );
    const absolutePath = await createVaultDocument(vaultPath, relativePath);
    await get().refreshTree();
    return absolutePath;
  },

  createWorkspace: async (parentPath, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const separator = parentPath.includes("\\") ? "\\" : "/";
    const fullPath = `${parentPath.replace(/[/\\]+$/, "")}${separator}${trimmed}`;
    await mkdir(fullPath, { recursive: true });
    await get().openVault(fullPath);
  },

  expandToFile: (filePath) => {
    const { vaultPath, expandedFolders } = get();
    if (!vaultPath) return;

    const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedFile = filePath.replace(/\\/g, "/");
    if (!normalizedFile.toLowerCase().startsWith(`${normalizedVault.toLowerCase()}/`)) {
      return;
    }

    const relative = normalizedFile.slice(normalizedVault.length + 1);
    const parts = relative.split("/");
    parts.pop();

    const next = new Set(expandedFolders);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      next.add(current);
    }
    set({ expandedFolders: next });
    void saveExpandedFolders(Array.from(next));
  },

  expandAllFolders: () => {
    const { tree } = get();
    const next = new Set(collectFolderPaths(tree));
    set({ expandedFolders: next });
    void saveExpandedFolders(Array.from(next));
  },

  collapseAllFolders: () => {
    set({ expandedFolders: new Set<string>() });
    void saveExpandedFolders([]);
  },
}));
