import { redirect } from "next/navigation"
import { readTrialRuntime } from "@/lib/billing/trial-runtime"
import { trialOfferDestinationForReturningCustomer } from "@/lib/billing/trial-returning-customer"

import {
  MembershipReactivationPage,
  TrialMembershipReactivationPage,
} from "@/components/reactivation/membership-reactivation-page"
import { buildTrialMembershipState } from "@/lib/billing/trial-membership"
import { readTrialEffectiveContract } from "@/lib/billing/trial-effective-contract"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { resolveSubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"
import { isPersonalPlanLaunchPricingEnabled } from "@/lib/funnel/flags"
import { buildQuizOfferPreview } from "@/lib/quiz/offer-preview"
import { buildQuizAnswersFromHairProfile } from "@/lib/reactivation/profile-quiz-answers"
import {
  buildReactivationSignInUrl,
  parseReactivationInterval,
  sanitizeReactivationReturnDestination,
} from "@/lib/reactivation/return-destination"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ReactivatePage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; next?: string }>
}) {
  const params = await searchParams
  const returnDestination = sanitizeReactivationReturnDestination(params.next)
  const initialInterval = parseReactivationInterval(params.interval)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(buildReactivationSignInUrl(initialInterval, returnDestination))
  }

  let accessState: "active" | "expired" | "uncertain"
  try {
    accessState = (await hasCurrentAppAccess(supabase, {
      userId: user.id,
      email: user.email,
    }))
      ? "active"
      : "expired"
  } catch (error) {
    console.warn("[reactivate] app access check failed", error)
    accessState = "uncertain"
  }

  if (accessState === "active") redirect(returnDestination)
  if (accessState === "uncertain") {
    return <TrialMembershipReactivationPage initialState={{ kind: "uncertain" }} />
  }

  // Read the caller's enrollment before private profile content or legacy checkout.
  // An unresolved enrollment must not start a second collectible agreement.
  try {
    const { data: enrollment, error } = await createAdminClient()
      .from("trial_enrollments")
      .select(
        "id,user_id,accepted_offer,admission_status,authorization_succeeded_at,original_trial_end_at,first_payment_succeeded_at,paid_through_at,renewal_grace_ends_at,renewal_payment_failed,cancel_at_period_end,access_revoked",
      )
      .eq("user_id", user.id)
      // A later denied attempt must not hide the customer's accepted contract.
      .order("authorization_succeeded_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (enrollment) {
      const contract = await readTrialEffectiveContract(createAdminClient(), enrollment.id)
      const projected = buildTrialMembershipState(
        { ...enrollment, accepted_offer: contract.offer },
        user.id,
        new Date(),
      )
      const state =
        projected.kind === "trial_membership"
          ? { ...projected, managementRevision: contract.revision }
          : projected
      return (
        <TrialMembershipReactivationPage
          initialState={state.kind === "trial_membership" ? state : { kind: "uncertain" }}
        />
      )
    }
  } catch (error) {
    console.warn("[reactivate] trial membership unavailable", error)
    return <TrialMembershipReactivationPage initialState={{ kind: "uncertain" }} />
  }

  let trialDestination: string | null
  try {
    trialDestination = await trialOfferDestinationForReturningCustomer(createAdminClient(), {
      userId: user.id,
      verifiedEmail: user.email_confirmed_at ? (user.email ?? null) : null,
      runtime: readTrialRuntime(),
    })
  } catch {
    return <TrialMembershipReactivationPage initialState={{ kind: "uncertain" }} />
  }
  if (trialDestination) redirect(trialDestination)

  const [{ data: profile, error: profileError }, { data: hairProfile, error: hairProfileError }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("hair_profiles")
        .select(
          "hair_texture, thickness, density, hair_length, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns, primary_concern, goals",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ])

  if (profileError) console.warn("[reactivate] profile preview name unavailable", profileError)
  if (hairProfileError)
    console.warn("[reactivate] saved hair profile unavailable", hairProfileError)

  const routinePreview = buildQuizOfferPreview(buildQuizAnswersFromHairProfile(hairProfile))
  const pricingCatalog = resolveSubscriptionPricingCatalog(isPersonalPlanLaunchPricingEnabled())
  const fullName = typeof profile?.full_name === "string" ? profile.full_name.trim() : ""
  const firstName = fullName ? fullName.split(/\s+/)[0] : null

  return (
    <MembershipReactivationPage
      firstName={firstName}
      initialInterval={initialInterval}
      pricingCatalog={pricingCatalog}
      returnDestination={returnDestination}
      routinePreview={routinePreview}
      showCheckout={accessState === "expired"}
    />
  )
}
