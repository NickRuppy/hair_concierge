"use client"

import { useRef, useState, type ReactNode } from "react"

import type {
  DiscoveryCallSheetBriefSections,
  DiscoveryCallSheetHabitCommitment,
} from "@/lib/discovery/call-sheet"

import {
  RunsheetCard,
  RunsheetChip,
  RunsheetEyebrow,
  RunsheetPhase,
  formatRunsheetScore,
  type RunsheetChecklistLine,
} from "./runsheet-parts"

/**
 * The runsheet's top half (consult-runsheet T3): the score tile and „Vor dem Call" checklist,
 * Phase 1 („Eröffnen") and Phase 2 („Problem": Diagnose, Hebel with the score staircase,
 * Gewohnheiten). One client island because the „Mit Plan" target in the head is the baseline
 * plus the Hebel points below.
 *
 * Everything here is editable client state only — saving is Task 5. The state shapes match
 * `discovery_call_sheets` (`baseline_score`, `consult_brief.sections`, `habit_commitments`).
 */

const SCORE_BASELINE = "Baseline"
const SCORE_TARGET = "Mit Plan"
const SCORE_SCALE = "/10"
const PREP_TITLE = "Vor dem Call"

const OPENING_TITLE = "Eröffnen"
const OPENING_SUMMARY = "Gesprächseinstieg"
const OPENING_SCRIPT = [
  "Wer ich bin: entwickle das Produkt, habe viele Routinen gebaut.",
  "Ziel heute: ein Plan für gesünderes, schöneres Haar — von ihrem heutigen Score Richtung 10. Haar ist komplex, Unsicherheit ist normal.",
  "Ergebnis: ein PDF mit kompletter Routine — Produkte, Reihenfolge, Häufigkeit. „Passt das so für dich?“",
  "Score live abfragen und oben eintragen, falls noch offen.",
]

const PROBLEM_TITLE = "Problem"
const DIAGNOSE_TITLE = "Diagnose"
const DIAGNOSE_EMPTY = "Noch nicht erfasst — Diagnose vor dem Call eintragen."
const QUIZ_SUMMARY = "Alle Quiz-Antworten"
const HEBEL_TITLE = "Hebel"
const HEBEL_EMPTY = "Noch keine Hebel erfasst."
const HEBEL_ADD = "Hebel hinzufügen"
const HEBEL_REMOVE = "Entfernen"
const HEBEL_TITLE_PLACEHOLDER = "Hebel, z. B. Schaden stoppen"
const HEBEL_NOTE_PLACEHOLDER = "Was konkret sich ändert"
const HEBEL_POINTS_LABEL = "Punkte"
const HEBEL_FOOTNOTE = "Erfahrungswerte — grobe Orientierung, keine Messung."
const ASK_PREFIX = "kurz fragen:"
const HABITS_TITLE = "Gewohnheiten"
const HABITS_EMPTY = "Noch keine Gewohnheiten erfasst."
const HABITS_FROM_RECIPE = "Vorschläge aus dem Rezept für ihr Hauptproblem — im Call abhaken."
const HABIT_ON_PDF = "steht auf ihrem PDF"
const HABIT_NEW_PLACEHOLDER = "Weitere Gewohnheit"
const HABIT_ADD = "Hinzufügen"

type HebelRow = { uid: string; title: string; note: string; points: string }

/** „1,5" or „1.5" → 1.5; anything else → null. */
export function parseRunsheetPoints(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (normalized === "") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** A whole score 1–10, else null. */
export function parseRunsheetBaseline(value: string): number | null {
  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : null
}

/**
 * The staircase: baseline, then the running total after each Hebel, capped at the scale's
 * 10. The last value is the „Mit Plan" target.
 */
export function runsheetScoreSteps(
  baseline: number,
  points: ReadonlyArray<number | null>,
): number[] {
  const steps = [baseline]
  for (const value of points) steps.push(Math.min(10, steps.at(-1)! + (value ?? 0)))
  return steps
}

export function DiscoveryRunsheetBrief({
  initialBaseline,
  initialSections,
  initialCommitments,
  recipeHabits,
  checklist,
  askTopics,
  quizSection,
  recipeSection,
  heatSection,
}: {
  initialBaseline: number | null
  initialSections: DiscoveryCallSheetBriefSections
  initialCommitments: DiscoveryCallSheetHabitCommitment[]
  /** The main problem recipe's „Ohne Produkt" levers — the pre-fill for an empty list. */
  recipeHabits: ReadonlyArray<{ id: string; label: string }>
  checklist: RunsheetChecklistLine[]
  /** The checklist's ask_* rules as topics — the „kurz fragen" chips in the Hebel card (R17). */
  askTopics: readonly string[]
  quizSection?: ReactNode
  recipeSection?: ReactNode
  heatSection?: ReactNode
}) {
  // React keys for the Hebel rows: the stored rows get theirs by position, added rows count on.
  const nextUid = useRef(initialSections.hebel.length)
  const [baselineText, setBaselineText] = useState(
    initialBaseline === null ? "" : String(initialBaseline),
  )
  const [diagnose, setDiagnose] = useState(initialSections.diagnose)
  const [hebel, setHebel] = useState<HebelRow[]>(() =>
    initialSections.hebel.map((entry, index) => ({
      uid: `hebel-${index}`,
      title: entry.title,
      note: entry.note,
      points: entry.points === null ? "" : formatRunsheetScore(entry.points),
    })),
  )
  const prefilled = initialCommitments.length === 0 && recipeHabits.length > 0
  const [commitments, setCommitments] = useState<DiscoveryCallSheetHabitCommitment[]>(() =>
    initialCommitments.length > 0
      ? initialCommitments
      : recipeHabits.map((habit) => ({ ...habit, committed: false })),
  )
  const [newHabit, setNewHabit] = useState("")
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const baseline = parseRunsheetBaseline(baselineText)
  const steps =
    baseline !== null && hebel.length > 0
      ? runsheetScoreSteps(
          baseline,
          hebel.map((row) => parseRunsheetPoints(row.points)),
        )
      : null
  const target = steps ? steps.at(-1)! : null

  function updateHebel(index: number, patch: Partial<HebelRow>) {
    setHebel((rows) => rows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  }

  function addHabit() {
    const label = newHabit.trim()
    if (!label) return
    setCommitments((current) => [
      ...current,
      { id: `manual-${current.length}-${label}`, label, committed: true },
    ])
    setNewHabit("")
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
          <div>
            <label
              htmlFor="runsheet-baseline-score"
              className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {SCORE_BASELINE}
            </label>
            <span className="flex items-baseline gap-1">
              <input
                id="runsheet-baseline-score"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                placeholder="–"
                value={baselineText}
                onChange={(event) => setBaselineText(event.target.value)}
                className="w-14 rounded border bg-background px-1.5 py-0.5 text-2xl font-bold text-foreground"
              />
              <span className="text-sm text-muted-foreground">{SCORE_SCALE}</span>
            </span>
          </div>
          {baseline !== null && target !== null ? (
            <>
              <span aria-hidden="true" className="text-xl text-muted-foreground">
                →
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {SCORE_TARGET}
                </p>
                <p className="text-2xl font-bold text-[var(--brand-plum)]">
                  {formatRunsheetScore(target)}
                  <span className="text-sm font-normal text-muted-foreground">{SCORE_SCALE}</span>
                </p>
              </div>
            </>
          ) : null}
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <RunsheetEyebrow>{PREP_TITLE}</RunsheetEyebrow>
          <ul className="mt-1.5 flex flex-col gap-1">
            {checklist.map((line) => (
              <li key={line.id} className="flex items-start gap-2 text-[13px] leading-5">
                <input
                  id={`runsheet-prep-${line.id}`}
                  type="checkbox"
                  checked={checked[line.id] === true}
                  onChange={(event) =>
                    setChecked((current) => ({ ...current, [line.id]: event.target.checked }))
                  }
                  className="mt-0.5 accent-[var(--brand-plum)]"
                />
                <label htmlFor={`runsheet-prep-${line.id}`} className="text-foreground">
                  {line.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RunsheetPhase number={1} title={OPENING_TITLE} id="runsheet-phase-1">
        <details className="rounded-xl border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-foreground">
            {OPENING_SUMMARY}
          </summary>
          <ul className="mt-2 list-disc pl-5 text-[13px] leading-6 text-foreground">
            {OPENING_SCRIPT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </RunsheetPhase>

      <RunsheetPhase number={2} title={PROBLEM_TITLE} id="runsheet-phase-2">
        <RunsheetCard title={<label htmlFor="runsheet-diagnose">{DIAGNOSE_TITLE}</label>}>
          {diagnose.trim() === "" ? (
            <p className="text-[13px] font-bold text-[var(--status-pending-text)]">
              {DIAGNOSE_EMPTY}
            </p>
          ) : null}
          <textarea
            id="runsheet-diagnose"
            rows={4}
            value={diagnose}
            onChange={(event) => setDiagnose(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-foreground"
          />
          {heatSection}
          {quizSection ? (
            <details>
              <summary className="cursor-pointer text-[13px] font-bold text-[var(--brand-plum)]">
                {QUIZ_SUMMARY}
              </summary>
              <div className="mt-2">{quizSection}</div>
            </details>
          ) : null}
        </RunsheetCard>

        {recipeSection}

        <RunsheetCard
          title={
            baseline !== null && target !== null
              ? `${HEBEL_TITLE} · von ${formatRunsheetScore(baseline)} auf ${formatRunsheetScore(target)}`
              : HEBEL_TITLE
          }
        >
          {steps ? <Staircase steps={steps} /> : null}
          {hebel.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{HEBEL_EMPTY}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {hebel.map((row, index) => (
                <li key={row.uid} className="flex items-start gap-2.5 border-b pb-2 last:border-0">
                  <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum-ice)] text-[11px] font-bold text-[var(--brand-plum)]">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <input
                      id={`runsheet-hebel-${index}-title`}
                      aria-label={`${HEBEL_TITLE} ${index + 1}`}
                      value={row.title}
                      placeholder={HEBEL_TITLE_PLACEHOLDER}
                      onChange={(event) => updateHebel(index, { title: event.target.value })}
                      className="rounded border bg-background px-2 py-1 text-sm font-bold text-foreground"
                    />
                    <textarea
                      id={`runsheet-hebel-${index}-note`}
                      aria-label={`${HEBEL_TITLE} ${index + 1}: ${HEBEL_NOTE_PLACEHOLDER}`}
                      rows={2}
                      value={row.note}
                      placeholder={HEBEL_NOTE_PLACEHOLDER}
                      onChange={(event) => updateHebel(index, { note: event.target.value })}
                      className="rounded border bg-background px-2 py-1 text-[13px] leading-5 text-foreground"
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      +
                      <input
                        id={`runsheet-hebel-${index}-points`}
                        aria-label={`${HEBEL_TITLE} ${index + 1}: ${HEBEL_POINTS_LABEL}`}
                        inputMode="decimal"
                        value={row.points}
                        placeholder="0"
                        onChange={(event) => updateHebel(index, { points: event.target.value })}
                        className="w-12 rounded border bg-background px-1.5 py-1 text-right text-sm font-bold text-[var(--brand-plum)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setHebel((rows) => rows.filter((_, at) => at !== index))}
                      className="text-[11px] text-muted-foreground underline"
                    >
                      {HEBEL_REMOVE}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div>
            <button
              id="runsheet-hebel-add"
              type="button"
              onClick={() => {
                const rowUid = `hebel-${nextUid.current++}`
                setHebel((rows) => [...rows, { uid: rowUid, title: "", note: "", points: "" }])
              }}
              className="rounded-lg border border-[var(--brand-plum)] px-3 py-1.5 text-xs font-bold text-[var(--brand-plum)]"
            >
              {HEBEL_ADD}
            </button>
          </div>
          {askTopics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {askTopics.map((topic) => (
                <RunsheetChip key={topic} tone="pending">
                  {`${ASK_PREFIX} ${topic}`}
                </RunsheetChip>
              ))}
            </div>
          ) : null}
          <p className="text-[12px] text-muted-foreground">{HEBEL_FOOTNOTE}</p>
        </RunsheetCard>

        <RunsheetCard title={HABITS_TITLE}>
          {prefilled ? (
            <p className="text-[12px] text-muted-foreground">{HABITS_FROM_RECIPE}</p>
          ) : null}
          {commitments.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{HABITS_EMPTY}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {commitments.map((habit, index) => (
                <li
                  key={habit.id}
                  className="flex flex-wrap items-start gap-2 text-[13px] leading-5"
                >
                  <input
                    id={`runsheet-habit-${index}`}
                    type="checkbox"
                    checked={habit.committed}
                    onChange={(event) =>
                      setCommitments((current) =>
                        current.map((entry, at) =>
                          at === index ? { ...entry, committed: event.target.checked } : entry,
                        ),
                      )
                    }
                    className="mt-0.5 accent-[var(--brand-plum)]"
                  />
                  <label
                    htmlFor={`runsheet-habit-${index}`}
                    className="min-w-0 flex-1 text-foreground"
                  >
                    {habit.label}
                  </label>
                  {habit.committed ? <RunsheetChip tone="plum">{HABIT_ON_PDF}</RunsheetChip> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              id="runsheet-habit-new"
              aria-label={HABIT_NEW_PLACEHOLDER}
              value={newHabit}
              placeholder={HABIT_NEW_PLACEHOLDER}
              onChange={(event) => setNewHabit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addHabit()
                }
              }}
              className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-[13px] text-foreground"
            />
            <button
              type="button"
              onClick={addHabit}
              className="rounded-lg border border-[var(--brand-plum)] px-3 py-1 text-xs font-bold text-[var(--brand-plum)]"
            >
              {HABIT_ADD}
            </button>
          </div>
        </RunsheetCard>
      </RunsheetPhase>
    </>
  )
}

/** Baseline → +points per Hebel → target, as bars (a rough indication, R3). */
function Staircase({ steps }: { steps: number[] }) {
  return (
    <div aria-hidden="true" className="flex items-end gap-2">
      {steps.map((value, index) => {
        const edge = index === 0 ? "base" : index === steps.length - 1 ? "goal" : "step"
        return (
          <div key={index} className="flex w-12 flex-col items-center gap-1">
            <span className="text-xs font-bold text-foreground">{formatRunsheetScore(value)}</span>
            <div
              className={`w-full rounded-t ${
                edge === "base"
                  ? "bg-muted-foreground/30"
                  : edge === "goal"
                    ? "bg-[var(--brand-plum)]"
                    : "bg-[var(--brand-plum-light)]"
              }`}
              style={{ height: `${Math.max(8, Math.round((value / 10) * 88))}px` }}
            />
          </div>
        )
      })}
    </div>
  )
}
