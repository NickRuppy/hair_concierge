/**
 * Free-registration contract (freemium scanner-first, plan task T18).
 *
 * A quiz completion on the free funnel creates a FREE account: the visitor's
 * quiz lead already exists (`/api/quiz/personal-plan-lead` saved it together
 * with the prepared plan artifact), and this contract turns that lead into an
 * account by sending a Supabase OTP magic link with `shouldCreateUser: true`.
 *
 * Deliberate separation from payment activation: `/api/auth/send-magic-link`
 * is the PAYMENT-activation endpoint (`shouldCreateUser: false`, Stripe/PayPal
 * verification, activation claims). It is untouched by this contract — the two
 * flows only share `/auth/confirm`, which this contract extends additively.
 *
 * Lead binding: the magic link carries `?lead=<leadId>`, so `/auth/confirm`
 * hands the EXACT lead to `linkQuizToProfile`, which claims the prepared plan
 * artifact for the new account (`link_personal_plan_artifact_to_user`) and
 * projects the quiz answers into `hair_profiles`. `canLinkDirectQuizLead`
 * still requires the account e-mail to equal the lead e-mail, which is why the
 * correction path below rewrites `leads.email` before the account exists.
 *
 * CORRECTION AUTHORIZATION (fix round 1, review finding W1a): rewriting
 * `leads.email` requires a short-lived signed capability minted at quiz
 * completion and held by the completing browser — lead possession alone is NOT
 * enough, because unclaimed lead ids are published by design (see
 * `free-registration-capability.ts` for the full attack and the control). The
 * initial send and every resend keep bare-leadId auth: they can only ever mail
 * the address the lead already holds.
 *
 * The other half of that attack — an attacker pointing their OWN lead at a
 * victim's address so the victim's „login" click overwrites their existing hair
 * profile — is closed on the confirm side by `resolveFreeRegistrationBind`
 * below, which refuses to bind a foreign lead into an established account.
 */

import { EMAIL_ADDRESS_PATTERN } from "@/lib/email-deliverability-shared"

export const FREE_REGISTRATION_PATH = "/registrierung"
export const FREE_REGISTRATION_LANDING_PATH = "/scan"
export const FREE_REGISTRATION_API_PATH = "/api/auth/free-registration"
/** Marks an `/auth/confirm` hit that came from a free-registration link. */
export const FREE_REGISTRATION_CONFIRM_PARAM = "free"
export const FREE_REGISTRATION_CONFIRM_VALUE = "1"
/** sessionStorage handoff written by the quiz, read by `/registrierung`. */
export const FREE_REGISTRATION_HANDOFF_STORAGE_KEY = "chaarlie_free_registration_handoff"
/**
 * Query flag on the `/scan` landing telling the free account that its magic
 * link did NOT adopt the quiz it carried, because the account already had its
 * own hair profile (see `resolveFreeRegistrationBind`).
 */
export const FREE_REGISTRATION_BIND_SKIPPED_PARAM = "konto"
export const FREE_REGISTRATION_BIND_SKIPPED_VALUE = "bestehend"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isFreeRegistrationLeadId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

/**
 * Where a completed quiz goes next. Flag OFF returns the byte-identical
 * destination the paid funnel uses today (`/result/<leadId>/reveal`); the
 * funnel cutover itself is T19, this only opens the flag-gated branch.
 */
export function resolveQuizCompletionDestination(input: {
  leadId: string
  freemiumScannerFirstEnabled: boolean
}): string {
  if (!input.freemiumScannerFirstEnabled) {
    return `/result/${input.leadId}/reveal`
  }
  return FREE_REGISTRATION_PATH
}

/** The `emailRedirectTo` handed to Supabase for a free-registration OTP. */
export function buildFreeRegistrationEmailRedirect(siteUrl: string, leadId: string): string {
  const base = siteUrl.replace(/\/+$/, "")
  const params = new URLSearchParams()
  params.set(FREE_REGISTRATION_CONFIRM_PARAM, FREE_REGISTRATION_CONFIRM_VALUE)
  params.set("lead", leadId)
  params.set("next", FREE_REGISTRATION_LANDING_PATH)
  return `${base}/auth/confirm?${params.toString()}`
}

/** Recovery destination for an expired/consumed free-registration link. */
export function buildFreeRegistrationRecoveryPath(leadId: string | null): string {
  const params = new URLSearchParams()
  if (isFreeRegistrationLeadId(leadId)) params.set("lead", leadId)
  params.set("error", "link_expired")
  return `${FREE_REGISTRATION_PATH}?${params.toString()}`
}

export function isFreeRegistrationConfirmRequest(searchParams: URLSearchParams): boolean {
  return searchParams.get(FREE_REGISTRATION_CONFIRM_PARAM) === FREE_REGISTRATION_CONFIRM_VALUE
}

export type FreeRegistrationLead = {
  id: string
  email: string
  quizKind: "legacy" | "personal_plan"
  userId: string | null
}

export type FreeRegistrationResult =
  | { outcome: "sent"; email: string; corrected: boolean }
  | { outcome: "invalid_request" }
  | { outcome: "lead_not_found" }
  | { outcome: "lead_claimed" }
  | { outcome: "correction_not_authorized" }
  | { outcome: "rate_limited" }
  | { outcome: "rate_limit_unavailable" }
  | { outcome: "undeliverable_email"; reason?: string; suggestion?: string }
  | { outcome: "send_failed" }

export type FreeRegistrationDeliverability =
  | { ok: true; normalized: string }
  | { ok: false; reason?: string; suggestion?: string }

/**
 * The three independent budgets one send has to fit into (fix round 1, review
 * finding W4). `lead` alone was mintable by the caller — completing the quiz is
 * free and scriptable — so it bounded nothing on its own.
 */
export type FreeRegistrationRateDimension = "lead" | "ip" | "address"

export type FreeRegistrationDependencies = {
  siteUrl: string
  checkRateLimit: (input: {
    dimension: FreeRegistrationRateDimension
    identifier: string
  }) => Promise<{ allowed: boolean; error?: string }>
  loadLead: (leadId: string) => Promise<FreeRegistrationLead | null>
  /**
   * Guarded by `user_id IS NULL`; reports whether it actually matched a row so a
   * lead claimed between the read and the write is a conflict, not a silent
   * success followed by a dead end (fix round 1, review finding W5).
   */
  updateLeadEmail: (leadId: string, email: string) => Promise<{ updated: boolean }>
  checkEmailDeliverability: (email: string) => Promise<FreeRegistrationDeliverability>
  /**
   * Verifies the quiz-completion capability that authorizes a correction (fix
   * round 1, review finding W1a) — see `free-registration-capability.ts`.
   */
  verifyCorrectionCapability: (token: unknown, leadId: string) => boolean
  sendMagicLink: (input: {
    email: string
    emailRedirectTo: string
  }) => Promise<{ error: unknown } | void>
}

export type FreeRegistrationRequest = {
  leadId: unknown
  /** Optional: only present on the correct-e-mail recovery path. */
  email?: unknown
  /** Required for a correction; ignored for an initial send or a resend. */
  capability?: unknown
  /** Best-effort caller IP for the second rate-limit dimension. */
  ipAddress?: unknown
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function toRateLimitOutcome(check: { error?: string }): FreeRegistrationResult {
  return check.error === "service_unavailable"
    ? { outcome: "rate_limit_unavailable" }
    : { outcome: "rate_limited" }
}

/**
 * Evidence the FREE confirm branch weighs before it lets a magic link adopt the
 * quiz lead it carries (fix round 1, review finding W1b).
 */
export type FreeRegistrationBindEvidence = {
  /** The lead already carries this account's `user_id` (a same-user retry). */
  leadOwnedByAccount: boolean
  /** The account already has its own hair profile / Personal Plan row. */
  hasEstablishedProfile: boolean
}

/**
 * The free branch adopts a lead ONLY into an account that has nothing to lose.
 *
 * `signInWithOtp({ shouldCreateUser: true })` against an address that already
 * has an account mails that account an ordinary LOGIN link. So an attacker could
 * point their own lead at `victim@real.de`, and the victim's click would run
 * `linkQuizToProfile`, whose existing-row branch UPDATEs the victim's
 * `hair_profiles` with the attacker's answers — and, through the changed
 * artifact input hash, stale their refinement and product drafts. On a paying
 * customer that is silent, destructive and not self-healing.
 *
 * `"skip"` therefore means: no lead binding, no free provisioning, no writes at
 * all — the user simply lands on `/scan` as their existing self, with an honest
 * notice. It never applies to the genuine cases: a brand-new free account has no
 * profile, and a re-click of one's OWN link owns the lead (which keeps the
 * same-user retry `canLinkDirectQuizLead` deliberately allows). Callers resolve
 * a failed or unreadable evidence lookup to `"skip"` — fail closed, because the
 * cost of a wrong `"bind"` is a destroyed profile and the cost of a wrong
 * `"skip"` is one honest notice.
 */
export function resolveFreeRegistrationBind(
  evidence: FreeRegistrationBindEvidence,
): "bind" | "skip" {
  if (evidence.leadOwnedByAccount) return "bind"
  return evidence.hasEstablishedProfile ? "skip" : "bind"
}

/** The `/scan` landing for a confirm whose lead binding was skipped. */
export function buildFreeRegistrationBindSkippedLandingPath(): string {
  return `${FREE_REGISTRATION_LANDING_PATH}?${FREE_REGISTRATION_BIND_SKIPPED_PARAM}=${FREE_REGISTRATION_BIND_SKIPPED_VALUE}`
}

/**
 * Sends (or re-sends) the free-registration magic link for one quiz lead.
 * Resend = the same call without `email`. Correction = the same call with a
 * different `email`, which rewrites the still-unclaimed lead's address so the
 * confirm-time lead binding keeps matching the account.
 */
export async function requestFreeRegistrationLink(
  request: FreeRegistrationRequest,
  deps: FreeRegistrationDependencies,
): Promise<FreeRegistrationResult> {
  if (!isFreeRegistrationLeadId(request.leadId)) return { outcome: "invalid_request" }
  const leadId = request.leadId

  let requestedEmail: string | null = null
  if (request.email !== undefined && request.email !== null && request.email !== "") {
    if (typeof request.email !== "string") return { outcome: "invalid_request" }
    const candidate = normalizeEmail(request.email)
    if (!EMAIL_ADDRESS_PATTERN.test(candidate)) return { outcome: "invalid_request" }
    requestedEmail = candidate
  }

  const leadRate = await deps.checkRateLimit({ dimension: "lead", identifier: leadId })
  if (!leadRate.allowed) return toRateLimitOutcome(leadRate)

  if (typeof request.ipAddress === "string" && request.ipAddress) {
    const ipRate = await deps.checkRateLimit({
      dimension: "ip",
      identifier: request.ipAddress,
    })
    if (!ipRate.allowed) return toRateLimitOutcome(ipRate)
  }

  const lead = await deps.loadLead(leadId)
  if (!lead || lead.quizKind !== "personal_plan") return { outcome: "lead_not_found" }
  // A claimed lead already belongs to an account; re-pointing it would move
  // somebody else's quiz artifact. Registration is over for this lead.
  if (lead.userId) return { outcome: "lead_claimed" }

  const leadEmail = normalizeEmail(lead.email)
  let targetEmail = leadEmail
  let corrected = false

  if (requestedEmail && requestedEmail !== leadEmail) {
    // Possession of the lead id authorizes a RESEND, never a redirect: only the
    // browser that completed the quiz holds the capability (finding W1a).
    if (!deps.verifyCorrectionCapability(request.capability, leadId)) {
      return { outcome: "correction_not_authorized" }
    }
    const deliverability = await deps.checkEmailDeliverability(requestedEmail)
    if (!deliverability.ok) {
      return {
        outcome: "undeliverable_email",
        ...(deliverability.reason ? { reason: deliverability.reason } : {}),
        ...(deliverability.suggestion ? { suggestion: deliverability.suggestion } : {}),
      }
    }
    targetEmail = deliverability.normalized
    corrected = true
  }

  // The destination budget — checked once the final address is known, so a
  // correction spends the CORRECTED address's budget, and before anything is
  // written or sent.
  const addressRate = await deps.checkRateLimit({
    dimension: "address",
    identifier: targetEmail,
  })
  if (!addressRate.allowed) return toRateLimitOutcome(addressRate)

  if (corrected) {
    // Written BEFORE the link goes out: `/auth/confirm` binds the lead through
    // `canLinkDirectQuizLead`, which compares the account e-mail with this row.
    // A write that matches nothing means the lead was claimed in between — the
    // link must not go out, or the resulting account dead-ends (finding W5).
    const write = await deps.updateLeadEmail(leadId, targetEmail)
    if (!write.updated) return { outcome: "lead_claimed" }
  }

  const sent = await deps.sendMagicLink({
    email: targetEmail,
    emailRedirectTo: buildFreeRegistrationEmailRedirect(deps.siteUrl, leadId),
  })
  if (sent && sent.error) return { outcome: "send_failed" }

  return { outcome: "sent", email: targetEmail, corrected }
}
