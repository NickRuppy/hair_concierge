import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingMechanicalStress } from "@/components/onboarding/onboarding-mechanical-stress"
import type { MechanicalStressFactor } from "@/lib/vocabulary"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

interface OnboardingMechanicalStressPageProps {
  searchParams: Promise<{ lead?: string | string[] }>
}

export default async function OnboardingMechanicalStressPage({
  searchParams,
}: OnboardingMechanicalStressPageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/mechanical-stress")
  }

  try {
    await linkQuizToProfile(user.id, user.email, leadId)
  } catch (error) {
    console.error("Onboarding lead link failed:", error)
  }

  const { data: profile } = await admin
    .from("hair_profiles")
    .select("mechanical_stress_factors")
    .eq("user_id", user.id)
    .single()

  const existing = (profile?.mechanical_stress_factors as MechanicalStressFactor[] | null) ?? []

  return (
    <OnboardingMechanicalStress
      existingFactors={existing}
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
