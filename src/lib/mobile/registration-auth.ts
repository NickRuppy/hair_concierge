import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { decodeJwt, decodeProtectedHeader } from "jose"
import { loadSharedScannerContext } from "@/lib/scan/scanner-context-supabase"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { mobileProvider, sessionDTO, mobileJSON } from "./auth"
import { MobileError } from "./errors"
import type { MobileAuthVerification, MobileSession } from "./contracts"
import { registrationSubmissionHash, type RegistrationSubmission } from "./registration-contract"
import { registrationStore, type RegistrationIntent } from "./registration-store"
import {
  openCredential,
  sealCredential,
} from "../../../supabase/functions/_shared/mobile-credentials"
import {
  readRegistrationConfig,
  eligibleRegistrationEmail,
  openRegistrationCredential,
  sealRegistrationCredential,
  registrationCodeDigest,
  type RegistrationClaims,
  type RegistrationConfig,
} from "../../../supabase/functions/_shared/mobile-registration-credentials"

export function registrationConfig(): RegistrationConfig {
  try {
    return readRegistrationConfig(process.env)
  } catch {
    throw new MobileError("not_found", 404)
  }
}
function requireRegistrationEmail(email: string, config = registrationConfig()) {
  if (!eligibleRegistrationEmail(config, email)) throw new MobileError("unauthorized", 401)
}
export async function registrationRoute(run: () => Promise<Response>) {
  try {
    registrationConfig()
    return await run()
  } catch (error) {
    return error instanceof MobileError
      ? mobileJSON({ error: error.code }, error.status)
      : mobileJSON({ error: "temporarily_unavailable" }, 503)
  }
}
function invalid(): never {
  throw new MobileError("invalid_or_expired_code", 401)
}
function unavailable(error: { status?: number } | null) {
  if (error && (!error.status || error.status >= 500))
    throw new MobileError("temporarily_unavailable", 503)
}
/** Database/provider clocks can lead this issuer across a second boundary. Shorten
 * the emitted capability rather than adding tolerance or extending any deadline. */
function registrationCredentialExpiry(...deadlines: number[]) {
  return Math.min(...deadlines, Math.floor(Date.now() / 1000) + 3600)
}
function requestClaims(intent: RegistrationIntent): RegistrationClaims {
  return {
    purpose: "registration_request",
    attemptId: intent.id,
    sendGeneration: intent.send_generation,
    requestHash: intent.request_hash,
    email: intent.email,
    expiresAt: Math.floor(Date.parse(intent.expires_at) / 1000),
  }
}
async function send(
  intent: RegistrationIntent,
  create: boolean,
  config: RegistrationConfig,
  provider = mobileProvider(),
) {
  const claims = requestClaims(intent)
  claims.expiresAt = registrationCredentialExpiry(claims.expiresAt, config.expiresAt)
  const proof = await sealRegistrationCredential(config, claims)
  const callback = `${config.callbackUrl}#registrationRequest=${encodeURIComponent(proof)}`
  const { error } = await provider.auth.signInWithOtp({
    email: intent.email,
    options: { shouldCreateUser: create, emailRedirectTo: callback },
  })
  unavailable(error)
  if (error?.code === "email_provider_disabled")
    throw new MobileError("temporarily_unavailable", 503)
  // No account existence / confirmation state disclosure. Provider cooldown keeps same DTO.
  return { attemptId: intent.id, codeLength: 8 as const }
}
export async function startMobileRegistration(
  submission: RegistrationSubmission,
  client = createAdminClient(),
) {
  const config = registrationConfig()
  requireRegistrationEmail(submission.email, config)
  const intent = await registrationStore(client).start(
    submission.requestId,
    registrationSubmissionHash(submission),
    submission.email,
  )
  return send(intent, true, config)
}
export async function startRegisteredLogin(email: string, client = createAdminClient()) {
  const config = registrationConfig()
  requireRegistrationEmail(email, config)
  const store = registrationStore(client)
  const intent = await store.start(
    randomUUID(),
    createHash("sha256").update(`mobile-login-v1:${email}`).digest("hex"),
    email,
    "login",
  )
  return send(intent, false, config)
}
export function isRegistrationSessionCredential(raw: string) {
  try {
    return decodeJwt(raw).iss === "chaarlie-mobile-registration"
  } catch {
    return false
  }
}
function boundConfig(config: RegistrationConfig, email: string, userId: string) {
  requireRegistrationEmail(email, config)
  return { ...config, accounts: [{ email, userId }] }
}
async function registeredEnvelope(
  raw: string,
  purpose: "access" | "refresh",
  config: RegistrationConfig,
) {
  try {
    const hint = decodeJwt(raw)
    if (typeof hint.email !== "string" || typeof hint.sub !== "string") throw new Error("invalid")
    return await openCredential(boundConfig(config, hint.email, hint.sub), raw, purpose)
  } catch {
    throw new MobileError("unauthorized", 401)
  }
}
async function providerIdentity(
  token: string,
  email: string,
  userId: string,
  sessionId?: string,
  provider = mobileProvider(),
) {
  const { data, error } = await provider.auth.getUser(token)
  unavailable(error)
  if (
    error ||
    !data.user ||
    data.user.is_anonymous ||
    !data.user.email_confirmed_at ||
    data.user.id !== userId ||
    data.user.email?.toLowerCase() !== email
  )
    throw new MobileError("unauthorized", 401)
  let claims
  try {
    claims = decodeJwt(token)
  } catch {
    throw new MobileError("unauthorized", 401)
  }
  if (
    claims.sub !== userId ||
    typeof claims.session_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      claims.session_id,
    ) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp! <= Math.floor(Date.now() / 1000) ||
    (sessionId && claims.session_id !== sessionId)
  )
    throw new MobileError("unauthorized", 401)
  return { user: data.user, sessionId: claims.session_id, expiresAt: claims.exp! }
}
export async function issueRegisteredSession(
  session: MobileSession,
  email: string,
  client = createAdminClient(),
): Promise<MobileSession> {
  const config = registrationConfig()
  requireRegistrationEmail(email, config)
  if (!(await registrationStore(client).enrollment(email, session.userId)))
    throw new MobileError("unauthorized", 401)
  const identity = await providerIdentity(session.accessToken, email, session.userId)
  const expiresAt = Math.min(session.expiresAt, identity.expiresAt, config.expiresAt)
  const binding = { userId: session.userId, email, sessionId: identity.sessionId }
  const codec = boundConfig(config, email, session.userId)
  const [accessToken, refreshToken] = await Promise.all([
    sealCredential(codec, {
      ...binding,
      purpose: "access",
      credential: session.accessToken,
      expiresAt,
    }),
    sealCredential(codec, {
      ...binding,
      purpose: "refresh",
      credential: session.refreshToken,
      expiresAt: config.expiresAt,
    }),
  ])
  return { accessToken, refreshToken, expiresAt, userId: session.userId }
}
export async function requireRegisteredUser(raw: string, client = createAdminClient()) {
  const envelope = await registeredEnvelope(raw, "access", registrationConfig())
  if (!(await registrationStore(client).enrollment(envelope.email, envelope.userId)))
    throw new MobileError("unauthorized", 401)
  await providerIdentity(envelope.credential, envelope.email, envelope.userId, envelope.sessionId)
  return { userId: envelope.userId, token: envelope.credential, client }
}
export async function refreshRegisteredSession(raw: string, client = createAdminClient()) {
  const config = registrationConfig(),
    envelope = await registeredEnvelope(raw, "refresh", config)
  if (!(await registrationStore(client).enrollment(envelope.email, envelope.userId)))
    throw new MobileError("unauthorized", 401)
  const { data: pinned, error: pinnedError } = await client.auth.admin.getUserById(envelope.userId)
  unavailable(pinnedError)
  if (
    pinnedError ||
    !pinned.user ||
    pinned.user.is_anonymous ||
    pinned.user.email?.toLowerCase() !== envelope.email
  )
    throw new MobileError("unauthorized", 401)
  const { data, error } = await mobileProvider().auth.refreshSession({
    refresh_token: envelope.credential,
  })
  unavailable(error)
  if (error || !data.session || data.session.user.id !== envelope.userId)
    throw new MobileError("unauthorized", 401)
  await providerIdentity(
    data.session.access_token,
    envelope.email,
    envelope.userId,
    envelope.sessionId,
  )
  return issueRegisteredSession(sessionDTO(data.session), envelope.email, client)
}
export type RegistrationVerificationDependencies = {
  config: RegistrationConfig
  store: ReturnType<typeof registrationStore>
  verify: (
    intent: RegistrationIntent,
    input: MobileAuthVerification,
    proof: RegistrationClaims | null,
  ) => Promise<Session | null>
  identity: (
    token: string,
    email: string,
    userId: string,
  ) => Promise<{ sessionId: string; expiresAt: number }>
  profile: (userId: string) => Promise<{ hasExistingProfile: boolean; profileRevision: string }>
}
export async function verifyRegistrationWith(
  input: MobileAuthVerification,
  deps: RegistrationVerificationDependencies,
  flow: "registration" | "login" = "registration",
) {
  const { config, store } = deps
  const current = await store.read(input.attemptId)
  if (
    !current ||
    current.flow !== flow ||
    current.superseded_at ||
    current.verified_at ||
    !current.provider_user_id ||
    !current.code_key_id ||
    Date.parse(current.expires_at) <= Date.now()
  )
    invalid()
  requireRegistrationEmail(current.email, config)
  let proof: RegistrationClaims | null = null
  if (input.tokenHash) {
    try {
      proof = await openRegistrationCredential(config, input.tokenHash, "registration_verification")
    } catch {
      invalid()
    }
    if (
      proof.attemptId !== current.id ||
      proof.sendGeneration !== current.send_generation ||
      proof.requestHash !== current.request_hash ||
      proof.email !== current.email ||
      proof.userId !== current.provider_user_id
    )
      invalid()
  }
  const digest = input.code
    ? await registrationCodeDigest(
        config,
        requestClaims(current),
        input.code,
        current.code_key_id ?? "",
      )
    : null
  const claim = await store.claim(current.id, current.send_generation, digest)
  if (!claim) invalid()
  try {
    const session = await deps.verify(claim, input, proof)
    if (
      !session ||
      session.user.id !== claim.provider_user_id ||
      session.user.email?.toLowerCase() !== claim.email
    )
      invalid()
    const identity = await deps.identity(session.access_token, claim.email, session.user.id)
    if (!(await store.finish(claim, session.user.id, claim.email))) invalid()
    const dto = sessionDTO(session)
    if (flow === "login")
      return {
        session: dto,
        email: claim.email,
        authority: {
          attemptId: claim.id,
          userId: session.user.id,
          email: claim.email,
          requestHash: claim.request_hash,
          sendGeneration: claim.send_generation,
          session: dto,
        },
      }
    const profile = await deps.profile(session.user.id)
    const completionToken = await sealRegistrationCredential(config, {
      ...requestClaims(claim),
      purpose: "registration_completion",
      userId: session.user.id,
      credential: session.access_token,
      refreshToken: session.refresh_token,
      sessionId: identity.sessionId,
      sessionExpiresAt: identity.expiresAt,
      expiresAt: registrationCredentialExpiry(
        Math.floor(Date.parse(claim.expires_at) / 1000),
        config.expiresAt,
        identity.expiresAt,
      ),
    })
    return { userId: session.user.id, ...profile, completionToken }
  } finally {
    await store.release(claim)
  }
}
function dependencies(client: SupabaseClient): RegistrationVerificationDependencies {
  const provider = mobileProvider()
  return {
    config: registrationConfig(),
    store: registrationStore(client),
    async verify(intent, input, proof) {
      const { data, error } = await provider.auth.verifyOtp(
        input.code
          ? { email: intent.email, token: input.code, type: "email" }
          : { token_hash: proof!.credential!, type: "email" },
      )
      unavailable(error)
      return error ? null : data.session
    },
    identity: (token, email, userId) => providerIdentity(token, email, userId, undefined, provider),
    async profile(userId) {
      const [profile, clock] = await Promise.all([
        client.from("hair_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
        client
          .from("scanner_context_sources")
          .select("profile_revision")
          .eq("user_id", userId)
          .maybeSingle(),
      ])
      if (profile.error || clock.error) throw new MobileError("temporarily_unavailable", 503)
      return {
        hasExistingProfile: !!profile.data,
        profileRevision: String(clock.data?.profile_revision ?? 0),
      }
    },
  }
}
export async function verifyMobileRegistration(
  input: MobileAuthVerification,
  client = createAdminClient(),
) {
  return verifyRegistrationWith(input, dependencies(client))
}
export type RegistrationAuthority = {
  attemptId: string
  userId: string
  email: string
  requestHash: string
  sendGeneration: string
  session: MobileSession
}
export async function verifyRegisteredLogin(
  input: MobileAuthVerification,
  client = createAdminClient(),
) {
  const result = await verifyRegistrationWith(input, dependencies(client), "login")
  if (!result.session || !result.email || !result.authority) invalid()
  const loaded = await loadSharedScannerContext(client, result.authority.userId)
  if (!loaded) return createProfileCompletionCapability(result.authority, client)
  return enrollReadyRegisteredSession(
    result.authority,
    { profileRevision: loaded.source.profileRevision, contextRevision: loaded.contextRevision },
    client,
  )
}
async function validateCompletion(
  token: string,
  purpose: "registration_completion" | "profile_completion",
  client: SupabaseClient,
): Promise<RegistrationAuthority> {
  const config = registrationConfig()
  let proof: RegistrationClaims
  try {
    proof = await openRegistrationCredential(config, token, purpose)
  } catch {
    invalid()
  }
  const intent = await registrationStore(client).read(proof.attemptId)
  if (
    !intent ||
    (purpose === "registration_completion" && intent.flow !== "registration") ||
    intent.superseded_at ||
    !intent.verified_at ||
    intent.verified_user_id !== proof.userId ||
    intent.provider_user_id !== proof.userId ||
    intent.email !== proof.email ||
    intent.request_hash !== proof.requestHash ||
    intent.send_generation !== proof.sendGeneration ||
    (!intent.completed_at && Date.parse(intent.expires_at) <= Date.now())
  )
    invalid()
  await providerIdentity(proof.credential!, proof.email, proof.userId!, proof.sessionId)
  return {
    attemptId: proof.attemptId,
    userId: proof.userId!,
    email: proof.email,
    requestHash: proof.requestHash,
    sendGeneration: proof.sendGeneration,
    session: {
      accessToken: proof.credential!,
      refreshToken: proof.refreshToken!,
      expiresAt: proof.sessionExpiresAt!,
      userId: proof.userId!,
    },
  }
}
export function validateRegistrationCompletion(token: string, client = createAdminClient()) {
  return validateCompletion(token, "registration_completion", client)
}
export function validateProfileCompletionCapability(token: string, client = createAdminClient()) {
  return validateCompletion(token, "profile_completion", client)
}
/** Untrusted dispatch hint only. Validation still requires AEAD, exact purpose and authoritative identity. */
export function isProfileCompletionCredential(raw: string) {
  try {
    return decodeProtectedHeader(raw).typ === "chaarlie-profile-completion+jwe"
  } catch {
    return false
  }
}
export async function createProfileCompletionCapability(
  authority: RegistrationAuthority,
  client = createAdminClient(),
) {
  const config = registrationConfig()
  requireRegistrationEmail(authority.email, config)
  const intent = await registrationStore(client).read(authority.attemptId)
  if (
    !intent ||
    intent.superseded_at ||
    !intent.verified_at ||
    intent.verified_user_id !== authority.userId ||
    intent.provider_user_id !== authority.userId ||
    intent.email !== authority.email ||
    intent.request_hash !== authority.requestHash ||
    intent.send_generation !== authority.sendGeneration ||
    Date.parse(intent.expires_at) <= Date.now()
  )
    invalid()
  const identity = await providerIdentity(
    authority.session.accessToken,
    authority.email,
    authority.userId,
  )
  const { data: clock, error } = await client
    .from("scanner_context_sources")
    .select("profile_revision")
    .eq("user_id", authority.userId)
    .maybeSingle()
  if (error) throw new MobileError("temporarily_unavailable", 503)
  const completionToken = await sealRegistrationCredential(config, {
    ...requestClaims(intent),
    purpose: "profile_completion",
    userId: authority.userId,
    credential: authority.session.accessToken,
    refreshToken: authority.session.refreshToken,
    sessionId: identity.sessionId,
    sessionExpiresAt: identity.expiresAt,
    expiresAt: registrationCredentialExpiry(
      Math.floor(Date.parse(intent.expires_at) / 1000),
      config.expiresAt,
      identity.expiresAt,
    ),
  })
  return {
    status: "profile_required" as const,
    completionToken,
    profileRevision: String(clock?.profile_revision ?? 0),
  }
}
export async function recordDeferredRegistrationKeep(
  authority: RegistrationAuthority,
  submission: RegistrationSubmission,
  expectedProfileRevision: string,
  client = createAdminClient(),
) {
  requireRegistrationEmail(authority.email)
  if (
    submission.email !== authority.email ||
    registrationSubmissionHash(submission) !== authority.requestHash
  )
    invalid()
  const { data, error } = await client.rpc("mobile_registration_defer_keep", {
    p_attempt_id: authority.attemptId,
    p_send_generation: authority.sendGeneration,
    p_user_id: authority.userId,
    p_email: authority.email,
    p_request_hash: authority.requestHash,
    p_expected_profile_revision: expectedProfileRevision,
    p_marketing_opt_in: submission.marketingOptIn,
  })
  if (error) throw new MobileError("temporarily_unavailable", 503)
  if (data?.outcome === "profile_conflict") throw new MobileError("profile_conflict", 409)
  if (data?.outcome !== "pending") invalid()
}
export async function enrollReadyRegisteredSession(
  authority: RegistrationAuthority,
  bootstrap: { profileRevision: string; contextRevision: string },
  client = createAdminClient(),
) {
  requireRegistrationEmail(authority.email)
  // Revalidate provider identity before any admission mutation, even on receipt retry.
  await providerIdentity(authority.session.accessToken, authority.email, authority.userId)
  const { data, error } = await client.rpc("mobile_registration_enroll_ready", {
    p_attempt_id: authority.attemptId,
    p_send_generation: authority.sendGeneration,
    p_user_id: authority.userId,
    p_email: authority.email,
    p_request_hash: authority.requestHash,
    p_context_revision: bootstrap.contextRevision,
    p_profile_revision: bootstrap.profileRevision,
  })
  if (error) throw new MobileError("temporarily_unavailable", 503)
  if (data?.outcome === "profile_conflict") throw new MobileError("profile_conflict", 409)
  if (data?.outcome !== "ready") invalid()
  return issueRegisteredSession(authority.session, authority.email, client)
}
