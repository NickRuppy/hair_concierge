import { CATEGORY_ROLE_POLICIES } from "./products/authorities"
import type {
  PersonalPlanCategory,
  AnyProposedProductPortfolio,
  Stage3CategoryResolution,
} from "./products/contracts"
import type { JsonValue } from "./persistence"
import type {
  RoutineCandidate,
  RoutineCandidateCompiler,
  RoutineCandidateCompilerInput,
} from "./routine-proposal-stager"
import {
  STAGE1_CATEGORY_ORDER,
  type InitialNeedPlanSnapshot,
  type PlanCategoryDecision,
  type PlanProductRole,
} from "./types"
import { semanticHash } from "./routine/canonicalize"
import { applyRoutineEdits as applyEdits } from "./routine/editor"
import { diffRoutinePayloads as diffPayloads } from "./routine/diff"
import {
  resolveRoutineItemCadence,
  type ProductCadenceAuthorityFact,
  type ResolvedRoutineCadence,
} from "./routine/cadence"

export const PERSONAL_PLAN_ROUTINE_COMPILER_VERSION = "personal-plan-routine-compiler.v2"
const PORTFOLIO_AUTHORITY_VERSION = "personal-plan-product-portfolio.v1"

export type RoutineSystemAssessment = "basis" | "optional" | "not_recommended"
export type RoutineInclusion = "included" | "excluded"

export type RoutineProductRef =
  | { kind: "owned"; capturedProductId: string; productId: string }
  | { kind: "planned"; plannedPurchaseId: string; productId: string | null }
  | { kind: "pending_review"; capturedProductId: string; submissionId: string }
  | { kind: "none" }

export type RoutineAssignment = {
  assignmentKey: string
  role: PlanProductRole
  productRef: RoutineProductRef
  cadenceOverride: string | null
  fitDecision: "standard" | "informed_override"
}

export type RoutineIntentCategory = {
  category: PersonalPlanCategory
  inclusion: RoutineInclusion
  inclusionSource: "stage3" | "user"
  assignments: RoutineAssignment[]
}

export type RoutineItem = {
  itemKey: string
  assignmentKey: string
  category: PersonalPlanCategory
  role: PlanProductRole
  purposeKey: string
  roleOrder: number
  state: {
    systemAssessment: RoutineSystemAssessment
    inclusion: RoutineInclusion
    availability: "owned" | "planned" | "pending_review" | "none"
    fitDecision: "standard" | "informed_override"
  }
  product:
    | { kind: "owned"; capturedProductId: string; productId: string; displayName: string }
    | { kind: "planned"; plannedPurchaseId: string; productId: string | null; displayName: string }
    | { kind: "pending_review"; submissionId: string; displayName: string }
    | { kind: "none"; displayName: null }
  cadence: {
    recommended: PlanCategoryDecision["frequency"]
    userOverride: string | null
    displayKey: string
    resolved?: ResolvedRoutineCadence
  }
  sourceDecisionKeys: string[]
  authorityRuleIds: string[]
  executable: boolean
}

export type RoutineCompiledPayload = {
  schemaVersion: 1
  planId: string
  versionId: string
  parentVersionId: string | null
  source: {
    refinedVersionId: string
    productPortfolioVersionId: string
    sourceFingerprint: string
    compilerVersion: string
    authorityVersions: Record<string, string>
    renderedOrder?: PersonalPlanCategory[]
  }
  intent: { schemaVersion: 1; categories: RoutineIntentCategory[] }
  sections: Array<{ key: "basis" | "optional"; itemKeys: string[] }>
  items: RoutineItem[]
  createdAt?: string
}

export type RoutineEditOperation =
  | { kind: "category_inclusion"; category: PersonalPlanCategory; inclusion: RoutineInclusion }
  | { kind: "assignment_replace"; assignmentKey: string; productRef: RoutineProductRef }
  | { kind: "assignment_remove"; assignmentKey: string }
  | { kind: "assignment_role"; assignmentKey: string; role: PlanProductRole }
  | { kind: "cadence_override"; assignmentKey: string; cadenceOverride: string | null }

export type RoutineProposalDelta = {
  schemaVersion: 1
  direct: Array<{ kind: "added" | "removed" | "changed"; itemKey: string; explanationKey: string }>
  consequential: Array<{
    kind: "added" | "removed" | "changed"
    itemKey: string
    explanationKey: string
  }>
  unchangedItemCount: number
}

/** Applies bounded user intent changes, then reconstructs every item and section. */
export function applyRoutineEdits(
  input: RoutineCompiledPayload,
  operations: readonly RoutineEditOperation[],
): RoutineCompiledPayload {
  return applyEdits(input, operations)
}

/** Diffs semantic Routine state. Operation targets are direct; all recompiled effects are consequential. */
export function diffRoutinePayloads(
  previous: RoutineCompiledPayload,
  next: RoutineCompiledPayload,
  operations: readonly RoutineEditOperation[],
): RoutineProposalDelta {
  return diffPayloads(previous, next, operations)
}

/** Excludes persistence IDs, timestamps and commerce display data from semantic equality. */
export function hashRoutineSemantics(payload: RoutineCompiledPayload): string {
  return semanticHash({
    schemaVersion: payload.schemaVersion,
    source: {
      refinedVersionId: payload.source.refinedVersionId,
      compilerVersion: payload.source.compilerVersion,
      authorityVersions: payload.source.authorityVersions,
      renderedOrder: payload.source.renderedOrder,
    },
    intent: payload.intent,
    sections: payload.sections,
    items: payload.items.map(({ product, ...item }) => ({
      ...item,
      product:
        product.kind === "owned"
          ? {
              kind: product.kind,
              capturedProductId: product.capturedProductId,
              productId: product.productId,
            }
          : product.kind === "planned"
            ? {
                kind: product.kind,
                plannedPurchaseId: product.plannedPurchaseId,
                productId: product.productId,
              }
            : product.kind === "pending_review"
              ? { kind: product.kind, submissionId: product.submissionId }
              : product,
    })),
  })
}

function categoryOrder(category: PersonalPlanCategory): number {
  return STAGE1_CATEGORY_ORDER.indexOf(category)
}

function refinedRenderedOrder(snapshot: InitialNeedPlanSnapshot): PersonalPlanCategory[] {
  const raw = Array.isArray(snapshot.renderedOrder) ? snapshot.renderedOrder : []
  const unique: PersonalPlanCategory[] = []
  const seen = new Set<string>()
  for (const category of raw) {
    if (seen.has(category)) {
      throw new Error(`routine_candidate_duplicate_rendered_category:${category}`)
    }
    seen.add(category)
    unique.push(category as PersonalPlanCategory)
  }
  return unique.length > 0 ? unique : [...STAGE1_CATEGORY_ORDER]
}

function roleOrder(category: PersonalPlanCategory, role: PlanProductRole): number {
  return CATEGORY_ROLE_POLICIES[category].allowedRoles.indexOf(role as never)
}

function sourceIdentity(
  resolution: Stage3CategoryResolution,
  portfolio: AnyProposedProductPortfolio,
): string {
  const owned = portfolio.ownedProducts.find(
    (product) => product.sourceDecisionKey === resolution.decisionKey,
  )
  if (owned) return owned.capturedProductId
  const decisionKeyedPlanned =
    portfolio.schemaVersion === 3 || portfolio.schemaVersion === 4
      ? findPlannedPurchase(portfolio, resolution)
      : undefined
  if (decisionKeyedPlanned) return decisionKeyedPlanned.plannedPurchaseId
  const pending = portfolio.pendingProducts.find(
    (product) => product.capturedProductId === resolution.capturedProductId,
  )
  if (pending) return pending.capturedProductId
  return findPlannedPurchase(portfolio, resolution)?.plannedPurchaseId ?? "none"
}

function findPlannedPurchase(
  portfolio: AnyProposedProductPortfolio,
  resolution: Stage3CategoryResolution,
) {
  return portfolio.schemaVersion === 3 || portfolio.schemaVersion === 4
    ? portfolio.plannedPurchases.find(
        (product) => product.sourceDecisionKey === resolution.decisionKey,
      )
    : portfolio.plannedPurchases.find(
        (product) => product.category === resolution.category && product.role === resolution.role,
      )
}

function assessment(decision: PlanCategoryDecision, role: string): RoutineSystemAssessment {
  const roleTargets =
    decision.target && "roleTargets" in decision.target ? (decision.target.roleTargets ?? []) : []
  const roleTarget = roleTargets.find(
    (candidate) => candidate.role === role && "tier" in candidate && candidate.tier,
  ) as { tier?: string } | undefined
  const tier = roleTarget?.tier ?? decision.needTier
  if (tier === "basis" || tier === "optional") return tier as RoutineSystemAssessment
  if (tier === "not_needed") return "not_recommended"
  throw new Error(`routine_candidate_unresolved_refined_decision:${decision.category}`)
}

function inclusion(resolution: Stage3CategoryResolution): RoutineInclusion {
  return resolution.choiceState === "inactive" || resolution.choiceState === "unassigned"
    ? "excluded"
    : "included"
}

function makeItem(input: {
  resolution: Stage3CategoryResolution
  decision: PlanCategoryDecision
  portfolio: AnyProposedProductPortfolio
  cadenceAuthorityFacts: readonly ProductCadenceAuthorityFact[]
}): RoutineItem {
  const { resolution, decision, portfolio, cadenceAuthorityFacts } = input
  if (!resolution.role) {
    throw new Error(`routine_candidate_missing_role:${resolution.decisionKey}`)
  }
  if (
    !CATEGORY_ROLE_POLICIES[resolution.category].allowedRoles.includes(resolution.role as never)
  ) {
    throw new Error(`routine_candidate_invalid_role:${resolution.decisionKey}`)
  }

  const identity = sourceIdentity(resolution, portfolio)
  const assignmentKey = `assignment:${resolution.category}:${resolution.role}:${identity}`
  const itemKey = `item:${resolution.category}:${resolution.role}:${identity}`
  const owned = portfolio.ownedProducts.find(
    (product) => product.sourceDecisionKey === resolution.decisionKey,
  )
  const pending = portfolio.pendingProducts.find(
    (product) => product.capturedProductId === resolution.capturedProductId,
  )
  const planned = findPlannedPurchase(portfolio, resolution)
  const included = inclusion(resolution)

  let availability: RoutineItem["state"]["availability"] = "none"
  let product: RoutineItem["product"] = { kind: "none", displayName: null }
  if (owned) {
    availability = "owned"
    product = {
      kind: "owned",
      capturedProductId: owned.capturedProductId,
      productId: owned.productId,
      displayName: owned.displayName,
    }
  } else if (planned) {
    availability = "planned"
    product = {
      kind: "planned",
      plannedPurchaseId: planned.plannedPurchaseId,
      productId: planned.productId,
      displayName: planned.displayName,
    }
  } else if (pending) {
    availability = "pending_review"
    product = {
      kind: "pending_review",
      submissionId: pending.submissionId,
      displayName: pending.displayName,
    }
  }

  if (resolution.executable && (!owned || included !== "included")) {
    throw new Error(`routine_candidate_invalid_executable_state:${resolution.decisionKey}`)
  }

  const productId =
    product.kind === "owned" || product.kind === "planned" ? product.productId : null
  const resolved = resolveRoutineItemCadence({
    category: resolution.category,
    role: resolution.role,
    productId,
    recommended: decision.frequency,
    userOverride: null,
    authorityFacts: cadenceAuthorityFacts,
  })
  return {
    itemKey,
    assignmentKey,
    category: resolution.category,
    role: resolution.role,
    purposeKey: resolution.role,
    roleOrder: roleOrder(resolution.category, resolution.role),
    state: {
      systemAssessment: assessment(decision, resolution.role),
      inclusion: included,
      availability,
      fitDecision: resolution.choiceState === "owned_override" ? "informed_override" : "standard",
    },
    product,
    cadence: {
      recommended: decision.frequency,
      userOverride: null,
      displayKey: decision.frequency
        ? `personal_plan.cadence.${decision.frequency.kind}`
        : "personal_plan.cadence.none",
      ...(resolved ? { resolved } : {}),
    },
    sourceDecisionKeys: [resolution.decisionKey],
    authorityRuleIds: Array.from(
      new Set([
        ...decision.reasons.map((reason) => reason.id),
        ...(planned ? [planned.authorityRuleId] : []),
      ]),
    ).sort(),
    executable: resolution.executable && included === "included" && Boolean(owned),
  }
}

function sortItemsForRenderedOrder(renderedOrder: readonly PersonalPlanCategory[]) {
  const rank = new Map(renderedOrder.map((category, index) => [category, index]))
  const fallback = renderedOrder.length
  return (left: RoutineItem, right: RoutineItem): number =>
    (rank.get(left.category) ?? fallback + categoryOrder(left.category)) -
      (rank.get(right.category) ?? fallback + categoryOrder(right.category)) ||
    left.roleOrder - right.roleOrder ||
    left.assignmentKey.localeCompare(right.assignmentKey)
}

function productRef(item: RoutineItem): RoutineProductRef {
  if (item.product.kind === "owned") {
    return {
      kind: "owned",
      capturedProductId: item.product.capturedProductId,
      productId: item.product.productId,
    }
  }
  if (item.product.kind === "planned") {
    return {
      kind: "planned",
      plannedPurchaseId: item.product.plannedPurchaseId,
      productId: item.product.productId,
    }
  }
  if (item.product.kind === "pending_review") {
    const pendingItem = item.product
    return {
      kind: "pending_review",
      capturedProductId: item.assignmentKey.split(":").at(-1) ?? "",
      submissionId: pendingItem.submissionId,
    }
  }
  return { kind: "none" }
}

export async function compileInitialRoutineCandidate(
  input: RoutineCandidateCompilerInput,
): Promise<RoutineCandidate> {
  const portfolio = input.portfolioSnapshot as unknown as AnyProposedProductPortfolio
  if (
    ![1, 2, 3, 4].includes(input.portfolioSchemaVersion) ||
    ![1, 2, 3, 4].includes(portfolio.schemaVersion) ||
    input.portfolioSchemaVersion !== portfolio.schemaVersion ||
    portfolio.personalPlanId !== input.personalPlanId
  ) {
    // SQL owns the authoritative refined-version FK comparison while holding
    // the aggregate lock; the compiler still rejects malformed plan/schema
    // projections before issuing that one RPC.
    throw new Error("routine_candidate_invalid_portfolio_source")
  }

  const decisions = new Map(
    [
      ...input.refinedNeedSnapshot.decisions,
      ...(portfolio.productLoadResolution?.decisions ?? []),
    ].map((decision) => [decision.category, decision]),
  )
  const renderedOrder = refinedRenderedOrder(input.refinedNeedSnapshot)
  const renderedCategories = new Set(renderedOrder)
  const items = portfolio.categoryResolutions.map((resolution) => {
    const decision = decisions.get(resolution.category)
    if (!decision) {
      throw new Error(`routine_candidate_missing_refined_decision:${resolution.category}`)
    }
    return makeItem({
      resolution,
      decision,
      portfolio,
      cadenceAuthorityFacts: input.cadenceAuthorityFacts ?? [],
    })
  })
  for (const item of items) {
    const visibleInRoutine =
      item.state.systemAssessment === "basis" ||
      item.state.systemAssessment === "optional" ||
      item.state.inclusion === "included"
    if (visibleInRoutine && !renderedCategories.has(item.category)) {
      throw new Error(`routine_candidate_category_outside_rendered_order:${item.category}`)
    }
  }
  items.sort(sortItemsForRenderedOrder(renderedOrder))

  const authorityVersions: Record<string, string> = Object.fromEntries(
    [...new Set(items.map((item) => item.category))]
      .sort()
      .map((category) => [category, CATEGORY_ROLE_POLICIES[category].authorityVersion]),
  )
  authorityVersions.portfolio = PORTFOLIO_AUTHORITY_VERSION
  authorityVersions.routine = PERSONAL_PLAN_ROUTINE_COMPILER_VERSION

  const categories: RoutineIntentCategory[] = renderedOrder
    .filter((category) => items.some((item) => item.category === category))
    .map((category) => {
      const categoryItems = items.filter((item) => item.category === category)
      return {
        category,
        inclusion: categoryItems.some((item) => item.state.inclusion === "included")
          ? "included"
          : "excluded",
        inclusionSource: "stage3",
        assignments: categoryItems.map((item) => ({
          assignmentKey: item.assignmentKey,
          role: item.role,
          productRef: productRef(item),
          cadenceOverride: null,
          fitDecision: item.state.fitDecision,
        })),
      } satisfies RoutineIntentCategory
    })
  const sections = (["basis", "optional"] as const).map((key) => ({
    key,
    itemKeys: items
      .filter((item) =>
        key === "basis"
          ? item.state.systemAssessment === "basis"
          : item.state.systemAssessment === "optional" ||
            (item.state.systemAssessment === "not_recommended" &&
              item.state.inclusion === "included"),
      )
      .map((item) => item.itemKey),
  }))

  const fingerprintPreimage = {
    schemaVersion: 1,
    expectedSourceRevision: input.expectedSourceRevision,
    personalPlanId: input.personalPlanId,
    refinedVersionId: portfolio.refinedVersionId,
    sourceDraftRevision: portfolio.sourceDraftRevision,
    authorityVersions,
    renderedOrder,
    intent: { schemaVersion: 1, categories },
    sections,
    items,
  }
  const sourceFingerprint = semanticHash(fingerprintPreimage)

  const payload = {
    schemaVersion: 1,
    planId: input.personalPlanId,
    versionId: "pending-sql-assignment",
    parentVersionId: null,
    source: {
      refinedVersionId: portfolio.refinedVersionId,
      productPortfolioVersionId: "pending-sql-assignment",
      sourceFingerprint,
      compilerVersion: PERSONAL_PLAN_ROUTINE_COMPILER_VERSION,
      authorityVersions,
      renderedOrder,
    },
    intent: { schemaVersion: 1, categories },
    sections,
    items,
    createdAt: "pending-sql-assignment",
  } satisfies RoutineCompiledPayload as unknown as JsonValue

  return {
    schemaVersion: 1,
    compilerVersion: PERSONAL_PLAN_ROUTINE_COMPILER_VERSION,
    authorityVersions,
    sourceFingerprint,
    payload,
    proposalDelta: {
      schemaVersion: 1,
      direct: [],
      consequential: items.map((item) => ({
        kind: "added",
        itemKey: item.itemKey,
        explanationKey: "personal_plan.routine.initial_assignment",
      })),
      unchangedItemCount: 0,
    },
  }
}

export function createInitialRoutineCandidateCompiler(): RoutineCandidateCompiler {
  return { compile: compileInitialRoutineCandidate }
}
