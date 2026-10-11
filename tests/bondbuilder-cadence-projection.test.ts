import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  projectBondbuilderCadence,
  projectBondbuilderDamageBranchedCadence,
  type BondbuilderDamageCadenceBinding,
} from "../src/lib/bondbuilder-research/cadence-projection"
import type { BondbuilderResearchProfile } from "../src/lib/bondbuilder-research/contracts"
import { sealProfile } from "./fixtures/bondbuilder-research/profile"

const AVEDA = JSON.parse(
  readFileSync(
    "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P07.json",
    "utf8",
  ),
) as { profile: BondbuilderResearchProfile }
const BINDING = JSON.parse(
  readFileSync(
    "data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json",
    "utf8",
  ),
) as BondbuilderDamageCadenceBinding

const profile = () => structuredClone(AVEDA.profile)
const binding = () => structuredClone(BINDING)

/** Mutate a copy of the frozen profile, reseal it and re-pin the binding to the new digest. */
function refusedAfter(
  mutate: (profile: BondbuilderResearchProfile, binding: BondbuilderDamageCadenceBinding) => void,
) {
  const p = profile()
  const b = binding()
  mutate(p, b)
  sealProfile(p)
  b.profile_sha256 = p.review.profile_sha256
  return projectBondbuilderDamageBranchedCadence(p, b)
}

test("Aveda profile + D-b binding → the exact damage-branched cadence", () => {
  assert.deepEqual(projectBondbuilderDamageBranchedCadence(profile(), binding()), {
    status: "ok",
    cadence: {
      kind: "damage_branched",
      branches: [
        {
          structural_levels: ["moderate"],
          copy_de: "Einmal pro Woche anwenden.",
          maintenance: { kind: "times_per_week", minimum: 1, maximum: 1 },
          source_ids: ["C03-P07-1"],
        },
        {
          structural_levels: ["high", "severe"],
          copy_de: "An jedem Waschtag anwenden.",
          maintenance: { kind: "every_n_washes", minimum: 1, maximum: 1 },
          source_ids: ["C03-P07-1"],
        },
      ],
      source_ids: ["C03-P07-1"],
      binding_ruling: "decisions.md B1/D-b (Nick, 2026-10-09)",
    },
  })
})

test("the label projector still invents nothing for conditional branches", () => {
  assert.equal(projectBondbuilderCadence(profile()), null)
})

test("refuses a binding pinned to another profile or product", () => {
  const otherDigest = binding()
  otherDigest.profile_sha256 = "0".repeat(64)
  assert.deepEqual(projectBondbuilderDamageBranchedCadence(profile(), otherDigest), {
    status: "refused",
    reason: "profile_digest_mismatch",
  })
  const otherProduct = binding()
  otherProduct.product_id = "2c809d0d-fbce-435a-bbde-aa4270aaf48d"
  assert.deepEqual(projectBondbuilderDamageBranchedCadence(profile(), otherProduct), {
    status: "refused",
    reason: "product_mismatch",
  })
})

test("refuses overlap, empty or unknown levels, blank copy and condition mismatches", () => {
  const cases: Array<[string, (b: BondbuilderDamageCadenceBinding) => void]> = [
    ["levels_overlap", (b) => (b.branches[1]!.structural_levels = ["moderate", "high"])],
    ["levels_empty", (b) => (b.branches[0]!.structural_levels = [])],
    ["level_unknown", (b) => (b.branches[0]!.structural_levels = ["medium" as never])],
    ["copy_blank", (b) => (b.branches[1]!.copy_de = "  ")],
    ["condition_mismatch", (b) => (b.branches[0]!.condition = "Light damage")],
    ["condition_mismatch", (b) => b.branches.pop()],
  ]
  for (const [reason, mutate] of cases) {
    const b = binding()
    mutate(b)
    assert.deepEqual(
      projectBondbuilderDamageBranchedCadence(profile(), b),
      { status: "refused", reason },
      reason,
    )
  }
})

test("refuses a low-confidence, unresolved-market or out-of-directions cadence", () => {
  assert.deepEqual(
    refusedAfter((p) => (p.application.cadence.confidence = "low")),
    { status: "refused", reason: "confidence_low" },
  )
  assert.deepEqual(
    refusedAfter((p) => (p.application.market_applicability = "unresolved")),
    { status: "refused", reason: "market_unresolved" },
  )
  assert.deepEqual(
    refusedAfter((p) => {
      p.application.cadence.value!.branches[0]!.source_ids = ["E01"]
    }),
    { status: "refused", reason: "source_outside_directions" },
  )
  assert.deepEqual(
    refusedAfter((p) => {
      p.application.cadence.value!.status = "source_stated"
    }),
    { status: "refused", reason: "not_conditional" },
  )
})
