import { load } from "@tauri-apps/plugin-store";
import type { AppSettings, GitSyncSettings } from "../types/settings";

const STORE_PATH = "settings.json";
const EDITOR_DEPTH_KEY = "editor_history_depth";
const DOCUMENT_DEPTH_KEY = "document_history_depth";
const RECORD_DEVICE_KEY = "record_device_info";
const RECORD_LOCATION_KEY = "record_location";
const GIT_ENABLED_KEY = "git_sync_enabled";
const GIT_REMOTE_URL_KEY = "git_remote_url";
const GIT_TOKEN_KEY = "git_token";
const GIT_BRANCH_KEY = "git_branch";
const GIT_AUTHOR_NAME_KEY = "git_author_name";
const GIT_AUTHOR_EMAIL_KEY = "git_author_email";
const GIT_COMMIT_TEMPLATE_KEY = "git_commit_template";
const MARKDOWN_SINGLE_LINE_BREAKS_KEY = "markdown_single_line_breaks";

export const DEFAULT_EDITOR_HISTORY_DEPTH = 50;
export const DEFAULT_DOCUMENT_HISTORY_DEPTH = 50;
export const MIN_HISTORY_DEPTH = 10;
export const MAX_HISTORY_DEPTH = 500;

export const DEFAULT_GIT_BRANCH = "main";
export const DEFAULT_GIT_COMMIT_TEMPLATE = "备份: {{date}}";

export const DEFAULT_GIT_SYNC: GitSyncSettings = {
  enabled: false,
  remoteUrl: "",
  token: "",
  branch: DEFAULT_GIT_BRANCH,
  authorName: "",
  authorEmail: "",
  commitMessageTemplate: DEFAULT_GIT_COMMIT_TEMPLATE,
};

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

export function clampHistoryDepth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDITOR_HISTORY_DEPTH;
  return Math.min(MAX_HISTORY_DEPTH, Math.max(MIN_HISTORY_DEPTH, Math.round(value)));
}

function normalizeGitSync(raw: Partial<GitSyncSettings> | undefined): GitSyncSettings {
  return {
    enabled: raw?.enabled ?? DEFAULT_GIT_SYNC.enabled,
    remoteUrl: raw?.remoteUrl ?? DEFAULT_GIT_SYNC.remoteUrl,
    token: raw?.token ?? DEFAULT_GIT_SYNC.token,
    branch: raw?.branch?.trim() || DEFAULT_GIT_BRANCH,
    authorName: raw?.authorName ?? DEFAULT_GIT_SYNC.authorName,
    authorEmail: raw?.authorEmail ?? DEFAULT_GIT_SYNC.authorEmail,
    commitMessageTemplate:
      raw?.commitMessageTemplate?.trim() || DEFAULT_GIT_COMMIT_TEMPLATE,
  };
}

export async function loadAppSettings(): Promise<AppSettings> {
  const store = await getStore();
  const editorRaw = await store.get<number>(EDITOR_DEPTH_KEY);
  const documentRaw = await store.get<number>(DOCUMENT_DEPTH_KEY);
  const recordDevice = await store.get<boolean>(RECORD_DEVICE_KEY);
  const recordLocation = await store.get<boolean>(RECORD_LOCATION_KEY);
  const gitSync = normalizeGitSync({
    enabled: await store.get<boolean>(GIT_ENABLED_KEY),
    remoteUrl: await store.get<string>(GIT_REMOTE_URL_KEY),
    token: await store.get<string>(GIT_TOKEN_KEY),
    branch: await store.get<string>(GIT_BRANCH_KEY),
    authorName: await store.get<string>(GIT_AUTHOR_NAME_KEY),
    authorEmail: await store.get<string>(GIT_AUTHOR_EMAIL_KEY),
    commitMessageTemplate: await store.get<string>(GIT_COMMIT_TEMPLATE_KEY),
  });
  return {
    editorHistoryDepth: clampHistoryDepth(editorRaw ?? DEFAULT_EDITOR_HISTORY_DEPTH),
    documentHistoryDepth: clampHistoryDepth(documentRaw ?? DEFAULT_DOCUMENT_HISTORY_DEPTH),
    recordDeviceInfo: recordDevice ?? false,
    recordLocation: recordLocation ?? false,
    markdownSingleLineBreaks: (await store.get<boolean>(MARKDOWN_SINGLE_LINE_BREAKS_KEY)) ?? false,
    gitSync,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set(EDITOR_DEPTH_KEY, clampHistoryDepth(settings.editorHistoryDepth));
  await store.set(DOCUMENT_DEPTH_KEY, clampHistoryDepth(settings.documentHistoryDepth));
  await store.set(RECORD_DEVICE_KEY, settings.recordDeviceInfo);
  await store.set(RECORD_LOCATION_KEY, settings.recordLocation);
  await store.set(MARKDOWN_SINGLE_LINE_BREAKS_KEY, settings.markdownSingleLineBreaks);
  await store.set(GIT_ENABLED_KEY, settings.gitSync.enabled);
  await store.set(GIT_REMOTE_URL_KEY, settings.gitSync.remoteUrl.trim());
  await store.set(GIT_TOKEN_KEY, settings.gitSync.token);
  await store.set(GIT_BRANCH_KEY, settings.gitSync.branch.trim() || DEFAULT_GIT_BRANCH);
  await store.set(GIT_AUTHOR_NAME_KEY, settings.gitSync.authorName.trim());
  await store.set(GIT_AUTHOR_EMAIL_KEY, settings.gitSync.authorEmail.trim());
  await store.set(
    GIT_COMMIT_TEMPLATE_KEY,
    settings.gitSync.commitMessageTemplate.trim() || DEFAULT_GIT_COMMIT_TEMPLATE,
  );
  await store.save();
}
