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
