import type { SupabaseClient } from "@supabase/supabase-js"

export function getAuthenticatedCheckoutSuccessRedirect(
  onboardingCompleted: boolean | null | undefined,
  reactivationReturnDestination?: string | null,
  firstTimeDestination = "/onboarding",
) {
  if (!onboardingCompleted) return firstTimeDestination
  // This is not a reactivation: a Personal Plan purchase has already derived
  // the owner-specific ready or provisioning destination on the server.
  if (
    !reactivationReturnDestination &&
    (firstTimeDestination === "/plan-start" ||
      firstTimeDestination.startsWith("/plan-bereit?lead="))
  ) {
    return firstTimeDestination
  }
  return reactivationReturnDestination ?? "/profile?membership=reactivated"
}

export type CheckoutFirstTimeDestination =
  | "/onboarding"
  | "/plan-start"
  | `/plan-bereit?lead=${string}`

export type CheckoutFirstTimeDestinationOptions = {
  personalPlanActivationReady?: boolean
  personalPlanLegacy?: boolean
  /**
   * Server-derived eligibility for the reversible legacy-quiz cutover. This
   * remains false until the purchase/enrollment resolver proves the exact
   * future purchase qualifies; it must never come from checkout query state.
   */
  legacyQuizFuturePurchaseEligible?: boolean
  /**
   * Server-resolved funnel package of the lead (`funnel_sessions`), never client input.
   *
   * The scanner-first package (`scan_v1`) deliberately does NOT change any destination
   * here: a scan_v1 buyer takes the same eligibility-gated `/plan-bereit?lead=…`
   * provisioning step as any other legacy-quiz buyer, and only that page decides to
   * continue into `/scan` instead of `/plan-start`. The field is carried so the
   * destination matrix is decided with the package in hand rather than blind to it.
   */
  funnelPackageKey?: string | null
}

/**
 * Checkout activation returns may carry this field only after the server has
 * correlated the account with a qualifying purchase/enrollment. Keeping the
 * projection here makes password and magic-link routes consume the same
 * server-owned bit without accepting a client request parameter.
 */
export function getCheckoutFirstTimeDestinationOptionsFromAccount(
  input: object,
): CheckoutFirstTimeDestinationOptions {
  const { legacyQuizFuturePurchaseEligible, funnelPackageKey } = input as {
    legacyQuizFuturePurchaseEligible?: unknown
    funnelPackageKey?: unknown
  }
  return {
    legacyQuizFuturePurchaseEligible: legacyQuizFuturePurchaseEligible === true,
    funnelPackageKey: typeof funnelPackageKey === "string" ? funnelPackageKey : null,
  }
}

export type PersonalPlanCheckoutReadiness = {
  appEnabled: boolean
  accessState: "active" | "paid_pending" | "none" | "revoked"
  paidAt: string | null
  artifactLeadId: string | null
  preparedArtifactAttached: boolean
  cohortCutoff: Date | null
}

export function resolvePersonalPlanCheckoutReadiness(input: PersonalPlanCheckoutReadiness): {
  activationReady: boolean
  legacy: boolean
} {
  if (input.accessState !== "active") return { activationReady: false, legacy: false }
  if (!input.cohortCutoff || !input.paidAt || !input.artifactLeadId) {
    return { activationReady: false, legacy: true }
  }
  const paidAt = new Date(input.paidAt)
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() < input.cohortCutoff.getTime()) {
    return { activationReady: false, legacy: true }
  }
  return {
    activationReady: input.appEnabled && input.preparedArtifactAttached,
    legacy: false,
  }
}

export function getCheckoutFirstTimeDestination(
  quizKind: string | null | undefined,
  leadId?: string | null,
  checkoutContext?: string | null,
  options: CheckoutFirstTimeDestinationOptions = {},
): CheckoutFirstTimeDestination {
  if (checkoutContext === "membership_reactivation") return "/onboarding"
  if (quizKind === "personal_plan" && options.personalPlanLegacy) return "/onboarding"
  if (quizKind === "personal_plan" && options.personalPlanActivationReady) return "/plan-start"
  return (quizKind === "personal_plan" ||
    (quizKind === "legacy" && options.legacyQuizFuturePurchaseEligible)) &&
    leadId
    ? `/plan-bereit?lead=${encodeURIComponent(leadId)}`
    : "/onboarding"
}

export function isCheckoutFirstTimeDestination(
  value: unknown,
): value is CheckoutFirstTimeDestination {
  return (
    value === "/onboarding" ||
    value === "/plan-start" ||
    (typeof value === "string" && /^\/plan-bereit\?lead=[^&/?#]+$/.test(value))
  )
}

export async function resolveCheckoutFirstTimeDestination(
  supabase: Pick<SupabaseClient, "from">,
  leadId?: string | null,
  checkoutContext?: string | null,
  options?: CheckoutFirstTimeDestinationOptions,
): Promise<CheckoutFirstTimeDestination> {
  if (!leadId || checkoutContext === "membership_reactivation") return "/onboarding"

  const { data, error } = await supabase
    .from("leads")
    .select("quiz_kind")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    console.warn("[checkout-success] could not resolve quiz kind", error)
    if (options?.legacyQuizFuturePurchaseEligible) {
      return `/plan-bereit?lead=${encodeURIComponent(leadId)}`
    }
    return "/onboarding"
  }

  return getCheckoutFirstTimeDestination(
    (data as { quiz_kind?: string | null } | null)?.quiz_kind,
    leadId,
    checkoutContext,
    options,
  )
}
