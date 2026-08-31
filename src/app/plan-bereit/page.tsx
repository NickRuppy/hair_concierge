import { redirect } from "next/navigation"
import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimeAccessStateForUser as resolveOneTimeAccessState,
} from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import type { OneTimeAccessState } from "@/lib/billing/types"
import { findPersonalPlanEnrollmentForUser } from "@/lib/personal-plan/enrollment"
import { resolvePersonalPlanMigrationAdmission } from "@/lib/personal-plan/migration-admission"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isPersonalPlanAppV1AllowedForUser } from "@/lib/personal-plan/rollout-access"
import { PersonalPlanReadyClient } from "./personal-plan-ready-client"
import {
  loadPlanBereitInitialReadiness,
  needsFreshMigrationQuiz,
  type PlanBereitInitialReadiness,
} from "./readiness"

export const dynamic = "force-dynamic"

export type PlanBereitAccessSurface =
  | "pricing"
  | "paid_pending_recovery"
  | "source_pending"
  | "transient_error"
  | "onboarding"
  | "ready"

export function resolvePlanBereitAccessSurface({
  active,
  oneTimeAccessState,
  hasLead,
  hasRequestedLead = false,
  sourceLookupUnavailable = false,
}: {
  active: boolean
  oneTimeAccessState: OneTimeAccessState
  hasLead: boolean
  hasRequestedLead?: boolean
  sourceLookupUnavailable?: boolean
}): PlanBereitAccessSurface {
  if (!active && oneTimeAccessState === "paid_pending") return "paid_pending_recovery"
  if (!active) return "pricing"
  if (sourceLookupUnavailable) return "transient_error"
  if (!hasLead && hasRequestedLead) return "source_pending"
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

  if (active) {
    const rollout = await isPersonalPlanAppV1AllowedForUser(user.id).then(
      (allowed) => ({ allowed, unavailable: false as const }),
      (error) => {
        console.warn("[plan-bereit] Personal Plan rollout eligibility unavailable", error)
        return { allowed: false, unavailable: true as const }
      },
    )
    if (rollout.unavailable) {
      return (
        <PersonalPlanReadyClient
          leadId={null}
          initialReadiness={{
            status: "transient_error",
            leadId: null,
            quizSourceKind: null,
            sourceVersion: null,
            missingFacts: [],
            initialAction: "none",
          }}
        />
      )
    }
    if (!rollout.allowed) {
      redirect("/onboarding")
    }
  }

  let canonicalLeadId: string | null = null
  let requestedLeadMatchesEnrollment = true
  const enrollmentResult = active
    ? await findPersonalPlanEnrollmentForUser(admin, user.id).then(
        (enrollment) => ({ enrollment, unavailable: false as const }),
        (error) => {
          console.warn("[plan-bereit] Personal Plan enrollment unavailable", error)
          return { enrollment: null, unavailable: true as const }
        },
      )
    : { enrollment: null, unavailable: false as const }
  const sourceLookupUnavailable = enrollmentResult.unavailable
  if (active && !sourceLookupUnavailable && !enrollmentResult.enrollment?.artifactLeadId) {
    // Read-only first render: source binding and projection start in the existing POST.
    const migration = await resolvePersonalPlanMigrationAdmission({
      client: admin,
      userId: user.id,
    }).catch(() => null)
    if (!migration || migration.status !== "ineligible") {
      return (
        <PersonalPlanReadyClient
          leadId={requestedLeadId}
          initialReadiness={{
            status: migration ? "checking" : "transient_error",
            leadId: requestedLeadId,
            quizSourceKind: null,
            sourceVersion: null,
            missingFacts: [],
            initialAction: migration ? "link" : "none",
          }}
        />
      )
    }
  }
  if (!active && oneTimeAccessState === "paid_pending") {
    const entitlement = await findOneTimePurchaseEntitlementForUser(admin, user.id)
    canonicalLeadId = entitlement?.consent?.lead_id ?? null
    requestedLeadMatchesEnrollment =
      !requestedLeadId || (canonicalLeadId !== null && requestedLeadId === canonicalLeadId)
  } else if (active) {
    canonicalLeadId = enrollmentResult.enrollment?.artifactLeadId ?? null
    requestedLeadMatchesEnrollment =
      !requestedLeadId || (canonicalLeadId !== null && requestedLeadId === canonicalLeadId)
  }

  switch (
    resolvePlanBereitAccessSurface({
      active,
      oneTimeAccessState,
      hasLead: Boolean(canonicalLeadId),
      hasRequestedLead: Boolean(requestedLeadId),
      sourceLookupUnavailable,
    })
  ) {
    case "paid_pending_recovery":
      return <PersonalPlanPaidPendingRecovery canonicalLeadId={canonicalLeadId} />
    case "onboarding":
      redirect("/onboarding")
    case "source_pending":
      return (
        <PersonalPlanReadyClient
          leadId={null}
          initialReadiness={{
            status: "source_pending",
            leadId: null,
            quizSourceKind: null,
            sourceVersion: null,
            missingFacts: [],
            initialAction: "poll",
          }}
        />
      )
    case "transient_error":
      return (
        <PersonalPlanReadyClient
          leadId={null}
          initialReadiness={{
            status: "transient_error",
            leadId: null,
            quizSourceKind: null,
            sourceVersion: null,
            missingFacts: [],
            initialAction: "none",
          }}
        />
      )
    case "ready":
      const initialReadiness: PlanBereitInitialReadiness = requestedLeadMatchesEnrollment
        ? await loadPlanBereitInitialReadiness(admin, {
            userId: user.id,
            email: user.email,
            leadId: canonicalLeadId,
            expectedQuizSourceKind: enrollmentResult.enrollment?.quizSourceKind ?? null,
          }).catch((error) => {
            console.warn("[plan-bereit] initial readiness unavailable", error)
            return {
              status: "transient_error",
              leadId: canonicalLeadId,
              quizSourceKind: enrollmentResult.enrollment?.quizSourceKind ?? null,
              sourceVersion: null,
              missingFacts: [],
              initialAction: "none",
            }
          })
        : {
            status: "forbidden",
            leadId: canonicalLeadId,
            quizSourceKind: enrollmentResult.enrollment?.quizSourceKind ?? null,
            sourceVersion: null,
            missingFacts: [],
            initialAction: "none",
          }
      return (
        <PersonalPlanReadyClient
          leadId={canonicalLeadId}
          initialReadiness={
            enrollmentResult.enrollment?.sourceKind === "migration" &&
            needsFreshMigrationQuiz(initialReadiness)
              ? { ...initialReadiness, status: "checking", initialAction: "link" }
              : initialReadiness
          }
          nextHref="/plan-start"
        />
      )
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
