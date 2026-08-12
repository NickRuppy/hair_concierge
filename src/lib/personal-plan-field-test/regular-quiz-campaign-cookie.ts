import { createHmac, timingSafeEqual } from "node:crypto"

import {
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_SECONDS,
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
} from "./constants"

const VERSION = 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type RegularQuizFieldTestCampaignCookie = {
  campaignId: string
  accessDurationHours: number
  issuedAt: number
  expiresAt: number
}

export const regularQuizFieldTestCampaignCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_SECONDS,
}

export function createRegularQuizFieldTestCampaignCookie(
  value: RegularQuizFieldTestCampaignCookie,
  secret: string,
): string | null {
  if (!secret || !isCookie(value)) return null
  const payload = Buffer.from(JSON.stringify({ version: VERSION, payload: value })).toString(
    "base64url",
  )
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`
}

export function decodeRegularQuizFieldTestCampaignCookie(
  value: string | null | undefined,
  secret: string | null | undefined,
  now = Date.now(),
): RegularQuizFieldTestCampaignCookie | null {
  const payload = decodeSignedRegularQuizFieldTestCampaignCookie(value, secret)
  if (!payload || payload.issuedAt > now || payload.expiresAt <= now) return null
  return payload
}

export function decodeSignedRegularQuizFieldTestCampaignCookie(
  value: string | null | undefined,
  secret: string | null | undefined,
): RegularQuizFieldTestCampaignCookie | null {
  if (!value || !secret) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null
    const record = decoded as { version?: unknown; payload?: unknown }
    if (record.version !== VERSION || !isCookie(record.payload)) return null
    return record.payload
  } catch {
    return null
  }
}

function isCookie(value: unknown): value is RegularQuizFieldTestCampaignCookie {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const cookie = value as Record<string, unknown>
  return (
    typeof cookie.campaignId === "string" &&
    UUID.test(cookie.campaignId) &&
    Number.isInteger(cookie.accessDurationHours) &&
    Number(cookie.accessDurationHours) > 0 &&
    Number.isFinite(cookie.issuedAt) &&
    Number.isFinite(cookie.expiresAt) &&
    Number(cookie.expiresAt) > Number(cookie.issuedAt)
  )
}

export { REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE }
