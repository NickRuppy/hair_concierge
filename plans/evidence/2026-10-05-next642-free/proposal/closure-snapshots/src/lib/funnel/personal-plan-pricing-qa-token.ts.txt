import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

export const PERSONAL_PLAN_ONE_TIME_QA_TOKEN_PURPOSE = "personal_plan_one_time_qa" as const
const VERSION = 1
const MAX_TTL_SECONDS = 15 * 60
const CLOCK_SKEW_SECONDS = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PersonalPlanOneTimeQaTokenClaims = {
  v: number
  purpose: typeof PERSONAL_PLAN_ONE_TIME_QA_TOKEN_PURPOSE
  leadId: string
  sessionId: string
  packageKey: "meta_personal_plan_v1"
  arm: "personal-plan-one-time-v1"
  iat: number
  exp: number
  jti: string
}

export function createPersonalPlanOneTimeQaToken(
  input: Omit<PersonalPlanOneTimeQaTokenClaims, "v" | "purpose" | "iat" | "exp" | "jti"> & {
    secret: string
    now?: number
    ttlSeconds?: number
    jti?: string
  },
): string {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const ttlSeconds = input.ttlSeconds ?? 5 * 60
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS)
    throw new Error("QA token TTL must be between 1 and 900 seconds")
  const claims: PersonalPlanOneTimeQaTokenClaims = {
    v: VERSION,
    purpose: PERSONAL_PLAN_ONE_TIME_QA_TOKEN_PURPOSE,
    leadId: input.leadId,
    sessionId: input.sessionId,
    packageKey: input.packageKey,
    arm: input.arm,
    iat: now,
    exp: now + ttlSeconds,
    jti: input.jti ?? randomUUID(),
  }
  if (!isClaimsShapeValid(claims)) throw new Error("QA token claims are invalid")
  return sign(encode(claims), input.secret)
}

export function verifyPersonalPlanOneTimeQaToken(
  token: string | undefined,
  secret: string | undefined,
  now = Math.floor(Date.now() / 1000),
): PersonalPlanOneTimeQaTokenClaims | null {
  if (!token || !secret) return null
  const [encoded, signature, extra] = token.split(".")
  if (!encoded || !signature || extra) return null
  const expected = sign(encoded, secret).split(".")[1]
  if (!expected || !safeEqual(signature, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown
    if (!isClaimsShapeValid(claims)) return null
    if (claims.iat > now + CLOCK_SKEW_SECONDS || claims.exp < now - CLOCK_SKEW_SECONDS) return null
    if (claims.exp - claims.iat > MAX_TTL_SECONDS) return null
    return claims
  } catch {
    return null
  }
}

function sign(encoded: string, secret: string): string {
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`
}

function encode(value: PersonalPlanOneTimeQaTokenClaims): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function isClaimsShapeValid(value: unknown): value is PersonalPlanOneTimeQaTokenClaims {
  if (!value || typeof value !== "object") return false
  const claims = value as Record<string, unknown>
  return (
    claims.v === VERSION &&
    claims.purpose === PERSONAL_PLAN_ONE_TIME_QA_TOKEN_PURPOSE &&
    typeof claims.leadId === "string" &&
    UUID.test(claims.leadId) &&
    typeof claims.sessionId === "string" &&
    UUID.test(claims.sessionId) &&
    claims.packageKey === "meta_personal_plan_v1" &&
    claims.arm === "personal-plan-one-time-v1" &&
    Number.isInteger(claims.iat) &&
    Number.isInteger(claims.exp) &&
    typeof claims.jti === "string" &&
    UUID.test(claims.jti)
  )
}
