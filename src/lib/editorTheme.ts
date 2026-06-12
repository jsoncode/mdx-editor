import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
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

export const editorTheme = EditorView.theme({
  "&": {
    fontSize: "15px",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: EDITOR_FONT_FAMILY,
    lineHeight: "1.75",
    fontFeatureSettings: '"zero" 1, "cv01" 1',
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
  ".cm-selectionBackground": {
    backgroundColor: "#0078d4 !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#0078d4 !important",
  },
  "&:not(.cm-focused) .cm-selectionBackground": {
    backgroundColor: "#b4d7fe !important",
  },
  ".cm-content ::selection": {
    backgroundColor: "#0078d4 !important",
    color: "#ffffff",
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
});

export const editorHighlight = syntaxHighlighting(markdownHighlight);
