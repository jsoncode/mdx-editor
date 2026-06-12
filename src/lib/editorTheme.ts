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

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading1, fontWeight: "700", textDecoration: "none", fontSize: "1.2em" },
  { tag: tags.heading2, fontWeight: "600", textDecoration: "none", fontSize: "1.12em" },
  { tag: tags.heading3, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading4, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading5, fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading6, fontWeight: "600", textDecoration: "none" },
  { tag: tags.link, textDecoration: "underline", color: "#2563eb" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.quote, color: "#5f6368", fontStyle: "italic" },
  { tag: tags.monospace, fontFamily: EDITOR_FONT_FAMILY },
]);

const selectedTextStyle = Decoration.mark({
  class: "cm-selectedText",
});

/** 选中时将文字设为浅色，避免语法高亮颜色与选中背景对比不足 */
export const selectionTextPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView) {
      if (!view.hasFocus) {
        return Decoration.none;
      }

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
    },
    ".cm-scroller": {
      fontFamily: EDITOR_FONT_FAMILY,
      lineHeight: "1.75",
      fontFeatureSettings: '"zero" 1, "cv01" 1',
      overflow: "auto",
      minHeight: 0,
    },
    ".cm-content": {
      padding: "16px 12px",
      caretColor: "#2563eb",
    },
    ".cm-gutters": {
      backgroundColor: "#f8f9fb",
      color: "#9aa0a6",
      borderRight: "1px solid #e8eaed",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#eef2ff",
    },
    ".cm-activeLine": {
      backgroundColor: "#f5f8ff",
    },
    /* 覆盖 CodeMirror 默认浅色选中（#d7d4f0），需与默认主题同等选择器优先级 */
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "#0078d4 !important",
    },
    "& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "#0078d4 !important",
    },
    "&:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "#0078d4 !important",
      opacity: "0.45",
    },
    ".cm-selectedText": {
      color: "#ffffff !important",
    },
    ".cm-line": {
      padding: "0 4px",
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
