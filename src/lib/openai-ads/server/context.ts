import "server-only"
import { randomUUID } from "node:crypto"
import type { BillingAnalyticsOutboxRow, SupabaseBillingAnalyticsClient } from "@/lib/billing/types"
import type { OpenAIEventContext } from "../event-payload"
import { decodeFunnelContext, FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import {
  decodeOpenAIConsentCookie,
  encodeOpenAIConsentCookie,
  OPENAI_CONSENT_COOKIE,
  OPENAI_CONSENT_MAX_AGE_MS,
  UUID_PATTERN,
} from "./consent-cookie"

export type OpenAIConsentState = { revision: number; marketing: boolean; expiresAt: string | null }
const denied: OpenAIConsentState = { revision: 0, marketing: false, expiresAt: null }
const canonicalOrigin = "https://chaarlie.de"
export function sanitizeOpenAISourceUrl(value: unknown): string | null {
  try {
    if (typeof value !== "string" || value.length > 2048) return null
    const url = new URL(value)
    if (url.origin !== canonicalOrigin || url.username || url.password) return null
    if (
      !["/", "/result", "/welcome", "/quiz/result"].includes(url.pathname) &&
      !/^\/lp\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/i.test(url.pathname)
    )
      return null
    return `${canonicalOrigin}${url.pathname}`
  } catch {
    return null
  }
}
/** Cookie values are opaque. Never URL-decode references or forward unrelated cookies. */
export function rawOpenAICookie(header: string | null, name: string): string | undefined {
  const matches = (header ?? "")
    .split(";")
    .map((part) => part.trimStart())
    .filter((part) => part.startsWith(`${name}=`))
  if (matches.length !== 1) return undefined
  const value = matches[0].slice(name.length + 1)
  if (!value || Buffer.byteLength(value) > 2048 || /[^\x21-\x7e]/.test(value)) return undefined
  return value
}
export async function resolveOpenAIContext(
  supabase: SupabaseBillingAnalyticsClient,
  event: BillingAnalyticsOutboxRow,
): Promise<OpenAIEventContext | null> {
  const sessionId = event.payload.funnel_session_id
  if (
    typeof sessionId !== "string" ||
    !UUID_PATTERN.test(sessionId) ||
    !Number.isFinite(Date.parse(event.occurred_at))
  )
    return null
  const { data, error } = await supabase.rpc("read_openai_ads_event_context", {
    p_session_id: sessionId,
    p_occurred_at: event.occurred_at,
  })
  if (error) throw new Error("OpenAI consent context unavailable")
  if (!data) return null
  const sourceUrl = sanitizeOpenAISourceUrl(data.sourceUrl)
  if (!sourceUrl) return null
  return {
    sourceUrl,
    canonicalOrigin,
    personalizationOptOut: true,
    ...(typeof data.oppref === "string" ? { oppref: data.oppref } : {}),
    ...(typeof data.obref === "string" ? { obref: data.obref } : {}),
  }
}
export async function cleanupOpenAIAdsContext(
  supabase: SupabaseBillingAnalyticsClient,
): Promise<number> {
  const { data, error } = await supabase.rpc("cleanup_openai_ads_context")
  if (error) throw new Error("OpenAI context cleanup unavailable")
  return typeof data === "number" ? data : 0
}
type Dependencies = {
  supabase: () => SupabaseBillingAnalyticsClient
  env?: Record<string, string | undefined>
  now?: () => number
}
function json(body: unknown, status = 200, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Cookie",
  }
  if (cookie) headers["Set-Cookie"] = cookie
  return new Response(JSON.stringify(body), { status, headers })
}
function state(data: Record<string, unknown>): OpenAIConsentState {
  if (
    !Number.isSafeInteger(data.revision) ||
    Number(data.revision) < 0 ||
    typeof data.marketing !== "boolean" ||
    typeof data.expiresAt !== "string"
  )
    throw new Error("Invalid consent state")
  return { revision: Number(data.revision), marketing: data.marketing, expiresAt: data.expiresAt }
}
async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error("Invalid body")
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) {
        await reader.cancel()
        throw new RangeError("Body too large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
export async function handleOpenAIContextRequest(
  request: Request,
  dependencies: Dependencies,
): Promise<Response> {
  const env = dependencies.env ?? process.env
  const now = (dependencies.now ?? Date.now)()
  if (env.OPENAI_ADS_ENABLED !== "true") return json(denied)
  const secret = env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret) return json({ error: "unavailable" }, 503)
  const isPost = request.method === "POST"
  if (request.method !== "GET" && !isPost) return json({ error: "method" }, 405)
  if (isPost && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "origin" }, 403)
  if (
    isPost &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    return json({ error: "content_type" }, 415)
  let body:
    | {
        action: "choice" | "context"
        requestId: string
        expectedRevision: number
        marketing?: boolean
        sourceUrl?: string
      }
    | undefined
  if (isPost) {
    try {
      const input = await readBody(request)
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (key) =>
            !["action", "requestId", "expectedRevision", "marketing", "sourceUrl"].includes(key),
        ) ||
        !["choice", "context"].includes(input.action) ||
        typeof input.requestId !== "string" ||
        !UUID_PATTERN.test(input.requestId) ||
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 0 ||
        (input.action === "choice"
          ? typeof input.marketing !== "boolean"
          : input.marketing !== undefined) ||
        (input.sourceUrl !== undefined && !sanitizeOpenAISourceUrl(input.sourceUrl))
      )
        return json({ error: "body" }, 400)
      body = input
    } catch (error) {
      return json({ error: "body" }, error instanceof RangeError ? 413 : 400)
    }
  }
  try {
    const cookieHeader = request.headers.get("cookie")
    const existing = decodeOpenAIConsentCookie(
      rawOpenAICookie(cookieHeader, OPENAI_CONSENT_COOKIE),
      secret,
      now,
    )
    const identity = existing ?? { id: randomUUID(), issuedAt: now }
    const expiry = new Date(identity.issuedAt + OPENAI_CONSENT_MAX_AGE_MS).toISOString()
    const setCookie = existing
      ? undefined
      : `${OPENAI_CONSENT_COOKIE}=${encodeOpenAIConsentCookie(identity, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OPENAI_CONSENT_MAX_AGE_MS / 1000}${env.NODE_ENV === "production" ? "; Secure" : ""}`
    const supabase = dependencies.supabase()
    const get = await supabase.rpc("manage_openai_ads_context", {
      p_consent_id: identity.id,
      p_expires_at: expiry,
      p_action: "get",
    })
    if (get.error || !get.data) throw new Error("unavailable")
    const current = state(get.data)
    if (!body || !existing) return json(current, body ? 409 : 200, setCookie)
    // Only a deliberate grant or currently granted context may read measurement references.
    const permitted =
      body.action === "choice"
        ? body.marketing === true
        : current.marketing && current.revision === body.expectedRevision
    const funnel = permitted
      ? await decodeFunnelContext(
          rawOpenAICookie(cookieHeader, FUNNEL_SESSION_COOKIE) ?? "",
          secret,
          now,
        )
      : null
    const result = await supabase.rpc("manage_openai_ads_context", {
      p_consent_id: identity.id,
      p_expires_at: expiry,
      p_action: body.action,
      p_request_id: body.requestId,
      p_expected_revision: body.expectedRevision,
      p_marketing: body.marketing ?? null,
      p_session_id: funnel?.sessionId ?? null,
      p_visitor_id: funnel?.visitorId ?? null,
      p_source_url: permitted ? sanitizeOpenAISourceUrl(body.sourceUrl) : null,
      p_oppref: permitted ? (rawOpenAICookie(cookieHeader, "__oppref") ?? null) : null,
      p_obref: permitted ? (rawOpenAICookie(cookieHeader, "__obref") ?? null) : null,
    })
    if (result.error || !result.data) throw new Error("unavailable")
    return json(state(result.data), result.data.conflict ? 409 : 200, setCookie)
  } catch {
    return json({ error: "unavailable" }, 503)
  }
}
