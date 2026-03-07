import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingGoals } from "@/components/onboarding/onboarding-goals"
import type { HairTexture } from "@/lib/vocabulary"

export default async function OnboardingGoalsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/goals")
  }

  const { data: profile } = await supabase
    .from("hair_profiles")
    .select("hair_texture, goals, post_wash_actions, routine_preference, current_routine_products")
    .eq("user_id", user.id)
    .single()

  return (
    <OnboardingGoals
      hairTexture={(profile?.hair_texture as HairTexture) ?? null}
      existingGoals={(profile?.goals as string[]) ?? []}
      existingPostWashActions={(profile?.post_wash_actions as string[]) ?? []}
      existingRoutinePreference={(profile?.routine_preference as string | null) ?? null}
      existingRoutineProducts={(profile?.current_routine_products as string[]) ?? []}
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
