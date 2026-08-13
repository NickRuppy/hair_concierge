import type { AnyProposedProductPortfolio } from "../products/contracts"
import {
  applyRoutineEdits,
  diffRoutinePayloads,
  hashRoutineSemantics,
  type RoutineCompiledPayload,
  type RoutineEditOperation,
  type RoutineProposalDelta,
} from "../routine-candidate-compiler"
import { semanticHash } from "./canonicalize"

export type RoutineSourceUserProduct = {
  id: string
  category: string
  catalogProductId: string | null
  displayName: string
  identityStatus: "matched" | "pending_review" | "needs_more_info" | "text_only"
  ownershipStatus: "owned" | "archived"
}

export type RoutineSourceReconciliationResult =
  | { status: "no_semantic_change" }
  | {
      status: "invalid_source"
      reason: "category_mismatch" | "invalid_product_state" | "unresolved_product_review"
    }
  | {
      status: "changed"
      origin: "acquisition"
      portfolio: AnyProposedProductPortfolio
      routine: RoutineCompiledPayload
      delta: RoutineProposalDelta
    }

function plannedAssignmentOperations(input: {
  routine: RoutineCompiledPayload
  plannedPurchaseIds: ReadonlySet<string>
  userProduct: RoutineSourceUserProduct
}): RoutineEditOperation[] {
  const capturedProductId = `acquired:${input.userProduct.id}`
  return input.routine.intent.categories.flatMap((category) =>
    category.assignments
      .filter(
        (assignment) =>
          assignment.productRef.kind === "planned" &&
          input.plannedPurchaseIds.has(assignment.productRef.plannedPurchaseId),
      )
      .map(
        (assignment) =>
          ({
            kind: "assignment_replace",
            assignmentKey: assignment.assignmentKey,
            productRef: {
              kind: "owned",
              capturedProductId,
              productId: input.userProduct.catalogProductId!,
            },
          }) satisfies RoutineEditOperation,
      ),
  )
}

/**
 * Reconciles only the safe automatic transition: exact planned catalog
 * recommendations that the owner explicitly declared as acquired. Product
 * review resolution still needs its own fit-decision authority and is not
 * guessed here.
 */
export function reconcileRoutineUserProductSource(input: {
  routine: RoutineCompiledPayload
  portfolio: AnyProposedProductPortfolio
  userProduct: RoutineSourceUserProduct
  sourceRevision: number
}): RoutineSourceReconciliationResult {
  const catalogProductId = input.userProduct.catalogProductId
  if (
    input.userProduct.ownershipStatus === "owned" &&
    input.userProduct.identityStatus !== "matched"
  ) {
    // Product-review data is not a fit decision. Keep its outbox item
    // retryable until the authoritative review resolves it.
    return { status: "invalid_source", reason: "unresolved_product_review" }
  }
  const productMatches = catalogProductId
    ? input.portfolio.plannedPurchases.filter((entry) => entry.productId === catalogProductId)
    : []
  if (productMatches.length === 0) return { status: "no_semantic_change" }
  const planned = productMatches.filter((entry) => entry.category === input.userProduct.category)
  if (planned.length === 0) {
    return { status: "invalid_source", reason: "category_mismatch" }
  }
  if (
    input.userProduct.ownershipStatus !== "owned" ||
    input.userProduct.identityStatus !== "matched" ||
    !catalogProductId
  ) {
    return { status: "invalid_source", reason: "invalid_product_state" }
  }

  const operations = plannedAssignmentOperations({
    routine: input.routine,
    plannedPurchaseIds: new Set(planned.map((entry) => entry.plannedPurchaseId)),
    userProduct: input.userProduct,
  })
  if (operations.length === 0) return { status: "no_semantic_change" }

  const routine = applyRoutineEdits(input.routine, operations)
  for (const operation of operations) {
    if (operation.kind !== "assignment_replace") continue
    const item = routine.items.find(
      (candidate) => candidate.assignmentKey === operation.assignmentKey,
    )
    if (item?.product.kind === "owned") item.product.displayName = input.userProduct.displayName
  }
  routine.source.productPortfolioVersionId = "pending-sql-assignment"
  routine.source.sourceFingerprint = semanticHash({
    sourceRevision: input.sourceRevision,
    sourceKind: "user_product",
    sourceKey: input.userProduct.id,
    routineSemantics: hashRoutineSemantics(routine),
  })

  const decisionKeys = new Set(
    input.routine.items
      .filter((item) =>
        operations.some(
          (operation) =>
            operation.kind === "assignment_replace" &&
            operation.assignmentKey === item.assignmentKey,
        ),
      )
      .flatMap((item) => item.sourceDecisionKeys),
  )
  const capturedProductId = `acquired:${input.userProduct.id}`
  const portfolio = structuredClone(input.portfolio)
  const appliedAssignmentKeys = new Set(
    operations
      .filter(
        (operation): operation is Extract<RoutineEditOperation, { kind: "assignment_replace" }> =>
          operation.kind === "assignment_replace",
      )
      .map((operation) => operation.assignmentKey),
  )
  const appliedPlannedPurchaseIds = new Set(
    input.routine.intent.categories.flatMap((category) =>
      category.assignments.flatMap((assignment) => {
        if (
          !appliedAssignmentKeys.has(assignment.assignmentKey) ||
          assignment.productRef.kind !== "planned"
        ) {
          return []
        }
        return [assignment.productRef.plannedPurchaseId]
      }),
    ),
  )
  portfolio.portfolioVersionId = "pending-sql-assignment"
  portfolio.createdAt = "pending-sql-assignment"
  portfolio.plannedPurchases = portfolio.plannedPurchases.filter(
    (entry) => !appliedPlannedPurchaseIds.has(entry.plannedPurchaseId),
  )
  portfolio.uncoveredRoles = portfolio.uncoveredRoles.filter(
    (entry) => !decisionKeys.has(entry.linkedDecisionKey),
  )
  portfolio.categoryResolutions = portfolio.categoryResolutions.map((resolution) =>
    decisionKeys.has(resolution.decisionKey)
      ? {
          ...resolution,
          choiceState: "owned_active" as const,
          capturedProductId,
          executable: true,
          gapPreserved: false,
        }
      : resolution,
  )
  for (const decisionKey of decisionKeys) {
    const plannedEntry = planned.find((entry) =>
      input.portfolio.schemaVersion === 3 || input.portfolio.schemaVersion === 4
        ? entry.sourceDecisionKey === decisionKey
        : entry.category === input.userProduct.category &&
          entry.role ===
            input.portfolio.categoryResolutions.find(
              (resolution) => resolution.decisionKey === decisionKey,
            )?.role,
    )
    if (!plannedEntry) continue
    portfolio.ownedProducts.push({
      capturedProductId,
      userProductId: input.userProduct.id,
      productId: catalogProductId,
      displayName: input.userProduct.displayName,
      category: plannedEntry.category,
      role: plannedEntry.role,
      // Acquisition establishes ownership, not a reported usage cadence. The
      // Routine cadence remains separately frozen in the immutable intent.
      frequencyRange: null,
      choiceState: "owned_active",
      sourceDecisionKey: decisionKey,
    })
  }

  return {
    status: "changed",
    origin: "acquisition",
    portfolio,
    routine,
    // The owner explicitly declared this acquisition. Treat the resulting
    // planned-to-owned replacement as direct, while any authority-owned
    // follow-on changes would remain consequential.
    delta: diffRoutinePayloads(input.routine, routine, operations),
  }
}
