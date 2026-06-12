import { useEffect, useState } from "react";
import {
  DEFAULT_DOCUMENT_HISTORY_DEPTH,
  DEFAULT_EDITOR_HISTORY_DEPTH,
  MAX_HISTORY_DEPTH,
  MIN_HISTORY_DEPTH,
} from "../lib/settings";
import { useSettingsStore } from "../stores/settingsStore";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const editorHistoryDepth = useSettingsStore((s) => s.editorHistoryDepth);
  const documentHistoryDepth = useSettingsStore((s) => s.documentHistoryDepth);
  const recordDeviceInfo = useSettingsStore((s) => s.recordDeviceInfo);
  const recordLocation = useSettingsStore((s) => s.recordLocation);
  const applySettings = useSettingsStore((s) => s.applySettings);

  const [editorDepth, setEditorDepth] = useState(String(DEFAULT_EDITOR_HISTORY_DEPTH));
  const [documentDepth, setDocumentDepth] = useState(String(DEFAULT_DOCUMENT_HISTORY_DEPTH));
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditorDepth(String(editorHistoryDepth));
    setDocumentDepth(String(documentHistoryDepth));
    setDeviceEnabled(recordDeviceInfo);
    setLocationEnabled(recordLocation);
  }, [open, editorHistoryDepth, documentHistoryDepth, recordDeviceInfo, recordLocation]);

  if (!open) return null;

  const handleSave = () => {
    const editorValue = Number.parseInt(editorDepth, 10);
    const documentValue = Number.parseInt(documentDepth, 10);
    void applySettings({
      editorHistoryDepth: Number.isFinite(editorValue) ? editorValue : DEFAULT_EDITOR_HISTORY_DEPTH,
      documentHistoryDepth: Number.isFinite(documentValue)
        ? documentValue
        : DEFAULT_DOCUMENT_HISTORY_DEPTH,
      recordDeviceInfo: deviceEnabled,
      recordLocation: locationEnabled,
    }).then(onClose);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog settings-dialog"
        role="dialog"
        aria-labelledby="settings-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="settings-dialog-title">偏好设置</h3>
        <p className="settings-dialog-desc">
          配置编辑器行为、历史修改保留条数，以及保存时是否记录设备与位置信息到文档 manifest。
        </p>

        <div className="settings-form">
          <label className="settings-field">
            <span className="settings-label">撤销 / 重做步数</span>
            <span className="settings-hint">编辑器内可撤销的操作次数（{MIN_HISTORY_DEPTH}–{MAX_HISTORY_DEPTH}）</span>
            <input
              type="number"
              min={MIN_HISTORY_DEPTH}
              max={MAX_HISTORY_DEPTH}
              value={editorDepth}
              onChange={(event) => setEditorDepth(event.target.value)}
            />
          </label>

          <label className="settings-field">
            <span className="settings-label">历史修改步数</span>
            <span className="settings-hint">
              每个文档保留的保存差异记录条数（{MIN_HISTORY_DEPTH}–{MAX_HISTORY_DEPTH}，存入 versions.json）
            </span>
            <input
              type="number"
              min={MIN_HISTORY_DEPTH}
              max={MAX_HISTORY_DEPTH}
              value={documentDepth}
              onChange={(event) => setDocumentDepth(event.target.value)}
            />
          </label>

          <div className="settings-section">
            <span className="settings-label">文件属性记录</span>
            <span className="settings-hint">保存文档时写入 manifest.json；关闭后不会记录对应字段。</span>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={deviceEnabled}
                onChange={(event) => setDeviceEnabled(event.target.checked)}
              />
              <span>记录设备信息（操作系统、架构、主机名）</span>
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={locationEnabled}
                onChange={(event) => setLocationEnabled(event.target.checked)}
              />
              <span>记录经纬度坐标（需浏览器/系统定位权限）</span>
            </label>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
