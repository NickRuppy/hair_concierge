import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import type { PersonalPlanJourneyAccess } from "@/lib/personal-plan/journey-access"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { isModeratorReturnPath } from "@/lib/auth/moderator-return"
import { isPartnerAccessReturnPath } from "@/lib/auth/partner-access-return"
import {
  buildFreeRegistrationRecoveryPath,
  isFreeRegistrationConfirmRequest,
  isFreeRegistrationLeadId,
} from "@/lib/auth/free-registration"
import { isFreemiumScannerFirstEnabled } from "@/lib/entitlements/flag"
import { provisionFreeInitialSnapshotForUser } from "@/lib/personal-plan/persistence/free-snapshot-supabase"

type AuthConfirmUser = { id: string; email?: string }

type AuthConfirmClient = {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>
    verifyOtp: (input: { type: EmailOtpType; token_hash: string }) => Promise<{ error: unknown }>
    getUser: () => Promise<{ data: { user: AuthConfirmUser | null } }>
  }
}

type AuthResult = Promise<{ error: unknown | null }>

export interface AuthConfirmDeps {
  exchangeCodeForSession: (code: string) => AuthResult
  verifyOtp: (params: { type: EmailOtpType; token_hash: string }) => AuthResult
  getUser: () => Promise<{ data: { user: AuthConfirmUser | null } }>
  linkQuizToProfile: (userId: string, email?: string, leadId?: string) => Promise<void>
  loadJourneyAccess?: (userId: string) => Promise<PersonalPlanJourneyAccess>
  redirect: (url: string) => Response
  /**
   * Freemium scanner-first (T18). Both are only consulted for a request that
   * carries the free-registration marker (`?free=1`), so every pre-existing
   * confirm path — payment activation included — is byte-identical.
   */
  freemiumScannerFirstEnabled?: () => boolean
  provisionFreeSnapshot?: (input: { userId: string; email?: string }) => Promise<unknown>
}

export type AuthConfirmRouteDeps = {
  createClient: () => Promise<AuthConfirmClient>
  linkQuizToProfile: (userId: string, email?: string, leadId?: string) => Promise<unknown>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  freemiumScannerFirstEnabled?: () => boolean
  provisionFreeSnapshot?: (input: { userId: string; email?: string }) => Promise<unknown>
}

const defaultDeps: AuthConfirmRouteDeps = {
  createClient: async () => (await createClient()) as unknown as AuthConfirmClient,
  linkQuizToProfile,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  freemiumScannerFirstEnabled: isFreemiumScannerFirstEnabled,
  provisionFreeSnapshot: provisionFreeInitialSnapshotForUser,
}

const AUTH_ONLY_QUERY_PARAMETERS = new Set([
  "code",
  "error",
  "reason",
  "token",
  "token_hash",
  "type",
])

function sanitizeAuthIntendedPath(rawNext: string | null, origin: string): string | null {
  if (!rawNext) return null
  if (rawNext.startsWith("//") || rawNext.includes("\\") || rawNext.toLowerCase().includes("%5c")) {
    return null
  }

  try {
    const redirectUrl = rawNext.startsWith("/") ? new URL(rawNext, origin) : new URL(rawNext)
    if (redirectUrl.origin !== origin) return null
    if (
      redirectUrl.pathname === "/auth/confirm" ||
      redirectUrl.pathname.startsWith("/auth/confirm/")
    ) {
      return null
    }

    for (const key of [...redirectUrl.searchParams.keys()]) {
      if (AUTH_ONLY_QUERY_PARAMETERS.has(key.toLowerCase())) {
        redirectUrl.searchParams.delete(key)
      }
    }
    const sanitizedDestination = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
    if (
      /(?:access|refresh)?_?token|token_hash|code|error/i.test(redirectUrl.hash) &&
      !isPartnerAccessReturnPath(sanitizedDestination)
    ) {
      redirectUrl.hash = ""
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
  } catch {
    return null
  }
}

export function sanitizeAuthRedirectPath(rawNext: string | null) {
  return sanitizeAuthIntendedPath(rawNext, "https://auth-redirect.invalid") ?? "/chat"
}

export function resolveAuthIntendedRedirectPath(
  searchParams: URLSearchParams,
  origin: string,
): string | null {
  const next = searchParams.get("next")
  if (next) return sanitizeAuthIntendedPath(next, origin)

  const redirectTo = searchParams.get("redirect_to")
  if (!redirectTo) return null

  try {
    const redirectUrl = new URL(redirectTo, origin)
    if (redirectUrl.origin !== origin) return null
    if (redirectUrl.pathname === "/auth/confirm") {
      return sanitizeAuthIntendedPath(redirectUrl.searchParams.get("next"), origin)
    }
    return sanitizeAuthIntendedPath(
      `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`,
      origin,
    )
  } catch {
    return null
  }
}

export function resolveAuthRedirectPath(searchParams: URLSearchParams, origin: string) {
  return resolveAuthIntendedRedirectPath(searchParams, origin) ?? "/chat"
}

function resolveJourneyFrontier(access: PersonalPlanJourneyAccess): string | null {
  return access.kind === "personal_plan" || access.kind === "personal_plan_start"
    ? access.nextHref
    : null
}

async function handleAuthConfirmGet(request: Request, deps: AuthConfirmRouteDeps) {
  const supabase = await deps.createClient()
  return handleAuthConfirm(request, {
    exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
    verifyOtp: (params) => supabase.auth.verifyOtp(params),
    getUser: () => supabase.auth.getUser(),
    linkQuizToProfile: async (userId, email, leadId) => {
      await deps.linkQuizToProfile(userId, email, leadId)
    },
    loadJourneyAccess: deps.loadJourneyAccess,
    redirect: (url) => NextResponse.redirect(url),
    ...(deps.freemiumScannerFirstEnabled
      ? { freemiumScannerFirstEnabled: deps.freemiumScannerFirstEnabled }
      : {}),
    ...(deps.provisionFreeSnapshot ? { provisionFreeSnapshot: deps.provisionFreeSnapshot } : {}),
  })
}

function isPersonalPlanReplayDestination(next: string, origin: string) {
  const destination = new URL(next, origin)
  return destination.pathname === "/plan-bereit" || destination.pathname === "/plan-start"
}

function buildExpiredLinkDestination(origin: string, next: string, isRecovery: boolean) {
  const destination = new URL("/auth", origin)
  destination.searchParams.set("error", "link_expired")
  if (isRecovery) {
    destination.searchParams.set("force", "login")
    const recoveryNext = new URL("/auth/update-password", origin)
    if (isModeratorReturnPath(next)) recoveryNext.searchParams.set("next", next)
    destination.searchParams.set("next", `${recoveryNext.pathname}${recoveryNext.search}`)
  } else {
    destination.searchParams.set("next", next)
  }
  return destination.toString()
}

export async function handleAuthConfirm(request: Request, deps: AuthConfirmDeps) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const leadId = searchParams.get("lead") ?? undefined
  const intendedNext = resolveAuthIntendedRedirectPath(searchParams, origin)
  const next = resolveAuthRedirectPath(searchParams, origin)
  const isRecovery = type === "recovery" || next === "/auth/update-password"
  // Freemium scanner-first (T18): a link minted by `/api/auth/free-registration`.
  // Everything below is inert for every other confirm request.
  const isFreeRegistration =
    !isRecovery &&
    isFreeRegistrationConfirmRequest(searchParams) &&
    (deps.freemiumScannerFirstEnabled?.() ?? false)
  let verified = false
  let verificationAttempted = false

  // PKCE flow: Supabase SSR sends a `code` param instead of `token_hash`
  if (code) {
    verificationAttempted = true
    const { error } = await deps.exchangeCodeForSession(code)
    if (!error) verified = true
  }

  // OTP flow: magic-link / email-otp sends `token_hash` + `type`
  if (!verified && tokenHash && type) {
    verificationAttempted = true
    const { error } = await deps.verifyOtp({ type, token_hash: tokenHash })
    if (!error) verified = true
  }

  const {
    data: { user },
  } = await deps.getUser()

  if (verified) {
    if (user && !isModeratorReturnPath(next) && !isPartnerAccessReturnPath(next)) {
      try {
        await deps.linkQuizToProfile(user.id, user.email, leadId)
      } catch (e) {
        console.error("linkQuizToProfile failed:", e)
      }
    }

    if (isRecovery) {
      const recoveryUrl = new URL("/auth/update-password", origin)
      if (isModeratorReturnPath(next)) recoveryUrl.searchParams.set("next", next)
      return deps.redirect(recoveryUrl.toString())
    }

    // The free account's scanner prerequisite: derive the initial need snapshot
    // from the quiz artifact just linked above, with the AUTH e-mail supplied
    // (T6 carry-forward — the paid-access guard needs it). Failures never block
    // the landing; the scanner surfaces its own preparing/`profile_missing`
    // state and the next confirm/visit can provision idempotently.
    if (isFreeRegistration && user && deps.provisionFreeSnapshot) {
      try {
        await deps.provisionFreeSnapshot({
          userId: user.id,
          ...(user.email ? { email: user.email } : {}),
        })
      } catch (e) {
        console.error("free snapshot provisioning failed:", e)
      }
    }

    return deps.redirect(`${origin}${next}`)
  }

  if (!isRecovery && user && isPersonalPlanReplayDestination(next, origin)) {
    return deps.redirect(`${origin}${next}`)
  }

  if (verificationAttempted && user && !intendedNext && deps.loadJourneyAccess) {
    try {
      const access = await deps.loadJourneyAccess(user.id)
      const frontier = resolveJourneyFrontier(access)
      if (frontier) return deps.redirect(`${origin}${frontier}`)
    } catch (error) {
      console.warn("Personal Plan auth replay frontier failed:", error)
    }
  }

  // An expired/consumed free-registration link goes back to the registration
  // screen (which explains it in German and can re-send), not to the login
  // form — the account may not exist yet, so `/auth` would be a dead end.
  if (isFreeRegistration) {
    return deps.redirect(
      `${origin}${buildFreeRegistrationRecoveryPath(isFreeRegistrationLeadId(leadId) ? leadId : null)}`,
    )
  }

  return deps.redirect(buildExpiredLinkDestination(origin, next, isRecovery))
}

export function createAuthConfirmGetHandler(deps: AuthConfirmRouteDeps) {
  return (request: Request) => handleAuthConfirmGet(request, deps)
}

export async function GET(request: Request) {
  return handleAuthConfirmGet(request, defaultDeps)
}
