import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingProfile } from "@/components/onboarding/onboarding-profile"
import type { HairDensity, HairTexture, MechanicalStressFactor } from "@/lib/vocabulary"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

interface OnboardingProfilePageProps {
  searchParams: Promise<{ lead?: string | string[] }>
}

export default async function OnboardingProfilePage({
  searchParams,
}: OnboardingProfilePageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/profile")
  }

  if (leadId) {
    try {
      await linkQuizToProfile(user.id, user.email, leadId)
    } catch (error) {
      console.error("Onboarding lead link failed:", error)
    }
  }

  const { data: profile } = await admin
    .from("hair_profiles")
    .select("hair_texture, density, mechanical_stress_factors, answered_fields")
    .eq("user_id", user.id)
    .single()

  return (
    <OnboardingProfile
      hairTexture={(profile?.hair_texture as HairTexture) ?? null}
      existingDensity={(profile?.density as HairDensity | null) ?? null}
      existingFactors={
        (profile?.mechanical_stress_factors as MechanicalStressFactor[]) ?? []
      }
      mechanicalStressWasAnswered={
        Array.isArray(profile?.answered_fields) &&
        (profile.answered_fields as string[]).includes("mechanical_stress_factors")
      }
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
