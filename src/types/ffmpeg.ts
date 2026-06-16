export interface FfmpegStatus {
  available: boolean;
  source?: "user" | "path" | "sidecar" | null;
  path?: string | null;
  versionLine?: string | null;
  majorVersion?: number | null;
  versionSupported?: boolean;
  versionHint?: string | null;
}

export function ffmpegSourceLabel(source: string): string {
  switch (source) {
    case "user":
      return "自定义路径";
    case "path":
      return "系统 PATH";
    case "sidecar":
      return "内置 FFmpeg";
    default:
      return source;
  }
}
