import { redirect } from "next/navigation"
import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimeAccessStateForUser as resolveOneTimeAccessState,
} from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import type { OneTimeAccessState } from "@/lib/billing/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { findPersonalPlanLead } from "./readiness"
import { PersonalPlanReadyClient } from "./personal-plan-ready-client"

export const dynamic = "force-dynamic"

export type PlanBereitAccessSurface = "pricing" | "paid_pending_recovery" | "onboarding" | "ready"

export function resolvePlanBereitAccessSurface({
  active,
  oneTimeAccessState,
  hasLead,
}: {
  active: boolean
  oneTimeAccessState: OneTimeAccessState
  hasLead: boolean
}): PlanBereitAccessSurface {
  if (!active && oneTimeAccessState === "paid_pending") return "paid_pending_recovery"
  if (!active) return "pricing"
  if (!hasLead) return "onboarding"
  return "ready"
}

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
  const [active, oneTimeAccessState] = await Promise.all([
    hasCurrentAppAccess(admin, { userId: user.id, email: user.email }),
    resolveOneTimeAccessState(admin, user.id),
  ])
  if (
    resolvePlanBereitAccessSurface({
      active,
      oneTimeAccessState,
      hasLead: false,
    }) === "pricing"
  ) {
    redirect("/pricing")
  }

  let lead = await findPersonalPlanLead(admin, user.id, user.email, requestedLeadId)
  let canonicalLeadId: string | null = null
  if (!active && oneTimeAccessState === "paid_pending") {
    const entitlement = await findOneTimePurchaseEntitlementForUser(admin, user.id)
    canonicalLeadId = entitlement?.consent?.lead_id ?? lead?.id ?? null
    if (canonicalLeadId && canonicalLeadId !== requestedLeadId) {
      lead = await findPersonalPlanLead(admin, user.id, user.email, canonicalLeadId)
    }
  }

  switch (resolvePlanBereitAccessSurface({ active, oneTimeAccessState, hasLead: Boolean(lead) })) {
    case "paid_pending_recovery":
      return <PersonalPlanPaidPendingRecovery canonicalLeadId={canonicalLeadId} />
    case "onboarding":
      redirect("/onboarding")
    case "ready":
      if (!lead) redirect("/onboarding")
      return <PersonalPlanReadyClient leadId={lead.id} />
    case "pricing":
      redirect("/pricing")
  }
}

export function PersonalPlanPaidPendingRecovery({
  canonicalLeadId,
}: {
  canonicalLeadId: string | null
}) {
  const retryPath = canonicalLeadId
    ? `/plan-bereit?lead=${encodeURIComponent(canonicalLeadId)}`
    : "/plan-bereit"

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <section aria-live="polite" className="w-full max-w-md space-y-6 text-center" role="status">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Zahlung bestätigt</p>
          <h1 className="font-header text-3xl text-foreground">Wir verknüpfen deinen Haarplan</h1>
          <p className="text-base text-muted-foreground">
            Deine Zahlung ist sicher erfasst. Wir verbinden gerade deinen persönlichen Haarplan mit
            deinem Konto. Du musst nichts erneut kaufen.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={retryPath}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Status erneut prüfen
          </a>
          <a
            href="/kontakt"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Support kontaktieren
          </a>
        </div>
      </section>
    </main>
  )
}
