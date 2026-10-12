import assert from "node:assert/strict"
import test from "node:test"

import { buildOilDecision } from "../../src/lib/personal-plan/categories/oil"
import { buildPlanProfile } from "../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../src/lib/personal-plan/needs"
import { isValidPersistedCategoryDecision } from "../../src/lib/personal-plan/products/authority/category-decision-schema"
import { buildScanVerdict } from "../../src/lib/scan/resolve-verdict"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"
import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
import { evaluateStage3Authority } from "../../src/lib/personal-plan/products/authority/evaluate"
import type { Stage3AuthorityInput } from "../../src/lib/personal-plan/products/authority/contracts"

type Category = "shampoo" | "conditioner" | "oil"
type Verdict = "ideal" | "supportive" | "mismatch"

const expectedVerdict = (steps: number): Verdict =>
  steps === 0 ? "ideal" : steps === 1 ? "supportive" : "mismatch"

function base(category: Category, role: string, target: unknown, spec: unknown) {
  return {
    category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    refinedVersionId: "fit-verdict-fixture",
    refinedInputHash: "fit-verdict-fixture",
    subjectKey: `decision:${category}:${role}:owned`,
    role,
    capturedProductId: "owned",
    subjectIdentity: {
      kind: "catalog_product",
      productId: "owned",
      displayName: "Produkt",
      category,
    },
    categoryDecision: {
      category,
      resolution: "resolved",
      needTier: "basis",
      roles: [role],
      target,
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    coverage: [],
    hairThickness: "coarse",
    productFacts: {
      productId: "owned",
      displayName: "Produkt",
      category,
      isActive: true,
      lifecycleStatus: "active",
      recommendable: true,
      suitableThicknesses: ["coarse"],
      knownReaction: false,
      protocols: [{ role, status: "verified_complete", fingerprint: "protocol" }],
      factFingerprint: "facts",
      spec,
    },
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as unknown as Stage3AuthorityInput
}

function shampoo(spec: Record<string, unknown>) {
  return base(
    "shampoo",
    "shampoo_everyday",
    {
      category: "shampoo",
      roles: ["shampoo_everyday"],
      scalpRoute: "balanced",
      everydayConstraint: "standard",
      requiresTargetedDandruffCapability: false,
    },
    {
      thickness: "coarse",
      thicknesses: ["coarse"],
      shampooBucket: "normal",
      scalpRoute: "balanced",
      cleansingIntensity: "regular",
      targetFit: "matched",
      ...spec,
    },
  )
}

function shampooWithCleansingTarget(
  cleansingIntensity: "gentle" | "regular" | "strong",
  target: "gentle",
) {
  const input = shampoo({
    shampooBucket: target === "gentle" ? "trocken" : "normal",
    scalpRoute: target === "gentle" ? "dry" : "balanced",
    cleansingIntensity,
  }) as any
  input.categoryDecision.target = {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: target === "gentle" ? "dry" : "balanced",
    everydayConstraint: target === "gentle" ? "gentle_dry_scalp" : "standard",
    requiresTargetedDandruffCapability: false,
  }
  return input as Stage3AuthorityInput
}

function conditioner(spec: Record<string, unknown>) {
  return base(
    "conditioner",
    "conditioner_rinse_out",
    {
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
      weight: "rich",
      careDirection: "moisture",
      repairSupportLevel: "high",
      functionalNeeds: [],
    },
    {
      thickness: "coarse",
      thicknesses: ["coarse"],
      proteinMoistureBalance: "moisture",
      weight: "rich",
      repairSupportLevel: "high",
      balanceDirection: "moisture",
      targetFit: "matched",
      ...spec,
    },
  )
}

function oil(spec: Record<string, unknown>, role = "leave_on_fibre_conditioning") {
  return base(
    "oil",
    role,
    {
      category: "oil",
      roles: [role],
      roleTargets: [{ role, tier: "basis", weight: "rich", functionalBenefits: [] }],
    },
    {
      roleSupport: { [role]: true },
      thicknesses: ["coarse"],
      weight: "rich",
      targetThicknessEligible: true,
      providesHeatProtection: false,
      ...spec,
    },
  )
}

function assertFit(
  input: Stage3AuthorityInput,
  verdict: Verdict,
  criterionId: string,
  reason: string,
) {
  const result = evaluateStage3Authority(input as never)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, verdict)
  const criterion = result.criteria.find((item) => item.criterionId === criterionId)
  assert.ok(criterion, `expected ${criterionId}`)
  assert.equal(criterion.explanation, reason)
}

// Each table protects the category adapter boundary: it must expose the shared
// distance result as both verdict and customer-facing explanation.
{
  const cases: Array<{
    name: string
    input: Stage3AuthorityInput
    steps: number
    criterion: string
    reason: string
  }> = [
    ...(["coarse", "normal", "fine"] as const).map((thickness, index) => ({
      name: `shampoo thickness ${index}`,
      input: shampoo({ thickness, thicknesses: [thickness] }),
      steps: index,
      criterion: "shampoo.thickness",
      reason: "Eher für feines Haar gedacht",
    })),
    ...(["gentle", "regular", "strong"] as const).map((cleansingIntensity, index) => ({
      name: `shampoo cleansing ${index}`,
      input: shampooWithCleansingTarget(cleansingIntensity, "gentle"),
      steps: index,
      criterion: "shampoo.cleansing_intensity",
      reason: "Reinigt kräftiger als nötig",
    })),
    ...(["coarse", "normal", "fine"] as const).map((thickness, index) => ({
      name: `conditioner thickness ${index}`,
      input: conditioner({ thickness, thicknesses: [thickness] }),
      steps: index,
      criterion: "conditioner.thickness",
      reason: "Eher für feines Haar gedacht",
    })),
    ...(["rich", "medium", "light"] as const).map((weight, index) => ({
      name: `conditioner weight ${index}`,
      input: conditioner({ weight }),
      steps: index,
      criterion: "conditioner.weight",
      reason: "Für dein Haar eher leicht",
    })),
    ...(["moisture", "balanced", "protein"] as const).map((proteinMoistureBalance, index) => ({
      name: `conditioner direction ${index}`,
      input: conditioner({ proteinMoistureBalance }),
      steps: index,
      criterion: "conditioner.balance",
      reason: "Mehr Protein als dein Haar gerade braucht",
    })),
    ...(["high", "medium", "low"] as const).map((repairSupportLevel, index) => ({
      name: `conditioner repair ${index}`,
      input: conditioner({ repairSupportLevel }),
      steps: index,
      criterion: "conditioner.repair",
      reason: "Weniger Reparatur, als dein Haar braucht",
    })),
    ...(["coarse", "normal", "fine"] as const).map((thickness, index) => ({
      name: `oil thickness ${index}`,
      input: oil({ thicknesses: [thickness] }),
      steps: index,
      criterion: "oil.thickness",
      reason: "Eher für feines Haar gedacht",
    })),
    ...(["rich", "medium", "light"] as const).map((weight, index) => ({
      name: `oil weight ${index}`,
      input: oil({ weight }),
      steps: index,
      criterion: "oil.weight",
      reason: "Für dein Haar eher leicht",
    })),
  ]

  for (const item of cases) {
    test(`fit verdict category axis: ${item.name}`, () => {
      const result = evaluateStage3Authority(item.input as never)
      assert.equal(result.status, "known", item.name)
      if (result.status !== "known") return
      assert.equal(result.verdict, expectedVerdict(item.steps), item.name)
      const outcome = result.criteria.find((entry) => entry.criterionId === item.criterion)
      assert.ok(outcome, item.name)
      assert.equal(
        outcome.result,
        item.steps === 0 ? "pass" : item.steps === 1 ? "caution" : "fail",
      )
      assert.equal(
        outcome.explanation,
        item.steps === 0 ? "Entspricht deinem Bedarf." : item.reason,
      )
    })
  }
}

test("fit verdict reasons describe the direction of one-step axes", () => {
  assertFit(
    shampoo({ cleansingIntensity: "gentle" }),
    "supportive",
    "shampoo.cleansing_intensity",
    "Reinigt sanfter als nötig",
  )
  const coarser = conditioner({ thickness: "coarse", thicknesses: ["coarse"] }) as any
  coarser.hairThickness = "normal"
  assertFit(coarser, "supportive", "conditioner.thickness", "Eher für kräftigeres Haar gedacht")
})

test("fit verdict categories add one-step misses and gates still take precedence", () => {
  assertFit(
    conditioner({ thickness: "normal", thicknesses: ["normal"], weight: "medium" }),
    "mismatch",
    "conditioner.thickness",
    "Eher für feines Haar gedacht",
  )

  const gated = shampoo({ thickness: "normal", thicknesses: ["normal"] }) as any
  gated.productFacts.knownReaction = true
  assertFit(
    gated,
    "mismatch",
    "shampoo.safety",
    "Für dieses Produkt ist eine Unverträglichkeit bekannt.",
  )

  const missingProtocol = shampoo({ thickness: "normal", thicknesses: ["normal"] }) as any
  missingProtocol.productFacts.protocols = []
  const result = evaluateStage3Authority(missingProtocol)
  assert.equal(result.status, "unknown")
})

test("oil ignores weight for pre-wash and owned mismatches retain the standard actions", () => {
  const preWash = oil({ weight: "light" }, "pre_wash_fibre_treatment")
  const preWashResult = evaluateStage3Authority(preWash as never)
  assert.equal(preWashResult.status, "known")
  if (preWashResult.status === "known") assert.equal(preWashResult.verdict, "ideal")

  const mismatch = oil({ thicknesses: ["fine"] })
  const result = evaluateStage3Authority(mismatch as never)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.deepEqual(result.allowedActions, ["acknowledge_override", "leave_uncovered"])
})

for (const category of ["shampoo", "conditioner", "oil"] as const) {
  const create = { shampoo, conditioner, oil }[category]
  test(`${category}: repair above target, missing facts, additive misses and mismatch actions`, () => {
    const input = create({}) as any
    if (category === "conditioner") {
      input.categoryDecision.target.repairSupportLevel = "low"
      const result = evaluateStage3Authority(input)
      assert.equal(result.status === "known" ? result.verdict : null, "ideal")
    }
    input.productFacts.protocols = []
    input.productFacts.spec.thicknesses = ["fine"]
    const far = evaluateStage3Authority(input)
    assert.equal(far.status === "known" ? far.verdict : null, "mismatch")
    if (far.status === "known")
      assert.deepEqual(far.allowedActions, ["acknowledge_override", "leave_uncovered"])
    input.productFacts.spec.thicknesses = ["normal"]
    assert.equal(evaluateStage3Authority(input).status, "unknown")
    input.productFacts.protocols = [
      { role: input.role, status: "verified_complete", fingerprint: "p" },
    ]
    if (category === "shampoo") input.productFacts.spec.cleansingIntensity = "gentle"
    else input.productFacts.spec.weight = "medium"
    const combined = evaluateStage3Authority(input)
    assert.equal(combined.status === "known" ? combined.verdict : null, "mismatch")
  })
}

test("direction reasons cover heavier weight and more moisture", () => {
  const weight = oil({ weight: "rich" }) as any
  weight.categoryDecision.target.roleTargets[0].weight = "medium"
  assertFit(weight, "supportive", "oil.weight", "Für dein Haar eher schwer")
  const moisture = conditioner({ proteinMoistureBalance: "moisture" }) as any
  moisture.categoryDecision.target.careDirection = "balanced"
  assertFit(
    moisture,
    "supportive",
    "conditioner.balance",
    "Mehr Feuchtigkeit als dein Haar gerade braucht",
  )
})

for (const category of ["shampoo", "conditioner", "oil"] as const) {
  test(`${category}: near candidates are ranked and offered for an owned mismatch`, () => {
    const create = { shampoo, conditioner, oil }[category]
    const input = create({ thickness: "fine", thicknesses: ["fine"] }) as any
    const near = structuredClone(
      create({ thickness: "normal", thicknesses: ["normal"] }).productFacts,
    )
    const worse = { ...near, productId: "worse", catalogSortOrder: 9 }
    const better = { ...near, productId: "better", catalogSortOrder: 1 }
    input.recommendationCandidates = [worse, better]
    const mismatch = evaluateStage3Authority(input)
    assert.equal(mismatch.status, "known")
    if (mismatch.status !== "known") return
    assert.equal(mismatch.verdict, "mismatch")
    assert.equal(mismatch.recommendation?.productId, "better")
    assert.deepEqual(mismatch.allowedActions, [
      "acknowledge_override",
      "plan_recommendation",
      "leave_uncovered",
    ])
    assert.equal(mismatch.recommendation?.reason, "Eher für feines Haar gedacht")
    input.productFacts = null
    input.capturedProductId = null
    input.subjectIdentity = null
    const gap = evaluateStage3Authority(input)
    assert.equal(gap.status === "known" ? gap.verdict : null, "supportive")
    if (gap.status === "known") assert.equal(gap.recommendation?.productId, "better")
  })
}

// The documented ideal set is carried from the plan target through the strict
// persisted reader to scanner authority, including both leave-on roles.
for (const row of [
  {
    thickness: "fine",
    sensitive: false,
    targets: ["light"],
    verdicts: ["ideal", "supportive", "mismatch"],
  },
  {
    thickness: "normal",
    sensitive: false,
    targets: ["light", "medium"],
    verdicts: ["ideal", "ideal", "supportive"],
  },
  {
    thickness: "coarse",
    sensitive: false,
    targets: ["medium", "rich"],
    verdicts: ["supportive", "ideal", "ideal"],
  },
  {
    thickness: "fine",
    sensitive: true,
    targets: ["light"],
    verdicts: ["ideal", "supportive", "mismatch"],
  },
  {
    thickness: "normal",
    sensitive: true,
    targets: ["light"],
    verdicts: ["ideal", "supportive", "mismatch"],
  },
  {
    thickness: "coarse",
    sensitive: true,
    targets: ["medium"],
    verdicts: ["supportive", "ideal", "supportive"],
  },
] as const) {
  test(`oil ideal weight set survives plan persistence and scanning: ${row.thickness}, load sensitive ${row.sensitive}`, () => {
    const profile = buildPlanProfile(
      {
        ...COMPLETE_V3_PLAN_ENVELOPE,
        answers: {
          ...COMPLETE_V3_PLAN_ENVELOPE.answers,
          thickness: row.thickness,
          currentConcerns: row.sensitive
            ? ["low_shine", "frizz_flyaways", "low_volume_or_weighed_down"]
            : ["low_shine", "frizz_flyaways"],
        },
      },
      { artifactId: "fit-oil-weight-set", projection: "initial_quiz" },
    )
    const decision = buildOilDecision(profile, buildPlanNeedAssessment(profile))
    assert.ok(isValidPersistedCategoryDecision(JSON.parse(JSON.stringify(decision))))
    assert.equal(decision.target?.category, "oil")
    if (decision.target?.category !== "oil") return
    for (const role of ["leave_on_fibre_conditioning", "dry_finish"] as const) {
      assert.deepEqual(
        decision.target.roleTargets.find((target) => target.role === role)?.acceptedTargets,
        row.targets,
      )
      for (const [index, weight] of ["light", "medium", "rich"].entries()) {
        const input = oil({ weight, thicknesses: [row.thickness] }, role)
        input.categoryDecision = decision
        input.hairThickness = row.thickness
        input.productFacts!.suitableThicknesses = [row.thickness]
        const owned = evaluateStage3Authority(input)
        assert.equal(
          owned.status === "known" ? owned.verdict : null,
          row.verdicts[index],
          `${role}: ${weight}`,
        )
        const scanned = buildScanVerdict({
          category: "oil",
          decision: { ...decision, roles: [role] },
          productFacts: input.productFacts,
          recommendationCandidates: [],
          coverage: [],
          hairThickness: row.thickness,
          heatCarrierCoverage: input.heatCarrierCoverage,
          refinedVersionId: input.refinedVersionId,
          refinedInputHash: input.refinedInputHash,
          alternativeSelection: "native",
        })
        assert.equal(scanned.kind, "in_catalog")
        if (scanned.kind === "in_catalog")
          assert.equal(scanned.verdict, row.verdicts[index], `${role}: ${weight}`)
      }
    }
  })
}

for (const row of [
  {
    category: "shampoo",
    input: shampoo({
      thickness: null,
      thicknesses: null,
      shampooBucket: null,
      scalpRoute: null,
      cleansingIntensity: null,
    }),
    keys: [
      "shampoo.thickness",
      "shampoo_bucket",
      "scalp_route",
      "cleansing_intensity",
      "verified_protocol",
    ],
  },
  {
    category: "oil",
    input: oil({ roleSupport: {}, thicknesses: null, targetThicknessEligible: null, weight: null }),
    keys: ["oil.role_support", "oil.thickness_eligibility", "oil.weight", "application_protocol"],
  },
]) {
  test(`${row.category}: missing-fact keys preserve the scanner wire contract`, () => {
    row.input.productFacts!.protocols = []
    const result = evaluateStage3Authority(row.input)
    assert.equal(result.status, "unknown")
    if (result.status === "unknown") assert.deepEqual(result.missingFacts, [...row.keys].sort())
  })
}
