import { NextResponse, type NextRequest } from "next/server"

import {
  decodePersonalPlanQuizDraftCookie,
  isSameOriginRequest,
  noStoreHeaders,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  personalPlanQuizDraftCookieOptions,
} from "@/lib/personal-plan-quiz/server-draft"
import {
  isValidPersonalPlanResultReturnToken,
  PERSONAL_PLAN_RESULT_RETURN_COOKIE,
  revokePersonalPlanResultReturn,
} from "@/lib/personal-plan-quiz/result-return"
import { checkRateLimit, PERSONAL_PLAN_QUIZ_DRAFT_IP_RATE_LIMIT } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

type ResetResponse = NextResponse<unknown>

type ResetDependencies = {
  checkRateLimit: typeof checkRateLimit
  resetServerCapabilities: (request: Request, response: ResetResponse) => Promise<void>
}

type ServerResetDependencies = {
  createAdminClient: typeof createAdminClient
  revokeResultReturn: typeof revokePersonalPlanResultReturn
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function isTrustedBrowserMutation(request: Request) {
  if (!isSameOriginRequest(request)) return false
  const fetchSite = request.headers.get("sec-fetch-site")
  return fetchSite === null || fetchSite === "same-origin"
}

function readCookie(request: Request, name: string) {
  const nextCookie = (request as NextRequest).cookies?.get(name)?.value
  if (nextCookie) return nextCookie
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=")
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(item.slice(separator + 1).trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

export async function resetPersonalPlanServerCapabilities(
  request: Request,
  response: ResetResponse,
  overrides: Partial<ServerResetDependencies> = {},
) {
  const dependencies: ServerResetDependencies = {
    createAdminClient,
    revokeResultReturn: revokePersonalPlanResultReturn,
    ...overrides,
  }
  const admin = dependencies.createAdminClient()
  const resultCookie = readCookie(request, PERSONAL_PLAN_RESULT_RETURN_COOKIE)
  const draftCookie = decodePersonalPlanQuizDraftCookie(
    readCookie(request, PERSONAL_PLAN_QUIZ_DRAFT_COOKIE),
  )

  const resultReset = dependencies
    .revokeResultReturn({
      cookieValue: resultCookie,
      response,
      admin: admin as never,
    })
    .then((result) => {
      if (isValidPersonalPlanResultReturnToken(resultCookie) && !result.revoked) {
        throw new Error("result capability reset failed")
      }
    })
  const draftReset = draftCookie
    ? admin
        .rpc("revoke_personal_plan_quiz_draft", {
          p_draft_id: draftCookie.draftId,
          p_browser_generation: draftCookie.browserGeneration,
        })
        .then(({ error }) => {
          if (error) throw error
        })
    : Promise.resolve()

  await Promise.all([resultReset, draftReset])
  response.cookies.set(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE, "", {
    ...personalPlanQuizDraftCookieOptions,
    maxAge: 0,
  })
}

export function createPersonalPlanResultReturnResetPostHandler(
  overrides: Partial<ResetDependencies> = {},
) {
  const dependencies: ResetDependencies = {
    checkRateLimit,
    resetServerCapabilities: resetPersonalPlanServerCapabilities,
    ...overrides,
  }

  return async function POST(request: Request) {
    if (!isTrustedBrowserMutation(request)) {
      return NextResponse.json(
        { error: "invalid_request" },
        { status: 400, headers: noStoreHeaders() },
      )
    }

    const rateLimit = await dependencies.checkRateLimit(
      requestIp(request),
      PERSONAL_PLAN_QUIZ_DRAFT_IP_RATE_LIMIT,
    )
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.error ?? "rate_limited" },
        { status: rateLimit.error ? 503 : 429, headers: noStoreHeaders() },
      )
    }

    const response = new NextResponse(null, { status: 204, headers: noStoreHeaders() })
    try {
      await dependencies.resetServerCapabilities(request, response)
      return response
    } catch {
      console.warn("[personal-plan-result-return] reset unavailable")
      return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStoreHeaders() })
    }
  }
}

export const POST = createPersonalPlanResultReturnResetPostHandler()
