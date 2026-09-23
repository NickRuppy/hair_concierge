import { randomBytes } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { hasCurrentPaidAppAccess } from "@/lib/billing/subscriptions"
import {
  bindDiscoveryEnrollmentEmail,
  checkDiscoveryAccessKind,
  claimDiscoveryEnrollment,
  loadDiscoveryEnrollment,
  stampDiscoveryAccess,
  type DiscoveryAccessKindCheck,
  type DiscoveryClaimResult,
  type DiscoveryEnrollment,
  type DiscoveryStampResult,
} from "@/lib/discovery/enrollment"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import {
  discoveryInviteCookieOptions,
  DISCOVERY_INVITE_COOKIE,
  readDiscoveryCredentialInput,
} from "@/lib/discovery/invite-session"
import {
  DISCOVERY_CLAIM_SIGNED_IN_OTHER_ACCOUNT,
  DISCOVERY_CONTINUATION_PATH,
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
 *
 * The account's address is whatever the participant submits with „Los geht's"
 * (the invite may have been created with just a name). It is bound to the
 * enrollment before the account or the magic link is touched; an unclaimed
 * enrollment may be re-bound (typo fix), a claimed one never moves. Nick accepted
 * the missing verification step: discovery access grants nothing paid.
 */

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const UNAVAILABLE = "Diese Einladung ist nicht verfügbar."
const SERVICE_UNAVAILABLE = "Dein Zugang ist gerade nicht verfügbar."
const WRONG_ACCOUNT = "Dieses Konto kann diese Einladung nicht nutzen."
const ALREADY_CLAIMED = "Diese Einladung wurde bereits eingelöst."
const EXISTING_PAID_ACCESS =
  "Dieses Konto hat bereits vollen Zugang zu Chaarlie. Melde dich kurz bei uns, dann klären wir das persönlich."
const EMAIL_REQUIRED = "Bitte gib deine E-Mail-Adresse ein."
const EMAIL_INVALID = "Bitte prüf deine E-Mail-Adresse."
/**
 * Deliberately says nothing about WHY: „gehört zu einer anderen Einladung" would confirm to
 * anyone holding a link that an address has an active invite. (The admin create form keeps
 * its specific message — the admin may know.)
 */
const EMAIL_UNAVAILABLE =
  "Mit dieser E-Mail-Adresse geht es gerade nicht. Nimm eine andere oder melde dich bei Nick."
const EMAIL_BOUND = "Diese Einladung ist schon mit einer anderen E-Mail-Adresse verbunden."
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EXISTING_ACCESS_KIND =
  "Dieses Konto gehört schon zu einem anderen Chaarlie-Zugang. Melde dich kurz bei uns, dann klären wir das persönlich."

type SessionUser = { id: string; email?: string }

type ClaimDependencies = {
  decodeCredential: typeof decodeDiscoveryEnrollmentCredential
  signingSecret: () => string
  flagEnabled: () => boolean
  loadEnrollment: typeof loadDiscoveryEnrollment
  claimEnrollment: typeof claimDiscoveryEnrollment
  bindEmail: typeof bindDiscoveryEnrollmentEmail
  checkAccessKind: typeof checkDiscoveryAccessKind
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
    // The magic-link continuation arrives with its credential in the request
    // body. It WINS over the cookie: the same browser may still hold a cookie
    // from an older invitation (a rotated link, or a different participant on a
    // shared device), and the body handoff is the one the participant just
    // proved ownership of by following the e-mail. The cookie is only the
    // fallback for the ordinary invite-page claim, which sends no body.
    const body = await readClaimBody(request)
    const handoffCredential = body.handoff
    const credential = handoffCredential ?? cookieCredential
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

    // The address this claim runs on: what the participant typed on the invite page,
    // else the one already bound (the admin entered it, or an earlier attempt bound
    // it — the magic-link continuation sends no e-mail and relies on exactly that).
    if (body.email === "empty") {
      return copyResponseCookies(response, jsonError(EMAIL_REQUIRED, 400))
    }
    if (body.email === "invalid") {
      return copyResponseCookies(response, jsonError(EMAIL_INVALID, 400))
    }
    const email = body.email ?? enrollment.email
    if (!email) return copyResponseCookies(response, jsonError(EMAIL_REQUIRED, 400))
    // Once claimed, the enrollment is bound to that account's address for good.
    if (enrollment.claimedUserId && email !== enrollment.email) {
      return copyResponseCookies(response, jsonError(EMAIL_BOUND, 409))
    }

    // Both refusals mean the SAME thing to the browser: a different account is signed in
    // (typically a tester's earlier participant). The code lets the invite page say so.
    if (user) {
      if (user.email?.trim().toLowerCase() !== email) {
        return copyResponseCookies(response, refuseSignedInOtherAccount())
      }
      if (enrollment.claimedUserId && enrollment.claimedUserId !== user.id) {
        return copyResponseCookies(response, refuseSignedInOtherAccount())
      }
      // The refusals sit before every write: an account with current paid access
      // never receives the discovery stamp, never gets bound to the enrollment, and
      // never re-binds its address. A brand-new account cannot reach here, so the
      // check only costs a query on the existing-account branch.
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
      // The second refusal, beside the paid one and for the same reason: an
      // account that already belongs to another access kind (partner,
      // field_test) must not be dragged behind the participant gate, and
      // overwriting its `access_kind` would be irrecoverable. This is the READ
      // half of the stamp, so the refusal still precedes every write while the
      // stamp itself waits for the claim below.
      let accessKind: DiscoveryAccessKindCheck
      try {
        accessKind = await (overrides.checkAccessKind ?? checkDiscoveryAccessKind)(user.id)
      } catch {
        return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
      }
      if (accessKind.status === "foreign_access_kind") {
        return copyResponseCookies(response, refuseForeignAccessKind())
      }
    }

    // Binding the typed address comes before the account and the magic link, both of
    // which use it. Only an unclaimed enrollment is re-bound (a typo fix); the
    // one-live-invite-per-address index refuses an address another invite owns.
    if (email !== enrollment.email) {
      let bound: Awaited<ReturnType<typeof bindDiscoveryEnrollmentEmail>>
      try {
        bound = await (overrides.bindEmail ?? bindDiscoveryEnrollmentEmail)({
          enrollmentId: enrollment.enrollmentId,
          tokenVersion: enrollment.tokenVersion,
          email,
        })
      } catch {
        return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
      }
      if (bound.status === "email_taken") {
        return copyResponseCookies(
          response,
          NextResponse.json(
            { code: "email_unavailable", error: EMAIL_UNAVAILABLE },
            { status: 409, headers: NO_STORE_HEADERS },
          ),
        )
      }
      if (bound.status === "conflict") {
        return copyResponseCookies(response, jsonError(ALREADY_CLAIMED, 409))
      }
      enrollment = bound.enrollment
    }

    let password: string | null = null
    if (!user) {
      // Someone already owns this address, so the only safe way in is a link to
      // it. That covers both a previously claimed enrollment and a plain
      // pre-existing Chaarlie account.
      if (enrollment.claimedUserId) {
        return sendExistingAccountLink({ request, response, credential, email, sendMagicLink })
      }
      try {
        const created = await (overrides.createUser ?? createDiscoveryUser)({
          enrollmentId: enrollment.enrollmentId,
          email,
          name: enrollment.name,
        })
        user = { id: created.userId, email }
        password = created.password
      } catch (error) {
        if (!isExistingUserError(error)) {
          return copyResponseCookies(
            response,
            jsonError("Dein Konto konnte nicht erstellt werden.", 503),
          )
        }
        return sendExistingAccountLink({ request, response, credential, email, sendMagicLink })
      }
    }

    let claim: DiscoveryClaimResult
    try {
      claim = await (overrides.claimEnrollment ?? claimDiscoveryEnrollment)({
        enrollmentId: enrollment.enrollmentId,
        tokenVersion: enrollment.tokenVersion,
        userId: user.id,
        // The address bound above — the claim refuses a row re-bound in between.
        email,
      })
    } catch {
      await rollbackCreatedUser({ overrides, password, userId: user.id })
      return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
    }
    if (claim.status !== "claimed") {
      // Another claim won the compare-and-set, or another attempt re-bound the
      // address in between. The account we just created is bound to nothing, so it
      // must not survive.
      await rollbackCreatedUser({ overrides, password, userId: user.id })
      return copyResponseCookies(response, jsonError(ALREADY_CLAIMED, 409))
    }

    // Deliberately the LAST write of the claim, on BOTH branches. The stamp is what
    // middleware gates on, and a stamp without a live claim strands the account: every
    // discovery surface re-reads the enrollment and 404s, while revocation cannot clear
    // the stamp because it runs off the enrollment row this account is not bound to.
    //
    // A brand-new account is stamped here too rather than inline in `createUser`: the
    // rollback that deletes it on a failed claim can itself fail (its error is
    // swallowed), and a stamped account with no enrollment is exactly the stranded
    // state above — one middleware then trusts. Claiming first turns a stamp failure
    // into a plain retry instead: the claim is idempotent for the same account, so the
    // magic-link continuation re-stamps cleanly.
    let stamp: DiscoveryStampResult
    try {
      stamp = await (overrides.stampDiscoveryAccess ?? stampDiscoveryAccess)({
        userId: user.id,
        enrollmentId: enrollment.enrollmentId,
      })
    } catch {
      return copyResponseCookies(response, jsonError(SERVICE_UNAVAILABLE, 503))
    }
    // Only reachable if the account acquired a foreign `access_kind` between the
    // check above and here; the refusal copy is the same one. A brand-new account
    // cannot reach it at all — it is created with no access kind.
    if (stamp.status === "foreign_access_kind") {
      return copyResponseCookies(response, refuseForeignAccessKind())
    }

    if (password) {
      try {
        await signIn({ email, password })
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

/**
 * Creates the account WITHOUT the discovery stamp: `app_metadata` is written by
 * `stampDiscoveryAccess` after the claim succeeded (see the stamp block above), so a
 * claim that fails can never leave a stamped account with no enrollment behind.
 * `enrollmentId` is still taken — it is what the caller stamps with — but nothing
 * here writes it.
 */
async function createDiscoveryUser(input: { enrollmentId: string; email: string; name: string }) {
  const password = randomBytes(32).toString("base64url")
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.name },
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
  email: string
  sendMagicLink: ClaimDependencies["sendMagicLink"]
}) {
  if (!input.credential) {
    return copyResponseCookies(input.response, jsonError(UNAVAILABLE, 410))
  }
  try {
    const continuation = `${DISCOVERY_CONTINUATION_PATH}#handoff=${encodeURIComponent(input.credential)}`
    await input.sendMagicLink({
      email: input.email,
      redirectTo: `${new URL(input.request.url).origin}/auth/confirm?next=${encodeURIComponent(continuation)}`,
    })
    return copyResponseCookies(
      input.response,
      NextResponse.json(
        { requiresEmail: true, email: input.email },
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

/**
 * `handoff` is the magic-link continuation's credential; `email` is what the
 * participant typed on the invite page. An e-mail that is present but malformed
 * is reported as `"invalid"` so the page can say so instead of silently falling
 * back to the bound address.
 */
async function readClaimBody(
  request: Request,
): Promise<{ handoff: string | null; email: SubmittedEmail }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { handoff: null, email: null }
  }
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  return {
    handoff: readDiscoveryCredentialInput(record.handoff),
    email: readSubmittedEmail(record.email),
  }
}

/** `null` = not sent at all (the continuation); `"empty"` = the field was sent blank. */
type SubmittedEmail = string | null | "empty" | "invalid"

function readSubmittedEmail(value: unknown): SubmittedEmail {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return "invalid"
  const email = value.trim().toLowerCase()
  if (!email) return "empty"
  return EMAIL.test(email) && email.length <= 320 ? email : "invalid"
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

function refuseSignedInOtherAccount() {
  return NextResponse.json(
    { code: DISCOVERY_CLAIM_SIGNED_IN_OTHER_ACCOUNT, error: WRONG_ACCOUNT },
    { status: 403, headers: NO_STORE_HEADERS },
  )
}

function refuseForeignAccessKind() {
  return NextResponse.json(
    { code: "existing_access_kind", error: EXISTING_ACCESS_KIND },
    { status: 403, headers: NO_STORE_HEADERS },
  )
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}
