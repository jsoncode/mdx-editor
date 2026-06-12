import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
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
});

function hasNonEmptySelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
}

/** 选中态：隐藏当前行高亮、强制选中文字为白色 */
export const selectionTextPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

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
      this.decorations = this.build(view);
    }

    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      for (const range of view.state.selection.ranges) {
        if (range.empty) continue;
        builder.add(range.from, range.to, selectedTextStyle);
      }
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export const editorTheme = EditorView.theme(
  {
    "&": {
      fontSize: "15px",
      height: "100%",
      width: "100%",
      maxWidth: "100%",
    },
    ".cm-scroller": {
      fontFamily: EDITOR_FONT_FAMILY,
      lineHeight: "1.75",
      fontFeatureSettings: '"zero" 1, "cv01" 1',
      overflowX: "hidden",
      overflowY: "auto",
      minHeight: 0,
    },
    ".cm-content": {
      padding: "16px 12px",
      caretColor: "#2563eb",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    ".cm-gutters": {
      backgroundColor: "#f8f9fb",
      color: "#9aa0a6",
      borderRight: "1px solid #e8eaed",
    },
    /* 当前行：左侧指示条，避免与选中背景色块冲突 */
    ".cm-activeLineGutter": {
      backgroundColor: "#f8f9fb",
      color: "#2563eb",
      fontWeight: "500",
      boxShadow: "inset 3px 0 0 #93b4fd",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent !important",
      boxShadow: "inset 3px 0 0 #dbeafe",
    },
    "&.has-text-selection .cm-activeLine": {
      boxShadow: "none",
    },
    "&.has-text-selection .cm-activeLineGutter": {
      backgroundColor: "#f8f9fb",
      color: "#9aa0a6",
      fontWeight: "400",
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
    /* 选中文字：覆盖语法高亮（含链接蓝字） */
    ".cm-selectedText": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-link": {
      color: `${SELECTION_FG} !important`,
      textDecoration: "underline",
      textDecorationColor: "rgba(255, 255, 255, 0.85) !important",
    },
    ".cm-selectedText .tok-url": {
      color: `${SELECTION_FG} !important`,
      textDecoration: "underline",
      textDecorationColor: "rgba(255, 255, 255, 0.85) !important",
    },
    ".cm-selectedText .tok-emphasis": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-strong": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-quote": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading1": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading2": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading3": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading4": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading5": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-heading6": {
      color: `${SELECTION_FG} !important`,
    },
    ".cm-selectedText .tok-monospace": {
      color: `${SELECTION_FG} !important`,
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
