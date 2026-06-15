import { invoke } from "@tauri-apps/api/core";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { insertResourceFromPath, isMediaInsertCancelled } from "../lib/mediaInsert";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AUDIO_INSERT_OPEN_FILTERS,
  IMAGE_INSERT_OPEN_FILTERS,
  MEDIA_INSERT_OPEN_FILTERS,
  VIDEO_INSERT_OPEN_FILTERS,
} from "../lib/media";
import { buildExportHtml } from "../lib/export";
import {
  defaultSavePath,
  isPlainMdPath,
  MARKDOWN_DOCUMENT_OPEN_FILTERS,
  MARKDOWN_DOCUMENT_SAVE_FILTERS,
  MDX_SAVE_FILTER,
} from "../lib/documentPaths";
import { requestDocumentPassword } from "../lib/passwordPrompt";
import { promptPlainMdSaveChoice } from "../lib/savePrompt";
import {
  formatDocumentOpenError,
  isDocumentNotFoundError,
} from "../lib/documentErrors";
import { removeRecentFile } from "../lib/recentFiles";
import { promptRemoveMissingRecentDocument } from "../lib/recentDocumentPrompt";
import { requestExportSuccessPrompt } from "../lib/exportSuccessPrompt";
import { revealVaultItem } from "../lib/vault";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import { useVaultStore } from "../stores/vaultStore";

export function useDocumentActions(previewHtml: string) {
  const {
    filePath,
    manifest,
    workspaceId,
    newDocument,
    openDocument,
    saveDocument,
    insertText,
    setRecentFiles,
  } = useDocumentStore();

  const updateTitle = async (path?: string | null) => {
    const name = path?.split(/[/\\]/).pop() ?? "未命名文档";
    await getCurrentWindow().setTitle(`MDX Editor - ${name}`);
  };

  const refreshVaultTree = async () => {
    await useVaultStore.getState().refreshTree();
  };

  const handleNew = async () => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      try {
        const path = await useVaultStore.getState().createDocument();
        if (!path) return;
        const entries = await openDocument(path);
        setRecentFiles(entries);
        await updateTitle(path);
        await refreshVaultTree();
      } catch (error) {
        await message(String(error), { title: "创建文档失败", kind: "error" });
      }
      useUiStore.getState().enterEditor();
      return;
    }
    await newDocument();
    await updateTitle(null);
    useUiStore.getState().enterEditor();
  };

  const handleOpen = async () => {
    const selected = await open({
      multiple: false,
      title: "打开文档",
      filters: [...MARKDOWN_DOCUMENT_OPEN_FILTERS],
    });
    if (typeof selected === "string") {
      try {
        const entries = await openDocument(selected);
        setRecentFiles(entries);
        await updateTitle(selected);
        useUiStore.getState().enterEditor();
      } catch (error) {
        await message(String(error), { title: "打开失败", kind: "error" });
      }
    }
  };

  const handleSave = async () => {
    if (filePath && isPlainMdPath(filePath)) {
      const choice = await promptPlainMdSaveChoice();
      if (choice === "mdx") {
        const selected = await save({
          title: "另存为 MDX",
          filters: [...MDX_SAVE_FILTER],
          defaultPath: defaultSavePath(filePath, "mdx"),
        });
        if (typeof selected !== "string") return;
        const entries = await saveDocument(selected);
        if (entries) setRecentFiles(entries);
        await refreshVaultTree();
        await updateTitle(selected);
        return;
      }

      await saveDocument();
      await refreshVaultTree();
      await updateTitle(filePath);
      return;
    }

    if (filePath) {
      await saveDocument();
      await refreshVaultTree();
      return;
    }

    const selected = await save({
      title: "保存文档",
      filters: [...MARKDOWN_DOCUMENT_SAVE_FILTERS],
      defaultPath: defaultSavePath(null, "mdx"),
    });
    if (typeof selected === "string") {
      const entries = await saveDocument(selected);
      if (entries) setRecentFiles(entries);
      await refreshVaultTree();
      await updateTitle(selected);
    }
  };

  const handleSaveAs = async () => {
    const selected = await save({
      title: "另存为",
      filters: [...MARKDOWN_DOCUMENT_SAVE_FILTERS],
      defaultPath: defaultSavePath(filePath, isPlainMdPath(filePath ?? "") ? "md" : "mdx"),
    });
    if (typeof selected === "string") {
      const entries = await saveDocument(selected);
      if (entries) setRecentFiles(entries);
      await refreshVaultTree();
      await updateTitle(selected);
    }
  };

  const insertAssetFromDialog = async (
    title: string,
    filters: { name: string; extensions: string[] }[],
  ) => {
    if (!workspaceId) {
      await message("请先新建或打开文档后再插入资源。", { title: "无法插入", kind: "warning" });
      return;
    }

    const selected = await open({
      multiple: false,
      title,
      filters,
    });
    if (typeof selected !== "string") return;

    try {
      const snippet = await insertResourceFromPath(workspaceId, selected);
      insertText(`\n${snippet}\n`);
    } catch (error) {
      if (isMediaInsertCancelled(error)) return;
      await message(String(error), { title: "插入失败", kind: "error" });
    }
  };

  const handleInsertImage = async () => {
    await insertAssetFromDialog("插入图片", IMAGE_INSERT_OPEN_FILTERS);
  };

  const handleInsertVideo = async () => {
    await insertAssetFromDialog("插入视频", VIDEO_INSERT_OPEN_FILTERS);
  };

  const handleInsertAudio = async () => {
    await insertAssetFromDialog("插入音频", AUDIO_INSERT_OPEN_FILTERS);
  };

  const handleInsertMedia = async () => {
    await insertAssetFromDialog("插入音视频", MEDIA_INSERT_OPEN_FILTERS);
  };

  const confirmExportSuccess = async (outputPath: string, formatLabel: string) => {
    const action = await requestExportSuccessPrompt(outputPath, formatLabel);
    if (action !== "open") return;
    try {
      await revealVaultItem(outputPath);
    } catch (error) {
      await message(String(error), { title: "无法打开位置", kind: "error" });
    }
  };

  const handleExportMarkdown = async () => {
    if (!workspaceId) return;
    const selected = await save({
      title: "导出 Markdown",
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
      defaultPath: "导出.md",
    });
    if (typeof selected !== "string") return;

    try {
      await invoke("export_markdown", {
        workspaceId,
        outputPath: selected,
        includeAssets: true,
      });
      await confirmExportSuccess(selected, "Markdown 文档");
    } catch (error) {
      await message(String(error), { title: "导出失败", kind: "error" });
    }
  };

  const handleExportHtml = async () => {
    if (!workspaceId) return;
    const selected = await save({
      title: "导出 HTML",
      filters: [{ name: "HTML 网页", extensions: ["html"] }],
      defaultPath: "导出.html",
    });
    if (typeof selected !== "string") return;

    try {
      const title = manifest?.title ?? "未命名文档";
      const html = buildExportHtml(title, previewHtml);
      await invoke("export_html", { outputPath: selected, html });
      await confirmExportSuccess(selected, "HTML 网页");
    } catch (error) {
      await message(String(error), { title: "导出失败", kind: "error" });
    }
  };

  const handleExportEncryptedMdx = async () => {
    if (!workspaceId) return;
    const { password } = await requestDocumentPassword({
      title: "加密导出 MDX",
      description: "设置密码后，导出的 MDX 文件将加密存储；打开时需要输入相同密码。",
      confirm: true,
      submitLabel: "加密导出",
    });
    if (!password) return;

    const selected = await save({
      title: "加密导出 MDX",
      filters: [...MDX_SAVE_FILTER],
      defaultPath: defaultSavePath(filePath, "mdx"),
    });
    if (typeof selected !== "string") return;

    try {
      await invoke("export_encrypted_mdx", {
        workspaceId,
        outputPath: selected,
        password,
      });
      await confirmExportSuccess(selected, "加密 MDX 文件");
    } catch (error) {
      await message(String(error), { title: "加密导出失败", kind: "error" });
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      const entries = await openDocument(path);
      setRecentFiles(entries);
      await updateTitle(path);
      useUiStore.getState().enterEditor();
    } catch (error) {
      if (isDocumentNotFoundError(error)) {
        const remove = await promptRemoveMissingRecentDocument(path, error);
        if (remove) {
          setRecentFiles(await removeRecentFile(path));
        }
        return;
      }
      await message(formatDocumentOpenError(path, error), {
        title: "无法打开文档",
        kind: "warning",
      });
    }
  };

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleInsertImage,
    handleInsertAudio,
    handleInsertVideo,
    handleInsertMedia,
    handleExportMarkdown,
    handleExportHtml,
    handleExportEncryptedMdx,
    handleOpenPath,
  };
}
