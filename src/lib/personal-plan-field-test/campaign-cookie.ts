import { createHmac, timingSafeEqual } from "node:crypto"

import {
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_SECONDS,
  PERSONAL_PLAN_FIELD_TEST_KIND,
} from "./constants"

const VERSION = 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type TrustedPersonalPlanFieldTestContext = {
  campaignId: string
  accessDurationHours: number
  testKind: typeof PERSONAL_PLAN_FIELD_TEST_KIND
}

export type PersonalPlanFieldTestCampaignCookie = TrustedPersonalPlanFieldTestContext & {
  issuedAt: number
  expiresAt: number
}

export const personalPlanFieldTestCampaignCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_TTL_SECONDS,
}

export function createPersonalPlanFieldTestCampaignCookie(
  value: Omit<PersonalPlanFieldTestCampaignCookie, "testKind">,
  secret: string,
): string | null {
  const context: PersonalPlanFieldTestCampaignCookie = {
    ...value,
    testKind: PERSONAL_PLAN_FIELD_TEST_KIND,
  }
  if (!secret || !isPersonalPlanFieldTestCampaignCookie(context)) return null
  const payload = Buffer.from(JSON.stringify({ version: VERSION, payload: context })).toString(
    "base64url",
  )
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function decodePersonalPlanFieldTestCampaignCookie(
  value: string | null | undefined,
  secret: string | null | undefined,
  now = Date.now(),
): PersonalPlanFieldTestCampaignCookie | null {
  if (!value || !secret) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null

  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  if (!safeEqual(signature, expected)) return null

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!isVersionedCookie(decoded)) return null
    const cookie = decoded.payload
    if (!isPersonalPlanFieldTestCampaignCookie(cookie)) return null
    if (cookie.issuedAt > now || cookie.expiresAt <= now) return null
    return cookie
  } catch {
    return null
  }
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function isVersionedCookie(value: unknown): value is { version: number; payload: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const parsed = value as Record<string, unknown>
  return parsed.version === VERSION && "payload" in parsed
}

function isPersonalPlanFieldTestCampaignCookie(
  value: unknown,
): value is PersonalPlanFieldTestCampaignCookie {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const context = value as Record<string, unknown>
  return (
    typeof context.campaignId === "string" &&
    UUID.test(context.campaignId) &&
    Number.isInteger(context.accessDurationHours) &&
    Number(context.accessDurationHours) > 0 &&
    context.testKind === PERSONAL_PLAN_FIELD_TEST_KIND &&
    Number.isFinite(context.issuedAt) &&
    Number.isFinite(context.expiresAt) &&
    Number(context.expiresAt) > Number(context.issuedAt)
  )
}

export { PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE }
