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
 * KNOWN RESIDUAL RISK (documented, reviewed): the correction path authorizes
 * on lead possession alone (`leadId` + the lead still being unclaimed). In the
 * free journey the lead id never appears in a shareable URL, and the window
 * closes as soon as the lead is claimed (`leads.user_id`), but a caller who
 * obtains an unclaimed lead id (e.g. from a shared `/result/<leadId>` link of
 * the paid funnel) could redirect that lead's registration to their own
 * address. Hardening this needs a signed same-session capability; see the T18
 * report for the trade-off.
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
  | { outcome: "rate_limited" }
  | { outcome: "rate_limit_unavailable" }
  | { outcome: "undeliverable_email"; reason?: string; suggestion?: string }
  | { outcome: "send_failed" }

export type FreeRegistrationDeliverability =
  | { ok: true; normalized: string }
  | { ok: false; reason?: string; suggestion?: string }

export type FreeRegistrationDependencies = {
  siteUrl: string
  checkRateLimit: (identifier: string) => Promise<{ allowed: boolean; error?: string }>
  loadLead: (leadId: string) => Promise<FreeRegistrationLead | null>
  updateLeadEmail: (leadId: string, email: string) => Promise<void>
  checkEmailDeliverability: (email: string) => Promise<FreeRegistrationDeliverability>
  sendMagicLink: (input: {
    email: string
    emailRedirectTo: string
  }) => Promise<{ error: unknown } | void>
}

export type FreeRegistrationRequest = {
  leadId: unknown
  /** Optional: only present on the correct-e-mail recovery path. */
  email?: unknown
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
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

  const rateCheck = await deps.checkRateLimit(leadId)
  if (!rateCheck.allowed) {
    return rateCheck.error === "service_unavailable"
      ? { outcome: "rate_limit_unavailable" }
      : { outcome: "rate_limited" }
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
    // Written BEFORE the link goes out: `/auth/confirm` binds the lead through
    // `canLinkDirectQuizLead`, which compares the account e-mail with this row.
    await deps.updateLeadEmail(leadId, targetEmail)
  }

  const sent = await deps.sendMagicLink({
    email: targetEmail,
    emailRedirectTo: buildFreeRegistrationEmailRedirect(deps.siteUrl, leadId),
  })
  if (sent && sent.error) return { outcome: "send_failed" }

  return { outcome: "sent", email: targetEmail, corrected }
}
