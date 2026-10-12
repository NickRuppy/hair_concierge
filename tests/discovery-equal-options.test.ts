import assert from "node:assert/strict"
import { UNKNOWN_SELECTION_PROFILE } from "../src/lib/personal-plan/products/authority/selection-profile"
import test from "node:test"

import { discoveryEqualOptions } from "../src/lib/discovery/equal-options"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import type { Stage3BondbuilderFacts } from "../src/lib/personal-plan/products/authority/contracts"
import type { PlanCategoryDecision } from "../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Equal-fit options (Nomi consult finish T1): a tied Bondbuilder shortlist resolves to the
 * house default (K18), and the cockpit must be able to offer the other equally ideal
 * products — from the same candidates, through the same authority, nothing invented.
 */

const K18 = "38dace91-0fba-49ee-a93f-ac36e488fe4b"
const role = "specialized_bond_treatment" as const

const result = computeNeedPlan({
  rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
  artifactId: "11111111-1111-4111-8111-111111111111",
  projection: "initial_quiz",
  computationVersion: "stage1-v1",
  createdAt: "2026-08-14T10:00:00.000Z",
})
if (result.status !== "ready") throw new Error("expected ready snapshot")

const decision = {
  category: "bondbuilder",
  resolution: "resolved",
  needTier: "basis",
  roles: [role],
  target: {
    category: "bondbuilder",
    roles: [role],
    requiredFunction: "support_stressed_hair_resilience",
    mechanismTarget: "mechanism_neutral",
  },
  frequency: null,
  reasons: [],
  executionState: "available",
  executionPauseReason: null,
  deferredFacts: [],
} satisfies PlanCategoryDecision

const snapshot = {
  ...result.snapshot,
  decisions: [decision],
  renderedOrder: ["bondbuilder" as const],
}

function candidate(
  productId: string,
  displayName: string,
  extra: Partial<Stage3BondbuilderFacts> & { priceEur?: number; currency?: string } = {},
): Stage3BondbuilderFacts {
  return {
    productId,
    displayName,
    category: "bondbuilder",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: `protocol-${productId}` }],
    presentationImageUrl: `https://example.com/${productId}.webp`,
    factFingerprint: `facts-${productId}`,
    spec: {
      applicationMode: "pre_shampoo",
      treatmentMode: "rinse_out",
      productFormat: "treatment",
      usageProtocol: "course",
      relationship: "standalone",
    },
    ...extra,
  } as Stage3BondbuilderFacts
}

const base = {
  category: "bondbuilder" as const,
  role,
  decision,
  snapshot,
  sourceNeedVersionId: "need-1",
  selectedProductId: K18,
  selectionProfile: UNKNOWN_SELECTION_PROFILE,
}

test("a tied shortlist lists every other equally ideal product, by name, never the default", () => {
  const options = discoveryEqualOptions({
    ...base,
    candidates: [
      candidate(K18, "K18 Leave-In Molecular Repair Hair Mask"),
      candidate("redken", "Redken Acidic Bonding Concentrate"),
      candidate("elvital", "Elvital Bond Repair Pre-Shampoo", { priceEur: 8.95, currency: "EUR" }),
    ],
  })
  assert.deepEqual(
    options.map((option) => option.productId),
    ["elvital", "redken"],
  )
  assert.equal(options[0]!.productName, "Elvital Bond Repair Pre-Shampoo")
  assert.equal(options[0]!.imageUrl, "https://example.com/elvital.webp")
  assert.match(options[0]!.priceLabel ?? "", /8,95/)
  // E2: the candidate's own application mode, in the catalog's German wording.
  assert.equal(options[0]!.applicationLabel, "Vorwäsche, ausspülen")
})

test("no tie, no options: a single ideal candidate stands alone", () => {
  assert.deepEqual(
    discoveryEqualOptions({
      ...base,
      candidates: [candidate(K18, "K18 Leave-In Molecular Repair Hair Mask")],
    }),
    [],
  )
})

test("only recommendable, active, verified products are offered", () => {
  const options = discoveryEqualOptions({
    ...base,
    candidates: [
      candidate(K18, "K18 Leave-In Molecular Repair Hair Mask"),
      candidate("ok", "Aveda Pre-Shampoo"),
      candidate("hidden", "Nicht empfohlen", { recommendable: false }),
      candidate("inactive", "Inaktiv", { isActive: false }),
      candidate("unverified", "Ohne Protokoll", { protocols: [] }),
    ],
  })
  assert.deepEqual(
    options.map((option) => option.productId),
    ["ok"],
  )
})

/* ------------------------------------------ S4 G1: options = the authority's tie set only */

function production(timing: "before_wash" | "after_wash" | "no_preference") {
  const row = (
    id: string,
    name: string,
    trust: "high" | "medium" | "low",
    applicationMode: string,
    priceEur: number,
  ) =>
    candidate(id, name, {
      catalogSortOrder: 0,
      priceEur,
      currency: "EUR",
      spec: {
        applicationMode,
        treatmentMode: applicationMode === "pre_shampoo" ? "rinse_out" : "leave_in",
        productFormat: "treatment",
        usageProtocol: "course",
        relationship: "standalone",
        claimTrustLevel: trust,
      },
    })
  return {
    ...base,
    selectionProfile: { ...UNKNOWN_SELECTION_PROFILE, bondbuilderTiming: timing },
    candidates: [
      row("olaplex", "OLAPLEX No.3PLUS", "high", "pre_shampoo", 34),
      row("epres", "Epres Bond Repair", "high", "pre_shampoo", 48),
      row(K18, "K18 Leave-In", "high", "post_wash_leave_in", 56.25),
      row("elvital", "Elvital Bond Repair", "medium", "pre_shampoo", 8.95),
      row("redken", "Redken Acidic Bonding", "medium", "pre_shampoo", 25.5),
      row("kerastase", "Kérastase Première", "medium", "pre_shampoo", 56.29),
      row("ogx", "OGX Sealing Serum", "low", "bedtime_leave_in", 18.68),
      row("aveda", "Aveda Botanical Repair", "low", "pre_shampoo", 52),
    ],
  }
}

test("S4 G1: options are the authority's tie set — OLAPLEX and Epres, never the lower trust levels", () => {
  assert.deepEqual(
    discoveryEqualOptions(production("no_preference")).map((option) => option.productId),
    ["epres", "olaplex"],
  )
})

test("S4: before the wash the pick is OLAPLEX and Epres is the one equal option", () => {
  assert.deepEqual(
    discoveryEqualOptions({ ...production("before_wash"), selectedProductId: "olaplex" }).map(
      (option) => option.productId,
    ),
    ["epres"],
  )
})

test("S4: after the wash there is no tie and no option", () => {
  assert.deepEqual(discoveryEqualOptions(production("after_wash")), [])
})

test("S4-03: a capped cockpit pick outside the tie set (Elvital) gets no equal options", () => {
  for (const timing of ["no_preference", "before_wash", "after_wash"] as const) {
    assert.deepEqual(
      discoveryEqualOptions({ ...production(timing), selectedProductId: "elvital" }),
      [],
      timing,
    )
  }
  // A budget pick that IS in the tie set (OLAPLEX under „Ist mir egal") still lists the others.
  assert.deepEqual(
    discoveryEqualOptions({ ...production("no_preference"), selectedProductId: "olaplex" }).map(
      (option) => option.productId,
    ),
    ["epres", K18],
  )
})
