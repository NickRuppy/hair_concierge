import type { ProfileAnswers } from "@/lib/hair-profile/profile-answers"
import { reconcilePrimaryConcern, requiresPrimaryConcernPick } from "@/lib/quiz/primary-concern"
import type { DiagnosticsV1 } from "@/lib/user-facts/schema"

/**
 * The inline Haar-Check editor on the profile page (clean-switch task 8): its draft lives in the
 * quiz's vocabulary (the stored facts document), it offers exactly the quiz's options, and its
 * save sends only the answer groups she changed (`POST /api/profile/answers`). Pure.
 *
 * Quiz rules carried over verbatim:
 *  - chemische Behandlungen: „Naturhaar" excludes every treatment (`exclusiveValue: "natural"`),
 *    at least one answer;
 *  - Kopfhaut-Beschwerden: multi-select, „Nichts davon" is the empty answer;
 *  - Probleme: no maximum, no „Nichts davon"; „Etwas anderes" opens a note (max 50);
 *    saving needs at least one problem or a note; with two or more problems the main problem
 *    is asked among them (`primary-concern.ts`), and a pick is dropped when its problem is.
 */

export const PROBLEM_NOTE_MAX_LENGTH = 50

type Scalar<Key extends keyof DiagnosticsV1> = DiagnosticsV1[Key]

export type HaarCheckDraft = {
  texture: Scalar<"texture">
  thickness: Scalar<"thickness">
  density: Scalar<"density">
  hairLength: Scalar<"hairLength">
  hairSurface: Scalar<"hairSurface">
  elasticResponse: Scalar<"elasticResponse">
  chemicalTreatments: NonNullable<DiagnosticsV1["chemicalTreatments"]>
  scalpOiliness: Scalar<"scalpOiliness">
  /** `undefined` = never answered; `[]` = „Nichts davon". */
  scalpConcerns: DiagnosticsV1["scalpConcerns"]
  currentConcerns: NonNullable<DiagnosticsV1["currentConcerns"]>
  noteOpen: boolean
  note: string
  primaryConcern: DiagnosticsV1["primaryConcern"]
}

export function createHaarCheckDraft(diagnostics: DiagnosticsV1 | null): HaarCheckDraft {
  const note = diagnostics?.currentConcernsOtherText?.trim() ?? ""
  return {
    texture: diagnostics?.texture,
    thickness: diagnostics?.thickness,
    density: diagnostics?.density,
    hairLength: diagnostics?.hairLength,
    hairSurface: diagnostics?.hairSurface,
    elasticResponse: diagnostics?.elasticResponse,
    chemicalTreatments: [...(diagnostics?.chemicalTreatments ?? [])],
    scalpOiliness: diagnostics?.scalpOiliness,
    scalpConcerns: diagnostics?.scalpConcerns ? [...diagnostics.scalpConcerns] : undefined,
    currentConcerns: [...(diagnostics?.currentConcerns ?? [])],
    noteOpen: note.length > 0,
    note,
    primaryConcern: reconcilePrimaryConcern(
      diagnostics?.currentConcerns ?? [],
      diagnostics?.primaryConcern,
    ),
  }
}

function toggle<Value extends string>(values: readonly Value[], value: Value): Value[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function toggleChemicalTreatment(
  draft: HaarCheckDraft,
  value: HaarCheckDraft["chemicalTreatments"][number],
): HaarCheckDraft {
  if (value === "natural") {
    return {
      ...draft,
      chemicalTreatments: draft.chemicalTreatments.includes("natural") ? [] : ["natural"],
    }
  }
  const withoutNatural = draft.chemicalTreatments.filter((item) => item !== "natural")
  return { ...draft, chemicalTreatments: toggle(withoutNatural, value) }
}

export function toggleScalpConcern(
  draft: HaarCheckDraft,
  value: NonNullable<HaarCheckDraft["scalpConcerns"]>[number],
): HaarCheckDraft {
  return { ...draft, scalpConcerns: toggle(draft.scalpConcerns ?? [], value) }
}

/** „Nichts davon" on the scalp question: the empty answer. */
export function selectNoScalpConcern(draft: HaarCheckDraft): HaarCheckDraft {
  return { ...draft, scalpConcerns: [] }
}

export function toggleProblem(
  draft: HaarCheckDraft,
  value: HaarCheckDraft["currentConcerns"][number],
): HaarCheckDraft {
  const currentConcerns = toggle(draft.currentConcerns, value)
  return {
    ...draft,
    currentConcerns,
    primaryConcern: reconcilePrimaryConcern(currentConcerns, draft.primaryConcern),
  }
}

export function pickMainProblem(
  draft: HaarCheckDraft,
  value: HaarCheckDraft["currentConcerns"][number],
): HaarCheckDraft {
  return draft.currentConcerns.includes(value) ? { ...draft, primaryConcern: value } : draft
}

/** „Etwas anderes": closing it drops the note (as the quiz does). */
export function toggleProblemNote(draft: HaarCheckDraft): HaarCheckDraft {
  return draft.noteOpen ? { ...draft, noteOpen: false, note: "" } : { ...draft, noteOpen: true }
}

export function setProblemNote(draft: HaarCheckDraft, value: string): HaarCheckDraft {
  return { ...draft, note: value.slice(0, PROBLEM_NOTE_MAX_LENGTH) }
}

function activeNote(draft: HaarCheckDraft): string {
  return draft.noteOpen ? draft.note.trim() : ""
}

export function showsMainProblemQuestion(draft: HaarCheckDraft): boolean {
  return requiresPrimaryConcernPick(draft.currentConcerns)
}

export type HaarCheckBlock = "problems" | "main_problem" | "chemical_treatments"

/** Why saving is not possible yet, or `null`. The problems rule applies on every save — a
 * profile without a stored problem keeps it only until she saves. */
export function haarCheckSaveBlock(
  draft: HaarCheckDraft,
  initial: HaarCheckDraft,
): HaarCheckBlock | null {
  if (draft.currentConcerns.length === 0 && !activeNote(draft)) return "problems"
  if (showsMainProblemQuestion(draft) && !draft.primaryConcern) return "main_problem"
  if (draft.chemicalTreatments.length === 0 && initial.chemicalTreatments.length > 0) {
    return "chemical_treatments"
  }
  return null
}

function sameSet(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.length === b.length && a.every((item) => b.includes(item))
}

const SCALARS = [
  "texture",
  "thickness",
  "density",
  "hairLength",
  "hairSurface",
  "elasticResponse",
  "scalpOiliness",
] as const

/**
 * The answer groups she changed, in the route's vocabulary, or `null` when nothing changed.
 * Unchanged groups are not sent (an untouched unanswered field is never turned into an answer).
 */
export function buildHaarCheckPayload(
  draft: HaarCheckDraft,
  initial: HaarCheckDraft,
): ProfileAnswers | null {
  const payload: Record<string, unknown> = {}
  for (const field of SCALARS) {
    if (draft[field] !== undefined && draft[field] !== initial[field]) payload[field] = draft[field]
  }
  if (
    draft.chemicalTreatments.length > 0 &&
    !sameSet(draft.chemicalTreatments, initial.chemicalTreatments)
  ) {
    payload.chemicalTreatments = draft.chemicalTreatments
  }
  if (draft.scalpConcerns !== undefined && !sameSet(draft.scalpConcerns, initial.scalpConcerns)) {
    payload.scalpConcerns = draft.scalpConcerns
  }

  const primary = showsMainProblemQuestion(draft) ? (draft.primaryConcern ?? null) : null
  const initialPrimary = showsMainProblemQuestion(initial) ? (initial.primaryConcern ?? null) : null
  const problemsChanged =
    !sameSet(draft.currentConcerns, initial.currentConcerns) ||
    activeNote(draft) !== activeNote(initial) ||
    primary !== initialPrimary
  if (problemsChanged) {
    payload.currentConcerns = draft.currentConcerns
    payload.currentConcernsOtherText = activeNote(draft) || null
    payload.primaryConcern = primary
  }

  return Object.keys(payload).length > 0 ? (payload as ProfileAnswers) : null
}
