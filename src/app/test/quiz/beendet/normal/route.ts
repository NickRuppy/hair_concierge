import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
  regularQuizFieldTestCampaignCookieOptions,
} from "@/lib/personal-plan-field-test"

type LeaveRegularQuizFieldTestDependencies = {
  releaseFieldTestSession: (request: NextRequest, response: NextResponse) => Promise<boolean>
}

export function createLeaveRegularQuizFieldTestHandler(
  dependencies: LeaveRegularQuizFieldTestDependencies = {
    releaseFieldTestSession,
  },
) {
  return async function GET(request: NextRequest) {
    const response = NextResponse.redirect(new URL("/quiz", request.url), 303)
    if (!(await dependencies.releaseFieldTestSession(request, response))) {
      const errorResponse = NextResponse.json(
        { error: "Testzugang konnte nicht beendet werden" },
        { status: 503 },
      )
      for (const cookie of response.cookies.getAll()) errorResponse.cookies.set(cookie)
      return errorResponse
    }
    response.cookies.set(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE, "", {
      ...regularQuizFieldTestCampaignCookieOptions,
      maxAge: 0,
    })
    return response
  }
}

async function releaseFieldTestSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  // No auth session is the normal pre-activation ended-link case. Only a real
  // auth failure should prevent clearing the campaign cookie.
  if (!mayReleaseRegularQuizFieldTestSession(userError)) return false
  if (
    user?.app_metadata?.access_kind !== "field_test" ||
    user.app_metadata.field_test_flow !== "regular_quiz"
  ) {
    return true
  }
  const { error } = await supabase.auth.signOut({ scope: "local" })
  return !error
}

export function mayReleaseRegularQuizFieldTestSession(error: { name: string } | null) {
  return !error || error.name === "AuthSessionMissingError"
}

export const GET = createLeaveRegularQuizFieldTestHandler()
