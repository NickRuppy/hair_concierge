import {
  claimCheckoutFailure,
  type CheckoutFailureStage,
  type CheckoutLifecycleDismissalReason,
  type CheckoutLifecycleEndReason,
  type CheckoutLifecycleFailureReason,
  type CheckoutLifecycleLastState,
  type CheckoutLifecycleRecoveryReason,
  type CheckoutLifecycleTransition,
  type OfferPaymentOption,
  type OfferPaymentOptionProvider,
} from "./events"

export type CheckoutAttemptOpenResult = {
  checkoutAttemptId: string
  isNew: boolean
}

export function claimCheckoutOpenRequest(seen: Set<number>, requestId?: number) {
  if (!requestId || seen.has(requestId)) return false
  seen.add(requestId)
  return true
}

export type CheckoutLifecycleClaim = {
  checkoutAttemptId: string
  dismissalReason?: CheckoutLifecycleDismissalReason
  endReason?: CheckoutLifecycleEndReason
  failureReason?: CheckoutLifecycleFailureReason
  lastState: CheckoutLifecycleLastState
  openIndex: number
  option?: OfferPaymentOption
  provider?: OfferPaymentOptionProvider
  recoveryReason?: CheckoutLifecycleRecoveryReason
  transition: CheckoutLifecycleTransition
}

function lifecycleClaimKey({
  checkoutAttemptId,
  dismissalReason,
  endReason,
  failureReason,
  openIndex,
  option,
  provider,
  recoveryReason,
  transition,
}: CheckoutLifecycleClaim) {
  return [
    checkoutAttemptId,
    transition,
    provider ?? "",
    option ?? "",
    dismissalReason ?? recoveryReason ?? endReason ?? "",
    failureReason ?? "",
    openIndex,
  ].join(":")
}

export function createCheckoutAttemptController(
  createId: () => string = () => crypto.randomUUID(),
) {
  let activeCheckoutAttemptId: string | null = null
  let activeOpenIndex: number | null = null
  let isHidden = false
  const seenFailureBranches = new Set<string>()
  const seenLifecycleTransitions = new Set<string>()

  return {
    open(): CheckoutAttemptOpenResult {
      if (activeCheckoutAttemptId) {
        return { checkoutAttemptId: activeCheckoutAttemptId, isNew: false }
      }

      activeCheckoutAttemptId = createId()
      activeOpenIndex = 1
      isHidden = false
      return { checkoutAttemptId: activeCheckoutAttemptId, isNew: true }
    },

    retry() {
      return activeCheckoutAttemptId
    },

    /** Hiding a checkout preserves its app-owned attempt for a later resume. */
    hide() {
      if (!activeCheckoutAttemptId) return null
      isHidden = true
      return activeCheckoutAttemptId
    },

    /** Resuming a hidden attempt advances its presentation index exactly once. */
    resume(): CheckoutAttemptOpenResult | null {
      if (!activeCheckoutAttemptId) return null
      if (isHidden) {
        activeOpenIndex = (activeOpenIndex ?? 0) + 1
        isHidden = false
      }
      return { checkoutAttemptId: activeCheckoutAttemptId, isNew: false }
    },

    openIndex() {
      return activeOpenIndex
    },

    /** Ends the customer checkout attempt; it cannot be resumed afterwards. */
    end() {
      const closedCheckoutAttemptId = activeCheckoutAttemptId
      activeCheckoutAttemptId = null
      activeOpenIndex = null
      isHidden = false
      return closedCheckoutAttemptId
    },

    // Retained for existing callers that treat every close as terminal.
    close() {
      const closedCheckoutAttemptId = activeCheckoutAttemptId
      activeCheckoutAttemptId = null
      activeOpenIndex = null
      isHidden = false
      return closedCheckoutAttemptId
    },

    claimFailure(
      checkoutAttemptId: string,
      provider: "stripe" | "paypal",
      failureStage: CheckoutFailureStage,
      errorCode: string,
    ) {
      return claimCheckoutFailure(
        seenFailureBranches,
        checkoutAttemptId,
        provider,
        failureStage,
        errorCode,
      )
    },

    claimLifecycle(claim: CheckoutLifecycleClaim) {
      if (
        claim.checkoutAttemptId !== activeCheckoutAttemptId ||
        claim.openIndex !== activeOpenIndex
      ) {
        return false
      }
      const key = lifecycleClaimKey(claim)
      if (seenLifecycleTransitions.has(key)) return false
      seenLifecycleTransitions.add(key)
      return true
    },
  }
}

export type CheckoutAttemptController = ReturnType<typeof createCheckoutAttemptController>
