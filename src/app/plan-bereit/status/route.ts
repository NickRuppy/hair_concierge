import { NextResponse } from "next/server"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { loadPersonalPlanReadiness } from "../readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return resolveStatus(false)
}

export async function POST() {
  return resolveStatus(true)
}

async function resolveStatus(retryLink: boolean) {
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
    let readiness = await loadPersonalPlanReadiness(admin, user.id, user.email)
    if (retryLink && readiness.leadId && !readiness.ready) {
      await linkQuizToProfile(user.id, user.email, readiness.leadId)
      readiness = await loadPersonalPlanReadiness(admin, user.id, user.email)
    }

    return NextResponse.json(
      { status: readiness.ready ? "ready" : "pending" },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[plan-bereit] readiness failed", error)
    return NextResponse.json(
      { status: "pending" },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }
}
