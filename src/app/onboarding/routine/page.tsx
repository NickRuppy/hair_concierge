import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingRoutine } from "@/components/onboarding/onboarding-routine"
import type { WashFrequency, HeatStyling } from "@/lib/vocabulary"

export default async function OnboardingRoutinePage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/routine")
  }

  const { data: profile } = await admin
    .from("hair_profiles")
    .select("wash_frequency, heat_styling, post_wash_actions, current_routine_products")
    .eq("user_id", user.id)
    .single()

  if (!profile) {
    redirect("/quiz")
  }

  return (
    <OnboardingRoutine
      existingWashFrequency={(profile.wash_frequency as WashFrequency) ?? null}
      existingHeatStyling={(profile.heat_styling as HeatStyling) ?? null}
      existingPostWashActions={(profile.post_wash_actions as string[]) ?? []}
      existingRoutineProducts={(profile.current_routine_products as string[]) ?? []}
      userId={user.id}
    />
  )
}
