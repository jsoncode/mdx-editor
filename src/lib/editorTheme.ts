import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec, RangeSetBuilder, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const EDITOR_FONT_FAMILY =
  '"Maple Mono", "Maple Mono NF CN", "Microsoft YaHei UI", "PingFang SC", monospace';

const SELECTION_BG = "#0078d4";
const SELECTION_FG = "#ffffff";

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading1, fontWeight: "700", textDecoration: "none", fontSize: "1.2em" },
  { tag: tags.heading2, fontWeight: "600", textDecoration: "none", fontSize: "1.12em" },
  { tag: tags.heading3, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading4, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading5, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading6, fontWeight: "600", textDecoration: "none" },
  { tag: tags.link, textDecoration: "underline", color: "#2563eb" },
  { tag: tags.url, textDecoration: "underline", color: "#2563eb" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.quote, color: "#5f6368", fontStyle: "italic" },
  { tag: tags.monospace, fontFamily: EDITOR_FONT_FAMILY },
]);

const selectedTextStyle = Decoration.mark({
  class: "cm-selectedText",
  inclusive: true,
  attributes: {
    style: `color:${SELECTION_FG} !important;-webkit-text-fill-color:${SELECTION_FG} !important`,
  },
});

function hasNonEmptySelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
}

function buildSelectedTextDecorations(state: EditorView["state"]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of state.selection.ranges) {
    if (range.empty) continue;
    builder.add(range.from, range.to, selectedTextStyle);
  }
  return builder.finish();
}

/** 选中文字装饰：最高优先级，覆盖链接等语法高亮色 */
export const selectedTextField = Prec.highest(
  StateField.define<DecorationSet>({
    create(state) {
      return buildSelectedTextDecorations(state);
    },
    update(set, tr) {
      if (!tr.selection && !tr.docChanged) return set.map(tr.changes);
      return buildSelectedTextDecorations(tr.state);
    },
    provide: (field) => EditorView.decorations.from(field),
  }),
);

/** 选中态：切换 has-text-selection，用于隐藏当前行指示条 */
export const selectionFocusPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.sync(view);
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        this.sync(update.view);
      }
    }

    sync(view: EditorView) {
      view.dom.classList.toggle("has-text-selection", hasNonEmptySelection(view));
    }
  },
);

export const editorTheme = EditorView.theme(
  {
    "&": {
      fontSize: "15px",
      flex: "1 1 0",
      minHeight: "0",
      position: "relative",
      width: "100%",
      maxWidth: "100%",
    },
    ".cm-scroller": {
      fontFamily: EDITOR_FONT_FAMILY,
      lineHeight: "1.75",
      fontFeatureSettings: '"zero" 1, "cv01" 1',
      position: "absolute",
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
      overflow: "auto",
      overflowX: "hidden",
    },
    ".cm-content": {
      padding: "16px 12px",
      caretColor: "#2563eb",
      boxSizing: "border-box",
      minWidth: "0",
    },
    ".cm-placeholder": {
      color: "#9aa0a6",
      pointerEvents: "none",
      userSelect: "none",
    },
    /* 当前行：左侧指示条，避免与选中背景色块冲突 */
    ".cm-activeLine": {
      backgroundColor: "transparent !important",
      boxShadow: "inset 3px 0 0 #dbeafe",
    },
    "&.has-text-selection .cm-activeLine": {
      boxShadow: "none",
    },
    /* 选中背景：不透明蓝色，盖住当前行指示 */
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: `${SELECTION_BG} !important`,
    },
    "& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: `${SELECTION_BG} !important`,
    },
    "&:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: `${SELECTION_BG} !important`,
      opacity: "0.55",
    },
    /* 选中文字：强制白色，覆盖链接等语法高亮 */
    ".cm-selectedText, .cm-selectedText *": {
      color: `${SELECTION_FG} !important`,
      WebkitTextFillColor: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText.tok-link, .cm-selectedText.tok-url": {
      textDecoration: "underline",
      textDecorationColor: "rgba(255, 255, 255, 0.85) !important",
    },
    ".cm-selectedText .tok-link, .cm-selectedText .tok-url": {
      textDecoration: "underline",
      textDecorationColor: "rgba(255, 255, 255, 0.85) !important",
    },
    ".cm-line": {
      padding: "0 4px",
    },
    "&.cm-lineWrapping .cm-line": {
      wordBreak: "break-word",
      overflowWrap: "anywhere",
    },
    ".cm-heading": {
      textDecoration: "none !important",
    },
    ".tok-heading": {
      textDecoration: "none !important",
    },
    ".tok-heading1, .tok-heading2, .tok-heading3, .tok-heading4, .tok-heading5, .tok-heading6":
      {
        textDecoration: "none !important",
      },
  },
  { dark: false },
);

export const editorHighlight = syntaxHighlighting(markdownHighlight);
