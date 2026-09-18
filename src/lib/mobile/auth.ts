import "server-only"
import { createHash } from "node:crypto"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimitWithRpc } from "@/lib/rate-limit"
import type { MobileSession } from "./contracts"
import type { MobileAuthDependencies } from "./auth-service"

import { decodeJwt } from "jose"
import { MobileError } from "./errors"
import {
  registrationConfig,
  isRegistrationSessionCredential,
  requireRegisteredUser,
  refreshRegisteredSession,
} from "./registration-auth"
import {
  mobilePolicy,
  mobileCredential,
  requireMobileEmail,
  eligibleAccount,
  sealCredential,
  type MobilePolicy,
  type CredentialClaims,
} from "./pilot"
export { MobileError } from "./errors"

export function mobileEnabled() {
  try {
    mobilePolicy()
  } catch (error) {
    if (process.env.MOBILE_REGISTRATION_ENABLED !== "true") throw error
    registrationConfig()
  }
}

export function mobileProvider() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )
}

export function sessionDTO(session: Session): MobileSession {
  if (!session.expires_at) throw new MobileError("temporarily_unavailable", 503)
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    userId: session.user.id,
  }
}

function providerFailure(error: { status?: number } | null) {
  if (error && (!error.status || error.status >= 500))
    throw new MobileError("temporarily_unavailable", 503)
}

export async function requirePinnedProviderIdentity(
  email: string,
  client: SupabaseClient,
  policy = mobilePolicy(),
) {
  if (policy.mode === "local") return
  const account = eligibleAccount(policy.config, email)
  if (!account) throw new MobileError("unauthorized", 401)
  // An email can move or be reused; pin the current provider identity before OTP/rotation.
  const { data, error } = await client.auth.admin.getUserById(account.userId)
  providerFailure(error)
  if (
    error ||
    !data.user ||
    data.user.is_anonymous ||
    data.user.id !== account.userId ||
    data.user.email?.toLowerCase() !== account.email
  )
    throw new MobileError("unauthorized", 401)
}

async function verifiedIdentity(
  token: string,
  policy: MobilePolicy,
  expected?: CredentialClaims | null,
) {
  const { data, error } = await mobileProvider().auth.getUser(token)
  providerFailure(error)
  if (error || !data.user || data.user.is_anonymous) throw new MobileError("unauthorized", 401)
  if (policy.mode === "local") return { user: data.user, sessionId: null, expiresAt: null }
  const email = data.user.email?.toLowerCase()
  const account = email && eligibleAccount(policy.config, email)
  if (!account || account.userId !== data.user.id) throw new MobileError("unauthorized", 401)
  // Decode only the exact token whose signature/identity Auth just validated.
  let claims
  try {
    claims = decodeJwt(token)
  } catch {
    throw new MobileError("unauthorized", 401)
  }
  const sid = claims.session_id
  if (
    claims.sub !== data.user.id ||
    typeof sid !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sid) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp! <= Math.floor(Date.now() / 1000) ||
    (expected &&
      (expected.userId !== data.user.id || expected.email !== email || expected.sessionId !== sid))
  )
    throw new MobileError("unauthorized", 401)
  return { user: data.user, sessionId: sid, expiresAt: claims.exp! }
}

async function issueMobileSession(
  session: MobileSession & { email: string },
  policy = mobilePolicy(),
): Promise<MobileSession> {
  if (policy.mode === "local")
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      userId: session.userId,
    }
  const claims = decodeJwt(session.accessToken)
  // Called only after verifiedIdentity and the single-use finish succeeds.
  const expiresAt = Math.min(session.expiresAt, claims.exp!, policy.config.expiresAt)
  const binding = {
    userId: session.userId,
    email: session.email.toLowerCase(),
    sessionId: claims.session_id as string,
  }
  const [accessToken, refreshToken] = await Promise.all([
    sealCredential(policy.config, {
      ...binding,
      purpose: "access",
      credential: session.accessToken,
      expiresAt,
    }),
    sealCredential(policy.config, {
      ...binding,
      purpose: "refresh",
      credential: session.refreshToken,
      expiresAt: policy.config.expiresAt,
    }),
  ])
  return { accessToken, refreshToken, expiresAt, userId: session.userId }
}

export async function refreshMobileSession(raw: string): Promise<MobileSession> {
  if (process.env.MOBILE_REGISTRATION_ENABLED === "true" && isRegistrationSessionCredential(raw))
    return refreshRegisteredSession(raw)
  const policy = mobilePolicy()
  const envelope = await mobileCredential(raw, "refresh", policy)
  if (envelope) await requirePinnedProviderIdentity(envelope.email, createAdminClient(), policy)
  const { data, error } = await mobileProvider().auth.refreshSession({
    refresh_token: envelope?.credential ?? raw,
  })
  providerFailure(error)
  if (error || !data.session) throw new MobileError("unauthorized", 401)
  const identity = await verifiedIdentity(data.session.access_token, policy, envelope)
  if (identity.user.id !== data.session.user.id || !identity.user.email)
    throw new MobileError("unauthorized", 401)
  return issueMobileSession({ ...sessionDTO(data.session), email: identity.user.email }, policy)
}

export async function validateMobileVerification(
  input: import("./contracts").MobileAuthVerification,
) {
  const policy = mobilePolicy()
  if (input.tokenHash && policy.mode === "pilot") {
    const proof = await mobileCredential(input.tokenHash, "verification", policy)
    if (proof?.attemptId !== input.attemptId) throw new MobileError("invalid_or_expired_code", 401)
  }
}

export async function requireMobileUser(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")
  if (!match || match[1].length > 8192) throw new MobileError("unauthorized", 401)
  if (
    process.env.MOBILE_REGISTRATION_ENABLED === "true" &&
    isRegistrationSessionCredential(match[1])
  )
    return requireRegisteredUser(match[1])
  const policy = mobilePolicy()
  const envelope = await mobileCredential(match[1], "access", policy)
  const token = envelope?.credential ?? match[1]
  const identity = await verifiedIdentity(token, policy, envelope)
  return { userId: identity.user.id, token, client: createAdminClient() }
}

export async function mobileRateLimit(
  client: SupabaseClient,
  identity: string,
  prefix: string,
  limit: number,
  windowMs: number,
) {
  const digest = createHash("sha256").update(identity).digest("hex")
  const result = await checkRateLimitWithRpc(digest, { prefix, limit, windowMs }, (args) =>
    client.rpc("check_rate_limit", args),
  )
  if (result.error) throw new MobileError("temporarily_unavailable", 503)
  if (!result.allowed) throw new MobileError("rate_limited", 429)
}

export function mobileAuthDependencies(client = createAdminClient()): MobileAuthDependencies {
  const policy = mobilePolicy()
  const provider = mobileProvider()
  return {
    async createAttempt(email) {
      requireMobileEmail(email, policy)
      const { data, error } = await client.rpc("mobile_start_auth_attempt", { p_email: email })
      if (error || !data) throw new MobileError("temporarily_unavailable", 503)
      return data
    },
    async sendCodeAndLink(email, attemptId) {
      requireMobileEmail(email, policy)
      const callback = process.env.MOBILE_AUTH_CALLBACK_URL
      if (!callback) throw new MobileError("temporarily_unavailable", 503)
      const url = new URL(callback)
      url.hash = `attemptId=${attemptId}`
      // no-signup is provider-enforced, never inferred from a profile lookup.
      // Provider rejects unknown accounts without sending; keep the same public response.
      const { error } = await provider.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: url.toString() },
      })
      if (error && (!error.status || error.status >= 500))
        throw new MobileError("temporarily_unavailable", 503)
      if (error?.code === "email_provider_disabled")
        throw new MobileError("temporarily_unavailable", 503)
    },
    async claimVerification(attemptId) {
      if (policy.mode === "pilot") {
        const { data: attempt, error: readError } = await client
          .from("mobile_auth_attempts")
          .select("email")
          .eq("id", attemptId)
          .maybeSingle()
        if (readError) throw new MobileError("temporarily_unavailable", 503)
        if (!attempt || !eligibleAccount(policy.config, attempt.email)) return null
      }
      const { data, error } = await client.rpc("mobile_claim_auth_verification", {
        p_attempt_id: attemptId,
      })
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return typeof data === "string" ? data : null
    },
    async verify(email, input) {
      requireMobileEmail(email, policy)
      await requirePinnedProviderIdentity(email, client, policy)
      const proof = input.tokenHash
        ? await mobileCredential(input.tokenHash, "verification", policy)
        : null
      if (proof && (proof.attemptId !== input.attemptId || proof.email !== email.toLowerCase()))
        return null
      const { data, error } = await provider.auth.verifyOtp(
        input.code
          ? { email, token: input.code, type: "email" }
          : { token_hash: proof?.credential ?? input.tokenHash!, type: "email" },
      )
      if (error && (!error.status || error.status >= 500))
        throw new MobileError("temporarily_unavailable", 503)
      if (error || !data.session || !data.user?.email) return null
      const identity = await verifiedIdentity(data.session.access_token, policy)
      if (identity.user.id !== data.session.user.id || !identity.user.email) return null
      if (
        proof &&
        (proof.userId !== identity.user.id || proof.email !== identity.user.email.toLowerCase())
      )
        return null
      return { ...sessionDTO(data.session), email: identity.user.email }
    },
    issueSession: (session) => issueMobileSession(session, policy),
    async finish(attemptId) {
      const { data, error } = await client
        .from("mobile_auth_attempts")
        .update({ consumed: true })
        .eq("id", attemptId)
        .eq("consumed", false)
        .gt("expires_at", new Date().toISOString())
        .select("id")
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return data?.length === 1
    },
  }
}

export function mobileJSON(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function mobileRoute(run: () => Promise<Response>): Promise<Response> {
  try {
    mobileEnabled()
    return await run()
  } catch (error) {
    // Never attach bearer, OTP, email or profile payload to telemetry.
    if (error instanceof MobileError) return mobileJSON({ error: error.code }, error.status)
    return mobileJSON({ error: "temporarily_unavailable" }, 503)
  }
}

export async function mobileBody(request: Request, maxBytes = 12288) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 24576)
    throw new MobileError("invalid_request", 400)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new MobileError("invalid_request", 400)
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    throw new MobileError("invalid_request", 400)
  const reader = request.body?.getReader()
  if (!reader) throw new MobileError("invalid_request", 400)
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      throw new MobileError("invalid_request", 400)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const body = new TextDecoder().decode(bytes)
  if (body.length > maxBytes) throw new MobileError("invalid_request", 400)
  try {
    return JSON.parse(body)
  } catch {
    throw new MobileError("invalid_request", 400)
  }
}
