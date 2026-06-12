import { getCurrentWindow } from "@tauri-apps/api/window";
import { message, open } from "@tauri-apps/plugin-dialog";
import { getFileName } from "../lib/recentFiles";
import { MARKDOWN_DOCUMENT_OPEN_FILTERS } from "../lib/documentPaths";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import { useVaultStore } from "../stores/vaultStore";

export function useWelcomeActions() {
  const newDocument = useDocumentStore((s) => s.newDocument);
  const openDocument = useDocumentStore((s) => s.openDocument);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const workspaceId = useDocumentStore((s) => s.workspaceId);

  const openVault = useVaultStore((s) => s.openVault);
  const createDocument = useVaultStore((s) => s.createDocument);
  const createWorkspace = useVaultStore((s) => s.createWorkspace);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const enterEditor = useUiStore((s) => s.enterEditor);
  const setAppView = useUiStore((s) => s.setAppView);

  const ensureEditorSession = async () => {
    if (!useDocumentStore.getState().workspaceId) {
      await newDocument();
      await getCurrentWindow().setTitle("MDX Editor - 未命名文档");
    }
    enterEditor();
  };

  const updateTitle = async (path: string) => {
    await getCurrentWindow().setTitle(`MDX Editor - ${getFileName(path)}`);
  };

  const openWorkspace = async (path?: string) => {
    try {
      if (path) {
        await openVault(path);
      } else {
        const selected = await open({
          directory: true,
          multiple: false,
          title: "打开工作区文件夹",
        });
        if (typeof selected !== "string") return;
        await openVault(selected);
      }
      await ensureEditorSession();
    } catch (error) {
      await message(String(error), { title: "打开工作区失败", kind: "error" });
    }
  };

  const createNewWorkspace = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      await message("请输入工作区名称", { title: "无法创建", kind: "warning" });
      return;
    }

    const parent = await open({
      directory: true,
      multiple: false,
      title: "选择工作区所在位置",
    });
    if (typeof parent !== "string") return;

    try {
      await createWorkspace(parent, trimmed);
      await ensureEditorSession();
    } catch (error) {
      await message(String(error), { title: "创建工作区失败", kind: "error" });
    }
  };

  const openFile = async (path?: string) => {
    if (path) {
      try {
        const entries = await openDocument(path);
        setRecentFiles(entries);
        await updateTitle(path);
        enterEditor();
      } catch (error) {
        await message(String(error), { title: "打开失败", kind: "error" });
      }
      return;
    }

    const selected = await open({
      multiple: false,
      title: "打开文档",
      filters: [...MARKDOWN_DOCUMENT_OPEN_FILTERS],
    });
    if (typeof selected !== "string") return;

    try {
      const entries = await openDocument(selected);
      setRecentFiles(entries);
      await updateTitle(selected);
      enterEditor();
    } catch (error) {
      await message(String(error), { title: "打开失败", kind: "error" });
    }
  };

  const createNewFile = async () => {
    try {
      if (vaultPath) {
        const path = await createDocument();
        if (!path) return;
        const entries = await openDocument(path);
        setRecentFiles(entries);
        await updateTitle(path);
      } else {
        await newDocument();
        await getCurrentWindow().setTitle("MDX Editor - 未命名文档");
      }
      enterEditor();
    } catch (error) {
      await message(String(error), { title: "创建文档失败", kind: "error" });
    }
  };

  const continueInWorkspace = async () => {
    if (!vaultPath) return;
    await ensureEditorSession();
  };

  const openRecentDocumentsPage = () => {
    setAppView("recent");
  };

  return {
    vaultPath,
    workspaceId,
    openWorkspace,
    createNewWorkspace,
    openFile,
    createNewFile,
    continueInWorkspace,
    openRecentDocumentsPage,
    enterEditor,
  };
}
