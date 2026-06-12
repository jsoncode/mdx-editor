import { invoke } from "@tauri-apps/api/core";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { buildExportHtml } from "../lib/export";
import {
  defaultSavePath,
  isPlainMdPath,
  MARKDOWN_DOCUMENT_OPEN_FILTERS,
  MARKDOWN_DOCUMENT_SAVE_FILTERS,
  MDX_SAVE_FILTER,
} from "../lib/documentPaths";
import { promptPlainMdSaveChoice } from "../lib/savePrompt";
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

  const handleInsertImage = async () => {
    const selected = await open({
      multiple: false,
      title: "插入图片",
      filters: [
        {
          name: "图片",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
        },
      ],
    });
    if (typeof selected === "string" && workspaceId) {
      const snippet = await invoke<string>("insert_asset_from_path", {
        workspaceId,
        sourcePath: selected,
      });
      insertText(`\n${snippet}\n`);
    }
  };

  const handleInsertMedia = async () => {
    const selected = await open({
      multiple: false,
      title: "插入媒体",
      filters: [
        {
          name: "音视频",
          extensions: ["mp4", "webm", "mov", "mp3", "wav", "ogg", "flac", "aac", "m4a"],
        },
      ],
    });
    if (typeof selected === "string" && workspaceId) {
      const snippet = await invoke<string>("insert_asset_from_path", {
        workspaceId,
        sourcePath: selected,
      });
      insertText(`\n${snippet}\n`);
    }
  };

  const handleExportMarkdown = async () => {
    if (!workspaceId) return;
    const selected = await save({
      title: "导出 Markdown",
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
      defaultPath: "导出.md",
    });
    if (typeof selected === "string") {
      await invoke("export_markdown", {
        workspaceId,
        outputPath: selected,
        includeAssets: true,
      });
    }
  };

  const handleExportHtml = async () => {
    if (!workspaceId) return;
    const selected = await save({
      title: "导出 HTML",
      filters: [{ name: "HTML 网页", extensions: ["html"] }],
      defaultPath: "导出.html",
    });
    if (typeof selected === "string") {
      const title = manifest?.title ?? "未命名文档";
      const html = buildExportHtml(title, previewHtml);
      await invoke("export_html", { outputPath: selected, html });
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      const entries = await openDocument(path);
      setRecentFiles(entries);
      await updateTitle(path);
      useUiStore.getState().enterEditor();
    } catch (error) {
      await message(String(error), { title: "打开失败", kind: "error" });
    }
  };

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleInsertImage,
    handleInsertMedia,
    handleExportMarkdown,
    handleExportHtml,
    handleOpenPath,
  };
}
