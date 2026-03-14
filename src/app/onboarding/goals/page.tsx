import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingGoals } from "@/components/onboarding/onboarding-goals"
import type { HairTexture } from "@/lib/vocabulary"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

interface OnboardingGoalsPageProps {
  searchParams: Promise<{ lead?: string | string[] }>
}

export default async function OnboardingGoalsPage({
  searchParams,
}: OnboardingGoalsPageProps) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/goals")
  }

  if (leadId) {
    try {
      await linkQuizToProfile(user.id, user.email, leadId)
    } catch (error) {
      console.error("Onboarding lead link failed:", error)
    }
  }

  const { data: profile } = await supabase
    .from("hair_profiles")
    .select("hair_texture, goals, desired_volume, post_wash_actions, routine_preference, current_routine_products")
    .eq("user_id", user.id)
    .single()

  return (
    <OnboardingGoals
      hairTexture={(profile?.hair_texture as HairTexture) ?? null}
      existingGoals={(profile?.goals as string[]) ?? []}
      existingDesiredVolume={(profile?.desired_volume as "less" | "balanced" | "more" | null) ?? null}
      existingPostWashActions={(profile?.post_wash_actions as string[]) ?? []}
      existingRoutinePreference={(profile?.routine_preference as string | null) ?? null}
      existingRoutineProducts={(profile?.current_routine_products as string[]) ?? []}
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
