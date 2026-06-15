import { useEffect, useState } from "react";
import {
  getExportSuccessPromptPending,
  submitExportSuccessPrompt,
  subscribeExportSuccessPrompt,
} from "../lib/exportSuccessPrompt";

export function ExportSuccessDialog() {
  const [open, setOpen] = useState(false);

  const pending = getExportSuccessPromptPending();

  useEffect(
    () =>
      subscribeExportSuccessPrompt(() => {
        setOpen(Boolean(getExportSuccessPromptPending()));
      }),
    [],
  );

  if (!open || !pending) return null;

  const { path, formatLabel } = pending;

  return (
    <div className="export-success-overlay" role="presentation">
      <div
        className="export-success-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="export-success-title"
        aria-describedby="export-success-desc export-success-path"
      >
        <h2 id="export-success-title">导出完成</h2>
        <p id="export-success-desc" className="export-success-message">
          {formatLabel} 已成功保存至：
        </p>
        <p id="export-success-path" className="export-success-path" title={path}>
          {path}
        </p>
        <div className="export-success-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => submitExportSuccessPrompt("close")}
          >
            关闭
          </button>
          <button type="button" className="primary" onClick={() => submitExportSuccessPrompt("open")}>
            打开位置
          </button>
        </div>
      </div>
    </div>
  );
}
