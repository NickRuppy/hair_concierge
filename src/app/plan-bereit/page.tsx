import { redirect } from "next/navigation"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { findPersonalPlanLead } from "./readiness"
import { PersonalPlanReadyClient } from "./personal-plan-ready-client"

export const dynamic = "force-dynamic"

export default async function PersonalPlanReadyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth?next=%2Fplan-bereit")
  }

  const admin = createAdminClient()
  const active = await hasCurrentAppAccess(admin, { userId: user.id, email: user.email })
  if (!active) {
    redirect("/pricing")
  }

  const lead = await findPersonalPlanLead(admin, user.id, user.email)
  if (!lead) {
    redirect("/onboarding")
  }

  return <PersonalPlanReadyClient />
}
