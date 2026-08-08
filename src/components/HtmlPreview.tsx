import { useEffect, useState } from "react";
import { prepareHtmlForPreview } from "../lib/htmlPreview";

interface HtmlPreviewProps {
  content: string;
  workspaceId: string | null;
  onHtmlChange?: (html: string) => void;
}

export function HtmlPreview({ content, workspaceId, onHtmlChange }: HtmlPreviewProps) {
  const [processedHtml, setProcessedHtml] = useState("");
  const [scriptFixApplied, setScriptFixApplied] = useState(false);
  const isEmpty = content.trim().length === 0;

  useEffect(() => {
    if (isEmpty) {
      setProcessedHtml("");
      setScriptFixApplied(false);
      onHtmlChange?.("");
      return;
    }

    let cancelled = false;
    void prepareHtmlForPreview(content, workspaceId).then(({ html, scriptFixApplied: fixed }) => {
      if (cancelled) return;
      setProcessedHtml(html);
      setScriptFixApplied(fixed);
      onHtmlChange?.(html);
    });

    return () => {
      cancelled = true;
    };
  }, [content, workspaceId, isEmpty, onHtmlChange]);

  if (isEmpty) {
    return (
      <div className="markdown-preview html-preview">
        <p className="markdown-preview-empty">请在左侧编辑区插入内容</p>
      </div>
    );
  }

  return (
    <div className="markdown-preview html-preview">
      {scriptFixApplied ? (
        <p className="html-preview-script-hint">
          预览已自动修正脚本中的非法可选链赋值（如 <code>obj?.prop = value</code>
          ）。请在源文件改为 <code>if (obj) obj.prop = value</code>，否则导出后脚本仍无法运行。
        </p>
      ) : null}
      <iframe
        key={processedHtml}
        className="html-preview-frame"
        title="HTML 预览"
        srcDoc={processedHtml}
      />
    </div>
  );
}
