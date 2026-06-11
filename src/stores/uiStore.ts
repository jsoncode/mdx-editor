import { create } from "zustand";

export type AppView = "editor" | "recent";
export type RibbonTab = "file" | "insert" | "view";

interface UiStore {
  appView: AppView;
  ribbonTab: RibbonTab;
  searchOpen: boolean;
  setAppView: (view: AppView) => void;
  setRibbonTab: (tab: RibbonTab) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  appView: "editor",
  ribbonTab: "file",
  searchOpen: false,

  setAppView: (appView) => set({ appView }),
  setRibbonTab: (ribbonTab) => set({ ribbonTab }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  toggleSearch: () => {
    const next = !get().searchOpen;
    set({ searchOpen: next, appView: "editor", ribbonTab: "view" });
    return next;
  },
}));
