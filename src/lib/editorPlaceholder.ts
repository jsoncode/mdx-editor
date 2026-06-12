import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const PLACEHOLDER_TEXT = "请输入文档内容";

class PlaceholderWidget extends WidgetType {
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-placeholder";
    el.textContent = PLACEHOLDER_TEXT;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq() {
    return true;
  }
}

const placeholderWidget = new PlaceholderWidget();

export const editorPlaceholder = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView) {
      if (view.state.doc.length > 0) {
        return Decoration.none;
      }

      const builder = new RangeSetBuilder<Decoration>();
      builder.add(
        0,
        0,
        Decoration.widget({
          widget: placeholderWidget,
          side: 1,
        }),
      );
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
