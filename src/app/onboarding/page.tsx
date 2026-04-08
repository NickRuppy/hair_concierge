import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

interface OnboardingPageProps {
  searchParams: Promise<{ lead?: string | string[] }>
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding")
  }

  // Link quiz lead if present
  if (leadId) {
    try {
      await linkQuizToProfile(user.id, user.email, leadId)
    } catch (error) {
      console.error("Onboarding lead link failed:", error)
    }
  }

  // Fetch profile data
  const { data: profileRow } = await admin
    .from("profiles")
    .select("onboarding_completed, onboarding_step, has_seen_completion_popup")
    .eq("id", user.id)
    .single()

  // If already completed, redirect to chat
  if (profileRow?.onboarding_completed) {
    redirect("/chat")
  }

  // Fetch hair profile for pre-filling
  const { data: hairProfile } = await admin
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Fetch existing product usage
  const { data: productUsage } = await admin
    .from("user_product_usage")
    .select("*")
    .eq("user_id", user.id)

  return (
    <OnboardingFlow
      userId={user.id}
      initialStep={(profileRow?.onboarding_step as string) ?? "welcome"}
      hairProfile={hairProfile}
      productUsage={productUsage ?? []}
    />
  )
}
