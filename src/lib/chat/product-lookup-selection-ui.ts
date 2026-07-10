import type {
  Message,
  ProductIntakeCategoryKey,
  ProductIntakeOffer,
  ProductLookupSelectionContext,
} from "@/lib/types"

export type ProductLookupIntakeReviewResolution = {
  submission_id: string
  status: string
  approved_product_id: string | null
  category?: ProductIntakeCategoryKey | null
  brand_text?: string | null
  product_name_text?: string | null
}

export type ProductLookupClarificationState = {
  resolvedSelection: ProductLookupSelectionContext | null
  resolvedIntakeReview: ProductLookupIntakeReviewResolution | null
}

export type ProductIntakeOfferState = {
  submittedStatus: "pending_review" | "matched" | null
  resolvedIntakeReview: ProductLookupIntakeReviewResolution | null
}

type SourceCard = {
  sourceMessageId: string
  clarificationId: string
  candidateProductIds: Set<string>
  intakeOffer: ProductIntakeOffer
}

export function buildProductLookupClarificationStateByMessageId(
  messages: Message[],
): Map<string, ProductLookupClarificationState> {
  const sourceCards = new Map<string, SourceCard>()

  for (const message of messages) {
    const clarification = message.message_context?.product_lookup_clarification
    if (!clarification || message.role !== "assistant") {
      continue
    }

    sourceCards.set(`${message.id}:${clarification.id}`, {
      sourceMessageId: message.id,
      clarificationId: clarification.id,
      candidateProductIds: new Set(
        clarification.candidates.map((candidate) => candidate.product_id),
      ),
      intakeOffer: clarification.none_action.product_intake_offer,
    })
  }

  const states = new Map<string, ProductLookupClarificationState>()
  const ensureState = (sourceMessageId: string): ProductLookupClarificationState => {
    const existing = states.get(sourceMessageId)
    if (existing) return existing
    const next = { resolvedSelection: null, resolvedIntakeReview: null }
    states.set(sourceMessageId, next)
    return next
  }

  for (const message of [...messages].reverse()) {
    const selection = message.message_context?.product_lookup_selection
    if (
      selection?.source === "product_lookup_clarification" &&
      selection.source_assistant_message_id &&
      selection.clarification_id
    ) {
      const sourceCard = sourceCards.get(
        `${selection.source_assistant_message_id}:${selection.clarification_id}`,
      )
      const state = sourceCard ? ensureState(sourceCard.sourceMessageId) : null
      if (
        sourceCard &&
        state &&
        !state.resolvedSelection &&
        sourceCard.candidateProductIds.has(selection.selected_product_id)
      ) {
        state.resolvedSelection = selection
      }
    }

    const review = message.message_context?.product_intake_review ?? null
    if (isResolvedProductIntakeReview(review)) {
      for (const sourceCard of sourceCards.values()) {
        if (!intakeOfferMatchesReview(sourceCard.intakeOffer, review)) continue
        const state = ensureState(sourceCard.sourceMessageId)
        if (!state.resolvedIntakeReview) {
          state.resolvedIntakeReview = review
        }
      }
    }
  }

  return states
}

function offerSubmittedStatus(offer: ProductIntakeOffer): "pending_review" | "matched" | null {
  if (offer.submitted_status === "matched") return "matched"
  if (offer.submitted_status === "pending_review") return "pending_review"
  return null
}

export function buildProductIntakeOfferStateByMessageId(
  messages: Message[],
): Map<string, ProductIntakeOfferState> {
  const offerMessages: Array<{ messageId: string; offer: ProductIntakeOffer }> = []
  for (const message of messages) {
    if (message.role !== "assistant") continue
    if (message.message_context?.product_lookup_clarification) continue
    const offer = message.message_context?.product_intake_offer
    if (!offer) continue
    offerMessages.push({ messageId: message.id, offer })
  }

  const states = new Map<string, ProductIntakeOfferState>()
  for (const { messageId, offer } of offerMessages) {
    states.set(messageId, {
      submittedStatus: offerSubmittedStatus(offer),
      resolvedIntakeReview: null,
    })
  }
  if (states.size === 0) return states

  for (const message of messages) {
    const review = message.message_context?.product_intake_review ?? null
    if (!isResolvedProductIntakeReview(review)) continue
    for (const { messageId, offer } of offerMessages) {
      const state = states.get(messageId)
      if (!state || state.resolvedIntakeReview) continue
      if (!intakeOfferMatchesReview(offer, review)) continue
      state.resolvedIntakeReview = review
    }
  }

  return states
}

export function hasPendingProductIntakeReview(messages: Message[]): boolean {
  const offerStates = buildProductIntakeOfferStateByMessageId(messages)
  for (const state of offerStates.values()) {
    if (state.submittedStatus === "pending_review" && !state.resolvedIntakeReview) return true
  }

  const clarificationStates = buildProductLookupClarificationStateByMessageId(messages)
  for (const message of messages) {
    const clarification = message.message_context?.product_lookup_clarification
    if (!clarification || message.role !== "assistant") continue
    const offer = clarification.none_action.product_intake_offer
    if (offerSubmittedStatus(offer) !== "pending_review") continue
    const state = clarificationStates.get(message.id)
    if (!state?.resolvedIntakeReview) return true
  }

  return false
}

export function buildResolvedProductLookupSelectionByMessageId(
  messages: Message[],
): Map<string, ProductLookupSelectionContext> {
  const states = buildProductLookupClarificationStateByMessageId(messages)
  const resolvedSelections = new Map<string, ProductLookupSelectionContext>()
  for (const [messageId, state] of states) {
    if (state.resolvedSelection) resolvedSelections.set(messageId, state.resolvedSelection)
  }
  return resolvedSelections
}

export function findResolvedProductLookupSelectionForMessage(
  messages: Message[],
  sourceMessage: Message,
): ProductLookupSelectionContext | null {
  return buildResolvedProductLookupSelectionByMessageId(messages).get(sourceMessage.id) ?? null
}

function isResolvedProductIntakeReview(
  value: unknown,
): value is ProductLookupIntakeReviewResolution {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ((value as { status?: unknown }).status === "approved" ||
      (value as { status?: unknown }).status === "matched_existing") &&
    typeof (value as { submission_id?: unknown }).submission_id === "string",
  )
}

function intakeOfferMatchesReview(
  offer: ProductIntakeOffer,
  review: ProductLookupIntakeReviewResolution,
): boolean {
  if (offer.submission_id && offer.submission_id === review.submission_id) return true
  if (!review.category || !offer.category || offer.category !== review.category) return false

  const offerProductName = normalizeIdentityText(offer.extracted_identity?.product_name_text)
  const reviewProductName = normalizeIdentityText(review.product_name_text)
  if (!offerProductName || !reviewProductName || offerProductName !== reviewProductName) {
    return false
  }

  const offerBrand = normalizeIdentityText(offer.extracted_identity?.brand_text)
  const reviewBrand = normalizeIdentityText(review.brand_text)
  return !offerBrand || !reviewBrand || offerBrand === reviewBrand
}

function normalizeIdentityText(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}
