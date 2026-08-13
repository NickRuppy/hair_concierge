import "server-only"

export type PersonalPlanJourneyStage = "stage1" | "stage2" | "stage3" | "stage4" | "stage5"

export type PersonalPlanJourneyAccess =
  | { kind: "legacy" }
  | { kind: "paid_pending"; recoveryHref: "/plan-bereit" | "/profile" }
  | {
      kind: "personal_plan_start"
      frontier: "stage1"
      allowed: Readonly<Record<PersonalPlanJourneyStage, boolean>>
      nextHref: "/plan-start"
    }
  | {
      kind: "personal_plan"
      frontier: PersonalPlanJourneyStage
      allowed: Readonly<Record<PersonalPlanJourneyStage, boolean>>
      nextHref: "/plan-start" | "/routine" | "/anwendung"
      personalPlanId: string
      /** Owner-scoped identity already proven while resolving Stage 4/5 reachability. */
      activeRoutineVersionId?: string | null
      hasPendingRoutineProposal?: boolean
    }

export type PersonalPlanJourneyAccessInput = {
  /** These facts are loaded by a server route/page; this resolver never trusts browser state. */
  accessState: "active" | "paid_pending" | "none" | "revoked"
  isNewBuyerCohort: boolean
  appEnabled: boolean
  stage2Enabled: boolean
  stage3Enabled: boolean
  stage4Enabled: boolean
  stage5Allowed: boolean
  preparedSourceReady: boolean
  stage3AuthorityReady?: boolean
  plan: {
    id: string
    currentInitialNeedVersionId: string | null
    currentRefinedNeedVersionId: string | null
    productDraftCompleted: boolean
    pendingRoutineProposalId: string | null
    activeRoutineVersionId: string | null
  } | null
}

const noStages: Readonly<Record<PersonalPlanJourneyStage, boolean>> = {
  stage1: false,
  stage2: false,
  stage3: false,
  stage4: false,
  stage5: false,
}

/**
 * Turns owner-scoped persisted facts into the single, fail-closed route frontier.
 * Earlier edits may produce a new current draft, but immutable completed versions are
 * never treated as evidence for a stage that has not been reached by this owner.
 */
export function resolvePersonalPlanJourneyAccess(
  input: PersonalPlanJourneyAccessInput,
): PersonalPlanJourneyAccess {
  if (!input.isNewBuyerCohort || input.accessState === "none" || input.accessState === "revoked") {
    return { kind: "legacy" }
  }
  if (input.accessState === "paid_pending") {
    return { kind: "paid_pending", recoveryHref: "/plan-bereit" }
  }
  if (!input.appEnabled) return { kind: "paid_pending", recoveryHref: "/profile" }
  if (!input.preparedSourceReady) return { kind: "paid_pending", recoveryHref: "/plan-bereit" }

  const initialReady = Boolean(input.plan?.currentInitialNeedVersionId)
  const refinedReady = initialReady && Boolean(input.plan?.currentRefinedNeedVersionId)
  const stage2Ready = initialReady && input.stage2Enabled
  const stage3Ready =
    refinedReady &&
    input.stage2Enabled &&
    input.stage3Enabled &&
    input.stage3AuthorityReady === true
  const hasAcceptedRoutine =
    input.stage2Enabled &&
    input.stage3Enabled &&
    input.stage4Enabled &&
    Boolean(input.plan?.activeRoutineVersionId)
  const hasCurrentProposal =
    stage3Ready &&
    input.stage4Enabled &&
    Boolean(input.plan?.productDraftCompleted) &&
    Boolean(input.plan?.pendingRoutineProposalId)
  // An accepted immutable Routine remains reachable after a later Stage-2 edit
  // stales the current Stage-3 draft. Only a pending proposal depends on the
  // current refined authority.
  const stage4Ready = hasAcceptedRoutine || hasCurrentProposal
  const stage5Ready = hasAcceptedRoutine && input.stage5Allowed

  if (!input.plan) {
    return {
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { ...noStages, stage1: true },
    }
  }

  const allowed = {
    stage1: true,
    stage2: stage2Ready,
    stage3: stage3Ready,
    stage4: stage4Ready,
    stage5: stage5Ready,
  }
  const frontier = stage5Ready
    ? "stage5"
    : stage4Ready
      ? "stage4"
      : stage3Ready
        ? "stage3"
        : stage2Ready
          ? "stage2"
          : "stage1"
  const nextHref = stage5Ready ? "/anwendung" : stage4Ready ? "/routine" : "/plan-start"

  return {
    kind: "personal_plan",
    personalPlanId: input.plan.id,
    activeRoutineVersionId: input.plan.activeRoutineVersionId,
    frontier,
    nextHref,
    allowed,
    hasPendingRoutineProposal: Boolean(input.plan.pendingRoutineProposalId),
  }
}

/**
 * Reachability only. Route/API callers retain their owner, entitlement and CAS checks.
 */
export function canAccessPersonalPlanJourneyStage(
  access: PersonalPlanJourneyAccess,
  stage: PersonalPlanJourneyStage,
): boolean {
  return "allowed" in access && access.allowed[stage] === true
}
