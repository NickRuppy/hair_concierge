import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildStage5ProtocolAmendmentManifest,
  isStage5DispositionResolutionProductionWriteAuthorized,
  parseStage5DispositionResolutionApplyArgs,
  preflightStage5DispositionResolution,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocol-amendments"
import { loadStage5ProtocolBatch } from "../scripts/product-intake/catalog-enrichment/stage5-protocol-preflight"

const PRODUCT_ID = "b000d235-1fc6-434c-9ba1-f1207d36cded"
const BATCH_ID = "S5-22-balea-urea-everyday-protocol"
const AMENDMENT_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/S5-22-balea-urea-everyday-protocol.json"
const BASELINE_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json"
const ARTIFACT_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"
const MIGRATION_PATH =
  "supabase/migrations/20260901140744_20260901133000_personal_plan_product_disposition_resolution.sql"

const amendmentInput = JSON.parse(readFileSync(AMENDMENT_PATH, "utf8"))
const baselineText = readFileSync(BASELINE_PATH, "utf8")
const built = buildStage5ProtocolAmendmentManifest(amendmentInput, baselineText)
const item = built.manifest.items[0]!
const pointer = built.v2Inserts[0]!.guidance_payload_v2
const CONDITIONER_ID = "00000000-0000-4000-8000-000000000023"

const conditionerInput = {
  schema_version: "personal-plan-stage5-protocol-amendments-v1",
  batch_id: "S5-23-conditioner-protocol-amendment",
  category_key: "conditioner",
  snapshot_date: "2026-09-01",
  baseline: amendmentInput.baseline,
  review: { state: "approved_by_nick", reviewed_by: "nick" },
  items: [
    {
      product_id: CONDITIONER_ID,
      product_name: "Verified rinse-out Conditioner",
      category_key: "conditioner",
      role: "conditioner_rinse_out",
      expected_category_facts: {},
      expected_disposition: {
        disposition: "awaiting_exact_analysis",
        reason_code: "insufficient_executable_directions",
        reason: "Exact directions were previously missing.",
        sources: [
          {
            label: "Previous exact source review",
            url: "https://example.com/conditioner",
            text: "The previous review lacked executable directions.",
            source_type: "manufacturer",
            checked_at: "2026-08-11",
          },
        ],
        source_batch: "S5-21-product-search-dispositions",
        source_fingerprint: "a".repeat(64),
        reviewed_by: "nick",
      },
      sources: [
        {
          label: "Exact Conditioner directions",
          url: "https://example.com/conditioner",
          text: "Apply to damp lengths while avoiding roots, leave for 2–3 minutes, and rinse thoroughly with lukewarm water.",
          source_type: "manufacturer",
          checked_at: "2026-09-01",
        },
      ],
      cadence: null,
      guidance_payload: {
        schemaVersion: 1,
        guidanceKey: `product-conditioner-${CONDITIONER_ID}`,
        protocolVersion: 1,
        locale: "de",
        scope: {
          kind: "product",
          category: "conditioner",
          productId: CONDITIONER_ID,
        },
        role: "condition",
        applicationFamily: "standard_rinse_out_conditioning",
        compatibleDayTypes: ["wash_day"],
        exactGuidanceRequired: true,
        sequence: {
          anchor: "post_cleanse_rinse_off",
          before: [],
          after: ["wet_cleanse"],
          conflictsWith: [],
        },
        requirements: {
          requiredCatalogFacts: [],
          requiredProtocolFacts: [],
          requiredProfileFacts: [],
        },
        protocolFacts: {
          applicationArea: "lengths_ends",
          rinse: "rinse_out",
          contactTimeSeconds: null,
          sharedTemplateContactTime: "include",
          conditionerRelationship: "not_applicable",
          reapplication: "none",
          amount: null,
          cautions: [],
        },
        steps: [
          {
            stepKey: "apply-conditioner",
            action: "apply_product",
            copyTemplateDe:
              "Ins feuchte Haar geben, nur in Längen und Spitzen verteilen und den Ansatz aussparen.",
          },
          {
            stepKey: "wait-conditioner",
            action: "wait",
            copyTemplateDe: "2–3 Minuten einwirken lassen.",
          },
          {
            stepKey: "rinse-conditioner",
            action: "rinse",
            copyTemplateDe: "Gründlich mit lauwarmem Wasser ausspülen.",
          },
        ],
        evidence: [
          {
            sourceUrl: "https://example.com/conditioner",
            sourceType: "manufacturer",
            checkedAt: "2026-09-01",
          },
        ],
      },
    },
  ],
}

function completeReads(
  overrides: {
    shampooBuckets?: string[]
    guidancePayload?: unknown
    guidancePayloadV2?: unknown
    disposition?: Record<string, unknown> | null
    ledgers?: Array<Record<string, unknown>>
  } = {},
) {
  return {
    listProducts: async () => [
      {
        id: PRODUCT_ID,
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: overrides.shampooBuckets ?? ["trocken"],
      },
    ],
    listProtocols: async () => [
      {
        product_id: PRODUCT_ID,
        category: "shampoo",
        role: "shampoo_everyday",
        application_family: "standard_rinse_out_cleanse",
        source_url: item.sources[0]!.url,
        guidance_payload: overrides.guidancePayload ?? item.guidance_payload,
        guidance_payload_v2: overrides.guidancePayloadV2 ?? pointer,
      },
    ],
    listDispositions: async () =>
      overrides.disposition === null
        ? []
        : [
            overrides.disposition ?? {
              product_id: PRODUCT_ID,
              ...item.expected_disposition,
            },
          ],
    listAppliedItems: async () => overrides.ledgers ?? [],
  }
}

test("Balea amendment reuses one source-backed V1 payload and one derived V2 pointer", async () => {
  assert.equal(built.manifest.batch_id, BATCH_ID)
  assert.equal(built.manifest.review.state, "approved_by_nick")
  assert.equal(built.protocolApplyBatch.batch.protocols.length, 1)
  assert.equal(built.protocolApplyBatch.batch.protocols[0]!.role, "shampoo_everyday")
  assert.equal(built.protocolApplyBatch.batch.protocols[0]!.cadence, null)
  assert.equal(built.v2Inserts.length, 1)

  assert.deepEqual(pointer.facts, {
    applicationState: "wet_hair",
    applicationArea: "scalp_roots",
    rinse: "rinse_out",
    contactTime: null,
    amount: null,
    heat: null,
    conditionerPolicy: "not_applicable",
  })
  assert.equal(pointer.runtimeBlockerCode, null)
  assert.equal(pointer.applicationFamily, "standard_rinse_out_cleanse")
  assert.deepEqual(pointer.evidence.map(({ sourceType }) => sourceType).sort(), [
    "professional_authority",
    "professional_authority",
    "retailer",
  ])

  const allCopy = item.guidance_payload.steps.map(({ copyTemplateDe }) => copyTemplateDe).join(" ")
  assert.match(allCopy, /anfeuchten/i)
  assert.match(allCopy, /kopfhaut/i)
  assert.match(allCopy, /sanft einmassieren/i)
  assert.match(allCopy, /gründlich ausspülen/i)
  assert.doesNotMatch(allCopy, /täglich|jeden tag|einwirken|wiederholen/i)
  assert.equal(
    item.guidance_payload.steps.some(({ action }) => action === "wait"),
    false,
  )
  assert.equal(item.guidance_payload.protocolFacts.contactTimeSeconds, null)
})

test("the existing Stage 5 V1 loader accepts the post-baseline amendment batch", async () => {
  const loaded = await loadStage5ProtocolBatch(BATCH_ID)

  assert.equal(loaded.fingerprint, built.protocolApplyBatch.fingerprint)
  assert.deepEqual(loaded.batch, built.protocolApplyBatch.batch)
})

test("the amendment and disposition contract accepts a separate rinse-out Conditioner", async () => {
  const conditioner = buildStage5ProtocolAmendmentManifest(conditionerInput, baselineText)
  const conditionerItem = conditioner.manifest.items[0]!
  const conditionerPointer = conditioner.v2Inserts[0]!.guidance_payload_v2

  assert.equal(conditioner.protocolApplyBatch.batch.protocols[0]!.category_key, "conditioner")
  assert.equal(conditioner.protocolApplyBatch.batch.protocols[0]!.role, "conditioner_rinse_out")
  assert.equal(conditionerPointer.applicationFamily, "standard_rinse_out_conditioning")
  assert.deepEqual(conditionerPointer.facts.contactTime, {
    kind: "range_seconds",
    minimumSeconds: 120,
    maximumSeconds: 180,
  })

  const ready = await preflightStage5DispositionResolution(conditioner, {
    listProducts: async () => [
      {
        id: CONDITIONER_ID,
        category_key: "conditioner",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: [],
      },
    ],
    listProtocols: async () => [
      {
        product_id: CONDITIONER_ID,
        category: "conditioner",
        role: "conditioner_rinse_out",
        application_family: "standard_rinse_out_conditioning",
        source_url: conditionerItem.sources[0]!.url,
        guidance_payload: conditionerItem.guidance_payload,
        guidance_payload_v2: conditionerPointer,
      },
    ],
    listDispositions: async () => [
      { product_id: CONDITIONER_ID, ...conditionerItem.expected_disposition },
    ],
    listAppliedItems: async () => [],
  })
  assert.equal(ready.ok, true)
  assert.equal(ready.releaseCount, 1)
})

test("the Stage 5 protocol loader rejects an unknown batch without amendment fallthrough", async () => {
  await assert.rejects(
    loadStage5ProtocolBatch("S5-99-not-present"),
    /Stage 5 protocol batch not found: S5-99-not-present/,
  )
})

test("the generated V2 artifact includes Balea without changing the frozen V1 research row", () => {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"))
  const baleaItems = artifact.items.filter(
    (candidate: { product_id: string }) => candidate.product_id === PRODUCT_ID,
  )
  assert.equal(artifact.observed_counts.rows, 308)
  assert.equal(baleaItems.length, 1)
  assert.equal(baleaItems[0].source_role, "shampoo_everyday")
  assert.deepEqual(baleaItems[0].guidance_payload_v2, pointer)
  assert.ok(artifact.source_files.some(({ path }: { path: string }) => path === AMENDMENT_PATH))

  const frozenResearch = readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v1/protocol-research/S5-11-shampoo-exact-02.json",
    "utf8",
  )
  const frozenRow = JSON.parse(frozenResearch).products.find(
    (candidate: { product_id: string }) => candidate.product_id === PRODUCT_ID,
  )
  assert.equal(frozenRow.research_status, "blocked_missing_direction")
  assert.equal(frozenRow.guidance_payload, null)
})

test("disposition resolution requires the exact applicable and complete V1/V2 protocol", async () => {
  const ready = await preflightStage5DispositionResolution(built, completeReads())
  assert.equal(ready.ok, true)
  assert.equal(ready.releaseCount, 1)
  assert.deepEqual(ready.blockers, [])

  const wrongBucket = await preflightStage5DispositionResolution(
    built,
    completeReads({ shampooBuckets: ["schuppen"] }),
  )
  assert.deepEqual(wrongBucket.blockers, [
    `protocol_role_not_supported:${PRODUCT_ID}:shampoo_everyday`,
  ])

  const badV1 = await preflightStage5DispositionResolution(
    built,
    completeReads({ guidancePayload: { changed: true } }),
  )
  assert.deepEqual(badV1.blockers, [`protocol_v1_diverged:${PRODUCT_ID}:shampoo_everyday`])

  const badV2 = await preflightStage5DispositionResolution(
    built,
    completeReads({ guidancePayloadV2: { changed: true } }),
  )
  assert.deepEqual(badV2.blockers, [`protocol_v2_diverged:${PRODUCT_ID}:shampoo_everyday`])

  const wrongDisposition = await preflightStage5DispositionResolution(
    built,
    completeReads({
      disposition: {
        product_id: PRODUCT_ID,
        ...item.expected_disposition,
        source_fingerprint: "a".repeat(64),
      },
    }),
  )
  assert.deepEqual(wrongDisposition.blockers, [`disposition_conflict:${PRODUCT_ID}`])

  const conflictingReceipt = await preflightStage5DispositionResolution(
    built,
    completeReads({
      ledgers: [
        {
          batch_id: BATCH_ID,
          product_key: `disposition-resolution:${PRODUCT_ID}`,
          batch_fingerprint: built.resolutionBatch.fingerprint,
          content_fingerprint: built.resolutionBatch.items[0]!.content_fingerprint,
          product_id: PRODUCT_ID,
          reviewed_by: "nick",
        },
      ],
    }),
  )
  assert.deepEqual(conflictingReceipt.blockers, [
    `resolution_receipt_conflicts_with_disposition:${PRODUCT_ID}`,
  ])
})

test("a byte-identical resolution retry requires the existing shared ledger receipt", async () => {
  const missingDisposition = await preflightStage5DispositionResolution(
    built,
    completeReads({ disposition: null }),
  )
  assert.deepEqual(missingDisposition.blockers, [
    `disposition_missing_without_receipt:${PRODUCT_ID}`,
  ])

  const retry = await preflightStage5DispositionResolution(
    built,
    completeReads({
      disposition: null,
      ledgers: [
        {
          batch_id: BATCH_ID,
          product_key: `disposition-resolution:${PRODUCT_ID}`,
          batch_fingerprint: built.resolutionBatch.fingerprint,
          content_fingerprint: built.resolutionBatch.items[0]!.content_fingerprint,
          product_id: PRODUCT_ID,
          reviewed_by: "nick",
        },
      ],
    }),
  )
  assert.equal(retry.ok, true)
  assert.equal(retry.alreadyResolvedCount, 1)
})

test("disposition resolution apply is dry-run by default and fully production gated", () => {
  assert.throws(() => parseStage5DispositionResolutionApplyArgs([]), /valid_batch_id_is_required/)
  assert.deepEqual(parseStage5DispositionResolutionApplyArgs([`--batch=${BATCH_ID}`]), {
    apply: false,
    batchId: BATCH_ID,
  })
  assert.throws(
    () => parseStage5DispositionResolutionApplyArgs(["--apply", `--batch=${BATCH_ID}`]),
    /confirm-project=pqdkhefxsxkyeqelqegq/,
  )
  assert.deepEqual(
    parseStage5DispositionResolutionApplyArgs([
      "--apply",
      `--batch=${BATCH_ID}`,
      "--confirm-project=pqdkhefxsxkyeqelqegq",
      `--reviewed-head=${"1".repeat(40)}`,
      `--expected-fingerprint=${"a".repeat(64)}`,
    ]),
    {
      apply: true,
      batchId: BATCH_ID,
      reviewedHead: "1".repeat(40),
      expectedFingerprint: "a".repeat(64),
    },
  )

  assert.equal(isStage5DispositionResolutionProductionWriteAuthorized({}), false)
  assert.equal(
    isStage5DispositionResolutionProductionWriteAuthorized({
      ALLOW_PERSONAL_PLAN_DISPOSITION_RESOLUTION_PRODUCTION_WRITE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co",
    }),
    false,
  )
  assert.equal(
    isStage5DispositionResolutionProductionWriteAuthorized({
      ALLOW_PERSONAL_PLAN_DISPOSITION_RESOLUTION_PRODUCTION_WRITE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
    }),
    true,
  )
})

test("the resolution RPC is service-role only and deletes only after exact V1/V2 verification", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /apply_personal_plan_product_disposition_resolutions_v1\(text, text, text\)/i)
  assert.match(sql, /SECURITY DEFINER/i)
  assert.match(sql, /SET search_path = ''/i)
  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /FROM public\.products[\s\S]*FOR SHARE/i)
  assert.match(sql, /FROM public\.product_application_protocols[\s\S]*FOR SHARE/i)
  assert.match(sql, /FROM public\.personal_plan_product_search_dispositions[\s\S]*FOR UPDATE/i)
  assert.match(sql, /catalog_enrichment_applied_items/i)
  assert.match(sql, /guidance_payload IS DISTINCT FROM/i)
  assert.match(sql, /guidance_payload_v2 IS DISTINCT FROM/i)
  assert.match(sql, /source_fingerprint IS DISTINCT FROM/i)
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/i)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/i)

  const v1Check = sql.indexOf("guidance_payload IS DISTINCT FROM")
  const v2Check = sql.indexOf("guidance_payload_v2 IS DISTINCT FROM")
  const deletion = sql.indexOf("DELETE FROM public.personal_plan_product_search_dispositions")
  assert.ok(v1Check >= 0 && v1Check < deletion)
  assert.ok(v2Check >= 0 && v2Check < deletion)
})
