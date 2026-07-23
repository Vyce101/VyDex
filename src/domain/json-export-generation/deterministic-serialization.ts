// Serializes JSON documents with stable indentation and one final newline.
export function serializeJsonDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
