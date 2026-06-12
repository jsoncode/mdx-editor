import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";

export function runUndo(view: EditorView): boolean {
  const ok = undo(view);
  if (ok) view.focus();
  return ok;
}

export function runRedo(view: EditorView): boolean {
  const ok = redo(view);
  if (ok) view.focus();
  return ok;
}
