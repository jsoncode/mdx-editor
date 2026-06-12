export interface GitSyncSettings {
  enabled: boolean;
  remoteUrl: string;
  token: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  commitMessageTemplate: string;
}

export interface AppSettings {
  editorHistoryDepth: number;
  documentHistoryDepth: number;
  recordDeviceInfo: boolean;
  recordLocation: boolean;
  /** 为 true 时，预览中单个换行即渲染为新行（非标准 Markdown） */
  markdownSingleLineBreaks: boolean;
  /** 自定义 FFmpeg 可执行文件路径；留空则自动使用系统 PATH 或内置 sidecar */
  ffmpegPath: string;
  gitSync: GitSyncSettings;
}

export interface GitPullResult {
  updated: boolean;
  message: string;
  hasConflicts: boolean;
}

export interface GitSyncStatus {
  initialized: boolean;
  hasRemote: boolean;
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  lastError: string | null;
}
