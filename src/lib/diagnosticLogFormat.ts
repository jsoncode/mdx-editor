const LOG_LINE_RE =
  /^(\d{4}-\d{2}-\d{2}T[\d:.+-Z]+)\s+\[(\w+)\]\[([^\]]+)\]\s+(\S+)(?:\s+(.*))?$/;

const LEVEL_LABELS: Record<string, string> = {
  debug: "调试",
  info: "信息",
  warn: "警告",
  error: "错误",
  fatal: "严重",
};

const CATEGORY_LABELS: Record<string, string> = {
  save: "保存",
  close: "关闭",
  lifecycle: "生命周期",
  runtime: "运行时",
  state: "状态",
  rust: "后端",
  saveGuard: "保存守卫",
  shortcut: "快捷键",
};

const DETAIL_LABELS: Record<string, string> = {
  sessionId: "会话 ID",
  reason: "原因",
  message: "消息",
  error: "错误",
  filePath: "文件路径",
  isDirty: "未保存",
  appView: "当前视图",
  saveStatus: "保存状态",
  workspaceId: "工作区 ID",
  contentLen: "内容长度",
  savedContentLen: "已保存内容长度",
  contentChanged: "内容已变更",
  editorAttached: "编辑器已挂载",
  editorDocLen: "编辑器内容长度",
  editorStoreMismatch: "编辑器与存储不一致",
  hasWorkspace: "已有工作区",
  targetPath: "目标路径",
  savedPath: "保存路径",
  blocked: "已阻止",
  userAgent: "用户代理",
  href: "页面地址",
  hidden: "页面隐藏",
  filename: "脚本文件",
  lineno: "行号",
  colno: "列号",
  stack: "堆栈",
  dir: "目录",
  pid: "进程 ID",
  version: "版本",
  log_dir: "日志目录",
  flushed: "已同步编辑器",
  editorLen: "编辑器长度",
  storeLen: "存储长度",
  mismatch: "长度不一致",
  saveDepth: "保存深度",
  code: "键码",
  key: "按键",
};

function labelForLevel(level: string): string {
  return LEVEL_LABELS[level.toLowerCase()] ?? level;
}

function labelForCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function labelForDetailKey(key: string): string {
  return DETAIL_LABELS[key] ?? key;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDetailBlock(detailRaw: string | undefined): string[] {
  if (!detailRaw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(detailRaw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(
        ([key, value]) => `${labelForDetailKey(key)}：${formatDetailValue(value)}`,
      );
    }
  } catch {
    // fall through
  }

  return [`详情：${detailRaw.trim()}`];
}

function formatLogLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(LOG_LINE_RE);
  if (!match) {
    return `原文：${trimmed}`;
  }

  const [, timestamp, level, category, event, detailRaw] = match;
  const lines = [
    `日期：${formatTimestamp(timestamp)}`,
    `级别：${labelForLevel(level)}`,
    `分类：${labelForCategory(category)}`,
    `事件：${event}`,
    ...formatDetailBlock(detailRaw),
  ];

  return lines.join("\n");
}

/** 将诊断日志原文格式化为自然语言预览 */
export function formatDiagnosticLogPreview(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return text;
  }
  if (text.startsWith("（")) {
    return text;
  }

  const formatted = text
    .split("\n")
    .map((line) => formatLogLine(line))
    .filter(Boolean);

  if (formatted.length === 0) {
    return text;
  }

  return formatted.join("\n\n────────────────\n\n");
}
