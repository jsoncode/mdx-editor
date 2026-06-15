import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { clearAssetCache } from "../lib/assetResolver";
import { applyDocumentMetadata } from "../lib/documentMetadata";
import { isPlainMdPath } from "../lib/documentPaths";
import { recordDocumentHistory } from "../lib/documentHistory";
import { isPathInVault } from "../lib/gitSync";
import { pullVaultBeforeAccess, pushVaultAfterSave } from "../lib/gitSyncWorkflow";
import { addRecentFile } from "../lib/recentFiles";
import { flushEditorContentToStore, getEditorFlushStats } from "../lib/editorContent";
import { diag, diagSaveCloseState } from "../lib/diagnosticLog";
import { requestDocumentPassword } from "../lib/passwordPrompt";
import {
  forgetRememberedPassword,
  getRememberedPassword,
  setRememberedPassword,
} from "../lib/encryptedPasswordStore";
import { saveGuard } from "../lib/saveGuard";
import type { DocumentState, Manifest, SaveStatus } from "../types/document";
import type { RecentFileEntry } from "../types/recent";
import { useSettingsStore } from "./settingsStore";
import { useVaultStore } from "./vaultStore";

interface DocumentStore {
  workspaceId: string | null;
  content: string;
  savedContent: string;
  manifest: Manifest | null;
  filePath: string | null;
  isEncrypted: boolean;
  encryptionPassword: string | null;
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
  setFilePath: (filePath: string | null) => void;
  setManifest: (manifest: Manifest) => void;
  refreshManifest: () => Promise<void>;
  closeDocument: () => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  workspaceId: null,
  content: "",
  savedContent: "",
  manifest: null,
  filePath: null,
  isEncrypted: false,
  encryptionPassword: null,
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
      isEncrypted: false,
      encryptionPassword: null,
      isDirty: false,
      saveStatus: "saved",
    });
  },

  openDocument: async (path: string) => {
    const { workspaceId } = get();
    if (workspaceId) {
      await invoke("close_document", { workspaceId });
    }

    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath && isPathInVault(path, vaultPath)) {
      await pullVaultBeforeAccess(vaultPath);
    }

    clearAssetCache();

    let password: string | null = null;
    const isMdx = path.toLowerCase().endsWith(".mdx");
    if (isMdx) {
      const encrypted = await invoke<boolean>("is_encrypted_mdx", { path });
      if (encrypted) {
        let rememberedFailed = false;
        password = await getRememberedPassword(path);

        if (password) {
          try {
            const doc = await invoke<DocumentState>("open_document", {
              path,
              password,
            });
            const recentFiles = await addRecentFile(path);
            set({
              workspaceId: doc.workspace_id,
              content: doc.content,
              savedContent: doc.content,
              manifest: doc.manifest,
              filePath: doc.file_path,
              isEncrypted: doc.is_encrypted ?? true,
              encryptionPassword: password,
              isDirty: false,
              saveStatus: "saved",
              recentFiles,
            });
            return recentFiles;
          } catch {
            await forgetRememberedPassword(path);
            password = null;
            rememberedFailed = true;
          }
        }

        const promptResult = await requestDocumentPassword({
          title: "打开加密文档",
          description: rememberedFailed
            ? "已保存的密码无效或文件已损坏，请重新输入密码。"
            : "该 MDX 文档已加密，请输入密码后解密并打开。",
          submitLabel: "解密并打开",
          allowRemember: true,
          documentPath: path,
        });
        if (!promptResult.password) {
          throw new Error("已取消打开");
        }
        password = promptResult.password;
        if (promptResult.remember) {
          await setRememberedPassword(path, password);
        } else {
          await forgetRememberedPassword(path);
        }
      }
    }

    const doc = await invoke<DocumentState>("open_document", {
      path,
      password,
    });
    const recentFiles = await addRecentFile(path);
    set({
      workspaceId: doc.workspace_id,
      content: doc.content,
      savedContent: doc.content,
      manifest: doc.manifest,
      filePath: doc.file_path,
      isEncrypted: doc.is_encrypted ?? Boolean(password),
      encryptionPassword: password,
      isDirty: false,
      saveStatus: "saved",
      recentFiles,
    });
    return recentFiles;
  },

  saveDocument: async (path?: string) => {
    const { workspaceId } = get();
    if (!workspaceId) {
      diag("save", "saveDocument_skipped_no_workspace", {}, "warn");
      return null;
    }

    diagSaveCloseState("saveDocument_start", { targetPath: path ?? null });
    saveGuard.begin();
    const flushed = flushEditorContentToStore();
    diag("save", "saveDocument_flush", { flushed, ...getEditorFlushStats() }, flushed ? "info" : "warn");
    try {
      const {
        content,
        savedContent: previousContent,
        filePath,
        manifest: currentManifest,
        isEncrypted,
        encryptionPassword,
      } = get();

      let savePassword = encryptionPassword;
      if (isEncrypted && !path && !savePassword) {
        const currentPath = filePath;
        if (currentPath) {
          savePassword = await getRememberedPassword(currentPath);
        }
        if (!savePassword) {
          const promptResult = await requestDocumentPassword({
            title: "保存加密文档",
            description: "请输入密码以保存加密 MDX 文档。",
            submitLabel: "保存",
            allowRemember: Boolean(currentPath),
            documentPath: currentPath ?? undefined,
          });
          if (!promptResult.password) {
            set({ saveStatus: "dirty" });
            return null;
          }
          savePassword = promptResult.password;
          if (currentPath) {
            if (promptResult.remember) {
              await setRememberedPassword(currentPath, savePassword);
            } else {
              await forgetRememberedPassword(currentPath);
            }
          }
        }
        set({ encryptionPassword: savePassword });
      }

      set({ saveStatus: "saving" });
      diag("save", "update_document_content_call", { contentLen: content.length });
      await invoke("update_document_content", { workspaceId, content });

      const targetPath = path ?? filePath;
      const isPlainMdSave = targetPath != null && isPlainMdPath(targetPath);

      let manifest = currentManifest;
      if (!isPlainMdSave) {
        const { recordDeviceInfo, recordLocation, documentHistoryDepth } =
          useSettingsStore.getState();
        manifest = await applyDocumentMetadata(
          workspaceId,
          recordDeviceInfo,
          recordLocation,
        );

        if (previousContent !== content) {
          await recordDocumentHistory(workspaceId, previousContent, content, documentHistoryDepth);
        }
      }

      const saved = await invoke<{ path: string; content: string }>("save_document", {
        workspaceId,
        path: path ?? null,
        password: savePassword,
      });
      diag("save", "save_document_ipc_ok", {
        savedPath: saved?.path ?? null,
        savedContentLen: saved?.content?.length ?? null,
      });

      const savedPath = saved?.path ?? null;
      const savedContent = saved?.content ?? content;

      const finalPath = savedPath ?? get().filePath;
      const vaultPath = useVaultStore.getState().vaultPath;
      if (finalPath && vaultPath && isPathInVault(finalPath, vaultPath)) {
        pushVaultAfterSave(vaultPath, finalPath);
      }

      if (savedPath) {
        const recentFiles = await addRecentFile(savedPath);
        let nextEncrypted = isEncrypted;
        if (savedPath.toLowerCase().endsWith(".mdx")) {
          nextEncrypted = await invoke<boolean>("is_encrypted_mdx", { path: savedPath });
        } else {
          nextEncrypted = false;
        }
        set({
          filePath: savedPath,
          content: savedContent,
          savedContent,
          manifest,
          isEncrypted: nextEncrypted,
          encryptionPassword: nextEncrypted ? savePassword : null,
          isDirty: false,
          saveStatus: "saved",
          recentFiles,
        });
        clearAssetCache();
        return recentFiles;
      }

      set({ savedContent, isDirty: false, saveStatus: "saved" });
      diagSaveCloseState("saveDocument_done");
      return null;
    } catch (error) {
      diag(
        "save",
        "saveDocument_error",
        { error: error instanceof Error ? error.message : String(error) },
        "error",
      );
      set({ saveStatus: "dirty" });
      throw error;
    } finally {
      saveGuard.end();
    }
  },

  autosaveDocument: async () => {
    const { workspaceId, isDirty } = get();
    if (!workspaceId || !isDirty) return;

    saveGuard.begin();
    flushEditorContentToStore();
    try {
      const { content } = get();
      set({ saveStatus: "saving" });
      await invoke("update_document_content", { workspaceId, content });
      await invoke("autosave_document", { workspaceId });
      clearAssetCache();
      set({ saveStatus: "dirty" });
    } finally {
      saveGuard.end();
    }
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

  setFilePath: (filePath) => set({ filePath }),

  setManifest: (manifest) => set({ manifest }),

  refreshManifest: async () => {
    const { workspaceId } = get();
    if (!workspaceId) return;
    const manifest = await invoke<Manifest>("get_document_manifest", { workspaceId });
    set({ manifest });
  },

  closeDocument: async () => {
    const { workspaceId } = get();
    diagSaveCloseState("closeDocument_start", { workspaceId });
    if (workspaceId) {
      await invoke("close_document", { workspaceId });
    }
    clearAssetCache();
    set({
      workspaceId: null,
      content: "",
      savedContent: "",
      manifest: null,
      filePath: null,
      isEncrypted: false,
      encryptionPassword: null,
      isDirty: false,
      saveStatus: "idle",
    });
  },
}));
