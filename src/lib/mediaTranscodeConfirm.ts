import { ask } from "@tauri-apps/plugin-dialog";
import { formatFileSize, TRANSCODE_SIZE_CONFIRM_BYTES } from "./media";

export class MediaInsertCancelledError extends Error {
  constructor() {
    super("已取消转码插入");
    this.name = "MediaInsertCancelledError";
  }
}

export function isMediaInsertCancelled(error: unknown): boolean {
  return error instanceof MediaInsertCancelledError;
}

export async function confirmLargeMediaTranscode(
  fileName: string,
  sizeBytes: number,
): Promise<boolean> {
  if (sizeBytes <= TRANSCODE_SIZE_CONFIRM_BYTES) {
    return true;
  }

  return ask(
    `「${fileName}」大小为 ${formatFileSize(sizeBytes)}，超过 100 MB。\n\n转码可能耗时较长并占用较多磁盘空间，是否继续转码并插入？`,
    {
      title: "文件过大",
      kind: "warning",
      okLabel: "继续转码",
      cancelLabel: "取消",
    },
  );
}

export async function ensureLargeTranscodeConfirmed(
  fileName: string,
  sizeBytes: number,
): Promise<void> {
  const confirmed = await confirmLargeMediaTranscode(fileName, sizeBytes);
  if (!confirmed) {
    throw new MediaInsertCancelledError();
  }
}
