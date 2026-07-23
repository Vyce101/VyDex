// Publishes the immutable Dataset 1.0.0 Schema as a prerendered JSON response.
import type { APIRoute } from "astro";
import { generateVyDexDatasetSchemaV1 } from "@domain";

export const prerender = true;

export const GET: APIRoute = () => {
  const schemaResult = generateVyDexDatasetSchemaV1({
    site_origin: import.meta.env.PUBLIC_SITE_ORIGIN,
  });
  if (!schemaResult.success) {
    const codes = schemaResult.diagnostics.map(({ code }) => code).join(", ");
    throw new Error(`Cannot publish Dataset Schema 1.0.0: ${codes}`);
  }

  return new Response(schemaResult.data.serialized_json, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "application/schema+json; charset=utf-8",
    },
  });
};
