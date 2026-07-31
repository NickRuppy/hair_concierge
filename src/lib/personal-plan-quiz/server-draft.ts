import { createHmac, timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"

import { sanitizePersonalPlanQuizAnswers } from "./draft"
import { createPersonalPlanClaimCredential, hashPersonalPlanClaimToken } from "./persistence"
import {
  PERSONAL_PLAN_QUIZ_CONCERNS,
  PERSONAL_PLAN_QUIZ_GOALS,
  PERSONAL_PLAN_QUIZ_SCREEN_IDS,
  type PersonalPlanQuizDraft,
  type PersonalPlanQuizScreenId,
  type PersonalPlanQuizServerSnapshot,
} from "./types"

export const PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY = "resume_token"
export const PERSONAL_PLAN_QUIZ_DRAFT_COOKIE = "chaarlie_personal_plan_quiz_draft"
export const PERSONAL_PLAN_QUIZ_DRAFT_VERSION = 3 as const
export const PERSONAL_PLAN_QUIZ_DRAFT_MAX_BODY_BYTES = 16_384
export const PERSONAL_PLAN_QUIZ_DRAFT_SLIDING_TTL_SECONDS = 24 * 60 * 60
export const PERSONAL_PLAN_QUIZ_DRAFT_ABSOLUTE_TTL_SECONDS = 7 * 24 * 60 * 60

const screenSet = new Set<string>(PERSONAL_PLAN_QUIZ_SCREEN_IDS)
const uuidSchema = z.string().uuid()
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,80}$/)

const uniqueEnumArray = <T extends readonly [string, ...string[]]>(
  values: T,
  { min = 0 }: { min?: number } = {},
) =>
  z
    .array(z.enum(values))
    .min(min)
    .max(values.length)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) {
        context.addIssue({ code: "custom", message: "duplicate draft answer" })
      }
    })

const partialDurableAnswersSchema = z
  .object({
    texture: z.enum(["straight", "wavy", "curly", "coily"]).optional(),
    thickness: z.enum(["fine", "normal", "coarse"]).optional(),
    density: z.enum(["low", "medium", "high"]).optional(),
    goals: uniqueEnumArray(PERSONAL_PLAN_QUIZ_GOALS, { min: 1 }).optional(),
    routineClarity: z.enum(["clear", "partial", "trial_and_error", "none"]).optional(),
    resultReliability: z.enum(["mostly", "sometimes", "rarely"]).optional(),
    adaptationConfidence: z.enum(["yes", "partly", "no"]).optional(),
    currentConcerns: uniqueEnumArray(PERSONAL_PLAN_QUIZ_CONCERNS).optional(),
    hairLength: z.enum(["very_short", "short", "medium", "long", "very_long"]).optional(),
    hairSurface: z.enum(["smooth", "slightly_uneven", "rough"]).optional(),
    elasticResponse: z.enum(["stretches_bounces", "stretches_stays", "snaps"]).optional(),
    chemicalTreatments: uniqueEnumArray(
      ["natural", "colored", "lightened", "permed", "chemically_straightened"],
      { min: 1 },
    ).optional(),
    scalpOiliness: z.enum(["oily", "balanced", "dry"]).optional(),
    scalpConcerns: uniqueEnumArray(["oily_dandruff", "dry_dandruff", "irritated"]).optional(),
    previousAttempts: z
      .enum([
        "nothing_reliably_worked",
        "some_steps_helped",
        "little_targeted_trial",
        "mostly_works",
      ])
      .optional(),
    blockers: uniqueEnumArray(
      [
        "conflicting_tips",
        "product_fit",
        "application_uncertainty",
        "different_scalp_and_lengths",
        "routine_too_complex",
        "time_and_cost",
        "consistency",
        "other",
      ],
      { min: 1 },
    ).optional(),
    routineStyle: z
      .enum([
        "simple_reliable",
        "intentional_caring",
        "flexible_versatile",
        "precise_goal_oriented",
      ])
      .optional(),
    meaningfulMoment: z
      .enum(["everyday", "work", "social", "going_out", "special_occasions"])
      .optional(),
    blockersOtherText: z.string().trim().min(1).max(280).optional(),
  })
  .strict()

const draftEnvelopeSchema = z
  .object({
    version: z.literal(PERSONAL_PLAN_QUIZ_DRAFT_VERSION),
    screen: z.enum(PERSONAL_PLAN_QUIZ_SCREEN_IDS),
    history: z
      .array(z.enum(PERSONAL_PLAN_QUIZ_SCREEN_IDS))
      .max(PERSONAL_PLAN_QUIZ_SCREEN_IDS.length),
    answers: partialDurableAnswersSchema,
    expectedRevision: z.number().int().positive().optional(),
    allowRevisionCatchup: z.literal(true).optional(),
  })
  .strict()

export type { PersonalPlanQuizServerSnapshot } from "./types"

export type PersonalPlanQuizDraftCookie = {
  draftId: string
  browserGeneration: number
  expiresAt: string
}

export const personalPlanQuizDraftCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  // The companion APIs live under /api; keep the credential HttpOnly but available to them.
  path: "/",
  maxAge: PERSONAL_PLAN_QUIZ_DRAFT_SLIDING_TTL_SECONDS,
}

export function parsePersonalPlanQuizServerDraft(value: unknown): {
  draft: PersonalPlanQuizDraft
  expectedRevision?: number
  allowRevisionCatchup?: true
} | null {
  const parsed = draftEnvelopeSchema.safeParse(value)
  if (!parsed.success) return null
  const answers = sanitizePersonalPlanQuizAnswers(parsed.data.answers)

  const history = parsed.data.history.filter((screen): screen is PersonalPlanQuizScreenId =>
    screenSet.has(screen),
  )
  return {
    draft: { screen: parsed.data.screen, history, answers },
    expectedRevision: parsed.data.expectedRevision,
    ...(parsed.data.allowRevisionCatchup === true ? { allowRevisionCatchup: true } : {}),
  }
}

export function createPersonalPlanQuizResumeCredential() {
  const { claimToken, claimTokenHash } = createPersonalPlanClaimCredential()
  return { resumeToken: claimToken, resumeTokenHash: claimTokenHash }
}

export function hashPersonalPlanQuizResumeCredential(resumeToken: string) {
  return hashPersonalPlanClaimToken(resumeToken)
}

export function isPersonalPlanQuizDraftCookieSecretConfigured(
  secret = process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET,
) {
  return typeof secret === "string" && secret.length >= 32
}

function cookieSecret() {
  const secret = process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET
  return isPersonalPlanQuizDraftCookieSecretConfigured(secret) ? secret : null
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

export function encodePersonalPlanQuizDraftCookie(
  value: PersonalPlanQuizDraftCookie,
): string | null {
  const secret = cookieSecret()
  if (!secret || !isPersonalPlanQuizDraftCookie(value)) return null
  const payload = encode(value)
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function decodePersonalPlanQuizDraftCookie(
  value?: string | null,
): PersonalPlanQuizDraftCookie | null {
  const secret = cookieSecret()
  if (!secret || !value) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  try {
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return isPersonalPlanQuizDraftCookie(decoded) ? decoded : null
  } catch {
    return null
  }
}

function isPersonalPlanQuizDraftCookie(value: unknown): value is PersonalPlanQuizDraftCookie {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const cookie = value as Record<string, unknown>
  if (!uuidSchema.safeParse(cookie.draftId).success) return false
  if (!Number.isInteger(cookie.browserGeneration) || Number(cookie.browserGeneration) < 1)
    return false
  if (typeof cookie.expiresAt !== "string" || Number.isNaN(Date.parse(cookie.expiresAt)))
    return false
  return Date.parse(cookie.expiresAt) > Date.now()
}

export function isValidPersonalPlanQuizResumeToken(value?: string | null) {
  return tokenSchema.safeParse(value).success
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")
  return origin === new URL(request.url).origin
}

export function noStoreHeaders() {
  return { "Cache-Control": "no-store, private", Vary: "Cookie" }
}

export function shouldExchangePersonalPlanQuizResumeToken(input: {
  snapshot: PersonalPlanQuizServerSnapshot | null
  resumeToken?: string | null
  storedTokenHash?: string | null
}) {
  if (!input.resumeToken) return false
  if (!input.snapshot || !input.storedTokenHash) return true
  return input.storedTokenHash !== hashPersonalPlanQuizResumeCredential(input.resumeToken)
}

async function readSnapshotState(cookieValue?: string): Promise<{
  snapshot: PersonalPlanQuizServerSnapshot
  storedTokenHash: string
} | null> {
  try {
    const cookie = decodePersonalPlanQuizDraftCookie(cookieValue)
    if (!cookie) return null
    const { data, error } = await createAdminClient().rpc("read_personal_plan_quiz_draft", {
      p_draft_id: cookie.draftId,
      p_browser_generation: cookie.browserGeneration,
    })
    if (error || !Array.isArray(data) || data.length !== 1) return null
    const row = data[0] as Record<string, unknown>
    const parsed = parsePersonalPlanQuizServerDraft({ version: 3, ...(row.draft as object) })
    if (
      !parsed ||
      typeof row.revision !== "number" ||
      typeof row.browser_generation !== "number" ||
      typeof row.resume_token_hash !== "string"
    )
      return null
    return {
      snapshot: {
        draftId: cookie.draftId,
        draft: parsed.draft,
        revision: row.revision,
        browserGeneration: row.browser_generation,
      },
      storedTokenHash: row.resume_token_hash,
    }
  } catch {
    return null
  }
}

/** Resolves recovery before the landing page can mount tracking providers. */
export async function resolvePersonalPlanQuizDraftLandingState(
  input: {
    cookieValue?: string
    resumeToken?: string | null
  },
  dependencies: { readSnapshotState?: typeof readSnapshotState } = {},
): Promise<{
  snapshot: PersonalPlanQuizServerSnapshot | null
  shouldExchange: boolean
}> {
  const state = await (dependencies.readSnapshotState ?? readSnapshotState)(
    input.cookieValue,
  ).catch(() => null)
  const snapshot = state?.snapshot ?? null
  return {
    snapshot,
    shouldExchange: shouldExchangePersonalPlanQuizResumeToken({
      snapshot,
      resumeToken: input.resumeToken,
      storedTokenHash: state?.storedTokenHash,
    }),
  }
}
