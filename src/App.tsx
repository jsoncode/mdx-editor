import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Ribbon } from "./components/Ribbon";
import { EditorLayout } from "./components/EditorLayout";
import { RecentFilesPage } from "./components/RecentFilesPage";
import { WelcomePage } from "./components/WelcomePage";
import { UnsavedDialog } from "./components/UnsavedDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { DocumentHistoryDialog } from "./components/DocumentHistoryDialog";
import { DocumentPropertiesDialog } from "./components/DocumentPropertiesDialog";
import { useAutosave } from "./hooks/useAutosave";
import { useDocumentActions } from "./hooks/useDocumentActions";
import { usePrintLayout } from "./hooks/usePrintLayout";
import { useWindowState } from "./hooks/useWindowState";
import { getRecentFileEntries } from "./lib/recentFiles";
import { isInsertablePath, isMarkdownDocumentPath } from "./lib/media";
import { MARKDOWN_DOCUMENT_SAVE_FILTERS, defaultSavePath, isPlainMdPath } from "./lib/documentPaths";
import { promptPlainMdSaveChoice } from "./lib/savePrompt";
import { isIdleSession } from "./lib/session";
import { useDocumentStore } from "./stores/documentStore";
import { useUiStore } from "./stores/uiStore";
import { useVaultStore } from "./stores/vaultStore";
import { useSettingsStore } from "./stores/settingsStore";
import "./App.css";

function App() {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false);
  const forceClosingRef = useRef(false);
  const isDirtyRef = useRef(false);

  const isDirty = useDocumentStore((s) => s.isDirty);
  const previewHtml = useDocumentStore((s) => s.previewHtml);
  const filePath = useDocumentStore((s) => s.filePath);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const openDocument = useDocumentStore((s) => s.openDocument);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const resetDirty = useDocumentStore((s) => s.resetDirty);
  const closeDocument = useDocumentStore((s) => s.closeDocument);
  const appView = useUiStore((s) => s.appView);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const manifest = useDocumentStore((s) => s.manifest);
  const historyOpen = useUiStore((s) => s.historyOpen);
  const propertiesOpen = useUiStore((s) => s.propertiesOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setAppView = useUiStore((s) => s.setAppView);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setHistoryOpen = useUiStore((s) => s.setHistoryOpen);
  const setPropertiesOpen = useUiStore((s) => s.setPropertiesOpen);
  const switchDialogOpen = useUiStore((s) => s.switchDialogOpen);
  const resolveDocumentSwitch = useUiStore((s) => s.resolveDocumentSwitch);
  const initializeVault = useVaultStore((s) => s.initialize);
  const initializeSettings = useSettingsStore((s) => s.initialize);

  const openExternalDocument = useCallback(async (path: string) => {
    await openDocument(path);
    useUiStore.getState().enterEditor();
    setSearchOpen(false);
    await getCurrentWindow().setTitle(
      `MDX Editor - ${path.split(/[/\\]/).pop()}`,
    );
  }, [openDocument, setSearchOpen]);

  useAutosave();
  useWindowState();
  const { printDocument } = usePrintLayout();
  const { handleNew, handleOpen } = useDocumentActions(previewHtml);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    void (async () => {
      const recent = await getRecentFileEntries();
      setRecentFiles(recent);
      await Promise.all([initializeVault(), initializeSettings()]);

      const launchPath = await invoke<string | null>("take_launch_file");
      if (launchPath) {
        await openExternalDocument(launchPath);
      } else {
        setAppView("welcome");
      }
    })();
  }, [openExternalDocument, setRecentFiles, initializeVault, initializeSettings, setAppView]);

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
            if (isMarkdownDocumentPath(path)) {
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

  const forceDestroy = useCallback(async () => {
    forceClosingRef.current = true;
    isDirtyRef.current = false;
    setCloseDialogOpen(false);
    await getCurrentWindow().destroy();
  }, []);

  const returnToWelcomeAfterClose = useCallback(async () => {
    await closeDocument();
    setAppView("welcome");
    setSearchOpen(false);
    await getCurrentWindow().setTitle("MDX Editor");
  }, [closeDocument, setAppView, setSearchOpen]);

  const requestCloseApp = useCallback(async () => {
    if (isDirtyRef.current) {
      setCloseDialogOpen(true);
      return;
    }
    await forceDestroy();
  }, [forceDestroy]);

  const requestCloseDocument = useCallback(() => {
    if (closeDialogOpen || documentCloseDialogOpen || switchDialogOpen) return;

    if (isIdleSession()) {
      void requestCloseApp();
      return;
    }

    if (isDirtyRef.current) {
      setDocumentCloseDialogOpen(true);
      return;
    }

    void returnToWelcomeAfterClose();
  }, [
    closeDialogOpen,
    documentCloseDialogOpen,
    switchDialogOpen,
    requestCloseApp,
    returnToWelcomeAfterClose,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        event.preventDefault();
        void handleNew();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "o") {
        event.preventDefault();
        void handleOpen();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void saveDocument();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "w") {
        event.preventDefault();
        requestCloseDocument();
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
  }, [
    saveDocument,
    searchOpen,
    setSearchOpen,
    printDocument,
    handleNew,
    handleOpen,
    requestCloseDocument,
  ]);

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
          filters: [...MARKDOWN_DOCUMENT_SAVE_FILTERS],
          defaultPath: defaultSavePath(null, "mdx"),
        });
        if (typeof selected !== "string") return;
        await saveDocument(selected);
      } else if (isPlainMdPath(filePath)) {
        const choice = await promptPlainMdSaveChoice();
        if (choice === "mdx") {
          const selected = await save({
            title: "另存为 MDX",
            filters: [{ name: "MDX 文档", extensions: ["mdx"] }],
            defaultPath: defaultSavePath(filePath, "mdx"),
          });
          if (typeof selected !== "string") return;
          await saveDocument(selected);
        } else {
          await saveDocument();
        }
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

  const handleDocumentCloseSave = async () => {
    try {
      if (!filePath) {
        const selected = await save({
          title: "保存文档",
          filters: [...MARKDOWN_DOCUMENT_SAVE_FILTERS],
          defaultPath: defaultSavePath(null, "mdx"),
        });
        if (typeof selected !== "string") return;
        await saveDocument(selected);
      } else if (isPlainMdPath(filePath)) {
        const choice = await promptPlainMdSaveChoice();
        if (choice === "mdx") {
          const selected = await save({
            title: "另存为 MDX",
            filters: [{ name: "MDX 文档", extensions: ["mdx"] }],
            defaultPath: defaultSavePath(filePath, "mdx"),
          });
          if (typeof selected !== "string") return;
          await saveDocument(selected);
        } else {
          await saveDocument();
        }
      } else {
        await saveDocument();
      }
      resetDirty();
      isDirtyRef.current = false;
      setDocumentCloseDialogOpen(false);
      await returnToWelcomeAfterClose();
    } catch (error) {
      console.error("保存失败:", error);
    }
  };

  const handleDocumentCloseDiscard = async () => {
    isDirtyRef.current = false;
    setDocumentCloseDialogOpen(false);
    await returnToWelcomeAfterClose();
  };

  return (
    <div className="app">
      <Ribbon previewHtml={previewHtml} onPrint={printDocument} />
      <main className="main-content">
        {appView === "welcome" && <WelcomePage />}
        {appView === "editor" && <EditorLayout />}
        {appView === "recent" && <RecentFilesPage />}
      </main>

      <UnsavedDialog
        open={closeDialogOpen}
        onSave={() => void handleCloseSave()}
        onDiscard={() => void handleCloseDiscard()}
        onCancel={() => setCloseDialogOpen(false)}
      />

      <UnsavedDialog
        open={documentCloseDialogOpen}
        title="关闭文档"
        message="文档有未保存的更改，是否在关闭前保存？"
        onSave={() => void handleDocumentCloseSave()}
        onDiscard={() => void handleDocumentCloseDiscard()}
        onCancel={() => setDocumentCloseDialogOpen(false)}
      />

      <UnsavedDialog
        open={switchDialogOpen}
        title="切换文档"
        message="当前文档有未保存的更改，切换前是否保存？"
        onSave={() => resolveDocumentSwitch("save")}
        onDiscard={() => resolveDocumentSwitch("discard")}
        onCancel={() => resolveDocumentSwitch("cancel")}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DocumentHistoryDialog
        open={historyOpen}
        workspaceId={workspaceId}
        filePath={filePath}
        onClose={() => setHistoryOpen(false)}
        onPersistHistory={async () => {
          if (!filePath) return;
          await saveDocument();
        }}
      />
      <DocumentPropertiesDialog
        open={propertiesOpen}
        workspaceId={workspaceId}
        filePath={filePath}
        manifest={manifest}
        onClose={() => setPropertiesOpen(false)}
      />
    </div>
  );
}

export default App;
