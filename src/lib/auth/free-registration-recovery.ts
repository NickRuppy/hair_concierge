import { createAdminClient } from "@/lib/supabase/admin"
import { reportFreeProvisioningOutcome } from "@/lib/observability/free-registration"
import type { ProvisionFreeInitialSnapshotResult } from "@/lib/personal-plan/persistence/free-snapshot-service"
import { provisionFreeInitialSnapshotForUser } from "@/lib/personal-plan/persistence/free-snapshot-supabase"

/**
 * The retry surface for a free account whose confirm-time provisioning failed
 * (T18 fix round 1, review finding W2).
 *
 * Before this existed, a typed provisioning failure at `/auth/confirm` was a
 * PERMANENT dead end: the lead was already claimed, so `/api/auth/free-registration`
 * answered 409, no other surface provisioned, and the user sat on a scanner that
 * said „Für den Scan brauchen wir zuerst deine Haaranalyse" thirty seconds after
 * completing it. The confirm route's comment claimed „the next confirm/visit can
 * provision idempotently"; this module is what makes that true.
 *
 * Deliberately narrow, because `free-snapshot-service.ts`'s ownership contract
 * forbids opportunistic invocation for an arbitrary signed-in user. It runs only
 * when ALL of these hold:
 *  - the freemium flag is on (checked by the caller — `/scan`'s server page);
 *  - the caller resolved the page tier to `"free"`, i.e. the same email-aware
 *    paid-access composite the scan APIs enforce with already DENIED paid access
 *    (that composite failing resolves `"premium"`, so an outage never reaches
 *    here);
 *  - the account has no initial need version yet — the precise condition the
 *    scanner's `profile_missing` reports.
 * The service then re-runs its own paid/moderator guard before writing anything.
 *
 * Every non-success outcome is reported, so a repeatedly failing account is
 * visible rather than silently stuck.
 */
export async function recoverMissingFreeSnapshot(input: {
  userId: string
  email?: string | null
  admin?: RecoveryAdmin
  hasInitialNeed?: (userId: string) => Promise<boolean>
  provision?: (input: {
    userId: string
    email?: string | null
  }) => Promise<ProvisionFreeInitialSnapshotResult>
  report?: typeof reportFreeProvisioningOutcome
}): Promise<"not_needed" | "attempted"> {
  const hasInitialNeed =
    input.hasInitialNeed ?? ((userId: string) => hasInitialNeedVersion(userId, input.admin))
  if (await hasInitialNeed(input.userId)) return "not_needed"

  const provision = input.provision ?? provisionFreeInitialSnapshotForUser
  const result = await provision({
    userId: input.userId,
    ...(input.email ? { email: input.email } : {}),
  })
  const report = input.report ?? reportFreeProvisioningOutcome
  report(result, { stage: "scan_retry", userId: input.userId })
  return "attempted"
}

/**
 * One cheap read — the same `personal_plans` row `loadScanEvaluationContext`
 * starts from — so a healthy free account pays a single indexed lookup per
 * `/scan` render and never re-enters the provisioning path.
 */
async function hasInitialNeedVersion(userId: string, injected?: RecoveryAdmin): Promise<boolean> {
  const admin = injected ?? (createAdminClient() as unknown as RecoveryAdmin)
  const { data, error } = await admin
    .from("personal_plans")
    .select("current_initial_need_version_id, current_refined_need_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  // Fail "already provisioned" on an unreadable lookup: never provision on a
  // signal we could not read (same fail-closed rule the service itself uses).
  if (error) return true
  if (!data || typeof data !== "object") return false
  const row = data as {
    current_initial_need_version_id?: unknown
    current_refined_need_version_id?: unknown
  }
  return Boolean(row.current_initial_need_version_id ?? row.current_refined_need_version_id)
}

type RecoveryQuery = {
  select: (columns: string) => RecoveryQuery
  eq: (column: string, value: string) => RecoveryQuery
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

type RecoveryAdmin = { from: (table: "personal_plans") => RecoveryQuery }
