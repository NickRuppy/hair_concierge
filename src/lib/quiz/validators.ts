import { z } from "zod"

export const leadSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  email: z.string().email("Bitte gib eine gueltige E-Mail-Adresse ein"),
  marketingConsent: z.boolean(),
  quizAnswers: z.record(z.string(), z.unknown()),
})

export const analyzeSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string(),
  quizAnswers: z.record(z.string(), z.unknown()),
})
