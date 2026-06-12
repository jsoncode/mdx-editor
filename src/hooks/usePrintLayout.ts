import { useCallback, useEffect, useRef } from "react";
import { useUiStore, type AppView, type LayoutMode } from "../stores/uiStore";

interface PrintSnapshot {
  layoutMode: LayoutMode;
  appView: AppView;
  searchOpen: boolean;
}

export function usePrintLayout() {
  const snapshotRef = useRef<PrintSnapshot | null>(null);

  const preparePrintLayout = useCallback(() => {
    if (snapshotRef.current) return;

    const ui = useUiStore.getState();
    snapshotRef.current = {
      layoutMode: ui.layoutMode,
      appView: ui.appView,
      searchOpen: ui.searchOpen,
    };

    ui.setSearchOpen(false);
    ui.setAppView("editor");
    ui.setLayoutMode("preview");
    document.body.classList.add("printing");
  }, []);

  const restorePrintLayout = useCallback(() => {
    document.body.classList.remove("printing");

    const saved = snapshotRef.current;
    if (!saved) return;

    const ui = useUiStore.getState();
    ui.setLayoutMode(saved.layoutMode);
    ui.setAppView(saved.appView);
    ui.setSearchOpen(saved.searchOpen);
    snapshotRef.current = null;
  }, []);

  const printDocument = useCallback(() => {
    preparePrintLayout();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [preparePrintLayout]);

  useEffect(() => {
    const onBeforePrint = () => preparePrintLayout();
    const onAfterPrint = () => restorePrintLayout();

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      restorePrintLayout();
    };
  }, [preparePrintLayout, restorePrintLayout]);

  return { printDocument };
}
