import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { QUIZ_EMAIL_RETURN_COOKIE } from "@/lib/quiz/email-return-context"
import { resolveQuizEmailReturnCookie } from "@/lib/quiz/email-return-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const cookieStore = await cookies()
  const resolved = await resolveQuizEmailReturnCookie(
    cookieStore.get(QUIZ_EMAIL_RETURN_COOKIE)?.value,
  )
  const response = NextResponse.json({ status: resolved.status })
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
