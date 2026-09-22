import { randomBytes } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { hasCurrentPaidAppAccess } from "@/lib/billing/subscriptions"
import {
  claimDiscoveryEnrollment,
  loadDiscoveryEnrollment,
  stampDiscoveryAccess,
  type DiscoveryClaimResult,
  type DiscoveryEnrollment,
} from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import {
  discoveryInviteCookieOptions,
  DISCOVERY_INVITE_COOKIE,
  readDiscoveryCredentialInput,
} from "@/lib/discovery/invite-session"
import {
  DISCOVERY_ACCESS_KIND,
  DISCOVERY_CONTINUATION_PATH,
  DISCOVERY_ENROLLMENT_METADATA_KEY,
  DISCOVERY_QUIZ_ENTRY_HREF,
} from "@/lib/discovery/participant"
import {
  decodeDiscoveryEnrollmentCredential,
  discoveryEnrollmentSigningSecret,
} from "@/lib/discovery/token"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Opens a discovery participant's account from their invite credential.
 *
 * Shaped after `POST /api/partner-access/claim`, with two deliberate
 * differences:
 *
 *  1. **A paying account is refused, not adapted.** The partner route only uses
 *     `hasCurrentPaidAppAccess` to decide whether to reset the quiz draft. Here
 *     it is a hard stop: this link creates a *free* discovery-call account, and
 *     stamping `access_kind: "discovery"` onto a paying member's account would
 *     drag them behind the participant middleware gate. Nothing is written on
 *     that path — no stamp, no claim.
 *  2. **No second signed intent.** The invite credential itself is the cookie and
 *     the magic-link handoff; see `invite-session.ts`.
 *
 * The enrollment binding is a compare-and-set inside
 * `claimDiscoveryEnrollment`, so a second concurrent claim loses cleanly instead
 * of overwriting the first.
 */

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const UNAVAILABLE = "Diese Einladung ist nicht verfügbar."
const SERVICE_UNAVAILABLE = "Dein Zugang ist gerade nicht verfügbar."
const WRONG_ACCOUNT = "Dieses Konto kann diese Einladung nicht nutzen."
const ALREADY_CLAIMED = "Diese Einladung wurde bereits eingelöst."
const EXISTING_PAID_ACCESS =
  "Dieses Konto hat bereits vollen Zugang zu Chaarlie. Melde dich kurz bei uns, dann klären wir das persönlich."

type SessionUser = { id: string; email?: string }

type ClaimDependencies = {
  decodeCredential: typeof decodeDiscoveryEnrollmentCredential
  signingSecret: () => string
  flagEnabled: () => boolean
  loadEnrollment: typeof loadDiscoveryEnrollment
  claimEnrollment: typeof claimDiscoveryEnrollment
  stampDiscoveryAccess: typeof stampDiscoveryAccess
  getUser: () => Promise<SessionUser | null>
  hasCurrentPaidAppAccess: (userId: string) => Promise<boolean>
  createUser: (input: {
    enrollmentId: string
    email: string
    name: string
  }) => Promise<{ userId: string; password: string }>
  deleteUser: (input: { userId: string }) => Promise<unknown>
  signIn: (input: { email: string; password: string }) => Promise<unknown>
  sendMagicLink: (input: { email: string; redirectTo: string }) => Promise<unknown>
}

export function createDiscoveryClaimHandler(overrides: Partial<ClaimDependencies> = {}) {
  return async function POST(request: NextRequest) {
    if (!isSameOrigin(request)) return jsonError("Ungültige Anfrage.", 403)
    if (!(overrides.flagEnabled ?? isDiscoveryCallToolkitEnabled)()) {
      return jsonError(UNAVAILABLE, 410)
    }

    let secret: string
    try {
      secret = (overrides.signingSecret ?? (() => discoveryEnrollmentSigningSecret()))()
    } catch {
      return jsonError(SERVICE_UNAVAILABLE, 503)
    }

    const cookieCredential = request.cookies.get(DISCOVERY_INVITE_COOKIE)?.value ?? null
    // The magic-link continuation arrives in a fresh browser context, so its
    // credential travels in the request body instead of the cookie.
    const handoffCredential = cookieCredential ? null : await readHandoffCredential(request)
    const credential = cookieCredential ?? handoffCredential
    const payload = (overrides.decodeCredential ?? decodeDiscoveryEnrollmentCredential)(
      credential,
      secret,
    )
    if (!payload) return jsonError(UNAVAILABLE, 410)

    // Carries the cookies the session client sets; the sent body is rebuilt at
    // each exit so the cookies survive every branch.
    const response = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
    if (handoffCredential) {
      response.cookies.set(DISCOVERY_INVITE_COOKIE, handoffCredential, discoveryInviteCookieOptions)
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

    let enrollment: DiscoveryEnrollment | null
    let user: SessionUser | null
    try {
      ;[enrollment, user] = await Promise.all([
        (overrides.loadEnrollment ?? loadDiscoveryEnrollment)({
          enrollmentId: payload.enrollmentId,
          tokenVersion: payload.tokenVersion,
        }),
        getUser(),
      ])
    } catch {
      return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
    }
    // Revoked, rotated past, or gone. The loader enforces all three.
    if (!enrollment) return copyResponseCookies(response, jsonError(UNAVAILABLE, 410))

    if (user) {
      if (user.email?.trim().toLowerCase() !== enrollment.email) {
        return copyResponseCookies(response, jsonError(WRONG_ACCOUNT, 403))
      }
      if (enrollment.claimedUserId && enrollment.claimedUserId !== user.id) {
        return copyResponseCookies(response, jsonError(WRONG_ACCOUNT, 403))
      }
    }

    let password: string | null = null
    if (!user) {
      // Someone already owns this address, so the only safe way in is a link to
      // it. That covers both a previously claimed enrollment and a plain
      // pre-existing Chaarlie account.
      if (enrollment.claimedUserId) {
        return sendExistingAccountLink({ request, response, credential, enrollment, sendMagicLink })
      }
      try {
        const created = await (overrides.createUser ?? createDiscoveryUser)({
          enrollmentId: enrollment.enrollmentId,
          email: enrollment.email,
          name: enrollment.name,
        })
        user = { id: created.userId, email: enrollment.email }
        password = created.password
      } catch (error) {
        if (!isExistingUserError(error)) {
          return copyResponseCookies(
            response,
            jsonError("Dein Konto konnte nicht erstellt werden.", 503),
          )
        }
        return sendExistingAccountLink({ request, response, credential, enrollment, sendMagicLink })
      }
    } else {
      // The refusal sits before every write: an account with current paid access
      // never receives the discovery stamp and never gets bound to the
      // enrollment. A brand-new account cannot reach here, so the check only
      // costs a query on the existing-account branch.
      let paid: boolean
      try {
        paid = await (overrides.hasCurrentPaidAppAccess ?? hasPaidAppAccessForUser)(user.id)
      } catch {
        return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
      }
      if (paid) {
        return copyResponseCookies(
          response,
          NextResponse.json(
            { code: "existing_paid_access", error: EXISTING_PAID_ACCESS },
            { status: 403, headers: NO_STORE_HEADERS },
          ),
        )
      }
      try {
        await (overrides.stampDiscoveryAccess ?? stampDiscoveryAccess)({
          userId: user.id,
          enrollmentId: enrollment.enrollmentId,
        })
      } catch {
        return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
      }
    }

    let claim: DiscoveryClaimResult
    try {
      claim = await (overrides.claimEnrollment ?? claimDiscoveryEnrollment)({
        enrollmentId: enrollment.enrollmentId,
        tokenVersion: enrollment.tokenVersion,
        userId: user.id,
      })
    } catch {
      await rollbackCreatedUser({ overrides, password, userId: user.id })
      return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
    }
    if (claim.status !== "claimed") {
      // Another claim won the compare-and-set. The account we just created is
      // bound to nothing, so it must not survive.
      await rollbackCreatedUser({ overrides, password, userId: user.id })
      return copyResponseCookies(response, jsonError(ALREADY_CLAIMED, 409))
    }

    if (password) {
      try {
        await signIn({ email: enrollment.email, password })
      } catch {
        return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
      }
    }

    return copyResponseCookies(
      response,
      NextResponse.json(
        { destination: DISCOVERY_QUIZ_ENTRY_HREF, requiresEmail: false },
        { headers: NO_STORE_HEADERS },
      ),
    )
  }
}

export const POST = createDiscoveryClaimHandler()

async function rollbackCreatedUser({
  overrides,
  password,
  userId,
}: {
  overrides: Partial<ClaimDependencies>
  password: string | null
  userId: string
}) {
  if (!password) return
  try {
    await (overrides.deleteUser ?? deleteDiscoveryUser)({ userId })
  } catch {}
}

async function createDiscoveryUser(input: { enrollmentId: string; email: string; name: string }) {
  const password = randomBytes(32).toString("base64url")
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.name },
    app_metadata: {
      access_kind: DISCOVERY_ACCESS_KIND,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: input.enrollmentId,
    },
  })
  if (error || !data.user?.id) throw error ?? new Error("Discovery user creation failed")
  return { userId: data.user.id, password }
}

async function deleteDiscoveryUser(input: { userId: string }) {
  const { error } = await createAdminClient().auth.admin.deleteUser(input.userId)
  if (error) throw error
}

async function hasPaidAppAccessForUser(userId: string): Promise<boolean> {
  return hasCurrentPaidAppAccess(createAdminClient(), { userId })
}

async function sendExistingAccountLink(input: {
  request: Request
  response: NextResponse
  credential: string | null
  enrollment: DiscoveryEnrollment
  sendMagicLink: ClaimDependencies["sendMagicLink"]
}) {
  if (!input.credential) {
    return copyResponseCookies(input.response, jsonError(UNAVAILABLE, 410))
  }
  try {
    const continuation = `${DISCOVERY_CONTINUATION_PATH}#handoff=${encodeURIComponent(input.credential)}`
    await input.sendMagicLink({
      email: input.enrollment.email,
      redirectTo: `${new URL(input.request.url).origin}/auth/confirm?next=${encodeURIComponent(continuation)}`,
    })
    return copyResponseCookies(
      input.response,
      NextResponse.json(
        { requiresEmail: true, email: input.enrollment.email },
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

async function readHandoffCredential(request: Request) {
  try {
    const body: unknown = await request.json()
    const handoff =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).handoff
        : null
    return readDiscoveryCredentialInput(handoff)
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
