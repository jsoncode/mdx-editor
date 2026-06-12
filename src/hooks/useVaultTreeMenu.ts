import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useState } from "react";
import { mdPathToMdxPath, isPlainMdPath } from "../lib/documentPaths";import {
  deleteVaultFile,
  deleteVaultFolder,
  getRelativeVaultPath,
  getVaultItemInfo,
  renameVaultItem,
  revealVaultItem,
} from "../lib/vault";
import { getFileName, removeRecentFile, addRecentFile } from "../lib/recentFiles";
import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";
import type { VaultContextTarget, VaultItemInfo, VaultItemTarget } from "../types/vault";

export function useVaultTreeMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: VaultContextTarget;
  } | null>(null);
  const [infoItem, setInfoItem] = useState<VaultItemInfo | null>(null);
  const [renameTarget, setRenameTarget] = useState<VaultItemTarget | null>(null);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const refreshTree = useVaultStore((s) => s.refreshTree);
  const setSelectedFolder = useVaultStore((s) => s.setSelectedFolder);
  const expandToFile = useVaultStore((s) => s.expandToFile);
  const createDocument = useVaultStore((s) => s.createDocument);

  const filePath = useDocumentStore((s) => s.filePath);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const setFilePath = useDocumentStore((s) => s.setFilePath);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenu = useCallback(
    (event: React.MouseEvent, target: VaultContextTarget) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, target });
    },
    [],
  );

  const openWorkspaceContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!vaultPath) return;
      event.preventDefault();
      event.stopPropagation();
      const folderRelative = useVaultStore.getState().selectedFolder;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: "workspace", vaultPath, folderRelative },
      });
    },
    [vaultPath],
  );

  const showInfo = useCallback(
    async (target: VaultItemTarget) => {
      if (!vaultPath) return;
      try {
        const info = await getVaultItemInfo(vaultPath, target.path);
        setInfoItem(info);
      } catch (error) {
        await message(String(error), { title: "无法读取信息", kind: "error" });
      }
    },
    [vaultPath],
  );

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      await message(String(error), { title: "复制失败", kind: "error" });
    }
  }, []);

  const revealInExplorer = useCallback(async (path: string) => {
    try {
      await revealVaultItem(path);
    } catch (error) {
      await message(String(error), { title: "无法打开所在位置", kind: "error" });
    }
  }, []);

  const deleteFile = useCallback(
    async (target: Extract<VaultContextTarget, { kind: "file" }>) => {
      if (!vaultPath) return;

      const confirmed = await ask(`确定删除「${target.name}」？此操作不可撤销。`, {
        title: "删除文件",
        kind: "warning",
        okLabel: "删除",
        cancelLabel: "取消",
      });
      if (!confirmed) return;

      try {
        await deleteVaultFile(vaultPath, target.path);
        const recent = await removeRecentFile(target.path);
        setRecentFiles(recent);

        if (filePath === target.path) {
          await newDocument();
          await getCurrentWindow().setTitle("MDX Editor - 未命名文档");
        }

        await refreshTree();
      } catch (error) {
        await message(String(error), { title: "删除失败", kind: "error" });
      }
    },
    [vaultPath, filePath, newDocument, refreshTree, setRecentFiles],
  );

  const deleteFolder = useCallback(
    async (target: Extract<VaultContextTarget, { kind: "folder" }>) => {
      if (!vaultPath) return;

      let info: VaultItemInfo | null = null;
      try {
        info = await getVaultItemInfo(vaultPath, target.path);
      } catch {
        info = null;
      }

      const fileCount = info?.fileCount ?? 0;
      const folderCount = info?.folderCount ?? 0;
      const detail =
        fileCount + folderCount > 0
          ? `其中包含 ${fileCount} 个文档、${folderCount} 个子文件夹。`
          : "该文件夹为空。";

      const confirmed = await ask(
        `确定删除文件夹「${target.name}」？${detail}此操作不可撤销。`,
        {
          title: "删除文件夹",
          kind: "warning",
          okLabel: "删除",
          cancelLabel: "取消",
        },
      );
      if (!confirmed) return;

      try {
        await deleteVaultFolder(vaultPath, target.relativePath);

        if (filePath && filePath.replace(/\\/g, "/").startsWith(`${target.path.replace(/\\/g, "/")}/`)) {
          await newDocument();
          await getCurrentWindow().setTitle("MDX Editor - 未命名文档");
        }

        await refreshTree();
      } catch (error) {
        await message(String(error), { title: "删除失败", kind: "error" });
      }
    },
    [vaultPath, filePath, newDocument, refreshTree],
  );

  const submitRename = useCallback(
    async (target: VaultItemTarget, newName: string) => {
      if (!vaultPath) return;

      const trimmed = newName.trim();
      if (!trimmed) {
        await message("名称不能为空", { title: "无法重命名", kind: "warning" });
        return;
      }

      try {
        const newAbsolutePath = await renameVaultItem(
          vaultPath,
          target.relativePath,
          trimmed,
          target.kind === "folder",
        );

        if (target.kind === "file" && filePath === target.path) {
          setFilePath(newAbsolutePath);
          if (workspaceId) {
            await invoke("set_document_file_path", {
              workspaceId,
              path: newAbsolutePath,
            });
          }
          await getCurrentWindow().setTitle(`MDX Editor - ${getFileName(newAbsolutePath)}`);
          expandToFile(newAbsolutePath);
          const recent = await addRecentFile(newAbsolutePath);
          setRecentFiles(recent);
        } else if (target.kind === "file") {
          const recent = await removeRecentFile(target.path);
          setRecentFiles(recent);
        }

        await refreshTree();
        setRenameTarget(null);
      } catch (error) {
        await message(String(error), { title: "重命名失败", kind: "error" });
      }
    },
    [vaultPath, filePath, workspaceId, setFilePath, expandToFile, refreshTree, setRecentFiles],
  );

  const createDocumentInFolder = useCallback(
    async (
      target: Extract<VaultContextTarget, { kind: "folder" }>,
      format: "mdx" | "md" = "mdx",
    ) => {
      setSelectedFolder(target.relativePath);
      try {
        const path = await createDocument("未命名", format, target.relativePath);
        if (!path) return;
        return path;
      } catch (error) {
        await message(String(error), { title: "创建文档失败", kind: "error" });
        return null;
      }
    },
    [createDocument, setSelectedFolder],
  );

  const createDocumentInWorkspace = useCallback(
    async (folderRelative: string, format: "mdx" | "md") => {
      setSelectedFolder(folderRelative);
      try {
        const path = await createDocument("未命名", format, folderRelative);
        if (!path) return;
        return path;
      } catch (error) {
        await message(String(error), { title: "创建文档失败", kind: "error" });
        return null;
      }
    },
    [createDocument, setSelectedFolder],
  );

  const convertMdToMdx = useCallback(
    async (target: Extract<VaultContextTarget, { kind: "file" }>) => {
      if (!isPlainMdPath(target.path)) return;

      const outputPath = mdPathToMdxPath(target.path);

      if (filePath === target.path && workspaceId) {
        const confirmed = await ask(
          "将当前 Markdown 文档转换为 MDX，本地引用的图片与附件会复制到 asset 并打包进 MDX。是否继续？",
          {
            title: "转换为 MDX",
            kind: "info",
            okLabel: "转换并保存",
            cancelLabel: "取消",
          },
        );
        if (!confirmed) return;

        try {
          const saveDocument = useDocumentStore.getState().saveDocument;
          const recent = await saveDocument(outputPath);
          if (recent) setRecentFiles(recent);
          await refreshTree();
        } catch (error) {
          await message(String(error), { title: "转换失败", kind: "error" });
        }
        return;
      }

      const confirmed = await ask(
        `将「${target.name}」转换为 MDX 格式？\n\n会扫描正文中的本地图片、附件等引用，复制到 asset 并打包进 MDX 文件。`,
        {
          title: "转换为 MDX",
          kind: "info",
          okLabel: "转换",
          cancelLabel: "取消",
        },
      );
      if (!confirmed) return;

      try {
        const resultPath = await invoke<string>("convert_md_file_to_mdx", {
          mdPath: target.path,
          outputPath: outputPath,
        });
        const recent = await addRecentFile(resultPath);
        setRecentFiles(recent);
        await refreshTree();
        await message(`已转换为 ${resultPath.split(/[/\\]/).pop()}`, {
          title: "转换完成",
          kind: "info",
        });
      } catch (error) {
        await message(String(error), { title: "转换失败", kind: "error" });
      }
    },
    [filePath, workspaceId, refreshTree, setRecentFiles],
  );

  const buildFileContextTarget = useCallback(
    (path: string, name: string): VaultContextTarget => {
      if (!vaultPath) {
        return { kind: "file", path, name, relativePath: name };
      }
      return {
        kind: "file",
        path,
        name,
        relativePath: getRelativeVaultPath(vaultPath, path),
      };
    },
    [vaultPath],
  );

  const buildFolderContextTarget = useCallback(
    (path: string, name: string, relativePath: string): VaultContextTarget => ({
      kind: "folder",
      path,
      name,
      relativePath,
    }),
    [],
  );

  return {
    contextMenu,
    infoItem,
    renameTarget,
    closeContextMenu,
    openContextMenu,
    openWorkspaceContextMenu,
    showInfo,
    copyPath,
    revealInExplorer,
    deleteFile,
    deleteFolder,
    submitRename,
    createDocumentInFolder,
    createDocumentInWorkspace,
    convertMdToMdx,
    setInfoItem,
    setRenameTarget,
    buildFileContextTarget,
    buildFolderContextTarget,
  };
}
