import { useEffect, useRef, useState, type ReactNode } from "react";

interface RibbonMenuProps {
  label: string;
  children: ReactNode;
}

export function RibbonMenu({ label, children }: RibbonMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`ribbon-menu${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="ribbon-menu-trigger"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
        <span className="ribbon-menu-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="ribbon-dropdown" role="menu">
          <div
            onClick={() => setOpen(false)}
            onKeyDown={() => undefined}
            role="presentation"
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface RibbonMenuItemProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export function RibbonMenuItem({ label, onClick, icon }: RibbonMenuItemProps) {
  return (
    <button
      type="button"
      className="ribbon-menu-item"
      role="menuitem"
      onClick={onClick}
    >
      {icon && <span className="ribbon-menu-item-icon">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

interface LayoutToggleProps {
  mode: "edit" | "preview" | "split";
  onChange: (mode: "edit" | "preview" | "split") => void;
}

export function LayoutToggle({ mode, onChange }: LayoutToggleProps) {
  const items: { id: "edit" | "preview" | "split"; label: string }[] = [
    { id: "edit", label: "编辑" },
    { id: "preview", label: "预览" },
    { id: "split", label: "双栏" },
  ];

  return (
    <div className="layout-toggle" role="group" aria-label="布局模式">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`layout-toggle-btn${mode === item.id ? " active" : ""}`}
          aria-pressed={mode === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
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

export function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9V4h10v5M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 14h10v6H7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
