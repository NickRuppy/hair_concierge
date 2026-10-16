import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  assembleFreshOilResearchEnvelope,
  OilResearchEnvelopeSchema,
  sha256Utf8,
  type CurrentFreshOilResearchDraft,
} from "../src/lib/oil-research/contracts"
import { projectOilForProduction } from "../src/lib/oil-research/production-adapter"
import { OIL_INTAKE_METHOD } from "../src/lib/oil-research/registry"
import { createOilStorage, resolveOilStorage } from "../src/lib/oil-research/storage"
import { makeCurrentOilDraft } from "./fixtures/oil-research/current"
import { makeOilEnvelope } from "./fixtures/oil-research/fixture"

test("current lean intake admits eleven evidenced values without removed properties and projects only three canonical facts", () => {
  const draft = makeCurrentOilDraft()
  draft.profile.supplementary_research = {
    future_question: { observation: "Retained optional evidence", source_id: "maker" },
  }
  const envelope = assembleFreshOilResearchEnvelope(draft)
  assert.deepEqual(envelope.profile.supplementary_research, {
    future_question: { observation: "Retained optional evidence", source_id: "maker" },
  })
  assert.deepEqual(envelope.research_method, OIL_INTAKE_METHOD)
  for (const removed of ["named_oils", "dispenser", "penetration_potential", "fit"])
    assert.equal(removed in envelope.profile, false)
  assert.equal("scenario_fit" in envelope, false)
  assert.equal("confidence" in envelope.profile.weight, false)
  const result = projectOilForProduction(envelope)
  assert.equal(result.status, "property_projection_ready")
  if (result.status !== "property_projection_ready") return
  assert.deepEqual(result.category_specs, {
    product_oil_specs: {
      weight: "light",
      role_support: ["dry_finish"],
      provides_heat_protection: false,
    },
  })
  assert.equal(result.publish_ready, false)
  assert.equal(result.catalog_ready, false)
  assert.ok(result.manual_review_required.includes("product_oil_eligibility"))
  assert.deepEqual(
    resolveOilStorage(createOilStorage(envelope), { requireCurrent: true }),
    envelope,
  )
})

test("current admission refuses missing evidence, uncommitted values and incoherent source or formula identities", () => {
  const cases: Array<[string, (draft: CurrentFreshOilResearchDraft) => void]> = [
    [
      "weight unknown",
      (d) => {
        ;(d.profile.weight as { value: string }).value = "unknown"
      },
    ],
    [
      "base unknown",
      (d) => {
        ;(d.profile.base as { value: string }).value = "unknown"
      },
    ],
    [
      "unreviewed boolean",
      (d) => {
        d.profile.ingredient_flags.fragrance.evidence = []
      },
    ],
    [
      "wrong source",
      (d) => {
        d.profile.provides_heat_protection.evidence = [{ source_id: "missing" }]
      },
    ],
    [
      "wrong rank",
      (d) => {
        d.profile.weight.evidence = [{ rank: 99 }]
      },
    ],
    [
      "missing ingredient",
      (d) => {
        d.formula.raw_inci += " PARFUM"
      },
    ],
    [
      "different identity",
      (d) => {
        d.identity.brand = "Different"
      },
    ],
    [
      "legacy source method",
      (d) => {
        d.provenance.original_method.declared_version = "v0.8"
      },
    ],
    [
      "unrepresented role",
      (d) => {
        d.profile.supported_uses.push("scalp_application")
      },
    ],
    [
      "no retained trace context",
      (d) => {
        d.persistence_trace.context.direction_id = "missing"
      },
    ],
  ]
  for (const [name, mutate] of cases) {
    const draft = makeCurrentOilDraft()
    mutate(draft)
    assert.throws(() => assembleFreshOilResearchEnvelope(draft), name)
  }
})

test("new method pins match their policy bytes and legacy evidence cannot be relabeled current", () => {
  for (const [path, digest] of Object.entries(OIL_INTAKE_METHOD.policy_pins))
    assert.equal(sha256Utf8(readFileSync(path, "utf8")), digest, path)
  const current = assembleFreshOilResearchEnvelope(makeCurrentOilDraft())
  const tampered = structuredClone(current)
  tampered.research_method.policy_pins = {
    ...tampered.research_method.policy_pins,
    extra: "0".repeat(64),
  }
  assert.equal(OilResearchEnvelopeSchema.safeParse(tampered).success, false)
  const legacy = makeOilEnvelope()
  const legacyStorage = createOilStorage(legacy)
  assert.deepEqual(resolveOilStorage(legacyStorage), legacy)
  assert.throws(
    () => resolveOilStorage(legacyStorage, { requireCurrent: true }),
    /current intake-bound/,
  )
  assert.equal(
    OilResearchEnvelopeSchema.safeParse({ ...legacy, research_method: OIL_INTAKE_METHOD }).success,
    false,
  )
  assert.equal(
    OilResearchEnvelopeSchema.safeParse({ ...current, research_method: legacy.research_method })
      .success,
    false,
  )
})
