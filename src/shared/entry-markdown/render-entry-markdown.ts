// Preserves the Entry-owned API over the shared canonical Markdown renderer.
import {
  renderCanonicalBlockMarkdown,
  renderCanonicalInlineMarkdown,
} from "../canonical-markdown";

export function renderEntryInlineMarkdown(value: string): string {
  return renderCanonicalInlineMarkdown(value);
}

export function renderEntryBlockMarkdown(value: string): string {
  return renderCanonicalBlockMarkdown(value);
}
