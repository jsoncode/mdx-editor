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
import { SettingsPage } from "./components/SettingsPage";
import { DocumentHistoryPage } from "./components/DocumentHistoryPage";
import { DocumentPropertiesDialog } from "./components/DocumentPropertiesDialog";
import { useAutosave } from "./hooks/useAutosave";
import { useDocumentActions } from "./hooks/useDocumentActions";
import { usePrintLayout } from "./hooks/usePrintLayout";
import { useWindowState } from "./hooks/useWindowState";
import { getRecentFileEntries } from "./lib/recentFiles";
import { isInsertablePath, isMarkdownDocumentPath } from "./lib/media";
import { MARKDOWN_DOCUMENT_SAVE_FILTERS, defaultSavePath, isPlainMdPath } from "./lib/documentPaths";
import { promptPlainMdSaveChoice } from "./lib/savePrompt";
import { notifyGitPushFailed } from "./lib/gitSyncWorkflow";
import { isIdleSession } from "./lib/session";
import { saveGuard } from "./lib/saveGuard";
import { isCloseDocumentShortcut, isSaveShortcut, consumeShortcut } from "./lib/appShortcuts";
import { diag, diagSaveCloseState, installDiagnosticHandlers, getDiagnosticLogDir } from "./lib/diagnosticLog";
import { useDocumentStore } from "./stores/documentStore";
import { useUiStore } from "./stores/uiStore";
import { useVaultStore } from "./stores/vaultStore";
import { useSettingsStore } from "./stores/settingsStore";
import "./App.css";

function App() {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);
  const forceClosingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const isHandlingCloseRef = useRef(false);
  const requestQuitAppRef = useRef<() => void>(() => undefined);
  const requestCloseDocumentRef = useRef<() => void>(() => undefined);

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
  const manifest = useDocumentStore((s) => s.manifest);
  const propertiesOpen = useUiStore((s) => s.propertiesOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setAppView = useUiStore((s) => s.setAppView);
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
  const { handleNew, handleOpen, handleSave } = useDocumentActions(previewHtml);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<string>("git-push-failed", (event) => {
      void notifyGitPushFailed(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    installDiagnosticHandlers();
    void getDiagnosticLogDir()
      .then((dir) => diag("lifecycle", "log_dir_ready", { dir }))
      .catch((error) => diag("lifecycle", "log_dir_error", { error: String(error) }, "warn"));
    void invoke("disable_webview_accelerators").catch(() => undefined);
  }, []);

  useEffect(() => {
    isDirtyRef.current = useDocumentStore.getState().isDirty;
    return useDocumentStore.subscribe((state, prev) => {
      if (state.isDirty !== prev.isDirty) {
        isDirtyRef.current = state.isDirty;
      }
    });
  }, []);

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
    if (saveGuard.shouldBlockClose()) {
      diag("close", "forceDestroy_blocked_by_saveGuard", saveGuard.getDebugInfo(), "warn");
      return;
    }
    diag("close", "forceDestroy", {}, "warn");
    forceClosingRef.current = true;
    isDirtyRef.current = false;
    setCloseDialogOpen(false);
    setQuitConfirmOpen(false);
    await getCurrentWindow().destroy();
  }, []);

  const returnToWelcomeAfterClose = useCallback(async () => {
    if (isHandlingCloseRef.current) {
      diag("close", "returnToWelcome_skipped_handling", {}, "warn");
      return;
    }
    if (saveGuard.shouldBlockClose()) {
      diag("close", "returnToWelcome_blocked_by_saveGuard", saveGuard.getDebugInfo(), "warn");
      return;
    }
    diagSaveCloseState("returnToWelcome_start");
    isHandlingCloseRef.current = true;
    try {
      await closeDocument();
      setAppView("welcome");
      setSearchOpen(false);
      await getCurrentWindow().setTitle("MDX Editor");
      diag("close", "returnToWelcome_done");
    } finally {
      isHandlingCloseRef.current = false;
    }
  }, [closeDocument, setAppView, setSearchOpen]);

  const requestQuitApp = useCallback(async () => {
    if (isHandlingCloseRef.current) {
      diag("close", "requestQuitApp_skipped_handling", {}, "warn");
      return;
    }
    if (saveGuard.shouldBlockClose()) {
      diag("close", "requestQuitApp_blocked_by_saveGuard", saveGuard.getDebugInfo(), "warn");
      return;
    }
    if (useDocumentStore.getState().saveStatus === "saving") {
      diag("close", "requestQuitApp_blocked_saving", {}, "warn");
      return;
    }

    const { isDirty, workspaceId } = useDocumentStore.getState();
    diagSaveCloseState("requestQuitApp", { isDirty, hasWorkspace: Boolean(workspaceId) });
    if (isDirty) {
      setCloseDialogOpen(true);
      return;
    }

    if (workspaceId) {
      setQuitConfirmOpen(true);
      return;
    }

    await forceDestroy();
  }, [forceDestroy]);

  const requestCloseDocument = useCallback(() => {
    if (isHandlingCloseRef.current) {
      diag("close", "requestCloseDocument_skipped_handling", {}, "warn");
      return;
    }
    if (closeDialogOpen || documentCloseDialogOpen || switchDialogOpen || quitConfirmOpen) {
      diag("close", "requestCloseDocument_skipped_dialog_open", {
        closeDialogOpen,
        documentCloseDialogOpen,
        switchDialogOpen,
        quitConfirmOpen,
      });
      return;
    }
    if (saveGuard.shouldBlockClose()) {
      diag("close", "requestCloseDocument_blocked_by_saveGuard", saveGuard.getDebugInfo(), "warn");
      return;
    }

    if (isIdleSession()) {
      diag("close", "requestCloseDocument_idle_to_quit");
      void requestQuitApp();
      return;
    }

    const { isDirty } = useDocumentStore.getState();
    diagSaveCloseState("requestCloseDocument", { isDirty });
    if (isDirty) {
      setDocumentCloseDialogOpen(true);
      return;
    }

    void returnToWelcomeAfterClose();
  }, [
    closeDialogOpen,
    documentCloseDialogOpen,
    switchDialogOpen,
    quitConfirmOpen,
    requestQuitApp,
    returnToWelcomeAfterClose,
  ]);

  useEffect(() => {
    requestQuitAppRef.current = () => {
      void requestQuitApp();
    };
    requestCloseDocumentRef.current = requestCloseDocument;
  }, [requestQuitApp, requestCloseDocument]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.type !== "keydown" || event.repeat) return;

      if (isSaveShortcut(event)) {
        consumeShortcut(event);
        diag("shortcut", "ctrl_s", {
          code: event.code,
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        });
        diagSaveCloseState("before_ctrl_s_save");
        saveGuard.runSaveTask(async () => {
          try {
            await handleSave();
            diagSaveCloseState("after_ctrl_s_save");
          } catch (error) {
            diag(
              "save",
              "handleSave_error",
              { error: error instanceof Error ? error.message : String(error) },
              "error",
            );
            throw error;
          }
        });
        return;
      }
      if (isCloseDocumentShortcut(event)) {
        consumeShortcut(event);
        diag("shortcut", "ctrl_w", {
          code: event.code,
          key: event.key,
          blocked: saveGuard.shouldBlockClose(),
        });
        if (saveGuard.shouldBlockClose()) {
          return;
        }
        requestCloseDocument();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyN") {
        consumeShortcut(event);
        void handleNew();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyO") {
        consumeShortcut(event);
        void handleOpen();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyF") {
        consumeShortcut(event);
        useUiStore.getState().setSearchOpen(true);
        useUiStore.getState().setAppView("editor");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyP") {
        consumeShortcut(event);
        printDocument();
        return;
      }
      if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    searchOpen,
    setSearchOpen,
    printDocument,
    handleNew,
    handleOpen,
    handleSave,
    requestCloseDocument,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (forceClosingRef.current) {
          diag("close", "CloseRequested_ignored_forceClosing");
          return;
        }
        event.preventDefault();
        const blocked = saveGuard.shouldBlockClose();
        diagSaveCloseState("CloseRequested", { blocked });
        if (blocked) return;
        requestQuitAppRef.current();
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleCloseSave = async () => {
    saveGuard.startSaveSession();
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
    } finally {
      saveGuard.end();
    }
  };

  const handleCloseDiscard = async () => {
    resetDirty();
    await forceDestroy();
  };

  const handleDocumentCloseSave = async () => {
    saveGuard.startSaveSession();
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
    } finally {
      saveGuard.end();
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
        {appView === "settings" && <SettingsPage />}
        {appView === "history" && <DocumentHistoryPage />}
      </main>

      <UnsavedDialog
        open={closeDialogOpen}
        onSave={() => void handleCloseSave()}
        onDiscard={() => void handleCloseDiscard()}
        onCancel={() => setCloseDialogOpen(false)}
      />

      <UnsavedDialog
        open={quitConfirmOpen}
        variant="confirm"
        title="退出应用"
        message="确定要退出 MDX Editor 吗？"
        confirmLabel="退出"
        onSave={() => setQuitConfirmOpen(false)}
        onDiscard={() => void forceDestroy()}
        onCancel={() => setQuitConfirmOpen(false)}
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
