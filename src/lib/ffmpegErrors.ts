export interface ParsedFfmpegError {
  title: string;
  reason?: string;
  solutions: string[];
  raw: string;
}

export function parseFfmpegError(raw: string): ParsedFfmpegError {
  const normalized = raw.trim();
  const title = normalized.split("\n")[0]?.trim() || "转码失败";

  const reasonMatch = normalized.match(/原因[：:]\s*([\s\S]*?)(?:\n\n解决方案[：:]|$)/);
  const solutionsBlockMatch = normalized.match(/解决方案[：:]\s*([\s\S]*)/);

  const solutions = solutionsBlockMatch?.[1]
    ? solutionsBlockMatch[1]
        .split(/\n(?=\d+\.\s)/)
        .map((item) => item.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : [];

  return {
    title,
    reason: reasonMatch?.[1]?.trim(),
    solutions,
    raw: normalized,
  };
}

/** 预览区等紧凑场景：单行摘要 */
export function formatFfmpegErrorBrief(raw: string): string {
  const parsed = parseFfmpegError(raw);
  if (parsed.reason) {
    return `${parsed.title}：${parsed.reason}`;
  }
  return parsed.title;
}

export function isStructuredFfmpegError(raw: string): boolean {
  return /原因[：:]/.test(raw) && /解决方案[：:]/.test(raw);
}
