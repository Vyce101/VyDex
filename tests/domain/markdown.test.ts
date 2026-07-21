// Verifies safe syntax-aware validation for plain text and each Markdown profile.
import { describe, expect, test } from "vitest";
import {
  blockMarkdownSchema,
  inlineMarkdownSchema,
  methodologyMarkdownSchema,
  plainTextSchema,
  singleLineInlineMarkdownSchema,
} from "../../src/domain/canonical-records";

describe("plain and inline prose", () => {
  test("accepts safe inline formatting and code containing literal markup", () => {
    expect(
      inlineMarkdownSchema.safeParse("A **strong** [result](https://example.com) with `<Component />`.").success,
    ).toBe(true);
  });

  test.each([
    "# Heading",
    "- list item",
    "> quotation",
    "First paragraph.\n\nSecond paragraph.",
    "![image](https://example.com/image.png)",
    "<Component />",
    "{dangerousExpression}",
    "[unsafe](javascript:alert(1))",
  ])("rejects unsafe or block syntax from inline Markdown: %s", (value) => {
    expect(inlineMarkdownSchema.safeParse(value).success).toBe(false);
  });

  test("requires claims to remain on one line", () => {
    expect(singleLineInlineMarkdownSchema.safeParse("First line\nsecond line").success).toBe(false);
  });

  test("accepts only unformatted single-line values as plain text", () => {
    expect(plainTextSchema.parse("  Ordinary title  ")).toBe("Ordinary title");
    expect(plainTextSchema.safeParse("A **formatted** title").success).toBe(false);
    expect(plainTextSchema.safeParse("A title\nwith a line break").success).toBe(false);
  });
});

describe("Entry block Markdown", () => {
  test("accepts authored block prose and fenced code", () => {
    const value = [
      "A paragraph with *emphasis*.",
      "",
      "- First item",
      "- Second item",
      "",
      "> A scoped qualification.",
      "",
      "```html",
      "<Component /><script>literal example</script>",
      "```",
    ].join("\n");
    expect(blockMarkdownSchema.safeParse(value).success).toBe(true);
  });

  test.each([
    "# Competing heading",
    "---",
    "<div>Raw HTML</div>",
    "export const value = 1",
    "![image](https://example.com/image.png)",
    "[unsafe](data:text/html;base64,AAAA)",
  ])("rejects forbidden Entry block syntax: %s", (value) => {
    expect(blockMarkdownSchema.safeParse(value).success).toBe(false);
  });
});

describe("Methodology Markdown", () => {
  test("accepts one or more prose paragraphs with safe inline formatting", () => {
    expect(
      methodologyMarkdownSchema.safeParse(
        "First **methodology** paragraph with `inline code`.\n\nSecond paragraph with a [link](/methodology).",
      ).success,
    ).toBe(true);
  });

  test.each([
    "# Heading",
    "- list item",
    "> blockquote",
    "| Column |\n| --- |\n| Value |",
    "---",
    "```ts\nconst value = true;\n```",
    "    indented code\n    second code line\n",
    "~~strikethrough~~",
  ])("rejects competing Methodology structures: %s", (value) => {
    expect(methodologyMarkdownSchema.safeParse(value).success).toBe(false);
  });
});
