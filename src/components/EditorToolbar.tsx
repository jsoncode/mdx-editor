import type { ReactNode, RefObject } from "react";
import type { MarkdownFormatAction } from "../lib/markdownFormat";
import { useEditorStore } from "../stores/editorStore";
import { applyMarkdownFormat } from "../lib/markdownFormat";
import type { MarkdownEditorHandle } from "./MarkdownEditor";

interface ToolbarItem {
  action?: MarkdownFormatAction;
  label: string;
  title: string;
  icon: ReactNode;
  onClick?: () => void;
}

interface EditorToolbarProps {
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onInsertImage?: () => void;
  onInsertMedia?: () => void;
}

function ToolbarButton({
  title,
  label,
  icon,
  onClick,
}: {
  title: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="editor-toolbar-btn"
      title={title}
      aria-label={label}
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
  onInsertMedia,
}: EditorToolbarProps) {
  const view = useEditorStore((s) => s.view);

  const runFormat = (action: MarkdownFormatAction) => {
    if (view && applyMarkdownFormat(view, action)) return;
    editorRef.current?.applyFormat?.(action);
  };

  const items: (ToolbarItem | "divider")[] = [
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
      label: "音视频",
      title: "插入音视频文件",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9l6 4-6 4V9z" fill="currentColor" />
        </svg>
      ),
      onClick: onInsertMedia,
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
            onClick={handleClick}
          />
        );
      })}
    </div>
  );
}
