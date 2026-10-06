"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type ReactNode } from "react"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import { ScanVerdictSections } from "@/components/scan/scan-verdict-sections"
import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
} from "@/lib/discovery/cockpit"
import { cockpitVoice } from "@/lib/discovery/cockpit-copy"
import type { DiscoveryCallSheetComplexity } from "@/lib/discovery/call-sheet"
import type { DiscoveryVerdictStatus } from "@/lib/discovery/load-participant-verdicts"
import type { DiscoveryPropertyRow } from "@/lib/discovery/property-rows"
import {
  runsheetEntryInHerWeek,
  runsheetLockedIn,
  runsheetVerdictFit,
  type WashAnchor,
} from "@/lib/discovery/runsheet"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

import { DiscoveryComparisonTable } from "./comparison-table"
import { beginDiscoveryDecisionWrite } from "./decision-writes"
import { formatDiscoveryTimestamp } from "./format"
import { RunsheetLockedInSection } from "./runsheet-locked-in"
import { discoveryCallSheetWriteOutcome, RUNSHEET_SAVE_COPY } from "./runsheet-save"
import {
  FREQUENCY_ROW_NOT_COMPARABLE,
  RunsheetCard,
  RunsheetCategoryChip,
  RunsheetChip,
  RunsheetFrequencyChip,
  RunsheetFrequencyRow,
  RunsheetPhase,
} from "./runsheet-parts"
import {
  composeRunsheetProducts,
  type RunsheetKlaerenEntry,
  type RunsheetResearchSlot,
  type RunsheetStepEntry,
} from "./runsheet-products"
import { sortDiscoverySwapOptions, type DiscoverySwapSort } from "./swap-sort"
import { DISCOVERY_STYLING_LABEL, discoveryUsageDifferenceLabel } from "./usage-options"

/**
 * The call surface — since the consult runsheet (T3) the runsheet's Phase 3 („Produkte") and
 * Phase 6 („Abschluss"), with Phases 4 and 5 slotted in between so the decisions and the
 * finalize control keep sharing one state (a finalize freezes the radios at once).
 *
 * Phase 3 files every product entry into „Behalten / Weglassen / Tauschen oder neu"
 * (`deriveBuckets` + the display joins in `runsheet-products.ts`), each with its category
 * anchor, verdict and — unchanged — its live decision: the engine's verdict on the left,
 * the single interaction on the right — keep what the participant owns, or swap it for one
 * of the products the engine already put in front of them.
 *
 * Voice: this screen is Nick's, not the participant's, so it speaks in pronoun-free labels
 * („Bisheriges Produkt", Nick's ruling 2026-09-29). The verdict block underneath is the participant's own scan result,
 * rendered by the SAME component their scanner uses (`ScanVerdictSections`), and the step
 * detail is the Idealplan's own wording — both second person at the source. The cockpit
 * shows their neutral variants (`cockpitVoice`, verdict-layer T4): a display override for
 * known shared strings only, so the verdict itself and the participant's copy never change.
 *
 * Above the two columns, each step explains itself in the Idealplan's own words (why the
 * step, what product type, what matters, why it fits her hair, how often and when), and
 * her product and every alternative carry the iOS result card's comparison table (product
 * value next to her target, batch 6), so Nick can see WHERE an alternative is better, not
 * just that it is. The table takes the place of the scanner's slider bars in the verdict.
 *
 * Every write goes to `/api/admin/beratung/<id>/decisions`, which re-composes the routine
 * server-side and refuses anything the cockpit did not display. The optimistic selection
 * here is a convenience; the server is the authority, and a refusal rolls it back.
 */

const PRODUCTS_TITLE = "Produkte"
const BUCKET_KEEP = "Behalten"
const BUCKET_DROP = "Weglassen"
const BUCKET_SWAP = "Tauschen oder neu"
const EMPTY_KEEP = "Nichts zum Behalten vorgeschlagen."
const EMPTY_DROP = "Nichts zum Weglassen vorgeschlagen."
const EMPTY_SWAP = "Nichts zu tauschen, kein neuer Schritt."
const KLAEREN_TITLE = "Klären"
const KLAEREN_RESEARCH = "noch in Recherche"
const KLAEREN_CATEGORY = "Kategorie offen"
const KLAEREN_NOTE = "Vor dem Call abschließen — sonst bleibt der Schritt ohne Urteil."
const RESEARCH_SLOT_TITLE = "Bisheriges Produkt — noch in Recherche"
const RESEARCH_SLOT_BODY = "Das Urteil folgt, sobald die Recherche abgeschlossen ist."
const NEW_ENTRY_TITLE = "Neu dazu"
const OPEN_ENTRY_TITLE = "Offener Schritt"
const PROPOSAL = "Vorschlag"
const SWAP_CHIP = "Tauschen"
const NEW_CHIP = "Neu"
const OPEN_CHIP = "Schritt offen"
const NO_STEP_REASON = "Kein Schritt in der Idealroutine."
const VERDICT_NOT_NEEDED = "Nicht nötig"
const VERDICT_OPEN = "Noch offen"
const VERDICT_NONE = "Ohne Urteil"
const DEPTH_SUMMARY = "Schritt im Idealplan"
/** R28: every „Neu dazu" step says whether the routine needs it (`step.section`). */
const SECTION_LABEL: Record<DiscoveryCockpitStepView["section"], string> = {
  basis: "Essenziell",
  optional: "Optional",
}
/** F1: the product column of the Idealplan recommendation's comparison table. */
const RECOMMENDED_HEADER = "Empfohlenes Produkt"

/** R28: asked at the top of Phase 3 — exactly two options, stored on the call sheet. */
const COMPLEXITY_QUESTION = "Wie aufwendig darf die Routine sein?"
const COMPLEXITY_OPTIONS: ReadonlyArray<[DiscoveryCallSheetComplexity, string]> = [
  ["essenziell", "Super essenziell"],
  ["normal", "Normal"],
]

const CLOSING_TITLE = "Abschluss"
const BOUNDARY = "Grenze"
const REFERRAL_TITLE = "Empfehlungs-Frage"
const REFERRAL_QUESTION =
  "„Kennst du zwei, drei Leute, die auch nicht ganz glücklich mit ihren Haaren sind? Wir machen die Calls gerade kostenlos — magst du ihnen kurz diese Nachricht weiterleiten?“"
/** R20: approved as-is („okay for now") — exact text. */
export const DISCOVERY_REFERRAL_MESSAGE =
  "Hey! Ich hatte gerade eine kostenlose Haar-Beratung bei Chaarlie — 30 Minuten, und danach hatte ich einen kompletten Plan mit Produkten, die wirklich zu meinem Haar passen. Falls du auch nicht ganz zufrieden bist: chaarlie.de/lp/call"
const REFERRAL_MESSAGE = DISCOVERY_REFERRAL_MESSAGE
const REFERRAL_COPY = "Nachricht kopieren"
const REFERRAL_COPIED = "Kopiert."
const REFERRAL_COPY_FAILED = "Kopieren ging nicht — Text markieren und kopieren."

const COL_PRODUCT = "Bisheriges Produkt"
const COL_DECISION = "Entscheidung"
const KEEP_LABEL = "Behalten"
const DROP_LABEL = "Weglassen"
const KEEP_EMPTY_LABEL = "Ohne Produkt weiter"
const KEEP_EMPTY_HINT = "Schritt bleibt offen."
const SWAP_PREFIX = "Tauschen zu "
const NEW_PREFIX = "Neu: "
const GAP_TITLE = "Lücke in der Idealroutine"
const GAP_BODY = "Aktuell ohne Produkt in diesem Schritt."
const UNANSWERED_STEP = "Nicht angegeben — im Call fragen."
const NOT_YET_FILLED_STEP = "Noch nicht ausgefüllt."
const NO_PRODUCT = "Kein Produkt angegeben"
const UNDECIDED_HINT = "Noch nicht entschieden."
const FROZEN_HINT =
  "Diese Beratung ist inzwischen finalisiert. Seite neu laden, dann die Finalisierung aufheben."
const WRITE_ERROR = "Nicht gespeichert. Bitte noch einmal."
const NO_OPTIONS_HINT = "Keine Alternative im Katalog. Nur behalten oder offen lassen."
const SORT_LABEL = "Sortieren:"
const SORT_OPTIONS: ReadonlyArray<[DiscoverySwapSort, string]> = [
  ["fit", "Fit"],
  ["price", "Preis"],
]

const DEPTH_WHY = "Warum dieser Schritt"
const DEPTH_TYPE = "Produkttyp"
const DEPTH_CRITERIA = "Worauf es ankommt"
const DEPTH_FIT = "Warum das passt"
const DEPTH_RHYTHM = "Wie oft · wann"

const FINALIZE_LABEL = "Finalisieren"
const UNFINALIZE_LABEL = "Finalisierung aufheben"
const FINALIZE_HINT =
  "Entscheidungen bleiben bis dahin änderbar. Das PDF entsteht erst aus dem finalisierten Stand."
const FINALIZE_OPEN = "noch nicht finalisiert"
const FINALIZE_BUSY = "Wird gespeichert"
const PDF_LOCKED = "PDF: gesperrt"
const PDF_OPEN = "PDF öffnen"
const NOT_SUBMITTED_HINT = "Die Checkliste ist noch nicht abgeschickt."
const CATEGORY_OPEN_HINT = "Erst Kategorie festlegen"
const RESEARCH_OPEN_HINT = "Erst Recherche abschließen"
const APPLICATION_MISSING_PREFIX = "Anwendung fehlt für"
const APPLICATION_MISSING_ERROR = "Anwendung fehlt für mindestens ein Produkt."

/** „Erst Kategorie festlegen — 2 Produkte mit offener Kategorie." */
export function discoveryCategoryOpenHint(count: number): string {
  return `${CATEGORY_OPEN_HINT} — ${count} ${count === 1 ? "Produkt" : "Produkte"} mit offener Kategorie.`
}

/** „Erst Recherche abschließen — 2 Produkte noch in Recherche." (batch 6) */
export function discoveryResearchOpenHint(count: number): string {
  return `${RESEARCH_OPEN_HINT} — ${count} ${count === 1 ? "Produkt" : "Produkte"} noch in Recherche.`
}

/** „Anwendung fehlt für Marke Produkt · Marke Produkt." (batch 6) */
export function discoveryApplicationMissingHint(names: readonly string[]): string {
  return `${APPLICATION_MISSING_PREFIX} ${names.join(" · ")}.`
}

/** Why a bound product carries no verdict — internal, factual, no medical claim. */
const VERDICT_FAILURE_COPY: Record<Exclude<DiscoveryVerdictStatus, "verdict">, string> = {
  product_unavailable: "Produkt ist nicht mehr im Katalog.",
  quarantined: "Produkt ist im Katalog gesperrt.",
  target_mismatch: "Der Katalog führt das Produkt in einer anderen Kategorie.",
  decision_missing: "Der Plan hat für diese Kategorie keinen Eintrag.",
  unavailable: "Bewertung gerade nicht verfügbar.",
}

type Selection = { decision: "keep" | "swap" | "drop"; swapProductId: string | null } | null

function initialSelection(step: DiscoveryCockpitStepView): Selection {
  if (step.outcome === "kept") return { decision: "keep", swapProductId: null }
  if (step.outcome === "swapped") return { decision: "swap", swapProductId: step.swapProductId }
  if (step.outcome === "dropped") return { decision: "drop", swapProductId: null }
  return null
}

/**
 * One decision per (step, product) (batch 9, Codex P2-2): selection state, radio group and
 * React key are keyed per entry, so two products of one step never share a radio group.
 */
function entryKey(step: Pick<DiscoveryCockpitStepView, "decisionKey" | "intakeItemId">): string {
  return `${step.decisionKey}:${step.intakeItemId ?? "-"}`
}

/**
 * What a keep/swap answer means for the panel, pure so it can be tested: a refusal rolls
 * the optimistic choice back with its message; a success refreshes the page, so the panel
 * reconciles with committed server state even if a research refresh remounted it mid-write.
 */
export function discoveryDecisionWriteOutcome(
  ok: boolean,
  body: { code?: string } | null,
): { rollback: boolean; error: string | null; refresh: boolean } {
  if (ok) return { rollback: false, error: null, refresh: true }
  return {
    rollback: true,
    // Finalised in the meantime (another tab): the stored timestamp is not ours to
    // invent, so the screen says what happened instead of faking it.
    error: body?.code === "finalized" ? FROZEN_HINT : WRITE_ERROR,
    refresh: false,
  }
}

/** Finalize / un-finalize: same rule — a success refreshes, a refusal explains itself. */
export function discoveryFinalizeWriteOutcome(
  ok: boolean,
  body: { code?: string } | null,
): { error: string | null; refresh: boolean } {
  if (ok) return { error: null, refresh: true }
  return {
    error:
      body?.code === "not_submitted"
        ? NOT_SUBMITTED_HINT
        : body?.code === "category_open"
          ? `${CATEGORY_OPEN_HINT}.`
          : body?.code === "research_open"
            ? `${RESEARCH_OPEN_HINT}.`
            : body?.code === "application_missing"
              ? APPLICATION_MISSING_ERROR
              : WRITE_ERROR,
    refresh: false,
  }
}

function seedSelections(steps: readonly DiscoveryCockpitStepView[]): Record<string, Selection> {
  return Object.fromEntries(steps.map((step) => [entryKey(step), initialSelection(step)]))
}

function selectionValue(selection: Selection): string {
  if (!selection) return ""
  if (selection.decision === "swap") return selection.swapProductId ?? ""
  return selection.decision
}

export function DiscoveryCallCockpit({
  enrollmentId,
  steps,
  submitted,
  initialFinalizedAt,
  categoryOpenCount = 0,
  researchOpenCount = 0,
  applicationGaps = [],
  unassigned = [],
  researchItems = null,
  swapReasons = {},
  intakeProducts = null,
  outsideRoutine = null,
  routinePhase = null,
  followUpPhase = null,
  boundary = null,
  washFrequency = null,
  complexity = null,
  complexityLocked = false,
  stateKey,
}: {
  enrollmentId: string
  steps: DiscoveryCockpitStepView[]
  submitted: boolean
  initialFinalizedAt: string | null
  /** Products whose usage is unknown: finalising waits for them (P1-5). */
  categoryOpenCount?: number
  /** Products not yet resolved to a catalog product: finalising waits for them (batch 6). */
  researchOpenCount?: number
  /** Printed products without complete verified guidance, by name (batch 6). */
  applicationGaps?: readonly string[]
  /** The view's `unassigned` projection — read for the buckets, never changed. */
  unassigned?: DiscoveryCockpitUnassignedView[]
  /** Her intake rows (id + barcode), for the GTIN of a product in research. */
  researchItems?: ReadonlyArray<{ id: string; barcodeIdentifier: string | null }> | null
  /** The consult brief's reasoning per step (`consult_brief.sections.swapReasons`). */
  swapReasons?: Readonly<Record<string, string>>
  /** Runsheet slots (consult-runsheet T3): rendered in phase order around the decisions. */
  intakeProducts?: ReactNode
  outsideRoutine?: ReactNode
  routinePhase?: ReactNode
  followUpPhase?: ReactNode
  /** The „Grenze" line of her main problem, closing the call. */
  boundary?: string | null
  /** Her wash range (`runsheetWashAnchor`): the anchor of per-wash frequency chips. */
  washFrequency?: ProductFrequency | WashAnchor | null
  /** R28: the stored answer to „Wie aufwendig darf die Routine sein?" (call sheet). */
  complexity?: DiscoveryCallSheetComplexity | null
  /** The call sheet could not be read: the complexity choice waits for a reload. */
  complexityLocked?: boolean
  /**
   * `discoveryCockpitStateKey` of the props: when a refresh delivers a different routine or
   * finalize state, the selections and the finalize state re-seed from the server. (Before
   * the runsheet this was a React `key` remount; the slotted Phases 4 and 5 hold unsaved
   * input and must not remount with it.)
   */
  stateKey?: string
}) {
  const router = useRouter()
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    seedSelections(steps),
  )
  const [finalizedAt, setFinalizedAt] = useState<string | null>(initialFinalizedAt)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finalizePending, setFinalizePending] = useState(false)
  // R28 (iteration 3): the complexity chip's displayed value, lifted here so „Super
  // essenziell" folds the optional Neu-Schritte. Re-seeds when a refresh brings a
  // different stored answer; the ticket invalidates an in-flight write's rollback then
  // (Codex F2: a stale failure must not overwrite the newer server value). Bumping the
  // ref inside the reseed branch is idempotent — it runs once per changed prop, and an
  // extra bump only skips a rollback that is stale anyway.
  const [complexityValue, setComplexityValue] = useState(complexity)
  const [syncedComplexity, setSyncedComplexity] = useState(complexity)
  const complexityWriteTicket = useRef(0)
  if (complexity !== syncedComplexity) {
    setSyncedComplexity(complexity)
    setComplexityValue(complexity)
    complexityWriteTicket.current += 1
  }
  const [syncedKey, setSyncedKey] = useState(stateKey)
  if (stateKey !== syncedKey) {
    setSyncedKey(stateKey)
    setSelections(seedSelections(steps))
    setFinalizedAt(initialFinalizedAt)
    setError(null)
  }

  const frozen = finalizedAt !== null
  // Un-finalising is always possible; finalising waits until every product has a usage, is
  // resolved to a catalog product, and every printed product has its verified guidance.
  const blockHints = frozen
    ? []
    : [
        ...(categoryOpenCount > 0 ? [discoveryCategoryOpenHint(categoryOpenCount)] : []),
        ...(researchOpenCount > 0 ? [discoveryResearchOpenHint(researchOpenCount)] : []),
        ...(applicationGaps.length > 0 ? [discoveryApplicationMissingHint(applicationGaps)] : []),
      ]
  const finalizeBlocked = blockHints.length > 0
  const products = composeRunsheetProducts({ steps, unassigned, researchItems })
  // „Für den Plan festgehalten": the SAME optimistic selections the radios write, so the
  // section follows each click before the server round-trip (and rolls back with it).
  const lockedIn = runsheetLockedIn(steps, (step) => selections[entryKey(step)] ?? null)
  // „Super essenziell" folds the OPTIONAL Neu-Schritte behind one row (display only —
  // routine variants by complexity stay a later slice). „Normal" and no answer show all.
  const foldedSwapEntries =
    complexityValue === "essenziell"
      ? products.tauschenOderNeu.filter(
          (entry) => entry.kind === "neu" && !entry.research && entry.step.section === "optional",
        )
      : []
  const shownSwapEntries =
    foldedSwapEntries.length > 0
      ? products.tauschenOderNeu.filter((entry) => !foldedSwapEntries.includes(entry))
      : products.tauschenOderNeu

  async function choose(step: DiscoveryCockpitStepView, value: string) {
    const key = entryKey(step)
    const previous = selections[key] ?? null
    const next: Selection =
      value === "keep" || value === "drop"
        ? { decision: value, swapProductId: null }
        : { decision: "swap", swapProductId: value }
    setSelections((current) => ({ ...current, [key]: next }))
    setPending(key)
    setError(null)
    const endWrite = beginDiscoveryDecisionWrite()
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionKey: step.decisionKey,
          intakeItemId: step.intakeItemId,
          decision: next.decision,
          swapProductId: next.swapProductId,
        }),
      })
      const body = response.ok
        ? null
        : ((await response.json().catch(() => null)) as { code?: string } | null)
      const outcome = discoveryDecisionWriteOutcome(response.ok, body)
      if (outcome.rollback) {
        setSelections((current) => ({ ...current, [key]: previous }))
      }
      if (outcome.error) setError(outcome.error)
      if (outcome.refresh) router.refresh()
    } catch {
      setSelections((current) => ({ ...current, [key]: previous }))
      setError(WRITE_ERROR)
    } finally {
      endWrite()
      setPending(null)
    }
  }

  async function toggleFinalize() {
    setFinalizePending(true)
    setError(null)
    const endWrite = beginDiscoveryDecisionWrite()
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalized: !frozen }),
      })
      const body = (await response.json().catch(() => null)) as {
        callFinalizedAt?: string | null
        code?: string
      } | null
      const outcome = discoveryFinalizeWriteOutcome(response.ok, body)
      if (outcome.error) {
        setError(outcome.error)
        return
      }
      setFinalizedAt(body?.callFinalizedAt ?? null)
      if (outcome.refresh) router.refresh()
    } catch {
      setError(WRITE_ERROR)
    } finally {
      endWrite()
      setFinalizePending(false)
    }
  }

  /** One product entry with its live decision control (batch 9: keyed per entry). */
  function renderEntry(entry: RunsheetStepEntry, bucket: BucketId) {
    const step = entry.step
    const key = entryKey(step)
    // Batch 9: what her other products in this step are set to right now.
    const stepEntries = steps.filter((other) => other.decisionKey === step.decisionKey)
    // Her products in her week (kept/undecided) — the same rule Phase 4 sums.
    const ownedInStep = stepEntries.filter(runsheetEntryInHerWeek)
    const siblings = stepEntries
      .filter((other) => entryKey(other) !== key)
      .map((other) => selections[entryKey(other)] ?? null)
    const selection = selections[key] ?? null
    const reason = swapReasons[step.decisionKey]
    // R28: a step the Idealplan adds („Neu dazu") — not her product, not one in research.
    const addStep = entry.kind === "neu" && !entry.research
    return (
      <div key={key} className="border-b last:border-0">
        <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2.5">
          <RunsheetCategoryChip category={step.category} label={step.categoryLabel} />
          <span className="text-[15px] font-bold text-foreground">{entryTitle(entry)}</span>
          <span className="text-xs text-muted-foreground">{step.roleLabel}</span>
          {addStep ? (
            // R28: deterministic from the Idealplan's need tier — no engine call.
            <RunsheetChip tone="neutral">{SECTION_LABEL[step.section]}</RunsheetChip>
          ) : step.section === "optional" ? (
            <span className="text-xs text-muted-foreground">· optional</span>
          ) : null}
          {entry.kind === "owned" ? <VerdictChip step={step} /> : null}
          <DecisionChip entry={entry} bucket={bucket} selection={selection} />
          {entry.kind === "owned" ? (
            <RunsheetFrequencyRow
              ownedFrequencyLabel={step.ownedFrequencyLabel}
              idealFrequencyLabel={step.frequencyLabel}
              verdict={
                ownedInStep[0] && entryKey(ownedInStep[0]) === key ? (
                  // One chip per step (fix round 1), on her first product in it: the sum of
                  // all her products in the step against the step's band.
                  <RunsheetFrequencyChip
                    cadenceLabel={step.frequencyLabel}
                    frequencies={ownedInStep.map((owned) => owned.ownedFrequency)}
                    washFrequency={washFrequency}
                    allowedRange={step.idealAllowedRange}
                    noVerdict={
                      <RunsheetChip tone="neutral">{FREQUENCY_ROW_NOT_COMPARABLE}</RunsheetChip>
                    }
                  />
                ) : null
              }
            />
          ) : null}
          {addStep && step.roleDescription ? (
            // R28: the step's one-sentence benefit, in the cockpit's voice.
            <span className="w-full text-[12px] leading-5 text-muted-foreground">
              {cockpitVoice(step.roleDescription)}
            </span>
          ) : null}
        </div>
        {reason ? (
          <p className="border-b px-4 py-2 text-[13px] leading-5 text-foreground">
            {cockpitVoice(reason)}
          </p>
        ) : null}
        <StepDepth step={step} />
        {(() => {
          const decision = (
            <div className="p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {COL_DECISION}
              </p>
              <StepDecision
                step={step}
                name={key}
                value={selectionValue(selection)}
                // „Weglassen" never empties the step (R3): not while every sibling
                // is set to „Weglassen" too. The server re-checks under its lock.
                dropAllowed={siblings.some((other) => other?.decision !== "drop")}
                // A target a sibling already swaps to is not offered twice.
                takenSwapIds={siblings.flatMap((other) =>
                  other?.decision === "swap" && other.swapProductId ? [other.swapProductId] : [],
                )}
                disabled={frozen || pending === key}
                onChoose={(value) => void choose(step, value)}
              />
            </div>
          )
          // A step without her product and without research: the „Bisheriges Produkt:
          // Kein Produkt angegeben" panel goes (iteration 3) — decision only. The two
          // load-bearing status lines survive compactly (slice 1: an unanswered checklist
          // is a question, only an explicit „benutze ich nicht" earns the gap wording).
          if (entry.kind !== "owned" && !entry.research) {
            return (
              <>
                {step.unanswered ? (
                  <p className="border-b px-4 py-2 text-[13px] font-bold text-[var(--status-pending-text)]">
                    {submitted ? UNANSWERED_STEP : NOT_YET_FILLED_STEP}
                  </p>
                ) : (
                  <p className="border-b px-4 py-2 text-[13px] leading-5 text-muted-foreground">
                    <span className="font-bold text-foreground">{GAP_TITLE}</span>
                    {` — ${GAP_BODY}`}
                  </p>
                )}
                {decision}
              </>
            )
          }
          return (
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b p-4 md:border-b-0 md:border-r">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {COL_PRODUCT}
                </p>
                {entry.research ? (
                  <ResearchSlot research={entry.research} />
                ) : (
                  <StepVerdict step={step} submitted={submitted} />
                )}
              </div>
              {decision}
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <>
      <RunsheetPhase number={3} title={PRODUCTS_TITLE} id="runsheet-phase-3">
        <ComplexityChoice
          enrollmentId={enrollmentId}
          value={complexityValue}
          onValue={setComplexityValue}
          writeTicket={complexityWriteTicket}
          locked={complexityLocked}
        />
        {products.klaeren.length > 0 ? <KlaerenBanner entries={products.klaeren} /> : null}
        {intakeProducts}
        <Bucket
          title={BUCKET_KEEP}
          count={productCount(products.behalten.length)}
          empty={EMPTY_KEEP}
        >
          {products.behalten.map((entry) => renderEntry(entry, "behalten"))}
        </Bucket>
        <Bucket
          title={BUCKET_DROP}
          count={productCount(products.weglassen.length)}
          empty={EMPTY_DROP}
        >
          {products.weglassen.map((entry) =>
            entry.kind === "unassigned" ? (
              <UnassignedDropEntry key={entry.unassigned.itemId} entry={entry.unassigned} />
            ) : (
              renderEntry(entry, "weglassen")
            ),
          )}
        </Bucket>
        <Bucket title={BUCKET_SWAP} count={swapCount(products.tauschenOderNeu)} empty={EMPTY_SWAP}>
          {/* ONE array child: `Bucket` decides emptiness by children.length (Codex F3). */}
          {[
            ...shownSwapEntries.map((entry) => renderEntry(entry, "tauschenOderNeu")),
            ...(foldedSwapEntries.length > 0
              ? [
                  <details key="runsheet-complexity-folded" id="runsheet-complexity-folded">
                    <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-bold text-muted-foreground">
                      {foldedSwapLabel(foldedSwapEntries.length)}
                    </summary>
                    {foldedSwapEntries.map((entry) => renderEntry(entry, "tauschenOderNeu"))}
                  </details>,
                ]
              : []),
          ]}
        </Bucket>
        <RunsheetLockedInSection lockedIn={lockedIn} />
        {products.styling.length > 0 ? (
          <p className="text-[13px] text-muted-foreground">{`${DISCOVERY_STYLING_LABEL}: ${products.styling
            .map((entry) => entry.label)
            .join(" · ")}`}</p>
        ) : null}
        {outsideRoutine}
      </RunsheetPhase>

      {routinePhase}
      {followUpPhase}

      <RunsheetPhase number={6} title={CLOSING_TITLE} id="runsheet-phase-6">
        <ReferralCard />
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
          <button
            type="button"
            onClick={() => void toggleFinalize()}
            disabled={finalizePending || (!frozen && !submitted) || finalizeBlocked}
            className="rounded-lg bg-[var(--brand-coral)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {finalizePending ? FINALIZE_BUSY : frozen ? UNFINALIZE_LABEL : FINALIZE_LABEL}
          </button>
          {finalizeBlocked ? (
            <div className="flex flex-col gap-0.5">
              {blockHints.map((hint) => (
                <p
                  key={hint}
                  className="text-[13px] font-bold leading-5 text-[var(--status-danger-text)]"
                >
                  {hint}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[13px] leading-5 text-muted-foreground">{FINALIZE_HINT}</p>
          )}
          {frozen ? (
            // The document exists only for a finalised call, so the link exists only then too —
            // in a new tab, so the cockpit stays where it is while Nick prints.
            <a
              href={`/admin/beratung/${enrollmentId}/pdf`}
              target="_blank"
              rel="noopener"
              className="text-xs font-bold text-[var(--brand-plum)] underline"
            >
              {PDF_OPEN}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">{PDF_LOCKED}</span>
          )}
          <span className="ml-auto rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {frozen ? `finalisiert am ${formatDiscoveryTimestamp(finalizedAt)}` : FINALIZE_OPEN}
          </span>
        </div>

        {error ? (
          <p role="status" className="text-[13px] text-[var(--status-danger-text)]">
            {error}
          </p>
        ) : null}
        {!submitted ? (
          <p className="text-[13px] text-muted-foreground">{NOT_SUBMITTED_HINT}</p>
        ) : null}
        {boundary ? (
          <p className="rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--status-danger-text)]">
            <span className="font-bold">{`${BOUNDARY}: `}</span>
            {boundary}
          </p>
        ) : null}
      </RunsheetPhase>
    </>
  )
}

// --- Phase 3 pieces ------------------------------------------------------------------

/**
 * R28: „Wie aufwendig darf die Routine sein?" — two options, saved per click to the call
 * sheet (`PATCH …/call-sheet {complexity}`, only that column). Optimistic like the decisions:
 * a refusal rolls the choice back and says so. The displayed value lives in the PARENT
 * (iteration 3): „Super essenziell" folds the optional Neu-Schritte — display only, the
 * routine variants stay a later slice. Selected = plum, never coral (CTA only).
 */
function ComplexityChoice({
  enrollmentId,
  value,
  onValue,
  writeTicket,
  locked,
}: {
  enrollmentId: string
  value: DiscoveryCallSheetComplexity | null
  /** Every displayed change — optimistic set and rollback — goes through the parent. */
  onValue: (value: DiscoveryCallSheetComplexity | null) => void
  /** Bumped by the parent's reseed: a rollback fires only for the still-current write. */
  writeTicket: { current: number }
  locked: boolean
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(next: DiscoveryCallSheetComplexity) {
    if (next === value || pending) return
    const previous = value
    const ticket = ++writeTicket.current
    const rollback = () => {
      // A reseed while the request ran carries the newer server value — keep it.
      if (writeTicket.current === ticket) onValue(previous)
    }
    onValue(next)
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/call-sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complexity: next }),
      })
      const body = (await response.json().catch(() => null)) as {
        code?: string
        callSheet?: unknown
      } | null
      const outcome = discoveryCallSheetWriteOutcome(response.ok, body)
      if (outcome.error) {
        rollback()
        setError(outcome.error)
      }
    } catch {
      rollback()
      setError(RUNSHEET_SAVE_COPY.failed)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      id="runsheet-complexity"
      role="group"
      aria-labelledby="runsheet-complexity-question"
      className="flex flex-wrap items-center gap-2"
    >
      <span id="runsheet-complexity-question" className="text-[13px] font-bold text-foreground">
        {COMPLEXITY_QUESTION}
      </span>
      {COMPLEXITY_OPTIONS.map(([id, label]) => (
        <button
          key={id}
          id={`runsheet-complexity-${id}`}
          type="button"
          aria-pressed={value === id}
          disabled={locked || pending}
          onClick={() => void choose(id)}
          className={`rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-60 ${
            value === id
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          {label}
        </button>
      ))}
      {locked ? (
        <span role="status" className="text-[12px] font-bold text-[var(--status-danger-text)]">
          {RUNSHEET_SAVE_COPY.locked}
        </span>
      ) : error ? (
        <span role="status" className="text-[12px] font-bold text-[var(--status-danger-text)]">
          {error}
        </span>
      ) : null}
    </div>
  )
}

type BucketId = "behalten" | "weglassen" | "tauschenOderNeu"

/** The fold row under „Super essenziell": how many optional Neu-Schritte are tucked away. */
function foldedSwapLabel(count: number): string {
  return count === 1
    ? "1 optionaler Neu-Schritt eingeklappt (Super essenziell) — aufklappen"
    : `${count} optionale Neu-Schritte eingeklappt (Super essenziell) — aufklappen`
}

function productCount(count: number): string {
  return `${count} ${count === 1 ? "Produkt" : "Produkte"}`
}

/** „2 tauschen · 3 neu" — what the bucket holds, by kind. */
function swapCount(entries: readonly RunsheetStepEntry[]): string {
  const owned = entries.filter((entry) => entry.kind === "owned").length
  const neu = entries.filter((entry) => entry.kind === "neu").length
  const open = entries.filter((entry) => entry.kind === "offen").length
  const parts = [
    ...(owned > 0 ? [`${owned} tauschen`] : []),
    ...(neu > 0 ? [`${neu} neu`] : []),
    ...(open > 0 ? [`${open} offen`] : []),
  ]
  return parts.length > 0 ? parts.join(" · ") : productCount(0)
}

function entryTitle(entry: RunsheetStepEntry): string {
  if (entry.research) return RESEARCH_SLOT_TITLE
  if (entry.kind === "owned") return entry.step.ownedLabel ?? NO_PRODUCT
  return entry.kind === "neu" ? NEW_ENTRY_TITLE : OPEN_ENTRY_TITLE
}

function Bucket({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: string
  empty: string
  children: ReactNode[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="rounded-xl border bg-card">
        {children.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function KlaerenBanner({ entries }: { entries: readonly RunsheetKlaerenEntry[] }) {
  return (
    <div className="rounded-xl border border-[var(--status-pending-text)] bg-[var(--status-pending-bg)] p-4">
      <p className="text-sm font-bold text-[var(--status-pending-text)]">{KLAEREN_TITLE}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {entries.map((entry) => (
          <li
            key={entry.intakeItemId}
            className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-foreground"
          >
            <RunsheetCategoryChip category={entry.category} />
            <span>{entry.gtin ? `${entry.label} (${entry.gtin})` : entry.label}</span>
            <span className="text-[12px] text-muted-foreground">
              {entry.reason === "category_unknown" ? KLAEREN_CATEGORY : KLAEREN_RESEARCH}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[12px] text-foreground">{KLAEREN_NOTE}</p>
    </div>
  )
}

/** The join (binding ruling): her product in research fills the empty step's slot. */
function ResearchSlot({ research }: { research: RunsheetResearchSlot }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold text-foreground">{research.label}</p>
      {research.gtin ? (
        <p className="text-[12px] text-muted-foreground">{`GTIN ${research.gtin}`}</p>
      ) : null}
      <p className="rounded-[14px] bg-[var(--status-pending-bg)] px-3 py-2 text-[13px] font-bold text-[var(--status-pending-text)]">
        {RESEARCH_SLOT_BODY}
      </p>
    </div>
  )
}

function UnassignedDropEntry({ entry }: { entry: DiscoveryCockpitUnassignedView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 last:border-0">
      <RunsheetCategoryChip category={entry.category} />
      <span className="text-[15px] font-bold text-foreground">{entry.label}</span>
      <RunsheetChip tone="neutral">{`${PROPOSAL}: ${DROP_LABEL}`}</RunsheetChip>
      <span className="w-full text-[12px] text-muted-foreground">{NO_STEP_REASON}</span>
    </div>
  )
}

function VerdictChip({ step }: { step: DiscoveryCockpitStepView }) {
  const fit = runsheetVerdictFit(step.verdict)
  const tone = fit === "fits" ? "ok" : fit === "does_not_fit" ? "danger" : "neutral"
  const verdict = step.verdict
  const label =
    verdict?.status === "verdict"
      ? verdict.payload.kind === "in_catalog"
        ? verdict.payload.verdictLabel
        : verdict.payload.mode === "not_needed"
          ? VERDICT_NOT_NEEDED
          : VERDICT_OPEN
      : VERDICT_NONE
  return <RunsheetChip tone={tone}>{cockpitVoice(label)}</RunsheetChip>
}

function DecisionChip({
  entry,
  bucket,
  selection,
}: {
  entry: RunsheetStepEntry
  bucket: BucketId
  selection: Selection
}) {
  const empty = entry.step.intakeItemId === null
  if (selection) {
    const label =
      selection.decision === "keep"
        ? empty
          ? KEEP_EMPTY_LABEL
          : KEEP_LABEL
        : selection.decision === "swap"
          ? empty
            ? NEW_CHIP
            : SWAP_CHIP
          : DROP_LABEL
    return <RunsheetChip tone="plum">{label}</RunsheetChip>
  }
  // Her product for this step is still in research: nothing to propose yet.
  if (entry.research) return <RunsheetChip tone="pending">{KLAEREN_RESEARCH}</RunsheetChip>
  const proposal =
    entry.kind === "offen"
      ? OPEN_CHIP
      : entry.kind === "neu"
        ? NEW_CHIP
        : bucket === "behalten"
          ? KEEP_LABEL
          : bucket === "weglassen"
            ? DROP_LABEL
            : SWAP_CHIP
  return <RunsheetChip tone="neutral">{`${PROPOSAL}: ${proposal}`}</RunsheetChip>
}

/** Referral (R20, copy approved as-is): the message and a copy button with a fallback. */
function ReferralCard() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    setCopyState((await copyText(REFERRAL_MESSAGE)) ? "copied" : "failed")
  }

  return (
    <RunsheetCard title={REFERRAL_TITLE}>
      <p className="text-[13px] leading-5 text-foreground">{REFERRAL_QUESTION}</p>
      <p
        id="runsheet-referral-message"
        className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm leading-6 text-foreground"
      >
        {REFERRAL_MESSAGE}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="runsheet-referral-copy"
          type="button"
          onClick={() => void copy()}
          className="rounded-lg border border-[var(--brand-plum)] px-3 py-1.5 text-xs font-bold text-[var(--brand-plum)]"
        >
          {REFERRAL_COPY}
        </button>
        {copyState !== "idle" ? (
          <span role="status" className="text-[12px] text-muted-foreground">
            {copyState === "copied" ? REFERRAL_COPIED : REFERRAL_COPY_FAILED}
          </span>
        ) : null}
      </div>
    </RunsheetCard>
  )
}

/** Clipboard API first; the hidden-textarea fallback for browsers or contexts without it. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand("copy")
    area.remove()
    return copied
  } catch {
    return false
  }
}

function StepVerdict({ step, submitted }: { step: DiscoveryCockpitStepView; submitted: boolean }) {
  if (step.verdict?.status === "verdict") {
    // The scan header's label is the scan feature's own; the call names the category the
    // way the participant's checklist did („Kopfhautpflege", not „Kopfhautprodukt").
    const product = {
      ...step.verdict.product,
      categoryLabel: DISCOVERY_INTAKE_CATEGORY_COPY[step.verdict.product.category].label,
    }
    const usageLine = step.usageDifference
      ? discoveryUsageDifferenceLabel(
          step.usageDifference.usageCategory,
          step.usageDifference.productCategory,
        )
      : null
    return (
      <div className="flex flex-col gap-4">
        {/* F2: graded as what it IS; the call sees how she uses it. */}
        {usageLine ? (
          <p className="rounded-[14px] bg-[var(--brand-plum-ice)] px-3 py-2 text-[13px] font-bold text-[var(--brand-plum)]">
            {usageLine}
          </p>
        ) : null}
        {/* Named like the PDF names it: brand + line + name (the fingerprinted label). The
            comparison table replaces the scanner's bars; without rows the bars stay. */}
        <ScanVerdictSections
          result={{ ...step.verdict.payload, product }}
          productTitle={step.ownedLabel ?? undefined}
          voice={cockpitVoice}
          comparison={
            step.verdict.propertyRows.length > 0 ? (
              <DiscoveryComparisonTable rows={step.verdict.propertyRows} />
            ) : undefined
          }
        />
      </div>
    )
  }
  if (step.verdict) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-foreground">{step.ownedLabel}</p>
        <p className="rounded-[14px] bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          {VERDICT_FAILURE_COPY[step.verdict.status]}
        </p>
      </div>
    )
  }
  // An untouched category says nothing about use — only an explicit „benutze ich nicht"
  // earns „Lücke … benutzt nichts". After submission it is a question for the call; before
  // submission the checklist is simply not done yet.
  const unansweredCopy = step.unanswered
    ? submitted
      ? UNANSWERED_STEP
      : NOT_YET_FILLED_STEP
    : null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold text-muted-foreground">{NO_PRODUCT}</p>
      <div className="rounded-[14px] bg-muted px-3 py-2">
        {unansweredCopy ? (
          <p className="text-[13px] font-bold text-foreground">{unansweredCopy}</p>
        ) : (
          <>
            <p className="text-[13px] font-bold text-foreground">{GAP_TITLE}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{GAP_BODY}</p>
          </>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">{step.frequencyLabel}</p>
    </div>
  )
}

/** Exported for the sort-toggle test (verdict-layer T2); rendered only by the cockpit. */
export function StepDecision({
  step,
  name,
  value,
  dropAllowed,
  takenSwapIds,
  disabled,
  onChoose,
}: {
  step: DiscoveryCockpitStepView
  name: string
  value: string
  dropAllowed: boolean
  takenSwapIds: readonly string[]
  disabled: boolean
  onChoose: (value: string) => void
}) {
  const empty = step.intakeItemId === null
  // R19: „Fit" (the engine's order) by default, „Preis" on demand — display only.
  const [sort, setSort] = useState<DiscoverySwapSort>("fit")
  const available = step.swapOptions.filter(
    (option) => option.productId === value || !takenSwapIds.includes(option.productId),
  )
  const swapOptions = sortDiscoverySwapOptions(available, sort)
  const sortable = available.length >= 2 && available.some((option) => option.priceLabel)
  // R3: „Weglassen" only where she has ≥2 products in the step.
  const offersDrop = !empty && step.stepEntryCount >= 2
  return (
    <div className="flex flex-col gap-2">
      <Choice
        name={name}
        value="keep"
        checked={value === "keep"}
        disabled={disabled}
        title={empty ? KEEP_EMPTY_LABEL : KEEP_LABEL}
        subtitle={empty ? KEEP_EMPTY_HINT : step.ownedLabel}
        onChoose={onChoose}
      />
      {sortable ? (
        <div className="flex items-center gap-1 text-[12px]">
          <span className="text-muted-foreground">{SORT_LABEL}</span>
          {SORT_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              id={`swap-sort-${name}-${id}`}
              type="button"
              aria-pressed={sort === id}
              onClick={() => setSort(id)}
              className={`rounded-md px-2 py-0.5 font-bold ${
                sort === id
                  ? "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {swapOptions.map((option) => (
        <Choice
          key={option.productId}
          name={name}
          value={option.productId}
          checked={value === option.productId}
          disabled={disabled}
          // The option as the PDF would print it once chosen — brand + line + name.
          title={`${empty ? NEW_PREFIX : SWAP_PREFIX}${option.label}`}
          pill={cockpitVoice(option.verdictLabel)}
          // R19: the price where the catalog has one — no placeholder line otherwise.
          subtitle={option.priceLabel}
          imageUrl={option.imageUrl}
          rows={option.propertyRows}
          // Her product's rows beside the option — „Bisheriges Produkt | Alternative | Ziel",
          // or (F1) „… | Empfohlenes Produkt | Ziel"; without her rows the option stands
          // alone against the target in two columns.
          ownedRows={step.verdict?.status === "verdict" ? step.verdict.propertyRows : null}
          productHeader={option.origin === "ideal_recommendation" ? RECOMMENDED_HEADER : undefined}
          onChoose={onChoose}
        />
      ))}
      {offersDrop ? (
        <Choice
          name={name}
          value="drop"
          checked={value === "drop"}
          disabled={disabled || (value !== "drop" && !dropAllowed)}
          title={DROP_LABEL}
          onChoose={onChoose}
        />
      ) : null}
      {step.swapOptions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{NO_OPTIONS_HINT}</p>
      ) : null}
      {value === "" ? <p className="text-[12px] text-muted-foreground">{UNDECIDED_HINT}</p> : null}
    </div>
  )
}

function Choice({
  name,
  value,
  checked,
  disabled,
  title,
  subtitle,
  pill,
  imageUrl,
  rows,
  ownedRows,
  productHeader,
  onChoose,
}: {
  name: string
  value: string
  checked: boolean
  disabled: boolean
  title: string
  subtitle?: string | null
  pill?: string
  /** The option's packshot; rendered only when present — no placeholder hole. */
  imageUrl?: string | null
  rows?: DiscoveryPropertyRow[] | null
  ownedRows?: DiscoveryPropertyRow[] | null
  productHeader?: string
  onChoose: (value: string) => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
        checked ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]" : "border-border bg-card"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={`decision-${name}`}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChoose(value)}
        className="mt-1 accent-[var(--brand-plum)]"
      />
      {imageUrl ? <ScanProductThumb imageUrl={imageUrl} label={title} size={40} /> : null}
      <span className="min-w-0">
        <span className="text-sm font-semibold text-foreground">
          {title}
          {pill ? (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {pill}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        {rows && rows.length > 0 ? (
          <span className="mt-2 block">
            <DiscoveryComparisonTable
              rows={rows}
              compact
              ownedRows={ownedRows}
              productHeader={productHeader}
            />
          </span>
        ) : null}
      </span>
    </label>
  )
}

/** The step in the Idealplan's own words — compact, to glance at mid-call. */
function StepDepth({ step }: { step: DiscoveryCockpitStepView }) {
  const depth = step.depth
  if (!depth) return null
  const rhythm = [step.frequencyLabel, depth.timingLabel].filter(Boolean).join(" · ")
  const candidates: Array<[string, string | null]> = [
    [DEPTH_WHY, depth.purpose],
    [DEPTH_TYPE, depth.targetType],
    [DEPTH_CRITERIA, depth.productCriteria],
    [DEPTH_FIT, depth.fit],
    [DEPTH_RHYTHM, rhythm],
  ]
  // The Idealplan's sentences in the cockpit's voice (T4); unknown ones stay as written.
  const entries = candidates.flatMap(
    ([term, value]): Array<[string, string]> => (value ? [[term, cockpitVoice(value)]] : []),
  )
  if (entries.length === 0) return null
  return (
    <details className="border-b px-4 py-2">
      <summary className="cursor-pointer text-[12px] font-bold text-muted-foreground">
        {DEPTH_SUMMARY}
      </summary>
      <dl className="grid gap-x-6 gap-y-1.5 py-2 text-[12px] leading-5 md:grid-cols-2">
        {entries.map(([term, value]) => (
          <div key={term}>
            <dt className="font-bold text-muted-foreground">{term}</dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
