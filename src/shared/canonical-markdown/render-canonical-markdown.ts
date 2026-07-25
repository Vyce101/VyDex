// Renders validated canonical Markdown profiles as escaped semantic HTML.
import type { Nodes, Parent, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const canonicalMarkdownParser = unified().use(remarkParse).use(remarkGfm);
const SAFE_LINK_PROTOCOLS = new Set(["http", "https", "mailto"]);
const METHODOLOGY_NODE_TYPES = new Set([
  "root",
  "paragraph",
  "text",
  "emphasis",
  "strong",
  "link",
  "inlineCode",
  "break",
]);

type DefinitionLookup = ReadonlyMap<string, { url: string; title?: string | null }>;

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
  return !protocolMatch || SAFE_LINK_PROTOCOLS.has(protocolMatch[1]!.toLowerCase());
}

function renderLink(url: string, title: string | null | undefined, content: string): string {
  if (!isSafeLink(url)) throw new Error("Canonical Markdown contains an unsafe link.");
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(url)}"${titleAttribute}>${content}</a>`;
}

function renderChildren(node: Parent, definitions: DefinitionLookup): string {
  return node.children.map((child) => renderNode(child as Nodes, definitions)).join("");
}

function renderTable(node: Extract<Nodes, { type: "table" }>, definitions: DefinitionLookup): string {
  const [heading, ...rows] = node.children;
  const renderRow = (row: (typeof node.children)[number], cellName: "th" | "td") =>
    `<tr>${row.children
      .map((cell) => `<${cellName}>${renderChildren(cell, definitions)}</${cellName}>`)
      .join("")}</tr>`;
  const head = heading ? `<thead>${renderRow(heading, "th")}</thead>` : "";
  const body = rows.length > 0
    ? `<tbody>${rows.map((row) => renderRow(row, "td")).join("")}</tbody>`
    : "";
  return `<table>${head}${body}</table>`;
}

function renderNode(node: Nodes, definitions: DefinitionLookup): string {
  switch (node.type) {
    case "root":
      return renderChildren(node, definitions);
    case "paragraph":
      return `<p>${renderChildren(node, definitions)}</p>`;
    case "text":
      return escapeHtml(node.value);
    case "emphasis":
      return `<em>${renderChildren(node, definitions)}</em>`;
    case "strong":
      return `<strong>${renderChildren(node, definitions)}</strong>`;
    case "delete":
      return `<del>${renderChildren(node, definitions)}</del>`;
    case "inlineCode":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "break":
      return "<br>";
    case "link":
      return renderLink(node.url, node.title, renderChildren(node, definitions));
    case "linkReference": {
      const definition = definitions.get(node.identifier.toLowerCase());
      if (!definition) throw new Error(`Canonical Markdown has no definition for ${node.identifier}.`);
      return renderLink(definition.url, definition.title, renderChildren(node, definitions));
    }
    case "definition":
      return "";
    case "list": {
      const listName = node.ordered ? "ol" : "ul";
      const start = node.ordered && node.start && node.start !== 1 ? ` start="${node.start}"` : "";
      return `<${listName}${start}>${renderChildren(node, definitions)}</${listName}>`;
    }
    case "listItem":
      return `<li>${renderChildren(node, definitions)}</li>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node, definitions)}</blockquote>`;
    case "table":
      return renderTable(node, definitions);
    case "tableRow":
    case "tableCell":
      throw new Error(`Canonical Markdown contains an unexpected standalone ${node.type}.`);
    case "code": {
      const language = node.lang ? ` class="language-${escapeHtml(node.lang)}"` : "";
      return `<pre><code${language}>${escapeHtml(node.value)}</code></pre>`;
    }
    default:
      throw new Error(`Canonical Markdown contains unsupported Markdown: ${node.type}.`);
  }
}

function parseCanonicalMarkdown(value: string): Root {
  try {
    return canonicalMarkdownParser.parse(value) as Root;
  } catch {
    throw new Error("Canonical Markdown must be valid Markdown.");
  }
}

function collectDefinitions(tree: Root): DefinitionLookup {
  return new Map(
    tree.children
      .filter((node): node is Extract<Nodes, { type: "definition" }> => node.type === "definition")
      .map((definition) => [
        definition.identifier.toLowerCase(),
        { url: definition.url, title: definition.title },
      ]),
  );
}

function assertMethodologyNodes(node: Nodes): void {
  if (!METHODOLOGY_NODE_TYPES.has(node.type)) {
    throw new Error(`Methodology Markdown contains unsupported Markdown: ${node.type}.`);
  }

  if ("children" in node) {
    for (const child of node.children) assertMethodologyNodes(child as Nodes);
  }
}

export function renderCanonicalInlineMarkdown(value: string): string {
  const tree = parseCanonicalMarkdown(value);
  if (tree.children.length !== 1 || tree.children[0]?.type !== "paragraph") {
    throw new Error("Canonical inline Markdown requires one paragraph.");
  }
  return renderChildren(tree.children[0], collectDefinitions(tree));
}

export function renderCanonicalBlockMarkdown(value: string): string {
  const tree = parseCanonicalMarkdown(value);
  return renderNode(tree, collectDefinitions(tree));
}

export function renderMethodologyMarkdown(value: string): string {
  const tree = parseCanonicalMarkdown(value);
  if (tree.children.some((node) => node.type !== "paragraph")) {
    throw new Error("Methodology Markdown requires ordinary paragraphs only.");
  }
  assertMethodologyNodes(tree);
  return renderNode(tree, collectDefinitions(tree));
}
