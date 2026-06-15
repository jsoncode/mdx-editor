export interface PasswordPromptOptions {
  title: string;
  description?: string;
  confirm?: boolean;
  submitLabel?: string;
  /** 显示「记住密码」选项（仅解密场景） */
  allowRemember?: boolean;
  /** 用于记住密码的文件路径 */
  documentPath?: string;
}

export interface PasswordPromptResult {
  password: string | null;
  remember: boolean;
}

interface PendingPasswordPrompt {
  options: PasswordPromptOptions;
  resolve: (result: PasswordPromptResult) => void;
}

let pending: PendingPasswordPrompt | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePasswordPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPasswordPromptPending(): PendingPasswordPrompt | null {
  return pending;
}

export function requestDocumentPassword(
  options: PasswordPromptOptions,
): Promise<PasswordPromptResult> {
  return new Promise((resolve) => {
    pending = { options, resolve };
    notify();
  });
}

export function submitPasswordPrompt(password: string | null, remember = false): void {
  pending?.resolve({ password, remember });
  pending = null;
  notify();
}
