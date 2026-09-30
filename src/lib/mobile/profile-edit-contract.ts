import { z } from "zod"
import { quizAnswersSchema } from "@/lib/quiz/validators"
import { quizQuestions, QUIZ_QUESTION_STEPS } from "@/lib/quiz/questions"
import { projectQuizAnswersToLegacyVocabulary } from "@/lib/quiz/normalization"
import { buildProfileDataFromQuizAnswers } from "@/lib/quiz/link-to-profile"
import { deriveDesiredVolumeFromGoals } from "@/lib/hair-profile/derived"
import { getConcernOptions, getGoalOptions } from "@/components/personal-plan-quiz/quiz-data"
import { GOAL_LABELS, PROFILE_CONCERN_LABELS, type HairTexture } from "@/lib/vocabulary"
import type { QuizAnswers } from "@/lib/quiz/types"

export const profileEditRequestSchema = z
  .object({
    expectedProfileRevision: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
    requestId: z.uuid(),
    answers: quizAnswersSchema.refine((answers) => Boolean(answers.goals?.length), {
      path: ["goals"],
      message: "Bitte wähle mindestens ein Ziel.",
    }),
  })
  .strict()
export type ProfileEditRequest = z.infer<typeof profileEditRequestSchema>
export type EditOption = { value: string; label: string; description?: string }
export type EditQuestion = {
  id: string
  title: string
  instruction: string
  selectionMode: "single" | "multi"
  options: EditOption[]
  conditionOptions?: EditOption[]
  optionsByTexture?: Record<string, EditOption[]>
}
const option = ({ value, label, description }: EditOption): EditOption => ({
  value,
  label,
  ...(description ? { description } : {}),
})
const SCALP_TYPES = [
  {
    value: "fettig",
    label: "Eher fettig",
    description: "Meine Ansätze werden meist nach 1–2 Tagen ölig",
    icon: "scalp-oily",
  },
  {
    value: "ausgeglichen",
    label: "Ausgeglichen",
    description: "Meine Kopfhaut fühlt sich weder fettig noch trocken an",
    icon: "scalp-normal",
  },
  {
    value: "trocken",
    label: "Eher trocken",
    description: "Meine Kopfhaut spannt manchmal oder fühlt sich rau an",
    icon: "scalp-dry",
  },
]

const SCALP_CONDITIONS = [
  {
    value: "schuppen",
    label: "Schuppen",
    description: "Weiße oder gelbliche Flocken",
    icon: "scalp-flaky",
  },
  {
    value: "trockene_schuppen",
    label: "Trockene Schuppen",
    description: "Kleine, weiße, trockene Flocken — Kopfhaut spannt",
    icon: "scalp-dry-flakes",
  },
  {
    value: "gereizt",
    label: "Gereizte Kopfhaut",
    description: "Jucken, Rötungen oder Brennen",
    icon: "scalp-irritated",
  },
]

const fieldByStep: Record<number, string> = {
  2: "structure",
  3: "thickness",
  13: "density",
  15: "hair_length",
  4: "fingertest",
  5: "pulltest",
  7: "treatment",
  6: "scalp_type",
  8: "concerns",
  12: "goals",
}
function withSavedOptions(
  options: EditOption[],
  saved: string[] | undefined,
  labels: Record<string, string>,
): EditOption[] {
  const result = options.map(option)
  for (const value of saved ?? [])
    if (!result.some((item) => item.value === value))
      result.push({ value, label: labels[value] ?? value })
  return result
}
export function mobileEditQuestions(answers: QuizAnswers): EditQuestion[] {
  const texture = answers.structure as HairTexture | undefined
  return QUIZ_QUESTION_STEPS.map((step) => {
    const id = fieldByStep[step]
    if (id === "scalp_type")
      return {
        id,
        title: "Wie fühlt sich deine Kopfhaut normalerweise an?",
        instruction:
          "Denk dabei an deine Kopfhaut und Ansätze – nicht an trockene Längen oder Spitzen.",
        selectionMode: "single",
        options: SCALP_TYPES.map(option),
        conditionOptions: SCALP_CONDITIONS.map(option),
      }
    if (id === "goals" || id === "concerns") {
      const goals = id === "goals"
      const getOptions = (value: HairTexture | undefined) =>
        withSavedOptions(
          goals ? getGoalOptions(value) : getConcernOptions(value),
          goals ? answers.goals : answers.concerns,
          goals ? GOAL_LABELS : PROFILE_CONCERN_LABELS,
        )
      return {
        id,
        title: goals ? "Was wünschst du dir für deine Haare?" : "Was beschäftigt dich gerade?",
        instruction: goals
          ? "Wähle alles aus, was dir wichtig ist."
          : "Wähle alles aus, was aktuell auf dein Haar zutrifft.",
        selectionMode: "multi",
        options: getOptions(texture),
        optionsByTexture: Object.fromEntries(
          ["straight", "wavy", "curly", "coily"].map((value) => [
            value,
            getOptions(value as HairTexture),
          ]),
        ),
      }
    }
    const question = quizQuestions.find((question) => question.step === step)!
    return {
      id,
      title: question.title,
      instruction: question.instruction,
      selectionMode: question.selectionMode,
      options: question.options.map(option),
    }
  })
}
export function mobileEditProfilePatch(answers: QuizAnswers): Record<string, unknown> {
  const goals = projectQuizAnswersToLegacyVocabulary(answers).goals
  return {
    ...buildProfileDataFromQuizAnswers(answers),
    goals,
    desired_volume: deriveDesiredVolumeFromGoals(goals, null),
  }
}
