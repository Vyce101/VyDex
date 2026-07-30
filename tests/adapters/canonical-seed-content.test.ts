// Verifies the repository's real Stage 1 seed ledger and its production release projection.
import { beforeAll, describe, expect, test } from "vitest";
import { loadCanonicalRecords, type LoadedCanonicalRecords } from "../../src/adapters/canonical-record-loader";
import {
  entryPublicationSnapshotSchema,
  entrySchema,
  topicTrailSchema,
  type Entry,
  type EntryPublicationSnapshot,
  type TopicTrail,
} from "../../src/domain/canonical-records";
import { constructReleaseModel, type ReleaseModel } from "../../src/domain/release-construction";

const SITE_ORIGIN = "https://vydex-preview-123.pages.dev";
const METHODOLOGY_ID = "019f9593-391e-79d1-8f4a-3c88e68fc069";
const PUBLISHED_AT = "2026-07-24T20:18:26Z";
const DREAMER_REVIEW_PUBLISHED_AT = "2026-07-25T13:03:03Z";
const UMASS_PUBLISHED_AT = "2026-07-30T13:28:14Z";

const SEEDS = {
  dreamer: {
    entry_id: "019f95f1-29e5-7ea2-a96e-03b7e9d296cb",
    revision_id: "019f95f1-29e6-7e79-b6e4-85196b9c0ec3",
    current_revision_id: "019f995f-3e13-7666-94f1-4331d5503e5f",
    trail_id: "019f95f1-29e6-73e2-8d15-188f7e0593bf",
    slug: "dreamer-4-offline-minecraft-diamonds",
    aliases: [],
    update_summary:
      "Initial entry added from the Dreamer 4 preprint, project artifacts, and prior Minecraft-agent baselines.",
  },
  gdmi: {
    entry_id: "019f95f1-29e6-706f-a250-e15e16b91b72",
    revision_id: "019f95f1-29e6-77d3-bbe5-b31cc88a575c",
    trail_id: "019f95f1-29e6-783b-9df9-0bc9b2342563",
    slug: "google-deepmind-gdmi-leading-hurricane-guidance-2025",
    aliases: ["google-deepmind-gdmi-hurricane-forecasting-2025"],
    update_summary:
      "Initial entry added. The claim is centred on formal 2025 NHC verification rather than DeepMind’s June 2025 launch announcement.",
  },
  metr: {
    entry_id: "019f95f1-29e6-7b1a-b120-8c2d9d628ed9",
    revision_id: "019f95f1-29e6-7ad1-9775-b85f07fd5b10",
    trail_id: "019f95f1-29e6-7321-8eae-45113baba7cd",
    slug: "metr-software-task-horizons-doubling-seven-months",
    aliases: [],
    update_summary:
      "Initial entry added from METR’s peer-reviewed task-horizon study, public analysis artifacts, Time Horizon 1.1, and the BRIDGE reproduction.",
  },
  umass: {
    entry_id: "019fb336-18b1-7652-9af7-fdbe971db4f0",
    revision_id: "019fb336-18b5-76e4-90c9-fdaf74f0e0cf",
    trail_id: "019fb336-18b5-76e4-90c9-f8aa8dbaae4f",
    slug: "artificial-neuron-biological-voltage-energy",
    aliases: [],
    update_summary:
      "Initial entry added from the peer-reviewed device study, source data, transparent peer review, prior bio-voltage and biointerface research, and later field context.",
  },
} as const;

const EXPECTED_SOURCE_ROLES = {
  [SEEDS.dreamer.entry_id]: {
    "dreamer-4-paper": "primary_evidence",
    "dreamer-4-project-page": "strong_artifact",
    "dreamer-3-nature-paper": "context_source",
    "openai-vpt-paper": "context_source",
    "unofficial-dreamer-4-pytorch": "context_source",
  },
  [SEEDS.gdmi.entry_id]: {
    "nhc-2025-hurricane-season-verification": "primary_evidence",
    "nhc-2025-verification-preview": "official_record",
    "deepmind-tropical-cyclone-prediction": "context_source",
    "deepmind-hurricane-melissa": "context_source",
    "melissa-discussion-13": "official_record",
    "melissa-discussion-18": "official_record",
    "melissa-discussion-22": "official_record",
    "melissa-landfall-update": "official_record",
    "ai-tropical-cyclone-operations-evaluation": "context_source",
    "skillful-joint-probabilistic-weather-forecasting": "context_source",
    "weather-network-ai-hurricane-model": "media_report",
  },
  [SEEDS.metr.entry_id]: {
    "metr-neurips-time-horizon-paper": "primary_evidence",
    "metr-time-horizon-analysis": "strong_artifact",
    "bridge-time-horizon-replication": "independent_replication",
    "metr-time-horizon-1-1": "primary_evidence",
    "metr-time-horizon-limitations": "context_source",
    "metr-modelling-assumptions": "context_source",
    "metr-original-time-horizon-post": "context_source",
  },
  [SEEDS.umass.entry_id]: {
    "fu-2025-nature-communications": "primary_evidence",
    "fu-2025-source-data": "strong_artifact",
    "fu-2025-transparent-peer-review": "context_source",
    "fu-2020-bio-voltage-memristors": "context_source",
    "sarkar-2022-organic-artificial-neuron": "context_source",
    "zhao-2025-diffusive-memristor-neuron": "context_source",
  },
} as const;

describe("canonical Stage 1 seed content", () => {
  let records: LoadedCanonicalRecords;
  let entries: Entry[];
  let trails: TopicTrail[];
  let snapshots: EntryPublicationSnapshot[];
  let release: ReleaseModel;

  beforeAll(async () => {
    records = await loadCanonicalRecords({ filesystem_root: process.cwd() });
    entries = records.entries.map(({ value }) => entrySchema.parse(value));
    trails = records.topic_trails.map(({ value }) => topicTrailSchema.parse(value));
    snapshots = records.entry_publication_snapshots.map(({ value }) =>
      entryPublicationSnapshotSchema.parse(value),
    );

    const result = constructReleaseModel({
      records,
      release_metadata: {
        release_id: "01900000-0000-7000-8000-000000000099",
        generated_at: "2026-07-24T20:30:00Z",
      },
      site_origin: SITE_ORIGIN,
      mode: "production",
    });

    expect(result).toMatchObject({ mode: "production", success: true, diagnostics: [] });
    if (result.mode !== "production") {
      throw new Error("Seed release construction returned an unexpected preview result.");
    }
    if (!result.success) {
      throw new Error(`Seed records failed production release validation: ${JSON.stringify(result.diagnostics)}`);
    }
    release = result.release;
  });

  test("loads the complete seed ledger without diagnostics", () => {
    expect(records.diagnostics).toEqual([]);
    expect(entries).toHaveLength(4);
    expect(trails).toHaveLength(4);
    expect(snapshots).toHaveLength(5);
    expect(records.methodologies).toHaveLength(1);
    expect(records.methodology_publication_events).toHaveLength(1);
  });

  test("locks persistent identities, slugs, relationships, dates, and review states", () => {
    for (const seed of Object.values(SEEDS)) {
      const entry = entries.find(({ id }) => id === seed.entry_id)!;
      expect(entry).toMatchObject({
        id: seed.entry_id,
        slug: seed.slug,
        aliases: seed.aliases,
        entry_state: "main_entry",
        primary_topic_trail_id: seed.trail_id,
        secondary_topic_trail_ids: [],
        methodology_id: METHODOLOGY_ID,
        next_check_date: null,
      });
    }

    expect(entries.find(({ id }) => id === SEEDS.dreamer.entry_id)).toMatchObject({
      date_last_checked: "2026-07-25",
      review_status: "stable",
      review_reason: null,
    });
    for (const id of [SEEDS.gdmi.entry_id, SEEDS.metr.entry_id]) {
      expect(entries.find((entry) => entry.id === id)).toMatchObject({
        date_last_checked: "2026-07-24",
        review_status: "stable",
        review_reason: null,
      });
    }
    expect(entries.find(({ id }) => id === SEEDS.umass.entry_id)).toMatchObject({
      date_last_checked: "2026-07-30",
      review_status: "stable",
      review_reason: null,
    });

    expect(trails.map(({ id, slug, aliases, name, description }) => ({ id, slug, aliases, name, description }))).toEqual([
      {
        id: SEEDS.metr.trail_id,
        slug: "ai-agents-in-software-engineering",
        aliases: [],
        name: "AI agents in software engineering",
        description:
          "Tracks the capability of AI agents to complete software-engineering tasks across increasing scope, duration, and autonomy.",
      },
      {
        id: SEEDS.gdmi.trail_id,
        slug: "ai-in-operational-weather-forecasting",
        aliases: [],
        name: "AI in operational weather forecasting",
        description:
          "Tracks the use and verified performance of AI systems inside real-world weather-forecasting workflows.",
      },
      {
        id: SEEDS.umass.trail_id,
        slug: "brain-inspired-hardware-biological-function",
        aliases: ["neuromorphic-hardware-biological-function"],
        name: "Brain-inspired hardware approaching biological function",
        description:
          "Tracks progress in hardware that reproduces or interoperates with biological neural signaling and information processing.",
      },
      {
        id: SEEDS.dreamer.trail_id,
        slug: "world-models-for-agent-training",
        aliases: [],
        name: "World models for agent training",
        description:
          "Tracks claims about using learned world models to train or improve agents through simulated or imagined experience.",
      },
    ]);
  });

  test("preserves approved source roles and source-check corrections", () => {
    for (const entry of entries) {
      expect(Object.fromEntries(entry.sources.map((source) => [source.citation_id, source.source_role]))).toEqual(
        EXPECTED_SOURCE_ROLES[entry.id as keyof typeof EXPECTED_SOURCE_ROLES],
      );
    }

    const metr = entries.find(({ id }) => id === SEEDS.metr.entry_id)!;
    const bridge = metr.sources.find(({ citation_id }) => citation_id === "bridge-time-horizon-replication")!;
    expect(bridge).toMatchObject({
      publisher_or_domain: "ICML 2026 / arXiv",
      evidence_types: ["peer_reviewed_paper", "independent_replication"],
      source_role: "independent_replication",
    });
    expect(bridge.evidence_types).not.toContain("preprint");
    expect(metr.details.what_happened).not.toContain(
      "METR evaluated 13 models released between 2019 and early 2025.",
    );
    expect(metr.details.what_happened).toContain(
      "In METR’s original March 2025 disclosure and version, Claude 3.7 Sonnet’s estimate was approximately 50 minutes",
    );
    expect(metr.details.what_happened).toContain(
      "The peer-reviewed NeurIPS 2025 version later evaluated agents based on 12 frontier models and reported o3 at roughly a 110-minute 50% horizon, while retaining the approximately seven-month long-run doubling trend.",
    );
    expect(metr.details.what_evidence_shows).toContain("A separate ICML 2026 paper, BRIDGE");
    expect(metr.details.what_evidence_shows).not.toContain("A separate 2026 preprint");
  });

  test("stores the approved significance text and immutable revision-1 snapshots", () => {
    expect(entries.find(({ id }) => id === SEEDS.gdmi.entry_id)?.potential_significance_if_confirmed).toBe(
      "If comparable performance is reproduced across additional seasons, basins, and operational centres, AI guidance could become a durable part of high-stakes tropical-cyclone forecasting for both track and intensity, giving human forecasters stronger probabilistic evidence earlier in a storm’s development. The 2025 result does not establish worldwide generalisation, consistently longer warning lead times, or reduced casualties.",
    );
    expect(entries.find(({ id }) => id === SEEDS.metr.entry_id)?.potential_significance_if_confirmed).toBe(
      "If the measured trend remains robust across broader, messier, and substantially longer workplace tasks, it would imply rapidly increasing ability for model-agent systems to complete meaningful software and research projects with limited intervention. The current evidence does not show that the same doubling rate generalises beyond METR-like task distributions, continues indefinitely, or directly translates into equivalent labour automation.",
    );

    for (const seed of Object.values(SEEDS)) {
      const snapshot = snapshots.find(({ entry_id }) => entry_id === seed.entry_id)!;
      const entry = entries.find(({ id }) => id === seed.entry_id)!;
      expect(snapshot).toMatchObject({
        revision_id: seed.revision_id,
        entry_id: seed.entry_id,
        revision_number: 1,
        published_at: seed === SEEDS.umass ? UMASS_PUBLISHED_AT : PUBLISHED_AT,
        methodology_id: METHODOLOGY_ID,
        methodology_public_version: "1.0.0",
        revision_category: "initial_publication",
        materiality: "material",
        update_summary: seed.update_summary,
      });
      if (seed.entry_id === SEEDS.dreamer.entry_id) {
        expect(snapshot.entry).toMatchObject({
          date_last_checked: "2026-07-24",
          review_status: "follow_up_needed",
          review_reason: expect.stringContaining("The work remains an arXiv v1 preprint"),
        });
      } else {
        expect(snapshot.entry).toEqual(entry);
      }
    }

    const dreamerCurrentSnapshot = snapshots.find(
      ({ revision_id }) => revision_id === SEEDS.dreamer.current_revision_id,
    )!;
    expect(dreamerCurrentSnapshot).toMatchObject({
      entry_id: SEEDS.dreamer.entry_id,
      revision_number: 2,
      published_at: DREAMER_REVIEW_PUBLISHED_AT,
      revision_category: "material_update",
      materiality: "material",
      update_summary: "Completed the evidence review and marked the Entry stable.",
      entry: entries.find(({ id }) => id === SEEDS.dreamer.entry_id),
    });
  });

  test("constructs the complete production release with URLs, relationships, and activity dates", () => {
    expect(release.current_entries).toHaveLength(4);
    expect(release.current_entries.map(({ entry }) => entry.id)).toEqual([
      SEEDS.umass.entry_id,
      SEEDS.dreamer.entry_id,
      SEEDS.gdmi.entry_id,
      SEEDS.metr.entry_id,
    ]);
    expect(release.topic_trails).toHaveLength(4);
    expect(release.topic_trails.every(({ entry_count }) => entry_count === 1)).toBe(true);

    for (const seed of Object.values(SEEDS)) {
      const entry = release.current_entries.find(({ entry }) => entry.id === seed.entry_id)!;
      expect(entry.canonical_url).toBe(`${SITE_ORIGIN}/entries/${seed.slug}/`);
      expect(entry.primary_topic_trail.id).toBe(seed.trail_id);
      expect(entry.secondary_topic_trails).toEqual([]);
      expect(entry.activity).toMatchObject({
        date_added: seed === SEEDS.umass ? "2026-07-30" : "2026-07-24",
        date_updated:
          seed === SEEDS.umass ? "2026-07-30" : seed === SEEDS.dreamer ? "2026-07-25" : "2026-07-24",
      });
    }

    for (const trail of release.topic_trails) {
      expect(trail.canonical_url).toBe(`${SITE_ORIGIN}/topic-trails/${trail.topic_trail.slug}/`);
    }
    expect(release.redirects).toEqual([
      {
        source: "/entries/google-deepmind-gdmi-hurricane-forecasting-2025/",
        destination: "/entries/google-deepmind-gdmi-leading-hurricane-guidance-2025/",
        status: 301,
        record_type: "entry",
        record_id: SEEDS.gdmi.entry_id,
      },
      {
        source: "/topic-trails/neuromorphic-hardware-biological-function/",
        destination: "/topic-trails/brain-inspired-hardware-biological-function/",
        status: 301,
        record_type: "topic_trail",
        record_id: SEEDS.umass.trail_id,
      },
    ]);
  });

  test("derives the four Added events, Dreamer update, and existing Methodology event", () => {
    const entryEvents = release.changelog_events.filter(({ type }) => type === "added");
    const updateEvents = release.changelog_events.filter(({ type }) => type === "updated");
    const methodologyEvents = release.changelog_events.filter(
      ({ type }) => type === "methodology_change",
    );

    expect(entryEvents).toHaveLength(4);
    expect(updateEvents).toEqual([
      expect.objectContaining({
        date: "2026-07-25",
        published_at: DREAMER_REVIEW_PUBLISHED_AT,
        source_identity: SEEDS.dreamer.current_revision_id,
        entry_id: SEEDS.dreamer.entry_id,
        summary: "Completed the evidence review and marked the Entry stable.",
      }),
    ]);
    expect(methodologyEvents).toHaveLength(1);
    expect(methodologyEvents[0]).toMatchObject({
      date: "2026-07-24",
      published_at: "2026-07-24T19:21:21.438Z",
      source_identity: "019f9593-391e-79d1-8f4a-3c88e68fc069",
    });
    expect(release.changelog_events).toHaveLength(6);
    expect(entryEvents.map(({ source_identity }) => source_identity).sort()).toEqual(
      Object.values(SEEDS).map(({ revision_id }) => revision_id).sort(),
    );
    expect(entryEvents.map(({ summary }) => summary).sort()).toEqual(
      Object.values(SEEDS).map(({ update_summary }) => update_summary).sort(),
    );
    expect(entryEvents.map(({ title }) => title).sort()).toEqual(entries.map(({ title }) => title).sort());
    for (const seed of Object.values(SEEDS)) {
      const event = entryEvents.find(({ source_identity }) => source_identity === seed.revision_id)!;
      expect(event).toMatchObject({
        type: "added",
        date: seed === SEEDS.umass ? "2026-07-30" : "2026-07-24",
        published_at: seed === SEEDS.umass ? UMASS_PUBLISHED_AT : PUBLISHED_AT,
      });
    }
    expect(release.current_entries.every(({ entry }) => entry.entry_state !== "removed")).toBe(true);
  });
});
