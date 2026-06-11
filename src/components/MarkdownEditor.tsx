import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { search } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { editorHighlight, editorTheme } from "../lib/editorTheme";

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void;
  focus: () => void;
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
    }));

    useEffect(() => {
      return () => onCreateEditor?.(null);
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
          extensions={[
            editorTheme,
            editorHighlight,
            search({ top: false }),
            markdown({
              base: markdownLanguage,
              codeLanguages: languages,
            }),
          ]}
          onChange={handleChange}
          onCreateEditor={onCreateEditor}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
        />
      </div>
    );
  },
);
