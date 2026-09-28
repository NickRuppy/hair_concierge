import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DiscoveryConcernRecipeSection } from "@/components/discovery/cockpit/concern-recipe"
import { DiscoveryCallCockpit } from "@/components/discovery/cockpit/discovery-call-cockpit"
import { DiscoveryIntakeProducts } from "@/components/discovery/cockpit/discovery-intake-products"
import {
  DISCOVERY_EMAIL_PENDING_LABEL,
  discoveryCockpitStateKey,
  formatDiscoveryTimestamp,
} from "@/components/discovery/cockpit/format"
import { DiscoveryQuizAnswersSection } from "@/components/discovery/cockpit/quiz-answers"
import { DiscoveryRunsheetBrief } from "@/components/discovery/cockpit/runsheet-brief"
import { DiscoveryRunsheetFollowUp } from "@/components/discovery/cockpit/runsheet-follow-up"
import {
  RUNSHEET_ASK_TOPIC,
  runsheetChecklistLines,
} from "@/components/discovery/cockpit/runsheet-parts"
import {
  composeRunsheetOutsideRoutine,
  composeRunsheetProducts,
} from "@/components/discovery/cockpit/runsheet-products"
import { DiscoveryRunsheetRoutine } from "@/components/discovery/cockpit/runsheet-routine"
import {
  DISCOVERY_INTAKE_CATEGORY_COPY,
  DISCOVERY_INTAKE_GROUPS,
} from "@/components/discovery/intake/categories"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  EMPTY_DISCOVERY_BRIEF_SECTIONS,
  loadDiscoveryCallSheet,
  type DiscoveryCallSheet,
} from "@/lib/discovery/call-sheet"
import {
  buildDiscoveryCockpitView,
  discoveryCategoryOpenItems,
  discoveryResearchOpenItems,
  loadDiscoveryCallIntake,
  loadDiscoveryCockpitModel,
  type DiscoveryCockpitAdminClient,
  type DiscoveryCockpitView,
} from "@/lib/discovery/cockpit"
import {
  UNKNOWN_CONCERN_PROFILE_FACTS,
  buildDiscoveryConcernRecipeView,
  discoveryConcernCoverageInput,
} from "@/lib/discovery/concern-recipe-view"
import { loadDiscoveryEnrollment } from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { buildDiscoveryQuizAnswers, type DiscoveryQuizLead } from "@/lib/discovery/quiz-answers"
import { derivePrepChecklist } from "@/lib/discovery/runsheet"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createAdminClient } from "@/lib/supabase/admin"

import {
  classifyDiscoverySourceFactsPreflight,
  loadDiscoveryQuizLead,
  type DiscoverySourceFactsPreflight,
} from "./preflight"

/**
 * The discovery call cockpit as a call runsheet (consult-runsheet T3, mockup:
 * `plans/consult-runsheet/evidence/runsheet-mockup-iteration2.html`).
 *
 * One screen for one call, in Nick's six phases: the head (score tile, „Vor dem Call"),
 * 1 Eröffnen, 2 Problem (Diagnose with her quiz answers and the „Hauptproblem" recipe, Hebel,
 * Gewohnheiten), 3 Produkte (Klären banner, „Eingetragene Produkte", the three buckets with
 * one keep/swap decision per product entry), 4 Routine (her week), 5 Feedback & nächste
 * Schritte, 6 Abschluss (referral, „Finalisieren", Grenze). The call sheet's inputs are
 * client state until Task 5 wires saving. Everything the call itself decides on comes from ONE composition
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
const OUTSIDE_TITLE = "Nicht in der Idealroutine"
const NO_INTAKE = "Diese Teilnehmerin hat die Checkliste noch nicht geöffnet."
const NO_SOURCE = "Für dieses Konto gibt es noch kein nutzbares Haarprofil. Quiz prüfen."
const UNAVAILABLE = "Der Plan lässt sich gerade nicht lesen. Später noch einmal öffnen."
const BRANDS_UNAVAILABLE =
  "Produktnamen (Marke, Linie) sind gerade nicht vollständig lesbar. Finalisieren und PDF gehen erst wieder, wenn der Katalog antwortet — Seite später neu laden."
const APPLICATION_UNAVAILABLE =
  "Die Anwendung („So wendest du es an“) ist gerade nicht lesbar. Finalisieren und PDF gehen erst wieder, wenn sie lesbar ist — Seite später neu laden."
const RESEARCH_UNAVAILABLE =
  "Der Recherche-Stand ist gerade nicht lesbar. Freigegebene Produkte fehlen deshalb in der Routine; Finalisieren und PDF gehen erst wieder, wenn er lesbar ist — Seite später neu laden."
const QUIZ_UNAVAILABLE = "Die Quiz-Antworten sind gerade nicht lesbar. Seite später neu laden."
const PREFLIGHT_TITLE = "Intake unvollständig"
const PREFLIGHT_NO_LEAD = "Zu diesem Konto ist kein Quiz-Lead gebunden."
const PREFLIGHT_INVALID = "Die Quiz-Antworten sind nicht lesbar."
const PREFLIGHT_MISSING = "Diese Antworten fehlen für einen vollständigen Plan:"
const DECLINED_SUFFIX = "— benutzt sie nicht. Keine Entscheidung nötig."
const UNANSWERED_PREFIX = "Nicht angegeben:"
const UNANSWERED_SUFFIX = "— im Call fragen."
const HEAT_TITLE = "Hitze & Styling"
const HEAT_DRYING = "Trocknen:"
const HEAT_NO_TOOLS = "Keine Hitze-Tools"

export type DiscoveryCockpitPageDependencies = {
  flagEnabled: () => boolean
  requireAdmin: typeof requireAdmin
  createAdminClient: () => DiscoveryCockpitAdminClient
  loadEnrollment: typeof loadDiscoveryEnrollment
  loadIntake: typeof loadDiscoveryCallIntake
  loadModel: typeof loadDiscoveryCockpitModel
  /** Her quiz lead, read once and shared by „Quiz-Antworten" and the preflight. */
  loadQuizLead: typeof loadDiscoveryQuizLead
  loadPreflight: (lead: DiscoveryQuizLead | null) => Promise<DiscoverySourceFactsPreflight>
  /** The runsheet's own row (`discovery_call_sheets`); null = none yet (every legacy call). */
  loadCallSheet: typeof loadDiscoveryCallSheet
}

const DEFAULTS: DiscoveryCockpitPageDependencies = {
  flagEnabled: isDiscoveryCallToolkitEnabled,
  requireAdmin,
  createAdminClient,
  loadEnrollment: loadDiscoveryEnrollment,
  loadIntake: loadDiscoveryCallIntake,
  loadModel: loadDiscoveryCockpitModel,
  loadQuizLead: loadDiscoveryQuizLead,
  loadPreflight: async (lead) => classifyDiscoverySourceFactsPreflight(lead),
  loadCallSheet: loadDiscoveryCallSheet,
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

    // The quiz lead only feeds the two internal sections and the preflight: a failed read
    // must not take down the call (or its degraded page), it just leaves them out.
    let lead: DiscoveryQuizLead | null = null
    let leadAvailable = true
    try {
      lead = await deps.loadQuizLead(admin, intake.userId)
    } catch (error) {
      console.error("[discovery] quiz lead lookup failed:", error)
      leadAvailable = false
    }
    const quiz = leadAvailable ? buildDiscoveryQuizAnswers(lead) : null
    const quizSection = quiz ? (
      <DiscoveryQuizAnswersSection quiz={quiz} />
    ) : (
      <Notice text={QUIZ_UNAVAILABLE} />
    )

    const model = await deps.loadModel(admin, { intakeId: intake.id, userId: intake.userId })
    if (model.status !== "ready") {
      return (
        <Shell name={enrollment.name} email={enrollment.email} status={statusLine}>
          {quizSection}
          <Notice text={model.status === "no_usable_source" ? NO_SOURCE : UNAVAILABLE} />
        </Shell>
      )
    }

    const view = buildDiscoveryCockpitView(model)
    // Unknown is not „no lead": without a readable lead there is nothing to warn about.
    const preflight: DiscoverySourceFactsPreflight = leadAvailable
      ? await deps.loadPreflight(lead)
      : { status: "ready" }
    // The runsheet's own row is extra: a failed read leaves its sections empty, it never
    // takes the call down.
    let callSheet: DiscoveryCallSheet | null = null
    try {
      callSheet = await deps.loadCallSheet(enrollmentId, admin)
    } catch (error) {
      console.error("[discovery] call sheet lookup failed:", error)
    }
    const concernFacts = model.concernProfileFacts ?? UNKNOWN_CONCERN_PROFILE_FACTS
    const concernCoverage = discoveryConcernCoverageInput(view)
    const concernViews =
      quiz?.status === "ready"
        ? quiz.concerns.flatMap(
            (code) => buildDiscoveryConcernRecipeView(code, concernFacts, concernCoverage) ?? [],
          )
        : []
    const mainConcern = quiz?.status === "ready" ? quiz.mainConcern : null
    const mainRecipe = concernViews.find((entry) => entry.code === mainConcern) ?? null
    const prepItems = derivePrepChecklist({
      view,
      intakeItems: model.research?.items ?? null,
      callSheet: callSheet ? { baselineScore: callSheet.baselineScore } : null,
      profile: {
        chemicalTreatments: concernFacts.chemical_treatment,
        elasticity: model.hairElasticity ?? null,
        primaryConcern: mainConcern,
      },
    })
    const researchItems = (model.research?.items ?? []).map((item) => ({
      id: item.id,
      barcodeIdentifier: item.barcodeIdentifier,
    }))
    // Phase 4 names her product in research where Phase 3 does (the same join).
    const researchLabels: Partial<Record<PersonalPlanCategory, string>> = {}
    for (const entry of composeRunsheetProducts({
      steps: view.steps,
      unassigned: view.unassigned,
      researchItems,
    }).tauschenOderNeu) {
      if (entry.research) researchLabels[entry.step.category] ??= entry.research.label
    }
    const sections = callSheet?.consultBrief?.sections ?? EMPTY_DISCOVERY_BRIEF_SECTIONS
    const washFrequencyLabel =
      view.intakeProducts.find(
        (product) => product.category === "shampoo" && product.frequencyLabel,
      )?.frequencyLabel ?? null
    // A refresh with a different routine re-syncs the client islands (see the helper).
    const stateKey = discoveryCockpitStateKey(view.sourceHash, intake.callFinalizedAt)

    return (
      <Shell name={enrollment.name} email={enrollment.email} status={statusLine}>
        <PreflightBanner preflight={preflight} />
        {!view.researchStatusAvailable ? (
          <Notice text={RESEARCH_UNAVAILABLE} />
        ) : view.recommendationBrandsAvailable ? null : (
          <Notice text={BRANDS_UNAVAILABLE} />
        )}
        {view.applicationAvailable ? null : <Notice text={APPLICATION_UNAVAILABLE} />}
        <DiscoveryRunsheetBrief
          initialBaseline={callSheet?.baselineScore ?? null}
          initialSections={sections}
          initialCommitments={callSheet?.habitCommitments ?? []}
          recipeHabits={(mainRecipe?.levers ?? []).map((entry, index) => ({
            id: `recipe:${mainRecipe!.code}:${index}`,
            label: entry.lever,
          }))}
          checklist={runsheetChecklistLines(prepItems)}
          askTopics={prepItems.flatMap((item) =>
            item.kind === "ask_bleach_cadence" ||
            item.kind === "ask_detangling" ||
            item.kind === "ask_where_she_shops"
              ? [RUNSHEET_ASK_TOPIC[item.kind]]
              : [],
          )}
          quizSection={quizSection}
          recipeSection={
            quiz?.status === "ready" ? (
              <DiscoveryConcernRecipeSection views={concernViews} mainConcern={quiz.mainConcern} />
            ) : null
          }
          heatSection={<HeatStyling view={view} />}
        />
        <DiscoveryCallCockpit
          stateKey={stateKey}
          enrollmentId={enrollmentId}
          steps={view.steps}
          unassigned={view.unassigned}
          researchItems={researchItems}
          swapReasons={sections.swapReasons}
          zielLuecken={sections.zielLuecken}
          submitted={intake.state === "submitted"}
          initialFinalizedAt={intake.callFinalizedAt}
          categoryOpenCount={discoveryCategoryOpenItems(view).length}
          researchOpenCount={discoveryResearchOpenItems(view).length}
          applicationGaps={view.applicationGaps.map((gap) => gap.name)}
          intakeProducts={
            <DiscoveryIntakeProducts
              key={`products:${stateKey}`}
              enrollmentId={enrollmentId}
              products={view.intakeProducts}
              editable={intake.state === "submitted"}
              finalized={intake.callFinalizedAt !== null}
            />
          }
          outsideRoutine={<OutsideRoutine view={view} submitted={intake.state === "submitted"} />}
          routinePhase={
            <DiscoveryRunsheetRoutine
              view={view}
              washFrequencyLabel={washFrequencyLabel}
              researchLabels={researchLabels}
            />
          }
          followUpPhase={
            <DiscoveryRunsheetFollowUp
              initialFeedback={callSheet?.feedback ?? null}
              initialTouchpoints={callSheet?.touchpoints ?? []}
            />
          }
          boundary={mainRecipe?.boundary ?? null}
        />
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
  email: string | null
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
        <span className="text-sm text-muted-foreground">
          {email ?? DISCOVERY_EMAIL_PENDING_LABEL}
        </span>
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

/** Batch 7: her „Hitze & Styling" answers, compact — only when she was asked. */
function HeatStyling({ view }: { view: DiscoveryCockpitView }) {
  const heat = view.heatStyling
  if (!heat) return null
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {HEAT_TITLE}
      </h2>
      <div className="flex flex-col gap-1 px-4 py-3 text-[13px] leading-6 text-foreground">
        <p>{`${HEAT_DRYING} ${heat.drying}`}</p>
        {heat.tools.length === 0 ? (
          <p className="text-muted-foreground">{HEAT_NO_TOOLS}</p>
        ) : (
          <ul>
            {heat.tools.map((tool) => (
              <li key={tool.label}>
                {[tool.label, tool.frequency, tool.protection].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

const SHELF_ORDER = DISCOVERY_INTAKE_GROUPS.flatMap((group) =>
  group.categories.map((category) => category.key),
)

/**
 * The checklist's own labels, in the checklist's own shelf order, so the cockpit names
 * categories the way the participant saw them.
 */
function categoryLine(categories: readonly PersonalPlanCategory[]): string {
  return [...categories]
    .sort((left, right) => SHELF_ORDER.indexOf(left) - SHELF_ORDER.indexOf(right))
    .map((category) => DISCOVERY_INTAKE_CATEGORY_COPY[category].label)
    .join(" · ")
}

/**
 * „Nicht in der Idealroutine": only the categories nothing above already names (T4 c, see
 * `composeRunsheetOutsideRoutine`) — „benutze ich nicht" on one grey line, unanswered on
 * the next. Products never appear here: the buckets, the Klären banner and the styling line
 * above show each of them once.
 */
function OutsideRoutine({ view, submitted }: { view: DiscoveryCockpitView; submitted: boolean }) {
  const { declined, unanswered } = composeRunsheetOutsideRoutine({
    steps: view.steps,
    unassigned: view.unassigned,
    declinedCategories: view.declinedCategories,
    unansweredCategories: view.unansweredCategories,
    submitted,
  })
  if (declined.length === 0 && unanswered.length === 0) return null

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {OUTSIDE_TITLE}
      </h2>
      <div className="flex flex-col gap-1.5 px-4 py-3 text-[13px] leading-6 text-muted-foreground">
        {declined.length > 0 ? <p>{`${categoryLine(declined)} ${DECLINED_SUFFIX}`}</p> : null}
        {unanswered.length > 0 ? (
          <p>{`${UNANSWERED_PREFIX} ${categoryLine(unanswered)} ${UNANSWERED_SUFFIX}`}</p>
        ) : null}
      </div>
    </section>
  )
}

export default createDiscoveryCockpitPage()
