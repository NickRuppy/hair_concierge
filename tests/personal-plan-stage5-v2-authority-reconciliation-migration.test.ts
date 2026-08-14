import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  canonicalJson,
  stage5V2SourceFingerprint,
} from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"

const artifactPath =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"
const migrationPath =
  "supabase/migrations/20260814191843_20260814122000_personal_plan_stage5_v2_authority_reconciliation.sql"
const preconditionsPath =
  "plans/evidence/2026-08-14-application-guidance-authority-live-preconditions.json"
const sourceRoot = "data/catalog-enrichment/personal-plan-stage5-v1/protocol-research"

const cohort = [
  [
    "215522e5-95a6-469f-bc34-1fa74b311a23",
    "conditioner",
    "conditioner_rinse_out",
    "standard_rinse_out_conditioning",
    "S5-12-conditioner-exact-01.json",
  ],
  [
    "38dace91-0fba-49ee-a93f-ac36e488fe4b",
    "bondbuilder",
    "specialized_bond_treatment",
    "post_shampoo_timed_leave_in",
    "S5-04-bondbuilder-primary-protocols.json",
  ],
  [
    "3dc24d67-e6c0-4239-a273-058a87d13553",
    "bondbuilder",
    "specialized_bond_treatment",
    "pre_shampoo_single_treatment",
    "S5-04-bondbuilder-primary-protocols.json",
  ],
  [
    "3f3542c0-e82b-4306-a9e0-85df313a78cf",
    "scalp_care",
    "density_claim_tonic",
    "leave_on_scalp_care",
    "S5-09-scalp-canonical-protocols.json",
  ],
  [
    "515de93c-1c77-465d-ae0d-2a8d6ddb3d73",
    "shampoo",
    "shampoo_everyday",
    "targeted_treatment_shampoo",
    "S5-10-shampoo-exact-01.json",
  ],
  [
    "58aa2f19-b23a-4e09-ab0f-68c359371c9e",
    "scalp_care",
    "density_claim_tonic",
    "leave_on_scalp_care",
    "S5-09-scalp-canonical-protocols.json",
  ],
  [
    "7373656d-5fd7-46e8-81a3-2ef29e3c4c18",
    "shampoo",
    "shampoo_everyday",
    "standard_rinse_out_cleanse",
    "S5-11-shampoo-exact-02.json",
  ],
  [
    "d0180955-c3a0-4f53-8744-fbeb2c241688",
    "conditioner",
    "conditioner_rinse_out",
    "standard_rinse_out_conditioning",
    "S5-13-conditioner-exact-02.json",
  ],
  [
    "f8a63590-9d80-454a-8008-e2a56321e64c",
    "bondbuilder",
    "specialized_bond_treatment",
    "pre_shampoo_single_treatment",
    "S5-04-bondbuilder-primary-protocols.json",
  ],
] as const

type GuidancePayload = {
  protocolFacts: Record<string, unknown>
  steps: Array<{ copyTemplateDe: string }>
}

function reconstructObservedPayload(
  productId: string,
  reviewedPayload: unknown,
  observedStepCopy?: string,
): GuidancePayload {
  const payload = structuredClone(reviewedPayload) as GuidancePayload
  if (
    productId === "215522e5-95a6-469f-bc34-1fa74b311a23" ||
    productId === "d0180955-c3a0-4f53-8744-fbeb2c241688"
  ) {
    delete payload.protocolFacts.sharedTemplateContactTime
  }
  if (productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b") {
    payload.protocolFacts.amount = null
    delete payload.protocolFacts.workflowId
    assert.ok(observedStepCopy)
    payload.steps[1]!.copyTemplateDe = observedStepCopy
  }
  if (
    [
      "3dc24d67-e6c0-4239-a273-058a87d13553",
      "515de93c-1c77-465d-ae0d-2a8d6ddb3d73",
      "f8a63590-9d80-454a-8008-e2a56321e64c",
    ].includes(productId)
  ) {
    delete payload.protocolFacts.workflowId
  }
  if (
    [
      "3f3542c0-e82b-4306-a9e0-85df313a78cf",
      "58aa2f19-b23a-4e09-ab0f-68c359371c9e",
      "7373656d-5fd7-46e8-81a3-2ef29e3c4c18",
    ].includes(productId)
  ) {
    delete payload.protocolFacts.cautionCodes
  }
  return payload
}

test("the nine reconciled V1 payloads exactly produce their reviewed artifact fingerprints", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"))
  const preconditions = JSON.parse(await readFile(preconditionsPath, "utf8"))
  const sql = await readFile(migrationPath, "utf8")
  const sourceCache = new Map<
    string,
    { products: Array<{ product_id: string; role: string; guidance_payload: unknown }> }
  >()

  for (const [productId, category, role, applicationFamily, sourceFile] of cohort) {
    let source = sourceCache.get(sourceFile)
    if (!source) {
      const loadedSource = JSON.parse(await readFile(`${sourceRoot}/${sourceFile}`, "utf8")) as {
        products: Array<{ product_id: string; role: string; guidance_payload: unknown }>
      }
      sourceCache.set(sourceFile, loadedSource)
      source = loadedSource
    }
    const protocol = source.products.find(
      (candidate) => candidate.product_id === productId && candidate.role === role,
    )
    const item = artifact.items.find(
      (candidate: {
        product_id: string
        source_role: string
        guidance_payload_v2: { scope: { category: string }; applicationFamily: string }
      }) =>
        candidate.product_id === productId &&
        candidate.source_role === role &&
        candidate.guidance_payload_v2.scope.category === category &&
        candidate.guidance_payload_v2.applicationFamily === applicationFamily,
    )

    assert.ok(protocol, `${productId}: reviewed source protocol`)
    assert.ok(item, `${productId}: reviewed V2 artifact item`)
    const observed = preconditions.product_protocols.find(
      (candidate: { product_id: string }) => candidate.product_id === productId,
    )
    assert.ok(observed, `${productId}: captured live precondition`)
    const reviewedFingerprint = stage5V2SourceFingerprint(role, protocol.guidance_payload)
    const observedFingerprint = stage5V2SourceFingerprint(
      role,
      reconstructObservedPayload(
        productId,
        protocol.guidance_payload,
        observed.observed_step_1_copy_de,
      ),
    )
    assert.equal(
      reviewedFingerprint,
      item.source_fingerprint,
      `${productId}: reviewed V1 source authority`,
    )
    assert.equal(observedFingerprint, observed.observed_source_fingerprint)
    assert.match(sql, new RegExp(observedFingerprint))
    assert.match(sql, new RegExp(reviewedFingerprint))
  }
})

test("the two family transitions derive from the captured live copy and reviewed artifact", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"))
  const preconditions = JSON.parse(await readFile(preconditionsPath, "utf8"))
  const sql = await readFile(migrationPath, "utf8")

  for (const observed of preconditions.family_templates) {
    const reviewed = artifact.family_templates.find(
      (candidate: { guidanceKey: string }) => candidate.guidanceKey === observed.guidance_key,
    )
    assert.ok(reviewed, observed.guidance_key)
    const oldPayload = structuredClone(reviewed) as GuidancePayload
    oldPayload.steps[0]!.copyTemplateDe = observed.observed_step_0_copy_de
    const oldFingerprint = createHash("sha256").update(canonicalJson(oldPayload)).digest("hex")
    const newFingerprint = createHash("sha256").update(canonicalJson(reviewed)).digest("hex")
    assert.equal(oldFingerprint, observed.observed_payload_fingerprint)
    assert.match(sql, new RegExp(oldFingerprint))
    assert.match(sql, new RegExp(newFingerprint))
    assert.match(
      sql,
      new RegExp(reviewed.steps[0].copyTemplateDe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )
  }
})

test("authority reconciliation is exact-cohort guarded and verifies every transition", async () => {
  const sql = await readFile(migrationPath, "utf8")

  for (const [productId, category, role, applicationFamily] of cohort) {
    assert.match(
      sql,
      new RegExp(`${productId}[^\\n]+${category}[^\\n]+${role}[^\\n]+${applicationFamily}`),
    )
  }
  assert.match(sql, /^BEGIN;/m)
  assert.match(sql, /COMMIT;\s*$/)
  assert.match(sql, /expected exactly 9 divergent V1 protocol rows/i)
  assert.match(sql, /reviewed V1 source fingerprint verification failed/i)
  assert.match(sql, /current family template authority drifted/i)
  assert.match(sql, /reviewed family template verification failed/i)
  assert.match(sql, /DISABLE TRIGGER application_guidance_protocols_active_immutable/i)
  assert.match(sql, /ENABLE TRIGGER application_guidance_protocols_active_immutable/i)
  assert.match(sql, /expected exactly one old Stage 5 V2 batch identity/i)
  assert.match(sql, /expected exactly one old Stage 5 V2 source-kind identity/i)
  assert.match(sql, /expected exactly one old Stage 5 V2 snapshot identity/i)
  assert.match(sql, /personal-plan-stage5-v2-2026-08-14-use-case-coverage/)
  assert.match(sql, /reviewed_stage5_v1_and_use_case_artifacts/)
  assert.match(sql, /expected exactly two new Stage 5 V2 snapshot identities/i)
  assert.match(sql, /installed Stage 5 V2 executor identity verification failed/i)
  assert.doesNotMatch(sql, /UPDATE public\.products/i)
  assert.doesNotMatch(
    sql,
    /UPDATE public\.product_(?:leave_in|oil|conditioner|shampoo|scalp_care)_specs/i,
  )
  assert.doesNotMatch(sql, /guidance_payload_v2\s*=/i)
  assert.doesNotMatch(sql, /PERSONAL_PLAN_STAGE5_USE_CASE_COVERAGE_ENABLED/)
})
