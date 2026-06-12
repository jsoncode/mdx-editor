import type { EditorView } from "@codemirror/view";

export type MarkdownFormatAction =
  | "bold"
  | "italic"
  | "strike"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "quote"
  | "code"
  | "codeBlock"
  | "link"
  | "image"
  | "hr"
  | "table";

function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string,
) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const body = selected || placeholder;
  const insert = before + body + after;

  view.dispatch({
    changes: { from, to, insert },
    selection: selected
      ? { anchor: from + before.length, head: to + before.length }
      : { anchor: from + before.length, head: from + before.length + placeholder.length },
  });
  view.focus();
}

function setLinePrefix(view: EditorView, prefix: string, placeholder: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const text = line.text;

  const headingMatch = text.match(/^(#{1,6}\s)/);
  const listMatch = text.match(/^(\d+\.\s|-\s|\*\s|>\s)/);

  let nextLine = text;
  if (headingMatch || listMatch) {
    nextLine = text.replace(/^(#{1,6}\s|\d+\.\s|-\s|\*\s|>\s)/, "");
  }

  if (!nextLine.trim()) {
    nextLine = placeholder;
  }

  const insert = prefix + nextLine.replace(/^\s+/, "");
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    selection: {
      anchor: line.from + prefix.length,
      head: line.from + insert.length,
    },
  });
  view.focus();
}

function insertBlock(view: EditorView, text: string, cursorOffset: number) {
  const { from, to } = view.state.selection.main;
  const needsLeadingNewline = from > 0 && view.state.sliceDoc(from - 1, from) !== "\n";
  const insert = `${needsLeadingNewline ? "\n" : ""}${text}`;

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length + cursorOffset },
  });
  view.focus();
}

export function applyMarkdownFormat(
  view: EditorView,
  action: MarkdownFormatAction,
): boolean {
  switch (action) {
    case "bold":
      wrapSelection(view, "**", "**", "粗体");
      return true;
    case "italic":
      wrapSelection(view, "*", "*", "斜体");
      return true;
    case "strike":
      wrapSelection(view, "~~", "~~", "删除线");
      return true;
    case "h1":
      setLinePrefix(view, "# ", "标题");
      return true;
    case "h2":
      setLinePrefix(view, "## ", "标题");
      return true;
    case "h3":
      setLinePrefix(view, "### ", "标题");
      return true;
    case "ul":
      setLinePrefix(view, "- ", "列表项");
      return true;
    case "ol":
      setLinePrefix(view, "1. ", "列表项");
      return true;
    case "quote":
      setLinePrefix(view, "> ", "引用内容");
      return true;
    case "code":
      wrapSelection(view, "`", "`", "code");
      return true;
    case "codeBlock":
      insertBlock(view, "```\n\n```", -4);
      return true;
    case "link":
      wrapSelection(view, "[", "](https://)", "链接文字");
      return true;
    case "image":
      wrapSelection(view, "![", "](asset/图片.png)", "图片描述");
      return true;
    case "hr":
      insertBlock(view, "\n---\n", 0);
      return true;
    case "table":
      insertBlock(
        view,
        "\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n",
        -30,
      );
      return true;
    default:
      return false;
  }
}
