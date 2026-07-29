import { redirect } from "next/navigation"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { findPersonalPlanLead } from "./readiness"
import { PersonalPlanReadyClient } from "./personal-plan-ready-client"

export const dynamic = "force-dynamic"

export default async function PersonalPlanReadyPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string | string[] }>
}) {
  const sp = await searchParams
  const requestedLeadId = typeof sp.lead === "string" ? sp.lead : null
  const readyPath = requestedLeadId
    ? `/plan-bereit?lead=${encodeURIComponent(requestedLeadId)}`
    : "/plan-bereit"
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent(readyPath)}`)
  }

  const admin = createAdminClient()
  const active = await hasCurrentAppAccess(admin, { userId: user.id, email: user.email })
  if (!active) {
    redirect("/pricing")
  }

  const lead = await findPersonalPlanLead(admin, user.id, user.email, requestedLeadId)
  if (!lead) {
    redirect("/onboarding")
  }

  return <PersonalPlanReadyClient leadId={lead.id} />
}
