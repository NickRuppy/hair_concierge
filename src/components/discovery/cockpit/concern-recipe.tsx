"use client"

import { useState } from "react"

import type {
  DiscoveryConcernCoverage,
  DiscoveryConcernRecipeView,
} from "@/lib/discovery/concern-recipe-view"
import type { ConcernRecipeEvidence } from "@/lib/discovery/concern-recipes"
import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"

/**
 * „Hauptproblem" (batch 7c, F9): the research recipe for her main problem, read in the
 * call — talking point, what to lead with, what applies to her profile, what not to lead
 * with, and per category whether she already has it and whether the Idealroutine does.
 *
 * With no stated (or single) main problem, a picker over her selected concerns lets Nick
 * choose in the call. Client state only — nothing is saved.
 */

const TITLE = "Hauptproblem"
const PICK_PROMPT = "Kein Hauptproblem angegeben — im Call fragen, dann wählen:"
const NONE = "Im Quiz kein Haarproblem angegeben."
const TALKING_POINT = "So sagst du es"
const PRIMARY = "Damit anfangen"
const LEVERS = "Ohne Produkt"
const CONDITIONAL = "Für ihr Profil"
const AVOID = "Nicht damit anfangen"
const BOUNDARY = "Grenze"
const SIGNAL_PREFIX = "nur wenn der Call es bestätigt:"
const APPLIES = "passt"
const CHECK = "prüfen"
const OWNED = "hat sie"
const NOT_OWNED = "hat sie nicht"
const IN_ROUTINE = "in der Idealroutine"
const NOT_IN_ROUTINE = "nicht in der Idealroutine"
const HAIR_LOSS_ALSO =
  "Auch angegeben: Haarausfall oder dünner werdendes Haar — nur Grenze, kein Produktrezept: ärztliche Abklärung empfehlen."

const EVIDENCE_LABEL: Record<ConcernRecipeEvidence, string> = {
  strong: "stark belegt",
  moderate: "mäßig belegt",
  weak: "schwach belegt",
  unknown: "unklar",
}

type Tone = "ok" | "pending" | "neutral"

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
}

export function DiscoveryConcernRecipeSection({
  views,
  mainConcern,
}: {
  /** One recipe per concern she selected, in the quiz's order. */
  views: DiscoveryConcernRecipeView[]
  mainConcern: DiagnosticConcern | null
}) {
  const [picked, setPicked] = useState<DiagnosticConcern | null>(null)
  const selected = mainConcern ?? picked
  const view = views.find((entry) => entry.code === selected) ?? null
  const hairLossAlso =
    selected !== "hair_loss_or_thinning" &&
    views.some((entry) => entry.code === "hair_loss_or_thinning")

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {view ? `${TITLE}: ${view.label}` : TITLE}
      </h2>
      <div className="flex flex-col gap-3 px-4 py-3">
        {views.length === 0 ? <p className="text-[13px] text-muted-foreground">{NONE}</p> : null}
        {mainConcern === null && views.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted-foreground">{PICK_PROMPT}</span>
            {views.map((entry) => (
              <button
                key={entry.code}
                type="button"
                aria-pressed={entry.code === picked}
                onClick={() => setPicked(entry.code)}
                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                  entry.code === picked
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
                    : "border-[var(--brand-plum)] text-[var(--brand-plum)]"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
        {hairLossAlso ? (
          <p className="text-[12px] font-bold text-[var(--status-danger-text)]">{HAIR_LOSS_ALSO}</p>
        ) : null}
        {view ? <Recipe view={view} /> : null}
      </div>
    </section>
  )
}

function Recipe({ view }: { view: DiscoveryConcernRecipeView }) {
  return (
    <>
      <div className="rounded-lg bg-[var(--brand-plum-ice)] px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
          {TALKING_POINT}
        </p>
        <p className="mt-0.5 text-sm leading-6 text-foreground">{view.talkingPoint}</p>
      </div>

      {view.boundaryOnly && view.boundary ? (
        <Block title={BOUNDARY}>
          <p className="rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--status-danger-text)]">
            {view.boundary}
          </p>
        </Block>
      ) : null}

      {view.primaryCategories.length > 0 ? (
        <Block title={PRIMARY}>
          <ul className="divide-y">
            {view.primaryCategories.map((entry) => (
              <li
                key={entry.category}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
              >
                <CategoryChip label={entry.label} />
                <Evidence evidence={entry.evidence} />
                <Coverage coverage={entry.coverage} />
                <p className="w-full text-[13px] leading-5 text-foreground">{entry.why}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {view.levers.length > 0 ? (
        <Block title={LEVERS}>
          <ul className="flex flex-col gap-1">
            {view.levers.map((entry) => (
              <li key={entry.lever} className="text-[13px] leading-5 text-foreground">
                {entry.lever} <Evidence evidence={entry.evidence} />
                {entry.signalCategoryLabel ? (
                  <span className="ml-2 text-[12px] text-muted-foreground">
                    {`${SIGNAL_PREFIX} ${entry.signalCategoryLabel}`}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {view.conditional.length > 0 ? (
        <Block title={CONDITIONAL}>
          <ul className="divide-y">
            {view.conditional.map((entry) => (
              <li
                key={entry.category}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
              >
                <CategoryChip label={entry.label} />
                <Pill tone={entry.status === "applies" ? "ok" : "pending"}>
                  {entry.status === "applies"
                    ? APPLIES
                    : `${CHECK}: ${entry.uncheckedFacts.join(", ")}`}
                </Pill>
                <Coverage coverage={entry.coverage} />
                {entry.reasons.map((reason) => (
                  <p key={reason.why} className="w-full text-[13px] leading-5 text-foreground">
                    {reason.why} <Evidence evidence={reason.evidence} />
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {view.avoid.length > 0 ? (
        <Block title={AVOID}>
          <ul className="list-disc pl-5 text-[13px] leading-5 text-foreground">
            {view.avoid.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {!view.boundaryOnly && view.boundary ? (
        <p className="text-[12px] leading-5 text-muted-foreground">
          <span className="font-bold">{`${BOUNDARY}: `}</span>
          {view.boundary}
        </p>
      ) : null}
    </>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function CategoryChip({ label }: { label: string }) {
  return (
    <span className="rounded bg-[var(--brand-plum-ice)] px-2 py-0.5 text-xs font-bold text-[var(--brand-plum)]">
      {label}
    </span>
  )
}

function Evidence({ evidence }: { evidence: ConcernRecipeEvidence }) {
  return <span className="text-[11px] text-muted-foreground">({EVIDENCE_LABEL[evidence]})</span>
}

function Coverage({ coverage }: { coverage: DiscoveryConcernCoverage }) {
  return (
    <>
      <Pill tone={coverage.owned ? "ok" : "neutral"}>{coverage.owned ? OWNED : NOT_OWNED}</Pill>
      <Pill tone={coverage.inRoutine ? "ok" : "neutral"}>
        {coverage.inRoutine ? IN_ROUTINE : NOT_IN_ROUTINE}
      </Pill>
    </>
  )
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  )
}
