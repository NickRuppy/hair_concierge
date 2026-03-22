import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingMechanicalStress } from "@/components/onboarding/onboarding-mechanical-stress"
import type { MechanicalStressFactor } from "@/lib/vocabulary"

export default async function OnboardingMechanicalStressPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding/mechanical-stress")
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
    />
  )
}
