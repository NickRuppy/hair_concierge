import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import {
  QUIZ_EMAIL_RETURN_COOKIE,
  QUIZ_EMAIL_RETURN_EDIT_COOKIE,
  QUIZ_EMAIL_RETURN_PACKAGE_KEY,
} from "@/lib/quiz/email-return-context"
import {
  resolveQuizEmailReturnCookie,
  resolveQuizEmailReturnSourceIdentity,
} from "@/lib/quiz/email-return-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ContextDependencies = {
  cookieStore: typeof cookies
  resolveSource: typeof resolveQuizEmailReturnCookie
  resolveIdentity: typeof resolveQuizEmailReturnSourceIdentity
  resolveFunnel: typeof resolveFunnelCookieContext
}

export function createQuizEmailReturnContextHandler(overrides: Partial<ContextDependencies> = {}) {
  const dependencies: ContextDependencies = {
    cookieStore: cookies,
    resolveSource: resolveQuizEmailReturnCookie,
    resolveIdentity: resolveQuizEmailReturnSourceIdentity,
    resolveFunnel: resolveFunnelCookieContext,
    ...overrides,
  }

  return async function GET(request?: Request) {
    const cookieStore = await dependencies.cookieStore()
    const wantsEditIdentity = request
      ? new URL(request.url).searchParams.get("mode") === "edit"
      : false

    let payload: Record<string, unknown>
    if (!wantsEditIdentity) {
      const resolved = await dependencies.resolveSource(
        cookieStore.get(QUIZ_EMAIL_RETURN_COOKIE)?.value,
      )
      payload = { status: resolved.status }
    } else {
      const returnCookieValue = cookieStore.get(QUIZ_EMAIL_RETURN_COOKIE)?.value
      const editCookieValue = cookieStore.get(QUIZ_EMAIL_RETURN_EDIT_COOKIE)?.value
      const funnel = await dependencies.resolveFunnel(cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)
      if (
        funnel?.packageKey !== QUIZ_EMAIL_RETURN_PACKAGE_KEY ||
        !returnCookieValue ||
        editCookieValue !== returnCookieValue
      ) {
        payload = { status: "invalid" }
      } else {
        const resolved = await dependencies.resolveIdentity(returnCookieValue)
        payload =
          resolved.status === "resolved"
            ? {
                status: "resolved",
                lead: {
                  name: resolved.identity.name,
                  email: resolved.identity.email,
                  marketingConsent: resolved.identity.marketingConsent,
                },
              }
            : { status: resolved.status }
      }
    }

    const response = NextResponse.json(payload)
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("Referrer-Policy", "no-referrer")
    return response
  }
}

export const GET = createQuizEmailReturnContextHandler()
