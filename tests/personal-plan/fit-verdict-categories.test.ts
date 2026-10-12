import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ProductFitComparison } from "../../src/components/personal-plan-products/product-fit-comparison"
import { ScanVerdictSections } from "../../src/components/scan/scan-verdict-sections"
import { criterionIdForDimension } from "../../src/lib/personal-plan/products/comparison-dimensions"
import { buildStage3FitComparison } from "../../src/lib/personal-plan/products/fit-comparison"

import { buildOilDecision } from "../../src/lib/personal-plan/categories/oil"
import { buildPlanProfile } from "../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../src/lib/personal-plan/needs"
import { isValidPersistedCategoryDecision } from "../../src/lib/personal-plan/products/authority/category-decision-schema"
import { buildScanVerdict } from "../../src/lib/scan/resolve-verdict"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"
import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
import { evaluateStage3Authority } from "../../src/lib/personal-plan/products/authority/evaluate"
import type { Stage3AuthorityInput } from "../../src/lib/personal-plan/products/authority/contracts"

type Category = Stage3AuthorityInput["category"]
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

function mask(spec: Record<string, unknown>) {
  return base(
    "mask",
    "intensive_conditioning_mask",
    {
      category: "mask",
      roles: ["intensive_conditioning_mask"],
      needStrength: "standard",
      weight: "rich",
      careDirection: "protein",
      repairSupportLevel: "high",
      functionalNeeds: [],
    },
    {
      weight: "rich",
      careDirection: "protein",
      repairSupportLevel: "high",
      functionalBenefits: [],
      ...spec,
    },
  )
}

function leaveIn(spec: Record<string, unknown>) {
  return base(
    "leave_in",
    "post_wash_leave_in",
    {
      category: "leave_in",
      roles: ["post_wash_leave_in"],
      weight: "rich",
      careDirection: "moisture",
      repairSupportLevel: "high",
      functions: [],
      conditionerReplacementEligible: false,
    },
    {
      weight: "rich",
      careDirection: "moisture",
      repairSupportLevel: "high",
      roles: ["post_wash_leave_in"],
      applicationStages: ["towel_dry"],
      careBenefits: [],
      providesHeatProtection: false,
      ...spec,
    },
  )
}

// fit-verdict spec §§2–4 / §7a.3, ruled 2026-10-12: category adapters must
// preserve distance, additive misses and the R12 accepted set.
for (const [category, create, direction] of [
  ["mask", mask, ["protein", "balanced", "moisture"]],
  ["leave_in", leaveIn, ["moisture", "balanced", "protein"]],
] as const) {
  for (const [axis, values, reason] of [
    ["thickness", ["coarse", "normal", "fine"], "Eher für feines Haar gedacht"],
    ["weight", ["rich", "medium", "light"], "Für dein Haar eher leicht"],
    [
      "care_direction",
      direction,
      category === "mask"
        ? "Mehr Feuchtigkeit als dein Haar gerade braucht"
        : "Mehr Protein als dein Haar gerade braucht",
    ],
    ["repair_support", ["high", "medium", "low"], "Weniger Reparatur, als dein Haar braucht"],
  ] as const) {
    for (const [steps, value] of values.entries()) {
      test(`fit verdict category axis: ${category} ${axis} ${steps}`, () => {
        const key =
          axis === "care_direction"
            ? "careDirection"
            : axis === "repair_support"
              ? "repairSupportLevel"
              : axis
        const input = create(axis === "thickness" ? {} : { [key]: value })
        if (axis === "thickness") input.productFacts!.suitableThicknesses = [value]
        const result = evaluateStage3Authority(input)
        assert.equal(result.status === "known" ? result.verdict : null, expectedVerdict(steps))
        if (result.status !== "known") return
        const row = result.criteria.find((entry) => entry.criterionId === `${category}.${axis}`)
        assert.equal(row?.result, steps === 0 ? "pass" : steps === 1 ? "caution" : "fail")
        assert.equal(row?.explanation, steps === 0 ? "Entspricht deinem Bedarf." : reason)
      })
    }
  }
}

test("dandruff plus irritation has no cleansing gate or target shift", () => {
  // fit-verdict spec §7b Q5, ruled 2026-10-12.
  const input = shampoo({
    shampooBucket: "schuppen",
    scalpRoute: "dandruff",
    cleansingIntensity: "regular",
  }) as any
  input.role = "shampoo_dandruff"
  input.categoryDecision.target.roles = [input.role]
  input.categoryDecision.target.everydayConstraint = "irritation_compatible"
  input.productFacts.protocols[0].role = input.role
  const result = evaluateStage3Authority(input)
  assert.equal(result.status === "known" ? result.verdict : null, "ideal")
  input.categoryDecision.target.everydayConstraint = "standard"
  assert.deepEqual(evaluateStage3Authority(input), result)
})

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

// fit-verdict spec §§2–5 / §7a.3, ruled 2026-10-12. These checks protect
// gates, missing-fact transport and supportive selection through real authority.
for (const [category, create] of [
  ["mask", mask],
  ["leave_in", leaveIn],
] as const) {
  test(`${category}: additive misses, repair above target and known mismatch precedence`, () => {
    const input = create({ weight: "medium", repairSupportLevel: "medium" }) as any
    assert.equal(
      evaluateStage3Authority(input).status === "known"
        ? (evaluateStage3Authority(input) as any).verdict
        : null,
      "mismatch",
    )
    input.productFacts.protocols = []
    const incomplete = evaluateStage3Authority(input)
    assert.equal(incomplete.status === "known" ? incomplete.verdict : null, "mismatch")
    input.productFacts.spec.weight = "rich"
    assert.equal(evaluateStage3Authority(input).status, "unknown")
    input.productFacts.protocols = [
      { role: input.role, status: "verified_complete", fingerprint: "p" },
    ]
    input.categoryDecision.target.repairSupportLevel = "low"
    input.productFacts.spec.repairSupportLevel = "high"
    const above = evaluateStage3Authority(input)
    assert.equal(above.status === "known" ? above.verdict : null, "ideal")
  })
  for (const [field, key] of [
    ["weight", category === "mask" ? "mask.weight" : "weight"],
    ["careDirection", category === "mask" ? "mask.care_direction" : "care_direction"],
    ["repairSupportLevel", category === "mask" ? "mask.repair_support" : "repair_support_level"],
  ] as const) {
    test(`${category}: missing ${field} keeps its wire key and criterion shape`, () => {
      const input = create({ [field]: null })
      const result = evaluateStage3Authority(input)
      assert.equal(result.status, "unknown")
      if (result.status !== "unknown") return
      assert.deepEqual(result.missingFacts, [key])
      for (const row of result.criteria ?? [])
        assert.deepEqual(Object.keys(row).sort(), ["criterionId", "explanation", "label", "result"])
    })
  }
  test(`${category}: missing common facts retain wire keys`, () => {
    const input = create({})
    input.productFacts!.suitableThicknesses = null
    let result = evaluateStage3Authority(input)
    assert.equal(result.status, "unknown")
    if (result.status === "unknown") assert.deepEqual(result.missingFacts, ["suitable_thicknesses"])
    input.productFacts!.suitableThicknesses = ["coarse"]
    input.productFacts!.knownReaction = null
    result = evaluateStage3Authority(input)
    if (result.status === "unknown") assert.deepEqual(result.missingFacts, ["known_reaction"])
  })
  for (const [gate, mutate] of [
    [
      "safety",
      (input: any) => {
        input.productFacts.knownReaction = true
      },
    ],
    [
      "inactive",
      (input: any) => {
        input.productFacts.isActive = false
      },
    ],
    [
      "function",
      (input: any) => {
        if (category === "mask")
          input.categoryDecision.target.functionalNeeds = [
            { need: "shine", ownership: "required", priority: 1 },
          ]
        else
          input.categoryDecision.target.functions = [
            { function: "detangle", ownership: "required", priority: 1 },
          ]
      },
    ],
  ] as const) {
    test(`${category}: ${gate} remains a hard gate with missing axis data`, () => {
      const input = create({ weight: null })
      mutate(input)
      const result = evaluateStage3Authority(input)
      assert.equal(result.status === "known" ? result.verdict : null, "mismatch")
      if (result.status === "known")
        assert.ok(result.criteria.some((item) => item.result === "fail"))
    })
  }
  for (const needTier of ["basis", "optional"] as const) {
    test(`${category}: ${needTier} supportive fallback carries its reason and catalog tie-break`, () => {
      const input = create({})
      input.capturedProductId = null
      input.subjectIdentity = null
      input.productFacts = null
      input.categoryDecision.needTier = needTier
      const near = create({ weight: "medium" }).productFacts!
      input.recommendationCandidates = [
        {
          ...near,
          productId: "later",
          catalogSortOrder: 9,
          presentationImageUrl: "https://example.com/later.webp",
        },
        {
          ...near,
          productId: "earlier",
          catalogSortOrder: 1,
          presentationImageUrl: "https://example.com/earlier.webp",
        },
      ] as never
      const result = evaluateStage3Authority(input)
      assert.equal(result.status === "known" ? result.verdict : null, "supportive")
      if (result.status !== "known") return
      assert.equal(result.recommendation?.productId, "earlier")
      assert.equal(result.recommendation?.reason, "Für dein Haar eher leicht")
      const exact = create({}).productFacts!
      input.recommendationCandidates.push({
        ...exact,
        productId: "ideal",
        catalogSortOrder: 99,
        presentationImageUrl: "https://example.com/ideal.webp",
      } as never)
      const preferred = evaluateStage3Authority(input)
      if (preferred.status === "known") assert.equal(preferred.recommendation?.productId, "ideal")
    })
  }
}

for (const [gate, mutate] of [
  [
    "role",
    (input: any) => {
      input.productFacts.spec.roles = ["post_wash_leave_in"]
    },
  ],
  [
    "stage",
    (input: any) => {
      input.productFacts.spec.applicationStages = ["towel_dry"]
    },
  ],
  [
    "heat",
    (input: any) => {
      input.productFacts.spec.providesHeatProtection = false
    },
  ],
  [
    "required function",
    (input: any) => {
      input.categoryDecision.target.functions = [
        { function: "detangle", ownership: "required", priority: 1 },
      ]
    },
  ],
] as const) {
  test(`pre-heat leave-in: ${gate} remains a hard gate`, () => {
    const input = leaveIn({
      roles: ["pre_heat_application"],
      applicationStages: ["pre_heat"],
      providesHeatProtection: true,
    }) as any
    input.role = "pre_heat_application"
    input.productFacts.protocols[0].role = input.role
    mutate(input)
    const result = evaluateStage3Authority(input)
    assert.equal(result.status === "known" ? result.verdict : null, "mismatch")
  })
}

test("irritated-only scalp still rejects an anti-dandruff shampoo", () => {
  // fit-verdict spec §2.4 / §7b Q5, ruled 2026-10-12: only the combined intensity gate retires.
  const input = shampoo({ shampooBucket: "schuppen", scalpRoute: "dandruff" }) as any
  input.categoryDecision.target.everydayConstraint = "irritation_compatible"
  const result = evaluateStage3Authority(input)
  assert.equal(result.status === "known" ? result.verdict : null, "mismatch")
})

// fit-verdict spec §§2–6, §7a.6, §7b Q2, ruled 2026-10-12.
// Primary authority-boundary guards for the remaining gates and mobile wire keys.
function gateCategory(category: Category, spec: Record<string, unknown> = {}) {
  const configurations = {
    deep_cleansing_shampoo: {
      role: "residue_reset",
      target: {},
      spec: {
        supportedResetRoles: ["residue_reset"],
        scalpTypeFocus: "balanced",
        colorTreatedSuitability: "suitable",
      },
    },
    scalp_care: {
      role: "scalp_comfort",
      target: { roleTargets: [{ role: "scalp_comfort", coverage: "primary" }] },
      spec: { primaryRole: "scalp_comfort", presentationFormat: "serum", rinseMode: "leave_on" },
    },
    heat_protectant: {
      role: "pre_heat_protection",
      target: {
        qualifyingRoutes: ["direct_contact_heat"],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      },
      spec: { providesHeatProtection: true, format: "spray" },
    },
    dry_shampoo: {
      role: "root_refresh_bridge",
      target: { cadenceAdjustment: "keep" },
      spec: {
        primaryEffect: "standard_refresh",
        hairColorFit: "universal",
        scalpSensitivityFit: "sensitive_ok",
        format: "aerosol_spray",
      },
    },
    bondbuilder: {
      role: "specialized_bond_treatment",
      target: {
        requiredFunction: "support_stressed_hair_resilience",
        mechanismTarget: "mechanism_neutral",
      },
      spec: {
        applicationMode: "pre_shampoo",
        treatmentMode: "rinse_out",
        usageProtocol: "verified_course",
        productFormat: "cream",
        relationship: "standalone",
        technologyFamily: "sulfur_targeting_dimaleate",
        claimTrustLevel: "high",
        trustBasis: "owner_anchor",
      },
    },
  } as const
  const config = configurations[category as keyof typeof configurations]
  return base(
    category,
    config.role,
    { category, roles: [config.role], ...config.target },
    { ...config.spec, ...spec },
  )
}
const remainingCategories = [
  "deep_cleansing_shampoo",
  "scalp_care",
  "heat_protectant",
  "dry_shampoo",
  "bondbuilder",
] as const
function fitVerdict(input: Stage3AuthorityInput) {
  const result = evaluateStage3Authority(input)
  return result.status === "known" ? result.verdict : result.status
}
for (const category of remainingCategories) {
  test(`${category}: a wrong role is a hard gate`, () => {
    const input = gateCategory(category)
    input.role = "conditioner_rinse_out"
    assert.equal(fitVerdict(input), "mismatch")
  })
  test(`${category}: all gates pass without a thickness fact`, () => {
    const input = gateCategory(category)
    input.productFacts!.suitableThicknesses = null
    assert.equal(fitVerdict(input), "ideal")
  })
  for (const [gate, change] of [
    ["safety", { knownReaction: true }],
    ["inactive", { isActive: false }],
    ["retired", { lifecycleStatus: "discontinued" }],
    ["wrong category", { category: "shampoo" }],
  ] as const) {
    test(`${category}: ${gate} fails even with missing protocol`, () => {
      const input = gateCategory(category)
      Object.assign(input.productFacts!, change, { protocols: [] })
      assert.equal(fitVerdict(input), "mismatch")
    })
  }
  for (const [gate, change, wireKey] of [
    ["safety", { knownReaction: null }, "known_reaction"],
    ["lifecycle", { lifecycleStatus: null }, "lifecycle_status"],
    [
      "protocol",
      { protocols: [] },
      category === "bondbuilder"
        ? "bondbuilder_fit_or_protocol"
        : category === "deep_cleansing_shampoo"
          ? "deep_cleansing.protocol"
          : "application_protocol",
    ],
  ] as const) {
    test(`${category}: missing ${gate} stays unknown with its wire key`, () => {
      const input = gateCategory(category)
      Object.assign(input.productFacts!, change)
      const result = evaluateStage3Authority(input)
      assert.equal(result.status, "unknown")
      if (result.status !== "unknown") return
      assert.deepEqual(result.missingFacts, [wireKey])
      for (const criterion of result.criteria ?? [])
        assert.deepEqual(Object.keys(criterion).sort(), [
          "criterionId",
          "explanation",
          "label",
          "result",
        ])
    })
  }
}
for (const [category, field, failed, key] of [
  ["deep_cleansing_shampoo", "supportedResetRoles", ["mineral_reset"], "deep_cleansing.reset_role"],
  ["scalp_care", "primaryRole", "density_claim_tonic", "primary_role"],
  ["heat_protectant", "providesHeatProtection", false, "provides_heat_protection"],
  ["bondbuilder", "relationship", "add_on", "bondbuilder_fit_or_protocol"],
  ["bondbuilder", "technologyFamily", "unapproved_technology", "bondbuilder_fit_or_protocol"],
  ["bondbuilder", "trustBasis", "owner_default", "bondbuilder_fit_or_protocol"],
] as const) {
  for (const state of ["pass", "fail", "unknown"] as const) {
    test(`${category}: ${field} ${state}`, () => {
      const input = gateCategory(
        category,
        state === "pass" ? {} : { [field]: state === "fail" ? failed : null },
      )
      const result = evaluateStage3Authority(input)
      assert.equal(
        result.status === "known" ? result.verdict : result.status,
        state === "pass" ? "ideal" : state === "fail" ? "mismatch" : "unknown",
      )
      if (result.status === "unknown") assert.deepEqual(result.missingFacts, [key])
    })
  }
}
for (const [category, field, key] of [
  ["scalp_care", "presentationFormat", "presentation_format"],
  ["scalp_care", "rinseMode", "rinse_mode"],
  ["dry_shampoo", "primaryEffect", "styling_effect"],
  ["dry_shampoo", "format", "format"],
  ["dry_shampoo", "hairColorFit", "hair_color_fit"],
  ["dry_shampoo", "scalpSensitivityFit", "scalp_sensitivity_fit"],
  ["bondbuilder", "applicationMode", "bondbuilder_fit_or_protocol"],
  ["bondbuilder", "treatmentMode", "bondbuilder_fit_or_protocol"],
  ["bondbuilder", "usageProtocol", "bondbuilder_fit_or_protocol"],
] as const) {
  test(`${category}: required ${field} remains unknown`, () => {
    const result = evaluateStage3Authority(gateCategory(category, { [field]: null }))
    assert.equal(result.status, "unknown")
    if (result.status === "unknown") assert.deepEqual(result.missingFacts, [key])
  })
}
for (const row of [
  {
    tint: "universal",
    sensitivity: "sensitive_ok",
    scalp: "sensitive",
    color: "dark",
    verdict: "ideal",
  },
  { tint: "dark", sensitivity: "normal_only", scalp: "normal", color: "dark", verdict: "ideal" },
  {
    tint: "brown",
    sensitivity: "sensitive_ok",
    scalp: "sensitive",
    color: "dark",
    verdict: "supportive",
  },
  {
    tint: "dark",
    sensitivity: "normal_only",
    scalp: "sensitive",
    color: "dark",
    verdict: "supportive",
  },
  {
    tint: "brown",
    sensitivity: "normal_only",
    scalp: "sensitive",
    color: "dark",
    verdict: "mismatch",
  },
  { tint: "dark", sensitivity: "sensitive_ok", scalp: "normal", color: null, verdict: "ideal" },
  { tint: "universal", sensitivity: "normal_only", scalp: null, color: null, verdict: "ideal" },
  { tint: "dark", sensitivity: "normal_only", scalp: null, color: null, verdict: "ideal" },
  {
    tint: "dark",
    sensitivity: "normal_only",
    scalp: "sensitive",
    color: null,
    verdict: "supportive",
  },
] as const) {
  test(`dry_shampoo: tint ${row.tint}, ${row.sensitivity} for ${row.scalp}/${row.color} gives ${row.verdict}`, () => {
    const input = gateCategory("dry_shampoo", {
      hairColorFit: row.tint,
      scalpSensitivityFit: row.sensitivity,
    }) as any
    input.dryShampooTarget = { scalpSensitivity: row.scalp, hairColorFit: row.color }
    const result = evaluateStage3Authority(input)
    assert.equal(result.status === "known" ? result.verdict : result.status, row.verdict)
    if (result.status === "known") {
      const cautions = result.criteria.filter((c) => c.result === "caution")
      if (row.verdict === "supportive") assert.equal(cautions.length, 1)
      if (row.color === null) {
        assert.ok(cautions.every((c) => c.criterionId !== "dry_shampoo.tint.verified"))
        if (row.scalp === "sensitive")
          assert.match(cautions[0]!.explanation, /Sensitivitätspositionierung.*Kopfhaut/)
      }
      if (row.scalp === null && row.color === null) assert.deepEqual(cautions, [])
    }
  })
}
test("dry_shampoo: ideal wins, supportive is a reasoned fallback, catalog order stays stable", () => {
  const input = gateCategory("dry_shampoo") as any
  input.dryShampooTarget = { scalpSensitivity: "sensitive", hairColorFit: "dark" }
  input.capturedProductId = null
  input.subjectIdentity = null
  input.productFacts = null
  const near = {
    ...gateCategory("dry_shampoo", { scalpSensitivityFit: "normal_only" }).productFacts!,
    productId: "near",
  }
  const exact = { ...gateCategory("dry_shampoo").productFacts!, productId: "exact" }
  input.recommendationCandidates = [near, exact]
  let result = evaluateStage3Authority(input)
  assert.equal(result.status === "known" ? result.recommendation?.productId : null, "exact")
  input.recommendationCandidates = [near]
  result = evaluateStage3Authority(input)
  assert.equal(result.status === "known" ? result.verdict : null, "supportive")
  assert.ok(result.status === "known" && result.recommendation?.reason)
})
test("bondbuilder: trust then price; add-ons never supportive or standalone candidates; no preferred-step filter", () => {
  const input = gateCategory("bondbuilder") as any
  input.capturedProductId = null
  input.subjectIdentity = null
  input.productFacts = null
  input.recommendationCandidates = [
    {
      ...gateCategory("bondbuilder", { claimTrustLevel: "medium", trustBasis: "owner_calibration" })
        .productFacts!,
      productId: "cheap-medium",
      priceEur: 1,
    },
    {
      ...gateCategory("bondbuilder").productFacts!,
      productId: "expensive-high",
      priceEur: 50,
      catalogSortOrder: 1,
    },
    {
      ...gateCategory("bondbuilder").productFacts!,
      productId: "cheap-high",
      priceEur: 20,
      catalogSortOrder: 99,
    },
    {
      ...gateCategory("bondbuilder", { relationship: "add_on" }).productFacts!,
      productId: "companion",
      priceEur: 0,
    },
  ]
  const result = evaluateStage3Authority(input)
  assert.equal(result.status === "known" ? result.recommendation?.productId : null, "cheap-high")
  for (const relationship of ["standalone", "add_on", null]) {
    const owned = evaluateStage3Authority(gateCategory("bondbuilder", { relationship }))
    assert.notEqual(owned.status === "known" ? owned.verdict : owned.status, "supportive")
  }
})
for (const [category, create] of [
  ["shampoo", shampoo],
  ["conditioner", conditioner],
  ["oil", oil],
  ["mask", mask],
  ["leave_in", leaveIn],
  ...remainingCategories.map(
    (category) =>
      [category, (spec: Record<string, unknown>) => gateCategory(category, spec)] as const,
  ),
] as const) {
  for (const withCandidate of [false, true]) {
    test(`${category}: identical mismatch actions ${withCandidate ? "with" : "without"} recommendation`, () => {
      const input = create({})
      input.productFacts!.knownReaction = true
      if (withCandidate)
        input.recommendationCandidates = [
          {
            ...create({}).productFacts!,
            productId: "replacement",
            presentationImageUrl: "https://example.com/p.webp",
          },
        ] as never
      const result = evaluateStage3Authority(input)
      assert.equal(result.status === "known" ? result.verdict : null, "mismatch")
      assert.deepEqual(
        [...result.allowedActions].sort(),
        [
          "acknowledge_override",
          "leave_uncovered",
          ...(withCandidate ? ["plan_recommendation"] : []),
        ].sort(),
      )
      if (result.status === "known")
        assert.equal(result.recommendation?.productId ?? null, withCandidate ? "replacement" : null)
    })
  }
}

// Missing user targets are unscored; missing product facts still require verification.
test("dry_shampoo: absent personal targets skip tint and scalp scoring", () => {
  const unresolved = gateCategory("dry_shampoo", { hairColorFit: "dark" })
  const result = evaluateStage3Authority(unresolved)
  assert.equal(result.status, "known")
  if (result.status === "known") {
    assert.equal(result.verdict, "ideal")
    assert.ok(result.criteria.every((row) => row.result === "pass"))
  }
  assert.equal(fitVerdict(gateCategory("dry_shampoo", { hairColorFit: "universal" })), "ideal")
})

// A two-step weight mismatch must not erase independent passing gates or axes.
for (const [category, create, passingAxes] of [
  ["shampoo", shampoo, ["shampoo.thickness"]],
  [
    "conditioner",
    conditioner,
    ["conditioner.thickness", "conditioner.balance", "conditioner.repair"],
  ],
  [
    "leave_in",
    leaveIn,
    ["leave_in.thickness", "leave_in.care_direction", "leave_in.repair_support"],
  ],
  ["mask", mask, ["mask.thickness", "mask.care_direction", "mask.repair_support"]],
  ["oil", oil, ["oil.thickness", "oil.role"]],
] as const) {
  test(`${category}: mismatch retains passing criteria exactly once in stable order`, () => {
    const matching = create({})
    const mismatch = create(
      category === "shampoo"
        ? { cleansingIntensity: "gentle", thicknesses: ["fine"] }
        : { weight: "light" },
    )
    // Shampoo uses a failed scalp gate here so the thickness axis can still pass.
    if (category === "shampoo")
      mismatch.productFacts = {
        ...matching.productFacts!,
        spec: { ...matching.productFacts!.spec, scalpRoute: "dry" },
      } as typeof mismatch.productFacts
    const result = evaluateStage3Authority(mismatch)
    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(result.verdict, "mismatch")
    for (const id of [`${category}.safety`, `${category}.lifecycle`, ...passingAxes]) {
      assert.equal(result.criteria.filter((row) => row.criterionId === id).length, 1, id)
      assert.equal(result.criteria.find((row) => row.criterionId === id)?.result, "pass", id)
    }
    assert.equal(
      new Set(result.criteria.map((row) => row.criterionId)).size,
      result.criteria.length,
    )
    const ideal = evaluateStage3Authority(matching)
    assert.equal(ideal.status, "known")
    if (ideal.status === "known") {
      const ids = new Set(result.criteria.map((row) => row.criterionId))
      assert.deepEqual(
        ideal.criteria.filter((row) => ids.has(row.criterionId)).map((row) => row.criterionId),
        result.criteria.map((row) => row.criterionId),
      )
    }
  })
}

test("mismatch passing axes render green in the real plan comparison and scanner", () => {
  const input = conditioner({ weight: "light" })
  const evaluation = evaluateStage3Authority(input)
  const comparison = buildStage3FitComparison(input, evaluation)
  const thickness = comparison.evidenceRows!.find(
    (row) => row.rowId === "conditioner.suitable_thicknesses",
  )!
  assert.equal(
    thickness.productValues.find((value) => value.productId === "owned")?.relation,
    "in_target",
  )
  const plan = renderToStaticMarkup(
    React.createElement(ProductFitComparison, {
      comparison,
      evaluation,
      displayedAlternativeIndex: 0,
      onDisplayedAlternativeChange: () => {},
      onAction: () => {},
      onBack: () => {},
    }),
  )
  const thicknessRow = plan
    .match(/<tr[\s\S]*?<\/tr>/g)
    ?.find((row) => row.includes("Geeignete Haardicke"))
  assert.ok(thicknessRow)
  assert.match(thicknessRow, /status-ok-text/)
  assert.match(thicknessRow, /Im Ziel/)
  const scan = buildScanVerdict({
    category: input.category,
    decision: input.categoryDecision,
    productFacts: input.productFacts,
    recommendationCandidates: [],
    coverage: [],
    hairThickness: input.hairThickness!,
    heatCarrierCoverage: input.heatCarrierCoverage,
    refinedVersionId: input.refinedVersionId,
    refinedInputHash: input.refinedInputHash,
  })
  assert.equal(scan.kind, "in_catalog")
  if (scan.kind !== "in_catalog") return
  assert.equal(scan.verdict, "mismatch")
  assert.equal(
    scan.dimensions.find((row) => row.dimensionId === "conditioner.suitable_thicknesses")?.state,
    "in_target",
  )
  const markup = renderToStaticMarkup(
    React.createElement(ScanVerdictSections, {
      result: {
        ...scan,
        product: {
          productId: "owned",
          name: "Produkt",
          brand: null,
          category: "conditioner",
          categoryLabel: "Conditioner",
          imageUrl: null,
          priceLabel: null,
          purchaseUrl: null,
        },
      },
    }),
  )
  assert.match(markup, /Geeignete Haardicke<\/p><p[^>]*status-ok-text[^>]*>✓ dick/)
})

for (const category of remainingCategories) {
  test(`${category}: gate-only transport retains independent passes on a safety mismatch`, () => {
    const input = gateCategory(category)
    input.productFacts!.knownReaction = true
    const result = evaluateStage3Authority(input)
    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(result.verdict, "mismatch")
    const prefix = category === "deep_cleansing_shampoo" ? "deep_cleansing" : category
    assert.equal(
      result.criteria.find((row) => row.criterionId === `${prefix}.safety`)?.result,
      "fail",
    )
    for (const suffix of ["lifecycle", "category", "role"]) {
      assert.equal(
        result.criteria.find((row) => row.criterionId === `${prefix}.${suffix}`)?.result,
        "pass",
      )
    }
    assert.equal(
      new Set(result.criteria.map((row) => row.criterionId)).size,
      result.criteria.length,
    )
  })
}

// Lifecycle describes usability; recommendation admission is an independent catalog policy.
const categoryFactories = [
  ["shampoo", shampoo],
  ["conditioner", conditioner],
  ["oil", oil],
  ["mask", mask],
  ["leave_in", leaveIn],
  ...remainingCategories.map(
    (category) =>
      [category, (spec: Record<string, unknown>) => gateCategory(category, spec)] as const,
  ),
] as const
for (const [category, create] of categoryFactories) {
  test(`${category}: active non-recommended products fit owned and scanned, but cannot be picked`, () => {
    const input = create({})
    input.productFacts!.recommendable = false
    assert.equal(fitVerdict(input), "ideal", "owned product")
    const scan = buildScanVerdict({
      category: input.category,
      decision: input.categoryDecision,
      productFacts: input.productFacts,
      recommendationCandidates: [],
      coverage: [],
      hairThickness: input.hairThickness!,
      heatCarrierCoverage: input.heatCarrierCoverage,
      refinedVersionId: input.refinedVersionId,
      refinedInputHash: input.refinedInputHash,
    })
    assert.equal(scan.kind, "in_catalog")
    if (scan.kind === "in_catalog") assert.equal(scan.verdict, "ideal", "scanned product")
    const nonRecommended = input.productFacts!
    input.productFacts = null
    input.capturedProductId = null
    input.subjectIdentity = null
    input.recommendationCandidates = [nonRecommended] as never
    const pick = evaluateStage3Authority(input)
    assert.equal(pick.status === "known" ? pick.recommendation : null, null)
    const comparison = buildStage3FitComparison(input, pick)
    assert.equal(
      comparison.products.filter((product) => product.source === "alternative").length,
      0,
    )
  })
}
for (const [heat, state] of [
  [true, "pass"],
  [false, "fail"],
  [null, "unknown"],
] as const) {
  test(`oil: informational heat protection ${heat} renders without changing fit`, () => {
    const input = oil({ providesHeatProtection: heat })
    input.coverage = [{ job: "heat_protection" }] as never
    const evaluation = evaluateStage3Authority(input)
    assert.equal(fitVerdict(input), "ideal")
    assert.equal(
      evaluation.status === "known"
        ? evaluation.criteria.find((row) => row.criterionId === "oil.heat_protection")?.result
        : null,
      state,
    )
    const comparison = buildStage3FitComparison(input, evaluation)
    assert.equal(
      comparison.evidenceRows!.find((row) => row.rowId === "oil.heat_protection")!.productValues[0]
        .relation,
      heat === true ? "in_target" : heat === false ? "outside_target" : "unknown",
    )
    const scan = buildScanVerdict({
      category: input.category,
      decision: input.categoryDecision,
      productFacts: input.productFacts,
      recommendationCandidates: [],
      coverage: input.coverage,
      hairThickness: input.hairThickness!,
      heatCarrierCoverage: input.heatCarrierCoverage,
      refinedVersionId: input.refinedVersionId,
      refinedInputHash: input.refinedInputHash,
    })
    assert.equal(scan.kind, "in_catalog")
    if (scan.kind === "in_catalog") {
      assert.equal(scan.verdict, "ideal")
      assert.equal(
        scan.dimensions.find((row) => row.dimensionId === "oil.heat_protection")?.state,
        heat === true ? "in_target" : heat === false ? "outside_target" : "unknown",
      )
    }
    const miss = oil({ providesHeatProtection: heat, weight: "medium" })
    miss.coverage = input.coverage
    assert.equal(fitVerdict(miss), "supportive", "heat capability does not add steps")
  })
}
test("every emitted comparison row has authority evidence, including conditional rows", () => {
  for (const [category, create] of categoryFactories) {
    const inputs = [create({})]
    if (category === "oil") inputs[0].coverage = [{ job: "heat_protection" }] as never
    if (category === "leave_in") {
      const preHeat = leaveIn({
        roles: ["pre_heat_application"],
        applicationStages: ["pre_heat"],
        providesHeatProtection: true,
      })
      preHeat.role = "pre_heat_application"
      preHeat.productFacts!.protocols[0].role = preHeat.role
      inputs.push(preHeat)
    }
    if (category === "bondbuilder")
      inputs.push(gateCategory("bondbuilder", { relationship: "add_on" }))
    for (const input of inputs) {
      const evaluation = evaluateStage3Authority(input)
      assert.equal(evaluation.status, "known")
      if (evaluation.status !== "known") continue
      const comparison = buildStage3FitComparison(input, evaluation)
      for (const row of comparison.dimensions)
        assert.ok(
          evaluation.criteria.some(
            (criterion) => criterion.criterionId === criterionIdForDimension(row.dimensionId),
          ),
          row.dimensionId,
        )
    }
  }
})

for (const [category, create] of [
  ["mask", mask],
  ["leave_in", leaveIn],
] as const) {
  test(`${category}: comparison includes the scored thickness row`, () => {
    const input = create({})
    const comparison = buildStage3FitComparison(input, evaluateStage3Authority(input))
    assert.equal(comparison.dimensions.length, 4)
    const row = comparison.evidenceRows!.find(
      (row) => row.rowId === `${category}.suitable_thicknesses`,
    )!
    assert.ok(row)
    assert.equal(row.productValues[0].relation, "in_target")
  })
}
test("oil: the comparison target shows every accepted leave-on weight", () => {
  const input = oil({ weight: "medium" }) as any
  input.categoryDecision.target.roleTargets[0].acceptedTargets = ["rich", "medium"]
  const comparison = buildStage3FitComparison(input, evaluateStage3Authority(input))
  assert.equal(fitVerdict(input), "ideal")
  assert.deepEqual(
    comparison.dimensions.find((row) => row.dimensionId === "oil.weight")!.targetPosition,
    { kind: "supported_stops", stopIds: ["rich", "medium"] },
  )
})
