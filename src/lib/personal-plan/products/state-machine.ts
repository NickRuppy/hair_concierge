import { allowsMultipleProductsForRole, CATEGORY_ROLE_POLICIES } from "./authorities"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import {
  deriveStage3DecisionSubjects,
  isExecutableChoice,
  stage3CapturedProductSchema,
  stage3CapturedUncoveredRoleSchema,
  stage3ProductDecisionSchema,
  stage3RoleAssignmentSchema,
  validateStage3Draft,
  type PersonalPlanCategory,
  type Stage3BlockingReason,
  type Stage3CapturedProduct,
  type Stage3CapturedUncoveredRole,
  type Stage3CategoryProgress,
  type Stage3CategoryRequirement,
  type Stage3PathState,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
  type Stage3RoleAssignment,
} from "./contracts"
import {
  effectiveStage3Requirements,
  resolveStage3ProductLoadResolution,
} from "./product-load-resolution"

function clearProductLoadResolution(draft: Stage3ProductDraft): Stage3ProductDraft {
  const resolution = draft.productLoadResolution
  if (!resolution) return draft
  const overlayCategories = new Set(
    resolution.requirements.map((requirement) => requirement.category),
  )
  const baseCategories = new Set(
    draft.authoritySnapshot?.orderedCategories ?? draft.orderedCategories,
  )
  const decisions = draft.decisions.filter((decision) => !overlayCategories.has(decision.category))
  const decisionKeys = new Set(decisions.map((decision) => decision.decisionKey))
  const authorityVersions = { ...draft.authorityVersions }
  for (const category of overlayCategories) {
    if (!baseCategories.has(category)) delete authorityVersions[category]
  }
  return {
    ...draft,
    authorityVersions,
    orderedCategories: draft.orderedCategories.filter(
      (category) => baseCategories.has(category) || !overlayCategories.has(category),
    ),
    completedCaptureCategories: draft.completedCaptureCategories.filter(
      (category) => baseCategories.has(category) || !overlayCategories.has(category),
    ),
    uncoveredRoles: draft.uncoveredRoles.filter((role) => !overlayCategories.has(role.category)),
    decisions,
    completedDecisionKeys: draft.completedDecisionKeys.filter((key) => decisionKeys.has(key)),
    productLoadResolution: undefined,
  }
}

function applyProductLoadResolution(draft: Stage3ProductDraft): Stage3ProductDraft {
  const cleared = clearProductLoadResolution(draft)
  const resolution = resolveStage3ProductLoadResolution(cleared)
  if (!resolution) return { ...cleared, productLoadResolution: undefined }
  const orderedCategories = [...cleared.orderedCategories]
  const completedCaptureCategories = new Set(cleared.completedCaptureCategories)
  const uncoveredRoles = [...cleared.uncoveredRoles]
  const authorityVersions = { ...cleared.authorityVersions }
  for (const requirement of resolution.requirements) {
    if (!orderedCategories.includes(requirement.category))
      orderedCategories.push(requirement.category)
    completedCaptureCategories.add(requirement.category)
    authorityVersions[requirement.category] = requirement.authorityVersion
    for (const role of requirement.requiredRoles) {
      const assigned = cleared.roleAssignments.some(
        (assignment) =>
          assignment.category === requirement.category && assignment.roles.includes(role),
      )
      const uncovered = uncoveredRoles.some(
        (candidate) => candidate.category === requirement.category && candidate.role === role,
      )
      if (!assigned && !uncovered) {
        uncoveredRoles.push({ category: requirement.category, role, reason: "no_product_owned" })
      }
    }
  }
  return {
    ...cleared,
    authorityVersions,
    orderedCategories,
    completedCaptureCategories: orderedCategories.filter((category) =>
      completedCaptureCategories.has(category),
    ),
    uncoveredRoles,
    productLoadResolution: resolution,
  }
}

type CreateStage3DraftInput = {
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  requirements: Stage3CategoryRequirement[]
  now: string
}

export function createStage3Draft(input: CreateStage3DraftInput): Stage3ProductDraft {
  const orderedCategories = input.requirements.map((requirement) => requirement.category)
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: Object.fromEntries(
      input.requirements.map((requirement) => [requirement.category, requirement.authorityVersion]),
    ),
    draftId: input.draftId,
    userId: input.userId,
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
    staleRefinedVersionId: null,
    revision: 0,
    pass: "product_capture",
    orderedCategories,
    categoryCursor: orderedCategories[0] ?? null,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: [],
    completedDecisionKeys: [],
    createdAt: input.now,
    updatedAt: input.now,
  }
}

function cloneWithRevision(
  draft: Stage3ProductDraft,
  updates: Partial<Stage3ProductDraft>,
): Stage3ProductDraft {
  const next: Stage3ProductDraft = {
    ...draft,
    ...updates,
    revision: draft.revision + 1,
    updatedAt: updates.updatedAt ?? draft.updatedAt,
  }
  const issues = validateStage3Draft(next)
  if (issues.length > 0) {
    throw new Error(issues.join("; "))
  }
  return next
}

function pruneInvalidDecisionDescendants(
  draft: Stage3ProductDraft,
): Pick<Stage3ProductDraft, "decisions" | "completedDecisionKeys"> {
  const validDecisionKeys = new Set(
    deriveStage3DecisionSubjects(draft).map((subject) => subject.decisionKey),
  )
  const decisions = draft.decisions.filter((decision) =>
    validDecisionKeys.has(decision.decisionKey),
  )
  const remainingDecisionKeys = new Set(decisions.map((decision) => decision.decisionKey))
  const completedDecisionKeys = draft.completedDecisionKeys.filter((decisionKey) =>
    remainingDecisionKeys.has(decisionKey),
  )

  return { decisions, completedDecisionKeys }
}

function pruneCategoryDecisionDescendants(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): Pick<Stage3ProductDraft, "decisions" | "completedDecisionKeys"> {
  const decisions = draft.decisions.filter((decision) => decision.category !== category)
  const remainingDecisionKeys = new Set(decisions.map((decision) => decision.decisionKey))
  const completedDecisionKeys = draft.completedDecisionKeys.filter((decisionKey) =>
    remainingDecisionKeys.has(decisionKey),
  )

  return { decisions, completedDecisionKeys }
}

export function addCapturedProduct(
  draft: Stage3ProductDraft,
  product: Stage3CapturedProduct,
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  const parsedProduct = stage3CapturedProductSchema.parse(product)
  if (!draft.orderedCategories.includes(parsedProduct.identity.category)) {
    throw new Error(
      `identity category ${parsedProduct.identity.category} does not match ordered categories`,
    )
  }
  if (
    draft.products.some(
      (existing) => existing.capturedProductId === parsedProduct.capturedProductId,
    )
  ) {
    throw new Error(`captured product ${parsedProduct.capturedProductId} already exists`)
  }
  const authority = CATEGORY_ROLE_POLICIES[parsedProduct.identity.category]
  const sameCategoryCount = draft.products.filter(
    (existing) => existing.identity.category === parsedProduct.identity.category,
  ).length
  if (!authority.allowsMultiple && sameCategoryCount > 0) {
    throw new Error(`category ${parsedProduct.identity.category} does not allow multiple products`)
  }
  return cloneWithRevision(draft, { products: [...draft.products, parsedProduct] })
}

export function assignProductRoles(
  draft: Stage3ProductDraft,
  assignment: Stage3RoleAssignment,
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  const parsedAssignment = stage3RoleAssignmentSchema.parse(assignment)
  const withoutExisting = draft.roleAssignments.filter(
    (existing) => existing.capturedProductId !== parsedAssignment.capturedProductId,
  )
  const assignedRoleKeys = new Set(
    parsedAssignment.roles.map((role) => `${parsedAssignment.category}:${role}`),
  )
  const uncoveredRoles = draft.uncoveredRoles.filter(
    (uncoveredRole) => !assignedRoleKeys.has(`${uncoveredRole.category}:${uncoveredRole.role}`),
  )
  const candidate: Stage3ProductDraft = {
    ...draft,
    roleAssignments: [...withoutExisting, parsedAssignment],
    uncoveredRoles,
  }
  return cloneWithRevision(draft, {
    roleAssignments: candidate.roleAssignments,
    uncoveredRoles,
    ...pruneInvalidDecisionDescendants(candidate),
  })
}

export function replaceCategoryRoleAssignments(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
  assignments: Stage3RoleAssignment[],
  requirements: Stage3CategoryRequirement[],
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  if (!draft.orderedCategories.includes(category)) {
    throw new Error(`category ${category} is not in this draft`)
  }
  const requirement = requirements.find((candidate) => candidate.category === category)
  if (!requirement) throw new Error(`requirements for category ${category} are unavailable`)

  const productsById = new Map(
    draft.products.map((product) => [product.capturedProductId, product]),
  )
  const requiredRoles = new Set(requirement.requiredRoles)
  const seenProductIds = new Set<string>()
  const roleCounts = new Map<PlanProductRole, number>()
  const parsedAssignments = assignments.map((assignment) => {
    const parsed = stage3RoleAssignmentSchema.parse(assignment)
    if (parsed.category !== category) {
      throw new Error(`assignment category ${parsed.category} does not match ${category}`)
    }
    if (seenProductIds.has(parsed.capturedProductId)) {
      throw new Error(`product ${parsed.capturedProductId} is assigned more than once`)
    }
    seenProductIds.add(parsed.capturedProductId)
    const product = productsById.get(parsed.capturedProductId)
    if (!product || product.identity.category !== category) {
      throw new Error(`product ${parsed.capturedProductId} does not belong to category ${category}`)
    }
    if (new Set(parsed.roles).size !== parsed.roles.length) {
      throw new Error(`product ${parsed.capturedProductId} contains duplicate roles`)
    }
    for (const role of parsed.roles) {
      if (!requiredRoles.has(role)) {
        throw new Error(`role ${role} is not required for category ${category}`)
      }
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
    }
    return parsed
  })

  for (const role of requirement.requiredRoles) {
    const count = roleCounts.get(role) ?? 0
    if (count === 0) throw new Error(`required role ${role} is uncovered`)
    if (count > 1 && !allowsMultipleProductsForRole(category, role)) {
      throw new Error(`role ${role} already assigned`)
    }
  }

  const candidate: Stage3ProductDraft = {
    ...draft,
    roleAssignments: [
      ...draft.roleAssignments.filter((assignment) => assignment.category !== category),
      ...parsedAssignments,
    ],
    uncoveredRoles: draft.uncoveredRoles.filter(
      (uncoveredRole) => uncoveredRole.category !== category,
    ),
  }
  return cloneWithRevision(draft, {
    roleAssignments: candidate.roleAssignments,
    uncoveredRoles: candidate.uncoveredRoles,
    ...pruneInvalidDecisionDescendants(candidate),
  })
}

export function markRoleUncovered(
  draft: Stage3ProductDraft,
  uncoveredRole: Stage3CapturedUncoveredRole,
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  const parsedUncoveredRole = stage3CapturedUncoveredRoleSchema.parse(uncoveredRole)
  const roleAssignments = draft.roleAssignments
    .map((assignment) => {
      if (assignment.category !== parsedUncoveredRole.category) return assignment
      return {
        ...assignment,
        roles: assignment.roles.filter((role) => role !== parsedUncoveredRole.role),
      }
    })
    .filter((assignment) => assignment.roles.length > 0)
  const withoutExisting = draft.uncoveredRoles.filter(
    (existing) =>
      existing.category !== parsedUncoveredRole.category ||
      existing.role !== parsedUncoveredRole.role,
  )
  const candidate: Stage3ProductDraft = {
    ...draft,
    roleAssignments,
    uncoveredRoles: [...withoutExisting, parsedUncoveredRole],
  }
  return cloneWithRevision(draft, {
    roleAssignments,
    uncoveredRoles: candidate.uncoveredRoles,
    ...pruneInvalidDecisionDescendants(candidate),
  })
}

export function reopenCaptureCategory(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  if (!draft.orderedCategories.includes(category)) {
    throw new Error(`category ${category} is not in this draft`)
  }
  return cloneWithRevision(draft, {
    pass: "product_capture",
    categoryCursor: category,
    completedCaptureCategories: draft.completedCaptureCategories.filter(
      (completedCategory) => completedCategory !== category,
    ),
    ...pruneCategoryDecisionDescendants(draft, category),
  })
}

export function removeCapturedProduct(
  draft: Stage3ProductDraft,
  capturedProductId: string,
): Stage3ProductDraft {
  draft = clearProductLoadResolution(draft)
  if (!draft.products.some((product) => product.capturedProductId === capturedProductId)) {
    throw new Error(`captured product ${capturedProductId} does not exist`)
  }
  const candidate: Stage3ProductDraft = {
    ...draft,
    products: draft.products.filter((product) => product.capturedProductId !== capturedProductId),
    roleAssignments: draft.roleAssignments.filter(
      (assignment) => assignment.capturedProductId !== capturedProductId,
    ),
  }

  return cloneWithRevision(draft, {
    products: candidate.products,
    roleAssignments: candidate.roleAssignments,
    ...pruneInvalidDecisionDescendants(candidate),
  })
}

export function completeCaptureCategory(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
  requirements: Stage3CategoryRequirement[],
): Stage3ProductDraft {
  if (!draft.orderedCategories.includes(category)) {
    throw new Error(`category ${category} is not in this draft`)
  }
  const completed = new Set(draft.completedCaptureCategories)
  completed.add(category)
  const completedCaptureCategories = draft.orderedCategories.filter((candidate) =>
    completed.has(candidate),
  )
  const candidate = { ...draft, completedCaptureCategories }
  const captureComplete = computeCaptureCompletion(candidate, requirements).canCompleteCapture
  const next = cloneWithRevision(draft, {
    completedCaptureCategories,
    pass: captureComplete ? "product_decisions" : "product_capture",
    categoryCursor: captureComplete
      ? null
      : (draft.orderedCategories.find((candidate) => !completed.has(candidate)) ?? null),
  })
  return captureComplete ? applyProductLoadResolution(next) : next
}

export function recordProductDecision(
  draft: Stage3ProductDraft,
  decision: Stage3ProductDecision,
): Stage3ProductDraft {
  const parsedDecision = stage3ProductDecisionSchema.parse(decision)
  const withoutExisting = draft.decisions.filter(
    (existing) => existing.decisionKey !== parsedDecision.decisionKey,
  )
  const completedKeys = new Set(draft.completedDecisionKeys)
  completedKeys.add(parsedDecision.decisionKey)
  return cloneWithRevision(draft, {
    decisions: [...withoutExisting, parsedDecision],
    completedDecisionKeys: [...completedKeys],
  })
}

export function invalidateDraftForRefinedVersion(
  draft: Stage3ProductDraft,
  staleRefinedVersionId: string,
  now: string,
): Stage3ProductDraft {
  if (draft.refinedVersionId === staleRefinedVersionId || draft.status === "completed") return draft
  return {
    ...draft,
    status: "stale",
    staleRefinedVersionId,
    revision: draft.revision + 1,
    updatedAt: now,
  }
}

function getRolesForCategory(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): Set<PlanProductRole> {
  const roles = new Set<PlanProductRole>()
  for (const assignment of draft.roleAssignments) {
    if (assignment.category !== category) continue
    for (const role of assignment.roles) roles.add(role)
  }
  return roles
}

function getUncoveredRolesForCategory(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): Set<PlanProductRole> {
  const roles = new Set<PlanProductRole>()
  for (const uncoveredRole of draft.uncoveredRoles) {
    if (uncoveredRole.category === category) roles.add(uncoveredRole.role)
  }
  return roles
}

function hasDecisionForRole(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
  role: PlanProductRole,
): boolean {
  return draft.decisions.some(
    (decision) => decision.category === category && decision.role === role,
  )
}

function areAllDecisionSubjectsComplete(
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
): boolean {
  const subjects = deriveStage3DecisionSubjects(draft).filter(
    (subject) => subject.category === category,
  )
  return (
    subjects.length > 0 &&
    subjects.every((subject) =>
      draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
    )
  )
}

function computeCaptureCompletion(
  draft: Stage3ProductDraft,
  requirements: Stage3CategoryRequirement[],
): Pick<Stage3PathState, "canCompleteCapture" | "blockingReasons" | "categorySummaries"> {
  const blockingReasons: Stage3BlockingReason[] = []
  const categorySummaries: Stage3CategoryProgress[] = []

  for (const requirement of requirements) {
    const capturedProducts = draft.products.filter(
      (product) => product.identity.category === requirement.category,
    )
    const completedCapture = draft.completedCaptureCategories.includes(requirement.category)
    const assignedRoles = getRolesForCategory(draft, requirement.category)
    const explicitlyUncoveredRoles = getUncoveredRolesForCategory(draft, requirement.category)
    const uncoveredRoles = requirement.requiredRoles.filter(
      (role) => !assignedRoles.has(role) && !explicitlyUncoveredRoles.has(role),
    )

    if (!completedCapture) {
      blockingReasons.push({
        code: "capture_incomplete",
        category: requirement.category,
        role: null,
        message: `${requirement.category} has not been captured.`,
      })
    }
    for (const role of uncoveredRoles) {
      blockingReasons.push({
        code: "role_uncovered",
        category: requirement.category,
        role,
        message: `${requirement.category} role ${role} is uncovered.`,
      })
    }

    categorySummaries.push({
      category: requirement.category,
      capturedCount: capturedProducts.length,
      completedCapture,
      completedDecisions: areAllDecisionSubjectsComplete(draft, requirement.category),
      uncoveredRoles,
    })
  }

  const canCompleteCapture =
    draft.status === "active" &&
    blockingReasons.every(
      (reason) => reason.code !== "capture_incomplete" && reason.code !== "role_uncovered",
    )

  return { canCompleteCapture, blockingReasons, categorySummaries }
}

export function computeStage3PathState(
  draft: Stage3ProductDraft,
  requirements: Stage3CategoryRequirement[],
): Stage3PathState {
  const validationIssues = validateStage3Draft(draft)
  requirements = effectiveStage3Requirements(requirements, draft)
  const orderedStepKeys = requirements.flatMap((requirement) => [
    `capture:${requirement.category}`,
    ...(requirement.requiredRoles.length > 0 ? [`roles:${requirement.category}`] : []),
  ])
  const completedStepKeys: string[] = []

  for (const requirement of requirements) {
    if (draft.completedCaptureCategories.includes(requirement.category)) {
      completedStepKeys.push(`capture:${requirement.category}`)
    }
    if (
      requirement.requiredRoles.every((role) =>
        getRolesForCategory(draft, requirement.category).has(role),
      )
    ) {
      completedStepKeys.push(`roles:${requirement.category}`)
    } else if (
      requirement.requiredRoles.every((role) => {
        const assignedRoles = getRolesForCategory(draft, requirement.category)
        const uncoveredRoles = getUncoveredRolesForCategory(draft, requirement.category)
        return assignedRoles.has(role) || uncoveredRoles.has(role)
      })
    ) {
      completedStepKeys.push(`roles:${requirement.category}`)
    }
  }

  const captureCompletion = computeCaptureCompletion(draft, requirements)
  let blockingReasons = [...captureCompletion.blockingReasons]
  if (draft.status === "stale") {
    blockingReasons = [
      {
        code: "stale_refined_version",
        category: null,
        role: null,
        message: "The refined version changed after this draft started.",
      },
      ...blockingReasons,
    ]
  }
  if (validationIssues.length > 0) {
    blockingReasons.push(
      ...validationIssues.map<Stage3BlockingReason>((issue) => ({
        code: "draft_invalid",
        category: null,
        role: null,
        message: issue,
      })),
    )
  }

  if (!captureCompletion.canCompleteCapture || draft.status !== "active") {
    const firstUnresolvedStepKey =
      orderedStepKeys.find((stepKey) => !completedStepKeys.includes(stepKey)) ?? null
    return {
      pass: "product_capture",
      orderedStepKeys,
      completedStepKeys,
      firstUnresolvedStepKey,
      categorySummaries: captureCompletion.categorySummaries,
      canCompleteCapture: false,
      canCreatePortfolio: false,
      blockingReasons,
    }
  }

  const subjects = deriveStage3DecisionSubjects(draft)
  const requirementKeys = new Set(requirements.map((requirement) => requirement.category))
  const decisionStepKeys = subjects
    .filter((subject) => requirementKeys.has(subject.category))
    .map((subject) => subject.decisionKey)
  const completedDecisionStepKeys = decisionStepKeys.filter((stepKey) =>
    draft.decisions.some((decision) => decision.decisionKey === stepKey),
  )
  const firstUnresolvedDecisionStepKey =
    decisionStepKeys.find((stepKey) => !completedDecisionStepKeys.includes(stepKey)) ?? null

  for (const requirement of requirements) {
    for (const role of requirement.requiredRoles) {
      const roleSubjects = subjects.filter(
        (subject) => subject.category === requirement.category && subject.role === role,
      )
      if (
        roleSubjects.length === 0 ||
        roleSubjects.some(
          (subject) =>
            !draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
        )
      ) {
        blockingReasons.push({
          code: "decision_incomplete",
          category: requirement.category,
          role,
          message: `${requirement.category} decision for ${role} is incomplete.`,
        })
      }
    }
  }

  const canCreatePortfolio =
    draft.status === "active" &&
    validationIssues.length === 0 &&
    captureCompletion.canCompleteCapture &&
    firstUnresolvedDecisionStepKey === null &&
    draft.decisions.every(
      (decision) =>
        isExecutableChoice(decision.choiceState) ||
        decision.choiceState === "planned_purchase" ||
        decision.choiceState === "pending_review" ||
        decision.choiceState === "inactive" ||
        decision.choiceState === "unassigned",
    )

  return {
    pass: "product_decisions",
    orderedStepKeys: [...orderedStepKeys, ...decisionStepKeys],
    completedStepKeys: [...completedStepKeys, ...completedDecisionStepKeys],
    firstUnresolvedStepKey: firstUnresolvedDecisionStepKey,
    categorySummaries: captureCompletion.categorySummaries.map((summary) => ({
      ...summary,
      completedDecisions:
        requirements
          .find((requirement) => requirement.category === summary.category)!
          .requiredRoles.every((role) => hasDecisionForRole(draft, summary.category, role)) &&
        areAllDecisionSubjectsComplete(draft, summary.category),
    })),
    canCompleteCapture: true,
    canCreatePortfolio,
    blockingReasons,
  }
}
