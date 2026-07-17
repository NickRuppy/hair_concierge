import { createHash } from "node:crypto"

const DEFAULT_META_CAPI_API_VERSION = "v24.0"
const DEFAULT_TIMEOUT_MS = 1_500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FBP_PATTERN = /^fb\.1\.\d{10,16}\.\d+$/
const FBC_PATTERN = /^fb\.1\.\d{10,16}\.[A-Za-z0-9._~-]+$/
const MAX_BROWSER_ID_LENGTH = 512

export type MetaConversionEventName = "Lead" | "ViewContent"

export type MetaRequestData = {
  clientIpAddress?: string
  clientUserAgent?: string
  fbp?: string
  fbc?: string
}

export type MetaConversionInput = {
  eventName: MetaConversionEventName
  eventId: string
  eventSourceUrl: string
  eventTime?: Date
  user: MetaRequestData & {
    email?: string | null
    name?: string | null
    externalId: string
  }
  customData?: Record<string, string | number | boolean>
}

export type MetaConversionDeliveryResult =
  | { ok: true; status: number; providerRequestId?: string }
  | { ok: false; skipped?: boolean; status?: number; error: string }

type MetaCapiEnvironment = Record<string, string | undefined>

export type MetaConversionDependencies = {
  enabled: boolean
  env?: MetaCapiEnvironment
  fetch?: typeof fetch
  timeoutMs?: number
}

function normalizedNameHashValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function hashNormalized(value: string | null | undefined, normalize: (source: string) => string) {
  if (typeof value !== "string") return undefined
  const normalized = normalize(value)
  return normalized ? sha256(normalized) : undefined
}

function normalizedNameParts(name: string | null | undefined) {
  if (typeof name !== "string") return { firstName: undefined, lastName: undefined }
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: undefined, lastName: undefined }
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  }
}

export function validFbp(value: string | null | undefined): string | undefined {
  if (!value || value.length > MAX_BROWSER_ID_LENGTH || !FBP_PATTERN.test(value)) return undefined
  return value
}

export function validFbc(value: string | null | undefined): string | undefined {
  if (!value || value.length > MAX_BROWSER_ID_LENGTH || !FBC_PATTERN.test(value)) return undefined
  return value
}

function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0) continue
    const key = part.slice(0, separator).trim()
    if (key !== name) continue
    const value = part.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return undefined
    }
  }

  return undefined
}

export function metaRequestData(request: Request): MetaRequestData {
  const clientIpAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const clientUserAgent = request.headers.get("user-agent")?.trim()
  const fbp = validFbp(requestCookie(request, "_fbp"))
  const fbc = validFbc(requestCookie(request, "_fbc"))

  return {
    ...(clientIpAddress ? { clientIpAddress } : {}),
    ...(clientUserAgent ? { clientUserAgent } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  }
}

export function resolveBrowserFunnelEventId(body: unknown) {
  const candidate =
    body &&
    typeof body === "object" &&
    "funnelEventId" in body &&
    typeof body.funnelEventId === "string" &&
    UUID_PATTERN.test(body.funnelEventId)
      ? body.funnelEventId
      : null

  return {
    browserEventId: candidate,
    funnelEventId: candidate ?? crypto.randomUUID(),
  }
}

export function isMetaLeadCapiEnabled(env: MetaCapiEnvironment = process.env) {
  return env.META_CAPI_LEAD_ENABLED === "true"
}

export function isMetaOfferViewCapiEnabled(env: MetaCapiEnvironment = process.env) {
  return env.META_CAPI_OFFER_VIEW_ENABLED === "true"
}

export function buildMetaConversionPayload(input: MetaConversionInput) {
  const { firstName, lastName } = normalizedNameParts(input.user.name)
  const email = hashNormalized(input.user.email, (value) => value.trim().toLowerCase())
  const firstNameHash = hashNormalized(firstName, normalizedNameHashValue)
  const lastNameHash = hashNormalized(lastName, normalizedNameHashValue)
  const externalId = hashNormalized(input.user.externalId, (value) => value.trim().toLowerCase())

  const userData = {
    ...(email ? { em: email } : {}),
    ...(firstNameHash ? { fn: firstNameHash } : {}),
    ...(lastNameHash ? { ln: lastNameHash } : {}),
    ...(externalId ? { external_id: externalId } : {}),
    ...(input.user.clientIpAddress ? { client_ip_address: input.user.clientIpAddress } : {}),
    ...(input.user.clientUserAgent ? { client_user_agent: input.user.clientUserAgent } : {}),
    ...(validFbp(input.user.fbp) ? { fbp: input.user.fbp } : {}),
    ...(validFbc(input.user.fbc) ? { fbc: input.user.fbc } : {}),
  }

  return {
    event_name: input.eventName,
    event_time: Math.floor((input.eventTime ?? new Date()).getTime() / 1_000),
    action_source: "website" as const,
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    user_data: userData,
    ...(input.customData ? { custom_data: input.customData } : {}),
  }
}

export async function deliverMetaConversion(
  input: MetaConversionInput,
  dependencies: MetaConversionDependencies,
): Promise<MetaConversionDeliveryResult> {
  if (!dependencies.enabled) return { ok: false, skipped: true, error: "disabled" }

  const env = dependencies.env ?? process.env
  const accessToken = env.META_CAPI_ACCESS_TOKEN
  const pixelId = env.META_PIXEL_ID ?? env.NEXT_PUBLIC_META_PIXEL_ID
  if (!accessToken) return { ok: false, skipped: true, error: "META_CAPI_ACCESS_TOKEN is not set" }
  if (!pixelId) return { ok: false, skipped: true, error: "META_PIXEL_ID is not set" }

  const body = {
    data: [buildMetaConversionPayload(input)],
    ...(env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: env.META_CAPI_TEST_EVENT_CODE } : {}),
  }
  const version = env.META_CAPI_API_VERSION ?? DEFAULT_META_CAPI_API_VERSION
  const url = new URL(`https://graph.facebook.com/${version}/${pixelId}/events`)
  url.searchParams.set("access_token", accessToken)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await (dependencies.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, status: response.status, error: "Meta CAPI request failed" }
    }

    return {
      ok: true,
      status: response.status,
      providerRequestId: response.headers.get("x-fb-trace-id") ?? undefined,
    }
  } catch {
    return { ok: false, error: "Meta CAPI request failed" }
  } finally {
    clearTimeout(timeout)
  }
}
