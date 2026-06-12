export interface PasswordPromptOptions {
  title: string;
  description?: string;
  confirm?: boolean;
  submitLabel?: string;
}

interface PendingPasswordPrompt {
  options: PasswordPromptOptions;
  resolve: (password: string | null) => void;
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
): Promise<string | null> {
  return new Promise((resolve) => {
    pending = { options, resolve };
    notify();
  });
}

export function submitPasswordPrompt(password: string | null): void {
  pending?.resolve(password);
  pending = null;
  notify();
}
