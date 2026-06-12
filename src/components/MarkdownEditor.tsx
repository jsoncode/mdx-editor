import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Compartment } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { history as cmHistory, historyKeymap } from "@codemirror/commands";
import { search } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { runRedo, runUndo } from "../lib/editorHistory";
import { editorPlaceholder } from "../lib/editorPlaceholder";
import {
  editorHighlight,
  editorTheme,
  selectedTextField,
  selectionFocusPlugin,
} from "../lib/editorTheme";
import { applyMarkdownFormat, type MarkdownFormatAction } from "../lib/markdownFormat";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useSettingsStore } from "../stores/settingsStore";

const historyStateListener = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.transactions.length > 0) {
    useEditorStore.getState().syncHistoryState(update.state);
  }
});

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void;
  focus: () => void;
  applyFormat: (action: MarkdownFormatAction) => void;
  undo: () => void;
  redo: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onDrop?: (event: React.DragEvent) => void;
  onPaste?: (event: ClipboardEvent) => void;
  onCreateEditor?: (view: EditorView | null) => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, onDrop, onPaste, onCreateEditor }, ref) {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const suppressChangeRef = useRef(false);
    const historyCompartmentRef = useRef(new Compartment());
    const editorHistoryDepth = useSettingsStore((s) => s.editorHistoryDepth);

    const handleChange = useCallback(
      (next: string) => {
        if (suppressChangeRef.current) return;
        onChange(next);
      },
      [onChange],
    );

    useEffect(() => {
      const view = editorRef.current?.view;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === value) return;

      suppressChangeRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      suppressChangeRef.current = false;
    }, [value]);

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        const view = editorRef.current?.view;
        if (!view) {
          onChange(value + text);
          return;
        }
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      focus: () => editorRef.current?.view?.focus(),
      applyFormat: (action: MarkdownFormatAction) => {
        const view = editorRef.current?.view;
        if (view) applyMarkdownFormat(view, action);
      },
      undo: () => {
        const view = editorRef.current?.view;
        if (view) runUndo(view);
      },
      redo: () => {
        const view = editorRef.current?.view;
        if (view) runRedo(view);
      },
    }));

    useEffect(() => {
      return () => {
        const view = editorRef.current?.view;
        if (view) {
          const latest = view.state.doc.toString();
          useDocumentStore.getState().setContent(latest);
        }
        onCreateEditor?.(null);
      };
    }, [onCreateEditor]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !onPaste) return;

      const handler = (event: ClipboardEvent) => {
        void onPaste(event);
      };
      container.addEventListener("paste", handler, true);
      return () => container.removeEventListener("paste", handler, true);
    }, [onPaste]);

    useEffect(() => {
      const view = editorRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: historyCompartmentRef.current.reconfigure(
          cmHistory({ minDepth: editorHistoryDepth }),
        ),
      });
    }, [editorHistoryDepth]);

    const extensions = useMemo(
      () => [
        editorHighlight,
        historyCompartmentRef.current.of(cmHistory({ minDepth: editorHistoryDepth })),
        keymap.of(historyKeymap),
        historyStateListener,
        search(),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),
        selectedTextField,
        selectionFocusPlugin,
        editorPlaceholder,
        EditorView.lineWrapping,
        editorTheme,
      ],
      [editorHistoryDepth],
    );

    return (
      <div
        ref={containerRef}
        className="markdown-editor"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <CodeMirror
          ref={editorRef}
          value={value}
          height="100%"
          extensions={extensions}
          onChange={handleChange}
          onCreateEditor={onCreateEditor}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            searchKeymap: false,
            history: false,
            historyKeymap: false,
          }}
        />
      </div>
    );
  },
);
