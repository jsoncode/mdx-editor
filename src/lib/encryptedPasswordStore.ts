import { load } from "@tauri-apps/plugin-store";

const STORE_PATH = "settings.json";
const REMEMBERED_PASSWORDS_KEY = "remembered_encrypted_mdx_passwords";

type RememberedPasswordMap = Record<string, string>;

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

/** 统一路径格式，便于跨会话匹配同一文件 */
export function normalizeDocumentPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

async function readMap(): Promise<RememberedPasswordMap> {
  const store = await getStore();
  const raw = await store.get<RememberedPasswordMap>(REMEMBERED_PASSWORDS_KEY);
  return raw && typeof raw === "object" ? { ...raw } : {};
}

async function writeMap(map: RememberedPasswordMap): Promise<void> {
  const store = await getStore();
  if (Object.keys(map).length === 0) {
    await store.delete(REMEMBERED_PASSWORDS_KEY);
  } else {
    await store.set(REMEMBERED_PASSWORDS_KEY, map);
  }
  await store.save();
}

export async function getRememberedPassword(path: string): Promise<string | null> {
  const key = normalizeDocumentPath(path);
  const map = await readMap();
  const value = map[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function setRememberedPassword(path: string, password: string): Promise<void> {
  const key = normalizeDocumentPath(path);
  const map = await readMap();
  map[key] = password;
  await writeMap(map);
}

export async function forgetRememberedPassword(path: string): Promise<void> {
  const key = normalizeDocumentPath(path);
  const map = await readMap();
  if (!(key in map)) return;
  delete map[key];
  await writeMap(map);
}
