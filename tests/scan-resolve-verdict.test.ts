import assert from "node:assert/strict"
import test from "node:test"

import type { Stage3CategoryProductFacts } from "../src/lib/personal-plan/products/authority/contracts"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import type {
  PlanCategoryDecision,
  PlanPortfolioCoverageFact,
  PlanProductRole,
} from "../src/lib/personal-plan/types"
import { buildScanVerdict, type BuildScanVerdictInput } from "../src/lib/scan/resolve-verdict"

/* ------------------------------------------------------------------ fixtures */

type FactOverrides = {
  displayName?: string
  weight?: string | null
  balanceDirection?: string | null
  careDirection?: string | null
  repairSupportLevel?: string | null
  suitableThicknesses?: string[] | null
  providesHeatProtection?: boolean | null
  recommendable?: boolean
  sortOrder?: number | null
  shampooBucket?: string | null
  scalpRoute?: string | null
  cleansingIntensity?: string | null
}

function commonFacts(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  productId: string,
  overrides: FactOverrides,
) {
  return {
    productId,
    displayName: overrides.displayName ?? productId,
    presentationImageUrl: `https://example.com/${productId}.jpg`,
    category,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: overrides.recommendable ?? true,
    suitableThicknesses: overrides.suitableThicknesses ?? ["fine", "normal"],
    knownReaction: false,
    protocols: [
      { role, status: "verified_complete" as const, fingerprint: `protocol-${productId}` },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: overrides.sortOrder ?? null,
    priceEur: 9,
    priceCheckedAt: new Date().toISOString(),
    purchaseLinkStatus: "available" as const,
    netContentValue: 200,
    netContentUnit: "ml" as const,
  }
}

function factsFor(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  productId: string,
  overrides: FactOverrides = {},
): Stage3CategoryProductFacts {
  const common = commonFacts(category, role, productId, overrides)
  switch (category) {
    case "shampoo":
      return {
        ...common,
        category: "shampoo",
        spec: {
          thickness: "normal",
          shampooBucket: overrides.shampooBucket ?? "normal",
          scalpRoute: overrides.scalpRoute ?? "balanced",
          cleansingIntensity: overrides.cleansingIntensity ?? "regular",
          targetFit: "matched",
        },
      } as Stage3CategoryProductFacts
    case "conditioner":
      return {
        ...common,
        category: "conditioner",
        spec: {
          thickness: "normal",
          proteinMoistureBalance: overrides.careDirection ?? "moisture",
          weight: overrides.weight === undefined ? "light" : overrides.weight,
          repairSupportLevel: overrides.repairSupportLevel ?? "medium",
          balanceDirection:
            overrides.balanceDirection === undefined ? "moisture" : overrides.balanceDirection,
          targetFit: "matched",
        },
      } as Stage3CategoryProductFacts
    case "leave_in":
      return {
        ...common,
        category: "leave_in",
        spec: {
          format: "cream",
          weight: overrides.weight === undefined ? "light" : overrides.weight,
          careDirection:
            overrides.careDirection === undefined ? "moisture" : overrides.careDirection,
          repairSupportLevel: overrides.repairSupportLevel ?? "medium",
          roles: [role],
          providesHeatProtection: overrides.providesHeatProtection ?? false,
          careBenefits: [],
          applicationStages: ["damp"],
        },
      } as Stage3CategoryProductFacts
    case "mask":
      return {
        ...common,
        category: "mask",
        spec: {
          weight: overrides.weight === undefined ? "light" : overrides.weight,
          careDirection:
            overrides.careDirection === undefined ? "moisture" : overrides.careDirection,
          repairSupportLevel: overrides.repairSupportLevel ?? "medium",
          functionalBenefits: [],
        },
      } as Stage3CategoryProductFacts
    case "heat_protectant":
      return {
        ...common,
        category: "heat_protectant",
        spec: {
          format: "spray",
          providesHeatProtection: overrides.providesHeatProtection ?? true,
        },
      } as Stage3CategoryProductFacts
    default:
      throw new Error(`fixture missing for ${category}`)
  }
}

function conditionerDecision(): PlanCategoryDecision {
  return {
    category: "conditioner",
    resolution: "resolved",
    needTier: "basis",
    roles: ["conditioner_rinse_out"],
    target: {
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

function leaveInDecision(): PlanCategoryDecision {
  return {
    category: "leave_in",
    resolution: "resolved",
    needTier: "basis",
    roles: ["post_wash_leave_in", "pre_heat_application"],
    target: {
      category: "leave_in",
      roles: ["post_wash_leave_in", "pre_heat_application"],
      weight: "medium",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functions: [],
      conditionerReplacementEligible: false,
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

/** Two roles on a role-sensitive category: everyday + a targeted dandruff job. */
function shampooDecision(): PlanCategoryDecision {
  return {
    category: "shampoo",
    resolution: "resolved",
    needTier: "basis",
    roles: ["shampoo_everyday", "shampoo_dandruff"],
    target: {
      category: "shampoo",
      roles: ["shampoo_everyday", "shampoo_dandruff"],
      scalpRoute: "balanced",
      everydayConstraint: "standard",
      requiresTargetedDandruffCapability: true,
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

function heatProtectantDecision(): PlanCategoryDecision {
  return {
    category: "heat_protectant",
    resolution: "resolved",
    needTier: "basis",
    roles: ["pre_heat_protection"],
    target: {
      category: "heat_protectant",
      roles: ["pre_heat_protection"],
      qualifyingRoutes: ["direct_contact_heat"],
      carrierPolicy: "integrated_or_separate_verified_binary_capability",
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

function notNeededMaskDecision(): PlanCategoryDecision {
  return {
    category: "mask",
    resolution: "resolved",
    needTier: "not_needed",
    roles: [],
    target: null,
    frequency: null,
    reasons: [
      {
        id: "mask.inclusion.no_job",
        salience: "primary",
        evidence: [{ source: "assessment", key: "mask_inclusion_rule" }],
        values: {},
      },
      {
        id: "mask.reason.not_a_real_reason_id",
        salience: "detail",
        evidence: [{ source: "quiz", key: "currentConcerns" }],
        values: {},
      },
    ],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

/** Scalp care awaiting the buildup assessment: deferred, not settled as "not needed". */
function deferredScalpCareDecision(): PlanCategoryDecision {
  return {
    category: "scalp_care",
    resolution: "deferred_until_post_plan_onboarding",
    needTier: null,
    roles: [],
    target: null,
    frequency: null,
    reasons: [
      {
        id: "scalp_care.inclusion.buildup_deferred",
        salience: "primary",
        evidence: [{ source: "assessment", key: "scalpBuildup" }],
        values: {},
      },
    ],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: ["current_product_load"],
  } as PlanCategoryDecision
}

const COVERAGE_FACTS: PlanPortfolioCoverageFact[] = [
  {
    job: "repair_support",
    ruleId: "coverage.repair_support",
    primaryCategories: ["conditioner"],
    supportingCategories: ["mask"],
    outcome: "shared",
  },
  {
    job: "rinse_out_conditioning",
    ruleId: "coverage.rinse_out",
    primaryCategories: ["conditioner"],
    supportingCategories: [],
    outcome: "owned",
  },
  {
    job: "damp_smoothing",
    ruleId: "coverage.damp_smoothing",
    primaryCategories: ["leave_in"],
    supportingCategories: ["mask"],
    outcome: "deferred_allocation",
  },
  {
    job: "scalp_flake_or_comfort",
    ruleId: "coverage.scalp_comfort",
    primaryCategories: ["shampoo"],
    supportingCategories: ["scalp_care"],
    outcome: "owned",
  },
]

function scanInput(
  overrides: Partial<BuildScanVerdictInput> & Pick<BuildScanVerdictInput, "category" | "decision">,
): BuildScanVerdictInput {
  return {
    productFacts: null,
    recommendationCandidates: [],
    coverage: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "version-1",
    refinedInputHash: "hash-1",
    ...overrides,
  }
}

/* --------------------------------------------------------------- not_needed */

test("a not_needed category answers with the need verdict instead of a fit verdict", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "mask",
      decision: notNeededMaskDecision(),
      productFacts: factsFor("mask", "intensive_conditioning_mask", "scanned-mask"),
      // Candidates that would become alternatives on any evaluated branch.
      recommendationCandidates: [
        factsFor("mask", "intensive_conditioning_mask", "alt-1"),
        factsFor("mask", "intensive_conditioning_mask", "alt-2"),
      ],
      coverage: COVERAGE_FACTS,
    }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.equal(payload.mode, "not_needed")
  assert.equal(payload.headline, "Du brauchst aktuell keine Maske")
  assert.equal(payload.subtitle, "Keine Maske in deinem Bedarf")
  assert.equal(payload.status, "neutral")
  // No fit fields: the branch never evaluates the authority, so it cannot carry a verdict.
  assert.equal("verdict" in payload, false)
  assert.equal("criteria" in payload, false)
  assert.equal("alternatives" in payload, false)
})

test("not_needed reasons render as German copy and unmapped reason ids stay hidden", () => {
  const payload = buildScanVerdict(
    scanInput({ category: "mask", decision: notNeededMaskDecision(), coverage: COVERAGE_FACTS }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.deepEqual(payload.reasons, ["Deine Längen zeigen aktuell keinen erhöhten Pflegebedarf."])
  assert.ok(payload.reasons.every((reason) => !reason.includes("mask.")))
})

test("not_needed names what already covers the job from the snapshot coverage facts", () => {
  const payload = buildScanVerdict(
    scanInput({ category: "mask", decision: notNeededMaskDecision(), coverage: COVERAGE_FACTS }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  // Only the owned/shared fact that names the scanned category, and never the scanned
  // category itself as its own cover.
  assert.deepEqual(payload.coveredBy, [{ label: "Conditioner", detail: "Repair-Pflege" }])
})

test("not_needed without any covering fact leaves the coverage list empty", () => {
  const payload = buildScanVerdict(
    scanInput({ category: "mask", decision: notNeededMaskDecision(), coverage: [] }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.deepEqual(payload.coveredBy, [])
})

test("not_needed dimensions show the product without inventing a target", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "mask",
      decision: notNeededMaskDecision(),
      productFacts: factsFor("mask", "intensive_conditioning_mask", "scanned-mask", {
        weight: "rich",
      }),
      coverage: COVERAGE_FACTS,
    }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.ok(payload.dimensions.length > 0)
  assert.ok(payload.dimensions.every((dimension) => dimension.targetStopIds.length === 0))
  assert.ok(payload.dimensions.every((dimension) => dimension.state === "no_target"))
  assert.ok(payload.dimensions.every((dimension) => dimension.stops.length > 0))
  const weight = payload.dimensions.find((dimension) => dimension.dimensionId === "mask.weight")
  assert.deepEqual(weight?.productStopIds, ["rich"])
})

test("not_needed without a scanned product carries no dimensions", () => {
  const payload = buildScanVerdict(
    scanInput({ category: "mask", decision: notNeededMaskDecision() }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.deepEqual(payload.dimensions, [])
})

/* ---------------------------------------------------------------- deferred */

test("a deferred category says the decision is still open instead of claiming no need", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "scalp_care",
      decision: deferredScalpCareDecision(),
      coverage: COVERAGE_FACTS,
    }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.equal(payload.mode, "deferred")
  assert.equal(payload.headline, "Das klären wir noch")
  assert.equal(payload.subtitle, "Für Kopfhautprodukt steht deine Einschätzung noch aus")
  assert.equal(payload.status, "neutral")
  // Everything else the branch carries is unchanged by the mode.
  assert.deepEqual(payload.reasons, [
    "Deine Kopfhaut-Angaben sind noch nicht vollständig – das klären wir später.",
  ])
  assert.deepEqual(payload.coveredBy, [
    { label: "Shampoo", detail: "Kopfhautkomfort und Schuppen" },
  ])
})

test("deferred mode keeps the product-only dimensions of the need branch", () => {
  const decision = {
    ...notNeededMaskDecision(),
    resolution: "deferred_until_post_plan_onboarding",
    needTier: null,
  } as PlanCategoryDecision
  const payload = buildScanVerdict(
    scanInput({
      category: "mask",
      decision,
      productFacts: factsFor("mask", "intensive_conditioning_mask", "scanned-mask", {
        weight: "rich",
      }),
    }),
  )

  assert.equal(payload.kind, "not_needed")
  if (payload.kind !== "not_needed") return
  assert.equal(payload.mode, "deferred")
  assert.ok(payload.dimensions.length > 0)
  assert.ok(payload.dimensions.every((dimension) => dimension.targetStopIds.length === 0))
  assert.ok(payload.dimensions.every((dimension) => dimension.state === "no_target"))
})

/* ------------------------------------------------------------ single role */

test("a single-role category reports the verdict, dimensions, and target subtitle", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "conditioner",
      decision: conditionerDecision(),
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "scanned-conditioner"),
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "ideal")
  assert.equal(payload.verdictLabel, "Passt")
  assert.equal(payload.verdictTitle, "Passt zu deinem Haar")
  assert.equal(payload.status, "ok")
  assert.equal(payload.evaluatedRole, "conditioner_rinse_out")
  assert.equal(payload.evaluatedRoleLabel, "Pflege nach der Wäsche")
  assert.deepEqual(payload.coverage, { matches: 4, total: 4 })
  assert.equal(payload.subtitle, "4 von 4 Zielbereichen getroffen")
  assert.ok(payload.criteria.length > 0)
  assert.deepEqual(
    payload.dimensions.map((dimension) => dimension.dimensionId),
    [
      "conditioner.weight",
      "conditioner.care_direction",
      "conditioner.repair_support",
      "conditioner.suitable_thicknesses",
    ],
  )
  const weight = payload.dimensions.find(
    (dimension) => dimension.dimensionId === "conditioner.weight",
  )
  assert.deepEqual(weight?.targetStopIds, ["light"])
  assert.deepEqual(weight?.productStopIds, ["light"])
  assert.equal(weight?.state, "in_target")
  assert.deepEqual(payload.fitNarrative, {
    productCriteria: "Pflege, Glättung und Kämmbarkeit passend zum Gewicht deines Haars.",
    fit: "Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
  })
})

test("a product outside the target renders the missed dimension as outside_target", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "conditioner",
      decision: conditionerDecision(),
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "scanned-conditioner", {
        weight: "rich",
        balanceDirection: "protein",
        careDirection: "protein",
      }),
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "mismatch")
  assert.equal(payload.verdictLabel, "Passt nicht")
  assert.equal(payload.verdictTitle, "Passt nicht zu deinem Haar")
  assert.equal(payload.status, "danger")
  const weight = payload.dimensions.find(
    (dimension) => dimension.dimensionId === "conditioner.weight",
  )
  assert.equal(weight?.state, "outside_target")
  assert.deepEqual(weight?.productStopIds, ["rich"])
})

/* -------------------------------------------------------------- multi role */

test("the best role wins when one role mismatches and another supports", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "leave_in",
      decision: leaveInDecision(),
      // No verified heat protection: the pre-heat role must not be the reported role.
      productFacts: factsFor("leave_in", "post_wash_leave_in", "scanned-leave-in", {
        providesHeatProtection: false,
      }),
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.evaluatedRole, "post_wash_leave_in")
  assert.equal(payload.evaluatedRoleLabel, "Pflege im feuchten Haar")
  // pre_heat_application evaluates as mismatch for this product; supportive has to win.
  assert.equal(payload.verdict, "supportive")
})

/* ------------------------------------------------------ role-sensitive facts */

/**
 * Shampoo is the one category whose derived facts differ per role (`selectShampooSpec`
 * picks the spec row by the role's expected bucket). The dandruff role must therefore be
 * evaluated against the dandruff-loaded facts, not against whatever the first role loaded.
 */
test("a role-sensitive category evaluates each role against that role's own facts", () => {
  const everydayFacts = factsFor("shampoo", "shampoo_everyday", "scanned-shampoo", {
    shampooBucket: "normal",
    scalpRoute: "balanced",
    // Off the everyday target's "regular" intensity: the everyday role can only be supportive.
    cleansingIntensity: "clarifying",
  })
  const dandruffFacts = factsFor("shampoo", "shampoo_dandruff", "scanned-shampoo", {
    shampooBucket: "schuppen",
    scalpRoute: "dandruff",
    cleansingIntensity: "regular",
  })

  const payload = buildScanVerdict(
    scanInput({
      category: "shampoo",
      decision: shampooDecision(),
      productFacts: everydayFacts,
      perRoleFacts: {
        shampoo_everyday: { productFacts: everydayFacts, recommendationCandidates: [] },
        shampoo_dandruff: { productFacts: dandruffFacts, recommendationCandidates: [] },
      },
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.evaluatedRole, "shampoo_dandruff")
  assert.equal(payload.verdict, "ideal")
})

test("without per-role facts both roles share one load — the dandruff role cannot fit", () => {
  const everydayFacts = factsFor("shampoo", "shampoo_everyday", "scanned-shampoo", {
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "clarifying",
  })

  const payload = buildScanVerdict(
    scanInput({
      category: "shampoo",
      decision: shampooDecision(),
      productFacts: everydayFacts,
    }),
  )

  // The regression this guards: the dandruff role graded against everyday-loaded facts
  // reads "schuppen" nowhere and lands on mismatch, so only the everyday role can win.
  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.evaluatedRole, "shampoo_everyday")
  assert.equal(payload.verdict, "supportive")
})

/* ----------------------------------------------------------- alternatives */

test("a fitting product still offers alternatives (ruling R12)", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "conditioner",
      decision: conditionerDecision(),
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "scanned-conditioner"),
      recommendationCandidates: [
        factsFor("conditioner", "conditioner_rinse_out", "alt-1", { sortOrder: 1 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-2", { sortOrder: 2 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-3", { sortOrder: 3 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-4", { sortOrder: 4 }),
      ],
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "ideal")
  // Ruling R12: a fitting product does not hide what else would fit.
  assert.ok(payload.alternatives.length > 0)
  assert.ok(payload.alternatives.length <= 3)
  assert.ok(
    payload.alternatives.every((alternative) => alternative.productId !== "scanned-conditioner"),
  )
})

test("a mismatching product offers at most three alternatives", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "conditioner",
      decision: conditionerDecision(),
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "scanned-conditioner", {
        weight: "rich",
        balanceDirection: "protein",
        careDirection: "protein",
      }),
      recommendationCandidates: [
        factsFor("conditioner", "conditioner_rinse_out", "alt-1", { sortOrder: 1 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-2", { sortOrder: 2 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-3", { sortOrder: 3 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-4", { sortOrder: 4 }),
      ],
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "mismatch")
  assert.equal(payload.alternatives.length, 3)
  assert.ok(
    payload.alternatives.every((alternative) => alternative.productId !== "scanned-conditioner"),
  )
  assert.ok(
    payload.alternatives.every(
      (alternative) => alternative.verdict === "ideal" || alternative.verdict === "supportive",
    ),
  )
  assert.equal(payload.alternatives[0]?.verdictLabel, "Passt")
  // Intl currency formatting separates amount and symbol with a non-breaking space.
  assert.equal(payload.alternatives[0]?.priceLabel, "9,00 €")
  assert.equal(payload.alternatives[0]?.netContentLabel, "200 ml")
  assert.equal(payload.alternatives[0]?.imageUrl, "https://example.com/alt-1.jpg")
})

test("a supportive product still offers alternatives", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "conditioner",
      decision: conditionerDecision(),
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "scanned-conditioner", {
        weight: "medium",
      }),
      recommendationCandidates: [
        factsFor("conditioner", "conditioner_rinse_out", "alt-1", { sortOrder: 1 }),
        factsFor("conditioner", "conditioner_rinse_out", "alt-2", { sortOrder: 2 }),
      ],
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "supportive")
  assert.equal(payload.verdictLabel, "Passt mit Einschränkung")
  assert.equal(payload.verdictTitle, "Passt mit Einschränkung zu deinem Haar")
  assert.equal(payload.status, "pending")
  assert.ok(payload.alternatives.length > 0)
  assert.ok(payload.alternatives.length <= 3)
})

/* ---------------------------------------------------------- compact category */

test("a compact category falls back to criterion rows and a criterion subtitle", () => {
  const payload = buildScanVerdict(
    scanInput({
      category: "heat_protectant",
      decision: heatProtectantDecision(),
      productFacts: factsFor("heat_protectant", "pre_heat_protection", "scanned-heat"),
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.deepEqual(payload.dimensions, [])
  assert.ok(payload.criteria.length > 0)
  assert.deepEqual(payload.coverage, { matches: 1, total: 1 })
  assert.equal(payload.subtitle, "1 von 1 Kriterien erfüllt")
})

/* --------------------------------------------------------------- edge cases */

test("a needed category with no evaluable role stays honestly unclear", () => {
  const decision = {
    ...heatProtectantDecision(),
    needTier: null,
    roles: [],
  } as PlanCategoryDecision
  const payload = buildScanVerdict(
    scanInput({
      category: "heat_protectant",
      decision,
      productFacts: factsFor("heat_protectant", "pre_heat_protection", "scanned-heat"),
    }),
  )

  assert.equal(payload.kind, "in_catalog")
  if (payload.kind !== "in_catalog") return
  assert.equal(payload.verdict, "unknown")
  assert.equal(payload.verdictLabel, "Unklar")
  assert.equal(payload.verdictTitle, "Noch nicht sicher einzuordnen")
  assert.equal(payload.status, "neutral")
  assert.equal(payload.evaluatedRole, null)
  assert.equal(payload.evaluatedRoleLabel, null)
  assert.deepEqual(payload.alternatives, [])
})
