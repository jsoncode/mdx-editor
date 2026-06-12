import { useEffect, useState } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { testVaultGit } from "../lib/gitSync";
import {
  DEFAULT_DOCUMENT_HISTORY_DEPTH,
  DEFAULT_EDITOR_HISTORY_DEPTH,
  DEFAULT_GIT_BRANCH,
  DEFAULT_GIT_COMMIT_TEMPLATE,
  MAX_HISTORY_DEPTH,
  MIN_HISTORY_DEPTH,
} from "../lib/settings";
import { useSettingsStore } from "../stores/settingsStore";
import { useVaultStore } from "../stores/vaultStore";
import type { GitSyncSettings } from "../types/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const editorHistoryDepth = useSettingsStore((s) => s.editorHistoryDepth);
  const documentHistoryDepth = useSettingsStore((s) => s.documentHistoryDepth);
  const recordDeviceInfo = useSettingsStore((s) => s.recordDeviceInfo);
  const recordLocation = useSettingsStore((s) => s.recordLocation);
  const gitSync = useSettingsStore((s) => s.gitSync);
  const applySettings = useSettingsStore((s) => s.applySettings);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const [editorDepth, setEditorDepth] = useState(String(DEFAULT_EDITOR_HISTORY_DEPTH));
  const [documentDepth, setDocumentDepth] = useState(String(DEFAULT_DOCUMENT_HISTORY_DEPTH));
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [gitEnabled, setGitEnabled] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [token, setToken] = useState("");
  const [branch, setBranch] = useState(DEFAULT_GIT_BRANCH);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [commitTemplate, setCommitTemplate] = useState(DEFAULT_GIT_COMMIT_TEMPLATE);
  const [testingGit, setTestingGit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditorDepth(String(editorHistoryDepth));
    setDocumentDepth(String(documentHistoryDepth));
    setDeviceEnabled(recordDeviceInfo);
    setLocationEnabled(recordLocation);
    setGitEnabled(gitSync.enabled);
    setRemoteUrl(gitSync.remoteUrl);
    setToken(gitSync.token);
    setBranch(gitSync.branch || DEFAULT_GIT_BRANCH);
    setAuthorName(gitSync.authorName);
    setAuthorEmail(gitSync.authorEmail);
    setCommitTemplate(gitSync.commitMessageTemplate || DEFAULT_GIT_COMMIT_TEMPLATE);
  }, [
    open,
    editorHistoryDepth,
    documentHistoryDepth,
    recordDeviceInfo,
    recordLocation,
    gitSync,
  ]);

  if (!open) return null;

  const buildGitSettings = (): GitSyncSettings => ({
    enabled: gitEnabled,
    remoteUrl,
    token,
    branch: branch.trim() || DEFAULT_GIT_BRANCH,
    authorName,
    authorEmail,
    commitMessageTemplate: commitTemplate.trim() || DEFAULT_GIT_COMMIT_TEMPLATE,
  });

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
      gitSync: buildGitSettings(),
    }).then(onClose);
  };

  const handleTestGit = async () => {
    if (!vaultPath) {
      await message("请先打开一个工作区，再测试 Git 连接。", {
        title: "无法测试",
        kind: "warning",
      });
      return;
    }
    if (!remoteUrl.trim()) {
      await message("请填写远程仓库地址。", { title: "无法测试", kind: "warning" });
      return;
    }
    if (!token.trim()) {
      await message("请填写访问 Token。", { title: "无法测试", kind: "warning" });
      return;
    }

    setTestingGit(true);
    try {
      const result = await testVaultGit(vaultPath, buildGitSettings());
      await message(result, { title: "Git 连接测试", kind: "info" });
    } catch (error) {
      await message(String(error), { title: "Git 连接失败", kind: "error" });
    } finally {
      setTestingGit(false);
    }
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
          配置编辑器行为、历史修改、文件属性记录，以及工作区 Git 同步（类似 Obsidian Git）。
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

          <div className="settings-section">
            <span className="settings-label">Git 同步</span>
            <span className="settings-hint">
              对当前工作区目录进行 Git 管理：打开文档前拉取远程更新，保存后在后台推送（关闭应用后仍会继续完成）。
            </span>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={gitEnabled}
                onChange={(event) => setGitEnabled(event.target.checked)}
              />
              <span>启用 Git 同步</span>
            </label>

            <label className="settings-field">
              <span className="settings-label">远程仓库地址</span>
              <span className="settings-hint">HTTPS 地址，例如 https://github.com/user/repo.git</span>
              <input
                className="settings-input-wide"
                type="url"
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
                placeholder="https://github.com/user/repo.git"
                disabled={!gitEnabled}
              />
            </label>

            <label className="settings-field">
              <span className="settings-label">访问 Token</span>
              <span className="settings-hint">Personal Access Token，用于 HTTPS 认证（保存在本地设置中）</span>
              <input
                className="settings-input-wide"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                disabled={!gitEnabled}
              />
            </label>

            <label className="settings-field">
              <span className="settings-label">分支</span>
              <input
                type="text"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder={DEFAULT_GIT_BRANCH}
                disabled={!gitEnabled}
              />
            </label>

            <label className="settings-field">
              <span className="settings-label">提交者姓名</span>
              <input
                className="settings-input-wide"
                type="text"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                disabled={!gitEnabled}
              />
            </label>

            <label className="settings-field">
              <span className="settings-label">提交者邮箱</span>
              <input
                className="settings-input-wide"
                type="email"
                value={authorEmail}
                onChange={(event) => setAuthorEmail(event.target.value)}
                disabled={!gitEnabled}
              />
            </label>

            <label className="settings-field">
              <span className="settings-label">提交说明模板</span>
              <span className="settings-hint">可用变量：{"{{date}}"}、{"{{file}}"}</span>
              <input
                className="settings-input-wide"
                type="text"
                value={commitTemplate}
                onChange={(event) => setCommitTemplate(event.target.value)}
                disabled={!gitEnabled}
              />
            </label>

            <div className="settings-git-actions">
              <button
                type="button"
                className="secondary"
                disabled={!gitEnabled || testingGit}
                onClick={() => void handleTestGit()}
              >
                {testingGit ? "测试中…" : "测试连接"}
              </button>
              {vaultPath ? (
                <span className="settings-hint">当前工作区：{vaultPath}</span>
              ) : (
                <span className="settings-hint settings-hint-warn">尚未打开工作区</span>
              )}
            </div>
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
