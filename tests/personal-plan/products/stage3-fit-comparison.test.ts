import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import { stage3AuthorityFactFingerprint } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  PersonalPlanCategory,
  Stage3FitVerdict,
} from "../../../src/lib/personal-plan/products/contracts"
import {
  buildStage3FitComparison,
  findStage3SelectedComparisonCandidate,
  stage3CriterionEvidenceRelation,
  STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT,
} from "../../../src/lib/personal-plan/products/fit-comparison"
import type { PlanProductRole } from "../../../src/lib/personal-plan/types"

const RICH_COMPARISON_CATEGORY_ROLES = new Set<string>([
  "shampoo/shampoo_everyday",
  "conditioner/conditioner_rinse_out",
  "leave_in/post_wash_leave_in",
  "leave_in/pre_heat_application",
  "oil/pre_wash_fibre_treatment",
  "oil/leave_on_fibre_conditioning",
  "oil/dry_finish",
  "mask/intensive_conditioning_mask",
])

const CORE_CATEGORIES = new Set<PersonalPlanCategory>(["conditioner", "leave_in", "oil", "mask"])

const SPECIALIST_CATEGORIES = new Set<PersonalPlanCategory>([
  "heat_protectant",
  "scalp_care",
  "dry_shampoo",
  "bondbuilder",
  "deep_cleansing_shampoo",
])

test("criterion evidence preserves pass, caution, fail, and unknown as distinct relations", () => {
  assert.equal(stage3CriterionEvidenceRelation("pass"), "in_target")
  assert.equal(stage3CriterionEvidenceRelation("caution"), "supportive")
  assert.equal(stage3CriterionEvidenceRelation("fail"), "outside_target")
  assert.equal(stage3CriterionEvidenceRelation("unknown"), "unknown")
  assert.equal(stage3CriterionEvidenceRelation(undefined), "unknown")
})

for (const category of Object.keys(CATEGORY_ROLE_POLICIES) as PersonalPlanCategory[]) {
  for (const role of CATEGORY_ROLE_POLICIES[category].allowedRoles) {
    test(`${category}/${role} builds a bounded exact comparison contract`, () => {
      const input = authorityInput(category, role, {
        productFacts: factsFor(category, role, "owned", { recommendable: false }),
        candidates: [
          factsFor(category, role, "alternative-1", { sortOrder: 1 }),
          factsFor(category, role, "alternative-2", { sortOrder: 2 }),
        ],
      })

      const comparison = buildStage3FitComparison(input)

      assert.equal(comparison.category, category)
      assert.equal(comparison.role, role)
      assert.equal(comparison.subjectKey, subjectKey(category, role))
      assert.ok(comparison.products.length >= 1)
      assert.ok(comparison.products.length <= STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT + 1)
      assert.ok(comparison.alternatives.length <= STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT)
      assert.ok(comparison.dimensions.length <= 3)
      assert.ok(comparison.evidenceRows!.length > 0)
      assert.ok(comparison.evidenceRows!.length <= 4)
      assert.ok(
        comparison.evidenceRows!.every(
          (row) => row.target === null || row.target.profileEvidenceLabels.length <= 2,
        ),
      )
      assert.ok(
        comparison
          .evidenceRows!.flatMap((row) => row.productValues)
          .every((value) =>
            ["in_target", "supportive", "outside_target", "unknown", "no_target"].includes(
              value.relation,
            ),
          ),
      )
      assert.equal(comparison.products[0]?.productId, "owned")
      assert.equal(comparison.products[0]?.source, "current")
      assert.equal(
        comparison.products[0]?.presentationImageUrl,
        "https://example.com/presentation-only.jpg",
      )
      if (comparison.products[1]) {
        assert.equal(
          comparison.products[1].presentationImageUrl,
          "https://example.com/alternative-1.jpg",
        )
      }
      assert.ok(comparison.alternatives.every((candidate) => candidate.productId !== "owned"))
      assert.ok(comparison.alternatives.length > 0, `${category}/${role} needs an alternative`)
      assert.ok(
        comparison.alternatives.every(
          (candidate) => candidate.verdict === "ideal" || candidate.verdict === "supportive",
        ),
      )
      assert.ok(
        comparison.alternatives.every(
          (candidate) =>
            candidate.recommendation.productId === candidate.productId &&
            candidate.recommendation.role === role,
        ),
      )
      assert.ok(
        comparison.alternatives.every((candidate) =>
          comparison.evidenceRows?.some(
            (row) =>
              row.target !== null &&
              row.productValues.some(
                (value) =>
                  value.productId === candidate.productId && value.relation === "in_target",
              ),
          ),
        ),
        `${category}/${role} must not transport a zero-target-match alternative`,
      )
      assertNoRawFactsOrPresentationFields(comparison)
      assertPayloadFits(comparison)

      if (RICH_COMPARISON_CATEGORY_ROLES.has(`${category}/${role}`)) {
        assert.equal(comparison.mode, "comparison")
        assert.ok(comparison.dimensions.length > 0)
      } else {
        assert.equal(comparison.mode, "compact")
        assert.deepEqual(comparison.dimensions, [])
      }
    })

    test(`${category}/${role} carries only an adapter-authorized exact uncovered-role candidate`, () => {
      const comparison = buildStage3FitComparison(
        authorityInput(category, role, {
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
          candidates: [factsFor(category, role, "uncovered-candidate")],
        }),
      )

      assert.ok(comparison.alternatives.every((candidate) => candidate.verdict === "ideal"))
      assert.ok(
        comparison.alternatives.every((candidate) =>
          candidate.criteria.every(
            (criterion) => criterion.result !== "fail" && criterion.result !== "unknown",
          ),
        ),
      )
      assert.ok(
        comparison.alternatives.every(
          (candidate) =>
            candidate.recommendation.productId === candidate.productId &&
            candidate.recommendation.role === role,
        ),
      )
    })
  }
}

test("supported uncovered-role fixtures expose three exact selectable candidates", () => {
  const coverage = [] as Array<{ targetKey: string; candidateCount: number }>

  for (const category of Object.keys(CATEGORY_ROLE_POLICIES) as PersonalPlanCategory[]) {
    for (const role of CATEGORY_ROLE_POLICIES[category].allowedRoles) {
      const comparison = buildStage3FitComparison(
        authorityInput(category, role, {
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
          candidates: [1, 2, 3].map((index) =>
            factsFor(category, role, `coverage-${category}-${role}-${index}`, {
              sortOrder: index,
            }),
          ),
        }),
      )

      coverage.push({
        targetKey: `${category}/${role}`,
        candidateCount: comparison.alternatives.length,
      })
    }
  }

  const failingTargets = coverage.filter(({ candidateCount }) => candidateCount !== 3)
  assert.deepEqual(
    failingTargets,
    [],
    `uncovered launch coverage gaps: ${JSON.stringify(failingTargets)}`,
  )
})

test("comparison orders current product first, then current recommendation, ideal, supportive, sort order, product ID", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      fingerprint: "facts-owned",
      recommendable: false,
      weight: "rich",
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "owned", {
        fingerprint: "facts-owned-duplicate",
        sortOrder: 0,
      }),
      factsFor("conditioner", "conditioner_rinse_out", "supportive-sort-1", {
        fingerprint: "facts-supportive-1",
        sortOrder: 1,
        weight: "medium",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "supportive-sort-2", {
        fingerprint: "facts-supportive-2",
        sortOrder: 2,
        weight: "medium",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "inactive", {
        isActive: false,
        sortOrder: 3,
      }),
      factsFor("conditioner", "conditioner_rinse_out", "mismatch", {
        sortOrder: 4,
        weight: "rich",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "ideal-b", {
        fingerprint: "facts-ideal-b",
        sortOrder: 5,
      }),
      factsFor("conditioner", "conditioner_rinse_out", "ideal-a", {
        fingerprint: "facts-ideal-a",
        sortOrder: 5,
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.equal(comparison.mode, "comparison")
  assert.deepEqual(
    comparison.products.map((product) => product.productId),
    ["owned", "ideal-a", "ideal-b", "supportive-sort-1"],
  )
  assert.deepEqual(
    comparison.alternatives.map((alternative) => alternative.factFingerprint),
    ["facts-ideal-a", "facts-ideal-b", "facts-supportive-1"],
  )
})

test("selected candidate lookup returns exact current data for alternative number three", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      recommendable: false,
      weight: "rich",
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "ideal-1", { sortOrder: 1 }),
      factsFor("conditioner", "conditioner_rinse_out", "ideal-2", { sortOrder: 2 }),
      factsFor("conditioner", "conditioner_rinse_out", "supportive-3", {
        fingerprint: "facts-supportive-3",
        sortOrder: 3,
        weight: "medium",
      }),
    ],
  })

  const selected = findStage3SelectedComparisonCandidate(input, "supportive-3")

  assert.ok(selected)
  assert.equal(selected.productId, "supportive-3")
  assert.equal(selected.factFingerprint, "facts-supportive-3")
  assert.equal(selected.verdict, "supportive")
  assert.equal(selected.recommendation.productId, "supportive-3")
  assert.equal(selected.recommendation.role, "conditioner_rinse_out")
  assert.ok(selected.criteria.length > 0)
  assert.equal(findStage3SelectedComparisonCandidate(input, "owned"), null)
  assert.deepEqual(Object.keys(selected).sort(), [
    "category",
    "criteria",
    "factFingerprint",
    "productId",
    "recommendation",
    "role",
    "verdict",
  ])
})

for (const [category, role] of [
  ["conditioner", "conditioner_rinse_out"],
  ["leave_in", "post_wash_leave_in"],
] as const) {
  test(`${category}/${role} retains an adapter-authorized supportive uncovered recommendation`, () => {
    const input = authorityInput(category, role, {
      productFacts: null,
      capturedProductId: null,
      subjectIdentity: null,
      candidates: [
        factsFor(category, role, "supportive-uncovered", {
          fingerprint: `facts-${category}-supportive-uncovered`,
          sortOrder: 1,
          weight: "medium",
        }),
      ],
    })

    const comparison = buildStage3FitComparison(input)
    const selected = findStage3SelectedComparisonCandidate(input, "supportive-uncovered")

    assert.deepEqual(
      comparison.alternatives.map((candidate) => [candidate.productId, candidate.verdict]),
      [["supportive-uncovered", "supportive"]],
    )
    assert.equal(selected?.recommendation.productId, "supportive-uncovered")
    assert.equal(selected?.recommendation.role, role)
    assert.equal(selected?.factFingerprint, `facts-${category}-supportive-uncovered`)
  })
}

test("uncovered roles rank the authority recommendation before ideal, supportive, and catalog order", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: null,
    capturedProductId: null,
    subjectIdentity: null,
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "supportive-1", {
        sortOrder: 1,
        weight: "medium",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "supportive-2", {
        sortOrder: 2,
        weight: "medium",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "supportive-3", {
        sortOrder: 3,
        weight: "medium",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "ideal-after-supportive", {
        sortOrder: 9,
        weight: "light",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.deepEqual(
    comparison.alternatives.map((candidate) => [candidate.productId, candidate.verdict]),
    [
      ["ideal-after-supportive", "ideal"],
      ["supportive-1", "supportive"],
      ["supportive-2", "supportive"],
    ],
  )
  assert.equal(
    findStage3SelectedComparisonCandidate(input, "supportive-1")?.productId,
    "supportive-1",
  )
})

test("comparison projects fresh price and structured size without changing authority facts", () => {
  const checkedAt = new Date(Date.now() - 60_000).toISOString()
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      recommendable: false,
      priceEur: 4.29,
      priceCheckedAt: checkedAt,
      netContentValue: 300,
      netContentUnit: "ml",
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "candidate", {
        priceEur: 13.01,
        priceCheckedAt: checkedAt,
        netContentValue: 250,
        netContentUnit: "ml",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)
  assert.deepEqual(
    comparison.products.map((product) => product.presentation),
    [
      { netContentLabel: "300 ml", priceLabel: "4,29 €" },
      { netContentLabel: "250 ml", priceLabel: "13,01 €" },
    ],
  )
  const common = {
    productId: "presentation-only",
    displayName: "Produkt",
    category: "conditioner" as const,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["fine"],
    knownReaction: false,
    protocols: [],
  }
  assert.equal(
    stage3AuthorityFactFingerprint({
      common: {
        ...common,
        priceEur: 4.29,
        priceCheckedAt: checkedAt,
        netContentValue: 300,
        netContentUnit: "ml",
      },
      spec: { weight: "light" },
    }),
    stage3AuthorityFactFingerprint({
      common: {
        ...common,
        priceEur: 99.99,
        priceCheckedAt: "2000-01-01T00:00:00.000Z",
        netContentValue: 999,
        netContentUnit: "g",
      },
      spec: { weight: "light" },
    }),
  )
})

test("comparison omits stale or incomplete commerce presentation metadata", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      recommendable: false,
      priceCheckedAt: "2000-01-01T00:00:00.000Z",
      netContentValue: null,
      netContentUnit: null,
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "candidate", {
        priceCheckedAt: null,
        netContentValue: null,
        netContentUnit: null,
      }),
    ],
  })
  const comparison = buildStage3FitComparison(input)
  assert.deepEqual(
    comparison.products.map((product) => product.presentation),
    [
      { priceLabel: null, netContentLabel: null },
      { priceLabel: null, netContentLabel: null },
    ],
  )
})

test("selected candidate lookup rejects eligible candidates outside the transported allowlist", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      recommendable: false,
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "candidate-1", { sortOrder: 1 }),
      factsFor("conditioner", "conditioner_rinse_out", "candidate-2", { sortOrder: 2 }),
      factsFor("conditioner", "conditioner_rinse_out", "candidate-3", { sortOrder: 3 }),
      factsFor("conditioner", "conditioner_rinse_out", "candidate-4", { sortOrder: 4 }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.deepEqual(
    comparison.alternatives.map((candidate) => candidate.productId),
    ["candidate-1", "candidate-2", "candidate-3"],
  )
  assert.equal(findStage3SelectedComparisonCandidate(input, "candidate-4"), null)
})

test("Deep Cleansing preserves the exact mineral-reset role in selectable recommendations", () => {
  const input = authorityInput("deep_cleansing_shampoo", "mineral_reset", {
    productFacts: factsFor("deep_cleansing_shampoo", "mineral_reset", "owned", {
      recommendable: false,
    }),
    candidates: [
      factsFor("deep_cleansing_shampoo", "mineral_reset", "mineral-alternative", {
        sortOrder: 1,
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.deepEqual(
    comparison.alternatives.map((candidate) => [
      candidate.productId,
      candidate.recommendation.role,
    ]),
    [["mineral-alternative", "mineral_reset"]],
  )
  assert.equal(
    findStage3SelectedComparisonCandidate(input, "mineral-alternative")?.recommendation.role,
    "mineral_reset",
  )
  assert.equal(
    findStage3SelectedComparisonCandidate(input, "mineral-alternative")?.recommendation
      .recommendationId,
    "recommendation:deep-cleansing:mineral_reset:mineral-alternative",
  )
})

test("pending identity can only compare against verified exact alternatives", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: null,
    subjectIdentity: {
      kind: "pending_submission",
      submissionId: "submission-1",
      displayName: "Noch in Pruefung",
      category: "conditioner",
      reviewStatus: "pending_review",
      imageUrl: "https://example.com/pending.jpg",
    },
    capturedProductId: "pending-captured",
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "verified-alternative", {
        sortOrder: 1,
      }),
      factsFor("conditioner", "conditioner_rinse_out", "missing-facts", {
        sortOrder: 2,
        weight: null,
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.equal(comparison.sourceIdentity?.kind, "pending_submission")
  assert.equal(comparison.sourceIdentity?.displayName, "Noch in Pruefung")
  assert.deepEqual(
    comparison.products.map((product) => product.productId),
    ["verified-alternative"],
  )
  assert.deepEqual(
    comparison.alternatives.map((candidate) => candidate.productId),
    ["verified-alternative"],
  )
  assertNoRawFactsOrPresentationFields(comparison)
})

test("Shampoo comparison always projects the complete confirmed target matrix", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      cleansingIntensity: "regular",
    }),
    candidates: [
      factsFor("shampoo", "shampoo_everyday", "candidate", {
        cleansingIntensity: "clarifying",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.equal(comparison.mode, "comparison")
  const cleansing = comparison.dimensions.find(
    (dimension) => dimension.dimensionId === "shampoo.cleansing_intensity",
  )
  assert.ok(cleansing)
  assert.equal(cleansing.presentationKind, "ordered")
  assert.deepEqual(
    cleansing.stops.map((stop) => stop.stopId),
    ["gentle", "regular", "clarifying"],
  )
  assert.deepEqual(cleansing.targetPosition, { kind: "position", stopId: "regular" })
  assert.deepEqual(cleansing.productPositions, [
    { productId: "owned", position: { kind: "position", stopId: "regular" } },
    { productId: "candidate", position: { kind: "position", stopId: "clarifying" } },
  ])
  const cleansingEvidence = comparison.evidenceRows!.find(
    (row) => row.rowId === "shampoo.cleansing_intensity",
  )
  assert.ok(cleansingEvidence)
  assert.equal(cleansingEvidence.target?.valueLabel, "regulär")
  assert.deepEqual(
    cleansingEvidence.productValues.map(({ productId, valueLabel, relation }) => ({
      productId,
      valueLabel,
      relation,
    })),
    [
      { productId: "owned", valueLabel: "regulär", relation: "in_target" },
      { productId: "candidate", valueLabel: "klärend", relation: "supportive" },
    ],
  )
})

test("complete Shampoo comparison projects all three signed targets in catalogue vocabulary", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      cleansingIntensity: "regular",
      shampooBucket: "irritationen",
      scalpRoute: "irritated",
    }),
    candidates: [
      factsFor("shampoo", "shampoo_everyday", "candidate", {
        cleansingIntensity: "gentle",
        shampooBucket: "irritationen",
        scalpRoute: "irritated",
        suitableThicknesses: ["normal"],
      }),
    ],
  })
  input.categoryDecision.target = {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: "balanced",
    everydayConstraint: "irritation_compatible",
    requiresTargetedDandruffCapability: false,
  }

  const comparison = buildStage3FitComparison(input)

  assert.equal(comparison.mode, "comparison")
  assert.deepEqual(
    comparison.evidenceRows?.map((row) => [row.rowId, row.target?.valueLabel]),
    [
      ["shampoo.cleansing_intensity", "sanft"],
      ["shampoo.scalp_route", "gereizt"],
      ["shampoo.suitable_thicknesses", "mittel"],
    ],
  )
  assert.deepEqual(
    comparison.alternatives.map((candidate) => candidate.productId),
    ["candidate"],
  )
})

test("Shampoo cleansing evidence marks a displayed two-step intensity gap outside target", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      cleansingIntensity: "clarifying",
      shampooBucket: "irritationen",
      scalpRoute: "irritated",
    }),
    candidates: [],
  })
  input.categoryDecision.target = {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: "balanced",
    everydayConstraint: "irritation_compatible",
    requiresTargetedDandruffCapability: false,
  }

  const cleansing = buildStage3FitComparison(input).evidenceRows?.find(
    (row) => row.rowId === "shampoo.cleansing_intensity",
  )

  assert.deepEqual(cleansing?.productValues, [
    { productId: "owned", valueLabel: "klärend", relation: "outside_target" },
  ])
})

test("Shampoo cleansing marker follows the displayed observation instead of the authority spec", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      cleansingIntensity: "regular",
      shampooObservations: {
        cleansingIntensity: "gentle",
        supportedScalpRoutes: ["balanced"],
      },
    }),
    candidates: [],
  })

  const cleansing = buildStage3FitComparison(input).evidenceRows?.find(
    (row) => row.rowId === "shampoo.cleansing_intensity",
  )

  assert.deepEqual(cleansing?.productValues, [
    { productId: "owned", valueLabel: "sanft", relation: "supportive" },
  ])
})

for (const scenario of [
  {
    name: "Shampoo",
    category: "shampoo" as const,
    role: "shampoo_everyday" as const,
    overrides: { cleansingIntensity: "gentle" },
    authorityRuleId: "shampoo.selection.verified_supportive_intensity",
  },
  {
    name: "Mask",
    category: "mask" as const,
    role: "intensive_conditioning_mask" as const,
    overrides: { weight: "rich" },
    authorityRuleId: "mask.stage3.validated_supportive_candidate",
  },
  {
    name: "Oil",
    category: "oil" as const,
    role: "dry_finish" as const,
    overrides: { weight: "medium" },
    authorityRuleId: "oil.recommendation.role_verified_supportive_weight",
  },
  {
    name: "Bondbuilder",
    category: "bondbuilder" as const,
    role: "specialized_bond_treatment" as const,
    overrides: { relationship: "add_on" as const },
    authorityRuleId: "bondbuilder.stage3.validated_add_on",
  },
]) {
  test(`complete comparison authorizes a truthful supportive owned ${scenario.name} alternative`, () => {
    const input = authorityInput(scenario.category, scenario.role, {
      productFacts: factsFor(scenario.category, scenario.role, "owned", {
        recommendable: false,
      }),
      candidates: [
        factsFor(scenario.category, scenario.role, "supportive-candidate", scenario.overrides),
      ],
    })

    const comparison = buildStage3FitComparison(input)
    const selected = findStage3SelectedComparisonCandidate(input, "supportive-candidate")

    assert.deepEqual(
      comparison.alternatives.map((candidate) => [candidate.productId, candidate.verdict]),
      [["supportive-candidate", "supportive"]],
    )
    assert.equal(selected?.recommendation.productId, "supportive-candidate")
    assert.equal(selected?.recommendation.role, scenario.role)
    assert.equal(selected?.recommendation.authorityRuleId, scenario.authorityRuleId)
  })

  test(`uncovered ${scenario.name} remains strict for the same supportive candidate`, () => {
    const input = authorityInput(scenario.category, scenario.role, {
      productFacts: null,
      capturedProductId: null,
      subjectIdentity: null,
      candidates: [
        factsFor(scenario.category, scenario.role, "supportive-candidate", scenario.overrides),
      ],
    })

    assert.deepEqual(buildStage3FitComparison(input).alternatives, [])
    assert.equal(findStage3SelectedComparisonCandidate(input, "supportive-candidate"), null)
  })
}

test("complete comparison excludes a two-step Oil weight gap from supportive alternatives", () => {
  const input = authorityInput("oil", "dry_finish", {
    productFacts: factsFor("oil", "dry_finish", "owned", { recommendable: false }),
    candidates: [
      factsFor("oil", "dry_finish", "far-weight-candidate", {
        weight: "rich",
      }),
    ],
  })

  assert.deepEqual(buildStage3FitComparison(input).alternatives, [])
  assert.equal(findStage3SelectedComparisonCandidate(input, "far-weight-candidate"), null)
})

for (const scenario of [
  {
    name: "Mask",
    category: "mask" as const,
    role: "intensive_conditioning_mask" as const,
    overrides: { weight: "medium" },
  },
  {
    name: "Bondbuilder",
    category: "bondbuilder" as const,
    role: "specialized_bond_treatment" as const,
    overrides: { relationship: "add_on" as const },
  },
]) {
  test(`complete comparison rejects a ${scenario.name} candidate that excludes the confirmed thickness`, () => {
    const input = authorityInput(scenario.category, scenario.role, {
      productFacts: factsFor(scenario.category, scenario.role, "owned", {
        recommendable: false,
      }),
      candidates: [
        factsFor(scenario.category, scenario.role, "wrong-thickness-candidate", {
          ...scenario.overrides,
          suitableThicknesses: ["coarse"],
        }),
      ],
    })

    assert.deepEqual(buildStage3FitComparison(input).alternatives, [])
    assert.equal(findStage3SelectedComparisonCandidate(input, "wrong-thickness-candidate"), null)
  })
}

test("Shampoo comparison keeps complete route targets independent of catalogue pagination", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      targetFit: "known_mismatch",
      shampooObservations: {
        cleansingIntensity: "gentle",
        supportedScalpRoutes: ["irritated"],
      },
    }),
    candidates: [factsFor("shampoo", "shampoo_everyday", "candidate")],
  })

  const route = buildStage3FitComparison(input).dimensions.find(
    (dimension) => dimension.dimensionId === "shampoo.scalp_route",
  )
  assert.equal(
    route?.stops.some((stop) => stop.stopId === "irritated"),
    true,
  )
  assert.deepEqual(route?.productPositions[0], {
    productId: "owned",
    position: { kind: "supported_stops", stopIds: ["irritated"] },
  })
})

test("evidence rows carry exact server-owned current and candidate target relations", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("conditioner", "conditioner_rinse_out", {
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
        weight: "rich",
      }),
      candidates: [
        factsFor("conditioner", "conditioner_rinse_out", "candidate", { weight: "light" }),
      ],
    }),
  )
  const weight = comparison.evidenceRows!.find((row) => row.rowId === "conditioner.weight")
  assert.ok(weight)
  assert.equal(weight.target?.valueLabel, "leicht")
  assert.ok(weight.target?.rationale.length)
  assert.deepEqual(weight.productValues, [
    { productId: "owned", valueLabel: "reichhaltig", relation: "outside_target" },
    { productId: "candidate", valueLabel: "leicht", relation: "in_target" },
  ])
})

test("Conditioner retains aggregate target-fit evidence until its concrete matrix is complete", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("conditioner", "conditioner_rinse_out", {
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
        targetFit: "known_mismatch",
        balanceDirection: "balanced",
      }),
      candidates: [factsFor("conditioner", "conditioner_rinse_out", "candidate")],
    }),
  )

  assert.equal(comparison.mode, "comparison")
  assert.equal(comparison.evidenceRows?.length, 4)
  assert.deepEqual(
    comparison.evidenceRows?.find((row) => row.rowId === "conditioner.target_fit")
      ?.productValues[0],
    { productId: "owned", valueLabel: "nicht vollständig", relation: "outside_target" },
  )
  assert.deepEqual(
    comparison.evidenceRows?.find((row) => row.rowId === "conditioner.care_direction")
      ?.productValues[0],
    { productId: "owned", valueLabel: "ausgeglichen", relation: "supportive" },
  )
})

test("Shampoo compares confirmed route observations against the derived route target", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("shampoo", "shampoo_everyday", {
      productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
        targetFit: "known_mismatch",
        shampooObservations: {
          cleansingIntensity: "gentle",
          supportedScalpRoutes: ["dry"],
        },
      }),
      candidates: [factsFor("shampoo", "shampoo_everyday", "candidate")],
    }),
  )

  assert.equal(
    comparison.evidenceRows?.some((row) => row.rowId === "shampoo.target_fit"),
    false,
  )
  assert.deepEqual(
    comparison.evidenceRows
      ?.find((row) => row.rowId === "shampoo.scalp_route")
      ?.productValues.find((value) => value.productId === "owned"),
    { productId: "owned", valueLabel: "trocken", relation: "outside_target" },
  )
})

for (const scenario of [
  {
    name: "Conditioner adjacent weight",
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    rowId: "conditioner.weight",
    overrides: { weight: "medium" },
  },
  {
    name: "Leave-in balanced care direction",
    category: "leave_in" as const,
    role: "post_wash_leave_in" as const,
    rowId: "leave_in.care_direction",
    overrides: { careDirection: "balanced" },
  },
  {
    name: "Mask extreme weight gap",
    category: "mask" as const,
    role: "intensive_conditioning_mask" as const,
    rowId: "mask.weight",
    overrides: { weight: "rich" },
  },
  {
    name: "Oil adjacent leave-on weight",
    category: "oil" as const,
    role: "dry_finish" as const,
    rowId: "oil.weight",
    overrides: { weight: "medium" },
  },
]) {
  test(`${scenario.name} remains supportive instead of being flattened to outside`, () => {
    const comparison = buildStage3FitComparison(
      authorityInput(scenario.category, scenario.role, {
        productFacts: factsFor(scenario.category, scenario.role, "owned", scenario.overrides),
        candidates: [factsFor(scenario.category, scenario.role, "candidate")],
      }),
    )
    const value = comparison.evidenceRows
      ?.find((row) => row.rowId === scenario.rowId)
      ?.productValues.find((candidate) => candidate.productId === "owned")
    assert.equal(value?.relation, "supportive")
  })
}

test("set-valued and exact-overlap dimensions preserve equality without inventing distance", () => {
  const input = authorityInput("shampoo", "shampoo_everyday", {
    productFacts: factsFor("shampoo", "shampoo_everyday", "owned", {
      suitableThicknesses: ["fine", "normal"],
      cleansingIntensity: "regular",
    }),
    candidates: [
      factsFor("shampoo", "shampoo_everyday", "candidate", {
        suitableThicknesses: ["fine", "normal"],
        cleansingIntensity: "regular",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)
  const thickness = comparison.dimensions.find(
    (dimension) => dimension.dimensionId === "shampoo.suitable_thicknesses",
  )
  const cleansing = comparison.dimensions.find(
    (dimension) => dimension.dimensionId === "shampoo.cleansing_intensity",
  )

  assert.ok(thickness)
  assert.equal(thickness.presentationKind, "set")
  assert.deepEqual(thickness.productPositions, [
    { productId: "owned", position: { kind: "supported_stops", stopIds: ["fine", "normal"] } },
    {
      productId: "candidate",
      position: { kind: "supported_stops", stopIds: ["fine", "normal"] },
    },
  ])
  assert.ok(cleansing)
  assert.deepEqual(cleansing.productPositions, [
    { productId: "owned", position: { kind: "position", stopId: "regular" } },
    { productId: "candidate", position: { kind: "position", stopId: "regular" } },
  ])
})

test("Oil pre-wash uses only application and thickness dimensions", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("oil", "pre_wash_fibre_treatment", {
      productFacts: factsFor("oil", "pre_wash_fibre_treatment", "owned"),
      candidates: [factsFor("oil", "pre_wash_fibre_treatment", "candidate")],
    }),
  )

  assert.equal(comparison.mode, "comparison")
  assert.deepEqual(
    comparison.dimensions.map((dimension) => dimension.dimensionId),
    ["oil.role_support", "oil.suitable_thicknesses"],
  )
})

test("Oil leave-on roles keep application, weight, and unaveraged thickness support", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("oil", "dry_finish", {
      productFacts: factsFor("oil", "dry_finish", "owned", {
        suitableThicknesses: ["fine", "normal"],
      }),
      candidates: [
        factsFor("oil", "dry_finish", "candidate", {
          suitableThicknesses: ["fine", "normal"],
        }),
      ],
    }),
  )

  assert.equal(comparison.mode, "comparison")
  assert.deepEqual(
    comparison.dimensions.map((dimension) => dimension.dimensionId),
    ["oil.role_support", "oil.weight", "oil.suitable_thicknesses"],
  )
  const thickness = comparison.dimensions.find(
    (dimension) => dimension.dimensionId === "oil.suitable_thicknesses",
  )
  assert.ok(thickness)
  assert.deepEqual(thickness.productPositions, [
    { productId: "owned", position: { kind: "supported_stops", stopIds: ["fine", "normal"] } },
    {
      productId: "candidate",
      position: { kind: "supported_stops", stopIds: ["fine", "normal"] },
    },
  ])
})

for (const role of [
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
] as const) {
  test(`Oil ${role} projects a target for every displayed property`, () => {
    const comparison = buildStage3FitComparison(
      authorityInput("oil", role, {
        productFacts: factsFor("oil", role, "owned"),
        candidates: [factsFor("oil", role, "candidate")],
      }),
    )

    const evidenceRows = comparison.evidenceRows ?? []
    assert.ok(evidenceRows.length > 0)
    assert.equal(
      evidenceRows.find((row) => row.rowId === "oil.suitable_thicknesses")?.target?.valueLabel,
      "mittel",
    )
    assert.equal(
      evidenceRows.every((row) => row.target !== null),
      true,
    )
    assert.equal(
      evidenceRows
        .flatMap((row) => row.productValues)
        .some((value) => value.relation === "no_target"),
      false,
    )
  })
}

test("Shampoo dandruff stays compact instead of using the everyday scalp rail", () => {
  const comparison = buildStage3FitComparison(
    authorityInput("shampoo", "shampoo_dandruff", {
      productFacts: factsFor("shampoo", "shampoo_dandruff", "owned"),
      candidates: [factsFor("shampoo", "shampoo_dandruff", "candidate")],
    }),
  )

  assert.equal(comparison.mode, "compact")
  assert.deepEqual(comparison.dimensions, [])
})

test("Leave-in pre-heat always uses heat capability as its canonical third target row", () => {
  const ordinary = buildStage3FitComparison(
    authorityInput("leave_in", "pre_heat_application", {
      productFacts: factsFor("leave_in", "pre_heat_application", "owned"),
      candidates: [factsFor("leave_in", "pre_heat_application", "candidate")],
    }),
  )
  assert.equal(ordinary.mode, "comparison")
  assert.deepEqual(
    ordinary.dimensions.map((dimension) => dimension.dimensionId),
    ["leave_in.weight", "leave_in.care_direction", "leave_in.heat_protection"],
  )

  const heatFailure = buildStage3FitComparison(
    authorityInput("leave_in", "pre_heat_application", {
      productFacts: factsFor("leave_in", "pre_heat_application", "owned", {
        providesHeatProtection: false,
      }),
      candidates: [factsFor("leave_in", "pre_heat_application", "candidate")],
    }),
  )
  assert.equal(heatFailure.mode, "comparison")
  assert.deepEqual(
    heatFailure.dimensions.map((dimension) => dimension.dimensionId),
    ["leave_in.weight", "leave_in.care_direction", "leave_in.heat_protection"],
  )
})

test("missing exact facts stay unavailable and do not produce placeholder dimensions", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      weight: null,
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "missing-candidate", {
        weight: null,
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.equal(comparison.mode, "unavailable")
  assert.deepEqual(comparison.products, [])
  assert.deepEqual(comparison.alternatives, [])
  assert.deepEqual(comparison.dimensions, [])
})

test("specialist categories use compact mode and empty inputs use unavailable mode", () => {
  for (const category of SPECIALIST_CATEGORIES) {
    const role = CATEGORY_ROLE_POLICIES[category].allowedRoles[0]
    const compact = buildStage3FitComparison(
      authorityInput(category, role, {
        productFacts: factsFor(category, role, "owned"),
        candidates: [factsFor(category, role, "candidate")],
      }),
    )
    assert.equal(compact.mode, "compact", category)
    assert.deepEqual(compact.dimensions, [])
    assert.ok(
      compact.evidenceRows?.every(
        (row) =>
          row.target?.rationale ===
          "Für eine passende Produktempfehlung muss dieser Prüfpunkt erfüllt sein.",
      ),
      `${category} must keep target rationale separate from product evidence`,
    )

    const unavailable = buildStage3FitComparison(
      authorityInput(category, role, {
        productFacts: null,
        capturedProductId: null,
        subjectIdentity: null,
        candidates: [],
      }),
    )
    assert.equal(unavailable.mode, "unavailable", category)
    assert.deepEqual(unavailable.products, [])
    assert.deepEqual(unavailable.alternatives, [])
  }
})

test("transport stays capped only after the complete candidate set is ranked", () => {
  assert.equal(STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT, 3)

  const comparison = buildStage3FitComparison(
    authorityInput("conditioner", "conditioner_rinse_out", {
      productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
        recommendable: false,
      }),
      candidates: Array.from({ length: 25 }, (_, index) =>
        factsFor("conditioner", "conditioner_rinse_out", `candidate-${index}`, {
          sortOrder: index,
        }),
      ),
    }),
  )

  assert.equal(comparison.alternatives.length, 3)
  assertPayloadFits(comparison)
})

test("comparison ranks target coverage before recommendation and verdict tie-breakers", () => {
  const input = authorityInput("conditioner", "conditioner_rinse_out", {
    productFacts: factsFor("conditioner", "conditioner_rinse_out", "owned", {
      recommendable: false,
      weight: "rich",
    }),
    candidates: [
      factsFor("conditioner", "conditioner_rinse_out", "one-of-three", {
        sortOrder: 1,
        weight: "medium",
        balanceDirection: "balanced",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "two-of-three-a", {
        sortOrder: 2,
        weight: "light",
        balanceDirection: "balanced",
      }),
      factsFor("conditioner", "conditioner_rinse_out", "two-of-three-b", {
        sortOrder: 3,
        weight: "light",
        repairSupportLevel: "low",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.deepEqual(
    comparison.alternatives.map((candidate) => candidate.productId),
    ["two-of-three-a", "two-of-three-b", "one-of-three"],
  )
  assert.equal(
    findStage3SelectedComparisonCandidate(input, "two-of-three-a")?.productId,
    "two-of-three-a",
  )
})

test("comparison excludes a known Leave-in candidate with zero displayed target matches", () => {
  const input = authorityInput("leave_in", "post_wash_leave_in", {
    productFacts: factsFor("leave_in", "post_wash_leave_in", "owned", {
      recommendable: false,
    }),
    candidates: [
      factsFor("leave_in", "post_wash_leave_in", "zero-of-three", {
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "high",
      }),
      factsFor("leave_in", "post_wash_leave_in", "one-of-three", {
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
      }),
    ],
  })

  const comparison = buildStage3FitComparison(input)

  assert.deepEqual(
    comparison.alternatives.map((candidate) => candidate.productId),
    ["one-of-three"],
  )
  assert.equal(findStage3SelectedComparisonCandidate(input, "zero-of-three"), null)
})

function authorityInput<C extends PersonalPlanCategory>(
  category: C,
  role: PlanProductRole,
  options: {
    productFacts: Extract<Stage3CategoryProductFacts, { category: C }> | null
    candidates: Array<Extract<Stage3CategoryProductFacts, { category: C }>>
    capturedProductId?: string | null
    subjectIdentity?: Stage3AuthorityInput<C>["subjectIdentity"]
  },
): Stage3AuthorityInput<C> {
  const capturedProductId =
    options.capturedProductId === undefined
      ? options.productFacts
        ? "captured-owned"
        : null
      : options.capturedProductId
  const subjectIdentity =
    options.subjectIdentity === undefined
      ? options.productFacts
        ? {
            kind: "catalog_product" as const,
            productId: options.productFacts.productId,
            displayName: options.productFacts.displayName,
            category,
            imageUrl: "https://example.com/presentation-only.jpg",
          }
        : null
      : options.subjectIdentity

  return {
    category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    refinedVersionId: "refined-1",
    refinedInputHash: "input-1",
    subjectKey: subjectKey(category, role),
    role,
    capturedProductId,
    subjectIdentity,
    categoryDecision: {
      category,
      resolution: "resolved",
      needTier: "basis",
      roles: [role],
      target: targetFor(category, role),
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
    coverage: [],
    productFacts: options.productFacts,
    recommendationCandidates: options.candidates,
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as Stage3AuthorityInput<C>
}

function subjectKey(category: PersonalPlanCategory, role: PlanProductRole): string {
  return `decision:${category}:${role}:captured-owned`
}

function targetFor(category: PersonalPlanCategory, role: PlanProductRole): unknown {
  switch (category) {
    case "shampoo":
      return {
        category,
        roles: [role],
        scalpRoute: "balanced",
        everydayConstraint: "standard",
        requiresTargetedDandruffCapability: role === "shampoo_dandruff",
      }
    case "conditioner":
      return {
        category,
        roles: [role],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "leave_in":
      return {
        category,
        roles: [role],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functions: [],
        conditionerReplacementEligible: false,
      }
    case "mask":
      return {
        category,
        roles: [role],
        needStrength: "standard",
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "oil":
      return {
        category,
        roles: [role],
        roleTargets: [
          {
            role,
            tier: "basis",
            weight: role === "pre_wash_fibre_treatment" ? null : "light",
            functionalBenefits: [],
          },
        ],
      }
    case "deep_cleansing_shampoo":
      return { category, roles: [role] }
    case "dry_shampoo":
      return { category, roles: [role], cadenceAdjustment: "keep" }
    case "heat_protectant":
      return {
        category,
        roles: [role],
        qualifyingRoutes: ["direct_contact_heat"],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      }
    case "bondbuilder":
      return {
        category,
        roles: [role],
        requiredFunction: "support_stressed_hair_resilience",
        mechanismTarget: "mechanism_neutral",
      }
    case "scalp_care":
      return { category, roles: [role], roleTargets: [{ role, coverage: "primary" }] }
  }
}

function factsFor<C extends PersonalPlanCategory>(
  category: C,
  role: PlanProductRole,
  productId: string,
  overrides: {
    displayName?: string
    fingerprint?: string
    isActive?: boolean
    lifecycleStatus?: string | null
    recommendable?: boolean
    sortOrder?: number | null
    suitableThicknesses?: string[] | null
    priceEur?: number | null
    priceCheckedAt?: string | null
    netContentValue?: number | null
    netContentUnit?: "ml" | "g" | null
    verdict?: Extract<Stage3FitVerdict, "ideal" | "supportive" | "mismatch" | "unknown">
    targetFit?: "matched" | "known_mismatch" | "unknown"
    balanceDirection?: string | null
    careDirection?: string | null
    shampooObservations?: {
      cleansingIntensity: string | null
      supportedScalpRoutes: string[]
    }
    weight?: string | null
    repairSupportLevel?: string | null
    cleansingIntensity?: string | null
    shampooBucket?: string | null
    scalpRoute?: string | null
    relationship?: "standalone" | "add_on" | null
    providesHeatProtection?: boolean | null
  } = {},
): Extract<Stage3CategoryProductFacts, { category: C }> {
  const common = commonFacts(category, role, productId, overrides)
  switch (category) {
    case "shampoo":
      return {
        ...common,
        category,
        ...(overrides.shampooObservations
          ? { comparisonObservations: overrides.shampooObservations }
          : {}),
        spec: {
          thickness: "normal",
          shampooBucket:
            overrides.shampooBucket ?? (role === "shampoo_dandruff" ? "schuppen" : "normal"),
          scalpRoute:
            overrides.scalpRoute ?? (role === "shampoo_dandruff" ? "dandruff" : "balanced"),
          cleansingIntensity: overrides.cleansingIntensity ?? "regular",
          targetFit:
            overrides.targetFit ?? (overrides.verdict === "unknown" ? "unknown" : "matched"),
        },
      } as never
    case "conditioner":
      return {
        ...common,
        category,
        spec: {
          thickness: "normal",
          proteinMoistureBalance: overrideOrDefault(
            overrides,
            "careDirection",
            overrides.verdict === "mismatch" ? "protein" : "moisture",
          ),
          weight: overrideOrDefault(
            overrides,
            "weight",
            overrides.verdict === "supportive"
              ? "medium"
              : overrides.verdict === "mismatch"
                ? "rich"
                : "light",
          ),
          repairSupportLevel: overrideOrDefault(overrides, "repairSupportLevel", "medium"),
          balanceDirection:
            overrides.balanceDirection === undefined ? "moisture" : overrides.balanceDirection,
          targetFit:
            overrides.targetFit ?? (overrides.verdict === "unknown" ? "unknown" : "matched"),
        },
      } as never
    case "leave_in":
      return {
        ...common,
        category,
        spec: {
          format: "cream",
          weight: overrideOrDefault(
            overrides,
            "weight",
            overrides.verdict === "supportive" ? "medium" : "light",
          ),
          careDirection:
            overrides.careDirection === undefined ? "moisture" : overrides.careDirection,
          repairSupportLevel: overrideOrDefault(overrides, "repairSupportLevel", "medium"),
          roles: [role],
          providesHeatProtection:
            overrides.providesHeatProtection ?? (role === "pre_heat_application" ? true : false),
          careBenefits: [],
          applicationStages: role === "pre_heat_application" ? ["pre_heat"] : ["damp"],
        },
      } as never
    case "heat_protectant":
      return {
        ...common,
        category,
        spec: { format: "spray", providesHeatProtection: true },
      } as never
    case "oil":
      return {
        ...common,
        category,
        spec: {
          roleSupport: { [role]: true },
          weight: overrideOrDefault(
            overrides,
            "weight",
            role === "pre_wash_fibre_treatment"
              ? null
              : overrides.verdict === "supportive"
                ? "medium"
                : "light",
          ),
          targetThicknessEligible: true,
          providesHeatProtection: false,
        },
      } as never
    case "mask":
      return {
        ...common,
        category,
        spec: {
          weight: overrideOrDefault(
            overrides,
            "weight",
            overrides.verdict === "supportive" ? "medium" : "light",
          ),
          careDirection:
            overrides.careDirection === undefined ? "moisture" : overrides.careDirection,
          repairSupportLevel: overrideOrDefault(overrides, "repairSupportLevel", "medium"),
          functionalBenefits: [],
        },
      } as never
    case "scalp_care":
      return {
        ...common,
        category,
        spec: { primaryRole: role, presentationFormat: "serum", rinseMode: "leave_on" },
      } as never
    case "dry_shampoo":
      return {
        ...common,
        category,
        spec: {
          primaryEffect: "classic_refresh",
          hairColorFit: "universal",
          scalpSensitivityFit: "sensitive_ok",
          format: "aerosol_spray",
        },
      } as never
    case "bondbuilder":
      return {
        ...common,
        category,
        spec: {
          applicationMode: "pre_shampoo",
          treatmentMode: "standalone",
          productFormat: "treatment",
          usageProtocol: "verified_course",
          relationship: overrides.relationship ?? "standalone",
        },
      } as never
    case "deep_cleansing_shampoo":
      return {
        ...common,
        category,
        spec: {
          supportedResetRoles: [role],
          scalpTypeFocus: "balanced",
          colorTreatedSuitability: "suitable",
        },
      } as never
  }
}

function commonFacts(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  productId: string,
  overrides: {
    displayName?: string
    fingerprint?: string
    isActive?: boolean
    lifecycleStatus?: string | null
    recommendable?: boolean
    sortOrder?: number | null
    suitableThicknesses?: string[] | null
    priceEur?: number | null
    priceCheckedAt?: string | null
    netContentValue?: number | null
    netContentUnit?: "ml" | "g" | null
  },
) {
  return {
    productId,
    displayName: overrides.displayName ?? productId,
    presentationImageUrl: `https://example.com/${productId}.jpg`,
    category,
    isActive: overrides.isActive ?? true,
    lifecycleStatus: overrides.lifecycleStatus ?? "active",
    recommendable: overrides.recommendable ?? true,
    suitableThicknesses: overrides.suitableThicknesses ?? ["fine", "normal"],
    knownReaction: false,
    protocols: [
      { role, status: "verified_complete" as const, fingerprint: `protocol-${productId}` },
    ],
    factFingerprint: overrides.fingerprint ?? `facts-${productId}`,
    catalogSortOrder: overrides.sortOrder ?? null,
    priceEur: overrides.priceEur ?? 9,
    priceCheckedAt: overrides.priceCheckedAt ?? null,
    purchaseLinkStatus: "available" as const,
    netContentValue: overrides.netContentValue ?? null,
    netContentUnit: overrides.netContentUnit ?? null,
  }
}

function overrideOrDefault<T extends string | null>(
  overrides: {
    weight?: string | null
    repairSupportLevel?: string | null
    careDirection?: string | null
  },
  key: "weight" | "repairSupportLevel" | "careDirection",
  fallback: T,
): string | null {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? (overrides[key] ?? null) : fallback
}

function assertNoRawFactsOrPresentationFields(value: unknown): void {
  const json = JSON.stringify(value)
  assert.equal(json.includes('"facts"'), false)
  assert.equal(json.includes("catalogSortOrder"), false)
  assert.equal(json.includes("sortOrder"), false)
  assert.equal(json.includes("score"), false)
  assert.equal(json.includes("percent"), false)
}

function assertPayloadFits(value: unknown): void {
  assert.ok(Buffer.byteLength(JSON.stringify(value), "utf8") <= 64 * 1024)
}
