import { CATEGORY_ROLE_POLICIES } from "../products/authorities"
import { STAGE1_CATEGORY_ORDER } from "../types"
import type {
  RoutineCompiledPayload,
  RoutineEditOperation,
  RoutineItem,
} from "../routine-candidate-compiler"

function productMatches(
  item: RoutineItem,
  productRef: Extract<RoutineEditOperation, { kind: "assignment_replace" }>["productRef"],
): boolean {
  if (item.product.kind !== productRef.kind) return false
  if (item.product.kind === "owned" && productRef.kind === "owned") {
    return (
      item.product.capturedProductId === productRef.capturedProductId &&
      item.product.productId === productRef.productId
    )
  }
  if (item.product.kind === "planned" && productRef.kind === "planned") {
    return (
      item.product.plannedPurchaseId === productRef.plannedPurchaseId &&
      item.product.productId === productRef.productId
    )
  }
  if (item.product.kind === "pending_review" && productRef.kind === "pending_review") {
    return item.product.submissionId === productRef.submissionId
  }
  return item.product.kind === "none" && productRef.kind === "none"
}

function rebuild(payload: RoutineCompiledPayload): RoutineCompiledPayload {
  const categoryByName = new Map(
    payload.intent.categories.map((category) => [category.category, category]),
  )
  const items = payload.items
    .map((item) => {
      const category = categoryByName.get(item.category)
      const inclusion = category?.inclusion ?? "excluded"
      return {
        ...item,
        roleOrder: CATEGORY_ROLE_POLICIES[item.category].allowedRoles.indexOf(item.role as never),
        state: { ...item.state, inclusion },
        cadence: {
          ...item.cadence,
          userOverride:
            category?.assignments.find(
              (assignment) => assignment.assignmentKey === item.assignmentKey,
            )?.cadenceOverride ?? null,
        },
        executable: item.product.kind === "owned" && inclusion === "included",
      }
    })
    .sort(
      (left, right) =>
        STAGE1_CATEGORY_ORDER.indexOf(left.category) -
          STAGE1_CATEGORY_ORDER.indexOf(right.category) ||
        left.roleOrder - right.roleOrder ||
        left.assignmentKey.localeCompare(right.assignmentKey),
    )
  return {
    ...payload,
    intent: {
      ...payload.intent,
      categories: [...categoryByName.values()].sort(
        (left, right) =>
          STAGE1_CATEGORY_ORDER.indexOf(left.category) -
          STAGE1_CATEGORY_ORDER.indexOf(right.category),
      ),
    },
    items,
    sections: (["basis", "optional"] as const).map((key) => ({
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
    })),
  }
}

export function applyRoutineEdits(
  input: RoutineCompiledPayload,
  operations: readonly RoutineEditOperation[],
): RoutineCompiledPayload {
  const payload = structuredClone(input) as RoutineCompiledPayload
  const frozenItems = input.items
  for (const operation of operations) {
    if (operation.kind === "category_inclusion") {
      const category = payload.intent.categories.find(
        (entry) => entry.category === operation.category,
      )
      if (!category) throw new Error(`routine_candidate_missing_category:${operation.category}`)
      category.inclusion = operation.inclusion
      category.inclusionSource = "user"
      continue
    }
    const category = payload.intent.categories.find((entry) =>
      entry.assignments.some((assignment) => assignment.assignmentKey === operation.assignmentKey),
    )
    const assignment = category?.assignments.find(
      (entry) => entry.assignmentKey === operation.assignmentKey,
    )
    const itemIndex = payload.items.findIndex(
      (entry) => entry.assignmentKey === operation.assignmentKey,
    )
    if (!category || !assignment || itemIndex < 0) {
      throw new Error(`routine_candidate_missing_assignment:${operation.assignmentKey}`)
    }
    if (operation.kind === "assignment_remove") {
      category.assignments = category.assignments.filter((entry) => entry !== assignment)
      payload.items.splice(itemIndex, 1)
      continue
    }
    if (operation.kind === "cadence_override") {
      assignment.cadenceOverride = operation.cadenceOverride
      continue
    }
    if (operation.kind === "assignment_role") {
      if (
        !CATEGORY_ROLE_POLICIES[category.category].allowedRoles.includes(operation.role as never)
      ) {
        throw new Error(`routine_candidate_invalid_role:${category.category}:${operation.role}`)
      }
      const item = payload.items[itemIndex]
      assignment.role = operation.role
      item.role = operation.role
      item.purposeKey = operation.role
      continue
    }
    const item = payload.items[itemIndex]
    assignment.productRef = operation.productRef
    const frozenProduct = frozenItems.find(
      (candidate) =>
        candidate.category === item.category && productMatches(candidate, operation.productRef),
    )?.product
    item.product =
      operation.productRef.kind === "owned"
        ? {
            ...operation.productRef,
            displayName:
              frozenProduct?.kind === "owned"
                ? frozenProduct.displayName
                : item.product.kind === "owned"
                  ? item.product.displayName
                  : "",
          }
        : operation.productRef.kind === "planned"
          ? {
              ...operation.productRef,
              displayName:
                frozenProduct?.kind === "planned"
                  ? frozenProduct.displayName
                  : item.product.kind === "planned"
                    ? item.product.displayName
                    : "",
            }
          : operation.productRef.kind === "pending_review"
            ? {
                kind: "pending_review",
                submissionId: operation.productRef.submissionId,
                displayName:
                  frozenProduct?.kind === "pending_review"
                    ? frozenProduct.displayName
                    : item.product.kind === "pending_review"
                      ? item.product.displayName
                      : "",
              }
            : { kind: "none", displayName: null }
    item.state.availability = operation.productRef.kind
  }
  return rebuild(payload)
}
