import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Ribbon } from "./components/Ribbon";
import { EditorLayout } from "./components/EditorLayout";
import { RecentFilesPage } from "./components/RecentFilesPage";
import { UnsavedDialog } from "./components/UnsavedDialog";
import { useAutosave } from "./hooks/useAutosave";
import { usePrintLayout } from "./hooks/usePrintLayout";
import { useWindowState } from "./hooks/useWindowState";
import { getRecentFileEntries } from "./lib/recentFiles";
import { isInsertablePath, isMdxPath } from "./lib/media";
import { useDocumentStore } from "./stores/documentStore";
import { useUiStore } from "./stores/uiStore";
import { useVaultStore } from "./stores/vaultStore";
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
  const switchDialogOpen = useUiStore((s) => s.switchDialogOpen);
  const resolveDocumentSwitch = useUiStore((s) => s.resolveDocumentSwitch);
  const initializeVault = useVaultStore((s) => s.initialize);

  const openExternalDocument = useCallback(async (path: string) => {
    await openDocument(path);
    setAppView("editor");
    setSearchOpen(false);
    await getCurrentWindow().setTitle(
      `MDX Editor - ${path.split(/[/\\]/).pop()}`,
    );
  }, [openDocument, setAppView, setSearchOpen]);

  useAutosave();
  useWindowState();
  const { printDocument } = usePrintLayout();

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    void (async () => {
      const recent = await getRecentFileEntries();
      setRecentFiles(recent);
      await initializeVault();

      const launchPath = await invoke<string | null>("take_launch_file");
      if (launchPath) {
        await openExternalDocument(launchPath);
      } else {
        await newDocument();
      }
    })();
  }, [newDocument, openExternalDocument, setRecentFiles, initializeVault]);

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
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type !== "drop") return;

        void (async () => {
          for (const path of payload.paths) {
            if (isMdxPath(path)) {
              await openExternalDocument(path);
              continue;
            }

            if (!isInsertablePath(path)) continue;

            const { workspaceId, insertAtCursor } = useDocumentStore.getState();
            if (!workspaceId || !insertAtCursor) continue;

            try {
              const snippet = await invoke<string>("insert_asset_from_path", {
                workspaceId,
                sourcePath: path,
              });
              insertAtCursor(`\n${snippet}\n`);
              useUiStore.getState().setAppView("editor");
            } catch (error) {
              console.warn("拖放插入资源失败:", error);
            }
          }
        })();
      })
      .then((fn) => {
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
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "p") {
        event.preventDefault();
        printDocument();
      }
      if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDocument, searchOpen, setSearchOpen, printDocument]);

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
      <Ribbon previewHtml={previewHtml} onPrint={printDocument} />
      <main className="main-content">
        {appView === "editor" ? <EditorLayout /> : <RecentFilesPage />}
      </main>

      <UnsavedDialog
        open={closeDialogOpen}
        onSave={() => void handleCloseSave()}
        onDiscard={() => void handleCloseDiscard()}
        onCancel={() => setCloseDialogOpen(false)}
      />

      <UnsavedDialog
        open={switchDialogOpen}
        title="切换文档"
        message="当前文档有未保存的更改，切换前是否保存？"
        onSave={() => resolveDocumentSwitch("save")}
        onDiscard={() => resolveDocumentSwitch("discard")}
        onCancel={() => resolveDocumentSwitch("cancel")}
      />
    </div>
  );
}

export default App;
