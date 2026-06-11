import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { clearAssetCache } from "../lib/assetResolver";
import { addRecentFile } from "../lib/recentFiles";
import type { DocumentState, Manifest, SaveStatus } from "../types/document";
import type { RecentFileEntry } from "../types/recent";

interface DocumentStore {
  workspaceId: string | null;
  content: string;
  savedContent: string;
  manifest: Manifest | null;
  filePath: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  recentFiles: RecentFileEntry[];
  previewHtml: string;
  insertAtCursor: ((text: string) => void) | null;
  setContent: (content: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setRecentFiles: (files: RecentFileEntry[]) => void;
  setPreviewHtml: (html: string) => void;
  setInsertAtCursor: (fn: ((text: string) => void) | null) => void;
  insertText: (text: string) => void;
  newDocument: () => Promise<void>;
  openDocument: (path: string) => Promise<RecentFileEntry[]>;
  saveDocument: (path?: string) => Promise<RecentFileEntry[] | null>;
  autosaveDocument: () => Promise<void>;
  syncContent: () => Promise<void>;
  resetDirty: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  workspaceId: null,
  content: "",
  savedContent: "",
  manifest: null,
  filePath: null,
  isDirty: false,
  saveStatus: "idle",
  recentFiles: [],
  previewHtml: "",
  insertAtCursor: null,

  setContent: (content) => {
    const { content: prev, savedContent } = get();
    if (content === prev) return;
    const isDirty = content !== savedContent;
    set({
      content,
      isDirty,
      saveStatus: isDirty ? "dirty" : "saved",
    });
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setRecentFiles: (recentFiles) => set({ recentFiles }),

  setPreviewHtml: (previewHtml) => set({ previewHtml }),

  setInsertAtCursor: (insertAtCursor) => set({ insertAtCursor }),

  insertText: (text) => {
    const { insertAtCursor } = get();
    if (insertAtCursor) {
      insertAtCursor(text);
    } else {
      set({
        content: get().content + text,
        isDirty: true,
        saveStatus: "dirty",
      });
    }
  },

  newDocument: async () => {
    const { workspaceId } = get();
    if (workspaceId) {
      await invoke("close_document", { workspaceId });
    }
    clearAssetCache();
    const doc = await invoke<DocumentState>("create_document");
    set({
      workspaceId: doc.workspace_id,
      content: doc.content,
      savedContent: doc.content,
      manifest: doc.manifest,
      filePath: doc.file_path,
      isDirty: false,
      saveStatus: "saved",
    });
  },

  openDocument: async (path: string) => {
    const { workspaceId } = get();
    if (workspaceId) {
      await invoke("close_document", { workspaceId });
    }
    clearAssetCache();
    const doc = await invoke<DocumentState>("open_document", { path });
    const recentFiles = await addRecentFile(path);
    set({
      workspaceId: doc.workspace_id,
      content: doc.content,
      savedContent: doc.content,
      manifest: doc.manifest,
      filePath: doc.file_path,
      isDirty: false,
      saveStatus: "saved",
      recentFiles,
    });
    return recentFiles;
  },

  saveDocument: async (path?: string) => {
    const { workspaceId, content } = get();
    if (!workspaceId) return null;

    set({ saveStatus: "saving" });
    await invoke("update_document_content", { workspaceId, content });
    const savedPath = await invoke<string>("save_document", {
      workspaceId,
      path: path ?? null,
    });

    if (savedPath) {
      const recentFiles = await addRecentFile(savedPath);
      set({
        filePath: savedPath,
        savedContent: content,
        isDirty: false,
        saveStatus: "saved",
        recentFiles,
      });
      clearAssetCache();
      return recentFiles;
    }

    set({ savedContent: content, isDirty: false, saveStatus: "saved" });
    return null;
  },

  autosaveDocument: async () => {
    const { workspaceId, content, isDirty } = get();
    if (!workspaceId || !isDirty) return;

    set({ saveStatus: "saving" });
    await invoke("update_document_content", { workspaceId, content });
    await invoke("autosave_document", { workspaceId });
    clearAssetCache();
    set({ saveStatus: "dirty" });
  },

  syncContent: async () => {
    const { workspaceId, content } = get();
    if (!workspaceId) return;
    await invoke("update_document_content", { workspaceId, content });
  },

  resetDirty: () => {
    const { content } = get();
    set({ savedContent: content, isDirty: false, saveStatus: "saved" });
  },
}));
