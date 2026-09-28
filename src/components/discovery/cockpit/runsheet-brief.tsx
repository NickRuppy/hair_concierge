"use client"

import { useRef, useState, type ReactNode } from "react"

import {
  discoveryHabitCommitmentId,
  type DiscoveryCallSheetBriefSections,
  type DiscoveryCallSheetHabitCommitment,
  type DiscoveryCallSheetPatch,
} from "@/lib/discovery/call-sheet"

import {
  RunsheetCard,
  RunsheetChip,
  RunsheetEyebrow,
  RunsheetPhase,
  formatRunsheetScore,
  type RunsheetChecklistLine,
} from "./runsheet-parts"
import { RunsheetSaveBar, useRunsheetSave } from "./runsheet-save"

/**
 * The runsheet's top half (consult-runsheet T3): the score tile and „Vor dem Call" checklist,
 * Phase 1 („Eröffnen") and Phase 2 („Problem": Diagnose, Hebel with the score staircase,
 * Gewohnheiten). One client island because the „Mit Plan" target in the head is the baseline
 * plus the Hebel points below.
 *
 * Saving (T5): one explicit „Speichern" at the end of Phase 2 sends `baseline_score`,
 * `consult_brief` (the edited Diagnose + Hebel, every other section and the generation meta
 * carried through unchanged, `generated_by: "manual"`) and `habit_commitments`.
 *
 * Re-sync after `router.refresh()`: the island keeps the key of what it last saved (or was
 * seeded with). When the server props change, it re-seeds from them ONLY while it holds no
 * unsaved edits — so its own save's refresh changes nothing on screen, a newer stored brief
 * shows up on the next refresh, and a refresh from a decision write mid-typing never wipes
 * what Nick has not saved yet.
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

const SAVE_SCOPE = "Score, Diagnose, Hebel und Gewohnheiten"
const INVALID_BASELINE = "Nicht gespeichert — Score als ganze Zahl von 1 bis 10 eintragen."
const INVALID_POINTS = "Nicht gespeichert — Hebel-Punkte als Zahl eintragen, z. B. 1,5."

/** `uid` is the row's React key and DOM-id part — stable while rows are added or removed. */
type HebelRow = { uid: string; title: string; note: string; points: string }

/** What this island edits (everything else in the brief is carried through). */
export type RunsheetBriefState = {
  baselineText: string
  diagnose: string
  hebel: HebelRow[]
  commitments: DiscoveryCallSheetHabitCommitment[]
}

type BriefSeed = {
  initialBaseline: number | null
  initialSections: DiscoveryCallSheetBriefSections
  initialCommitments: DiscoveryCallSheetHabitCommitment[]
  recipeHabits: ReadonlyArray<{ id: string; label: string }>
}

function seedRunsheetBrief(props: BriefSeed, generation: number): RunsheetBriefState {
  return {
    baselineText: props.initialBaseline === null ? "" : String(props.initialBaseline),
    diagnose: props.initialSections.diagnose,
    hebel: props.initialSections.hebel.map((entry, index) => ({
      uid: `s${generation}-${index}`,
      title: entry.title,
      note: entry.note,
      points: entry.points === null ? "" : formatRunsheetScore(entry.points),
    })),
    commitments:
      props.initialCommitments.length > 0
        ? props.initialCommitments
        : props.recipeHabits.map((habit) => ({ ...habit, committed: false })),
  }
}

/** Identity of the edited content (row uids excluded): „has anything changed since …?". */
function runsheetBriefKey(state: RunsheetBriefState): string {
  return JSON.stringify([
    state.baselineText.trim(),
    state.diagnose,
    state.hebel.map((row) => [row.title, row.note, row.points.trim()]),
    state.commitments,
  ])
}

/**
 * The save payload, in the table's column shapes — or why it cannot be sent. An empty score
 * clears it; a non-empty one that is no whole 1–10 is refused rather than silently cleared
 * (same for Hebel points).
 */
export function runsheetBriefPatch(
  state: RunsheetBriefState,
  brief: {
    sections: DiscoveryCallSheetBriefSections
    generatedAt: string | null
    sourceHash: string | null
  },
): { patch: DiscoveryCallSheetPatch } | { invalid: string } {
  const baseline = parseRunsheetBaseline(state.baselineText)
  if (baseline === null && state.baselineText.trim() !== "") return { invalid: INVALID_BASELINE }
  const hebel = []
  for (const row of state.hebel) {
    const points = parseRunsheetPoints(row.points)
    if (points === null && row.points.trim() !== "") return { invalid: INVALID_POINTS }
    hebel.push({ title: row.title, note: row.note, points })
  }
  return {
    patch: {
      baseline_score: baseline,
      consult_brief: {
        sections: { ...brief.sections, diagnose: state.diagnose, hebel },
        generated_at: brief.generatedAt,
        generated_by: "manual",
        source_hash: brief.sourceHash,
      },
      habit_commitments: state.commitments,
    },
  }
}

/** Adds a commitment by its wording; an existing one with that wording is ticked instead. */
export function addRunsheetCommitment(
  commitments: DiscoveryCallSheetHabitCommitment[],
  label: string,
): DiscoveryCallSheetHabitCommitment[] {
  const text = label.trim()
  if (!text) return commitments
  const id = discoveryHabitCommitmentId("manual", text)
  const existing = commitments.find(
    (entry) => entry.id === id || entry.label.trim().toLowerCase() === text.toLowerCase(),
  )
  if (existing) {
    return commitments.map((entry) => (entry === existing ? { ...entry, committed: true } : entry))
  }
  return [...commitments, { id, label: text, committed: true }]
}

/** A commitment id (`recipe:<concern>:<slug>`) as a DOM id part. */
function habitDomId(id: string): string {
  return `runsheet-habit-${id.replace(/[^A-Za-z0-9_-]/g, "--")}`
}

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
  enrollmentId,
  initialBaseline,
  initialSections,
  initialBriefMeta = { generatedAt: null, sourceHash: null },
  initialCommitments,
  recipeHabits,
  saveLocked = false,
  checklist,
  askTopics,
  quizSection,
  recipeSection,
  heatSection,
}: {
  enrollmentId: string
  initialBaseline: number | null
  initialSections: DiscoveryCallSheetBriefSections
  /** The stored brief's generation meta — carried through a manual save unchanged. */
  initialBriefMeta?: { generatedAt: string | null; sourceHash: string | null }
  initialCommitments: DiscoveryCallSheetHabitCommitment[]
  /** The main problem recipe's „Ohne Produkt" levers — the pre-fill for an empty list. */
  recipeHabits: ReadonlyArray<{ id: string; label: string }>
  /** The row could not be read: an empty form must not overwrite it. */
  saveLocked?: boolean
  checklist: RunsheetChecklistLine[]
  /** The checklist's ask_* rules as topics — the „kurz fragen" chips in the Hebel card (R17). */
  askTopics: readonly string[]
  quizSection?: ReactNode
  recipeSection?: ReactNode
  heatSection?: ReactNode
}) {
  const seedProps: BriefSeed = {
    initialBaseline,
    initialSections,
    initialCommitments,
    recipeHabits,
  }
  // Added Hebel rows count on from here (seeded rows carry their seed generation instead).
  const nextUid = useRef(0)
  const [state, setState] = useState<RunsheetBriefState>(() => seedRunsheetBrief(seedProps, 0))
  const [generation, setGeneration] = useState(0)
  const [savedKey, setSavedKey] = useState(() => runsheetBriefKey(state))
  const propsKey = JSON.stringify([
    initialBaseline,
    initialSections.diagnose,
    initialSections.hebel,
    initialCommitments,
    recipeHabits,
  ])
  const [syncedProps, setSyncedProps] = useState(propsKey)
  const currentKey = runsheetBriefKey(state)
  const dirty = currentKey !== savedKey
  if (propsKey !== syncedProps) {
    setSyncedProps(propsKey)
    if (!dirty) {
      const next = seedRunsheetBrief(seedProps, generation + 1)
      const nextKey = runsheetBriefKey(next)
      if (nextKey !== currentKey) {
        setGeneration(generation + 1)
        setState(next)
      }
      setSavedKey(nextKey)
    }
  }
  const { status, message, save, fail } = useRunsheetSave(enrollmentId)

  const { baselineText, diagnose, hebel, commitments } = state
  const prefilled = initialCommitments.length === 0 && recipeHabits.length > 0
  const [newHabit, setNewHabit] = useState("")
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  function setBaselineText(value: string) {
    setState((current) => ({ ...current, baselineText: value }))
  }
  function setDiagnose(value: string) {
    setState((current) => ({ ...current, diagnose: value }))
  }
  function setHebel(update: (rows: HebelRow[]) => HebelRow[]) {
    setState((current) => ({ ...current, hebel: update(current.hebel) }))
  }
  function setCommitments(
    update: (rows: DiscoveryCallSheetHabitCommitment[]) => DiscoveryCallSheetHabitCommitment[],
  ) {
    setState((current) => ({ ...current, commitments: update(current.commitments) }))
  }

  function handleSave() {
    const built = runsheetBriefPatch(state, {
      sections: initialSections,
      generatedAt: initialBriefMeta.generatedAt,
      sourceHash: initialBriefMeta.sourceHash,
    })
    if ("invalid" in built) {
      fail(built.invalid)
      return
    }
    const sentKey = currentKey
    // Edits typed while the request ran stay „nicht gespeichert“.
    void save(built.patch, () => setSavedKey(sentKey))
  }

  const baseline = parseRunsheetBaseline(baselineText)
  const steps =
    baseline !== null && hebel.length > 0
      ? runsheetScoreSteps(
          baseline,
          hebel.map((row) => parseRunsheetPoints(row.points)),
        )
      : null
  const target = steps ? steps.at(-1)! : null

  function updateHebel(uid: string, patch: Partial<HebelRow>) {
    setHebel((rows) => rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
  }

  function addHabit() {
    if (!newHabit.trim()) return
    setCommitments((current) => addRunsheetCommitment(current, newHabit))
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
                      id={`runsheet-hebel-${row.uid}-title`}
                      aria-label={`${HEBEL_TITLE} ${index + 1}`}
                      value={row.title}
                      placeholder={HEBEL_TITLE_PLACEHOLDER}
                      onChange={(event) => updateHebel(row.uid, { title: event.target.value })}
                      className="rounded border bg-background px-2 py-1 text-sm font-bold text-foreground"
                    />
                    <textarea
                      id={`runsheet-hebel-${row.uid}-note`}
                      aria-label={`${HEBEL_TITLE} ${index + 1}: ${HEBEL_NOTE_PLACEHOLDER}`}
                      rows={2}
                      value={row.note}
                      placeholder={HEBEL_NOTE_PLACEHOLDER}
                      onChange={(event) => updateHebel(row.uid, { note: event.target.value })}
                      className="rounded border bg-background px-2 py-1 text-[13px] leading-5 text-foreground"
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      +
                      <input
                        id={`runsheet-hebel-${row.uid}-points`}
                        aria-label={`${HEBEL_TITLE} ${index + 1}: ${HEBEL_POINTS_LABEL}`}
                        inputMode="decimal"
                        value={row.points}
                        placeholder="0"
                        onChange={(event) => updateHebel(row.uid, { points: event.target.value })}
                        className="w-12 rounded border bg-background px-1.5 py-1 text-right text-sm font-bold text-[var(--brand-plum)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setHebel((rows) => rows.filter((entry) => entry.uid !== row.uid))
                      }
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
                const rowUid = `n${nextUid.current++}`
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
              {commitments.map((habit) => (
                <li
                  key={habit.id}
                  className="flex flex-wrap items-start gap-2 text-[13px] leading-5"
                >
                  <input
                    id={habitDomId(habit.id)}
                    type="checkbox"
                    checked={habit.committed}
                    onChange={(event) =>
                      setCommitments((current) =>
                        current.map((entry) =>
                          entry.id === habit.id
                            ? { ...entry, committed: event.target.checked }
                            : entry,
                        ),
                      )
                    }
                    className="mt-0.5 accent-[var(--brand-plum)]"
                  />
                  <label htmlFor={habitDomId(habit.id)} className="min-w-0 flex-1 text-foreground">
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

        <RunsheetSaveBar
          id="runsheet-brief-save"
          scope={SAVE_SCOPE}
          dirty={dirty}
          status={status}
          message={message}
          locked={saveLocked}
          onSave={handleSave}
        />
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
