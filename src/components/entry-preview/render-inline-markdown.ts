// Renders validated Entry preview inline Markdown into escaped semantic HTML.
import type { Nodes, Parent, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const inlineMarkdownParser = unified().use(remarkParse).use(remarkGfm);
const SAFE_LINK_PROTOCOLS = new Set(["http", "https", "mailto"]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeLink(url: string): boolean {
  const compactUrl = url.replace(/[\u0000-\u0020\u007f]+/g, "");
  const protocolMatch = /^([a-z][a-z\d+.-]*):/i.exec(compactUrl);
  return !protocolMatch || SAFE_LINK_PROTOCOLS.has(protocolMatch[1].toLowerCase());
}

function renderChildren(node: Parent): string {
  return node.children.map((child) => renderNode(child as Nodes)).join("");
}

function renderNode(node: Nodes): string {
  switch (node.type) {
    case "root":
    case "paragraph":
      return renderChildren(node);
    case "text":
      return escapeHtml(node.value);
    case "emphasis":
      return `<em>${renderChildren(node)}</em>`;
    case "strong":
      return `<strong>${renderChildren(node)}</strong>`;
    case "delete":
      return `<del>${renderChildren(node)}</del>`;
    case "inlineCode":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "break":
      return "<br>";
    case "link": {
      if (!isSafeLink(node.url)) {
        throw new Error("Entry preview claim contains an unsafe link.");
      }
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : "";
      return `<a href="${escapeHtml(node.url)}"${title}>${renderChildren(node)}</a>`;
    }
    default:
      throw new Error(`Entry preview claim contains unsupported Markdown: ${node.type}.`);
  }
}

export function renderEntryPreviewInlineMarkdown(value: string): string {
  let tree: Root;
  try {
    tree = inlineMarkdownParser.parse(value) as Root;
  } catch {
    throw new Error("Entry preview requires valid inline Markdown for claim.");
  }

  if (tree.children.length !== 1 || tree.children[0]?.type !== "paragraph") {
    throw new Error("Entry preview requires one inline Markdown paragraph for claim.");
  }
  return renderNode(tree);
}
