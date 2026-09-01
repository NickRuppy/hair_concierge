import { randomBytes, randomUUID } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  encodeFunnelContext,
  funnelSessionCookieOptions,
  FUNNEL_SESSION_COOKIE,
} from "@/lib/funnel/cookie"
import { getFunnelPackageByKey } from "@/lib/funnel/packages"
import {
  createPartnerAccessIntent,
  decodePartnerAccessIntent,
  PARTNER_ACCESS_INTENT_COOKIE,
  PARTNER_ACCESS_INTENT_TTL_SECONDS,
  partnerAccessIntentCookieOptions,
} from "@/lib/partner-access/intent"
import { createAdminClient } from "@/lib/supabase/admin"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const CLAIM_ATTEMPT_COOKIE = "chaarlie_partner_claim_attempt"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Intent = NonNullable<ReturnType<typeof decodePartnerAccessIntent>>
type SessionUser = { id: string; email?: string }
type Invitation = {
  invitationId: string
  name: string
  email: string
  claimedUserId: string | null
  funnelSessionId?: string | null
  funnelVisitorId?: string | null
}

type ClaimDependencies = {
  decodeIntent: typeof decodePartnerAccessIntent
  loadInvitation: (intent: Intent) => Promise<Invitation | null>
  getUser: () => Promise<SessionUser | null>
  reserve: (input: { intent: Intent; attemptId: string }) => Promise<unknown>
  release: (input: { intent: Intent; attemptId: string }) => Promise<unknown>
  createUser: (input: {
    invitationId: string
    email: string
    name: string
  }) => Promise<{ userId: string; password: string }>
  createFunnel: (input: {
    invitationId: string
    userId: string
    now: number
  }) => Promise<{ funnelSessionId: string; visitorId: string }>
  deleteFunnel: (input: { funnelSessionId: string }) => Promise<unknown>
  deleteUser: (input: { userId: string }) => Promise<unknown>
  ensureUserMetadata: (input: {
    invitationId: string
    userId: string
    name: string
  }) => Promise<unknown>
  complete: (input: {
    intent: Intent
    attemptId: string
    userId: string
    funnelSessionId: string
  }) => Promise<unknown>
  signIn: (input: { email: string; password: string }) => Promise<unknown>
  sendMagicLink: (input: { email: string; redirectTo: string }) => Promise<unknown>
  createIntent: typeof createPartnerAccessIntent
  encodeFunnelContext: typeof encodeFunnelContext
  intentSecret: () => string | undefined
  funnelSecret: () => string | undefined
  randomUUID: () => string
  now: () => number
}

export function createPartnerAccessClaimHandler(overrides: Partial<ClaimDependencies> = {}) {
  return async function POST(request: NextRequest) {
    if (!isSameOrigin(request)) return jsonError("Ungültige Anfrage.", 403)
    const intentSecret =
      overrides.intentSecret?.() ?? process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
    const funnelSecret = overrides.funnelSecret?.() ?? process.env.FUNNEL_COOKIE_SIGNING_SECRET
    if (!intentSecret || !funnelSecret) {
      return jsonError("Dein Zugang ist gerade nicht verfügbar.", 503)
    }
    const cookieIntent = request.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value
    const handoffIntent = cookieIntent ? null : await readHandoffIntent(request)
    const encodedIntent = cookieIntent ?? handoffIntent
    const intent = (overrides.decodeIntent ?? decodePartnerAccessIntent)(
      encodedIntent,
      intentSecret,
      (overrides.now ?? Date.now)(),
    )
    if (!intent) return jsonError("Diese Einladung ist nicht verfügbar.", 410)

    const response = NextResponse.json(
      { destination: "/quiz", requiresEmail: false },
      { headers: NO_STORE_HEADERS },
    )
    if (handoffIntent) {
      response.cookies.set(
        PARTNER_ACCESS_INTENT_COOKIE,
        handoffIntent,
        partnerAccessIntentCookieOptions,
      )
    }
    let session: ReturnType<typeof createClaimSession> | null = null
    const getSession = () => (session ??= createClaimSession(request, response))
    const getUser =
      overrides.getUser ??
      (async () => {
        const { data } = await getSession().auth.getUser()
        return data.user ? { id: data.user.id, email: data.user.email } : null
      })
    const signIn =
      overrides.signIn ??
      (async (input) => {
        const { error } = await getSession().auth.signInWithPassword(input)
        if (error) throw error
      })
    const sendMagicLink =
      overrides.sendMagicLink ??
      (async ({ email, redirectTo }) => {
        const { error } = await getSession().auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        })
        if (error) throw error
      })

    let invitation: Invitation | null
    let user: SessionUser | null
    try {
      ;[invitation, user] = await Promise.all([
        (overrides.loadInvitation ?? loadInvitation)(intent),
        getUser(),
      ])
    } catch {
      return copyResponseCookies(
        response,
        jsonError("Dein Zugang ist gerade nicht verfügbar.", 503),
      )
    }
    if (!invitation) return jsonError("Diese Einladung ist nicht verfügbar.", 410)
    if (user?.email?.trim().toLowerCase() !== invitation.email) {
      if (user) return jsonError("Dieses Konto kann diese Einladung nicht nutzen.", 403)
    }
    if (invitation.claimedUserId && user?.id !== invitation.claimedUserId) {
      if (user) return jsonError("Dieses Konto kann diese Einladung nicht nutzen.", 403)
    }

    const savedAttemptId = request.cookies.get(CLAIM_ATTEMPT_COOKIE)?.value
    const attemptId = UUID.test(savedAttemptId ?? "")
      ? savedAttemptId!
      : (overrides.randomUUID ?? randomUUID)()
    response.cookies.set(CLAIM_ATTEMPT_COOKIE, attemptId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60,
    })

    try {
      await (overrides.reserve ?? reserveClaim)({ intent, attemptId })
    } catch {
      return copyResponseCookies(
        response,
        jsonError("Dein Zugang wird gerade geöffnet. Versuch es gleich noch einmal.", 409),
      )
    }

    let password: string | null = null
    if (!user) {
      if (invitation.claimedUserId) {
        return sendExistingAccountLink({
          request,
          response,
          invitation,
          sendMagicLink,
          handoffIntent: createHandoffIntent(intent, intentSecret, overrides),
        })
      }
      try {
        const created = await (overrides.createUser ?? createPartnerUser)({
          invitationId: invitation.invitationId,
          email: invitation.email,
          name: invitation.name,
        })
        user = { id: created.userId, email: invitation.email }
        password = created.password
      } catch (error) {
        if (!isExistingUserError(error)) {
          try {
            await (overrides.release ?? releaseClaim)({ intent, attemptId })
          } catch {
            return copyResponseCookies(
              response,
              jsonError("Dein Zugang konnte nicht geöffnet werden.", 503),
            )
          }
          return copyResponseCookies(
            response,
            jsonError("Dein Konto konnte nicht erstellt werden.", 503),
          )
        }
        try {
          await (overrides.release ?? releaseClaim)({ intent, attemptId })
        } catch {
          return copyResponseCookies(
            response,
            jsonError("Dein Zugang konnte nicht geöffnet werden.", 503),
          )
        }
        return sendExistingAccountLink({
          request,
          response,
          invitation,
          sendMagicLink,
          handoffIntent: createHandoffIntent(intent, intentSecret, overrides),
        })
      }
    }

    let funnel =
      invitation.claimedUserId && invitation.funnelSessionId && invitation.funnelVisitorId
        ? {
            funnelSessionId: invitation.funnelSessionId,
            visitorId: invitation.funnelVisitorId,
          }
        : null
    let createdFunnel = false
    let claimCompleted = false
    try {
      if (!password) {
        await (overrides.ensureUserMetadata ?? ensurePartnerUserMetadata)({
          invitationId: invitation.invitationId,
          userId: user.id,
          name: invitation.name,
        })
      }
      if (!funnel) {
        funnel = await (overrides.createFunnel ?? createPartnerFunnel)({
          invitationId: invitation.invitationId,
          userId: user.id,
          now: (overrides.now ?? Date.now)(),
        })
        createdFunnel = true
      }
      await (overrides.complete ?? completeClaim)({
        intent,
        attemptId,
        userId: user.id,
        funnelSessionId: funnel.funnelSessionId,
      })
      claimCompleted = true
      if (password) await signIn({ email: invitation.email, password })
      const funnelCookie = await (overrides.encodeFunnelContext ?? encodeFunnelContext)(
        {
          visitorId: funnel.visitorId,
          sessionId: funnel.funnelSessionId,
          packageKey: "default_organic",
          issuedAt: (overrides.now ?? Date.now)(),
        },
        funnelSecret,
      )
      response.cookies.set(FUNNEL_SESSION_COOKIE, funnelCookie, funnelSessionCookieOptions)
      return response
    } catch {
      if (!claimCompleted) {
        if (createdFunnel && funnel) {
          try {
            await (overrides.deleteFunnel ?? deletePartnerFunnel)({
              funnelSessionId: funnel.funnelSessionId,
            })
          } catch {}
        }
        if (password) {
          try {
            await (overrides.deleteUser ?? deletePartnerUser)({ userId: user.id })
          } catch {}
        }
        try {
          await (overrides.release ?? releaseClaim)({ intent, attemptId })
        } catch {}
      }
      return copyResponseCookies(
        response,
        jsonError("Dein Zugang konnte nicht geöffnet werden.", 503),
      )
    }
  }
}

export const POST = createPartnerAccessClaimHandler()

async function loadInvitation(intent: Intent): Promise<Invitation | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("partner_access_invitations")
    .select(
      "id,display_name,normalized_email,token_version,claimed_user_id,funnel_session_id,revoked_at",
    )
    .eq("id", intent.invitationId)
    .maybeSingle()
  const row = data as Record<string, unknown> | null
  if (error) throw error
  if (!row || row.revoked_at || row.token_version !== intent.tokenVersion) return null
  let funnelVisitorId: string | null = null
  if (typeof row.funnel_session_id === "string") {
    const result = await admin
      .from("funnel_sessions")
      .select("visitor_id")
      .eq("id", row.funnel_session_id)
      .maybeSingle()
    if (result.error) throw result.error
    funnelVisitorId =
      result.data && typeof (result.data as Record<string, unknown>).visitor_id === "string"
        ? ((result.data as Record<string, unknown>).visitor_id as string)
        : null
  }
  return {
    invitationId: row.id as string,
    name: row.display_name as string,
    email: row.normalized_email as string,
    claimedUserId: typeof row.claimed_user_id === "string" ? row.claimed_user_id : null,
    funnelSessionId: typeof row.funnel_session_id === "string" ? row.funnel_session_id : null,
    funnelVisitorId,
  }
}

async function reserveClaim(input: { intent: Intent; attemptId: string }) {
  const { error } = await createAdminClient().rpc("reserve_partner_access_claim", {
    p_invitation_id: input.intent.invitationId,
    p_token_version: input.intent.tokenVersion,
    p_claim_attempt_id: input.attemptId,
    p_claim_ttl_seconds: 600,
  })
  if (error) throw error
}

async function releaseClaim(input: { intent: Intent; attemptId: string }) {
  const { error } = await createAdminClient().rpc("release_partner_access_claim", {
    p_invitation_id: input.intent.invitationId,
    p_token_version: input.intent.tokenVersion,
    p_claim_attempt_id: input.attemptId,
  })
  if (error) throw error
}

async function createPartnerUser(input: { invitationId: string; email: string; name: string }) {
  const password = randomBytes(32).toString("base64url")
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.name },
    app_metadata: {
      access_kind: "partner",
      partner_access_invitation_id: input.invitationId,
    },
  })
  if (error || !data.user?.id) throw error ?? new Error("Partner user creation failed")
  return { userId: data.user.id, password }
}

async function ensurePartnerUserMetadata(input: {
  invitationId: string
  userId: string
  name: string
}) {
  const admin = createAdminClient()
  const current = await admin.auth.admin.getUserById(input.userId)
  if (current.error || !current.data.user) {
    throw current.error ?? new Error("Partner user metadata is unavailable")
  }
  const { error } = await admin.auth.admin.updateUserById(input.userId, {
    user_metadata: {
      ...(current.data.user.user_metadata ?? {}),
      full_name: current.data.user.user_metadata?.full_name ?? input.name,
    },
    app_metadata: {
      ...(current.data.user.app_metadata ?? {}),
      partner_access_invitation_id: input.invitationId,
    },
  })
  if (error) throw error
}

async function createPartnerFunnel(input: { invitationId: string; userId: string; now: number }) {
  const funnelPackage = getFunnelPackageByKey("default_organic")
  if (!funnelPackage) throw new Error("Organic funnel is unavailable")
  const funnelSessionId = randomUUID()
  const visitorId = randomUUID()
  const { error } = await createAdminClient()
    .from("funnel_sessions")
    .insert({
      id: funnelSessionId,
      visitor_id: visitorId,
      user_id: input.userId,
      package_key: funnelPackage.key,
      channel: funnelPackage.channel,
      landing_variant: funnelPackage.landingVariant,
      offer_variant: funnelPackage.offerVariant,
      quiz_variant: funnelPackage.quizVariant,
      first_seen_at: new Date(input.now).toISOString(),
    })
  if (error) throw error
  return { funnelSessionId, visitorId }
}

async function deletePartnerFunnel(input: { funnelSessionId: string }) {
  const { error } = await createAdminClient()
    .from("funnel_sessions")
    .delete()
    .eq("id", input.funnelSessionId)
    .is("partner_access_invitation_id", null)
  if (error) throw error
}

async function deletePartnerUser(input: { userId: string }) {
  const { error } = await createAdminClient().auth.admin.deleteUser(input.userId)
  if (error) throw error
}

async function completeClaim(input: {
  intent: Intent
  attemptId: string
  userId: string
  funnelSessionId: string
}) {
  const { error } = await createAdminClient().rpc("complete_partner_access_claim", {
    p_invitation_id: input.intent.invitationId,
    p_token_version: input.intent.tokenVersion,
    p_claim_attempt_id: input.attemptId,
    p_user_id: input.userId,
    p_funnel_session_id: input.funnelSessionId,
  })
  if (error) throw error
}

async function sendExistingAccountLink(input: {
  request: Request
  response: NextResponse
  invitation: Invitation
  sendMagicLink: ClaimDependencies["sendMagicLink"]
  handoffIntent: string
}) {
  try {
    const continuation = `/partner/weiter#handoff=${encodeURIComponent(input.handoffIntent)}`
    await input.sendMagicLink({
      email: input.invitation.email,
      redirectTo: `${new URL(input.request.url).origin}/auth/confirm?next=${encodeURIComponent(continuation)}`,
    })
    return copyResponseCookies(
      input.response,
      NextResponse.json(
        { requiresEmail: true, email: input.invitation.email },
        { status: 202, headers: NO_STORE_HEADERS },
      ),
    )
  } catch {
    return copyResponseCookies(
      input.response,
      jsonError("Der Anmeldelink konnte nicht gesendet werden.", 503),
    )
  }
}

function createHandoffIntent(
  intent: Intent,
  secret: string,
  overrides: Partial<ClaimDependencies>,
) {
  const now = (overrides.now ?? Date.now)()
  return (overrides.createIntent ?? createPartnerAccessIntent)(
    {
      invitationId: intent.invitationId,
      tokenVersion: intent.tokenVersion,
      issuedAt: now,
      expiresAt: now + PARTNER_ACCESS_INTENT_TTL_SECONDS * 1000,
    },
    secret,
  )
}

async function readHandoffIntent(request: Request) {
  try {
    const body: unknown = await request.json()
    const handoff =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).handoff
        : null
    return typeof handoff === "string" && handoff.length <= 1024 ? handoff : null
  } catch {
    return null
  }
}

function createClaimSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase auth is unavailable")
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  })
}

function isExistingUserError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const value = error as { code?: unknown; status?: unknown; message?: unknown }
  return (
    value.code === "email_exists" ||
    value.code === "user_already_exists" ||
    (value.status === 422 &&
      typeof value.message === "string" &&
      /registered|exists/i.test(value.message))
  )
}

function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}
