import type { ProductUsageMatchStatus } from "@/lib/types"

export type RoutineUsageMatchStatus = ProductUsageMatchStatus | null

export type RoutineUsageIdentityInput = {
  product_id?: string | null
  product_submission_id?: string | null
  match_status?: RoutineUsageMatchStatus
}

export type NormalizedRoutineUsageIdentity = {
  product_id: string | null
  product_submission_id: string | null
  match_status: RoutineUsageMatchStatus
}

export type NormalizedRoutineUsageIdentityCamel = {
  productId: string | null
  productSubmissionId: string | null
  matchStatus: RoutineUsageMatchStatus
}

export function isMatchedRoutineUsage(status: RoutineUsageMatchStatus): boolean {
  return status === "matched"
}

export function isPendingRoutineSubmission(status: RoutineUsageMatchStatus): boolean {
  return status === "pending_review" || status === "needs_more_info"
}

export function normalizeRoutineUsageIdentity(
  input: RoutineUsageIdentityInput,
): NormalizedRoutineUsageIdentity {
  const matchStatus = input.match_status ?? null

  return {
    product_id: isMatchedRoutineUsage(matchStatus) ? (input.product_id ?? null) : null,
    product_submission_id: isPendingRoutineSubmission(matchStatus)
      ? (input.product_submission_id ?? null)
      : null,
    match_status: matchStatus,
  }
}

function routineUsageIdentityPriority(status: RoutineUsageMatchStatus): number {
  if (status === "matched") return 3
  if (status === "pending_review" || status === "needs_more_info") return 2
  if (status === "text_only") return 1
  return 0
}

export function chooseRoutineUsageIdentity(
  left: RoutineUsageIdentityInput,
  right: RoutineUsageIdentityInput,
): NormalizedRoutineUsageIdentity {
  const normalizedLeft = normalizeRoutineUsageIdentity(left)
  const normalizedRight = normalizeRoutineUsageIdentity(right)
  return routineUsageIdentityPriority(normalizedRight.match_status) >
    routineUsageIdentityPriority(normalizedLeft.match_status)
    ? normalizedRight
    : normalizedLeft
}

export function normalizeRoutineUsageIdentityCamel(
  input: RoutineUsageIdentityInput,
): NormalizedRoutineUsageIdentityCamel {
  const identity = normalizeRoutineUsageIdentity(input)

  return {
    productId: identity.product_id,
    productSubmissionId: identity.product_submission_id,
    matchStatus: identity.match_status,
  }
}
