import type { ReactNode, RefObject } from "react";
import type { MarkdownFormatAction } from "../lib/markdownFormat";
import { runRedo, runUndo } from "../lib/editorHistory";
import { useEditorStore } from "../stores/editorStore";
import { applyMarkdownFormat } from "../lib/markdownFormat";
import type { MarkdownEditorHandle } from "./MarkdownEditor";

interface ToolbarItem {
  action?: MarkdownFormatAction;
  label: string;
  title: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

interface EditorToolbarProps {
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onInsertImage?: () => void;
  onInsertAudio?: () => void;
  onInsertVideo?: () => void;
}

function ToolbarButton({
  title,
  label,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="editor-toolbar-btn"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="editor-toolbar-divider" aria-hidden="true" />;
}

export function EditorToolbar({
  editorRef,
  onInsertImage,
  onInsertAudio,
  onInsertVideo,
}: EditorToolbarProps) {
  const view = useEditorStore((s) => s.view);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);

  const runFormat = (action: MarkdownFormatAction) => {
    if (view && applyMarkdownFormat(view, action)) return;
    editorRef.current?.applyFormat?.(action);
  };

  const items: (ToolbarItem | "divider")[] = [
    {
      label: "撤销",
      title: "撤销 (Ctrl+Z)",
      icon: <UndoIcon />,
      onClick: () => {
        if (view) runUndo(view);
        else editorRef.current?.undo();
      },
      disabled: !canUndo,
    },
    {
      label: "重做",
      title: "重做 (Ctrl+Y)",
      icon: <RedoIcon />,
      onClick: () => {
        if (view) runRedo(view);
        else editorRef.current?.redo();
      },
      disabled: !canRedo,
    },
    "divider",
    {
      action: "bold",
      label: "粗体",
      title: "粗体 (Ctrl+B)",
      icon: <strong>B</strong>,
    },
    {
      action: "italic",
      label: "斜体",
      title: "斜体 (Ctrl+I)",
      icon: <em>I</em>,
    },
    {
      action: "strike",
      label: "删除线",
      title: "删除线",
      icon: <s>S</s>,
    },
    "divider",
    {
      action: "h1",
      label: "一级标题",
      title: "一级标题",
      icon: <span className="editor-toolbar-heading">H1</span>,
    },
    {
      action: "h2",
      label: "二级标题",
      title: "二级标题",
      icon: <span className="editor-toolbar-heading">H2</span>,
    },
    {
      action: "h3",
      label: "三级标题",
      title: "三级标题",
      icon: <span className="editor-toolbar-heading">H3</span>,
    },
    "divider",
    {
      action: "ul",
      label: "无序列表",
      title: "无序列表",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      action: "ol",
      label: "有序列表",
      title: "有序列表",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6h11M10 12h11M10 18h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <text x="2" y="8" fontSize="7" fill="currentColor">1</text>
          <text x="2" y="14" fontSize="7" fill="currentColor">2</text>
          <text x="2" y="20" fontSize="7" fill="currentColor">3</text>
        </svg>
      ),
    },
    {
      action: "quote",
      label: "引用",
      title: "引用",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7h4v6H5V9a2 2 0 0 1 2-2zm8 0h4v6h-6V9a2 2 0 0 1 2-2z" fill="currentColor" />
        </svg>
      ),
    },
    "divider",
    {
      action: "link",
      label: "链接",
      title: "插入链接",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 14a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "图片",
      title: "插入图片文件",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5-4 4-2-2-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
      onClick: onInsertImage,
    },
    {
      label: "音频",
      title: "插入音频文件",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18V6l10-2v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 15a3 3 0 1 0 0-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M19 16a2 2 0 1 0 0-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      onClick: onInsertAudio,
    },
    {
      label: "视频",
      title: "插入视频文件",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9l6 4-6 4V9z" fill="currentColor" />
        </svg>
      ),
      onClick: onInsertVideo,
    },
    "divider",
    {
      action: "code",
      label: "行内代码",
      title: "行内代码",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      action: "codeBlock",
      label: "代码块",
      title: "代码块",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 10l2 2-2 2M12 14h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      action: "table",
      label: "表格",
      title: "插入表格",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3 10h18M3 14h18M9 5v14M15 5v14" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      action: "hr",
      label: "分隔线",
      title: "分隔线",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Markdown 格式工具栏">
      {items.map((item, index) => {
        if (item === "divider") {
          return <ToolbarDivider key={`div-${index}`} />;
        }

        const handleClick = () => {
          if (item.onClick) {
            item.onClick();
            return;
          }
          if (item.action) {
            runFormat(item.action);
          }
        };

        return (
          <ToolbarButton
            key={item.label}
            title={item.title}
            label={item.label}
            icon={item.icon}
            disabled={item.disabled}
            onClick={handleClick}
          />
        );
      })}
    </div>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 7H5v4M5 11c1.5-3 4.5-5 8-5 4.4 0 8 3.6 8 8s-3.6 8-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 7h4v4M19 11c-1.5-3-4.5-5-8-5-4.4 0-8 3.6-8 8s3.6 8 8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
