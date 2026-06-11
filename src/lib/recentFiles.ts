import { load } from "@tauri-apps/plugin-store";
import type { RecentFileEntry, RecentFileGroup } from "../types/recent";

const STORE_PATH = "settings.json";
const RECENT_KEY = "recent_files";
const MAX_RECENT = 100;

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

function normalizeEntries(raw: unknown): RecentFileEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): RecentFileEntry | null => {
      if (typeof item === "string") {
        return { path: item, openedAt: Date.now() };
      }
      if (
        item &&
        typeof item === "object" &&
        "path" in item &&
        typeof (item as RecentFileEntry).path === "string"
      ) {
        const entry = item as RecentFileEntry;
        return {
          path: entry.path,
          openedAt: entry.openedAt ?? Date.now(),
        };
      }
      return null;
    })
    .filter((item): item is RecentFileEntry => item !== null);
}

export async function getRecentFileEntries(): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const raw = await store.get<unknown>(RECENT_KEY);
  return normalizeEntries(raw);
}

/** @deprecated use getRecentFileEntries */
export async function getRecentFiles(): Promise<string[]> {
  const entries = await getRecentFileEntries();
  return entries.map((entry) => entry.path);
}

export async function addRecentFile(path: string): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const current = normalizeEntries(await store.get(RECENT_KEY));
  const now = Date.now();
  const next = [
    { path, openedAt: now },
    ...current.filter((entry) => entry.path !== path),
  ].slice(0, MAX_RECENT);

  await store.set(RECENT_KEY, next);
  await store.save();
  return next;
}

export async function removeRecentFile(path: string): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const next = normalizeEntries(await store.get(RECENT_KEY)).filter(
    (entry) => entry.path !== path,
  );
  await store.set(RECENT_KEY, next);
  await store.save();
  return next;
}

export async function clearRecentFiles(): Promise<void> {
  const store = await getStore();
  await store.set(RECENT_KEY, []);
  await store.save();
}

export function groupRecentFilesByMonth(
  entries: RecentFileEntry[],
): RecentFileGroup[] {
  const groups = new Map<string, RecentFileGroup>();

  for (const file of entries) {
    const date = new Date(file.openedAt);
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;

    const group = groups.get(sortKey) ?? { label, sortKey, files: [] };
    group.files.push(file);
    groups.set(sortKey, group);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map((group) => ({
      ...group,
      files: group.files.sort((a, b) => b.openedAt - a.openedAt),
    }));
}

export function formatRecentTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}
