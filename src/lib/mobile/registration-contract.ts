import { z } from "zod"
import { quizAnswersSchema } from "@/lib/quiz/validators"
import { scannerSourceHash } from "@/lib/scan/scanner-context"
export const registrationSubmissionSchema = z
  .object({
    // Swift UUID Codable emits uppercase; PostgreSQL uuid::text is lowercase.
    requestId: z.uuid().toLowerCase(),
    answers: quizAnswersSchema.refine((a) => Boolean(a.goals?.length), {
      path: ["goals"],
      message: "Bitte wähle mindestens ein Ziel.",
    }),
    firstName: z.string().trim().min(1).max(100),
    email: z.email().trim().toLowerCase().max(254),
    marketingOptIn: z.boolean(),
  })
  .strict()
export type RegistrationSubmission = z.infer<typeof registrationSubmissionSchema>
export function registrationSubmissionHash(input: RegistrationSubmission): string {
  return scannerSourceHash(registrationSubmissionSchema.parse(input))
}
export const registrationCompleteSchema = z
  .object({
    completionToken: z.string().min(32).max(16384),
    submission: registrationSubmissionSchema,
    choice: z.enum(["create", "keep", "replace"]),
    expectedProfileRevision: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
  })
  .strict()
export const registrationVerifyResponseSchema = z
  .object({
    userId: z.uuid(),
    hasExistingProfile: z.boolean(),
    profileRevision: z.string().regex(/^\d+$/),
    completionToken: z.string().min(32).max(16384),
  })
  .strict()
