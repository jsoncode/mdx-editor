import { useEffect, useState } from "react";
import { fetchDocumentManifest } from "../lib/documentMetadata";
import { getFileName } from "../lib/recentFiles";
import type { Manifest } from "../types/document";

interface DocumentPropertiesDialogProps {
  open: boolean;
  workspaceId: string | null;
  filePath: string | null;
  manifest: Manifest | null;
  onClose: () => void;
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function formatCoordinate(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(6);
}

export function DocumentPropertiesDialog({
  open,
  workspaceId,
  filePath,
  manifest: manifestProp,
  onClose,
}: DocumentPropertiesDialogProps) {
  const [manifest, setManifest] = useState<Manifest | null>(manifestProp);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (manifestProp) {
      setManifest(manifestProp);
    }
    if (!workspaceId) {
      setManifest(null);
      return;
    }

    setLoading(true);
    void fetchDocumentManifest(workspaceId)
      .then(setManifest)
      .finally(() => setLoading(false));
  }, [open, workspaceId, manifestProp]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog document-properties-dialog"
        role="dialog"
        aria-labelledby="document-properties-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="document-properties-title">文件属性</h3>
        <p className="document-properties-desc">
          {filePath
            ? `${getFileName(filePath)} · 属性保存在 manifest.json（MDX 内置或 .md sidecar）`
            : "文档属性将在首次保存后写入文件。"}
        </p>

        {!workspaceId ? (
          <div className="history-empty">当前没有打开的文档。</div>
        ) : loading ? (
          <div className="history-empty">加载中…</div>
        ) : !manifest ? (
          <div className="history-empty">无法读取文档属性。</div>
        ) : (
          <dl className="vault-info-list document-properties-list">
            <div>
              <dt>标题</dt>
              <dd>{manifest.title || "—"}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{formatTime(manifest.created_at)}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatTime(manifest.modified_at)}</dd>
            </div>
            <div>
              <dt>设备信息</dt>
              <dd>
                {manifest.device_info ? (
                  <span className="document-properties-block">
                    {manifest.device_info.os} / {manifest.device_info.arch} ·{" "}
                    {manifest.device_info.hostname}
                    <span className="document-properties-sub">
                      记录于 {formatTime(manifest.device_info.recorded_at)}
                    </span>
                  </span>
                ) : (
                  "未记录（可在设置中开启）"
                )}
              </dd>
            </div>
            <div>
              <dt>经纬度</dt>
              <dd>
                {manifest.location ? (
                  <span className="document-properties-block">
                    {formatCoordinate(manifest.location.latitude)},{" "}
                    {formatCoordinate(manifest.location.longitude)}
                    {manifest.location.accuracy != null && (
                      <span className="document-properties-sub">
                        精度约 {Math.round(manifest.location.accuracy)} 米
                      </span>
                    )}
                    <span className="document-properties-sub">
                      记录于 {formatTime(manifest.location.recorded_at)}
                    </span>
                  </span>
                ) : (
                  "未记录（可在设置中开启）"
                )}
              </dd>
            </div>
            {filePath && (
              <div>
                <dt>路径</dt>
                <dd className="vault-info-path">{filePath}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
