import { create } from "zustand";
import {
  clampHistoryDepth,
  DEFAULT_DOCUMENT_HISTORY_DEPTH,
  DEFAULT_EDITOR_HISTORY_DEPTH,
  loadAppSettings,
  saveAppSettings,
} from "../lib/settings";
import type { AppSettings } from "../types/settings";

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
    };
    await saveAppSettings(next);
    set(next);
  },
}));
