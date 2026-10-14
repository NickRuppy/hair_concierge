import { getFunnelPackageByKey } from "./packages"

export const FUNNEL_SESSION_COOKIE = "chaarlie_funnel_session"
export const FUNNEL_TOUCH_COOKIE = "chaarlie_funnel_touch"

const SESSION_VERSION = 1
const TOUCH_VERSION = 1
const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
const TOUCH_MAX_AGE_SECONDS = 15 * 60
const encoder = new TextEncoder()

export type FunnelCookieContext = {
  visitorId: string
  sessionId: string
  packageKey: string
  issuedAt: number
}

export type FunnelTouch = {
  visitorId: string
  sessionId: string
  capturedAt: number
  entryPath: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  referrer?: string
}

type Versioned<T> = { version: number; payload: T }

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function base64UrlDecode(value: string) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sign(encodedPayload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return base64UrlEncode(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload))),
  )
}

async function verify(encodedPayload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(encodedPayload),
  )
}

async function encodeSigned<T>(value: Versioned<T>, secret: string) {
  const encoded = base64UrlEncode(encoder.encode(JSON.stringify(value)))
  return `${encoded}.${await sign(encoded, secret)}`
}

async function decodeSigned<T>(value: string, secret: string): Promise<Versioned<T> | null> {
  try {
    const [encoded, signature, extra] = value.split(".")
    if (!encoded || !signature || extra || !(await verify(encoded, signature, secret))) return null
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as Versioned<T>
  } catch {
    return null
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

export async function encodeFunnelContext(context: FunnelCookieContext, secret: string) {
  return encodeSigned({ version: SESSION_VERSION, payload: context }, secret)
}

export async function decodeFunnelContext(value: string, secret: string, now = Date.now()) {
  const decoded = await decodeSigned<FunnelCookieContext>(value, secret)
  if (!decoded || decoded.version !== SESSION_VERSION) return null
  const context = decoded.payload
  if (
    !isUuid(context.visitorId) ||
    !isUuid(context.sessionId) ||
    !getFunnelPackageByKey(context.packageKey)
  )
    return null
  if (
    !Number.isFinite(context.issuedAt) ||
    context.issuedAt > now ||
    now - context.issuedAt > SESSION_MAX_AGE_SECONDS * 1000
  )
    return null
  return context
}

export async function encodeFunnelTouch(touch: FunnelTouch, secret: string) {
  return encodeSigned({ version: TOUCH_VERSION, payload: touch }, secret)
}

export async function decodeFunnelTouch(value: string, secret: string, now = Date.now()) {
  const decoded = await decodeSigned<FunnelTouch>(value, secret)
  if (!decoded || decoded.version !== TOUCH_VERSION) return null
  const touch = decoded.payload
  if (!isUuid(touch.visitorId) || !isUuid(touch.sessionId)) return null
  if (
    !Number.isFinite(touch.capturedAt) ||
    touch.capturedAt > now ||
    now - touch.capturedAt > TOUCH_MAX_AGE_SECONDS * 1000
  )
    return null
  return touch
}

export const funnelSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
}

export const funnelTouchCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TOUCH_MAX_AGE_SECONDS,
}

export function shouldReplacePendingTouch(
  pathname: string,
  sessionId: string,
  existingTouch: FunnelTouch | null,
) {
  const explicitEntry = pathname === "/" || pathname.startsWith("/lp/")
  return explicitEntry || existingTouch?.sessionId !== sessionId
}
