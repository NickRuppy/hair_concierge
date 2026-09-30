import { parseSupportedPersonalPlanQuizEnvelope } from "@/lib/personal-plan/input"
import { adaptPersonalPlanAnswersForOffer } from "@/lib/personal-plan-quiz/offer-adapter"
import type { PersonalPlanQuizAnswers } from "@/lib/personal-plan-quiz/types"
import {
  buildProfileDataFromPersonalPlanCanonicalProfile,
  buildProfileDataFromQuizAnswers,
  buildProfilePrimaryConcern,
} from "@/lib/quiz/legacy-profile-projection"
import {
  CONCERN_TO_PROFILE_CONCERN_MAP,
  normalizeStoredQuizAnswers,
  projectQuizAnswersToLegacyVocabulary,
} from "@/lib/quiz/normalization"

import { deriveDiagnosticsColumns } from "../derive-legacy-columns"
import type { DiagnosticsAnswerGroup, HandEditField } from "../hand-edit"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../schema"
import {
  legacyColumnsToDiagnostics,
  type LegacyDiagnosticColumns,
} from "./legacy-columns-to-diagnostics"

/**
 * Clean-switch task 7, part A (plan 2026-09-30 §3: "a hand edit that is newer than a quiz is
 * kept"): which answer groups of a profile were EDITED BY HAND after the quiz the backfill
 * projects, so the backfill never silently reverts them.
 *
 * Before the clean switch the legacy `hair_profiles` columns were what users saw, and they could
 * change them after their quiz (web Haar-Check / Ziele editors, the iOS edit, iOS profile
 * completion). The rule, per column of each answer group:
 *  1. Recompute what the OLD writer stored for the chosen source: the quiz link's column
 *     projection (`src/lib/quiz/legacy-profile-projection.ts`, unchanged from main) over the
 *     artifact's stored `canonical_profile` (the offer-adapter output incl. its inferred goals
 *     and 3-concern cap) or over the legacy lead's answers; plus main's `primary_concern` and
 *     goals handling in `linkQuizToProfile`.
 *  2. Column equals it (after the tolerated differences below) -> untouched: the source's
 *     native value stays (quiz-only values — low_shine, manageability_styling, recurrence, main
 *     problem, several scalp concerns — survive).
 *  3. Column differs -> edited by hand: the column wins for that column's native field(s),
 *     converted with the ONE legacy->native conversion (`legacyColumnsToDiagnostics`, goals via
 *     `resolveVisibleDiagnosticGoals`). A column of an edited group that still equals the old
 *     writer's value keeps the source's native value: it derives into the same column, and the
 *     old editor could not show more than the column (the iOS edit's "handed back as shown"
 *     rule).
 *  4. Known non-edits are enumerated in `TOLERATED_DIFFERENCES`; a difference that cannot be
 *     classified confidently is AMBIGUOUS and treated as an edit (the visible state is never
 *     changed silently).
 *  5. A column the old writer did not write at all (the quiz never answered it) is history, not
 *     an edit: its value fills the gap when the source is silent (`kept`, provenance
 *     `unknown_historical`); density and hair length are left to the completeness step, which
 *     keeps them the same way (F2).
 *  6. A row that is exactly what a NON-winning quiz's link wrote (it was linked last — a lead
 *     linked by email fallback after the paid link, a re-inserted artifact) is that link, not N
 *     edits: those columns are `last_link` and the WINNER's stated answers replace them (§3: the
 *     quiz taken later fully replaces; fix round 6, I4 reversed fix round 5's "column wins"). The
 *     report names the mismatch and lists every visible change. The goals column keeps rule 4's
 *     "equal to an older own quiz's goals -> ambiguous, the column wins" (open with the owner).
 *
 * Pure: no I/O, no `server-only`.
 */

/** The legacy columns compared per answer group. `desired_volume` is derived from `goals` and
 * never compared (see `TOLERATED_DIFFERENCES.desired_volume_derived`). */
export const COMPARED_COLUMNS = [
  "hair_texture",
  "thickness",
  "density",
  "hair_length",
  "cuticle_condition",
  "protein_moisture_balance",
  "chemical_treatment",
  "scalp_type",
  "scalp_condition",
  "concerns",
  "primary_concern",
  "goals",
] as const
export type ComparedColumn = (typeof COMPARED_COLUMNS)[number]

/** The answer group (`FIELDS_BY_ANSWER_GROUP` in `hand-edit.ts`) each column belongs to. */
export const GROUP_OF_COLUMN: Record<ComparedColumn, DiagnosticsAnswerGroup> = {
  hair_texture: "structure",
  thickness: "thickness",
  density: "density",
  hair_length: "hair_length",
  cuticle_condition: "fingertest",
  protein_moisture_balance: "pulltest",
  chemical_treatment: "treatment",
  scalp_type: "scalp_type",
  scalp_condition: "scalp_type",
  concerns: "concerns",
  primary_concern: "concerns",
  goals: "goals",
}

/** The native field(s) a column's value converts into. */
const FIELDS_OF_COLUMN: Record<ComparedColumn, readonly HandEditField[]> = {
  hair_texture: ["texture"],
  thickness: ["thickness"],
  density: ["density"],
  hair_length: ["hairLength"],
  cuticle_condition: ["hairSurface"],
  protein_moisture_balance: ["elasticResponse"],
  chemical_treatment: ["chemicalTreatments"],
  scalp_type: ["scalpOiliness"],
  scalp_condition: ["scalpConcerns"],
  concerns: ["currentConcerns"],
  primary_concern: ["primaryConcern"],
  goals: ["goals", "volumeDirection"],
}

const ARRAY_COLUMNS = new Set<ComparedColumn>(["chemical_treatment", "concerns", "goals"])

/**
 * Every difference between a row's columns and the old writer's output that is NOT a hand
 * edit. Each one is named where it is applied and has its own test.
 */
export const TOLERATED_DIFFERENCES = {
  array_order: "arrays compare as sets: the old writers and editors wrote them in click order",
  empty_array_vs_null:
    "an empty chemical_treatment / concerns / goals equals NULL (the columns default to '{}', writers sent NULL or [])",
  density_default_migration:
    "migration 20260429120000 set density 'medium' where the quiz link had written none",
  hair_length_recovery:
    "the purchase-time hair-length form (plan-bereit) wrote a hair length the paid quiz did not carry",
  scalp_condition_none_migration:
    "migration 20260418173000 turned the old scalp_condition 'none' into NULL",
  desired_volume_derived:
    "desired_volume is derived from goals: the quiz link wrote NULL, the editors wrote the derived value — never compared",
  never_projected:
    "none of the columns the old writer fills carries a value: this quiz never reached the row (the link failed or never ran), so the source fills it — listed as a visible change",
  primary_concern_unwritten:
    "primary_concern is NULL although the quiz named a main problem: the column exists since 2026-09-25, the iOS writers never wrote it and its trigger drops a pick a later concerns write left stale",
  goals_never_written:
    "goals are empty although the old writer had goals: main's plan-bereit link (readiness.ts persistProfileOutput) never wrote goals, and neither old editor could save empty goals — the source fills them, listed as a visible change",
} as const
export type ToleratedDifferenceId = keyof typeof TOLERATED_DIFFERENCES

/** What the old writer stored for a source: a key is present exactly when it wrote that column. */
export type OldWriterColumns = Partial<Record<ComparedColumn, string | string[] | null>>

export type ColumnFinding = {
  group: DiagnosticsAnswerGroup
  column: ComparedColumn
  /** `edited`: differs from the old writer (column wins); `ambiguous`: not classifiable, treated
   * as an edit; `kept`: the old writer never wrote it, the column fills the source's gap;
   * `last_link`: differs from the winner's old writer but the whole row is what a NON-winning
   * quiz's link wrote (it was linked last) — the winner's value replaces it (fix round 6, I4). */
  verdict: "edited" | "ambiguous" | "kept" | "last_link"
  columnValue: string
  oldWriterValue: string
  reason?: string
}

export type HandEditAnalysis = {
  /** The source's native diagnostics with every edited / ambiguous / kept column applied. */
  diagnostics: DiagnosticsV1
  editedGroups: DiagnosticsAnswerGroup[]
  ambiguousGroups: DiagnosticsAnswerGroup[]
  findings: ColumnFinding[]
  tolerated: { column: ComparedColumn; id: ToleratedDifferenceId }[]
  /** Native fields now carrying a hand-edited (or ambiguous) column value: provenance `user`. */
  userFields: HandEditField[]
  /** Native fields filled from a column the old writer never wrote: `unknown_historical`. */
  keptFields: HandEditField[]
  /** Anything else the owner should read (e.g. quiz-only concerns kept beside an edit). */
  notes: string[]
}

// ---------------------------------------------------------------------------
// What the old writers stored
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pickCompared(data: Record<string, unknown>): OldWriterColumns {
  const picked: OldWriterColumns = {}
  for (const column of COMPARED_COLUMNS) {
    if (!(column in data)) continue
    const value = data[column]
    picked[column] =
      Array.isArray(value) || typeof value === "string" ? (value as string[] | string) : null
  }
  return picked
}

/**
 * main's `linkQuizToProfile` for a legacy lead: `buildProfileDataFromQuizAnswers` over the
 * normalized answers, `primary_concern` whenever the answers carry concerns, and the projected
 * legacy goals when there are any (main wrote them only onto a profile without goals — see the
 * `goals` ambiguity rule). The iOS registration wrote the same projection plus the goals
 * (`mobileEditProfilePatch`). `null` when the answers are no record at all (main skipped the link).
 */
export function oldWriterColumnsForLead(quizAnswers: unknown): OldWriterColumns | null {
  if (!isRecord(quizAnswers)) return null
  const answers = normalizeStoredQuizAnswers(quizAnswers)
  const data = buildProfileDataFromQuizAnswers(answers)
  if (answers.concerns !== undefined) data.primary_concern = buildProfilePrimaryConcern(answers)
  const goals = projectQuizAnswersToLegacyVocabulary(answers).goals
  if (goals.length > 0) data.goals = goals
  return pickCompared(data)
}

/** The artifact's `canonical_profile` as the paid preparation built it: the stored one (the
 * adapter changed over time, so recomputing would not always reproduce what was written), else
 * the offer adapter over a v3 envelope. */
function canonicalProfileOf(artifact: {
  quizAnswers: unknown
  canonicalProfile?: unknown
}): Record<string, unknown> | null {
  if (isRecord(artifact.canonicalProfile)) return artifact.canonicalProfile
  const parsed = parseSupportedPersonalPlanQuizEnvelope(artifact.quizAnswers)
  if (!parsed.ok || parsed.envelope.version !== 3) return null
  const adapted = adaptPersonalPlanAnswersForOffer(
    parsed.envelope.answers as unknown as PersonalPlanQuizAnswers,
  )
  return { modelVersion: "personal_plan_canonical_v1", ...adapted.answers }
}

/**
 * main's paid link (`preparePersonalPlanProfileProjection`):
 * `buildProfileDataFromPersonalPlanCanonicalProfile` (incl. the adapter's inferred goals and
 * 3-concern cap) plus `primary_concern`. `null` when it cannot be recomputed — main's link threw
 * then, so the columns came from somewhere else.
 */
export function oldWriterColumnsForArtifact(artifact: {
  quizAnswers: unknown
  canonicalProfile?: unknown
}): OldWriterColumns | null {
  const canonical = canonicalProfileOf(artifact)
  if (!canonical) return null
  try {
    const data = buildProfileDataFromPersonalPlanCanonicalProfile(canonical)
    const answers = normalizeStoredQuizAnswers(canonical)
    if (answers.concerns !== undefined) data.primary_concern = buildProfilePrimaryConcern(answers)
    return pickCompared(data)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

type ColumnValue = string | string[] | null

/** `array_order` + `empty_array_vs_null`. */
function normalizeColumn(column: ComparedColumn, value: ColumnValue | undefined): ColumnValue {
  if (ARRAY_COLUMNS.has(column)) {
    return Array.isArray(value) ? [...new Set(value)].sort() : []
  }
  return typeof value === "string" ? value : null
}

export function sameColumn(
  column: ComparedColumn,
  left: ColumnValue | undefined,
  right: ColumnValue | undefined,
) {
  return (
    JSON.stringify(normalizeColumn(column, left)) === JSON.stringify(normalizeColumn(column, right))
  )
}

function carriesValue(value: ColumnValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string"
}

export function renderColumnValue(value: ColumnValue | undefined): string {
  if (value === undefined) return "<not written>"
  if (value === null) return "NULL"
  if (Array.isArray(value)) return value.length > 0 ? value.join(",") : "[]"
  return value
}

/** `goals_never_written`: an empty goals column is never a hand edit — neither old editor could
 * save empty goals (`edit-route.ts` `.min(1)`, `profile-edit-contract.ts`), and main's plan-bereit
 * link never wrote the column at all. */
function goalsNeverWritten(
  column: ComparedColumn,
  value: ColumnValue | undefined,
  reference: ColumnValue | undefined,
): boolean {
  return column === "goals" && !carriesValue(value) && carriesValue(reference)
}

type Verdict =
  | { kind: "match" }
  | { kind: "tolerated"; id: ToleratedDifferenceId }
  | { kind: "not_written" }
  | { kind: "edited" }
  | { kind: "ambiguous"; reason: string }

function compareColumn(
  column: ComparedColumn,
  value: ColumnValue,
  expected: OldWriterColumns,
  olderQuizGoals: readonly ColumnValue[],
): Verdict {
  if (!(column in expected)) {
    if (column === "density" && value === "medium") {
      return { kind: "tolerated", id: "density_default_migration" }
    }
    if (column === "hair_length" && value !== null) {
      return { kind: "tolerated", id: "hair_length_recovery" }
    }
    return { kind: "not_written" }
  }
  const oldValue = expected[column]
  if (sameColumn(column, value, oldValue)) return { kind: "match" }
  if (goalsNeverWritten(column, value, oldValue)) {
    return { kind: "tolerated", id: "goals_never_written" }
  }

  if (column === "scalp_condition" && oldValue === "none" && value === null) {
    return { kind: "tolerated", id: "scalp_condition_none_migration" }
  }
  if (column === "primary_concern") {
    if (value === null) return { kind: "tolerated", id: "primary_concern_unwritten" }
    return {
      kind: "ambiguous",
      reason: "a main problem no editor wrote (main's editors never wrote this column)",
    }
  }
  if (column === "goals" && olderQuizGoals.some((goals) => sameColumn("goals", value, goals))) {
    return {
      kind: "ambiguous",
      reason:
        "the goals equal an OLDER own quiz's: main kept existing goals when a later quiz was linked",
    }
  }
  return { kind: "edited" }
}

/** Concern codes a legacy profile editor could never show (no legacy equivalent). */
function isQuizOnlyConcern(concern: string): boolean {
  return CONCERN_TO_PROFILE_CONCERN_MAP[concern] === undefined
}

export type DetectHandEditsInput = {
  /** The chosen source's native projection (before the completeness defaults). */
  native: DiagnosticsV1
  columns: LegacyDiagnosticColumns
  /** What the old writer stored for that source; `null` when it cannot be recomputed. */
  oldWriter: OldWriterColumns | null
  /** The goals the old writer projected for the user's OTHER own quizzes. */
  olderQuizGoals?: readonly string[][]
  /** What the old writer stored for a NON-winning quiz whose link the whole row still reflects
   * (`columnsMatchOldWriter`): a column that differs from the winner's but equals this one is
   * that link, not a hand edit, and the winner's value replaces it (fix round 6, I4). */
  lastLink?: OldWriterColumns
}

/**
 * Whether the row is exactly what the old writer stored for a quiz: every column it wrote
 * matches (after the tolerated differences), and it wrote at least one value the row carries —
 * i.e. that quiz's link was the last write and nothing was edited after it.
 */
export function columnsMatchOldWriter(
  columns: LegacyDiagnosticColumns,
  oldWriter: OldWriterColumns,
): boolean {
  let carried = false
  for (const column of COMPARED_COLUMNS) {
    if (!(column in oldWriter)) continue
    const value = (columns[column] ?? null) as ColumnValue
    const verdict = compareColumn(column, value, oldWriter, [])
    if (verdict.kind !== "match" && verdict.kind !== "tolerated") return false
    if (verdict.kind === "match" && carriesValue(value)) carried = true
  }
  return carried
}

export function detectHandEdits(input: DetectHandEditsInput): HandEditAnalysis {
  const { native, columns } = input
  const nativeDerived = deriveDiagnosticsColumns(native)
  const converted = legacyColumnsToDiagnostics(columns, {}) as Record<string, unknown>
  const doc: Record<string, unknown> = { ...native }
  const userFields = new Set<HandEditField>()
  const keptFields = new Set<HandEditField>()
  const findings: ColumnFinding[] = []
  const tolerated: HandEditAnalysis["tolerated"] = []
  const notes: string[] = []
  const takenColumns = new Map<ComparedColumn, Set<HandEditField>>()

  const take = (column: ComparedColumn, into: Set<HandEditField>) => {
    takenColumns.set(column, into)
    for (const field of FIELDS_OF_COLUMN[column]) {
      if (converted[field] === undefined) delete doc[field]
      else {
        doc[field] = converted[field]
        into.add(field)
      }
    }
  }
  const record = (column: ComparedColumn, verdict: ColumnFinding["verdict"], reason?: string) =>
    findings.push({
      group: GROUP_OF_COLUMN[column],
      column,
      verdict,
      columnValue: renderColumnValue(columns[column] ?? null),
      oldWriterValue: input.oldWriter
        ? renderColumnValue(input.oldWriter[column])
        : "<cannot be recomputed>",
      ...(reason ? { reason } : {}),
    })

  // `never_projected`: an editor changes answers one group at a time and never blanks them all;
  // a row without any of the values the old writer fills never received this quiz. With the old
  // writer unknown, the source's own derived columns stand in for it.
  const oldWriter = input.oldWriter
  const filledBySource = COMPARED_COLUMNS.filter((column) =>
    oldWriter
      ? column in oldWriter && carriesValue(oldWriter[column])
      : carriesValue(nativeDerived[column]),
  )
  const neverProjected =
    filledBySource.length > 0 &&
    filledBySource.every((column) => !carriesValue(columns[column] ?? null))

  for (const column of COMPARED_COLUMNS) {
    const value = (columns[column] ?? null) as ColumnValue
    const verdict: Verdict =
      neverProjected && (oldWriter ? column in oldWriter : filledBySource.includes(column))
        ? { kind: "tolerated", id: "never_projected" }
        : oldWriter
          ? compareColumn(column, value, oldWriter, input.olderQuizGoals ?? [])
          : sameColumn(column, value, nativeDerived[column])
            ? { kind: "match" }
            : column === "primary_concern" && value === null
              ? { kind: "tolerated", id: "primary_concern_unwritten" }
              : goalsNeverWritten(column, value, nativeDerived[column])
                ? { kind: "tolerated", id: "goals_never_written" }
                : {
                    kind: "ambiguous",
                    reason: "the old writer's output for this source cannot be recomputed",
                  }

    if (verdict.kind === "tolerated") tolerated.push({ column, id: verdict.id })
    if (
      (verdict.kind === "edited" || verdict.kind === "ambiguous") &&
      column !== "goals" &&
      input.lastLink &&
      column in input.lastLink &&
      sameColumn(column, value, input.lastLink[column])
    ) {
      // The row is the last link of a non-winning quiz: nobody edited it, and §3 says the quiz
      // taken later fully replaces — the winner's native value stays, and the resulting visible
      // change is listed for the owner (fix round 6, I4). Goals keep their own rule (open with
      // the owner): equal to an older own quiz's is ambiguous and the column wins.
      record(column, "last_link", "the column is what a non-winning quiz's link wrote")
    } else if (verdict.kind === "edited") {
      take(column, userFields)
      record(column, "edited")
    } else if (verdict.kind === "ambiguous") {
      take(column, userFields)
      record(column, "ambiguous", verdict.reason)
    } else if (verdict.kind === "not_written" && carriesValue(value)) {
      // The quiz never answered this column: its value is history (an earlier quiz, an edit
      // before this one), never contradicted by the source.
      if (sameColumn(column, value, nativeDerived[column])) continue
      const nativeSilent = FIELDS_OF_COLUMN[column].every((field) => {
        const current = native[field]
        return current === undefined || (Array.isArray(current) && current.length === 0)
      })
      if (nativeSilent) {
        take(column, keptFields)
        record(
          column,
          "kept",
          "the quiz never wrote this column; the profile's value fills the gap",
        )
      } else {
        take(column, userFields)
        record(
          column,
          "ambiguous",
          "the quiz did not write this column, and its own value derives differently",
        )
      }
    }
  }

  // --- consequences of a taken concerns column (migration table M + the hand-edit rules) ---
  if (takenColumns.has("concerns")) {
    const concerns = [...((doc.currentConcerns as string[] | undefined) ?? [])]
    // The old editors could not show a concern without a legacy equivalent, so an edit there
    // never removed it: it stays (N7 — the profile shows the quiz's concerns now).
    const quizOnly = (native.currentConcerns ?? []).filter(
      (concern) => isQuizOnlyConcern(concern) && !concerns.includes(concern),
    )
    if (quizOnly.length > 0) {
      doc.currentConcerns = [...concerns, ...quizOnly]
      notes.push(`kept quiz-only concerns beside the edit: ${quizOnly.join(",")}`)
    } else if (doc.currentConcerns === undefined && native.currentConcerns !== undefined) {
      // A NULL/[] concerns column is "no concerns": [] like every writer stores it.
      doc.currentConcerns = []
    }
    // Table M: a legacy `dandruff` concern is a scalp answer.
    if (columns.concerns?.includes("dandruff")) {
      const scalp = [...((doc.scalpConcerns as string[] | undefined) ?? [])]
      if (!scalp.includes("oily_dandruff")) doc.scalpConcerns = [...scalp, "oily_dandruff"]
      takenColumns.get("concerns")!.add("scalpConcerns")
    }
  }
  const currentConcerns = (doc.currentConcerns as string[] | undefined) ?? []
  // Her main problem only while it is one of her concerns (main's column trigger, the quiz).
  if (typeof doc.primaryConcern === "string" && !currentConcerns.includes(doc.primaryConcern)) {
    delete doc.primaryConcern
    userFields.delete("primaryConcern")
  }
  // The hand-edit rule: a recurrence whose concern is no longer selected goes with the edit.
  const recurrence = doc.concernRecurrence as { concernId: string } | undefined
  if (recurrence && !currentConcerns.includes(recurrence.concernId)) delete doc.concernRecurrence

  const groupsWith = (verdict: ColumnFinding["verdict"]) => [
    ...new Set(findings.filter((f) => f.verdict === verdict).map((f) => f.group)),
  ]
  const editedGroups = groupsWith("edited")
  const ambiguousGroups = groupsWith("ambiguous").filter((group) => !editedGroups.includes(group))

  return {
    diagnostics: diagnosticsV1Schema.parse(doc),
    editedGroups,
    ambiguousGroups,
    findings,
    tolerated,
    userFields: [...userFields].filter((field) => doc[field] !== undefined),
    keptFields: [...keptFields].filter((field) => doc[field] !== undefined),
    notes,
  }
}
