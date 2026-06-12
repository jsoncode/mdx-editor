import { message } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import { useDocumentStore } from "./documentStore";

export type AppView = "welcome" | "editor" | "recent" | "settings" | "history";
export type LayoutMode = "edit" | "preview" | "split";

interface UiStore {
  appView: AppView;
  layoutMode: LayoutMode;
  searchOpen: boolean;
  switchDialogOpen: boolean;
  propertiesOpen: boolean;
  pendingSwitch: (() => Promise<void>) | null;
  setAppView: (view: AppView) => void;
  enterEditor: () => void;
  showWelcome: () => void;
  showSettings: () => void;
  showHistory: () => void;
  setPropertiesOpen: (open: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  requestDocumentSwitch: (action: () => Promise<void>) => void;
  resolveDocumentSwitch: (result: "save" | "discard" | "cancel") => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  appView: "welcome",
  layoutMode: "split",
  searchOpen: false,
  switchDialogOpen: false,
  propertiesOpen: false,
  pendingSwitch: null,

  setAppView: (appView) => set({ appView }),
  enterEditor: () => set({ appView: "editor" }),
  showWelcome: () => set({ appView: "welcome", searchOpen: false }),
  showSettings: () => set({ appView: "settings", searchOpen: false }),
  showHistory: () => set({ appView: "history", searchOpen: false }),
  setPropertiesOpen: (propertiesOpen) => set({ propertiesOpen }),
  setLayoutMode: (layoutMode) => set({ layoutMode, appView: "editor" }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toggleSearch: () => {
    const next = !get().searchOpen;
    set({ searchOpen: next, appView: "editor" });
    return next;
  },

  requestDocumentSwitch: (action) => {
    const { pendingSwitch } = get();
    if (pendingSwitch) return;

    const isDirty = useDocumentStore.getState().isDirty;
    if (!isDirty) {
      void action();
      return;
    }
    set({ switchDialogOpen: true, pendingSwitch: action });
  },

  resolveDocumentSwitch: (result) => {
    const { pendingSwitch } = get();
    set({ switchDialogOpen: false, pendingSwitch: null });

    if (result === "cancel" || !pendingSwitch) return;

    if (result === "discard") {
      void pendingSwitch();
      return;
    }

    void (async () => {
      const { filePath, saveDocument, resetDirty } = useDocumentStore.getState();
      if (!filePath) {
        await message("请先保存当前文档后再切换", { title: "无法切换", kind: "warning" });
        return;
      }
      await saveDocument();
      resetDirty();
      await pendingSwitch();
    })();
  },
}));
