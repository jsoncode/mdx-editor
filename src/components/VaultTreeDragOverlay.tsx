import { createPortal } from "react-dom";
import type { VaultDragPayload, VaultDropLine } from "../hooks/useVaultTreeDrag";

interface VaultTreeDragOverlayProps {
  dragging: VaultDragPayload | null;
  pointer: { x: number; y: number } | null;
  dropLine: VaultDropLine | null;
  dropValid: boolean;
}

export function VaultTreeDragOverlay({
  dragging,
  pointer,
  dropLine,
  dropValid,
}: VaultTreeDragOverlayProps) {
  if (!dragging || !pointer) return null;

  return createPortal(
    <>
      <div
        className="vault-drag-ghost"
        style={{ left: pointer.x + 14, top: pointer.y + 10 }}
        aria-hidden="true"
      >
        <span className="vault-drag-ghost-icon">
          {dragging.kind === "folder" ? <FolderIcon /> : <FileIcon />}
        </span>
        <span className="vault-drag-ghost-label">{dragging.name}</span>
      </div>
      {dropLine && dropValid && (
        <div
          className="vault-drop-line"
          style={{
            top: dropLine.top,
            left: dropLine.left,
            width: dropLine.width,
          }}
          aria-hidden="true"
        />
      )}
    </>,
    document.body,
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 1.5H12.5A1.5 1.5 0 0 1 14 6v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 2h4.5L13 5.5V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
