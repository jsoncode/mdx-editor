import type { ReactNode } from "react";

interface RibbonButtonProps {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}

export function RibbonButton({ label, onClick, icon }: RibbonButtonProps) {
  return (
    <button
      type="button"
      className="ribbon-btn"
      onClick={onClick}
      title={label}
    >
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

interface RibbonGroupProps {
  label: string;
  children: ReactNode;
}

export function RibbonGroup({ label, children }: RibbonGroupProps) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function IconNew() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 2v6h6M12 18v-6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconOpen() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16M6 16l4-9h4l4 9M8 7V4h8v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconSave() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 21v-8H7v8M7 3v5h8" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconRecent() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconExport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconImage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5-4 4-2-2-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconMedia() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9l6 4-6 4V9z" fill="currentColor" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
