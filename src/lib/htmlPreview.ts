import { resolveAssetUrl } from "./assetResolver";

const ASSET_REF_PATTERN = /asset\/[A-Za-z0-9._-]+/g;

function replaceAssetReferences(
  html: string,
  replacements: Map<string, string>,
): string {
  let result = html;
  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }
  return result;
}

/**
 * 修正 <script> 内非法的可选链赋值（obj?.x = y 会触发 SyntaxError）。
 * 仅用于预览，不修改用户保存的源文件。
 */
export function fixInvalidOptionalChainAssignmentInScripts(html: string): {
  html: string;
  fixed: boolean;
} {
  let fixed = false;
  const result = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (_match, attrs, body: string) => {
      const nextBody = body.replace(
        /^(\s*)([$\w]+)\?\.(.+?)\s*=\s*(.+)$/gm,
        (_line, indent: string, target: string, prop: string, value: string) => {
          fixed = true;
          return `${indent}(${target} && (${target}.${prop} = ${value}))`;
        },
      );
      return `<script${attrs}>${nextBody}</script>`;
    },
  );
  return { html: result, fixed };
}

export async function prepareHtmlForPreview(
  html: string,
  workspaceId: string | null,
): Promise<{ html: string; scriptFixApplied: boolean }> {
  const withAssets = await rewriteHtmlAssetUrls(html, workspaceId);
  const { html: fixedHtml, fixed } = fixInvalidOptionalChainAssignmentInScripts(withAssets);
  return { html: fixedHtml, scriptFixApplied: fixed };
}

export async function rewriteHtmlAssetUrls(
  html: string,
  workspaceId: string | null,
): Promise<string> {
  if (!workspaceId || !html.includes("asset/")) {
    return html;
  }

  const matches = [...new Set(html.match(ASSET_REF_PATTERN) ?? [])];
  if (matches.length === 0) return html;

  const replacements = new Map<string, string>();
  await Promise.all(
    matches.map(async (ref) => {
      const url = await resolveAssetUrl(workspaceId, ref);
      replacements.set(ref, url);
    }),
  );

  return replaceAssetReferences(html, replacements);
}

export async function resolveIframeSrc(
  workspaceId: string | null,
  src?: string,
): Promise<string> {
  if (!src?.trim()) return "";

  const trimmed = src.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const normalized = trimmed.replace(/^\.\//, "");
  if (normalized.startsWith("asset/")) {
    return resolveAssetUrl(workspaceId, normalized);
  }

  return trimmed;
}
