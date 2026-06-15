function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** 判断是否为文件不存在类错误（含 Rust IO os error 2） */
export function isDocumentNotFoundError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  return (
    text.includes("file not found") ||
    text.includes("os error 2") ||
    text.includes("enoent") ||
    text.includes("no such file") ||
    text.includes("系统找不到指定的文件") ||
    text.includes("找不到指定的文件")
  );
}

function fileBaseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** 将打开文档时的底层错误转为用户可读提示 */
export function formatDocumentOpenError(path: string, error: unknown): string {
  const raw = errorText(error);

  if (raw.includes("已取消")) {
    return raw;
  }

  if (isDocumentNotFoundError(error)) {
    return `找不到文件「${fileBaseName(path)}」，可能已被移动或删除。`;
  }

  if (raw.includes("密码错误") || raw.includes("无法解密")) {
    return "密码错误，无法解密该文档。";
  }

  if (raw.includes("不是有效的加密 MDX") || raw.includes("加密 MDX 文件不完整")) {
    return "文件已损坏或不是有效的加密 MDX 文档。";
  }

  if (raw.includes("仅支持打开")) {
    return raw;
  }

  return "无法打开该文档，请检查文件是否存在或是否可访问。";
}
