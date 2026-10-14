import { createHmac, timingSafeEqual } from "node:crypto"

export {
  QUIZ_EMAIL_RETURN_COOKIE,
  QUIZ_EMAIL_RETURN_EDIT_COOKIE,
  QUIZ_EMAIL_RETURN_PACKAGE_KEY,
} from "./email-return-constants"
const CONTEXT_VERSION = 1
const CONTEXT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReturnContext = { version: number; linkId: string; issuedAt: number }

export function encodeQuizEmailReturnContext(linkId: string, secret: string, now = Date.now()) {
  if (!uuidPattern.test(linkId) || !secret) throw new Error("Invalid return context")
  const payload = Buffer.from(
    JSON.stringify({ version: CONTEXT_VERSION, linkId, issuedAt: now } satisfies ReturnContext),
  ).toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function decodeQuizEmailReturnContext(
  cookieValue: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): { linkId: string } | null {
  if (!cookieValue || !secret) return null
  const [payload, signature, extra] = cookieValue.split(".")
  if (!payload || !signature || extra || payload.length > 256) return null
  const expected = createHmac("sha256", secret).update(payload).digest()
  let supplied: Buffer
  try {
    supplied = Buffer.from(signature, "base64url")
  } catch {
    return null
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ReturnContext
    if (
      parsed.version !== CONTEXT_VERSION ||
      !uuidPattern.test(parsed.linkId) ||
      !Number.isFinite(parsed.issuedAt) ||
      parsed.issuedAt > now ||
      now - parsed.issuedAt > CONTEXT_MAX_AGE_MS
    )
      return null
    return { linkId: parsed.linkId }
  } catch {
    return null
  }
}

export const quizEmailReturnCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CONTEXT_MAX_AGE_MS / 1000,
}
