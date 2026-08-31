import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export const MIGRATION_QUIZ_COOKIE = "chaarlie_personal_plan_migration_quiz"
export const MIGRATION_QUIZ_CONTEXT_COOKIE = MIGRATION_QUIZ_COOKIE
export const MIGRATION_QUIZ_HREF = "/quiz?mode=retake&returnTo=%2Fplan-bereit"
export const MIGRATION_QUIZ_CONTEXT_TTL_SECONDS = 2 * 60 * 60

const VERSION = 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MigrationQuizContext = {
  userId: string
  enrollmentId: string
  issuedAt: number
  expiresAt: number
}

export const migrationQuizCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MIGRATION_QUIZ_CONTEXT_TTL_SECONDS,
}

export const migrationQuizContextCookieOptions = migrationQuizCookieOptions
export const clearMigrationQuizContextCookieOptions = {
  ...migrationQuizCookieOptions,
  maxAge: 0,
}

export function issueMigrationQuizContext(input: { userId: string; enrollmentId: string }): string {
  const value = createMigrationQuizContextCookie(
    input,
    process.env.FUNNEL_COOKIE_SIGNING_SECRET,
    Date.now(),
  )
  if (!value) throw new Error("Migration quiz context could not be issued")
  return value
}

export function createMigrationQuizContextCookie(
  input: { userId: string; enrollmentId: string },
  secret: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!secret || !isUuid(input.userId) || !isUuid(input.enrollmentId)) return null
  const context: MigrationQuizContext = {
    userId: input.userId,
    enrollmentId: input.enrollmentId,
    issuedAt: now,
    expiresAt: now + MIGRATION_QUIZ_CONTEXT_TTL_SECONDS * 1000,
  }
  const payload = Buffer.from(JSON.stringify({ version: VERSION, payload: context })).toString(
    "base64url",
  )
  return `${payload}.${signPayload(payload, secret)}`
}

export function decodeMigrationQuizContextCookie(
  value: string | null | undefined,
  secret: string | null | undefined,
  options: { userId: string; now?: number },
): MigrationQuizContext | null {
  if (!value || !secret || !isUuid(options.userId)) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null
  const expected = signPayload(payload, secret)
  const receivedSignature = Buffer.from(signature)
  const expectedSignature = Buffer.from(expected)
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return null
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null
    const record = decoded as { version?: unknown; payload?: unknown }
    if (record.version !== VERSION || !isContext(record.payload)) return null
    const context = record.payload
    const now = options.now ?? Date.now()
    if (context.userId !== options.userId) return null
    if (context.issuedAt > now || context.expiresAt <= now) return null
    return context
  } catch {
    return null
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function isContext(value: unknown): value is MigrationQuizContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const context = value as Record<string, unknown>
  return (
    isUuid(context.userId) &&
    isUuid(context.enrollmentId) &&
    Number.isFinite(context.issuedAt) &&
    Number.isFinite(context.expiresAt) &&
    Number(context.expiresAt) > Number(context.issuedAt)
  )
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}
