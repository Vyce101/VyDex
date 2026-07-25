// Verifies safe paragraph rendering for validated Methodology Markdown.
import { expect, test } from "vitest";
import { renderMethodologyMarkdown } from "../../src/shared/canonical-markdown";

test("renders escaped multi-paragraph Methodology formatting and safe links", () => {
  expect(
    renderMethodologyMarkdown(
      "A **bounded** [rule](https://example.com/rule).\n\n`<scope>` remains text.",
    ),
  ).toBe(
    '<p>A <strong>bounded</strong> <a href="https://example.com/rule">rule</a>.</p><p><code>&lt;scope&gt;</code> remains text.</p>',
  );
});

test("rejects unsafe links and non-paragraph Methodology structures", () => {
  expect(() => renderMethodologyMarkdown("[unsafe](javascript:alert(1))")).toThrow(/unsafe link/i);
  expect(() => renderMethodologyMarkdown("- Hidden definition")).toThrow(/paragraphs only/i);
});
