import { useEffect, useMemo, useState, type ReactNode } from "react";
import { message, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  getDiagnosticLogDir,
  openDiagnosticLogDir,
  readDiagnosticLogTail,
} from "../lib/diagnosticLog";
import { formatDiagnosticLogPreview } from "../lib/diagnosticLogFormat";
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
import { useUiStore } from "../stores/uiStore";
import { useVaultStore } from "../stores/vaultStore";
import type { GitSyncSettings } from "../types/settings";
import type { FfmpegStatus } from "../types/ffmpeg";
import { ffmpegSourceLabel } from "../types/ffmpeg";
import {
  FFMPEG_VERSION_REQUIREMENTS,
  FFMPEG_VERSION_RANGE_LABEL,
  FFMPEG_VERSION_RANGE_HINT,
  formatDetectedFfmpegVersion,
  ffmpegVersionHintClassName,
} from "../lib/ffmpegRequirements";

type LogViewMode = "formatted" | "raw";

function SettingsInlineActions({ children }: { children: ReactNode }) {
  return <div className="settings-inline-actions">{children}</div>;
}

function LogViewToggle({
  mode,
  onChange,
}: {
  mode: LogViewMode;
  onChange: (mode: LogViewMode) => void;
}) {
  return (
    <div className="settings-log-view-toggle" role="group" aria-label="日志预览模式">
      <button
        type="button"
        className={mode === "formatted" ? "active" : ""}
        aria-pressed={mode === "formatted"}
        onClick={() => onChange("formatted")}
      >
        格式化
      </button>
      <button
        type="button"
        className={mode === "raw" ? "active" : ""}
        aria-pressed={mode === "raw"}
        onClick={() => onChange("raw")}
      >
        原文
      </button>
    </div>
  );
}

export function SettingsPage() {
  const editorHistoryDepth = useSettingsStore((s) => s.editorHistoryDepth);
  const documentHistoryDepth = useSettingsStore((s) => s.documentHistoryDepth);
  const recordDeviceInfo = useSettingsStore((s) => s.recordDeviceInfo);
  const recordLocation = useSettingsStore((s) => s.recordLocation);
  const markdownSingleLineBreaks = useSettingsStore((s) => s.markdownSingleLineBreaks);
  const ffmpegPath = useSettingsStore((s) => s.ffmpegPath);
  const gitSync = useSettingsStore((s) => s.gitSync);
  const applySettings = useSettingsStore((s) => s.applySettings);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const enterEditor = useUiStore((s) => s.enterEditor);
  const showWelcome = useUiStore((s) => s.showWelcome);

  const [editorDepth, setEditorDepth] = useState(String(DEFAULT_EDITOR_HISTORY_DEPTH));
  const [documentDepth, setDocumentDepth] = useState(String(DEFAULT_DOCUMENT_HISTORY_DEPTH));
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [singleLineBreaksEnabled, setSingleLineBreaksEnabled] = useState(false);
  const [ffmpegPathInput, setFfmpegPathInput] = useState("");
  const [testingFfmpeg, setTestingFfmpeg] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [gitEnabled, setGitEnabled] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [token, setToken] = useState("");
  const [branch, setBranch] = useState(DEFAULT_GIT_BRANCH);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [commitTemplate, setCommitTemplate] = useState(DEFAULT_GIT_COMMIT_TEMPLATE);
  const [testingGit, setTestingGit] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [logDir, setLogDir] = useState("");
  const [logPreview, setLogPreview] = useState("");
  const [logViewMode, setLogViewMode] = useState<LogViewMode>("formatted");
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    void getDiagnosticLogDir().then(setLogDir).catch(() => undefined);
    void refreshLogPreview();
  }, []);

  const displayLogPreview = useMemo(() => {
    if (!logPreview) {
      return "";
    }
    if (logViewMode === "raw") {
      return logPreview;
    }
    return formatDiagnosticLogPreview(logPreview);
  }, [logPreview, logViewMode]);

  const refreshLogPreview = async () => {
    setLoadingLog(true);
    try {
      const tail = await readDiagnosticLogTail(60);
      setLogPreview(tail || "（暂无日志，请先复现保存问题后再刷新）");
    } finally {
      setLoadingLog(false);
    }
  };

  const resetForm = () => {
    setEditorDepth(String(editorHistoryDepth));
    setDocumentDepth(String(documentHistoryDepth));
    setDeviceEnabled(recordDeviceInfo);
    setLocationEnabled(recordLocation);
    setSingleLineBreaksEnabled(markdownSingleLineBreaks);
    setFfmpegPathInput(ffmpegPath);
    setGitEnabled(gitSync.enabled);
    setRemoteUrl(gitSync.remoteUrl);
    setToken(gitSync.token);
    setBranch(gitSync.branch || DEFAULT_GIT_BRANCH);
    setAuthorName(gitSync.authorName);
    setAuthorEmail(gitSync.authorEmail);
    setCommitTemplate(gitSync.commitMessageTemplate || DEFAULT_GIT_COMMIT_TEMPLATE);
    setSavedHint(false);
  };

  useEffect(() => {
    resetForm();
  }, [
    editorHistoryDepth,
    documentHistoryDepth,
    recordDeviceInfo,
    recordLocation,
    markdownSingleLineBreaks,
    ffmpegPath,
    gitSync,
  ]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = ffmpegPathInput.trim();
    void invoke<FfmpegStatus>("get_ffmpeg_status", {
      ffmpegPath: trimmed || null,
    })
      .then((status) => {
        if (!cancelled) {
          setFfmpegStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFfmpegStatus({ available: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ffmpegPathInput]);

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
      markdownSingleLineBreaks: singleLineBreaksEnabled,
      ffmpegPath: ffmpegPathInput,
      gitSync: buildGitSettings(),
    }).then(() => {
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
    });
  };

  const handleBrowseFfmpeg = async () => {
    const selected = await open({
      title: "选择 FFmpeg 可执行文件",
      multiple: false,
      directory: false,
    });
    if (typeof selected === "string") {
      setFfmpegPathInput(selected);
    }
  };

  const handleTestFfmpeg = async () => {
    setTestingFfmpeg(true);
    try {
      const trimmed = ffmpegPathInput.trim();
      const result = await invoke<string>("test_ffmpeg", {
        ffmpegPath: trimmed || null,
      });
      await message(result, { title: "FFmpeg 测试", kind: "info" });
    } catch (error) {
      await message(String(error), { title: "FFmpeg 不可用", kind: "error" });
    } finally {
      setTestingFfmpeg(false);
    }
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
    <div className="settings-page">
      <div className="settings-page-scroll">
        <div className="settings-page-header">
          <div>
            <h1>偏好设置</h1>
            <p>配置编辑器行为、Markdown 预览、历史修改、文件属性记录，以及工作区 Git 同步。</p>
          </div>
          <div className="settings-page-actions">
            <button type="button" className="secondary" onClick={() => enterEditor()}>
              返回编辑
            </button>
            <button type="button" className="secondary" onClick={showWelcome}>
              开始页
            </button>
          </div>
        </div>

        <div className="settings-page-body">
          <section className="settings-card">
            <h2>编辑器</h2>
            <div className="settings-form">
              <label className="settings-field">
                <span className="settings-label">撤销 / 重做步数</span>
                <span className="settings-hint">
                  编辑器内可撤销的操作次数（{MIN_HISTORY_DEPTH}–{MAX_HISTORY_DEPTH}）
                </span>
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
            </div>
          </section>

          <section className="settings-card">
            <h2>Markdown 预览</h2>
            <p className="settings-card-desc">
              控制分屏/预览模式下 Markdown 的渲染方式。标准 Markdown 规范要求<strong>空一行（两次换行）</strong>
              才会开始新段落；单次换行在标准模式下会被合并为空格。
            </p>
            <div className="settings-form">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={singleLineBreaksEnabled}
                  onChange={(event) => setSingleLineBreaksEnabled(event.target.checked)}
                />
                <span>单行换行即换行（非标准）</span>
              </label>
              <p className="settings-hint settings-hint-block">
                开启后，按一次 Enter 产生的换行在预览中会显示为新的一行，类似部分即时通讯软件的排版。
                关闭时遵循标准 Markdown 规则（推荐，与其他编辑器/平台兼容性更好）。
              </p>
            </div>
          </section>

          <section className="settings-card">
            <h2>文件属性记录</h2>
            <p className="settings-card-desc">保存文档时写入 manifest.json；关闭后不会记录对应字段。</p>
            <div className="settings-form">
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
          </section>

          <section className="settings-card">
            <h2>媒体预览</h2>
            <p className="settings-card-desc">
              预览 WMA、WMV、AVI 等浏览器不支持的格式时，需要 FFmpeg 转码。若系统 PATH
              中已安装 FFmpeg，留空下方路径即可自动使用，无需手动配置。
            </p>
            <div className="settings-ffmpeg-requirements settings-hint-block">
              <p className="settings-label">版本要求</p>
              <p className="settings-hint">
                支持 <strong>FFmpeg {FFMPEG_VERSION_RANGE_LABEL}</strong>（{FFMPEG_VERSION_RANGE_HINT}）
              </p>
              <ul className="settings-ffmpeg-version-list">
                {FFMPEG_VERSION_REQUIREMENTS.slice(1).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {ffmpegStatus?.available ? (
              <>
                <p className="settings-hint settings-hint-ok settings-hint-block">
                  已检测到 FFmpeg（{ffmpegSourceLabel(ffmpegStatus.source ?? "")}
                  {ffmpegStatus.path ? `：${ffmpegStatus.path}` : ""}）
                  {ffmpegStatus.source === "path" && !ffmpegPathInput.trim()
                    ? "，可直接预览需转码的媒体。"
                    : ""}
                </p>
                {formatDetectedFfmpegVersion(ffmpegStatus) ? (
                  <p className="settings-hint settings-hint-block">
                    当前版本：{formatDetectedFfmpegVersion(ffmpegStatus)}
                    {ffmpegStatus.majorVersion != null
                      ? `（主版本 ${ffmpegStatus.majorVersion}.x）`
                      : ""}
                  </p>
                ) : null}
                {ffmpegStatus.versionHint ? (
                  <p
                    className={`${ffmpegVersionHintClassName(ffmpegStatus)} settings-hint-block`}
                  >
                    {ffmpegStatus.versionHint}
                  </p>
                ) : ffmpegStatus.versionSupported !== false ? (
                  <p className="settings-hint settings-hint-ok settings-hint-block">
                    版本符合要求，可正常用于媒体转码。
                  </p>
                ) : null}
              </>
            ) : ffmpegStatus ? (
              <p className="settings-hint settings-hint-warn settings-hint-block">
                未检测到可用的 FFmpeg。请安装并加入系统 PATH，或使用下方路径手动指定。
              </p>
            ) : null}
            <div className="settings-form settings-form-compact">
              <label className="settings-field">
                <span className="settings-label">FFmpeg 路径（可选）</span>
                <span className="settings-hint">
                  仅在系统 PATH 无法识别或需指定特定版本时填写；留空则自动使用 PATH → 内置
                  FFmpeg（若安装包已包含）
                </span>
                <input
                  className="settings-input-wide"
                  type="text"
                  value={ffmpegPathInput}
                  onChange={(event) => setFfmpegPathInput(event.target.value)}
                  placeholder="留空以自动使用系统 PATH"
                />
              </label>
              <SettingsInlineActions>
                <button type="button" className="secondary" onClick={() => void handleBrowseFfmpeg()}>
                  浏览…
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={testingFfmpeg}
                  onClick={() => void handleTestFfmpeg()}
                >
                  {testingFfmpeg ? "测试中…" : "测试 FFmpeg"}
                </button>
              </SettingsInlineActions>
            </div>
          </section>

          <section className="settings-card">
            <h2>Git 同步</h2>
            <p className="settings-card-desc">
              对当前工作区目录进行 Git 管理：打开文档前拉取远程更新，保存后在后台推送（关闭应用后仍会继续完成）。
            </p>
            <div className="settings-form">
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
          </section>

          <section className="settings-section">
            <h3>诊断日志</h3>
            <p className="settings-hint">
              保存异常或意外退出时，请打开日志文件夹，将当天日志（mdx-editor-YYYY-MM-DD.log）发给开发者。
            </p>
            {logDir && <p className="settings-hint settings-log-path">{logDir}</p>}
            <div className="settings-log-toolbar">
              <SettingsInlineActions>
                <button type="button" className="secondary" onClick={() => void openDiagnosticLogDir()}>
                  打开日志文件夹
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={loadingLog}
                  onClick={() => void refreshLogPreview()}
                >
                  {loadingLog ? "加载中…" : "刷新预览"}
                </button>
              </SettingsInlineActions>
              <LogViewToggle mode={logViewMode} onChange={setLogViewMode} />
            </div>
            {displayLogPreview ? (
              <pre
                className={`settings-log-preview${
                  logViewMode === "formatted" ? " is-formatted" : " is-raw"
                }`}
              >
                {displayLogPreview}
              </pre>
            ) : null}
          </section>
        </div>
      </div>

      <div className="settings-page-footer">
        <button type="button" onClick={handleSave}>
          保存设置
        </button>
        <button type="button" className="secondary" onClick={resetForm}>
          重置更改
        </button>
        {savedHint && <span className="settings-saved-hint">已保存</span>}
      </div>
    </div>
  );
}
