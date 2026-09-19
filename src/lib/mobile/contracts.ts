import { z } from "zod"

export * from "./scan-contracts"

export const authStartSchema = z.object({ email: z.email().trim().toLowerCase().max(254) }).strict()
export const authVerifySchema = z
  .object({
    attemptId: z.uuid(),
    code: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
    tokenHash: z
      .string()
      .min(32)
      .max(8192)
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.code) !== Boolean(value.tokenHash))
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(8192) }).strict()
export const sessionSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().int().positive(),
    userId: z.uuid(),
  })
  .strict()
export type MobileSession = z.infer<typeof sessionSchema>
export type MobileAuthVerification = z.infer<typeof authVerifySchema>

export const profileSchema = z.object({
  profileRevision: z.string(),
  answers: z.array(z.object({ id: z.string(), label: z.string(), values: z.array(z.string()) })),
})
export const bootstrapSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    profileRevision: z.string(),
    contextRevision: z.string(),
    researchDeliveryEnabled: z.boolean().optional().default(false),
  }),
  z.object({
    status: z.literal("profile_required"),
    researchDeliveryEnabled: z.boolean().optional().default(false),
  }),
  z.object({
    status: z.literal("temporarily_unavailable"),
    researchDeliveryEnabled: z.boolean().optional().default(false),
  }),
])
