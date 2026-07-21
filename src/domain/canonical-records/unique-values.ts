// Adds precise Zod issues for repeated values in authored arrays.
import type { z } from "zod";

export function addDuplicateValueIssues(
  context: z.RefinementCtx,
  values: readonly unknown[],
  pathPrefix: PropertyKey[],
  label: string,
  pathSuffix: PropertyKey[] = [],
): void {
  const seen = new Set<unknown>();

  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        path: [...pathPrefix, index, ...pathSuffix],
        message: `${label} values must be unique.`,
        params: { diagnosticCode: "duplicate_value" },
      });
      return;
    }
    seen.add(value);
  });
}
