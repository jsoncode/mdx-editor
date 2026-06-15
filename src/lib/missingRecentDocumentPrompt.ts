interface PendingMissingRecentDocument {
  path: string;
  resolve: (remove: boolean) => void;
}

let pending: PendingMissingRecentDocument | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMissingRecentDocumentPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMissingRecentDocumentPromptPending(): PendingMissingRecentDocument | null {
  return pending;
}

export function requestMissingRecentDocumentPrompt(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { path, resolve };
    notify();
  });
}

export function submitMissingRecentDocumentPrompt(remove: boolean): void {
  pending?.resolve(remove);
  pending = null;
  notify();
}
