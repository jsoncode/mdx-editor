import { requestMissingRecentDocumentPrompt } from "./missingRecentDocumentPrompt";

/** 文件不存在时询问用户是否从历史记录中移除；返回 true 表示确认移除 */
export async function promptRemoveMissingRecentDocument(
  path: string,
  _error?: unknown,
): Promise<boolean> {
  return requestMissingRecentDocumentPrompt(path);
}
