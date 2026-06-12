import { create } from "zustand";
import {
  clampHistoryDepth,
  DEFAULT_DOCUMENT_HISTORY_DEPTH,
  DEFAULT_EDITOR_HISTORY_DEPTH,
  DEFAULT_GIT_SYNC,
  loadAppSettings,
  saveAppSettings,
} from "../lib/settings";
import type { AppSettings, GitSyncSettings } from "../types/settings";

interface SettingsStore extends AppSettings {
  loaded: boolean;
  initialize: () => Promise<void>;
  applySettings: (settings: AppSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  editorHistoryDepth: DEFAULT_EDITOR_HISTORY_DEPTH,
  documentHistoryDepth: DEFAULT_DOCUMENT_HISTORY_DEPTH,
  recordDeviceInfo: false,
  recordLocation: false,
  markdownSingleLineBreaks: false,
  gitSync: DEFAULT_GIT_SYNC,
  loaded: false,

  initialize: async () => {
    const settings = await loadAppSettings();
    set({ ...settings, loaded: true });
  },

  applySettings: async (settings) => {
    const next: AppSettings = {
      editorHistoryDepth: clampHistoryDepth(settings.editorHistoryDepth),
      documentHistoryDepth: clampHistoryDepth(settings.documentHistoryDepth),
      recordDeviceInfo: settings.recordDeviceInfo,
      recordLocation: settings.recordLocation,
      markdownSingleLineBreaks: settings.markdownSingleLineBreaks,
      gitSync: {
        ...DEFAULT_GIT_SYNC,
        ...settings.gitSync,
        branch: settings.gitSync.branch.trim() || DEFAULT_GIT_SYNC.branch,
        remoteUrl: settings.gitSync.remoteUrl.trim(),
        authorName: settings.gitSync.authorName.trim(),
        authorEmail: settings.gitSync.authorEmail.trim(),
        commitMessageTemplate:
          settings.gitSync.commitMessageTemplate.trim() ||
          DEFAULT_GIT_SYNC.commitMessageTemplate,
      },
    };
    await saveAppSettings(next);
    set(next);
  },
}));

export function getGitSyncSettings(): GitSyncSettings {
  return useSettingsStore.getState().gitSync;
}
