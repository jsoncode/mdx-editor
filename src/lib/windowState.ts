import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { load } from "@tauri-apps/plugin-store";

const STORE_PATH = "settings.json";
const WINDOW_STATE_KEY = "window_state";
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

interface WindowState {
  width: number;
  height: number;
}

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

function clampSize(width: number, height: number): WindowState {
  return {
    width: Math.max(MIN_WIDTH, Math.round(width)),
    height: Math.max(MIN_HEIGHT, Math.round(height)),
  };
}

export async function restoreWindowState(): Promise<void> {
  const window = getCurrentWindow();
  const store = await getStore();
  const saved = await store.get<WindowState>(WINDOW_STATE_KEY);
  const size = clampSize(
    saved?.width ?? DEFAULT_WIDTH,
    saved?.height ?? DEFAULT_HEIGHT,
  );

  await window.setSize(new LogicalSize(size.width, size.height));
  await window.center();
}

export async function saveWindowState(): Promise<void> {
  const window = getCurrentWindow();
  const physicalSize = await window.innerSize();
  const scaleFactor = await window.scaleFactor();
  const logicalSize = physicalSize.toLogical(scaleFactor);
  const size = clampSize(logicalSize.width, logicalSize.height);

  const store = await getStore();
  await store.set(WINDOW_STATE_KEY, size);
  await store.save();
}

export function setupWindowStatePersistence(): () => void {
  const window = getCurrentWindow();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void saveWindowState();
    }, 400);
  };

  const unlistenPromise = window.onResized(scheduleSave);

  return () => {
    if (timer) clearTimeout(timer);
    void unlistenPromise.then((unlisten) => unlisten());
    void saveWindowState();
  };
}
