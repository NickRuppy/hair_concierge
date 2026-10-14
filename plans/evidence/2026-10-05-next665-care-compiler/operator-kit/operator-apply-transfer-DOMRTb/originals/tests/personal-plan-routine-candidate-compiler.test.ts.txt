import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import {
  parseProposedProductPortfolio,
  type ProposedProductPortfolio,
} from "../src/lib/personal-plan/products/contracts"
import { compileInitialRoutineCandidate } from "../src/lib/personal-plan/routine-candidate-compiler"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"

const refinedNeedSnapshot = {
  schemaVersion: 1,
  decisions: [
    {
      category: "conditioner",
      needTier: "basis",
      roles: ["conditioner_rinse_out"],
      frequency: {
        kind: "after_each_eligible_wash",
        roles: ["conditioner_rinse_out"],
        dependsOn: "wet_wash_total",
        placementState: "known",
      },
      reasons: [{ id: "conditioner.need.v1" }],
    },
    {
      category: "oil",
      needTier: "optional",
      roles: ["dry_finish"],
      frequency: {
        kind: "role_based_wash_linked",
        roleFrequencies: [
          { role: "dry_finish", tier: "optional", cadence: "finish_after_every_compatible_wash" },
        ],
      },
      reasons: [{ id: "oil.finish.v1" }],
    },
    {
      category: "heat_protectant",
      needTier: "optional",
      roles: ["pre_heat_protection"],
      frequency: {
        kind: "event_based",
        role: "pre_heat_protection",
        eventRoutes: ["direct_contact_heat"],
        occurrence: "before_every_qualifying_event",
      },
      reasons: [{ id: "heat.event.v1" }],
    },
    {
      category: "mask",
      needTier: "not_needed",
      roles: ["intensive_conditioning_mask"],
      frequency: null,
      reasons: [{ id: "mask.not-needed.v1" }],
    },
  ],
  renderedOrder: ["conditioner", "oil", "heat_protectant"],
} as unknown as InitialNeedPlanSnapshot

function portfolio(createdAt = "2026-08-08T08:00:00.000Z"): ProposedProductPortfolio {
  return {
    schemaVersion: 1,
    portfolioVersionId: "pending-sql-assignment",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-a",
    sourceDraftRevision: 12,
    categoryResolutions: [
      {
        decisionKey: "decision:conditioner:conditioner_rinse_out:owned-a",
        category: "conditioner",
        role: "conditioner_rinse_out",
        verdict: "supportive",
        choiceState: "owned_override",
        capturedProductId: "captured-a",
        executable: true,
        gapPreserved: false,
      },
      {
        decisionKey: "decision:oil:dry_finish:planned-a",
        category: "oil",
        role: "dry_finish",
        verdict: "ideal",
        choiceState: "planned_purchase",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
      {
        decisionKey: "decision:heat_protectant:pre_heat_protection:pending-a",
        category: "heat_protectant",
        role: "pre_heat_protection",
        verdict: "unknown",
        choiceState: "pending_review",
        capturedProductId: "captured-pending-a",
        executable: false,
        gapPreserved: true,
      },
      {
        decisionKey: "decision:mask:intensive_conditioning_mask:none",
        category: "mask",
        role: "intensive_conditioning_mask",
        verdict: "unknown",
        choiceState: "inactive",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
    ],
    ownedProducts: [
      {
        capturedProductId: "captured-a",
        userProductId: "user-product-a",
        productId: "product-a",
        displayName: "Conditioner A",
        category: "conditioner",
        role: "conditioner_rinse_out",
        frequencyRange: "weekly_2x",
        choiceState: "owned_override",
        sourceDecisionKey: "decision:conditioner:conditioner_rinse_out:owned-a",
      },
    ],
    plannedPurchases: [
      {
        plannedPurchaseId: "planned-a",
        category: "oil",
        role: "dry_finish",
        recommendationId: "recommendation-a",
        productId: "product-oil-a",
        displayName: "Oil A",
        reason: "Versiegelt die Spitzen",
        authorityRuleId: "oil.recommendation.v1",
      },
    ],
    pendingProducts: [
      {
        capturedProductId: "captured-pending-a",
        userProductId: "user-product-pending-a",
        submissionId: "submission-a",
        category: "heat_protectant",
        role: "pre_heat_protection",
        displayName: "Unbekannter Hitzeschutz",
        reviewStatus: "pending_review",
      },
    ],
    uncoveredRoles: [
      {
        category: "oil",
        role: "dry_finish",
        reason: "planned_purchase_not_acquired",
        linkedDecisionKey: "decision:oil:dry_finish:planned-a",
      },
      {
        category: "heat_protectant",
        role: "pre_heat_protection",
        reason: "pending_review",
        linkedDecisionKey: "decision:heat_protectant:pre_heat_protection:pending-a",
      },
      {
        category: "mask",
        role: "intensive_conditioning_mask",
        reason: "inactive",
        linkedDecisionKey: "decision:mask:intensive_conditioning_mask:none",
      },
    ],
    createdAt,
  }
}

function compilerInput(sourceRevision = 7, createdAt?: string) {
  return {
    userId: "owner-a",
    personalPlanId: "plan-a",
    productDraftId: "draft-a",
    expectedRevision: 12,
    expectedSourceRevision: sourceRevision,
    portfolioSchemaVersion: 1,
    portfolioSnapshot: portfolio(createdAt) as never,
    refinedNeedSnapshot,
  }
}

test("initial Routine compilation is deterministic and excludes volatile portfolio metadata", async () => {
  const first = await compileInitialRoutineCandidate(compilerInput())
  const second = await compileInitialRoutineCandidate(compilerInput(7, "2026-08-08T09:00:00.000Z"))

  assert.equal(first.sourceFingerprint, second.sourceFingerprint)
  assert.deepEqual(first.payload, second.payload)
  assert.deepEqual(first.authorityVersions, {
    conditioner: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    heat_protectant: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    mask: CATEGORY_ROLE_POLICIES.mask.authorityVersion,
    oil: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    portfolio: "personal-plan-product-portfolio.v1",
    routine: "personal-plan-routine-compiler.v2",
  })
})

test("freezes matching delegated exact cadence into the initial Routine and fingerprints its fact", async () => {
  const bondPortfolio = {
    ...portfolio(),
    categoryResolutions: [
      {
        decisionKey: "decision:bondbuilder:specialized_bond_treatment:owned-bond",
        category: "bondbuilder",
        role: "specialized_bond_treatment",
        verdict: "ideal",
        choiceState: "owned_active",
        capturedProductId: "captured-bond",
        executable: true,
        gapPreserved: false,
      },
    ],
    ownedProducts: [
      {
        capturedProductId: "captured-bond",
        userProductId: "user-product-bond",
        productId: "product-bond",
        displayName: "Bondbuilder",
        category: "bondbuilder",
        role: "specialized_bond_treatment",
        frequencyRange: null,
        choiceState: "owned_active",
        sourceDecisionKey: "decision:bondbuilder:specialized_bond_treatment:owned-bond",
      },
    ],
    plannedPurchases: [],
    pendingProducts: [],
    uncoveredRoles: [],
  } as unknown as ProposedProductPortfolio
  const snapshot = {
    ...refinedNeedSnapshot,
    decisions: [
      {
        category: "bondbuilder",
        needTier: "optional",
        roles: ["specialized_bond_treatment"],
        frequency: { kind: "product_protocol_course" },
        reasons: [{ id: "bond.protocol.v1" }],
      },
    ],
    renderedOrder: ["bondbuilder"],
  } as unknown as InitialNeedPlanSnapshot
  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSnapshot: bondPortfolio as never,
    refinedNeedSnapshot: snapshot,
    cadenceAuthorityFacts: [
      {
        productId: "product-bond",
        category: "bondbuilder",
        role: "specialized_bond_treatment",
        cadence: { kind: "label_course", copy_de: "4 Anwendungen, dann 4 Haarwäschen Pause." },
      },
    ],
  })
  const payload = candidate.payload as Record<string, any>
  assert.deepEqual(payload.items[0]?.cadence.resolved, {
    copyDe: "4 Anwendungen, dann 4 Haarwäschen Pause.",
    source: "exact_product_protocol",
  })
  const changed = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSnapshot: bondPortfolio as never,
    refinedNeedSnapshot: snapshot,
    cadenceAuthorityFacts: [
      {
        productId: "product-bond",
        category: "bondbuilder",
        role: "specialized_bond_treatment",
        cadence: { kind: "label_course", copy_de: "Andere Kursfolge." },
      },
    ],
  })
  assert.notEqual(candidate.sourceFingerprint, changed.sourceFingerprint)
})

test("initial Routine preserves Stage-3 choices and canonical Basis then Optional ordering", async () => {
  const candidate = await compileInitialRoutineCandidate(compilerInput())
  const payload = candidate.payload as Record<string, any>

  assert.deepEqual(payload.sections, [
    { key: "basis", itemKeys: ["item:conditioner:conditioner_rinse_out:captured-a"] },
    {
      key: "optional",
      itemKeys: [
        "item:oil:dry_finish:planned-a",
        "item:heat_protectant:pre_heat_protection:captured-pending-a",
      ],
    },
  ])
  assert.deepEqual(payload.source.renderedOrder, ["conditioner", "oil", "heat_protectant"])
  assert.deepEqual(
    payload.intent.categories.map((entry: Record<string, unknown>) => entry.category),
    ["conditioner", "oil", "heat_protectant"],
  )
  assert.deepEqual(
    payload.items.map((item: Record<string, any>) => ({
      key: item.itemKey,
      assessment: item.state.systemAssessment,
      inclusion: item.state.inclusion,
      availability: item.state.availability,
      fitDecision: item.state.fitDecision,
      executable: item.executable,
      productKind: item.product.kind,
    })),
    [
      {
        key: "item:conditioner:conditioner_rinse_out:captured-a",
        assessment: "basis",
        inclusion: "included",
        availability: "owned",
        fitDecision: "informed_override",
        executable: true,
        productKind: "owned",
      },
      {
        key: "item:oil:dry_finish:planned-a",
        assessment: "optional",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
        executable: false,
        productKind: "planned",
      },
      {
        key: "item:heat_protectant:pre_heat_protection:captured-pending-a",
        assessment: "optional",
        inclusion: "included",
        availability: "pending_review",
        fitDecision: "standard",
        executable: false,
        productKind: "pending_review",
      },
      {
        key: "item:mask:intensive_conditioning_mask:none",
        assessment: "not_recommended",
        inclusion: "excluded",
        availability: "none",
        fitDecision: "standard",
        executable: false,
        productKind: "none",
      },
    ],
  )
  assert.equal("applicationOrder" in payload, false)
  assert.equal("dayTypes" in payload, false)
  assert.equal("user_product_usage" in payload, false)
})

test("source revision participates in the compiler fingerprint", async () => {
  const first = await compileInitialRoutineCandidate(compilerInput(7))
  const later = await compileInitialRoutineCandidate(compilerInput(8))
  assert.notEqual(first.sourceFingerprint, later.sourceFingerprint)
})

test("compiler rejects a portfolio role without a resolved refined category decision", async () => {
  await assert.rejects(
    () =>
      compileInitialRoutineCandidate({
        ...compilerInput(),
        refinedNeedSnapshot: {
          ...refinedNeedSnapshot,
          decisions: refinedNeedSnapshot.decisions.filter(
            (decision) => decision.category !== "conditioner",
          ),
        },
      }),
    /routine_candidate_missing_refined_decision:conditioner/,
  )
})

test("compiler fails closed on legacy supplemental product-load categories outside renderedOrder", async () => {
  const supplementalPortfolio = {
    ...portfolio(),
    schemaVersion: 2,
    categoryResolutions: [
      {
        decisionKey: "decision:deep_cleansing_shampoo:residue_reset:gap",
        category: "deep_cleansing_shampoo",
        role: "residue_reset",
        verdict: "unknown",
        choiceState: "unassigned",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
    ],
    ownedProducts: [],
    plannedPurchases: [],
    pendingProducts: [],
    uncoveredRoles: [
      {
        category: "deep_cleansing_shampoo",
        role: "residue_reset",
        reason: "no_product_owned",
        linkedDecisionKey: "decision:deep_cleansing_shampoo:residue_reset:gap",
      },
    ],
    productLoadResolution: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-a",
      refinedInputHash: "refined-input-a",
      capturedFrequencyFingerprint: "a".repeat(64),
      authorityVersions: {
        deep_cleansing_shampoo: CATEGORY_ROLE_POLICIES.deep_cleansing_shampoo.authorityVersion,
      },
      requirements: [
        {
          category: "deep_cleansing_shampoo",
          requiredRoles: ["residue_reset"],
          needSummary: "Entfernt Ablagerungen bei hoher aktueller Produktlast.",
          authorityVersion: CATEGORY_ROLE_POLICIES.deep_cleansing_shampoo.authorityVersion,
        },
      ],
      decisions: [
        {
          category: "deep_cleansing_shampoo",
          resolution: "resolved",
          needTier: "basis",
          roles: ["residue_reset"],
          target: { category: "deep_cleansing_shampoo", roles: ["residue_reset"] },
          frequency: {
            kind: "every_nth_wash",
            roles: ["residue_reset"],
            every: 3,
            substitutesRegularShampoo: true,
          },
          reasons: [
            {
              id: "deep_cleansing.inclusion.high_load",
              salience: "primary",
              evidence: [],
              values: { resetLoad: 4 },
            },
          ],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
    },
  } as unknown as ProposedProductPortfolio

  await assert.rejects(
    () =>
      compileInitialRoutineCandidate({
        ...compilerInput(),
        portfolioSchemaVersion: 2,
        portfolioSnapshot: supplementalPortfolio as never,
      }),
    /routine_candidate_category_outside_rendered_order:deep_cleansing_shampoo/,
  )
})

test("compiler reads a frozen v3 planned replacement by decision key, not its shared role", async () => {
  const v3Portfolio = {
    ...portfolio(),
    schemaVersion: 3,
    categoryResolutions: [
      {
        decisionKey: "decision:oil:dry_finish:replacement-a",
        category: "oil",
        role: "dry_finish",
        verdict: "ideal",
        choiceState: "planned_purchase",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
      {
        decisionKey: "decision:oil:dry_finish:replacement-b",
        category: "oil",
        role: "dry_finish",
        verdict: "ideal",
        choiceState: "planned_purchase",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
    ],
    ownedProducts: [],
    plannedPurchases: [
      {
        plannedPurchaseId: "planned:decision:oil:dry_finish:replacement-a",
        sourceDecisionKey: "decision:oil:dry_finish:replacement-a",
        category: "oil",
        role: "dry_finish",
        recommendationId: "recommendation-a",
        productId: "product-a",
        displayName: "Öl A",
        reason: "A",
        authorityRuleId: "oil.v1",
      },
      {
        plannedPurchaseId: "planned:decision:oil:dry_finish:replacement-b",
        sourceDecisionKey: "decision:oil:dry_finish:replacement-b",
        category: "oil",
        role: "dry_finish",
        recommendationId: "recommendation-b",
        productId: "product-b",
        displayName: "Öl B",
        reason: "B",
        authorityRuleId: "oil.v1",
      },
    ],
    pendingProducts: [],
    uncoveredRoles: [],
    retainedOwnedProducts: [
      {
        capturedProductId: "retained-a",
        userProductId: "user-retained-a",
        productId: "old-product-a",
        displayName: "Altes Öl",
        category: "oil",
        role: "dry_finish",
        sourceDecisionKey: "decision:oil:dry_finish:replacement-a",
        planStatus: "not_used",
      },
    ],
  }
  const parsed = parseProposedProductPortfolio(v3Portfolio)
  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSchemaVersion: 3,
    portfolioSnapshot: parsed as never,
  })
  const payload = candidate.payload as Record<string, any>

  assert.deepEqual(
    payload.items.map((item: { product: { productId: string }; assignmentKey: string }) => ({
      productId: item.product.productId,
      assignmentKey: item.assignmentKey,
    })),
    [
      {
        productId: "product-a",
        assignmentKey: "assignment:oil:dry_finish:planned:decision:oil:dry_finish:replacement-a",
      },
      {
        productId: "product-b",
        assignmentKey: "assignment:oil:dry_finish:planned:decision:oil:dry_finish:replacement-b",
      },
    ],
  )
})

test("compiler gives a v3 selected replacement precedence over its pending source identity", async () => {
  const decisionKey = "decision:heat_protectant:pre_heat_protection:pending-a"
  const v3Portfolio = parseProposedProductPortfolio({
    ...portfolio(),
    schemaVersion: 3,
    categoryResolutions: [
      {
        ...portfolio().categoryResolutions[2]!,
        decisionKey,
      },
    ],
    ownedProducts: [],
    plannedPurchases: [
      {
        plannedPurchaseId: `planned:${decisionKey}`,
        sourceDecisionKey: decisionKey,
        category: "heat_protectant",
        role: "pre_heat_protection",
        recommendationId: "replacement-a",
        productId: "replacement-product-a",
        displayName: "Hitzeschutz Ersatz",
        reason: "Verifizierte Auswahl",
        authorityRuleId: "heat.replacement.v1",
      },
    ],
    retainedOwnedProducts: [],
  })

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSchemaVersion: 3,
    portfolioSnapshot: v3Portfolio as never,
  })
  const payload = candidate.payload as Record<string, any>

  assert.deepEqual(payload.items[0]?.product, {
    kind: "planned",
    plannedPurchaseId: `planned:${decisionKey}`,
    productId: "replacement-product-a",
    displayName: "Hitzeschutz Ersatz",
  })
  assert.equal(
    payload.items[0]?.assignmentKey,
    `assignment:heat_protectant:pre_heat_protection:planned:${decisionKey}`,
  )
})

test("compiler accepts v4 snapshots but never turns retained inventory into routine items", async () => {
  const v4Portfolio = parseProposedProductPortfolio(
    {
      ...portfolio(),
      schemaVersion: 4,
      plannedPurchases: portfolio().plannedPurchases.map((purchase, index) => ({
        ...purchase,
        sourceDecisionKey: portfolio().categoryResolutions[index]!.decisionKey,
      })),
      retainedOwnedProducts: [],
      inventoryDispositions: [],
      retainedInventoryProducts: [
        {
          kind: "catalog_product",
          capturedProductId: "inventory-captured-a",
          userProductId: "inventory-user-a",
          productId: "inventory-product-a",
          displayName: "Nicht verwendetes Trockenshampoo",
          category: "dry_shampoo",
          role: null,
          sourceDispositionKey: "inventory:dry-shampoo:a",
          planStatus: "not_used",
          reason: "category_not_in_final_plan",
        },
      ],
    },
    { includeV4: true },
  )

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSchemaVersion: 4,
    portfolioSnapshot: v4Portfolio as never,
  })
  const payload = candidate.payload as Record<string, any>

  assert.equal(
    payload.items.some((item: { category: string }) => item.category === "dry_shampoo"),
    false,
  )
})

test("compiler preserves a v1 pending assignment identity beside a same-role planned purchase", async () => {
  const pendingDecisionKey = "decision:conditioner:conditioner_rinse_out:pending-a"
  const plannedDecisionKey = "decision:conditioner:conditioner_rinse_out:planned-b"
  const legacyPortfolio = parseProposedProductPortfolio({
    ...portfolio(),
    categoryResolutions: [
      {
        decisionKey: pendingDecisionKey,
        category: "conditioner",
        role: "conditioner_rinse_out",
        verdict: "unknown",
        choiceState: "pending_review",
        capturedProductId: "captured-pending-a",
        executable: false,
        gapPreserved: true,
      },
      {
        decisionKey: plannedDecisionKey,
        category: "conditioner",
        role: "conditioner_rinse_out",
        verdict: "ideal",
        choiceState: "planned_purchase",
        capturedProductId: null,
        executable: false,
        gapPreserved: true,
      },
    ],
    ownedProducts: [],
    plannedPurchases: [
      {
        plannedPurchaseId: "planned-conditioner-b",
        category: "conditioner",
        role: "conditioner_rinse_out",
        recommendationId: "recommendation-conditioner-b",
        productId: "product-conditioner-b",
        displayName: "Conditioner B",
        reason: "Geplant",
        authorityRuleId: "conditioner.v1",
      },
    ],
    pendingProducts: [
      {
        capturedProductId: "captured-pending-a",
        userProductId: "user-pending-a",
        submissionId: "submission-pending-a",
        category: "conditioner",
        role: "conditioner_rinse_out",
        displayName: "Conditioner in Prüfung",
        reviewStatus: "pending_review",
      },
    ],
    uncoveredRoles: [],
  })

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSnapshot: legacyPortfolio as never,
  })
  const items = (candidate.payload as Record<string, any>).items as Array<{
    sourceDecisionKeys: string[]
    assignmentKey: string
  }>
  const pendingItem = items.find((item) => item.sourceDecisionKeys.includes(pendingDecisionKey))

  assert.equal(
    pendingItem?.assignmentKey,
    "assignment:conditioner:conditioner_rinse_out:captured-pending-a",
  )
})

test("routine items take the role tier, not the category aggregate", async () => {
  // oil decision: needTier "basis"; roleTargets pre_wash tier "basis", dry_finish tier "optional"
  const oilDecision = {
    category: "oil",
    needTier: "basis",
    roles: ["pre_wash_fibre_treatment", "dry_finish"],
    target: {
      category: "oil",
      roles: ["pre_wash_fibre_treatment", "dry_finish"],
      roleTargets: [
        {
          role: "pre_wash_fibre_treatment",
          tier: "basis",
          weight: null,
          functionalBenefits: [],
        },
        {
          role: "dry_finish",
          tier: "optional",
          weight: null,
          functionalBenefits: [],
        },
      ],
    },
    frequency: {
      kind: "role_based_wash_linked",
      roleFrequencies: [
        {
          role: "pre_wash_fibre_treatment",
          tier: "basis",
          cadence: "before_every_compatible_wash",
        },
        { role: "dry_finish", tier: "optional", cadence: "finish_after_every_compatible_wash" },
      ],
    },
    reasons: [{ id: "oil.v1" }],
  }

  const testPortfolio = {
    ...portfolio(),
    categoryResolutions: [
      {
        decisionKey: "decision:oil:pre_wash_fibre_treatment:owned-oil-pre",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        verdict: "ideal",
        choiceState: "owned_active",
        capturedProductId: "captured-oil-pre",
        executable: true,
        gapPreserved: false,
      },
      {
        decisionKey: "decision:oil:dry_finish:owned-oil-dry",
        category: "oil",
        role: "dry_finish",
        verdict: "ideal",
        choiceState: "owned_active",
        capturedProductId: "captured-oil-dry",
        executable: true,
        gapPreserved: false,
      },
    ],
    ownedProducts: [
      {
        capturedProductId: "captured-oil-pre",
        userProductId: "user-oil-pre",
        productId: "product-oil-pre",
        displayName: "Oil Pre-Wash",
        category: "oil",
        role: "pre_wash_fibre_treatment",
        frequencyRange: "weekly_2x",
        choiceState: "owned_active",
        sourceDecisionKey: "decision:oil:pre_wash_fibre_treatment:owned-oil-pre",
      },
      {
        capturedProductId: "captured-oil-dry",
        userProductId: "user-oil-dry",
        productId: "product-oil-dry",
        displayName: "Oil Dry Finish",
        category: "oil",
        role: "dry_finish",
        frequencyRange: "weekly_2x",
        choiceState: "owned_active",
        sourceDecisionKey: "decision:oil:dry_finish:owned-oil-dry",
      },
    ],
    plannedPurchases: [],
    pendingProducts: [],
    uncoveredRoles: [],
  } as unknown as ProposedProductPortfolio

  const testSnapshot = {
    ...refinedNeedSnapshot,
    decisions: [refinedNeedSnapshot.decisions[0]!, oilDecision as never],
    renderedOrder: ["conditioner", "oil"],
  } as unknown as InitialNeedPlanSnapshot

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSnapshot: testPortfolio as never,
    refinedNeedSnapshot: testSnapshot,
  })
  const payload = candidate.payload as Record<string, any>

  const preWashItem = payload.items.find(
    (item: Record<string, any>) => item.role === "pre_wash_fibre_treatment",
  )
  const dryFinishItem = payload.items.find(
    (item: Record<string, any>) => item.role === "dry_finish",
  )

  assert.equal(preWashItem?.state.systemAssessment, "basis")
  assert.equal(dryFinishItem?.state.systemAssessment, "optional")
})

test("categories without per-role tiers keep the category assessment", async () => {
  // scalp_care roleTargets have no tier field → systemAssessment === decision.needTier
  const scalpDecision = {
    category: "scalp_care",
    needTier: "optional",
    roles: ["scalp_comfort"],
    target: {
      category: "scalp_care",
      roles: ["scalp_comfort"],
      roleTargets: [
        {
          role: "scalp_comfort",
          coverage: "primary",
        },
      ],
    },
    frequency: {
      kind: "role_keyed_product_protocol",
      roleFrequencies: [
        {
          role: "scalp_comfort",
          cadence: "regular_according_to_product",
        },
      ],
    },
    reasons: [{ id: "scalp.v1" }],
  }

  const testPortfolio = {
    ...portfolio(),
    categoryResolutions: [
      {
        decisionKey: "decision:scalp_care:scalp_comfort:owned-scalp",
        category: "scalp_care",
        role: "scalp_comfort",
        verdict: "ideal",
        choiceState: "owned_active",
        capturedProductId: "captured-scalp",
        executable: true,
        gapPreserved: false,
      },
    ],
    ownedProducts: [
      {
        capturedProductId: "captured-scalp",
        userProductId: "user-scalp",
        productId: "product-scalp",
        displayName: "Scalp Care",
        category: "scalp_care",
        role: "scalp_comfort",
        frequencyRange: "weekly_2x",
        choiceState: "owned_active",
        sourceDecisionKey: "decision:scalp_care:scalp_comfort:owned-scalp",
      },
    ],
    plannedPurchases: [],
    pendingProducts: [],
    uncoveredRoles: [],
  } as unknown as ProposedProductPortfolio

  const testSnapshot = {
    ...refinedNeedSnapshot,
    decisions: [refinedNeedSnapshot.decisions[0]!, scalpDecision as never],
    renderedOrder: ["conditioner", "scalp_care"],
  } as unknown as InitialNeedPlanSnapshot

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSnapshot: testPortfolio as never,
    refinedNeedSnapshot: testSnapshot,
  })
  const payload = candidate.payload as Record<string, any>

  const scalpItem = payload.items.find(
    (item: Record<string, any>) => item.category === "scalp_care",
  )

  assert.equal(scalpItem?.state.systemAssessment, "optional")
})
