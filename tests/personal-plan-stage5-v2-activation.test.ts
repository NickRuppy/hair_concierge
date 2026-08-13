import assert from "node:assert/strict"
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
    "3205c72210d5b02ede7be59efe17205cd9dd3d0b5a3d883c430a21d5d47005d2",
  )
  assert.notEqual(
    stage5V2ArtifactFingerprint(`${artifactText}\n`),
    stage5V2ArtifactFingerprint(artifactText),
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
          guidance_payload_v2: { scope: { category: string } }
        }) => ({
          product_id: item.product_id,
          category: item.guidance_payload_v2.scope.category,
          role: item.source_role,
          guidance_payload_v2: item.guidance_payload_v2,
        }),
      ),
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.observed, { familyRows: 23, productRows: 273 })
})
