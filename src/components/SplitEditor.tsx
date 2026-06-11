import { useEffect, useRef } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useAssetInsert } from "../hooks/useAssetInsert";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useUiStore } from "../stores/uiStore";
import { MarkdownEditor, MarkdownEditorHandle } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { SearchPanel } from "./SearchPanel";

export function SplitEditor() {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const content = useDocumentStore((s) => s.content);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const setContent = useDocumentStore((s) => s.setContent);
  const setInsertAtCursor = useDocumentStore((s) => s.setInsertAtCursor);
  const setPreviewHtml = useDocumentStore((s) => s.setPreviewHtml);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const setEditorView = useEditorStore((s) => s.setView);

  const insertAtCursor = (text: string) => {
    editorRef.current?.insertAtCursor(text);
  };

  useEffect(() => {
    setInsertAtCursor(() => insertAtCursor);
    return () => setInsertAtCursor(null);
  }, [setInsertAtCursor]);

  const { handleDrop, handlePaste } = useAssetInsert(insertAtCursor);

  return (
    <div className="split-editor">
      {searchOpen && <SearchPanel />}
      <div className="split-editor-body">
        <Group orientation="horizontal" id="mdx-editor-layout">
          <Panel defaultSize={50} minSize={25}>
            <MarkdownEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onCreateEditor={(view) => setEditorView(view)}
            />
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
      </div>
    </div>
  );
}
