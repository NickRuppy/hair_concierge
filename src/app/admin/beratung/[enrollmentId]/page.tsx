import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DiscoveryCallCockpit } from "@/components/discovery/cockpit/discovery-call-cockpit"
import { formatDiscoveryTimestamp } from "@/components/discovery/cockpit/format"
import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  buildDiscoveryCockpitView,
  loadDiscoveryCallIntake,
  loadDiscoveryCockpitModel,
  DISCOVERY_RESEARCH_PENDING_LABEL,
  type DiscoveryCockpitAdminClient,
  type DiscoveryCockpitView,
} from "@/lib/discovery/cockpit"
import { loadDiscoveryEnrollment } from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createAdminClient } from "@/lib/supabase/admin"

import { loadDiscoverySourceFactsPreflight, type DiscoverySourceFactsPreflight } from "./preflight"

/**
 * The discovery call cockpit (mockup: `plans/discovery-call-toolkit/evidence/cockpit.html`).
 *
 * One screen for one call: the Idealroutine to read out, the engine's verdict on every
 * product the participant owns, one keep/swap decision per routine step, and
 * „Finalisieren" at the bottom. Everything it shows comes from ONE composition
 * (`loadDiscoveryCockpitModel`) — the same one the decisions route validates against, so
 * the screen and the rules behind it cannot drift apart.
 *
 * The page is gated twice: the feature's kill switch, then the shared `requireAdmin`. A
 * non-admin gets `notFound()` rather than a 403 page — an admin surface should not confirm
 * its own existence.
 */

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const TOOL_LABEL = "Discovery-Cockpit"
const ROUTINE_TITLE = "Idealroutine"
const OUTSIDE_TITLE = "Nicht in der Idealroutine"
const NO_INTAKE = "Diese Teilnehmerin hat die Checkliste noch nicht geöffnet."
const NO_SOURCE = "Für dieses Konto gibt es noch kein nutzbares Haarprofil. Quiz prüfen."
const UNAVAILABLE = "Der Plan lässt sich gerade nicht lesen. Später noch einmal öffnen."
const BRANDS_UNAVAILABLE =
  "Markennamen der Empfehlungen sind gerade nicht lesbar. Finalisieren und PDF gehen erst wieder, wenn der Katalog antwortet — Seite später neu laden."
const PREFLIGHT_TITLE = "Intake unvollständig"
const PREFLIGHT_NO_LEAD = "Zu diesem Konto ist kein Quiz-Lead gebunden."
const PREFLIGHT_INVALID = "Die Quiz-Antworten sind nicht lesbar."
const PREFLIGHT_MISSING = "Diese Antworten fehlen für einen vollständigen Plan:"
const DECLINED_SUFFIX = "— benutzt sie nicht. Keine Entscheidung nötig."
const NO_STEP_SUFFIX = "— kein Schritt im Idealplan:"

export type DiscoveryCockpitPageDependencies = {
  flagEnabled: () => boolean
  requireAdmin: typeof requireAdmin
  createAdminClient: () => DiscoveryCockpitAdminClient
  loadEnrollment: typeof loadDiscoveryEnrollment
  loadIntake: typeof loadDiscoveryCallIntake
  loadModel: typeof loadDiscoveryCockpitModel
  loadPreflight: typeof loadDiscoverySourceFactsPreflight
}

const DEFAULTS: DiscoveryCockpitPageDependencies = {
  flagEnabled: isDiscoveryCallToolkitEnabled,
  requireAdmin,
  createAdminClient,
  loadEnrollment: loadDiscoveryEnrollment,
  loadIntake: loadDiscoveryCallIntake,
  loadModel: loadDiscoveryCockpitModel,
  loadPreflight: loadDiscoverySourceFactsPreflight,
}

export function createDiscoveryCockpitPage(
  overrides: Partial<DiscoveryCockpitPageDependencies> = {},
) {
  const deps = { ...DEFAULTS, ...overrides }

  return async function DiscoveryCockpitPage({
    params,
  }: {
    params: Promise<{ enrollmentId: string }>
  }) {
    if (!deps.flagEnabled()) notFound()
    const auth = await deps.requireAdmin()
    if ("response" in auth) notFound()

    const admin = deps.createAdminClient()
    const { enrollmentId } = await params
    const enrollment = await deps.loadEnrollment({ enrollmentId }, admin)
    if (!enrollment) notFound()

    const intake = await deps.loadIntake(enrollmentId, admin)
    if (!intake) {
      return (
        <Shell name={enrollment.name} email={enrollment.email} status="ohne Checkliste">
          <Notice text={NO_INTAKE} />
        </Shell>
      )
    }

    const status = intake.state === "submitted" ? "submitted" : "draft"
    const statusLine =
      intake.state === "submitted"
        ? `${status} · ${formatDiscoveryTimestamp(intake.submittedAt)}`
        : status

    const model = await deps.loadModel(admin, { intakeId: intake.id, userId: intake.userId })
    if (model.status !== "ready") {
      return (
        <Shell name={enrollment.name} email={enrollment.email} status={statusLine}>
          <Notice text={model.status === "no_usable_source" ? NO_SOURCE : UNAVAILABLE} />
        </Shell>
      )
    }

    const view = buildDiscoveryCockpitView(model)
    const preflight = await deps.loadPreflight(admin, intake.userId)

    return (
      <Shell name={enrollment.name} email={enrollment.email} status={statusLine}>
        <PreflightBanner preflight={preflight} />
        {view.recommendationBrandsAvailable ? null : <Notice text={BRANDS_UNAVAILABLE} />}
        <IdealRoutine view={view} />
        <DiscoveryCallCockpit
          enrollmentId={enrollmentId}
          steps={view.steps}
          submitted={intake.state === "submitted"}
          initialFinalizedAt={intake.callFinalizedAt}
        />
        <OutsideRoutine view={view} />
      </Shell>
    )
  }
}

function Shell({
  name,
  email,
  status,
  children,
}: {
  name: string
  email: string
  status: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {TOOL_LABEL}
        </span>
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        <span className="text-sm text-muted-foreground">{email}</span>
        <span className="ml-auto rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {status}
        </span>
      </div>
      {children}
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{text}</p>
}

function PreflightBanner({ preflight }: { preflight: DiscoverySourceFactsPreflight }) {
  if (preflight.status === "ready") return null
  return (
    <section className="rounded-xl border border-[var(--status-pending-text)] bg-[var(--status-pending-bg)] p-4">
      <p className="text-sm font-bold text-[var(--status-pending-text)]">{PREFLIGHT_TITLE}</p>
      {preflight.status === "no_lead" ? (
        <p className="mt-1 text-[13px] text-foreground">{PREFLIGHT_NO_LEAD}</p>
      ) : null}
      {preflight.status === "invalid_source" ? (
        <p className="mt-1 text-[13px] text-foreground">{PREFLIGHT_INVALID}</p>
      ) : null}
      {preflight.status === "missing_source_facts" ? (
        <>
          <p className="mt-1 text-[13px] text-foreground">{PREFLIGHT_MISSING}</p>
          <ul className="mt-1 list-disc pl-5 text-[13px] text-foreground">
            {preflight.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** Written to be read aloud: step, category, what happens, how often. */
function IdealRoutine({ view }: { view: DiscoveryCockpitView }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {ROUTINE_TITLE}
      </h2>
      <ol className="divide-y">
        {view.steps.map((step, index) => (
          <li key={step.decisionKey} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
            <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
            <span className="w-36 shrink-0 rounded bg-[var(--brand-plum-ice)] px-2 py-0.5 text-center text-xs font-bold text-[var(--brand-plum)]">
              {step.categoryLabel}
            </span>
            <span className="flex-1 text-sm text-foreground">
              {step.roleDescription ?? step.roleLabel}
            </span>
            <span className="text-xs text-muted-foreground">{step.frequencyLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The checklist's own labels, so the cockpit names a category the way the participant saw it. */
function categoryLine(categories: readonly PersonalPlanCategory[]): string {
  return categories.map((category) => DISCOVERY_INTAKE_CATEGORY_COPY[category].label).join(" · ")
}

/**
 * Everything with no decision to make, collapsed: „benutze ich nicht" categories on one
 * grey line, products outside the Idealroutine on another, and whatever is still being
 * researched on a third — named, so Nick can still mention it.
 *
 * The no-step line names its products, not just their categories: the participant's
 * document lists every one of them under „Brauchst du nicht mehr", and Nick has to be
 * able to read that list here before he finalises and sends it.
 */
function OutsideRoutine({ view }: { view: DiscoveryCockpitView }) {
  const noStep = view.unassigned.filter((entry) => entry.reason === "no_ideal_step")
  const research = view.unassigned.filter((entry) => entry.reason === "research_pending")
  if (view.declinedCategories.length === 0 && noStep.length === 0 && research.length === 0) {
    return null
  }
  const noStepCategories = [...new Set(noStep.map((entry) => entry.category))]

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {OUTSIDE_TITLE}
      </h2>
      <div className="flex flex-col gap-1.5 px-4 py-3 text-[13px] leading-6 text-muted-foreground">
        {view.declinedCategories.length > 0 ? (
          <p>{`${categoryLine(view.declinedCategories)} ${DECLINED_SUFFIX}`}</p>
        ) : null}
        {noStep.length > 0 ? (
          <p>{`${categoryLine(noStepCategories)} ${NO_STEP_SUFFIX} ${noStep
            .map((entry) => entry.label)
            .join(" · ")}`}</p>
        ) : null}
        {research.length > 0 ? (
          <p>{`${DISCOVERY_RESEARCH_PENDING_LABEL}: ${research
            .map((entry) => entry.label)
            .join(" · ")}`}</p>
        ) : null}
      </div>
    </section>
  )
}

export default createDiscoveryCockpitPage()
