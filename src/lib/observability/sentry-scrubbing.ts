interface SentryEventLike {
  breadcrumbs?: SentryBreadcrumbLike[]
  contexts?: Record<string, unknown>
  exception?: { values?: unknown[] }
  extra?: Record<string, unknown>
  logentry?: { message?: string; params?: unknown[] }
  message?: string
  request?: {
    cookies?: unknown
    data?: unknown
    headers?: Record<string, unknown>
    query_string?: unknown
    url?: string
  }
  spans?: SentrySpanLike[]
  transaction?: string
}

interface SentryBreadcrumbLike {
  data?: Record<string, unknown>
  message?: string
}

interface SentrySpanLike {
  data?: Record<string, unknown>
  description?: string
}

const CHECKOUT_SECRET_QUERY_KEYS = new Set([
  "resume_token",
  "session_id",
  "token",
  "client_secret",
  "email",
  "email_address",
  "receipt_email",
  "payer_email",
])
const CHECKOUT_SECRET_FIELD_KEYS = new Set([
  "resume_token",
  "session_id",
  "token",
  "stripe_session_id",
  "client_secret",
  "payment_intent_client_secret",
  "setup_intent_client_secret",
  "email",
  "email_address",
  "receipt_email",
  "payer_email",
  "payer_email_address",
  "clientsecret",
  "paymentintentclientsecret",
  "setupintentclientsecret",
  "emailaddress",
  "receiptemail",
  "payeremail",
  "payeremailaddress",
])
const REDACTED_VALUE = "[Filtered]"

export function scrubSentryEvent<Event extends SentryEventLike>(event: Event): Event {
  if (event.request) scrubSentryRequest(event.request)
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubSentryBreadcrumb)
  if (event.spans) event.spans = event.spans.map(scrubSentrySpan)
  if (event.contexts) event.contexts = scrubSentryValue(event.contexts) as Record<string, unknown>
  if (event.extra) event.extra = scrubSentryValue(event.extra) as Record<string, unknown>
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => scrubSentryValue(exception))
  }
  if (typeof event.message === "string") event.message = scrubCheckoutText(event.message)
  if (event.logentry) {
    if (typeof event.logentry.message === "string") {
      event.logentry.message = scrubCheckoutText(event.logentry.message)
    }
    if (event.logentry.params) {
      event.logentry.params = scrubSentryValue(event.logentry.params) as unknown[]
    }
  }
  if (typeof event.transaction === "string") event.transaction = scrubCheckoutUrl(event.transaction)
  return event
}

export function scrubSentryBreadcrumb<Breadcrumb extends SentryBreadcrumbLike>(
  breadcrumb: Breadcrumb,
): Breadcrumb {
  const scrubbed = { ...breadcrumb }
  if (typeof scrubbed.message === "string") scrubbed.message = scrubCheckoutText(scrubbed.message)
  if (scrubbed.data) scrubbed.data = scrubSentryValue(scrubbed.data) as Record<string, unknown>
  return scrubbed
}

function scrubSentryRequest(request: NonNullable<SentryEventLike["request"]>) {
  if (typeof request.url === "string") request.url = scrubCheckoutUrl(request.url)
  if (typeof request.query_string === "string") {
    request.query_string = scrubCheckoutQueryString(request.query_string)
  } else if (request.query_string && isPlainRecord(request.query_string)) {
    request.query_string = scrubSentryValue(request.query_string)
  }
  if (request.data) request.data = scrubSentryValue(request.data)
  if (request.headers) {
    const headers = { ...request.headers }
    for (const key of Object.keys(headers)) {
      const normalized = key.toLowerCase()
      if (normalized === "authorization" || normalized === "cookie") headers[key] = REDACTED_VALUE
    }
    request.headers = headers
  }
  delete request.cookies
}

function scrubSentrySpan<Span extends SentrySpanLike>(span: Span): Span {
  const scrubbed = { ...span }
  if (typeof scrubbed.description === "string") {
    scrubbed.description = scrubCheckoutText(scrubbed.description)
  }
  if (scrubbed.data) scrubbed.data = scrubSentryValue(scrubbed.data) as Record<string, unknown>
  return scrubbed
}

function scrubSentryValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return scrubCheckoutText(value)
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) return REDACTED_VALUE
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => scrubSentryValue(item, seen))
  if (!isPlainRecord(value)) return value

  const scrubbed: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    const compact = normalized.replace(/[-_]/g, "")
    if (
      CHECKOUT_SECRET_FIELD_KEYS.has(normalized) ||
      CHECKOUT_SECRET_FIELD_KEYS.has(compact) ||
      normalized === "authorization" ||
      normalized === "cookie" ||
      normalized === "cookies"
    ) {
      scrubbed[key] = REDACTED_VALUE
      continue
    }
    scrubbed[key] = scrubSentryValue(nestedValue, seen)
  }
  return scrubbed
}

function scrubCheckoutUrl(value: string): string {
  try {
    const url = new URL(value, "https://chaarlie.invalid")
    for (const key of CHECKOUT_SECRET_QUERY_KEYS) {
      if (url.searchParams.has(key)) url.searchParams.set(key, REDACTED_VALUE)
    }
    if (isLikelyRelativeUrl(value)) return `${url.pathname}${url.search}${url.hash}`
    return url.toString()
  } catch {
    return value
  }
}

function scrubCheckoutText(value: string): string {
  if (!hasCheckoutSecretQuery(value)) return value
  if (isLikelyUrl(value)) return scrubCheckoutUrl(value)
  return value.replace(/(?:https?:\/\/|\/)[^\s"'<>)]*/gi, (match) => scrubCheckoutUrl(match))
}

function scrubCheckoutQueryString(value: string): string {
  const params = new URLSearchParams(value.startsWith("?") ? value.slice(1) : value)
  let changed = false
  for (const key of CHECKOUT_SECRET_QUERY_KEYS) {
    if (params.has(key)) {
      params.set(key, REDACTED_VALUE)
      changed = true
    }
  }
  return changed ? params.toString() : value
}

function isLikelyRelativeUrl(value: string): boolean {
  return !/^[a-z][a-z\d+.-]*:/i.test(value)
}

function isLikelyUrl(value: string): boolean {
  return /^(?:https?:\/\/|\/|\?)/i.test(value)
}

function hasCheckoutSecretQuery(value: string): boolean {
  return /[?&](resume_token|session_id|token|client_secret|email|email_address|receipt_email|payer_email)=/i.test(
    value,
  )
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
