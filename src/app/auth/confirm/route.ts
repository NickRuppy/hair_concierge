import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import type { PersonalPlanJourneyAccess } from "@/lib/personal-plan/journey-access"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { isModeratorReturnPath } from "@/lib/auth/moderator-return"

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
}

export type AuthConfirmRouteDeps = {
  createClient: () => Promise<AuthConfirmClient>
  linkQuizToProfile: (userId: string, email?: string, leadId?: string) => Promise<unknown>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
}

const defaultDeps: AuthConfirmRouteDeps = {
  createClient: async () => (await createClient()) as unknown as AuthConfirmClient,
  linkQuizToProfile,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
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
    if (/(?:access|refresh)?_?token|token_hash|code|error/i.test(redirectUrl.hash)) {
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
    if (user && !isModeratorReturnPath(next)) {
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

  return deps.redirect(buildExpiredLinkDestination(origin, next, isRecovery))
}

export function createAuthConfirmGetHandler(deps: AuthConfirmRouteDeps) {
  return (request: Request) => handleAuthConfirmGet(request, deps)
}

export async function GET(request: Request) {
  return handleAuthConfirmGet(request, defaultDeps)
}
