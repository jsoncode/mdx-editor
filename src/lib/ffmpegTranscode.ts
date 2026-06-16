import { invoke } from "@tauri-apps/api/core";

export async function ensureFfmpegReadyForTranscode(ffmpegPath: string): Promise<void> {
  await invoke("validate_ffmpeg_for_transcode", {
    ffmpegPath: ffmpegPath.trim() || null,
  });
}
