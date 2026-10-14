import { resolveTrialAccess, type TrialAccess, type TrialAccessFacts } from "./trial-policy"

export type BillingTrialAccessRow = {
  trial_enrollment_id?: string | null
  trial_access_facts?: unknown
  metadata?: Record<string, unknown> | null
}

type TrialAdmissionStatus = "reserved" | "active" | "blocked" | "released"

type TrialAccessProjection = TrialAccessFacts & {
  version: 1
  enrollmentId: string
  admissionStatus: TrialAdmissionStatus
}

const INVALID_FACTS: TrialAccess = {
  hasAccess: false,
  phase: "locked",
  reason: "invalid_facts",
}

const AWAITING_AUTHORIZATION: TrialAccess = {
  hasAccess: false,
  phase: "awaiting_authorization",
  reason: "authorization_pending",
}

const NULLABLE_TIMESTAMPS = [
  "authorizationSucceededAt",
  "originalTrialEndAt",
  "firstPaymentSucceededAt",
  "paidThroughAt",
  "renewalGraceEndsAt",
] as const

const BOOLEAN_FACTS = ["renewalPaymentFailed", "cancelAtPeriodEnd", "accessRevoked"] as const

const PROJECTION_KEYS = [
  "version",
  "enrollmentId",
  "admissionStatus",
  ...NULLABLE_TIMESTAMPS,
  ...BOOLEAN_FACTS,
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTrialAdmissionStatus(value: unknown): value is TrialAdmissionStatus {
  return value === "reserved" || value === "active" || value === "blocked" || value === "released"
}

function hasExactProjectionKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === PROJECTION_KEYS.length &&
    PROJECTION_KEYS.every((key) => Object.hasOwn(value, key))
  )
}

function parseProjection(
  value: unknown,
  enrollmentId: string | null | undefined,
): TrialAccessProjection | null {
  if (!isRecord(value) || !hasExactProjectionKeys(value)) return null

  if (
    value.version !== 1 ||
    typeof value.enrollmentId !== "string" ||
    value.enrollmentId.trim().length === 0 ||
    typeof enrollmentId !== "string" ||
    enrollmentId.trim().length === 0 ||
    value.enrollmentId !== enrollmentId ||
    !isTrialAdmissionStatus(value.admissionStatus)
  ) {
    return null
  }

  for (const key of NULLABLE_TIMESTAMPS) {
    if (value[key] !== null && typeof value[key] !== "string") return null
  }
  for (const key of BOOLEAN_FACTS) {
    if (typeof value[key] !== "boolean") return null
  }

  return value as TrialAccessProjection
}

function hasValidCohortMarker(metadata: BillingTrialAccessRow["metadata"]): boolean {
  if (!isRecord(metadata) || !Object.hasOwn(metadata, "trial_cohort")) return true
  const cohort = metadata.trial_cohort
  return cohort === null || cohort === "trial_v1"
}

function hasTrialCohortMarker(metadata: BillingTrialAccessRow["metadata"]): boolean {
  return (
    isRecord(metadata) && Object.hasOwn(metadata, "trial_cohort") && metadata.trial_cohort !== null
  )
}

export function resolveBillingTrialAccess(
  row: BillingTrialAccessRow,
  now: Date,
): TrialAccess | null {
  if (!hasValidCohortMarker(row.metadata)) return INVALID_FACTS

  const hasEnrollmentLink =
    row.trial_enrollment_id !== null && row.trial_enrollment_id !== undefined
  const hasProjection = row.trial_access_facts !== null && row.trial_access_facts !== undefined
  if (!hasEnrollmentLink && !hasProjection && !hasTrialCohortMarker(row.metadata)) return null

  const projection = parseProjection(row.trial_access_facts, row.trial_enrollment_id)
  if (projection === null) return INVALID_FACTS

  if (projection.admissionStatus === "reserved") return AWAITING_AUTHORIZATION
  if (projection.admissionStatus !== "active") return INVALID_FACTS

  return resolveTrialAccess(projection, now)
}

/** Includes incomplete/corrupt projections: they must never fall back to legacy billing writers. */
export function hasTrialBillingContract(row: BillingTrialAccessRow): boolean {
  return resolveBillingTrialAccess(row, new Date(0)) !== null
}
