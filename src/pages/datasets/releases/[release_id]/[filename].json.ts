// Publishes the selected release's immutable generated dataset as a static JSON endpoint.
import type { APIRoute, GetStaticPaths } from "astro";
import { prepareApplicationExport } from "../../../../adapters/application-export";
import {
  loadFixedMetadataDevelopmentApplicationRelease,
  loadPersistedProductionApplicationRelease,
} from "../../../../adapters/application-release";

export const prerender = true;

export const getStaticPaths = (async () => {
  const usesFixedNonProductionMetadata = import.meta.env.DEV || import.meta.env.MODE === "test";
  const release = usesFixedNonProductionMetadata
    ? await loadFixedMetadataDevelopmentApplicationRelease({ filesystem_root: process.cwd() })
    : await loadPersistedProductionApplicationRelease({ filesystem_root: process.cwd() });
  const prepared = prepareApplicationExport(release);
  if (!prepared.success) {
    const codes = prepared.diagnostics.map(({ code }) => code).join(", ");
    throw new Error(`Cannot publish immutable Dataset 1.0.0 artifact: ${codes}.`);
  }

  const { artifact, presentation } = prepared.data;
  return [
    {
      params: {
        release_id: artifact.dataset.release_id,
        filename: presentation.download_filename.replace(/\.json$/, ""),
      },
      props: {
        download_filename: presentation.download_filename,
        public_path: presentation.download_path,
        serialized_json: artifact.serialized_json,
      },
    },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, props }) => {
  const requestedPath = `/datasets/releases/${params.release_id}/${params.filename}.json`;
  if (requestedPath !== props.public_path) {
    throw new Error("The generated Dataset endpoint path does not match its immutable artifact.");
  }

  return new Response(props.serialized_json, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `attachment; filename="${props.download_filename}"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
