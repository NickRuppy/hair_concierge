import {
  AgentV2PendingFollowupActionSchema,
  type AgentV2PendingFollowupAction,
  type AgentV2RoutineThreadContext,
} from "./contracts"

export type PendingRoutineMutationBlockReason =
  | "routine_summary_rebuild_not_requested"
  | "routine_action_not_authorized"

export type PendingRoutineMutationPolicy = {
  hardDenyReason: PendingRoutineMutationBlockReason | null
  pendingConfirmationAllowed: boolean
  pendingFollowupAction: AgentV2PendingFollowupAction | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function legacyRoutineActionToFollowup(value: unknown): AgentV2PendingFollowupAction | null {
  if (!isRecord(value)) return null

  const parsed = AgentV2PendingFollowupActionSchema.safeParse({
    kind: "routine_mutation",
    category: value.category ?? null,
    routine_layer: value.routine_layer ?? null,
    routine_action: value.action ?? null,
    source: "assistant_offer",
  })

  return parsed.success ? parsed.data : null
}

export function readPendingFollowupAction(value: unknown): AgentV2PendingFollowupAction | null {
  const parsed = AgentV2PendingFollowupActionSchema.nullable().safeParse(value)
  if (parsed.success) return parsed.data
  if (!isRecord(value)) return null

  if ("pending_followup_action" in value) {
    const nestedParsed = AgentV2PendingFollowupActionSchema.nullable().safeParse(
      value.pending_followup_action,
    )
    return nestedParsed.success ? nestedParsed.data : null
  }

  return legacyRoutineActionToFollowup(value.pending_routine_action)
}

export function isPendingRoutineMutation(
  action: AgentV2PendingFollowupAction | null | undefined,
): action is Extract<AgentV2PendingFollowupAction, { kind: "routine_mutation" }> {
  return action?.kind === "routine_mutation"
}

export function doesRoutineCallMatchPendingAction(
  args: Record<string, unknown>,
  action: AgentV2PendingFollowupAction | null,
): boolean {
  if (!isPendingRoutineMutation(action)) return false
  const requestedCategory =
    typeof args.requested_category === "string" ? args.requested_category : null
  const requestedLayer = typeof args.requested_layer === "string" ? args.requested_layer : null
  const routineIntent = typeof args.routine_intent === "string" ? args.routine_intent : "none"
  const mutationKind = typeof args.mutation_kind === "string" ? args.mutation_kind : "none"

  const categoryMatches = action.category === null || action.category === requestedCategory
  const layerMatches = action.routine_layer === null || action.routine_layer === requestedLayer
  const actionMatches =
    action.routine_action === routineIntent || action.routine_action === mutationKind

  return categoryMatches && layerMatches && actionMatches
}

export function resolvePendingRoutineMutationPolicy(params: {
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
}): PendingRoutineMutationPolicy {
  if (hasExplicitRoutineNonMutationSignal(params.message)) {
    return {
      hardDenyReason: "routine_action_not_authorized",
      pendingConfirmationAllowed: false,
      pendingFollowupAction: null,
    }
  }
  if (hasRoutineSummaryFollowupSignal(params.message)) {
    return {
      hardDenyReason: "routine_summary_rebuild_not_requested",
      pendingConfirmationAllowed: false,
      pendingFollowupAction: null,
    }
  }
  if (hasShortRoutineActionConfirmation(params.message)) {
    const pendingFollowupAction = params.routineThreadContext?.pending_followup_action ?? null
    const pendingRoutineMutation = isPendingRoutineMutation(pendingFollowupAction)
      ? pendingFollowupAction
      : null
    return {
      hardDenyReason: pendingRoutineMutation ? null : "routine_action_not_authorized",
      pendingConfirmationAllowed: Boolean(pendingRoutineMutation),
      pendingFollowupAction: pendingRoutineMutation,
    }
  }
  return {
    hardDenyReason: null,
    pendingConfirmationAllowed: false,
    pendingFollowupAction: null,
  }
}

export function hasShortRoutineActionConfirmation(message: string): boolean {
  const normalized = message
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  return /^(?:ja(?:\s+(?:bitte|gerne))?|gerne|genau(?:\s+(?:bitte|gerne))?|ok(?:ay)?(?:\s+(?:bitte|gerne))?|passt(?:\s+(?:bitte|gerne))?|mach das(?:\s+bitte)?|mach es(?:\s+bitte)?|nimm das rein(?:\s+bitte)?|nehm das rein(?:\s+bitte)?|baue das ein(?:\s+bitte)?|bau das ein(?:\s+bitte)?)$/.test(
    normalized,
  )
}

function hasExplicitRoutineNonMutationSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return (
    /\b(?:nur|erstmal|erst\s*mal)\b.{0,60}\b(?:verstehen|wissen|erklaer|erklär|einordnen)\w*\b/.test(
      normalized,
    ) ||
    /\b(?:nicht|nichts|keine|kein)\b.{0,40}\b(?:aendern|ändern|umstellen|umbauen|anpassen)\w*\b/.test(
      normalized,
    ) ||
    /\bohne\b.{0,40}\b(?:aendern|ändern|umstellen|umbauen|anpassen)\w*\b/.test(normalized)
  )
}

function hasRoutineSummaryFollowupSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return (
    /\b(zusammenfass\w*|zusammenfassung|recap|rekap|ueberblick|überblick)\b/.test(normalized) ||
    /\bfass\w*\b.{0,60}\bzusammen\b/.test(normalized) ||
    /\b(noch\s*mal|nochmal|wieder)\b.{0,60}\bzusammen\b/.test(normalized)
  )
}
