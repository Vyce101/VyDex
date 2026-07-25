// Parses staged HTML and provides reusable release-verification queries and path resolution.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "parse5";

export type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

export function descendants(node: HtmlNode, predicate: (candidate: HtmlNode) => boolean): HtmlNode[] {
  const matches: HtmlNode[] = [];
  for (const child of node.childNodes ?? []) {
    if (predicate(child)) matches.push(child);
    matches.push(...descendants(child, predicate));
  }
  return matches;
}

export function attribute(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find((item) => item.name === name)?.value;
}

export function hasAttribute(node: HtmlNode, name: string, value?: string): boolean {
  const actual = attribute(node, name);
  return actual !== undefined && (value === undefined || actual === value);
}

export function textContent(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(textContent).join("").replace(/\s+/g, " ").trim();
}

export function findFirst(
  node: HtmlNode,
  predicate: (candidate: HtmlNode) => boolean,
): HtmlNode | undefined {
  return descendants(node, predicate)[0];
}

export function titleLinksWithin(node: HtmlNode): Array<{ href: string; title: string }> {
  return descendants(
    node,
    (candidate) => hasAttribute(candidate, "data-entry-preview-field", "title"),
  ).flatMap((titleNode) => {
    const link = findFirst(titleNode, (candidate) => candidate.tagName === "a");
    const href = link ? attribute(link, "href") : undefined;
    return link && href ? [{ href, title: textContent(link) }] : [];
  });
}

export function hrefPath(
  href: string,
  siteOrigin: string,
  currentRoute = "/",
): { pathname: string; hash: string } | undefined {
  if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return undefined;
  let url: URL;
  try {
    url = new URL(href, `${siteOrigin}${currentRoute}`);
  } catch {
    return { pathname: "__invalid__", hash: "" };
  }
  if (url.origin !== siteOrigin) return undefined;
  return { pathname: url.pathname, hash: url.hash };
}

export function routeToFilename(outputRoot: string, route: string): string {
  const pathname = new URL(route, "https://route.invalid").pathname;
  if (pathname === "/") return resolve(outputRoot, "index.html");
  const relativePath = pathname.replace(/^\/+/, "");
  return pathname.endsWith("/")
    ? resolve(outputRoot, relativePath, "index.html")
    : resolve(outputRoot, relativePath);
}

export async function readHtml(
  outputRoot: string,
  route: string,
): Promise<{ raw: string; document: HtmlNode }> {
  const raw = await readFile(routeToFilename(outputRoot, route), "utf8");
  return { raw, document: parse(raw) as HtmlNode };
}

export function parseHtml(rawHtml: string): HtmlNode {
  return parse(rawHtml) as HtmlNode;
}
