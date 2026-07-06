import type { AgentV2FollowupExecution, AgentV2FollowupOffer } from "./contracts"

export type FollowupRoutineMutationBlockReason =
  | "routine_summary_rebuild_not_requested"
  | "routine_action_not_authorized"

export type FollowupRoutineMutationPolicy = {
  hardDenyReason: FollowupRoutineMutationBlockReason | null
  pendingConfirmationAllowed: boolean
  followupOffer: AgentV2FollowupOffer | null
}

export function hasShortFollowupConfirmation(message: string): boolean {
  const normalized = normalizeMessageForIntent(message)

  return /^(?:ja(?:\s+(?:bitte|gerne))?|gerne|genau(?:\s+(?:bitte|gerne))?|ok(?:ay)?(?:\s+(?:bitte|gerne))?|passt(?:\s+(?:bitte|gerne))?|mach das(?:\s+bitte)?|mach es(?:\s+bitte)?|nimm das rein(?:\s+bitte)?|nehm das rein(?:\s+bitte)?|baue das ein(?:\s+bitte)?|bau das ein(?:\s+bitte)?)$/.test(
    normalized,
  )
}

export function shouldClearFollowupOfferForMessage(message: string): boolean {
  return !hasShortFollowupConfirmation(message)
}

export function resolveFollowupExecution(
  offer: AgentV2FollowupOffer | null,
): AgentV2FollowupExecution | null {
  if (!offer) return null
  if (offer.type === "adjust") return "routine_mutation"
  if (offer.type === "recommend") return "product_selection"
  if (offer.type === "compare" && offer.product_categories.length > 0) {
    return "product_selection"
  }
  return "advisor_response"
}

export function doesRoutineCallMatchFollowupOffer(
  args: Record<string, unknown>,
  offer: AgentV2FollowupOffer | null,
): boolean {
  if (resolveFollowupExecution(offer) !== "routine_mutation") return false
  if (!offer?.routine_action) return false

  const requestedCategory =
    typeof args.requested_category === "string" ? args.requested_category : null
  const requestedLayer = typeof args.requested_layer === "string" ? args.requested_layer : null
  const routineIntent = typeof args.routine_intent === "string" ? args.routine_intent : "none"
  const mutationKind = typeof args.mutation_kind === "string" ? args.mutation_kind : "none"

  const categoryMatches =
    offer.care_category === null ||
    offer.care_category === "none" ||
    offer.care_category === requestedCategory
  const layerMatches = offer.routine_layer === null || offer.routine_layer === requestedLayer
  const actionMatches =
    offer.routine_action === "create"
      ? routineIntent === "create"
      : offer.routine_action === "modify"
        ? routineIntent === "modify" && mutationKind === "none"
        : offer.routine_action === mutationKind || offer.routine_action === routineIntent

  return categoryMatches && layerMatches && actionMatches
}

export function resolveFollowupRoutineMutationPolicy(params: {
  message: string
  followupOffer: AgentV2FollowupOffer | null
}): FollowupRoutineMutationPolicy {
  if (hasExplicitRoutineNonMutationSignal(params.message)) {
    return {
      hardDenyReason: "routine_action_not_authorized",
      pendingConfirmationAllowed: false,
      followupOffer: null,
    }
  }
  if (hasRoutineSummaryFollowupSignal(params.message)) {
    return {
      hardDenyReason: "routine_summary_rebuild_not_requested",
      pendingConfirmationAllowed: false,
      followupOffer: null,
    }
  }
  if (hasShortFollowupConfirmation(params.message)) {
    const routineMutationOffer =
      resolveFollowupExecution(params.followupOffer) === "routine_mutation"
        ? params.followupOffer
        : null
    return {
      hardDenyReason: routineMutationOffer ? null : "routine_action_not_authorized",
      pendingConfirmationAllowed: Boolean(routineMutationOffer),
      followupOffer: routineMutationOffer,
    }
  }
  return {
    hardDenyReason: null,
    pendingConfirmationAllowed: false,
    followupOffer: null,
  }
}

export function isFollowupOfferRendered(visibleAnswer: string, labelDe: string): boolean {
  const normalizedLabel = normalizeVisibleOfferText(labelDe)
  return (
    normalizedLabel.length > 0 && normalizeVisibleOfferText(visibleAnswer).includes(normalizedLabel)
  )
}

function normalizeMessageForIntent(message: string): string {
  return message
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeVisibleOfferText(text: string): string {
  return text
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
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
