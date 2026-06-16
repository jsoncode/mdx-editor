import type { FfmpegStatus } from "../types/ffmpeg";

/** 与 Rust `FFMPEG_MIN_MAJOR_VERSION` 保持一致 */
export const FFMPEG_MIN_MAJOR_VERSION = 4;

export const FFMPEG_RECOMMENDED_MAJOR_VERSIONS = [5, 6, 7] as const;

export const FFMPEG_VERSION_RANGE_LABEL = `${FFMPEG_MIN_MAJOR_VERSION}.0 及以上`;

export const FFMPEG_VERSION_RANGE_HINT = `推荐 ${FFMPEG_RECOMMENDED_MAJOR_VERSIONS.join(" / ")}.x 稳定版`;

export const FFMPEG_VERSION_REQUIREMENTS = [
  `支持范围：FFmpeg ${FFMPEG_VERSION_RANGE_LABEL}（${FFMPEG_VERSION_RANGE_HINT}）`,
  "需包含 libx264 视频编码器与 AAC 音频编码器",
  "用于转码 WMA、WMV、AVI、VOB、APE、DSF/DFF 等浏览器不直接支持的格式",
  "内置 FFmpeg（安装包附带）为最新 master 构建，通常满足上述要求",
] as const;

export function formatDetectedFfmpegVersion(status: FfmpegStatus): string | null {
  if (!status.available) {
    return null;
  }
  if (status.versionLine) {
    return status.versionLine;
  }
  if (status.majorVersion != null) {
    return `FFmpeg ${status.majorVersion}.x`;
  }
  return null;
}

export function ffmpegVersionHintClassName(status: FfmpegStatus): string {
  if (!status.available) {
    return "settings-hint";
  }
  if (!status.versionSupported) {
    return "settings-hint settings-hint-warn";
  }
  if (status.versionHint) {
    return "settings-hint settings-hint-warn";
  }
  return "settings-hint settings-hint-ok";
}
