import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanPortfolioCoverageFact,
  PlanProductRole,
  PlanReasonFact,
} from "@/lib/personal-plan/types"
import { isProductFrequencyAtLeast, type ProductFrequency } from "@/lib/vocabulary/frequencies"

import { CATEGORY_ROLE_POLICIES } from "./authorities"
import type {
  PersonalPlanCategory,
  Stage3AuthorityDraftInput,
  Stage3AuthoritySnapshotV1,
  Stage3CategoryRequirement,
  Stage3InventoryAuthorityV1,
  Stage3NeedMaterialDelta,
  Stage3ProductDraft,
  Stage3ProductLoadResolutionV1,
} from "./contracts"

const LOW_OR_NO_WET_WASH_FREQUENCIES = new Set([
  "does_not_wash",
  "less_than_monthly",
  "monthly_1x",
  "biweekly_1x",
  "weekly_1x",
])

const SUPPLEMENTAL_CATEGORIES = ["deep_cleansing_shampoo", "scalp_care"] as const

type SupplementalCategory = (typeof SUPPLEMENTAL_CATEGORIES)[number]
type ScalpCareRole = Extract<
  PlanProductRole,
  "scalp_comfort" | "scalp_flake_oil_adjunct" | "density_claim_tonic" | "scalp_exfoliant"
>

type CapturedLoadFacts = {
  dryShampooFrequency: ProductFrequency | null
  leaveInFrequency: ProductFrequency | null
  finishingOilFrequency: ProductFrequency | null
}

type ScalpLoadFacts = {
  dryShampooFrequency: ProductFrequency | null
  scalpOilFrequency: ProductFrequency | null
}

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  source: PlanReasonFact["evidence"][number]["source"],
  key: string,
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return { id, salience, evidence: [{ source, key }], values }
}

function chooseHigher(left: ProductFrequency | null, right: ProductFrequency): ProductFrequency {
  if (!left) return right
  return isProductFrequencyAtLeast(left, right) ? left : right
}

function capturedLoadFacts(draft: Stage3AuthorityDraftInput): CapturedLoadFacts {
  let dryShampooFrequency: ProductFrequency | null = null
  let leaveInFrequency: ProductFrequency | null = null
  let finishingOilFrequency: ProductFrequency | null = null
  const oilProducts = draft.products.filter((product) => product.identity.category === "oil")
  const useCategoryLevelOilPurpose = oilProducts.length === 1
  const dryFinishProductIds = new Set(
    draft.roleAssignments
      .filter(
        (assignment) => assignment.category === "oil" && assignment.roles.includes("dry_finish"),
      )
      .map((assignment) => assignment.capturedProductId),
  )

  for (const product of draft.products) {
    if (product.identity.category === "dry_shampoo") {
      dryShampooFrequency = chooseHigher(dryShampooFrequency, product.frequencyRange)
    }
    if (product.identity.category === "leave_in") {
      leaveInFrequency = chooseHigher(leaveInFrequency, product.frequencyRange)
    }
    if (
      product.identity.category === "oil" &&
      (dryFinishProductIds.has(product.capturedProductId) ||
        (useCategoryLevelOilPurpose &&
          draft.authoritySnapshot?.productLoadContext?.oilPurposes.includes("dry_finish")))
    ) {
      finishingOilFrequency = chooseHigher(finishingOilFrequency, product.frequencyRange)
    }
  }

  return { dryShampooFrequency, leaveInFrequency, finishingOilFrequency }
}

function scalpLoadFacts(draft: Stage3AuthorityDraftInput): ScalpLoadFacts {
  let dryShampooFrequency: ProductFrequency | null = null
  let scalpOilFrequency: ProductFrequency | null = null
  const oilProducts = draft.products.filter((product) => product.identity.category === "oil")
  const useCategoryLevelOilPurpose = oilProducts.length === 1
  for (const product of draft.products) {
    if (product.identity.category === "dry_shampoo") {
      dryShampooFrequency = chooseHigher(dryShampooFrequency, product.frequencyRange)
    }
    if (
      product.identity.category === "oil" &&
      useCategoryLevelOilPurpose &&
      draft.authoritySnapshot?.productLoadContext?.oilPurposes.includes("scalp")
    ) {
      scalpOilFrequency = chooseHigher(scalpOilFrequency, product.frequencyRange)
    }
  }
  return { dryShampooFrequency, scalpOilFrequency }
}

function scalpCareCadence(role: ScalpCareRole) {
  if (role === "scalp_exfoliant") return "occasional_according_to_product" as const
  if (role === "scalp_comfort") return "as_needed_according_to_product" as const
  return "regular_according_to_product" as const
}

function capturedFrequencyFingerprint(
  draft: Stage3AuthorityDraftInput,
  snapshot: Stage3AuthoritySnapshotV1,
): string {
  return semanticHash({
    refinedNeedVersionId: draft.refinedVersionId,
    refinedInputHash: snapshot.refinedInputHash,
    products: draft.products
      .map((product) => ({
        capturedProductId: product.capturedProductId,
        category: product.identity.category,
        identityKind: product.identity.kind,
        frequencyRange: product.frequencyRange,
      }))
      .sort((left, right) => left.capturedProductId.localeCompare(right.capturedProductId)),
    roleAssignments: draft.roleAssignments
      .map((assignment) => ({
        capturedProductId: assignment.capturedProductId,
        category: assignment.category,
        roles: [...assignment.roles].sort(),
      }))
      .sort((left, right) => left.capturedProductId.localeCompare(right.capturedProductId)),
  })
}

export function stage3InventorySnapshotFingerprint(
  draft: Stage3AuthorityDraftInput,
  snapshot: Stage3AuthoritySnapshotV1 = draft.authoritySnapshot!,
): string {
  return semanticHash({
    computationVersion: "stage3.inventory_authority.v1",
    refinedNeedVersionId: draft.refinedVersionId,
    refinedInputHash: snapshot.refinedInputHash,
    products: draft.products
      .map((product) => ({
        capturedProductId: product.capturedProductId,
        userProductId: product.userProductId,
        category: product.identity.category,
        identity:
          product.identity.kind === "catalog_product"
            ? { kind: product.identity.kind, productId: product.identity.productId }
            : { kind: product.identity.kind, submissionId: product.identity.submissionId },
        frequencyRange: product.frequencyRange,
        source: product.source,
      }))
      .sort((left, right) => left.capturedProductId.localeCompare(right.capturedProductId)),
    roleAssignments: draft.roleAssignments
      .map((assignment) => ({
        capturedProductId: assignment.capturedProductId,
        category: assignment.category,
        roles: [...assignment.roles].sort(),
      }))
      .sort((left, right) => left.capturedProductId.localeCompare(right.capturedProductId)),
  })
}

function baseDecision(
  snapshot: Stage3AuthoritySnapshotV1,
  category: SupplementalCategory,
): PlanCategoryDecision | null {
  return snapshot.categoryDecisions.find((decision) => decision.category === category) ?? null
}

function tierRank(decision: PlanCategoryDecision | null): number {
  if (!decision || decision.needTier === null || decision.needTier === "not_needed") return 0
  if (decision.needTier === "optional") return 1
  if (
    decision.category === "deep_cleansing_shampoo" &&
    decision.frequency?.kind === "every_nth_wash" &&
    decision.frequency.every === 3
  ) {
    return 3
  }
  return 2
}

function included(decision: PlanCategoryDecision | undefined): boolean {
  return decision?.needTier === "basis" || decision?.needTier === "optional"
}

function deepCleansingDecision(
  draft: Stage3AuthorityDraftInput,
  snapshot: Stage3AuthoritySnapshotV1,
): PlanCategoryDecision | null {
  const context = snapshot.productLoadContext
  if (!context) return null
  const facts = capturedLoadFacts(draft)
  const reasons: PlanReasonFact[] = []
  const oilyScalp = context.scalpOiliness === "oily"
  let resetLoad = oilyScalp ? 1 : 0
  let hasLoadSignal = oilyScalp

  if (oilyScalp) {
    reasons.push(
      reason("deep_cleansing.load.oily_scalp", "primary", "assessment", "productLoadContext", {
        points: 1,
      }),
    )
  }

  if (facts.dryShampooFrequency) {
    if (isProductFrequencyAtLeast(facts.dryShampooFrequency, "weekly_3_4x")) {
      resetLoad += 2
      reasons.push(
        reason(
          "deep_cleansing.load.dry_shampoo_frequent",
          "primary",
          "assessment",
          "capturedFrequency",
          { points: 2 },
        ),
      )
    } else if (isProductFrequencyAtLeast(facts.dryShampooFrequency, "weekly_1x")) {
      resetLoad += 1
      reasons.push(
        reason(
          "deep_cleansing.load.dry_shampoo_regular",
          "primary",
          "assessment",
          "capturedFrequency",
          { points: 1 },
        ),
      )
    }
    hasLoadSignal ||= isProductFrequencyAtLeast(facts.dryShampooFrequency, "weekly_1x")
  }

  if (facts.leaveInFrequency && isProductFrequencyAtLeast(facts.leaveInFrequency, "weekly_1x")) {
    resetLoad += 1
    hasLoadSignal = true
    reasons.push(
      reason("deep_cleansing.load.leave_in", "secondary", "assessment", "capturedFrequency", {
        points: 1,
      }),
    )
  }

  if (
    facts.finishingOilFrequency &&
    isProductFrequencyAtLeast(facts.finishingOilFrequency, "weekly_1x")
  ) {
    resetLoad += 1
    hasLoadSignal = true
    reasons.push(
      reason("deep_cleansing.load.finishing_oil", "secondary", "assessment", "capturedFrequency", {
        points: 1,
      }),
    )
  }

  if (
    context.shampooFrequency &&
    LOW_OR_NO_WET_WASH_FREQUENCIES.has(context.shampooFrequency) &&
    hasLoadSignal
  ) {
    resetLoad += 1
    reasons.push(
      reason(
        "deep_cleansing.load.low_wash_relative_to_load",
        "secondary",
        "assessment",
        "productLoadContext",
        { points: 1 },
      ),
    )
  }

  if (context.hasLowVolumeOrWeighedDown && hasLoadSignal) {
    resetLoad += 1
    reasons.push(
      reason(
        "deep_cleansing.load.weighed_down_corroboration",
        "primary",
        "assessment",
        "productLoadContext",
        { points: 1 },
      ),
    )
  }

  if (resetLoad === 0) return null

  const inclusion =
    resetLoad === 1
      ? { id: "deep_cleansing.inclusion.optional", tier: "optional" as const }
      : resetLoad >= 4
        ? { id: "deep_cleansing.inclusion.high_load", tier: "basis" as const }
        : { id: "deep_cleansing.inclusion.basis", tier: "basis" as const }

  const decision: PlanCategoryDecision = {
    category: "deep_cleansing_shampoo",
    resolution: "resolved",
    needTier: inclusion.tier,
    roles: ["residue_reset"],
    target: { category: "deep_cleansing_shampoo", roles: ["residue_reset"] },
    frequency:
      resetLoad === 1
        ? {
            kind: "unscheduled_as_needed",
            roles: ["residue_reset"],
            boundary: "bei_bedarf",
          }
        : {
            kind: "every_nth_wash",
            roles: ["residue_reset"],
            every: resetLoad >= 4 ? 3 : 4,
            substitutesRegularShampoo: true,
          },
    reasons: [
      ...reasons,
      reason(inclusion.id, "primary", "assessment", "stage3ProductLoad", { resetLoad }),
    ],
    executionState: context.deepCleansingScalpPause ? "paused" : "available",
    executionPauseReason: context.deepCleansingScalpPause
      ? reason("deep_cleansing.safety.scalp_pause", "primary", "assessment", "productLoadContext")
      : null,
    deferredFacts: [],
  }

  return tierRank(decision) > tierRank(baseDecision(snapshot, "deep_cleansing_shampoo"))
    ? decision
    : null
}

function scalpCareDecision(
  draft: Stage3AuthorityDraftInput,
  snapshot: Stage3AuthoritySnapshotV1,
): PlanCategoryDecision | null {
  const existing = baseDecision(snapshot, "scalp_care")
  if (existing?.executionState === "paused") return null
  const facts = scalpLoadFacts(draft)
  if (
    !(
      (facts.dryShampooFrequency &&
        isProductFrequencyAtLeast(facts.dryShampooFrequency, "weekly_1x")) ||
      (facts.scalpOilFrequency && isProductFrequencyAtLeast(facts.scalpOilFrequency, "weekly_1x"))
    )
  ) {
    return null
  }
  const existingRoles = new Set(existing?.roles ?? [])
  if (existingRoles.has("scalp_exfoliant")) return null
  const sourceFacts = [
    facts.dryShampooFrequency && isProductFrequencyAtLeast(facts.dryShampooFrequency, "weekly_1x")
      ? "scalp_care.buildup.dry_shampoo_target"
      : null,
    facts.scalpOilFrequency && isProductFrequencyAtLeast(facts.scalpOilFrequency, "weekly_1x")
      ? "scalp_care.buildup.root_regular"
      : null,
  ].filter((value): value is string => Boolean(value))
  const roles = [
    ...(existing?.roles.filter((role): role is ScalpCareRole =>
      CATEGORY_ROLE_POLICIES.scalp_care.allowedRoles.includes(role as never),
    ) ?? []),
    "scalp_exfoliant" as const,
  ].filter((role, index, all): role is ScalpCareRole => all.indexOf(role) === index)
  const roleFrequencies =
    existing?.frequency?.kind === "role_keyed_product_protocol"
      ? roles.map((role) => {
          const current =
            existing.frequency?.kind === "role_keyed_product_protocol"
              ? existing.frequency.roleFrequencies.find((item) => item.role === role)
              : undefined
          return (
            current ?? {
              role,
              cadence: scalpCareCadence(role),
            }
          )
        })
      : roles.map((role) => ({
          role,
          cadence: scalpCareCadence(role),
        }))

  return {
    category: "scalp_care",
    resolution: "resolved",
    needTier:
      existing?.needTier && existing.needTier !== "not_needed" ? existing.needTier : "optional",
    roles,
    target: {
      category: "scalp_care",
      roles,
      roleTargets: roles.map((role) => ({
        role,
        coverage:
          role === "scalp_comfort" || role === "scalp_flake_oil_adjunct" ? "supporting" : "primary",
        ...(role === "density_claim_tonic" ? { evidenceLevel: "limited_evidence" as const } : {}),
      })),
    },
    frequency: {
      kind: "role_keyed_product_protocol",
      roleFrequencies,
    },
    reasons: [
      ...(existing?.reasons ?? []),
      reason("scalp_care.role.exfoliant", "primary", "assessment", "capturedFrequency", {
        sourceFacts: sourceFacts.join(","),
      }),
      reason("scalp_care.inclusion.optional_union", "primary", "assessment", "stage3ProductLoad", {
        roles: roles.join(","),
      }),
    ],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}

function requirement(decision: PlanCategoryDecision): Stage3CategoryRequirement {
  const policy = CATEGORY_ROLE_POLICIES[decision.category as SupplementalCategory]
  return {
    category: decision.category as SupplementalCategory,
    requiredRoles: [...decision.roles],
    needSummary:
      decision.category === "deep_cleansing_shampoo"
        ? "Entfernt Ablagerungen und klärt Haar und Kopfhaut nach aktueller Produktlast."
        : "Unterstützt die Kopfhaut nach aktueller Ansatz-Produktlast.",
    authorityVersion: policy.authorityVersion,
  }
}

function coverage(decisions: readonly PlanCategoryDecision[]): PlanPortfolioCoverageFact[] {
  const deepCleansing = decisions.find((decision) => decision.category === "deep_cleansing_shampoo")
  const scalpCare = decisions.find((decision) => decision.category === "scalp_care")
  if (!included(deepCleansing) || !scalpCare?.roles.includes("scalp_exfoliant")) {
    return []
  }
  return [
    {
      job: "scalp_root_reset",
      ruleId: "portfolio.reset.deep_cleansing_primary",
      primaryCategories: ["deep_cleansing_shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    },
  ]
}

function effectiveDecisions(
  snapshot: Stage3AuthoritySnapshotV1,
  overlayDecisions: readonly PlanCategoryDecision[],
  baseDecisions: readonly PlanCategoryDecision[] = [],
): PlanCategoryDecision[] {
  const byCategory = new Map<PersonalPlanCategory, PlanCategoryDecision>()
  for (const decision of baseDecisions) {
    byCategory.set(decision.category as PersonalPlanCategory, decision)
  }
  for (const decision of snapshot.categoryDecisions) {
    byCategory.set(decision.category as PersonalPlanCategory, decision)
  }
  for (const decision of overlayDecisions) {
    byCategory.set(decision.category as PersonalPlanCategory, decision)
  }
  return Array.from(byCategory.values())
}

function coverageKey(fact: PlanPortfolioCoverageFact): string {
  return `${fact.ruleId}:${fact.job}`
}

function coverageDelta(
  snapshot: Stage3AuthoritySnapshotV1,
  overlayDecisions: readonly PlanCategoryDecision[],
): PlanPortfolioCoverageFact[] {
  const baseKeys = new Set(snapshot.coverage.map(coverageKey))
  return coverage(effectiveDecisions(snapshot, overlayDecisions)).filter(
    (fact) => !baseKeys.has(coverageKey(fact)),
  )
}

export function resolveStage3ProductLoadResolution(
  draft: Stage3AuthorityDraftInput,
): Stage3ProductLoadResolutionV1 | undefined {
  const snapshot = draft.authoritySnapshot
  if (!snapshot || snapshot.refinedNeedVersionId !== draft.refinedVersionId) return undefined

  const decisions = [deepCleansingDecision(draft, snapshot), scalpCareDecision(draft, snapshot)]
    .filter((decision): decision is PlanCategoryDecision => Boolean(decision))
    .filter((decision) =>
      SUPPLEMENTAL_CATEGORIES.includes(decision.category as SupplementalCategory),
    )

  if (decisions.length === 0) return undefined
  return {
    schemaVersion: 1,
    refinedNeedVersionId: draft.refinedVersionId,
    refinedInputHash: snapshot.refinedInputHash,
    capturedFrequencyFingerprint: capturedFrequencyFingerprint(draft, snapshot),
    authorityVersions: Object.fromEntries(
      decisions.map((decision) => [
        decision.category,
        CATEGORY_ROLE_POLICIES[decision.category as SupplementalCategory].authorityVersion,
      ]),
    ),
    requirements: decisions.map(requirement),
    decisions,
    coverage: coverageDelta(snapshot, decisions),
  }
}

function includedDecision(decision: PlanCategoryDecision | undefined): boolean {
  return decision?.needTier === "basis" || decision?.needTier === "optional"
}

function decisionByCategory(decisions: readonly PlanCategoryDecision[]) {
  return new Map(decisions.map((decision) => [decision.category as PersonalPlanCategory, decision]))
}

function materialComparableDecision(decision: PlanCategoryDecision | undefined) {
  if (!decision) return null
  return {
    needTier: decision.needTier,
    roles: [...decision.roles].sort(),
    frequency: decision.frequency,
    executionState: decision.executionState,
    executionPauseReason: decision.executionPauseReason?.id ?? null,
  }
}

function renderedOrderFromDecisions(decisions: readonly PlanCategoryDecision[]) {
  return decisions
    .filter(includedDecision)
    .map((decision) => decision.category as PersonalPlanCategory)
}

export function compareStage3NeedMaterialDelta(
  baseDecisions: readonly PlanCategoryDecision[],
  proposedDecisions: readonly PlanCategoryDecision[],
): Stage3NeedMaterialDelta[] {
  const baseByCategory = decisionByCategory(baseDecisions)
  const proposedByCategory = decisionByCategory(proposedDecisions)
  const baseRenderedOrder = renderedOrderFromDecisions(baseDecisions)
  const proposedRenderedOrder = renderedOrderFromDecisions(proposedDecisions)
  const categories = new Set<PersonalPlanCategory>([
    ...baseByCategory.keys(),
    ...proposedByCategory.keys(),
  ])
  const delta: Stage3NeedMaterialDelta[] = []

  for (const category of categories) {
    const before = baseByCategory.get(category)
    const after = proposedByCategory.get(category)
    const beforeIncluded = includedDecision(before)
    const afterIncluded = includedDecision(after)
    if (!beforeIncluded && afterIncluded) {
      delta.push({
        kind: "category_added",
        category,
        before: before?.needTier ?? null,
        after: after?.needTier ?? null,
      })
      continue
    }
    if (beforeIncluded && !afterIncluded) {
      delta.push({
        kind: "category_removed",
        category,
        before: before?.needTier ?? null,
        after: after?.needTier ?? null,
      })
      continue
    }
    if (!before || !after) continue

    const beforeComparable = materialComparableDecision(before)
    const afterComparable = materialComparableDecision(after)
    if (beforeComparable?.needTier !== afterComparable?.needTier) {
      delta.push({
        kind: "need_tier_changed",
        category,
        before: beforeComparable?.needTier ?? null,
        after: afterComparable?.needTier ?? null,
      })
    }
    if (semanticHash(beforeComparable?.roles ?? []) !== semanticHash(afterComparable?.roles ?? [])) {
      delta.push({
        kind: "roles_changed",
        category,
        before: beforeComparable?.roles ?? [],
        after: afterComparable?.roles ?? [],
      })
    }
    if (semanticHash(beforeComparable?.frequency) !== semanticHash(afterComparable?.frequency)) {
      delta.push({
        kind: "frequency_changed",
        category,
        before: beforeComparable?.frequency ?? null,
        after: afterComparable?.frequency ?? null,
      })
    }
    if (
      beforeComparable?.executionState !== afterComparable?.executionState ||
      beforeComparable?.executionPauseReason !== afterComparable?.executionPauseReason
    ) {
      delta.push({
        kind: "execution_changed",
        category,
        before: {
          state: beforeComparable?.executionState,
          pauseReason: beforeComparable?.executionPauseReason,
        },
        after: {
          state: afterComparable?.executionState,
          pauseReason: afterComparable?.executionPauseReason,
        },
      })
    }
  }

  for (const category of new Set([...baseRenderedOrder, ...proposedRenderedOrder])) {
    const before = baseRenderedOrder.includes(category) ? baseRenderedOrder.indexOf(category) : null
    const after = proposedRenderedOrder.includes(category)
      ? proposedRenderedOrder.indexOf(category)
      : null
    if (before !== after) {
      delta.push({ kind: "category_order_changed", category, before, after })
    }
  }

  return delta
}

export function buildStage3ProposedRefinedSnapshot(
  draft: Stage3AuthorityDraftInput,
  baseSnapshot?: InitialNeedPlanSnapshot,
): InitialNeedPlanSnapshot | null {
  const snapshot = draft.authoritySnapshot
  if (!snapshot || snapshot.refinedNeedVersionId !== draft.refinedVersionId) return null
  if (baseSnapshot && baseSnapshot.inputHash !== snapshot.refinedInputHash) {
    throw new Error("stage3_authority_base_snapshot_mismatch")
  }
  const resolution = resolveStage3ProductLoadResolution(draft)
  if (!resolution) return null
  const decisions = effectiveDecisions(snapshot, resolution.decisions, baseSnapshot?.decisions)
  const coverageFacts = effectiveCoverage(snapshot, resolution.coverage)
  const renderedOrder = renderedOrderFromDecisions(decisions)
  const inputHash = semanticHash({
    computationVersion: "stage3.product_load_refined_snapshot.v1",
    refinedInputHash: snapshot.refinedInputHash,
    inventorySnapshotFingerprint: stage3InventorySnapshotFingerprint(draft, snapshot),
    decisions,
    coverage: coverageFacts,
  })

  return {
    ...(baseSnapshot ?? {
      schemaVersion: 1,
      snapshotKind: "initial_need",
      sourceQuiz: {
        kind: "personal_plan",
        version: 2,
        answers: {},
      },
      profile: {
        source: { projection: "refined_post_plan" },
        scalp: {
          oiliness: snapshot.productLoadContext?.scalpOiliness ?? "balanced",
          concerns: [],
        },
        concerns: [],
        routine: null,
      },
      assessments: {},
      productPreviews: [],
      deferredFacts: [],
    }),
    schemaVersion: 1,
    snapshotKind: "initial_need",
    computationVersion: "stage3.product_load_refined_snapshot.v1",
    inputHash,
    createdAt: baseSnapshot?.createdAt ?? new Date(0).toISOString(),
    decisions,
    coverage: coverageFacts,
    renderedOrder,
  } as unknown as InitialNeedPlanSnapshot
}

function effectiveCoverage(
  snapshot: Stage3AuthoritySnapshotV1,
  overlayCoverage: readonly PlanPortfolioCoverageFact[],
): PlanPortfolioCoverageFact[] {
  const byKey = new Map<string, PlanPortfolioCoverageFact>()
  for (const fact of snapshot.coverage) byKey.set(coverageKey(fact), fact)
  for (const fact of overlayCoverage) byKey.set(coverageKey(fact), fact)
  return Array.from(byKey.values())
}

export function resolveStage3InventoryAuthority(
  draft: Stage3AuthorityDraftInput,
  baseSnapshot?: InitialNeedPlanSnapshot,
): Stage3InventoryAuthorityV1 | undefined {
  const snapshot = draft.authoritySnapshot
  if (!snapshot || snapshot.refinedNeedVersionId !== draft.refinedVersionId) return undefined
  const inventorySnapshotFingerprint = stage3InventorySnapshotFingerprint(draft, snapshot)
  const proposedOutputSnapshot = buildStage3ProposedRefinedSnapshot(draft, baseSnapshot)
  if (!proposedOutputSnapshot) {
    return {
      schemaVersion: 1,
      stage2RefinedNeedVersionId: draft.refinedVersionId,
      inventorySnapshotFingerprint,
      status: "not_needed",
      proposalFingerprint: null,
      proposedInputHash: null,
      proposedOutputSnapshot: null,
      materialDelta: [],
      resolvedFingerprint: inventorySnapshotFingerprint,
    }
  }

  const materialDelta = compareStage3NeedMaterialDelta(
    snapshot.categoryDecisions,
    proposedOutputSnapshot.decisions,
  )
  if (materialDelta.length === 0) {
    return {
      schemaVersion: 1,
      stage2RefinedNeedVersionId: draft.refinedVersionId,
      inventorySnapshotFingerprint,
      status: "not_needed",
      proposalFingerprint: null,
      proposedInputHash: null,
      proposedOutputSnapshot: null,
      materialDelta: [],
      resolvedFingerprint: inventorySnapshotFingerprint,
    }
  }

  const proposalFingerprint = semanticHash({
    inventorySnapshotFingerprint,
    proposedInputHash: proposedOutputSnapshot.inputHash,
    decisions: proposedOutputSnapshot.decisions.map(materialComparableDecision),
    coverage: proposedOutputSnapshot.coverage,
    renderedOrder: proposedOutputSnapshot.renderedOrder,
  })

  return {
    schemaVersion: 1,
    stage2RefinedNeedVersionId: draft.refinedVersionId,
    inventorySnapshotFingerprint,
    status: "pending",
    proposalFingerprint,
    proposedInputHash: proposedOutputSnapshot.inputHash,
    proposedOutputSnapshot,
    materialDelta,
    resolvedFingerprint: null,
  }
}

export function requireCurrentProductLoadResolution(draft: Stage3AuthorityDraftInput): void {
  if (!draft.productLoadResolution) return
  const current = resolveStage3ProductLoadResolution({ ...draft, productLoadResolution: undefined })
  if (
    !current ||
    draft.productLoadResolution.refinedNeedVersionId !== current.refinedNeedVersionId ||
    draft.productLoadResolution.refinedInputHash !== current.refinedInputHash ||
    draft.productLoadResolution.capturedFrequencyFingerprint !==
      current.capturedFrequencyFingerprint ||
    semanticHash(draft.productLoadResolution.decisions) !== semanticHash(current.decisions) ||
    semanticHash(draft.productLoadResolution.requirements) !== semanticHash(current.requirements) ||
    semanticHash(draft.productLoadResolution.coverage) !== semanticHash(current.coverage)
  ) {
    throw new Error("stale_product_load_resolution")
  }
}

export function effectiveStage3Requirements(
  baseRequirements: readonly Stage3CategoryRequirement[],
  draft: Stage3ProductDraft,
): Stage3CategoryRequirement[] {
  const byCategory = new Map<PersonalPlanCategory, Stage3CategoryRequirement>(
    baseRequirements.map((item) => [item.category, item]),
  )
  for (const requirement of draft.productLoadResolution?.requirements ?? []) {
    byCategory.set(requirement.category, requirement)
  }
  return Array.from(byCategory.values())
}

export function effectiveStage3CategoryDecisions(
  draft: Stage3ProductDraft,
): PlanCategoryDecision[] {
  const byCategory = new Map<PersonalPlanCategory, PlanCategoryDecision>()
  for (const decision of draft.authoritySnapshot?.categoryDecisions ?? []) {
    byCategory.set(decision.category as PersonalPlanCategory, decision)
  }
  for (const decision of draft.productLoadResolution?.decisions ?? []) {
    byCategory.set(decision.category as PersonalPlanCategory, decision)
  }
  return Array.from(byCategory.values())
}

export function effectiveStage3Coverage(draft: Stage3ProductDraft): PlanPortfolioCoverageFact[] {
  const byKey = new Map<string, PlanPortfolioCoverageFact>()
  for (const fact of draft.authoritySnapshot?.coverage ?? []) {
    byKey.set(coverageKey(fact), fact)
  }
  for (const fact of draft.productLoadResolution?.coverage ?? []) {
    if (!byKey.has(coverageKey(fact))) {
      byKey.set(coverageKey(fact), fact)
    }
  }
  return Array.from(byKey.values())
}
