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
    .select("hair_texture, goals")
    .eq("user_id", user.id)
    .single()

  return (
    <OnboardingGoals
      hairTexture={(profile?.hair_texture as HairTexture) ?? null}
      existingGoals={(profile?.goals as string[]) ?? []}
      userId={user.id}
      hasProfile={!!profile}
    />
  )
}
