import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

import { DISCOVERY_ACCESS_KIND, DISCOVERY_ENROLLMENT_METADATA_KEY } from "./participant"

/**
 * The service layer over `public.discovery_enrollments` (migration
 * 20260922120000). The table is service-only, so every read and write here runs
 * on the admin client — and every one of them re-checks `revoked_at IS NULL`
 * per request: middleware gates on the JWT stamp alone, so a revocation only
 * becomes real where a server surface looks the enrollment up again.
 */

const TABLE = "discovery_enrollments"

/** What the CLI receipt and the admin surfaces read. */
export const DISCOVERY_ENROLLMENT_COLUMNS =
  "id,display_name,normalized_email,token_version,claimed_at,revoked_at,created_at"

/** The journey additionally needs the binding, which the CLI receipt never shows. */
const DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS = `${DISCOVERY_ENROLLMENT_COLUMNS},claimed_user_id`

export type DiscoveryEnrollmentRow = {
  id: string
  display_name: string
  normalized_email: string
  token_version: number
  claimed_at: string | null
  revoked_at: string | null
  created_at: string
}

type DiscoveryEnrollmentJourneyRow = DiscoveryEnrollmentRow & { claimed_user_id: string | null }

export type DiscoveryEnrollment = {
  enrollmentId: string
  name: string
  email: string
  tokenVersion: number
  claimedUserId: string | null
  claimedAt: string | null
  createdAt: string
}

/** Derived, never stored — a revoked enrollment is never returned by the loaders. */
export type DiscoveryEnrollmentState = "invited" | "claimed"

export type DiscoveryAdminClient = ReturnType<typeof createAdminClient>

export type DiscoveryClaimResult =
  | { status: "claimed"; enrollment: DiscoveryEnrollment }
  | { status: "conflict" }

function projectEnrollment(row: DiscoveryEnrollmentJourneyRow): DiscoveryEnrollment {
  return {
    enrollmentId: row.id,
    name: row.display_name,
    email: row.normalized_email,
    tokenVersion: row.token_version,
    claimedUserId: row.claimed_user_id,
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
  }
}

export function deriveDiscoveryEnrollmentState(
  enrollment: Pick<DiscoveryEnrollment, "claimedUserId">,
): DiscoveryEnrollmentState {
  return enrollment.claimedUserId ? "claimed" : "invited"
}

function requireRow(result: { data: unknown; error: unknown }): DiscoveryEnrollmentRow {
  if (result.error) throw result.error
  const row = result.data as DiscoveryEnrollmentRow | null
  if (!row) throw new Error("Discovery enrollment not found")
  return row
}

// --- Journey reads -----------------------------------------------------------

/**
 * Resolves the enrollment an invite credential points at. `tokenVersion` is the
 * rotation guard: an older link decodes fine but no longer matches the stored
 * version, so it resolves to nothing exactly like a revoked one.
 */
export async function loadDiscoveryEnrollment(
  input: { enrollmentId: string; tokenVersion?: number },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollment | null> {
  const { data, error } = await client
    .from(TABLE)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .eq("id", input.enrollmentId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) throw error
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  if (!row) return null
  if (input.tokenVersion !== undefined && row.token_version !== input.tokenVersion) return null
  return projectEnrollment(row)
}

/**
 * The user-scoped load every authenticated discovery surface must go through.
 * The partial unique index `discovery_enrollments_one_current_claimed_user`
 * guarantees at most one unrevoked enrollment per account, so the match is
 * unambiguous.
 */
export async function loadDiscoveryEnrollmentForUser(
  userId: string,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollment | null> {
  const { data, error } = await client
    .from(TABLE)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .eq("claimed_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) throw error
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  return row ? projectEnrollment(row) : null
}

// --- Claim -------------------------------------------------------------------

/**
 * Binds the enrollment to the claiming account. The update is a compare-and-set
 * (`claimed_user_id IS NULL`, plus the same revoked/version predicates the load
 * uses), so two concurrent claims cannot overwrite each other: the loser updates
 * nothing and is told so. Re-claiming with the SAME account is idempotent — that
 * is the magic-link continuation replaying its own claim.
 */
export async function claimDiscoveryEnrollment(
  input: { enrollmentId: string; tokenVersion: number; userId: string; now?: () => string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryClaimResult> {
  const claimedAt = (input.now ?? (() => new Date().toISOString()))()
  const { data, error } = await client
    .from(TABLE)
    .update({ claimed_user_id: input.userId, claimed_at: claimedAt })
    .eq("id", input.enrollmentId)
    .eq("token_version", input.tokenVersion)
    .is("revoked_at", null)
    .is("claimed_user_id", null)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  if (row) return { status: "claimed", enrollment: projectEnrollment(row) }

  const current = await loadDiscoveryEnrollment(
    { enrollmentId: input.enrollmentId, tokenVersion: input.tokenVersion },
    client,
  )
  if (current?.claimedUserId === input.userId) return { status: "claimed", enrollment: current }
  return { status: "conflict" }
}

// --- `app_metadata` stamp ----------------------------------------------------

/**
 * Writes the access stamp onto an account that already existed before the claim
 * (the magic-link continuation). A brand-new account receives it inline in
 * `createUser`, which is why this is not part of `claimDiscoveryEnrollment`.
 */
export async function stampDiscoveryAccess(
  input: { userId: string; enrollmentId: string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<void> {
  const current = await client.auth.admin.getUserById(input.userId)
  if (current.error || !current.data.user) {
    throw current.error ?? new Error("Discovery account metadata is unavailable")
  }
  const { error } = await client.auth.admin.updateUserById(input.userId, {
    app_metadata: {
      ...(current.data.user.app_metadata ?? {}),
      access_kind: DISCOVERY_ACCESS_KIND,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: input.enrollmentId,
    },
  })
  if (error) throw error
}

/**
 * Removes the stamp again. `access_kind` is only cleared when it is ours: an
 * account that reached discovery through some other access kind keeps it.
 * GoTrue merges `app_metadata` and deletes keys written as `null`.
 */
export async function clearDiscoveryAccessStamp(
  userId: string,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<void> {
  const current = await client.auth.admin.getUserById(userId)
  if (current.error || !current.data.user) {
    throw current.error ?? new Error("Discovery account metadata is unavailable")
  }
  const metadata = (current.data.user.app_metadata ?? {}) as Record<string, unknown>
  const { error } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...metadata,
      ...(metadata.access_kind === DISCOVERY_ACCESS_KIND ? { access_kind: null } : {}),
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: null,
    },
  })
  if (error) throw error
}

// --- Operator writes (the `npm run discovery` CLI) ---------------------------

export async function listDiscoveryEnrollments(
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollmentRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select(DISCOVERY_ENROLLMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(250)
  if (error) throw error
  return (data as DiscoveryEnrollmentRow[] | null) ?? []
}

export async function createDiscoveryEnrollment(
  input: { name: string; email: string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollmentRow> {
  return requireRow(
    await client
      .from(TABLE)
      .insert({ display_name: input.name, normalized_email: input.email })
      .select(DISCOVERY_ENROLLMENT_COLUMNS)
      .maybeSingle(),
  )
}

/**
 * Guarded against a concurrent rotate: the version read must still be the stored
 * one, otherwise the other rotation already invalidated the link being rotated.
 */
export async function rotateDiscoveryEnrollment(
  enrollmentId: string,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollmentRow> {
  const { data, error } = await client
    .from(TABLE)
    .select(DISCOVERY_ENROLLMENT_COLUMNS)
    .eq("id", enrollmentId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) throw error
  const current = (data as DiscoveryEnrollmentRow | null) ?? null
  if (!current) throw new Error("Discovery enrollment not found")
  return requireRow(
    await client
      .from(TABLE)
      .update({ token_version: current.token_version + 1 })
      .eq("id", enrollmentId)
      .eq("token_version", current.token_version)
      .select(DISCOVERY_ENROLLMENT_COLUMNS)
      .maybeSingle(),
  )
}

/**
 * Revocation stamps `revoked_at` AND clears the claimed account's
 * `app_metadata` stamp. The middleware gate is JWT-only, so `revoked_at` on its
 * own would leave a claimed participant inside the gate until their token next
 * refreshes; clearing the stamp is what actually closes the door.
 */
export async function revokeDiscoveryEnrollment(
  enrollmentId: string,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEnrollmentRow> {
  const { data, error } = await client
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", enrollmentId)
    .is("revoked_at", null)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  if (!row) throw new Error("Discovery enrollment not found")
  if (row.claimed_user_id) await clearDiscoveryAccessStamp(row.claimed_user_id, client)
  const { claimed_user_id: _claimedUserId, ...receipt } = row
  return receipt
}
