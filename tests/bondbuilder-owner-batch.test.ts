import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import {
  buildBondbuilderOwnerBatch,
  writeBondbuilderOwnerBatch,
} from "../scripts/bondbuilder-research/build-owner-batch"
import {
  validateBondbuilderResearchProfile,
  projectBondbuilderForProduction,
  bondbuilderProfileSha256,
} from "../src/lib/bondbuilder-research/production-adapter"

const root = fileURLToPath(new URL("..", import.meta.url))
test("owner batch assembles exactly the eight real reviewed research products", () => {
  const batch = buildBondbuilderOwnerBatch(root)
  assert.deepEqual(
    batch.items.map((i) => i.research_key),
    ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"],
  )
  assert.deepEqual(
    batch.items.map((i) => i.envelope.profile.assessment.claim_trust_level),
    ["high", "high", "high", "medium", "medium", "low", "low", "medium"],
  )
  for (const item of batch.items) {
    assert.equal(
      validateBondbuilderResearchProfile(item.envelope.profile).success,
      true,
      item.research_key,
    )
    assert.equal(item.item_readiness.publish_ready, false)
    assert.equal(item.item_readiness.global_recommendation_ready, false)
    assert.equal(item.envelope.profile.identity.product_id, null)
    assert.deepEqual(
      Object.values(item.envelope.profile.fit).map((f) => f.value),
      [null, null, null],
    )
  }
  assert.equal(batch.new_classification_run, false)
  assert.equal(batch.method_locked, false)
})

test("exact local schedules and complete application facts remain distinct from complements and unsupported execution", () => {
  const batch = buildBondbuilderOwnerBatch(root)
  const profile = (id: string) => batch.items.find((i) => i.research_key === id)!.envelope.profile
  const p1 = profile("P01"),
    p2 = profile("P02"),
    p3 = profile("P03"),
    p5 = profile("P05"),
    p6 = profile("P06"),
    p7 = profile("P07"),
    p8 = profile("P08")
  assert.deepEqual(p1.application.cadence.value?.maintenance, {
    kind: "every_n_washes",
    minimum: 1,
    maximum: 3,
  })
  assert.deepEqual(p2.application.cadence.value?.initial, { kind: "consecutive_washes", count: 4 })
  assert.deepEqual(p2.application.cadence.value?.maintenance, {
    kind: "every_n_washes",
    minimum: 4,
    maximum: 4,
  })
  assert.deepEqual(p2.application.amount.value, {
    kind: "starting_dose",
    amount: { quantity: 1, unit: "pump" },
    add_as_needed: true,
  })
  assert.equal(p2.application.applied_format.value, null)
  assert.equal(p2.application.rinse.value?.standalone_treatment_rinse, false)
  assert.equal(p2.application.conditioner.value?.after, "optional")
  assert.equal(p2.application.conditioner.value?.minimum_wait_seconds, 240)
  assert.deepEqual(p3.application.dilution.value?.concentrate, { quantity: 1, unit: "vial" })
  assert.equal(p3.application.dilution.value?.finished_volume_ml, 150)
  assert.equal(p3.application.dilution.value?.mixed_use_by_days, null)
  assert.deepEqual(p3.application.timing.value, {
    kind: "minimum_seconds",
    minimum_seconds: 600,
    purpose: "contact",
  })
  assert.equal(p3.application.longer_wear.value?.overnight_allowed, true)
  for (const id of ["P04", "P05", "P08"]) assert.equal(profile(id).application.cadence.value, null)
  assert.match(p5.application.source_variants[0].differences, /2–3 times weekly/)
  assert.equal(p5.application.source_variants[0].selected, false)
  assert.equal(p6.application.placement.value, null)
  assert.equal(p6.application.applied_format.value, "serum")
  assert.equal(p6.application.market_applicability, "unresolved")
  assert.ok(p6.application.state_modifiers.value?.includes("at_bedtime"))
  assert.equal(
    p6.application.sequence.value?.some((s) => s.action === "shampoo"),
    false,
  )
  assert.equal(p7.application.cadence.value?.status, "source_stated_conditional")
  assert.equal(p7.application.cadence.value?.maintenance, null)
  assert.equal(p7.application.cadence.value?.branches.length, 2)
  assert.deepEqual(
    p8.application.sequence.value?.map((s) => s.action),
    ["apply_treatment", "wait", "layer_shampoo", "rinse", "apply_conditioner"],
  )
  assert.equal(p8.application.partners.value?.[0].exclusivity_established, false)
})

test("selected Redken formula resolves historical hold without erasing original conflicting raw research", () => {
  const batch = buildBondbuilderOwnerBatch(root)
  const redken = batch.items.find((i) => i.research_key === "P05")!.envelope.profile
  assert.equal(redken.formula.normalized_ingredients.length, 16)
  assert.deepEqual(redken.formula.source_ids, ["R09"])
  assert.deepEqual(redken.holds.identity, [])
  assert.equal(redken.formula.conflicts[0].resolved, true)
  assert.deepEqual(redken.formula.conflicts[0].source_ids, ["R02"])
  assert.ok(redken.formula.conflicts[0].raw_inci.includes("Y70018233/1"))
  assert.ok(batch.source_receipt.some((r) => r.source_file.endsWith("lane-a/records.json")))
  assert.ok(batch.source_receipt.some((r) => r.source_file.endsWith("lane-b/records.json")))
  const old = JSON.parse(
    readFileSync(
      path.join(
        root,
        "data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/evidence-packet.v0.3.json",
      ),
      "utf8",
    ),
  )
  assert.equal(
    old.products.find((p: { pilot_id: string }) => p.pilot_id === "P05").formula_status,
    "conflict_hold",
  )
})

test("creator leads never become endorsement sources and default submissions cannot copy owner grades", () => {
  const batch = buildBondbuilderOwnerBatch(root)
  const k18 = batch.items.find((i) => i.research_key === "P02")!.envelope.profile
  assert.equal(k18.sources.find((s) => s.id === "N09")?.access, "uninspected")
  assert.deepEqual(k18.evidence.practical.supporting_source_ids, [])
  assert.equal(k18.sources.find((s) => s.id === "E05")?.scope, "product")
  assert.equal(
    batch.items[0].envelope.profile.sources.find((s) => s.id === "E05")?.scope,
    "predecessor",
  )
  const forged = structuredClone(batch.items[0].envelope)
  forged.profile.identity.product_name = "Unreviewed new product"
  forged.profile.method.output_sha256 = forged.profile.review.profile_sha256 =
    bondbuilderProfileSha256(forged.profile)
  assert.match(projectBondbuilderForProduction(forged).errors.join(" "), /unverified_owner_grade/)
})

test("candidate catalogue preimages preserve existing approvals independently of new null fit and absent new rows", () => {
  const batch = buildBondbuilderOwnerBatch(root)
  assert.deepEqual(
    batch.items.slice(0, 3).map((i) => i.catalogue_candidate_id),
    [
      "3dc24d67-e6c0-4239-a273-058a87d13553",
      "38dace91-0fba-49ee-a93f-ac36e488fe4b",
      "f8a63590-9d80-454a-8008-e2a56321e64c",
    ],
  )
  for (const item of batch.items.slice(0, 3)) {
    assert.equal(item.catalogue_preimage?.is_chaarlie_recommended, true)
    assert.deepEqual(item.catalogue_preimage?.suitable_thicknesses, ["fine", "normal", "coarse"])
    assert.equal(item.catalogue_binding_verified, false)
  }
  for (const item of batch.items.slice(3)) {
    assert.equal(item.catalogue_candidate_id, null)
    assert.equal(item.protocol_projection.status, "hold")
  }
})

test("create-only batch copies original bytes and refuses replay into an existing directory", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "bondbuilder-owner-batch-"))
  try {
    const destination = path.join(temp, "batch")
    const batch = writeBondbuilderOwnerBatch(root, destination)
    for (const receipt of batch.source_receipt) {
      const original = readFileSync(path.join(root, receipt.source_file))
      const retained = readFileSync(path.join(destination, receipt.retained_file))
      assert.deepEqual(retained, original)
      assert.equal(createHash("sha256").update(retained).digest("hex"), receipt.sha256)
    }
    const before = readFileSync(path.join(destination, "P05.json"))
    assert.throws(() => writeBondbuilderOwnerBatch(root, destination), /EEXIST/)
    assert.deepEqual(readFileSync(path.join(destination, "P05.json")), before)

    // Corrupt a temporary copy of real research: the assembler must refuse, not trim observations.
    const rawRoot = path.join(destination, "raw")
    const packetFile = path.join(
      rawRoot,
      "data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/evidence-packet.v0.3.json",
    )
    const oversized = JSON.parse(readFileSync(packetFile, "utf8"))
    oversized.sources[0].facts = "A".repeat(1001)
    writeFileSync(packetFile, JSON.stringify(oversized))
    const refusedOutput = path.join(temp, "refused")
    assert.throws(() => writeBondbuilderOwnerBatch(rawRoot, refusedOutput), /1000/)
    assert.equal(existsSync(refusedOutput), false)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
