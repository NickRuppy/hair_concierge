import type { SupabaseClient } from "@supabase/supabase-js"

export function getAuthenticatedCheckoutSuccessRedirect(
  onboardingCompleted: boolean | null | undefined,
  reactivationReturnDestination?: string | null,
  firstTimeDestination = "/onboarding",
) {
  if (!onboardingCompleted) return firstTimeDestination
  return reactivationReturnDestination ?? "/profile?membership=reactivated"
}

export type CheckoutFirstTimeDestination = "/onboarding" | `/plan-bereit?lead=${string}`

export function getCheckoutFirstTimeDestination(
  quizKind: string | null | undefined,
  leadId?: string | null,
  checkoutContext?: string | null,
): CheckoutFirstTimeDestination {
  if (checkoutContext === "membership_reactivation") return "/onboarding"
  return quizKind === "personal_plan" && leadId
    ? `/plan-bereit?lead=${encodeURIComponent(leadId)}`
    : "/onboarding"
}

export function isCheckoutFirstTimeDestination(
  value: unknown,
): value is CheckoutFirstTimeDestination {
  return (
    value === "/onboarding" ||
    (typeof value === "string" && /^\/plan-bereit\?lead=[^&/?#]+$/.test(value))
  )
}

export async function resolveCheckoutFirstTimeDestination(
  supabase: Pick<SupabaseClient, "from">,
  leadId?: string | null,
  checkoutContext?: string | null,
): Promise<CheckoutFirstTimeDestination> {
  if (!leadId || checkoutContext === "membership_reactivation") return "/onboarding"

  const { data, error } = await supabase
    .from("leads")
    .select("quiz_kind")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    console.warn("[checkout-success] could not resolve quiz kind", error)
    return "/onboarding"
  }

  return getCheckoutFirstTimeDestination(
    (data as { quiz_kind?: string | null } | null)?.quiz_kind,
    leadId,
    checkoutContext,
  )
}
