import type { BillingAnalyticsOutboxRow } from "@/lib/billing/types"
import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"

const ADMIN_USERS_URL = "https://chaarlie.de/admin/users"
const DEFAULT_TIMEOUT_MS = 5_000
const MAX_RETRY_AFTER_SECONDS = 60 * 60
const MAX_SLACK_TEXT_LENGTH = 3_000

type SlackGrowthEventKind = "trial_started" | "trial_converted" | "direct_purchase"
type SlackTextObject = { type: "plain_text"; text: string; emoji?: boolean }

export type SlackGrowthMessage = {
  text: string
  blocks: Array<Record<string, unknown>>
}

export type SlackDeliveryOptions = {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  timeoutMs?: number
}

export function isSlackGrowthEnabled(env: Record<string, string | undefined> = process.env) {
  return env.SLACK_GROWTH_ENABLED === "true" && env.VERCEL_ENV === "production"
}

export function classifySlackGrowthEvent(
  event: BillingAnalyticsOutboxRow,
): SlackGrowthEventKind | null {
  const payload = event.payload
  if (
    payload.is_internal_test === true ||
    payload.test_kind === "field_test" ||
    payload.test_kind === "partner"
  )
    return null
  if (
    event.event_name === "trial_started" &&
    payload.trial_analytics_version === 1 &&
    payload.value === 0 &&
    isoTimestamp(payload.trial_authorized_at)
  ) {
    return "trial_started"
  }
  if (event.event_name !== "purchase_completed" || !positiveNumber(payload.value)) return null
  if (payload.trial_analytics_version === 1)
    return payload.attempt_phase === "first_paid" ? "trial_converted" : null
  return payload.attempt_phase === "renewal" ? null : "direct_purchase"
}

export function formatSlackGrowthNotification(
  input: Pick<BillingAnalyticsDeliveryInput, "event" | "profile">,
): SlackGrowthMessage | null {
  const kind = classifySlackGrowthEvent(input.event)
  if (!kind) return null

  const title =
    kind === "trial_started"
      ? "🌱 Trial gestartet"
      : kind === "trial_converted"
        ? "🎉 Trial konvertiert"
        : "✨ Neukauf"
  const account = accountLabel(input.profile, input.event.user_id)
  const payload = input.event.payload
  const fields: SlackTextObject[] = [
    plainText(`Konto\n${account}`),
    plainText(`Tarif\n${planLabel(payload.interval)}`),
    plainText(`Anbieter\n${providerLabel(input.event.provider)}`),
    plainText(`Zeitpunkt\n${berlinTime(input.event.occurred_at)}`),
  ]
  if (kind === "trial_started") {
    fields.push(plainText(`Testende\n${berlinTime(payload.trial_end_at)}`))
  } else {
    fields.push(plainText(`Betrag\n${formatAmount(payload.value, payload.currency)}`))
  }

  const fallback = [
    title,
    account,
    planLabel(payload.interval),
    providerLabel(input.event.provider),
  ]
  if (kind === "trial_started") fallback.push(`Testende: ${berlinTime(payload.trial_end_at)}`)
  else fallback.push(`Betrag: ${formatAmount(payload.value, payload.currency)}`)

  return {
    text: fallback.map(escapeSlackFallback).join(" · "),
    blocks: [
      { type: "header", text: plainText(title) },
      { type: "section", fields },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: plainText("Nutzerverwaltung öffnen"),
            url: ADMIN_USERS_URL,
            action_id: "open_admin_users",
          },
        ],
      },
    ],
  }
}

export async function deliverBillingAnalyticsToSlack(
  input: BillingAnalyticsDeliveryInput,
  options: SlackDeliveryOptions = {},
): Promise<BillingAnalyticsDeliveryResult> {
  const env = options.env ?? process.env
  if (!isSlackGrowthEnabled(env)) {
    return { ok: false, paused: true, error: "slack_paused" }
  }

  const message = formatSlackGrowthNotification(input)
  if (!message)
    return { ok: false, skipped: true, permanent: true, error: "Invalid Slack growth event" }

  const activation = await readActivationState(input)
  if (!activation.ok) return activation.result
  const occurredAt = isoTimestamp(input.event.occurred_at)
  if (!occurredAt) {
    return { ok: false, skipped: true, permanent: true, error: "Invalid Slack event timestamp" }
  }
  if (Date.parse(occurredAt) < activation.enabledAt) {
    return { ok: false, skipped: true, permanent: true, error: "Slack event predates activation" }
  }

  const webhook = validWebhookUrl(env.SLACK_GROWTH_WEBHOOK_URL)
  if (!webhook)
    return { ok: false, permanent: true, error: "Slack webhook configuration is invalid" }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await (options.fetch ?? globalThis.fetch)(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, unfurl_links: false, unfurl_media: false }),
      redirect: "error",
      signal: controller.signal,
    })
    const body = await response.text().catch(() => "")
    if (response.status === 200 && body.trim() === "ok")
      return { ok: true, status: response.status }
    if (response.status === 429) {
      return {
        ok: false,
        status: response.status,
        retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
        error: "Slack rate limited the notification",
      }
    }
    if (response.status >= 500) {
      return { ok: false, status: response.status, error: "Slack is temporarily unavailable" }
    }
    if (response.status >= 400) {
      return {
        ok: false,
        status: response.status,
        permanent: true,
        error: "Slack rejected the notification",
      }
    }
    return {
      ok: false,
      status: response.status,
      error: "Slack did not confirm notification delivery",
    }
  } catch {
    return { ok: false, error: "Slack request failed" }
  } finally {
    clearTimeout(timeout)
  }
}

async function readActivationState(
  input: BillingAnalyticsDeliveryInput,
): Promise<
  { ok: true; enabledAt: number } | { ok: false; result: BillingAnalyticsDeliveryResult }
> {
  let data: unknown
  let error: unknown
  try {
    const response = await input.supabase.rpc("read_slack_growth_notification_state")
    data = response.data
    error = response.error
  } catch {
    return { ok: false, result: { ok: false, error: "Unable to confirm Slack notification state" } }
  }
  if (error)
    return { ok: false, result: { ok: false, error: "Unable to confirm Slack notification state" } }
  const state = Array.isArray(data) ? data[0] : data
  if (!state || typeof state !== "object") {
    return { ok: false, result: { ok: false, error: "Slack notification state is unavailable" } }
  }
  const record = state as Record<string, unknown>
  if (record.enabled !== true) {
    return { ok: false, result: { ok: false, paused: true, error: "slack_paused" } }
  }
  const enabledAt = isoTimestamp(record.enabled_at)
  if (!enabledAt) {
    return {
      ok: false,
      result: { ok: false, permanent: true, error: "Slack notification activation is invalid" },
    }
  }
  return { ok: true, enabledAt: Date.parse(enabledAt) }
}

function validWebhookUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      url.hostname !== "hooks.slack.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname)
    )
      return null
    return url.toString()
  } catch {
    return null
  }
}

function accountLabel(profile: BillingAnalyticsDeliveryInput["profile"], userId: string) {
  const name = sanitizeDisplay(profile?.full_name, 160)
  const email = sanitizeDisplay(profile?.email, 254)
  if (name && email) return `${name}\n${email}`
  if (email) return email
  if (name) return name
  return `Nicht verfügbar (ID: ${sanitizeDisplay(userId, 64) || "unbekannt"})`
}

function planLabel(value: unknown) {
  if (value === "month") return "Monatsabo"
  if (value === "year") return "Jahresabo"
  if (value === "one_time") return "Einmaliger Haarplan"
  return "Haarplan"
}

function providerLabel(value: string) {
  return value === "paypal" ? "PayPal" : "Stripe"
}

function formatAmount(value: unknown, currency: unknown) {
  if (!positiveNumber(value) || typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency))
    return "Nicht verfügbar"
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value)
  } catch {
    return "Nicht verfügbar"
  }
}

function berlinTime(value: unknown) {
  const timestamp = isoTimestamp(value)
  if (!timestamp) return "Nicht verfügbar"
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

function plainText(text: string): SlackTextObject {
  return { type: "plain_text", text: boundText(text, MAX_SLACK_TEXT_LENGTH), emoji: true }
}

function sanitizeDisplay(value: string | null | undefined, length: number) {
  const normalized = value
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return null
  return boundText(normalized, length)
}

function boundText(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}…`
}

function escapeSlackFallback(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function isoTimestamp(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return null
  return value
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function retryAfterSeconds(value: string | null) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(seconds)))
}
