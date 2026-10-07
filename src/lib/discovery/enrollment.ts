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
  /** Null until the participant types it on the invite page (the admin may leave it out). */
  normalized_email: string | null
  token_version: number
  claimed_at: string | null
  revoked_at: string | null
  created_at: string
}

type DiscoveryEnrollmentJourneyRow = DiscoveryEnrollmentRow & { claimed_user_id: string | null }

export type DiscoveryEnrollment = {
  enrollmentId: string
  name: string
  /** Null until bound; a claimed enrollment always carries one (the claim binds it first). */
  email: string | null
  tokenVersion: number
  claimedUserId: string | null
  claimedAt: string | null
  createdAt: string
}

/** Derived, never stored — a revoked enrollment is never returned by the loaders. */
export type DiscoveryEnrollmentState = "invited" | "claimed"

export type DiscoveryAdminClient = ReturnType<typeof createAdminClient>

export type DiscoveryEmailBindResult =
  | { status: "bound"; enrollment: DiscoveryEnrollment }
  | { status: "email_taken" }
  | { status: "conflict" }

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
 *
 * `email` — the address this claim bound and the account carries — is part of the
 * predicate too. Binding the address and claiming are separate writes, so a second
 * attempt can re-bind a different address in between; without this the first claim
 * would bind its account to a row holding someone else's address (and the quiz would
 * run on the wrong identity). A changed address makes the claim a `conflict`.
 */
export async function claimDiscoveryEnrollment(
  input: {
    enrollmentId: string
    tokenVersion: number
    userId: string
    email: string
    now?: () => string
  },
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
    .eq("normalized_email", input.email)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  if (row) return { status: "claimed", enrollment: projectEnrollment(row) }

  const current = await loadDiscoveryEnrollment(
    { enrollmentId: input.enrollmentId, tokenVersion: input.tokenVersion },
    client,
  )
  if (current?.claimedUserId === input.userId && current.email === input.email) {
    return { status: "claimed", enrollment: current }
  }
  return { status: "conflict" }
}

// --- E-mail binding ------------------------------------------------------------

/** Postgres unique violation — here only ever `discovery_enrollments_one_current_email`. */
export function isDiscoveryEmailTakenError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { code?: unknown }).code === "23505",
  )
}

/**
 * Binds the address the participant typed on the invite page. Allowed only while
 * the enrollment is unclaimed — the same compare-and-set predicates as the claim —
 * so a typo can be fixed by retrying, but a claimed enrollment never moves to a
 * different address. `conflict` means the row was claimed, rotated or revoked in
 * between; `email_taken` means another current enrollment already owns the address
 * (the partial unique index), and deliberately says nothing about whose.
 */
export async function bindDiscoveryEnrollmentEmail(
  input: { enrollmentId: string; tokenVersion: number; email: string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryEmailBindResult> {
  const { data, error } = await client
    .from(TABLE)
    .update({ normalized_email: input.email })
    .eq("id", input.enrollmentId)
    .eq("token_version", input.tokenVersion)
    .is("revoked_at", null)
    .is("claimed_user_id", null)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .maybeSingle()
  if (error) {
    if (isDiscoveryEmailTakenError(error)) return { status: "email_taken" }
    throw error
  }
  const row = (data as DiscoveryEnrollmentJourneyRow | null) ?? null
  return row ? { status: "bound", enrollment: projectEnrollment(row) } : { status: "conflict" }
}

// --- `app_metadata` stamp ----------------------------------------------------

export type DiscoveryStampResult =
  | { status: "stamped" }
  | { status: "foreign_access_kind"; accessKind: string }

/** The read half of the stamp, so the refusal can be taken before anything is written. */
export type DiscoveryAccessKindCheck =
  | { status: "eligible" }
  | { status: "foreign_access_kind"; accessKind: string }

async function readDiscoveryAccessMetadata(userId: string, client: DiscoveryAdminClient) {
  const current = await client.auth.admin.getUserById(userId)
  if (current.error || !current.data.user) {
    throw current.error ?? new Error("Discovery account metadata is unavailable")
  }
  const metadata = (current.data.user.app_metadata ?? {}) as Record<string, unknown>
  const accessKind = metadata.access_kind
  const foreign =
    accessKind !== null &&
    accessKind !== undefined &&
    accessKind !== "" &&
    accessKind !== DISCOVERY_ACCESS_KIND
  return { metadata, accessKind, foreign }
}

/**
 * Answers the `access_kind` question WITHOUT writing anything.
 *
 * The claim route needs the refusal before it binds the enrollment, and the stamp
 * itself has to come after that binding — so the two halves are separate callers of
 * the same rule rather than the route re-implementing it.
 */
export async function checkDiscoveryAccessKind(
  userId: string,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryAccessKindCheck> {
  const current = await readDiscoveryAccessMetadata(userId, client)
  return current.foreign
    ? { status: "foreign_access_kind", accessKind: String(current.accessKind) }
    : { status: "eligible" }
}

/**
 * Writes the access stamp. BOTH claim branches go through it — the account that
 * already existed (the magic-link continuation) and the one the claim route just
 * created — and both call it AFTER the enrollment binding landed, never inline in
 * `createUser`: a stamp that outlives a failed claim strands the account behind a
 * middleware gate no enrollment backs.
 *
 * An account that already carries a DIFFERENT `access_kind` — `partner`,
 * `field_test`, anything non-null that is not ours — is refused rather than
 * overwritten. The overwrite would be irrecoverable: `clearDiscoveryAccessStamp`
 * only ever nulls `"discovery"`, so revoking the enrollment afterwards would
 * leave the account with no access kind at all and its partner or field-test
 * routing permanently gone. The refusal lives here rather than in the claim
 * route so every future caller inherits it.
 */
export async function stampDiscoveryAccess(
  input: { userId: string; enrollmentId: string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryStampResult> {
  const { metadata, accessKind, foreign } = await readDiscoveryAccessMetadata(input.userId, client)
  if (foreign) {
    return { status: "foreign_access_kind", accessKind: String(accessKind) }
  }
  const { error } = await client.auth.admin.updateUserById(input.userId, {
    app_metadata: {
      ...metadata,
      access_kind: DISCOVERY_ACCESS_KIND,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: input.enrollmentId,
    },
  })
  if (error) throw error
  return { status: "stamped" }
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

// --- Operator writes (the `npm run discovery` CLI and `/admin/beratung`) ------

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
  input: { name: string; email: string | null },
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

function toEnrollmentRow(row: DiscoveryEnrollmentJourneyRow): DiscoveryEnrollmentRow {
  return {
    id: row.id,
    display_name: row.display_name,
    normalized_email: row.normalized_email,
    token_version: row.token_version,
    claimed_at: row.claimed_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
  }
}

/**
 * Revocation stamps `revoked_at` AND clears the claimed account's
 * `app_metadata` stamp. The middleware gate is JWT-only, so `revoked_at` on its
 * own would leave a claimed participant inside the gate until their token next
 * refreshes; clearing the stamp is what actually closes the door.
 *
 * The two writes are not atomic, so the second one is made RETRYABLE. The
 * `revoked_at` write is a compare-and-set on `revoked_at IS NULL`; if the clear
 * that follows it fails, that predicate no longer matches and a plain re-run
 * would report „already revoked" without ever reaching the clear again — the
 * participant would keep their stamp, which is the half that actually gates
 * middleware. So a run that matches nothing re-reads the row and, when it finds
 * an already-revoked enrollment that still carries a binding, attempts the clear
 * anyway. `clearDiscoveryAccessStamp` only ever nulls OUR access kind, so doing
 * it twice is a no-op rather than a second effect.
 *
 * An already-revoked enrollment with no `claimed_user_id` has nothing left to
 * finish, so it stays a refusal: there, a second revoke is simply an operator
 * mistake worth surfacing.
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
  if (row) {
    if (row.claimed_user_id) await clearDiscoveryAccessStamp(row.claimed_user_id, client)
    return toEnrollmentRow(row)
  }

  // Nothing matched: either the enrollment is gone, or a previous run already
  // set `revoked_at` — possibly one whose clear failed afterwards.
  const { data: currentData, error: currentError } = await client
    .from(TABLE)
    .select(DISCOVERY_ENROLLMENT_JOURNEY_COLUMNS)
    .eq("id", enrollmentId)
    .maybeSingle()
  if (currentError) throw currentError
  const current = (currentData as DiscoveryEnrollmentJourneyRow | null) ?? null
  if (!current || !current.revoked_at || !current.claimed_user_id) {
    throw new Error("Discovery enrollment not found")
  }
  await clearDiscoveryAccessStamp(current.claimed_user_id, client)
  // `revoked_at` is the ORIGINAL timestamp, never a fresh one: this run finished
  // an earlier revocation, it did not perform a new one.
  return toEnrollmentRow(current)
}
