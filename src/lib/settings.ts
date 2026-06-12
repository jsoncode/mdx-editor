import { load } from "@tauri-apps/plugin-store";
import type { AppSettings } from "../types/settings";

const STORE_PATH = "settings.json";
const EDITOR_DEPTH_KEY = "editor_history_depth";
const DOCUMENT_DEPTH_KEY = "document_history_depth";
const RECORD_DEVICE_KEY = "record_device_info";
const RECORD_LOCATION_KEY = "record_location";

export const DEFAULT_EDITOR_HISTORY_DEPTH = 50;
export const DEFAULT_DOCUMENT_HISTORY_DEPTH = 50;
export const MIN_HISTORY_DEPTH = 10;
export const MAX_HISTORY_DEPTH = 500;

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

export function clampHistoryDepth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDITOR_HISTORY_DEPTH;
  return Math.min(MAX_HISTORY_DEPTH, Math.max(MIN_HISTORY_DEPTH, Math.round(value)));
}

export async function loadAppSettings(): Promise<AppSettings> {
  const store = await getStore();
  const editorRaw = await store.get<number>(EDITOR_DEPTH_KEY);
  const documentRaw = await store.get<number>(DOCUMENT_DEPTH_KEY);
  const recordDevice = await store.get<boolean>(RECORD_DEVICE_KEY);
  const recordLocation = await store.get<boolean>(RECORD_LOCATION_KEY);
  return {
    editorHistoryDepth: clampHistoryDepth(editorRaw ?? DEFAULT_EDITOR_HISTORY_DEPTH),
    documentHistoryDepth: clampHistoryDepth(documentRaw ?? DEFAULT_DOCUMENT_HISTORY_DEPTH),
    recordDeviceInfo: recordDevice ?? false,
    recordLocation: recordLocation ?? false,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set(EDITOR_DEPTH_KEY, clampHistoryDepth(settings.editorHistoryDepth));
  await store.set(DOCUMENT_DEPTH_KEY, clampHistoryDepth(settings.documentHistoryDepth));
  await store.set(RECORD_DEVICE_KEY, settings.recordDeviceInfo);
  await store.set(RECORD_LOCATION_KEY, settings.recordLocation);
  await store.save();
}
