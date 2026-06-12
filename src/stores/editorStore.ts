import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { redoDepth, undoDepth } from "@codemirror/commands";
import { create } from "zustand";

interface EditorStore {
  view: EditorView | null;
  canUndo: boolean;
  canRedo: boolean;
  setView: (view: EditorView | null) => void;
  syncHistoryState: (state: EditorState) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  view: null,
  canUndo: false,
  canRedo: false,
  setView: (view) =>
    set({
      view,
      canUndo: view ? undoDepth(view.state) > 0 : false,
      canRedo: view ? redoDepth(view.state) > 0 : false,
    }),
  syncHistoryState: (state) =>
    set({
      canUndo: undoDepth(state) > 0,
      canRedo: redoDepth(state) > 0,
    }),
}));
