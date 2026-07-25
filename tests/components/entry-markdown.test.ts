// Verifies safe semantic rendering for validated inline and block Entry Markdown.
import { describe, expect, test } from "vitest";
import {
  renderEntryBlockMarkdown,
  renderEntryInlineMarkdown,
} from "../../src/shared/entry-markdown";

describe("Entry Markdown rendering", () => {
  test("renders escaped inline formatting and links without a paragraph wrapper", () => {
    expect(
      renderEntryInlineMarkdown(
        "`<script>alert(1)</script>` and a **strong** [result](https://example.com/result).",
      ),
    ).toBe(
      '<code>&lt;script&gt;alert(1)&lt;/script&gt;</code> and a <strong>strong</strong> <a href="https://example.com/result">result</a>.',
    );
  });

  test("renders the complete supported block structure as semantic HTML", () => {
    const html = renderEntryBlockMarkdown(
      [
        "A paragraph with [a reference][source].",
        "",
        "- First item",
        "- Second item",
        "",
        "> Bounded interpretation.",
        "",
        "| Field | Value |",
        "| --- | --- |",
        "| Claim | Supported |",
        "",
        "```text",
        "<result>",
        "```",
        "",
        "[source]: https://example.com/source \"Source title\"",
      ].join("\n"),
    );

    expect(html).toContain(
      '<p>A paragraph with <a href="https://example.com/source" title="Source title">a reference</a>.</p>',
    );
    expect(html).toContain("<ul><li><p>First item</p></li><li><p>Second item</p></li></ul>");
    expect(html).toContain("<blockquote><p>Bounded interpretation.</p></blockquote>");
    expect(html).toContain("<table><thead><tr><th>Field</th><th>Value</th></tr></thead>");
    expect(html).toContain('<pre><code class="language-text">&lt;result&gt;</code></pre>');
  });

  test("rejects unsafe and unsupported Markdown rather than emitting it", () => {
    expect(() => renderEntryInlineMarkdown("[unsafe](javascript:alert(1))")).toThrow(/unsafe link/i);
    expect(() => renderEntryBlockMarkdown("![image](https://example.com/image.png)")).toThrow(
      /unsupported Markdown/i,
    );
  });
});
