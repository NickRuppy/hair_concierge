import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import type { ProposedProductPortfolio } from "../src/lib/personal-plan/products/contracts"
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
        "item:heat_protectant:pre_heat_protection:captured-pending-a",
        "item:oil:dry_finish:planned-a",
      ],
    },
  ])
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
        key: "item:heat_protectant:pre_heat_protection:captured-pending-a",
        assessment: "optional",
        inclusion: "included",
        availability: "pending_review",
        fitDecision: "standard",
        executable: false,
        productKind: "pending_review",
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

test("compiler accepts a v2 portfolio with a frozen supplemental product-load decision", async () => {
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

  const candidate = await compileInitialRoutineCandidate({
    ...compilerInput(),
    portfolioSchemaVersion: 2,
    portfolioSnapshot: supplementalPortfolio as never,
  })
  const payload = candidate.payload as Record<string, any>

  assert.equal(payload.items[0]?.category, "deep_cleansing_shampoo")
  assert.equal(payload.items[0]?.state.systemAssessment, "basis")
  assert.equal(payload.items[0]?.cadence.recommended.every, 3)
})
