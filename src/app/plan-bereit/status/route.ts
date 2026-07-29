import { NextResponse } from "next/server"
import { z } from "zod"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { loadPersonalPlanReadiness } from "../readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return resolveStatus(request, false)
}

export async function POST(request: Request) {
  return resolveStatus(request, true)
}

async function resolveStatus(request: Request, retryLink: boolean) {
  const leadResult = z.string().uuid().safeParse(new URL(request.url).searchParams.get("lead"))
  if (!leadResult.success) {
    return NextResponse.json({ status: "invalid_lead" }, { status: 400 })
  }
  const leadId = leadResult.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 })
  }

  const admin = createAdminClient()
  const active = await hasCurrentAppAccess(admin, { userId: user.id, email: user.email })
  if (!active) {
    return NextResponse.json({ status: "subscription_required" }, { status: 403 })
  }

  try {
    let readiness = await loadPersonalPlanReadiness(admin, user.id, user.email, leadId)
    if (retryLink && readiness.leadId && !readiness.ready) {
      await linkQuizToProfile(user.id, user.email, readiness.leadId)
      readiness = await loadPersonalPlanReadiness(admin, user.id, user.email, leadId)
    }

    return NextResponse.json(
      { status: readiness.ready ? "ready" : "pending" },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[plan-bereit] readiness failed", error)
    return NextResponse.json(
      { status: "error" },
      { headers: { "Cache-Control": "private, no-store" }, status: 500 },
    )
  }
}
