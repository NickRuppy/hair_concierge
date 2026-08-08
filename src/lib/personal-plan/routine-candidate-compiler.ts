import { createHash } from "node:crypto"

import { CATEGORY_ROLE_POLICIES } from "./products/authorities"
import type {
  PersonalPlanCategory,
  ProposedProductPortfolio,
  Stage3CategoryResolution,
} from "./products/contracts"
import type { JsonValue } from "./persistence"
import type {
  RoutineCandidate,
  RoutineCandidateCompiler,
  RoutineCandidateCompilerInput,
} from "./routine-proposal-stager"
import { STAGE1_CATEGORY_ORDER, type PlanCategoryDecision, type PlanProductRole } from "./types"

const COMPILER_VERSION = "personal-plan-routine-compiler.v1"
const PORTFOLIO_AUTHORITY_VERSION = "personal-plan-product-portfolio.v1"

type RoutineSystemAssessment = "basis" | "optional" | "not_recommended"
type RoutineInclusion = "included" | "excluded"

type RoutineItem = {
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
    userOverride: null
    displayKey: string
  }
  sourceDecisionKeys: string[]
  authorityRuleIds: string[]
  executable: boolean
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function categoryOrder(category: PersonalPlanCategory): number {
  return STAGE1_CATEGORY_ORDER.indexOf(category)
}

function roleOrder(category: PersonalPlanCategory, role: PlanProductRole): number {
  return CATEGORY_ROLE_POLICIES[category].allowedRoles.indexOf(role as never)
}

function sourceIdentity(
  resolution: Stage3CategoryResolution,
  portfolio: ProposedProductPortfolio,
): string {
  const owned = portfolio.ownedProducts.find(
    (product) => product.sourceDecisionKey === resolution.decisionKey,
  )
  if (owned) return owned.capturedProductId
  const pending = portfolio.pendingProducts.find(
    (product) => product.capturedProductId === resolution.capturedProductId,
  )
  if (pending) return pending.capturedProductId
  const planned = portfolio.plannedPurchases.find(
    (product) => product.category === resolution.category && product.role === resolution.role,
  )
  return planned?.plannedPurchaseId ?? "none"
}

function assessment(decision: PlanCategoryDecision): RoutineSystemAssessment {
  if (decision.needTier === "basis" || decision.needTier === "optional") return decision.needTier
  if (decision.needTier === "not_needed") return "not_recommended"
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
  portfolio: ProposedProductPortfolio
}): RoutineItem {
  const { resolution, decision, portfolio } = input
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
  const planned = portfolio.plannedPurchases.find(
    (product) => product.category === resolution.category && product.role === resolution.role,
  )
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

  return {
    itemKey,
    assignmentKey,
    category: resolution.category,
    role: resolution.role,
    purposeKey: resolution.role,
    roleOrder: roleOrder(resolution.category, resolution.role),
    state: {
      systemAssessment: assessment(decision),
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

function sortItems(left: RoutineItem, right: RoutineItem): number {
  return (
    categoryOrder(left.category) - categoryOrder(right.category) ||
    left.roleOrder - right.roleOrder ||
    left.assignmentKey.localeCompare(right.assignmentKey)
  )
}

function productRef(item: RoutineItem): JsonValue {
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
  const portfolio = input.portfolioSnapshot as unknown as ProposedProductPortfolio
  if (
    input.portfolioSchemaVersion !== 1 ||
    portfolio.schemaVersion !== 1 ||
    portfolio.personalPlanId !== input.personalPlanId
  ) {
    // SQL owns the authoritative refined-version FK comparison while holding
    // the aggregate lock; the compiler still rejects malformed plan/schema
    // projections before issuing that one RPC.
    throw new Error("routine_candidate_invalid_portfolio_source")
  }

  const decisions = new Map(
    input.refinedNeedSnapshot.decisions.map((decision) => [decision.category, decision]),
  )
  const items = portfolio.categoryResolutions.map((resolution) => {
    const decision = decisions.get(resolution.category)
    if (!decision) {
      throw new Error(`routine_candidate_missing_refined_decision:${resolution.category}`)
    }
    return makeItem({ resolution, decision, portfolio })
  })
  items.sort(sortItems)

  const authorityVersions: Record<string, string> = Object.fromEntries(
    [...new Set(items.map((item) => item.category))]
      .sort()
      .map((category) => [category, CATEGORY_ROLE_POLICIES[category].authorityVersion]),
  )
  authorityVersions.portfolio = PORTFOLIO_AUTHORITY_VERSION
  authorityVersions.routine = COMPILER_VERSION

  const categories = Array.from(new Set(items.map((item) => item.category)))
    .sort((left, right) => categoryOrder(left) - categoryOrder(right))
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
      }
    })
  const sections = (["basis", "optional"] as const).map((key) => ({
    key,
    itemKeys: items
      .filter((item) =>
        key === "basis"
          ? item.state.systemAssessment === "basis"
          : item.state.systemAssessment !== "basis",
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
    intent: { schemaVersion: 1, categories },
    sections,
    items,
  }
  const sourceFingerprint = createHash("sha256")
    .update(canonicalJson(fingerprintPreimage))
    .digest("hex")

  const payload = {
    schemaVersion: 1,
    planId: input.personalPlanId,
    versionId: "pending-sql-assignment",
    parentVersionId: null,
    source: {
      refinedVersionId: portfolio.refinedVersionId,
      productPortfolioVersionId: "pending-sql-assignment",
      sourceFingerprint,
      compilerVersion: COMPILER_VERSION,
      authorityVersions,
    },
    intent: { schemaVersion: 1, categories },
    sections,
    items,
    createdAt: "pending-sql-assignment",
  } as unknown as JsonValue

  return {
    schemaVersion: 1,
    compilerVersion: COMPILER_VERSION,
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
