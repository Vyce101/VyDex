// Validates plain text and the allowed syntax profiles for authored Markdown prose.
import type { Nodes, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { z } from "zod";

type MarkdownProfile = "inline" | "entry_block" | "methodology";

const markdownParser = unified().use(remarkParse).use(remarkGfm);
const mdxParser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
const SAFE_LINK_PROTOCOLS = new Set(["http", "https", "mailto"]);
const INLINE_NODE_TYPES = new Set([
  "root",
  "paragraph",
  "text",
  "emphasis",
  "strong",
  "delete",
  "link",
  "inlineCode",
  "break",
]);
const ENTRY_BLOCK_NODE_TYPES = new Set([
  ...INLINE_NODE_TYPES,
  "definition",
  "linkReference",
  "list",
  "listItem",
  "blockquote",
  "table",
  "tableRow",
  "tableCell",
  "code",
]);
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
const ALWAYS_FORBIDDEN_NODE_TYPES = new Set([
  "html",
  "image",
  "imageReference",
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
]);

function parseMarkdown(value: string, parser: typeof markdownParser): Root | null {
  try {
    return parser.parse(value) as Root;
  } catch {
    return null;
  }
}

function containsMdx(tree: Root): boolean {
  let hasMdx = false;
  visit(tree, (node: Nodes) => {
    if (node.type.startsWith("mdx")) {
      hasMdx = true;
    }
  });
  return hasMdx;
}

function isSafeLink(url: string): boolean {
  const compactUrl = url.replace(/[\u0000-\u0020\u007f]+/g, "");
  const protocolMatch = /^([a-z][a-z\d+.-]*):/i.exec(compactUrl);
  return !protocolMatch || SAFE_LINK_PROTOCOLS.has(protocolMatch[1].toLowerCase());
}

function findMarkdownViolation(tree: Root, profile: MarkdownProfile): string | null {
  if (profile === "inline" && (tree.children.length !== 1 || tree.children[0]?.type !== "paragraph")) {
    return "Must contain exactly one Markdown paragraph with inline formatting only.";
  }

  if (profile === "methodology" && tree.children.some((node) => node.type !== "paragraph")) {
    return "Methodology Markdown may contain ordinary paragraphs only.";
  }

  const allowedTypes =
    profile === "inline"
      ? INLINE_NODE_TYPES
      : profile === "entry_block"
        ? ENTRY_BLOCK_NODE_TYPES
        : METHODOLOGY_NODE_TYPES;
  let violation: string | null = null;

  visit(tree, (node: Nodes) => {
    if (violation) {
      return;
    }

    if (ALWAYS_FORBIDDEN_NODE_TYPES.has(node.type)) {
      violation = `Markdown node ${node.type} is not permitted.`;
      return;
    }

    if (!allowedTypes.has(node.type)) {
      violation = `Markdown node ${node.type} is not permitted in this field.`;
      return;
    }

    if ((node.type === "link" || node.type === "definition") && !isSafeLink(node.url)) {
      violation = "Markdown links must use a safe protocol.";
    }
  });

  return violation;
}

function createMarkdownSchema<Brand extends string>(profile: MarkdownProfile) {
  return z
    .string()
    .superRefine((value, context) => {
      if (value.trim().length === 0) {
        context.addIssue({
          code: "custom",
          message: "Must contain non-empty Markdown.",
          params: { diagnosticCode: "required_value" },
        });
        return;
      }

      const tree = parseMarkdown(value, markdownParser);
      const mdxTree = parseMarkdown(value, mdxParser);
      const violation = !tree || !mdxTree
        ? "Must contain valid plain Markdown."
        : containsMdx(mdxTree)
          ? "MDX syntax is not permitted."
          : findMarkdownViolation(tree, profile);

      if (violation) {
        context.addIssue({ code: "custom", message: violation, params: { diagnosticCode: "invalid_markdown" } });
      }
    })
    .transform((value) => value.trim())
    .brand<Brand>();
}

export const plainTextSchema = z
  .string()
  .refine((value) => !/[\r\n]/.test(value), { error: "Must be single-line plain text." })
  .transform((value) => value.trim())
  .pipe(z.string().min(1, { error: "Must be non-empty plain text." }))
  .superRefine((value, context) => {
    const tree = parseMarkdown(value, markdownParser);
    const mdxTree = parseMarkdown(value, mdxParser);
    const containsOnlyText =
      tree?.children.length === 1 &&
      tree.children[0]?.type === "paragraph" &&
      tree.children[0].children.every((node) => node.type === "text") &&
      mdxTree !== null &&
      !containsMdx(mdxTree);

    if (!containsOnlyText) {
      context.addIssue({
        code: "custom",
        message: "Must not contain Markdown, HTML, or MDX syntax.",
        params: { diagnosticCode: "invalid_plain_text" },
      });
    }
  });

export const reviewReasonSchema = plainTextSchema.pipe(
  z.string().max(500, { error: "Review reason must contain at most 500 characters." }),
);

export const inlineMarkdownSchema = createMarkdownSchema<"InlineMarkdown">("inline");
export type InlineMarkdown = z.infer<typeof inlineMarkdownSchema>;

export const singleLineInlineMarkdownSchema = z
  .string()
  .refine((value) => !/[\r\n]/.test(value), { error: "Must be single-line inline Markdown." })
  .pipe(inlineMarkdownSchema);

export const blockMarkdownSchema = createMarkdownSchema<"BlockMarkdown">("entry_block");
export type BlockMarkdown = z.infer<typeof blockMarkdownSchema>;

export const methodologyMarkdownSchema = createMarkdownSchema<"MethodologyMarkdown">("methodology");
export type MethodologyMarkdown = z.infer<typeof methodologyMarkdownSchema>;
