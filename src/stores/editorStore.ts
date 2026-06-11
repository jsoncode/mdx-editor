import type { EditorView } from "@codemirror/view";
import { create } from "zustand";

interface EditorStore {
  view: EditorView | null;
  setView: (view: EditorView | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  view: null,
  setView: (view) => set({ view }),
}));
