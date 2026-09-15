import type { BillingAnalyticsOutboxRow } from "@/lib/billing/types"

export type OpenAIEventContext = {
  sourceUrl: string
  canonicalOrigin: string
  oppref?: string
  obref?: string
  personalizationOptOut: boolean
}

export type OpenAIConversionEvent = {
  id: string
  type: "trial_started" | "order_created"
  timestamp_ms: number
  source_url: string
  action_source: "web"
  opt_out: boolean
  oppref?: string
  user?: { obref: string }
  data: { type: "plan_enrollment" } | { type: "contents"; amount: number; currency: string }
}

const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FUTURE_EVENT_MS = 10 * 60 * 1000
const ISO_CURRENCIES = new Set(Intl.supportedValuesOf("currency"))

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null
}

function eventTimestamp(value: string, nowMs: number) {
  const timestampMs = Date.parse(value)
  if (!Number.isSafeInteger(timestampMs) || !Number.isSafeInteger(nowMs)) return null
  if (timestampMs < nowMs - MAX_EVENT_AGE_MS || timestampMs > nowMs + MAX_FUTURE_EVENT_MS) {
    return null
  }
  return timestampMs
}

function canonicalSourceUrl(context: OpenAIEventContext) {
  try {
    const canonical = new URL(context.canonicalOrigin)
    const source = new URL(context.sourceUrl)
    if (
      !["http:", "https:"].includes(canonical.protocol) ||
      canonical.username ||
      canonical.password ||
      canonical.pathname !== "/" ||
      canonical.search ||
      canonical.hash ||
      source.origin !== canonical.origin ||
      source.username ||
      source.password
    ) {
      return null
    }

    const path = source.pathname
    if (
      path !== "/" &&
      path !== "/welcome" &&
      path !== "/result" &&
      path !== "/quiz/result" &&
      !/^\/lp\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/i.test(path)
    ) {
      return null
    }
    return `${canonical.origin}${path}`
  } catch {
    return null
  }
}

function currencyCode(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) return null
  const currency = value.toUpperCase()
  return ISO_CURRENCIES.has(currency) ? currency : null
}

function amountMinor(payload: Record<string, unknown>, currency: string) {
  const explicit = payload.amount_minor
  if (explicit !== undefined || Object.hasOwn(payload, "amount_minor")) {
    return typeof explicit === "number" && Number.isSafeInteger(explicit) && explicit > 0
      ? explicit
      : null
  }

  const value = payload.value
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  const fractionDigits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? -1
  // Existing billing producers divide fallback value by 100; other currencies need amount_minor.
  if (fractionDigits !== 2) return null
  const scaled = value * 10 ** fractionDigits
  const rounded = Math.round(scaled)
  if (!Number.isSafeInteger(rounded) || rounded <= 0 || Math.abs(scaled - rounded) > 1e-7) {
    return null
  }
  return rounded
}

function isExcluded(payload: Record<string, unknown>) {
  return (
    payload.is_internal_test === true ||
    payload.test_kind === "field_test" ||
    payload.test_kind === "partner"
  )
}

export function buildOpenAIConversionEvent(
  event: BillingAnalyticsOutboxRow,
  context: OpenAIEventContext,
  nowMs: number,
): OpenAIConversionEvent | null {
  if (!stringValue(event.event_key) || isExcluded(event.payload)) return null
  const timestamp_ms = eventTimestamp(event.occurred_at, nowMs)
  const source_url = canonicalSourceUrl(context)
  if (
    timestamp_ms === null ||
    source_url === null ||
    typeof context.personalizationOptOut !== "boolean"
  ) {
    return null
  }

  const oppref = stringValue(context.oppref)
  const obref = stringValue(context.obref)
  const attribution = {
    ...(oppref ? { oppref } : {}),
    ...(obref ? { user: { obref } } : {}),
  }
  const common = {
    id: event.event_key,
    timestamp_ms,
    source_url,
    action_source: "web" as const,
    opt_out: context.personalizationOptOut,
    ...attribution,
  }

  if (event.event_name === "trial_started") {
    if (
      event.payload.trial_analytics_version !== 1 ||
      event.payload.value !== 0 ||
      !stringValue(event.payload.trial_authorized_at) ||
      Number.isNaN(Date.parse(event.payload.trial_authorized_at as string))
    ) {
      return null
    }
    return { ...common, type: "trial_started", data: { type: "plan_enrollment" } }
  }

  if (
    event.event_name !== "purchase_completed" ||
    event.payload.attempt_phase === "renewal" ||
    (event.payload.trial_analytics_version === 1 && event.payload.attempt_phase !== "first_paid")
  ) {
    return null
  }
  const currency = currencyCode(event.payload.currency)
  if (!currency) return null
  const amount = amountMinor(event.payload, currency)
  if (amount === null) return null

  return { ...common, type: "order_created", data: { type: "contents", amount, currency } }
}
