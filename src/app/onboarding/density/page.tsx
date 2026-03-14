import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingDensity } from "@/components/onboarding/onboarding-density"
import type { HairDensity, HairTexture } from "@/lib/vocabulary"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

interface OnboardingDensityPageProps {
  searchParams: Promise<{ lead?: string | string[] }>
}

export default async function OnboardingDensityPage({
  searchParams,
}: OnboardingDensityPageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/density")
  }

  try {
    await linkQuizToProfile(user.id, user.email, leadId)
  } catch (error) {
    console.error("Onboarding lead link failed:", error)
  }

  const { data: profile } = await admin
    .from("hair_profiles")
    .select("hair_texture, density")
    .eq("user_id", user.id)
    .single()

  return (
    <OnboardingDensity
      hairTexture={(profile?.hair_texture as HairTexture) ?? null}
      existingDensity={(profile?.density as HairDensity | null) ?? null}
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
