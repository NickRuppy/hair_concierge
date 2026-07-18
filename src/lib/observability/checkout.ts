import * as Sentry from "@sentry/nextjs"

type CheckoutProvider = "stripe" | "paypal"
type CheckoutInterval = "month" | "quarter" | "year"
type CheckoutSource = "pricing_page" | "quiz_result_offer" | "welcome"

type CheckoutStage =
  | "stripe_checkout_session_create"
  | "stripe_embedded_checkout_client_secret"
  | "stripe_embedded_checkout_load"
  | "paypal_create_subscription_intent"
  | "paypal_create_subscription"
  | "paypal_approve_subscription"
  | "paypal_activation_status_poll"
  | "paypal_webhook_ingestion"
  | "checkout_return"
  | "checkout_password_activation"
  | "checkout_magic_link_activation"

type BreadcrumbLevel = "debug" | "info" | "warning" | "error"
type RateLimitSource = "app" | "supabase_auth"

export interface CheckoutSentryDetails {
  provider: CheckoutProvider
  stage: CheckoutStage
  source?: CheckoutSource
  interval?: CheckoutInterval
  leadId?: string | null
  stripeSessionId?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  paypalSubscriptionId?: string | null
  paypalEventId?: string | null
  paypalEventType?: string | null
  paypalTokenPresent?: boolean
  status?: number | string
  reason?: string | null
  rateLimitSource?: RateLimitSource
}

export interface CheckoutSentryPayload {
  tags: Record<string, string>
  context: Record<string, unknown>
}

interface SentryEventLike {
  breadcrumbs?: SentryBreadcrumbLike[]
  contexts?: Record<string, unknown>
  exception?: {
    values?: unknown[]
  }
  extra?: Record<string, unknown>
  logentry?: {
    message?: string
    params?: unknown[]
  }
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

interface CheckoutScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setLevel?(level: BreadcrumbLevel): void
  setTag(key: string, value: string): void
}

interface CheckoutSentrySink {
  addBreadcrumb(breadcrumb: {
    category: string
    data: Record<string, unknown>
    level: BreadcrumbLevel
    message: string
  }): void
  captureException(error: unknown): void
  withScope(callback: (scope: CheckoutScopeLike) => void): void
}

const CHECKOUT_SECRET_QUERY_KEYS = new Set(["session_id", "token"])
const CHECKOUT_SECRET_FIELD_KEYS = new Set(["session_id", "token", "stripe_session_id"])
const REDACTED_VALUE = "[Filtered]"

export function buildCheckoutSentryPayload(details: CheckoutSentryDetails): CheckoutSentryPayload {
  const context: Record<string, unknown> = {
    provider: details.provider,
    stage: details.stage,
  }
  const tags: Record<string, string> = {
    "checkout.provider": details.provider,
    "checkout.stage": details.stage,
  }

  addOptional(context, "source", details.source)
  addOptional(context, "interval", details.interval)
  addOptional(context, "lead_id", details.leadId)
  addOptional(context, "stripe_session_id", details.stripeSessionId ? REDACTED_VALUE : null)
  addOptional(context, "stripe_customer_id", details.stripeCustomerId)
  addOptional(context, "stripe_subscription_id", details.stripeSubscriptionId)
  addOptional(context, "paypal_subscription_id", details.paypalSubscriptionId)
  addOptional(context, "paypal_event_id", details.paypalEventId)
  addOptional(context, "paypal_event_type", details.paypalEventType)
  addOptional(context, "paypal_token_present", details.paypalTokenPresent)
  addOptional(context, "status", details.status)
  addOptional(context, "reason", details.reason)
  addOptional(context, "rate_limit_source", details.rateLimitSource)

  addTag(tags, "checkout.source", details.source)
  addTag(tags, "checkout.interval", details.interval)
  addTag(tags, "checkout.status", details.status)
  addTag(tags, "checkout.reason", details.reason)
  addTag(tags, "checkout.rate_limit_source", details.rateLimitSource)

  return { tags, context }
}

export function getCheckoutRateLimitReason(
  error: unknown,
): "supabase_auth_email_rate_limit" | null {
  const combined = `${getErrorText(error, "message")} ${getErrorText(error, "msg")} ${getErrorText(
    error,
    "error_code",
  )} ${getErrorText(error, "code")}`.toLowerCase()

  const status = getErrorNumber(error, "status")
  if (
    status === 429 ||
    combined.includes("over_email_send_rate_limit") ||
    combined.includes("email rate limit") ||
    combined.includes("email send rate")
  ) {
    return "supabase_auth_email_rate_limit"
  }

  return null
}

export function addCheckoutBreadcrumb(
  details: CheckoutSentryDetails,
  level: BreadcrumbLevel = "info",
  sink: CheckoutSentrySink = Sentry,
) {
  const payload = buildCheckoutSentryPayload(details)
  sink.addBreadcrumb({
    category: "checkout",
    data: payload.context,
    level,
    message: `checkout.${details.stage}`,
  })
}

export function captureCheckoutException(
  error: unknown,
  details: CheckoutSentryDetails,
  sink: CheckoutSentrySink = Sentry,
) {
  const payload = buildCheckoutSentryPayload(details)
  sink.withScope((scope) => {
    for (const [key, value] of Object.entries(payload.tags)) {
      scope.setTag(key, value)
    }
    scope.setContext("checkout", payload.context)
    scope.setLevel?.("error")
    sink.captureException(error)
  })
}

export function scrubSentryEvent<Event extends SentryEventLike>(event: Event): Event {
  if (event.request) {
    scrubSentryRequest(event.request)
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubSentryBreadcrumb)
  }

  if (event.spans) {
    event.spans = event.spans.map(scrubSentrySpan)
  }

  if (event.contexts) {
    event.contexts = scrubSentryValue(event.contexts) as Record<string, unknown>
  }

  if (event.extra) {
    event.extra = scrubSentryValue(event.extra) as Record<string, unknown>
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => scrubSentryValue(exception))
  }

  if (typeof event.message === "string") {
    event.message = scrubCheckoutText(event.message)
  }

  if (event.logentry) {
    if (typeof event.logentry.message === "string") {
      event.logentry.message = scrubCheckoutText(event.logentry.message)
    }
    if (event.logentry.params) {
      event.logentry.params = scrubSentryValue(event.logentry.params) as unknown[]
    }
  }

  if (typeof event.transaction === "string") {
    event.transaction = scrubCheckoutUrl(event.transaction)
  }

  return event
}

export function scrubSentryBreadcrumb<Breadcrumb extends SentryBreadcrumbLike>(
  breadcrumb: Breadcrumb,
): Breadcrumb {
  const scrubbed = { ...breadcrumb }
  if (typeof scrubbed.message === "string") {
    scrubbed.message = scrubCheckoutText(scrubbed.message)
  }
  if (scrubbed.data) {
    scrubbed.data = scrubSentryValue(scrubbed.data) as Record<string, unknown>
  }
  return scrubbed
}

function scrubSentryRequest(request: NonNullable<SentryEventLike["request"]>) {
  if (typeof request.url === "string") {
    request.url = scrubCheckoutUrl(request.url)
  }

  if (typeof request.query_string === "string") {
    request.query_string = scrubCheckoutQueryString(request.query_string)
  } else if (request.query_string && isPlainRecord(request.query_string)) {
    request.query_string = scrubSentryValue(request.query_string)
  }

  if (request.data) {
    request.data = scrubSentryValue(request.data)
  }

  if (request.headers) {
    const headers = { ...request.headers }
    for (const key of Object.keys(headers)) {
      const normalized = key.toLowerCase()
      if (normalized === "authorization" || normalized === "cookie") {
        headers[key] = REDACTED_VALUE
      }
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
  if (scrubbed.data) {
    scrubbed.data = scrubSentryValue(scrubbed.data) as Record<string, unknown>
  }
  return scrubbed
}

function scrubSentryValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return scrubCheckoutText(value)
  }

  if (typeof value !== "object" || value === null) {
    return value
  }

  if (seen.has(value)) {
    return REDACTED_VALUE
  }
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => scrubSentryValue(item, seen))
  }

  if (!isPlainRecord(value)) {
    return value
  }

  const scrubbed: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    if (CHECKOUT_SECRET_FIELD_KEYS.has(normalized)) {
      scrubbed[key] = REDACTED_VALUE
      continue
    }
    if (normalized === "authorization" || normalized === "cookie" || normalized === "cookies") {
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
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, REDACTED_VALUE)
      }
    }
    if (isLikelyRelativeUrl(value)) {
      return `${url.pathname}${url.search}${url.hash}`
    }
    return url.toString()
  } catch {
    return value
  }
}

function scrubCheckoutText(value: string): string {
  if (!hasCheckoutSecretQuery(value)) {
    return value
  }

  if (isLikelyUrl(value)) {
    return scrubCheckoutUrl(value)
  }

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
  return /[?&](session_id|token)=/i.test(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function addOptional(
  target: Record<string, unknown>,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined || value === "") return
  target[key] = value
}

function addTag(
  target: Record<string, string>,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") return
  target[key] = String(value)
}

function getErrorText(error: unknown, key: string): string {
  if (typeof error !== "object" || error === null || !(key in error)) return ""
  const value = (error as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function getErrorNumber(error: unknown, key: string): number | null {
  if (typeof error !== "object" || error === null || !(key in error)) return null
  const value = (error as Record<string, unknown>)[key]
  return typeof value === "number" ? value : null
}
