// Verifies sitemap completeness in one deployment-shaped static output directory.
import { resolve } from "node:path";
import { STAGE_ONE_PUBLIC_SITE_ORIGIN } from "../../src/adapters/cloudflare-pages-environment";
import { verifyProductionSitemapArtifact } from "../../src/adapters/production-sitemap-artifact";

async function main(): Promise<void> {
  const outputRoot = resolve(process.argv[2] ?? "dist");
  const report = await verifyProductionSitemapArtifact({
    output_root: outputRoot,
    site_origin: STAGE_ONE_PUBLIC_SITE_ORIGIN,
  });
  process.stdout.write(
    `Production sitemap verification succeeded for ${report.public_page_count} public pages across ${report.sitemap_file_count} sitemap files.\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Production sitemap verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
