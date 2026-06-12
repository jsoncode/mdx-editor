import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";

/** 保存前将 CodeMirror 中的最新正文同步到 documentStore */
export function flushEditorContentToStore(): boolean {
  const view = useEditorStore.getState().view;
  if (!view) return false;

  const latest = view.state.doc.toString();
  const { content, setContent } = useDocumentStore.getState();
  if (latest !== content) {
    setContent(latest);
  }
  return true;
}

/** 返回 flush 前后的长度信息，供诊断日志使用 */
export function getEditorFlushStats() {
  const view = useEditorStore.getState().view;
  const { content } = useDocumentStore.getState();
  const editorLen = view?.state.doc.length ?? null;
  return {
    editorAttached: view != null,
    storeLen: content.length,
    editorLen,
    mismatch: editorLen != null && editorLen !== content.length,
  };
}
