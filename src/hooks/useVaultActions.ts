import { getCurrentWindow } from "@tauri-apps/api/window";
import { message, open } from "@tauri-apps/plugin-dialog";
import { getFileName } from "../lib/recentFiles";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import { useVaultStore } from "../stores/vaultStore";

export function useVaultActions() {
  const openDocument = useDocumentStore((s) => s.openDocument);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const filePath = useDocumentStore((s) => s.filePath);
  const isDirty = useDocumentStore((s) => s.isDirty);

  const openVault = useVaultStore((s) => s.openVault);
  const closeVault = useVaultStore((s) => s.closeVault);
  const createDocument = useVaultStore((s) => s.createDocument);
  const refreshTree = useVaultStore((s) => s.refreshTree);
  const expandToFile = useVaultStore((s) => s.expandToFile);

  const requestDocumentSwitch = useUiStore((s) => s.requestDocumentSwitch);
  const setAppView = useUiStore((s) => s.setAppView);

  const updateTitle = async (path: string) => {
    await getCurrentWindow().setTitle(`MDX Editor - ${getFileName(path)}`);
  };

  const openFile = async (path: string) => {
    if (path === filePath) return;

    const entries = await openDocument(path);
    setRecentFiles(entries);
    await updateTitle(path);
    setAppView("editor");
    expandToFile(path);
    await refreshTree();
  };

  const handleOpenFileInVault = (path: string) => {
    requestDocumentSwitch(() => openFile(path));
  };

  const handleOpenVault = async () => {
    const run = async () => {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "打开工作区文件夹",
      });
      if (typeof selected !== "string") return;
      try {
        await openVault(selected);
      } catch (error) {
        await message(String(error), { title: "打开工作区失败", kind: "error" });
      }
    };

    if (isDirty) {
      requestDocumentSwitch(run);
    } else {
      await run();
    }
  };

  const handleCloseVault = async () => {
    await closeVault();
  };

  const handleNewDocumentInVault = async () => {
    const run = async () => {
      try {
        const path = await createDocument();
        if (!path) return;
        await openFile(path);
      } catch (error) {
        await message(String(error), { title: "创建文档失败", kind: "error" });
      }
    };

    if (isDirty) {
      requestDocumentSwitch(run);
    } else {
      await run();
    }
  };

  const handleSaveAndContinue = async (action: () => Promise<void>) => {
    if (filePath) {
      await saveDocument();
    } else {
      await message("请先保存当前文档", { title: "无法切换", kind: "warning" });
      return;
    }
    await action();
  };

  return {
    handleOpenVault,
    handleCloseVault,
    handleNewDocumentInVault,
    handleOpenFileInVault,
    handleSaveAndContinue,
  };
}
