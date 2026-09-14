import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canonicalJson,
  isStage5V2ProductionWriteAuthorized,
  parseStage5V2ApplicationApplyArgs,
  stage5V2ArtifactFingerprint,
  verifyStage5V2AppliedArtifact,
} from "../src/lib/product-intake/catalog-enrichment/stage5-v2-application"

const artifactText = readFileSync(
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
  "utf8",
)
const artifact = JSON.parse(artifactText)

test("Stage 5 V2 activation fingerprints the exact artifact bytes", () => {
  assert.equal(
    canonicalJson({ z: true, Z: false, _meta: 1, a: 2 }),
    '{"Z":false,"_meta":1,"a":2,"z":true}',
  )
  assert.equal(
    stage5V2ArtifactFingerprint(artifactText),
    "7afa162b8575e07afc3f1c5b801ac66ffdcbebbecba1fa505ffb13bf3aad03a8",
  )
  assert.notEqual(
    stage5V2ArtifactFingerprint(`${artifactText}\n`),
    stage5V2ArtifactFingerprint(artifactText),
  )
})

test("post-baseline carry-forwards leave the frozen baseline and its pins byte-untouched", () => {
  // The 2026-08-12 baseline is a frozen review anchor: post-baseline rows are
  // layered on top of it (use-case delta, amendments, live carry-forwards), never
  // folded into it. Re-baselining is not a supported operation — it is not
  // byte-reproducible (shared templates have drifted since) and it silently
  // invalidates every manifest below, which would then have to be hand-edited.
  const baselineText = readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json",
    "utf8",
  )
  const baselineSha256 = createHash("sha256").update(baselineText).digest("hex")
  assert.equal(baselineSha256, "db2e7bbef4d5e64afa9adbbfe05acbb1c43fc5624f5baeecfe1ee85ec2fb3886")

  for (const path of [
    "data/catalog-enrichment/personal-plan-stage5-v2/leave-in-use-cases-2026-08-14.json",
    "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/S5-22-balea-urea-everyday-protocol.json",
    "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/S5-23-nivea-volumen-kraft-conditioner-protocol.json",
  ]) {
    assert.equal(
      JSON.parse(readFileSync(path, "utf8")).baseline.sha256,
      baselineSha256,
      `${path} no longer pins the frozen baseline`,
    )
  }

  // The Redken pre_heat_protection row arrives as a live carry-forward, so its
  // source_fingerprint must equal the authored S5-14 payload the protocol batch
  // writes — otherwise the V2 preflight fails with source_protocol_diverged.
  const redken = artifact.items.find(
    (item: { key: string }) =>
      item.key === "2b7db7e3-2058-4178-8a03-7d05f4a1d447:pre_heat_protection:pre_heat_damp",
  )
  assert.ok(redken, "Redken pre_heat_protection carry-forward entry is missing")
  assert.equal(
    redken.source_fingerprint,
    "8e1b1bbc51ce497047f75891d18bc5b87125dbe6a0b20b01a95f7b5f8fa7b8cb",
  )
  assert.equal(redken.guidance_payload_v2.runtimeBlockerCode, null)
  assert.equal(
    JSON.parse(
      readFileSync(
        "data/catalog-enrichment/personal-plan-stage5-v1/S5R-05-leave-in-calibration-protocol-carry-forward.json",
        "utf8",
      ),
    ).items.length,
    1,
  )
})

test("Stage 5 V2 activation is a dry-run unless every explicit production gate is present", () => {
  assert.deepEqual(parseStage5V2ApplicationApplyArgs([]), { apply: false })
  assert.throws(() => parseStage5V2ApplicationApplyArgs(["--apply"]), /confirm-project/)
  assert.deepEqual(
    parseStage5V2ApplicationApplyArgs([
      "--apply",
      "--confirm-project=pqdkhefxsxkyeqelqegq",
      "--reviewed-head=1111111111111111111111111111111111111111",
      "--expected-fingerprint=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]),
    {
      apply: true,
      reviewedHead: "1111111111111111111111111111111111111111",
      expectedFingerprint: "a".repeat(64),
    },
  )
})

test("Stage 5 V2 production writes require both the explicit gate and exact project host", () => {
  assert.equal(isStage5V2ProductionWriteAuthorized({}), false)
  assert.equal(
    isStage5V2ProductionWriteAuthorized({
      ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co",
    }),
    false,
  )
  assert.equal(
    isStage5V2ProductionWriteAuthorized({
      ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
    }),
    true,
  )
})

test("Stage 5 V2 executor migration is atomic, idempotent, and service-role only", () => {
  const source = readFileSync(
    "supabase/migrations/20260813060630_personal_plan_stage5_v2_artifact_executor.sql",
    "utf8",
  )

  assert.match(source, /apply_personal_plan_stage5_v2_artifact_v1\(text, text, text\)/)
  assert.match(source, /SECURITY DEFINER/)
  assert.match(source, /SET search_path = ''/)
  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /personal-plan-stage5-v2-2026-08-12/)
  assert.match(source, /personal_plan_stage5_v2_canonical_json_v1/)
  assert.match(source, /source protocol fingerprint diverged/)
  assert.match(source, /observed_counts,family_templates[\s\S]*IS DISTINCT FROM/)
  assert.match(source, /extensions\.digest\(/)
  assert.match(source, /guidance_payload_v2/)
  assert.match(source, /contract_version/)
  assert.match(source, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(source, /GRANT EXECUTE[\s\S]*TO service_role/)
})

test("Stage 5 V2 post-apply verification requires every exact family and product row", async () => {
  const result = await verifyStage5V2AppliedArtifact(artifact, {
    listV2Families: async () =>
      artifact.family_templates.map((payload: { guidanceKey: string }) => ({
        guidance_key: payload.guidanceKey,
        contract_version: 2,
        payload,
        status: "active",
      })),
    listV2Protocols: async () =>
      artifact.items.map(
        (item: {
          product_id: string
          source_role: string
          guidance_payload_v2: { scope: { category: string }; applicationFamily: string }
        }) => ({
          product_id: item.product_id,
          category: item.guidance_payload_v2.scope.category,
          role: item.source_role,
          application_family: item.guidance_payload_v2.applicationFamily,
          guidance_payload_v2: item.guidance_payload_v2,
        }),
      ),
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.observed, { familyRows: 28, productRows: 310 })
})
