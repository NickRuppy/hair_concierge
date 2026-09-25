import {
  QUESTION_CONFIGS,
  getConcernOptions,
  getGoalOptions,
  type QuizOption as PersonalPlanQuizOption,
} from "@/components/personal-plan-quiz/quiz-data"
import { TEXTURE_QUESTION_CONFIG } from "@/components/personal-plan-quiz/texture-question"
import {
  DIAGNOSTIC_CONCERNS,
  resolveVisibleDiagnosticConcerns,
  resolveVisibleDiagnosticGoals,
  type DiagnosticConcern,
} from "@/lib/quiz/diagnostic-input"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import { getQuestionByStep } from "@/lib/quiz/questions"
import type { QuizStep } from "@/lib/quiz/types"
import { HAIR_LENGTH_OPTIONS } from "@/lib/vocabulary"

/**
 * „Quiz-Antworten" for the discovery cockpit (batch 7c, F8): every question of the quiz she
 * took, with her answer in the German the quiz showed her. Read-only, internal.
 *
 * Labels come from the quizzes themselves — `questions.ts` for the standard quiz, the
 * personal-plan quiz's `quiz-data.ts` (texture-aware concern and goal copy) for the other.
 * A few titles live inline in client components and are mirrored here (see the constants).
 *
 * The main problem is what she STATED (`primary_concern`, batch 7a), else her only concern,
 * else none — a ranking is never inferred (ruling F1.2).
 */

export type DiscoveryQuizLead = { id: string; quiz_kind: string; quiz_answers: unknown }

export type DiscoveryQuizAnswerGroupTitle =
  | "Haar"
  | "Kopfhaut"
  | "Behandlung"
  | "Probleme"
  | "Ziele"

/** One question; `answers` empty = not answered (the cockpit prints „—"). */
export type DiscoveryQuizAnswerRow = {
  question: string
  answers: Array<{ label: string; main?: true }>
}

export type DiscoveryQuizAnswerGroup = {
  title: DiscoveryQuizAnswerGroupTitle
  rows: DiscoveryQuizAnswerRow[]
}

export type DiscoveryQuizAnswers =
  | {
      status: "ready"
      kind: "legacy" | "personal_plan"
      groups: DiscoveryQuizAnswerGroup[]
      /** Her concerns in the quiz's canonical vocabulary. */
      concerns: DiagnosticConcern[]
      mainConcern: DiagnosticConcern | null
    }
  | { status: "no_lead" }
  | { status: "invalid" }

/** Mirrors `SCALP_TYPES` in `quiz-scalp-question.tsx` (a client module); a test pins it. */
export const DISCOVERY_LEGACY_SCALP_TYPE_LABELS: Record<string, string> = {
  fettig: "Eher fettig",
  ausgeglichen: "Ausgeglichen",
  trocken: "Eher trocken",
}

/** Mirrors `SCALP_CONDITIONS` in `quiz-scalp-question.tsx`; a test pins it. */
export const DISCOVERY_LEGACY_SCALP_CONDITION_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  trockene_schuppen: "Trockene Schuppen",
  gereizt: "Gereizte Kopfhaut",
}

// Titles rendered inline by client components (quiz-scalp-question.tsx, quiz-goals.tsx,
// personal-plan-quiz.tsx) — mirrored verbatim.
const LEGACY_SCALP_TYPE_TITLE = "Wie fühlt sich deine Kopfhaut normalerweise an?"
const LEGACY_SCALP_ISSUE_TITLE =
  "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?"
const GOALS_TITLE = "Was wünschst du dir für deine Haare?"
const PERSONAL_PLAN_CONCERNS_TITLE = "Was beschäftigt dich gerade?"
const PERSONAL_PLAN_RECURRENCE_FALLBACK = "deine Haarthemen"
const PERSONAL_PLAN_RECURRENCE_LABELS: Record<string, string> = {
  often: "Oft",
  sometimes: "Manchmal",
  rather_not: "Eher nicht",
}

const OTHER_TEXT_QUESTION = "Etwas anderes"
const NO_SCALP_ISSUE = "Nein"
const NOTHING_SELECTED = "Nichts davon"

const CONCERN_SET = new Set<string>(DIAGNOSTIC_CONCERNS)

/**
 * Her main problem: the stated one when it is a known concern she actually selected (a
 * stale or unknown value is ignored, as the quiz itself drops it), else her only concern,
 * else none.
 */
export function resolveDiscoveryMainConcern(
  concerns: readonly DiagnosticConcern[],
  stated: unknown,
): DiagnosticConcern | null {
  if (typeof stated === "string") {
    const [resolved] = resolveVisibleDiagnosticConcerns([stated])
    if (resolved && concerns.includes(resolved)) return resolved
  }
  return concerns.length === 1 ? concerns[0]! : null
}

export function buildDiscoveryQuizAnswers(lead: DiscoveryQuizLead | null): DiscoveryQuizAnswers {
  if (!lead) return { status: "no_lead" }
  if (!isRecord(lead.quiz_answers)) return { status: "invalid" }
  if (lead.quiz_kind === "legacy") return legacyQuizAnswers(lead.quiz_answers)
  if (lead.quiz_kind === "personal_plan") {
    const answers = lead.quiz_answers.answers
    if (lead.quiz_answers.kind !== "personal_plan" || !isRecord(answers)) {
      return { status: "invalid" }
    }
    return personalPlanQuizAnswers(answers)
  }
  return { status: "invalid" }
}

// --- the standard quiz ------------------------------------------------------------

function legacyQuizAnswers(raw: Record<string, unknown>): DiscoveryQuizAnswers {
  const answers = normalizeStoredQuizAnswers(raw)
  const texture = oneOf(answers.structure, TEXTURES)
  const concerns = resolveVisibleDiagnosticConcerns(answers.concerns ?? [])
  const mainConcern = resolveDiscoveryMainConcern(concerns, raw.primary_concern)

  const question = (step: QuizStep) => getQuestionByStep(step)!
  const single = (step: QuizStep, value: string | undefined): DiscoveryQuizAnswerRow => {
    const q = question(step)
    return { question: q.title, answers: value ? [{ label: labelOf(q.options, value) }] : [] }
  }
  const lengthRow: DiscoveryQuizAnswerRow = {
    question: question(15).title,
    answers: answers.hair_length
      ? [{ label: labelOf(HAIR_LENGTH_OPTIONS, answers.hair_length) }]
      : [],
  }
  const scalpIssue: DiscoveryQuizAnswerRow = {
    question: LEGACY_SCALP_ISSUE_TITLE,
    answers:
      answers.has_scalp_issue === false
        ? [{ label: NO_SCALP_ISSUE }]
        : answers.scalp_condition
          ? [
              {
                label:
                  DISCOVERY_LEGACY_SCALP_CONDITION_LABELS[answers.scalp_condition] ??
                  answers.scalp_condition,
              },
            ]
          : [],
  }
  const treatment = question(7)

  return {
    status: "ready",
    kind: "legacy",
    concerns,
    mainConcern,
    groups: [
      {
        title: "Haar",
        rows: [
          single(2, answers.structure),
          single(3, answers.thickness),
          single(13, answers.density),
          lengthRow,
          single(4, answers.fingertest),
          single(5, answers.pulltest),
        ],
      },
      {
        title: "Kopfhaut",
        rows: [
          {
            question: LEGACY_SCALP_TYPE_TITLE,
            answers: answers.scalp_type
              ? [
                  {
                    label:
                      DISCOVERY_LEGACY_SCALP_TYPE_LABELS[answers.scalp_type] ?? answers.scalp_type,
                  },
                ]
              : [],
          },
          scalpIssue,
        ],
      },
      {
        title: "Behandlung",
        rows: [
          {
            question: treatment.title,
            answers: (answers.treatment ?? []).map((value) => ({
              label: labelOf(treatment.options, value),
            })),
          },
        ],
      },
      {
        title: "Probleme",
        rows: [
          concernRow(
            question(8).title,
            Array.isArray(raw.concerns) ? concerns : undefined,
            texture,
            mainConcern,
          ),
          ...otherTextRow(answers.concerns_other_text),
        ],
      },
      {
        title: "Ziele",
        rows: [
          {
            question: GOALS_TITLE,
            answers: selectedInOptionOrder(
              getGoalOptions(texture),
              resolveVisibleDiagnosticGoals(answers.goals ?? []),
            ).map((label) => ({ label })),
          },
        ],
      },
    ],
  }
}

// --- the personal-plan quiz ---------------------------------------------------------

type PersonalPlanScreen = keyof typeof QUESTION_CONFIGS

function personalPlanQuizAnswers(answers: Record<string, unknown>): DiscoveryQuizAnswers {
  const texture = oneOf(answers.texture, TEXTURES)
  const concerns = Array.isArray(answers.currentConcerns)
    ? DIAGNOSTIC_CONCERNS.filter((code) => (answers.currentConcerns as unknown[]).includes(code))
    : []
  // 7a names the stated pick; accept either spelling until its schema lands.
  const mainConcern = resolveDiscoveryMainConcern(
    concerns,
    answers.primaryConcern ?? answers.primary_concern,
  )

  const screen = (id: PersonalPlanScreen): DiscoveryQuizAnswerRow => {
    const config = QUESTION_CONFIGS[id]!
    return { question: config.title, answers: optionAnswers(config.options, answers[config.field]) }
  }

  const recurrence = isRecord(answers.concernRecurrence) ? answers.concernRecurrence : null
  const recurrenceRows: DiscoveryQuizAnswerRow[] = recurrence
    ? [
        {
          question: `Wie oft bemerkst du ${
            midSentenceConcernLabel(texture, recurrence.concernId) ??
            PERSONAL_PLAN_RECURRENCE_FALLBACK
          }?`,
          answers:
            typeof recurrence.frequency === "string"
              ? [
                  {
                    label:
                      PERSONAL_PLAN_RECURRENCE_LABELS[recurrence.frequency] ?? recurrence.frequency,
                  },
                ]
              : [],
        },
      ]
    : []

  return {
    status: "ready",
    kind: "personal_plan",
    concerns,
    mainConcern,
    groups: [
      {
        title: "Haar",
        rows: [
          {
            question: TEXTURE_QUESTION_CONFIG.title,
            answers: optionAnswers(TEXTURE_QUESTION_CONFIG.options, answers.texture),
          },
          screen("thickness"),
          screen("density"),
          screen("hair_length"),
          screen("hair_surface"),
          screen("elastic_response"),
        ],
      },
      { title: "Kopfhaut", rows: [screen("scalp_oiliness"), screen("scalp_concerns")] },
      { title: "Behandlung", rows: [screen("chemical_treatments")] },
      {
        title: "Probleme",
        rows: [
          concernRow(
            PERSONAL_PLAN_CONCERNS_TITLE,
            Array.isArray(answers.currentConcerns) ? concerns : undefined,
            texture,
            mainConcern,
          ),
          ...otherTextRow(answers.currentConcernsOtherText),
          ...recurrenceRows,
          screen("routine_clarity"),
          screen("result_reliability"),
          screen("adaptation_confidence"),
          screen("previous_attempts"),
          screen("blockers"),
          ...otherTextRow(answers.blockersOtherText),
        ],
      },
      {
        title: "Ziele",
        rows: [
          {
            question: GOALS_TITLE,
            answers: optionAnswers(getGoalOptions(texture), answers.goals),
          },
          screen("routine_style"),
          screen("meaningful_moment"),
        ],
      },
    ],
  }
}

// --- helpers ---------------------------------------------------------------------

const TEXTURES = ["straight", "wavy", "curly", "coily"] as const
type Texture = (typeof TEXTURES)[number]

/** Her concerns with the labels the concerns step showed her, the main one marked. */
function concernRow(
  question: string,
  concerns: readonly DiagnosticConcern[] | undefined,
  texture: Texture | undefined,
  mainConcern: DiagnosticConcern | null,
): DiscoveryQuizAnswerRow {
  if (concerns === undefined) return { question, answers: [] }
  if (concerns.length === 0) return { question, answers: [{ label: NOTHING_SELECTED }] }
  return {
    question,
    answers: getConcernOptions(texture)
      .filter((option) => concerns.includes(option.value as DiagnosticConcern))
      .map((option) =>
        option.value === mainConcern
          ? { label: option.label, main: true as const }
          : { label: option.label },
      ),
  }
}

function midSentenceConcernLabel(texture: Texture | undefined, concernId: unknown) {
  if (typeof concernId !== "string" || !CONCERN_SET.has(concernId)) return null
  const option = getConcernOptions(texture).find((entry) => entry.value === concernId)
  return option?.midSentenceLabel ?? option?.label ?? null
}

function otherTextRow(value: unknown): DiscoveryQuizAnswerRow[] {
  return typeof value === "string" && value.trim()
    ? [{ question: OTHER_TEXT_QUESTION, answers: [{ label: value.trim() }] }]
    : []
}

/** One value or a list, labelled by the question's own options; unknown values stay raw. */
function optionAnswers(
  options: readonly Pick<PersonalPlanQuizOption, "value" | "label">[],
  value: unknown,
): DiscoveryQuizAnswerRow["answers"] {
  if (typeof value === "string" && value) return [{ label: labelOf(options, value) }]
  if (!Array.isArray(value)) return []
  const values = value.filter((entry): entry is string => typeof entry === "string")
  if (values.length === 0) return [{ label: NOTHING_SELECTED }]
  const known = selectedInOptionOrder(options, values)
  const unknown = values.filter((entry) => !options.some((option) => option.value === entry))
  return [...known, ...unknown].map((label) => ({ label }))
}

function selectedInOptionOrder(
  options: readonly Pick<PersonalPlanQuizOption, "value" | "label">[],
  values: readonly string[],
): string[] {
  return options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

function labelOf(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
