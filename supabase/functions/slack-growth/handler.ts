import {
  formatSlackGrowthNotification,
  type SlackGrowthEvent,
  type SlackGrowthMessage,
  type SlackGrowthProfile,
} from "./message-builder.ts"

const MAX_BODY_BYTES = 1_024
const REQUEST_TIMEOUT_MS = 5_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WEBHOOK_PATH = /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/

export type SlackGrowthEnv = Record<
  | "SLACK_GROWTH_WEBHOOK_URL"
  | "SLACK_GROWTH_DISPATCH_TOKEN"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY",
  string | undefined
>
export type Rpc = (
  name: string,
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; data: unknown }>
export type HandlerDeps = { env: SlackGrowthEnv; fetch?: typeof fetch; rpc?: Rpc }

type Claim = { token: string; event: SlackGrowthEvent; profile: SlackGrowthProfile | null }
type Outcome = "delivered" | "retry" | "permanent" | "skipped" | "paused"

export function createSlackGrowthHandler(deps: HandlerDeps) {
  const requestFetch = deps.fetch ?? globalThis.fetch
  const rpc = deps.rpc ?? createRpc(deps.env, requestFetch)
  return async (request: Request): Promise<Response> => {
    const expected = deps.env.SLACK_GROWTH_DISPATCH_TOKEN
    if (
      !expected ||
      !constantWorkEqual(request.headers.get("x-slack-growth-token") ?? "", expected)
    )
      return json({ error: "unauthorized" }, 401)
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
    if (!configured(deps.env)) return json({ error: "configuration_unavailable" }, 500)
    const deliveryId = await parseDeliveryId(request)
    if (!deliveryId) return json({ error: "invalid_request" }, 400)
    const claimed = await rpc("claim_slack_growth_delivery", { p_delivery_id: deliveryId })
    if (!claimed.ok) return json({ error: "claim_unavailable" }, 502)
    if (claimed.data === null) return json({ status: "noop" }, 200)
    if (!isClaim(claimed.data)) return json({ error: "claim_unavailable" }, 502)
    const claim = claimed.data
    const checked = await rpc("check_slack_growth_claim", {
      p_delivery_id: deliveryId,
      p_token: claim.token,
    })
    if (!checked.ok) return json({ error: "claim_unavailable" }, 502)
    if (checked.data !== true)
      return complete(rpc, deliveryId, claim.token, "paused", "slack_paused")
    const message = formatSlackGrowthNotification({ event: claim.event, profile: claim.profile })
    if (!message)
      return complete(rpc, deliveryId, claim.token, "skipped", "slack_invalid_growth_event")
    const webhook = validWebhookUrl(deps.env.SLACK_GROWTH_WEBHOOK_URL)
    if (!webhook)
      return complete(
        rpc,
        deliveryId,
        claim.token,
        "permanent",
        "slack_webhook_configuration_invalid",
      )
    const result = await postSlack(requestFetch, webhook, message)
    return complete(
      rpc,
      deliveryId,
      claim.token,
      result.outcome,
      result.error,
      result.retryAfterSeconds,
    )
  }
}

async function complete(
  rpc: Rpc,
  deliveryId: string,
  token: string,
  outcome: Outcome,
  error?: string,
  retryAfterSeconds?: number,
) {
  const receipt = await rpc("complete_slack_growth_delivery", {
    p_delivery_id: deliveryId,
    p_token: token,
    p_outcome: outcome,
    ...(error ? { p_error: error } : {}),
    ...(retryAfterSeconds ? { p_retry_after_seconds: retryAfterSeconds } : {}),
  })
  if (!receipt.ok || receipt.data !== true) return json({ error: "receipt_unavailable" }, 502)
  return json({ status: outcome }, 200)
}

function configured(env: SlackGrowthEnv) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SLACK_GROWTH_WEBHOOK_URL)
}
async function parseDeliveryId(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) return null
  const raw = await readBoundedBody(request.body)
  if (raw === null) return null
  try {
    const body: unknown = JSON.parse(raw)
    if (!body || typeof body !== "object" || Array.isArray(body)) return null
    const deliveryId = (body as { delivery_id?: unknown }).delivery_id
    return typeof deliveryId === "string" && UUID.test(deliveryId) ? deliveryId : null
  } catch {
    return null
  }
}

async function readBoundedBody(body: ReadableStream<Uint8Array> | null) {
  if (!body) return null
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(next.value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(result)
}
function isClaim(value: unknown): value is Claim {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.token === "string" &&
    UUID.test(r.token) &&
    isEvent(r.event) &&
    (r.profile === null || isProfile(r.profile))
  )
}
function isEvent(value: unknown): value is SlackGrowthEvent {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === "string" &&
    typeof r.event_name === "string" &&
    typeof r.user_id === "string" &&
    typeof r.provider === "string" &&
    typeof r.occurred_at === "string" &&
    !!r.payload &&
    typeof r.payload === "object" &&
    !Array.isArray(r.payload)
  )
}
function isProfile(value: unknown): value is SlackGrowthProfile {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    (typeof r.full_name === "string" || r.full_name === null) &&
    (typeof r.email === "string" || r.email === null)
  )
}
function validWebhookUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      url.hostname === "hooks.slack.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      WEBHOOK_PATH.test(url.pathname)
      ? url.toString()
      : null
  } catch {
    return null
  }
}
async function postSlack(
  fetcher: typeof fetch,
  webhook: string,
  message: SlackGrowthMessage,
): Promise<{ outcome: Outcome; error?: string; retryAfterSeconds?: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetcher(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, unfurl_links: false, unfurl_media: false }),
      redirect: "error",
      signal: controller.signal,
    })
    const text = await response.text().catch(() => "")
    if (response.status === 200 && text.trim() === "ok") return { outcome: "delivered" }
    if (response.status === 429)
      return {
        outcome: "retry",
        error: "slack_rate_limited",
        retryAfterSeconds: retryAfter(response.headers.get("retry-after")),
      }
    if (response.status >= 500) return { outcome: "retry", error: "slack_temporarily_unavailable" }
    if (response.status >= 400)
      return { outcome: "permanent", error: "slack_rejected_notification" }
    return { outcome: "retry", error: "slack_delivery_failed" }
  } catch {
    return { outcome: "retry", error: "slack_delivery_failed" }
  } finally {
    clearTimeout(timer)
  }
}
function retryAfter(value: string | null) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(3600, Math.max(1, Math.ceil(seconds)))
    : undefined
}
function constantWorkEqual(actual: string, expected: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(actual)
  const b = encoder.encode(expected)
  let difference = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++)
    difference |= (a[i % (a.length || 1)] ?? 0) ^ (b[i % (b.length || 1)] ?? 0)
  return difference === 0
}
function json(body: Record<string, string>, status: number) {
  return Response.json(body, { status })
}
function createRpc(env: SlackGrowthEnv, fetcher: typeof fetch): Rpc {
  return async (name, body) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) return { ok: false, data: null }
      return { ok: true, data: await response.json() }
    } catch {
      return { ok: false, data: null }
    } finally {
      clearTimeout(timer)
    }
  }
}
