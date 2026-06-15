import { useEffect, useState } from "react";
import {
  getMissingRecentDocumentPromptPending,
  submitMissingRecentDocumentPrompt,
  subscribeMissingRecentDocumentPrompt,
} from "../lib/missingRecentDocumentPrompt";

export function MissingRecentDocumentDialog() {
  const [open, setOpen] = useState(false);

  const pending = getMissingRecentDocumentPromptPending();

  useEffect(
    () =>
      subscribeMissingRecentDocumentPrompt(() => {
        setOpen(Boolean(getMissingRecentDocumentPromptPending()));
      }),
    [],
  );

  if (!open || !pending) return null;

  const { path } = pending;

  return (
    <div className="missing-recent-doc-overlay" role="presentation">
      <div
        className="missing-recent-doc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="missing-recent-doc-title"
        aria-describedby="missing-recent-doc-desc missing-recent-doc-path"
      >
        <h2 id="missing-recent-doc-title">无法打开文档</h2>
        <p id="missing-recent-doc-desc" className="missing-recent-doc-message">
          找不到以下文件，可能已被移动或删除：
        </p>
        <p id="missing-recent-doc-path" className="missing-recent-doc-path" title={path}>
          {path}
        </p>
        <p className="missing-recent-doc-hint">是否从最近文档历史中移除该条目？</p>
        <div className="missing-recent-doc-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => submitMissingRecentDocumentPrompt(false)}
          >
            知道了
          </button>
          <button type="button" className="primary" onClick={() => submitMissingRecentDocumentPrompt(true)}>
            从历史中移除
          </button>
        </div>
      </div>
    </div>
  );
}
