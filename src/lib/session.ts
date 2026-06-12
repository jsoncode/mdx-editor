import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";

/** 无已打开文件、无有效编辑内容时视为空闲状态 */
export function isIdleSession(): boolean {
  const { filePath, content, isDirty, workspaceId } = useDocumentStore.getState();
  if (filePath) return false;
  if (isDirty) return false;
  if (content.trim().length > 0) return false;
  if (workspaceId && content.length > 0) return false;
  return true;
}

export function hasOpenVault(): boolean {
  return Boolean(useVaultStore.getState().vaultPath);
}
