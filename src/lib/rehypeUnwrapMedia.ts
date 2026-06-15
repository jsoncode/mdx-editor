import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";

const BLOCK_MEDIA_TAGS = new Set(["video", "audio", "img"]);

/** 将 block 级媒体从非法的 <p> 包裹中解出，避免浏览器/WebView 错误解析 DOM。 */
export function rehypeUnwrapMedia() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index == null || node.tagName !== "p") return;
      if (node.children.length !== 1) return;
      const child = node.children[0];
      if (child.type !== "element") return;
      if (!BLOCK_MEDIA_TAGS.has(child.tagName)) return;
      parent.children[index] = child;
    });
  };
}
