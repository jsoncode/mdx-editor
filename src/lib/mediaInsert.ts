import { invoke } from "@tauri-apps/api/core";
import { fileNameFromPath, needsMediaTranscode } from "./media";
import { ensureLargeTranscodeConfirmed } from "./mediaTranscodeConfirm";
import { useMediaTranscodeStore } from "../stores/mediaTranscodeStore";
import { useSettingsStore } from "../stores/settingsStore";

export { isMediaInsertCancelled, MediaInsertCancelledError } from "./mediaTranscodeConfirm";

function createJobId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `transcode-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function ensureTranscodeListener(): Promise<void> {
  await useMediaTranscodeStore.getState().initialize();
}

function registerPendingJob(sourceLabel: string, jobId: string): void {
  useMediaTranscodeStore.getState().registerJob({
    id: jobId,
    fileName: sourceLabel,
    phase: "starting",
    message: needsMediaTranscode(sourceLabel) ? "准备转码…" : "准备插入…",
    done: false,
  });
}

export async function insertResourceFromPath(
  workspaceId: string,
  sourcePath: string,
): Promise<string> {
  const ffmpegPath = useSettingsStore.getState().ffmpegPath.trim();
  const fileName = fileNameFromPath(sourcePath);

  if (!needsMediaTranscode(sourcePath)) {
    return invoke<string>("insert_asset_from_path", {
      workspaceId,
      sourcePath,
    });
  }

  const sizeBytes = await invoke<number>("get_file_size", { sourcePath });
  await ensureLargeTranscodeConfirmed(fileName, sizeBytes);

  await ensureTranscodeListener();
  const jobId = createJobId();
  registerPendingJob(fileName, jobId);

  try {
    return await invoke<string>("insert_media_from_path", {
      workspaceId,
      sourcePath,
      ffmpegPath: ffmpegPath || null,
      jobId,
    });
  } catch (error) {
    useMediaTranscodeStore.getState().upsertJob({
      jobId,
      fileName,
      phase: "error",
      message: String(error),
    });
    throw error;
  }
}

export async function insertResourceFromBytes(
  workspaceId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const ffmpegPath = useSettingsStore.getState().ffmpegPath.trim();

  if (!needsMediaTranscode(filename)) {
    return invoke<string>("insert_asset_from_bytes", {
      workspaceId,
      filename,
      bytes: Array.from(bytes),
    });
  }

  await ensureLargeTranscodeConfirmed(fileNameFromPath(filename), bytes.length);

  await ensureTranscodeListener();
  const jobId = createJobId();
  registerPendingJob(fileNameFromPath(filename), jobId);

  try {
    return await invoke<string>("insert_media_from_bytes", {
      workspaceId,
      filename,
      bytes: Array.from(bytes),
      ffmpegPath: ffmpegPath || null,
      jobId,
    });
  } catch (error) {
    useMediaTranscodeStore.getState().upsertJob({
      jobId,
      fileName: fileNameFromPath(filename),
      phase: "error",
      message: String(error),
    });
    throw error;
  }
}
