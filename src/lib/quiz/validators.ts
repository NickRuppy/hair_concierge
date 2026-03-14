import { z } from "zod"
import {
  QUIZ_STRUCTURE_VALUES,
  QUIZ_THICKNESS_VALUES,
  QUIZ_FINGERTEST_VALUES,
  QUIZ_PULLTEST_VALUES,
  QUIZ_SCALP_TYPE_VALUES,
  QUIZ_SCALP_CONDITION_VALUES,
  QUIZ_TREATMENT_VALUES,
} from "./normalization"

export const quizAnswersSchema = z
  .object({
    structure: z.enum(QUIZ_STRUCTURE_VALUES),
    thickness: z.enum(QUIZ_THICKNESS_VALUES),
    fingertest: z.enum(QUIZ_FINGERTEST_VALUES),
    pulltest: z.enum(QUIZ_PULLTEST_VALUES),
    scalp_type: z.enum(QUIZ_SCALP_TYPE_VALUES),
    scalp_condition: z.enum(QUIZ_SCALP_CONDITION_VALUES),
    treatment: z.array(z.enum(QUIZ_TREATMENT_VALUES)).min(1, "Bitte waehle mindestens eine Behandlung"),
  })
  .strict()
  .superRefine((answers, ctx) => {
    if (new Set(answers.treatment).size !== answers.treatment.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Behandlungen duerfen nicht doppelt vorkommen",
        path: ["treatment"],
      })
    }

    if (answers.treatment.includes("natur") && answers.treatment.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Naturhaar kann nicht mit chemischen Behandlungen kombiniert werden",
        path: ["treatment"],
      })
    }
  })

export const leadSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  email: z.string().email("Bitte gib eine gueltige E-Mail-Adresse ein"),
  marketingConsent: z.boolean(),
  quizAnswers: quizAnswersSchema,
})

export const analyzeSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string(),
  quizAnswers: quizAnswersSchema,
})
