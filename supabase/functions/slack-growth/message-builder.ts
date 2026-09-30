const ADMIN_USERS_URL = "https://chaarlie.de/admin/users"
const MAX_SLACK_TEXT_LENGTH = 3_000

export type SlackGrowthEvent = {
  id: string
  event_name: string
  user_id: string
  provider: string
  occurred_at: string
  payload: Record<string, unknown>
}

export type SlackGrowthProfile = { full_name: string | null; email: string | null }
export type SlackGrowthMessage = { text: string; blocks: Array<Record<string, unknown>> }
type SlackGrowthEventKind = "trial_started" | "trial_converted" | "direct_purchase"
type SlackTextObject = { type: "plain_text"; text: string; emoji?: boolean }

export function classifySlackGrowthEvent(event: SlackGrowthEvent): SlackGrowthEventKind | null {
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
  )
    return "trial_started"
  if (event.event_name !== "purchase_completed" || !positiveNumber(payload.value)) return null
  if (payload.trial_analytics_version === 1)
    return payload.attempt_phase === "first_paid" ? "trial_converted" : null
  return payload.attempt_phase === "renewal" ? null : "direct_purchase"
}

export function formatSlackGrowthNotification(input: {
  event: SlackGrowthEvent
  profile: SlackGrowthProfile | null
}): SlackGrowthMessage | null {
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
  if (kind === "trial_started")
    fields.push(plainText(`Testende\n${berlinTime(payload.trial_end_at)}`))
  else fields.push(plainText(`Betrag\n${formatAmount(payload.value, payload.currency)}`))
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

function accountLabel(profile: SlackGrowthProfile | null, userId: string) {
  const name = sanitizeDisplay(profile?.full_name, 160)
  const email = sanitizeDisplay(profile?.email, 254)
  if (name && email) return `${name}\n${email}`
  if (email) return email
  if (name) return name
  return `Nicht verfügbar (ID: ${sanitizeDisplay(userId, 64) || "unbekannt"})`
}
function planLabel(value: unknown) {
  if (value === "month") return "Monatsabo"
  if (value === "quarter") return "Quartalsabo"
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
  return normalized ? boundText(normalized, length) : null
}
function boundText(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}…`
}
function escapeSlackFallback(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function isoTimestamp(value: unknown): string | null {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : null
}
function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}
