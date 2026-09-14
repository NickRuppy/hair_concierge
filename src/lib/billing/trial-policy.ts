export type TrialAccessFacts = {
  authorizationSucceededAt: string | null
  originalTrialEndAt: string | null
  firstPaymentSucceededAt: string | null
  paidThroughAt: string | null
  renewalGraceEndsAt: string | null
  renewalPaymentFailed: boolean
  cancelAtPeriodEnd: boolean
  accessRevoked: boolean
}

export type TrialAccessReason =
  | "authorization_pending"
  | "trial_active"
  | "first_payment_pending"
  | "trial_expired_without_payment"
  | "paid_active"
  | "paid_period_expired"
  | "renewal_grace_active"
  | "renewal_grace_expired"
  | "revoked"
  | "invalid_facts"

export type TrialAccess = {
  hasAccess: boolean
  phase: "awaiting_authorization" | "trial" | "paid" | "renewal_grace" | "locked"
  reason: TrialAccessReason
}

type ParsedFacts = {
  authorizationSucceededAt: number | null
  originalTrialEndAt: number | null
  firstPaymentSucceededAt: number | null
  paidThroughAt: number | null
  renewalGraceEndsAt: number | null
}

const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= daysInMonth[month - 1]
}

function parseIsoTimestamp(value: string | null): number | null | undefined {
  if (value === null) return null
  // Date.parse accepts date-only input and normalizes impossible calendar dates.
  // Persisted billing boundaries must be explicit, valid instants.
  const match = ISO_TIMESTAMP.exec(value)
  if (
    match === null ||
    !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  ) {
    return undefined
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function parseFacts(facts: TrialAccessFacts): ParsedFacts | null {
  const authorizationSucceededAt = parseIsoTimestamp(facts.authorizationSucceededAt)
  const originalTrialEndAt = parseIsoTimestamp(facts.originalTrialEndAt)
  const firstPaymentSucceededAt = parseIsoTimestamp(facts.firstPaymentSucceededAt)
  const paidThroughAt = parseIsoTimestamp(facts.paidThroughAt)
  const parsedRenewalGraceEndsAt = parseIsoTimestamp(facts.renewalGraceEndsAt)

  if (
    authorizationSucceededAt === undefined ||
    originalTrialEndAt === undefined ||
    firstPaymentSucceededAt === undefined ||
    paidThroughAt === undefined
  ) {
    return null
  }

  if (
    (authorizationSucceededAt === null) !== (originalTrialEndAt === null) ||
    (authorizationSucceededAt !== null && originalTrialEndAt! <= authorizationSucceededAt) ||
    (paidThroughAt !== null && firstPaymentSucceededAt === null) ||
    (firstPaymentSucceededAt !== null && paidThroughAt === null) ||
    (paidThroughAt !== null && paidThroughAt <= firstPaymentSucceededAt!)
  ) {
    return null
  }

  const renewalGraceEndsAt =
    facts.renewalPaymentFailed &&
    firstPaymentSucceededAt !== null &&
    paidThroughAt !== null &&
    parsedRenewalGraceEndsAt !== null &&
    parsedRenewalGraceEndsAt !== undefined &&
    parsedRenewalGraceEndsAt > paidThroughAt
      ? parsedRenewalGraceEndsAt
      : null

  return {
    authorizationSucceededAt,
    originalTrialEndAt,
    firstPaymentSucceededAt,
    paidThroughAt,
    renewalGraceEndsAt,
  }
}

export function resolveTrialAccess(facts: TrialAccessFacts, now: Date): TrialAccess {
  if (facts.accessRevoked) {
    return { hasAccess: false, phase: "locked", reason: "revoked" }
  }

  const nowAt = now.getTime()
  const parsed = parseFacts(facts)
  if (!Number.isFinite(nowAt) || parsed === null) {
    return { hasAccess: false, phase: "locked", reason: "invalid_facts" }
  }

  if (
    parsed.firstPaymentSucceededAt !== null &&
    parsed.firstPaymentSucceededAt <= nowAt &&
    parsed.paidThroughAt !== null &&
    parsed.paidThroughAt > nowAt
  ) {
    return { hasAccess: true, phase: "paid", reason: "paid_active" }
  }

  if (
    parsed.firstPaymentSucceededAt !== null &&
    parsed.firstPaymentSucceededAt <= nowAt &&
    facts.renewalPaymentFailed &&
    !facts.cancelAtPeriodEnd &&
    parsed.paidThroughAt !== null &&
    parsed.paidThroughAt <= nowAt &&
    parsed.renewalGraceEndsAt !== null
  ) {
    if (parsed.renewalGraceEndsAt > nowAt) {
      return { hasAccess: true, phase: "renewal_grace", reason: "renewal_grace_active" }
    }
    return { hasAccess: false, phase: "locked", reason: "renewal_grace_expired" }
  }

  if (parsed.authorizationSucceededAt !== null && parsed.originalTrialEndAt !== null) {
    if (parsed.authorizationSucceededAt > nowAt) {
      return { hasAccess: false, phase: "awaiting_authorization", reason: "authorization_pending" }
    }
    if (nowAt < parsed.originalTrialEndAt) {
      return { hasAccess: true, phase: "trial", reason: "trial_active" }
    }
    if (parsed.firstPaymentSucceededAt !== null && parsed.firstPaymentSucceededAt > nowAt) {
      return { hasAccess: false, phase: "locked", reason: "first_payment_pending" }
    }
    if (parsed.firstPaymentSucceededAt === null) {
      return { hasAccess: false, phase: "locked", reason: "trial_expired_without_payment" }
    }
  }

  if (parsed.firstPaymentSucceededAt !== null && parsed.firstPaymentSucceededAt > nowAt) {
    return { hasAccess: false, phase: "locked", reason: "first_payment_pending" }
  }

  if (parsed.firstPaymentSucceededAt === null) {
    return { hasAccess: false, phase: "awaiting_authorization", reason: "authorization_pending" }
  }

  return { hasAccess: false, phase: "locked", reason: "paid_period_expired" }
}
