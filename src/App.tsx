import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Ribbon } from "./components/Ribbon";
import { RecentFilesPage } from "./components/RecentFilesPage";
import { SplitEditor } from "./components/SplitEditor";
import { UnsavedDialog } from "./components/UnsavedDialog";
import { useAutosave } from "./hooks/useAutosave";
import { useWindowState } from "./hooks/useWindowState";
import { getRecentFileEntries } from "./lib/recentFiles";
import { useDocumentStore } from "./stores/documentStore";
import { useUiStore } from "./stores/uiStore";
import "./App.css";

function App() {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const forceClosingRef = useRef(false);
  const isDirtyRef = useRef(false);

  const isDirty = useDocumentStore((s) => s.isDirty);
  const previewHtml = useDocumentStore((s) => s.previewHtml);
  const filePath = useDocumentStore((s) => s.filePath);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const openDocument = useDocumentStore((s) => s.openDocument);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const resetDirty = useDocumentStore((s) => s.resetDirty);
  const appView = useUiStore((s) => s.appView);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setAppView = useUiStore((s) => s.setAppView);

  const openExternalDocument = useCallback(async (path: string) => {
    await openDocument(path);
    setAppView("editor");
    setSearchOpen(false);
    await getCurrentWindow().setTitle(
      `MDX 编辑器 - ${path.split(/[/\\]/).pop()}`,
    );
  }, [openDocument, setAppView, setSearchOpen]);

  useAutosave();
  useWindowState();

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    void (async () => {
      const recent = await getRecentFileEntries();
      setRecentFiles(recent);

      const launchPath = await invoke<string | null>("take_launch_file");
      if (launchPath) {
        await openExternalDocument(launchPath);
      } else {
        await newDocument();
      }
    })();
  }, [newDocument, openExternalDocument, setRecentFiles]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<string>("open-document", (event) => {
      void openExternalDocument(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [openExternalDocument]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void saveDocument();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        useUiStore.getState().setSearchOpen(true);
        useUiStore.getState().setAppView("editor");
        useUiStore.getState().setRibbonTab("view");
      }
      if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDocument, searchOpen, setSearchOpen]);

  const forceDestroy = useCallback(async () => {
    forceClosingRef.current = true;
    isDirtyRef.current = false;
    setCloseDialogOpen(false);
    await getCurrentWindow().destroy();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (forceClosingRef.current) return;
        if (!isDirtyRef.current) return;
        event.preventDefault();
        setCloseDialogOpen(true);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleCloseSave = async () => {
    try {
      if (!filePath) {
        const selected = await save({
          title: "保存文档",
          filters: [{ name: "MDX 文档", extensions: ["mdx"] }],
          defaultPath: "未命名文档.mdx",
        });
        if (typeof selected !== "string") return;
        await saveDocument(selected);
      } else {
        await saveDocument();
      }
      resetDirty();
      isDirtyRef.current = false;
      await forceDestroy();
    } catch (error) {
      console.error("保存失败:", error);
    }
  };

  const handleCloseDiscard = async () => {
    resetDirty();
    await forceDestroy();
  };

  return (
    <div className="app">
      <Ribbon previewHtml={previewHtml} />
      <main className="main-content">
        {appView === "editor" ? <SplitEditor /> : <RecentFilesPage />}
      </main>

      <UnsavedDialog
        open={closeDialogOpen}
        onSave={() => void handleCloseSave()}
        onDiscard={() => void handleCloseDiscard()}
        onCancel={() => setCloseDialogOpen(false)}
      />
    </div>
  );
}

export default App;
