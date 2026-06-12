import { useEffect, useRef, useCallback } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { EditorView } from "@codemirror/view";
import { useAssetInsert } from "../hooks/useAssetInsert";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useUiStore } from "../stores/uiStore";
import { EditorToolbar } from "./EditorToolbar";
import { MarkdownEditor, MarkdownEditorHandle } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { SearchPanel } from "./SearchPanel";

function EditorPane({
  editorRef,
  content,
  setContent,
  handleDrop,
  handlePaste,
  previewHtml,
  onCreateEditor,
}: {
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
  content: string;
  setContent: (value: string) => void;
  handleDrop: (event: React.DragEvent) => void;
  handlePaste: (event: ClipboardEvent) => void;
  previewHtml: string;
  onCreateEditor: (view: EditorView | null) => void;
}) {
  const { handleInsertImage, handleInsertMedia } = useDocumentActions(previewHtml);

  return (
    <div className="editor-pane">
      <EditorToolbar
        editorRef={editorRef}
        onInsertImage={() => void handleInsertImage()}
        onInsertMedia={() => void handleInsertMedia()}
      />
      <MarkdownEditor
        ref={editorRef}
        value={content}
        onChange={setContent}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onCreateEditor={onCreateEditor}
      />
    </div>
  );
}

export function SplitEditor() {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const content = useDocumentStore((s) => s.content);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const previewHtml = useDocumentStore((s) => s.previewHtml);
  const setContent = useDocumentStore((s) => s.setContent);
  const setInsertAtCursor = useDocumentStore((s) => s.setInsertAtCursor);
  const setPreviewHtml = useDocumentStore((s) => s.setPreviewHtml);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const setEditorView = useEditorStore((s) => s.setView);

  const handleEditorView = useCallback(
    (view: EditorView | null) => {
      setEditorView(view);
    },
    [setEditorView],
  );

  const { handleOpenPath } = useDocumentActions(previewHtml);

  const openMdxFile = async (path: string) => {
    await handleOpenPath(path);
    useUiStore.getState().setAppView("editor");
  };

  const insertAtCursor = (text: string) => {
    editorRef.current?.insertAtCursor(text);
  };

  useEffect(() => {
    setInsertAtCursor(() => insertAtCursor);
    return () => setInsertAtCursor(null);
  }, [setInsertAtCursor]);

  const { handleDrop, handlePaste } = useAssetInsert(insertAtCursor, openMdxFile);

  const showEditor = layoutMode === "edit" || layoutMode === "split";
  const showPreview = layoutMode === "preview" || layoutMode === "split";
  const showSplit = layoutMode === "split";

  const editorPaneProps = {
    editorRef,
    content,
    setContent,
    handleDrop,
    handlePaste,
    previewHtml,
    onCreateEditor: handleEditorView,
  };

  return (
    <div className="split-editor">
      {searchOpen && <SearchPanel />}
      <div className="split-editor-body">
        {showSplit ? (
          <Group orientation="horizontal" id="mdx-editor-layout">
            <Panel defaultSize={50} minSize={25}>
              <EditorPane {...editorPaneProps} />
            </Panel>
            <Separator className="resize-handle" />
            <Panel defaultSize={50} minSize={25}>
              <MarkdownPreview
                content={content}
                workspaceId={workspaceId}
                onHtmlChange={setPreviewHtml}
              />
            </Panel>
          </Group>
        ) : (
          <div className="single-pane">
            {showEditor && <EditorPane {...editorPaneProps} />}
            {showPreview && (
              <MarkdownPreview
                content={content}
                workspaceId={workspaceId}
                onHtmlChange={setPreviewHtml}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
