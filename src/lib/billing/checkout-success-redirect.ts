import type { SupabaseClient } from "@supabase/supabase-js"

export function getAuthenticatedCheckoutSuccessRedirect(
  onboardingCompleted: boolean | null | undefined,
  reactivationReturnDestination?: string | null,
  firstTimeDestination = "/onboarding",
) {
  if (!onboardingCompleted) return firstTimeDestination
  return reactivationReturnDestination ?? "/profile?membership=reactivated"
}

export type CheckoutFirstTimeDestination = "/onboarding" | "/plan-bereit"

export function getCheckoutFirstTimeDestination(
  quizKind: string | null | undefined,
  checkoutContext?: string | null,
): CheckoutFirstTimeDestination {
  if (checkoutContext === "membership_reactivation") return "/onboarding"
  return quizKind === "personal_plan" ? "/plan-bereit" : "/onboarding"
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
    checkoutContext,
  )
}
