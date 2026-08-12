import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveOneTimeAccessStateForUser as resolveOneTimeAccessState } from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { findPersonalPlanEnrollmentForUser } from "@/lib/personal-plan/enrollment"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  linkExactPlanBereitSourceToProfile,
  loadPlanBereitReadiness,
  updateMissingPlanBereitSourceFact,
  type PlanBereitQuizSourceKind,
} from "../readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return resolveStatus(request, false)
}

export async function POST(request: Request) {
  return resolveStatus(request, true)
}

export async function PATCH(request: Request) {
  return resolveMissingFactPatch(request)
}

const missingFactPatchSchema = z.object({
  field: z.literal("hair_length"),
  value: z.enum(["very_short", "short", "medium", "long", "very_long"]),
  sourceVersion: z.string().min(1),
})

async function resolveCanonicalLead(input: {
  admin: ReturnType<typeof createAdminClient>
  requestedLeadId: string | null
  userId: string
}): Promise<{ leadId: string | null; expectedQuizSourceKind: PlanBereitQuizSourceKind | null }> {
  const enrollment = await findPersonalPlanEnrollmentForUser(input.admin, input.userId)
  const canonicalLeadId = enrollment.artifactLeadId
  if (input.requestedLeadId && input.requestedLeadId !== canonicalLeadId) {
    return { leadId: null, expectedQuizSourceKind: null }
  }
  return {
    leadId: canonicalLeadId,
    expectedQuizSourceKind:
      canonicalLeadId && enrollment.artifactLeadId === canonicalLeadId
        ? enrollment.quizSourceKind
        : null,
  }
}

async function resolveStatus(request: Request, retryLink: boolean) {
  const leadParam = new URL(request.url).searchParams.get("lead")
  const leadResult = leadParam
    ? z.string().uuid().safeParse(leadParam)
    : { success: true, data: null }
  if (!leadResult.success) {
    return NextResponse.json({ status: "invalid_source" }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 })
  }

  const admin = createAdminClient()
  const [active, oneTimeAccessState] = await Promise.all([
    hasCurrentAppAccess(admin, { userId: user.id, email: user.email }),
    resolveOneTimeAccessState(admin, user.id),
  ])
  if (!active && oneTimeAccessState === "paid_pending") {
    return NextResponse.json(
      { status: "paid_pending" },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }
  if (!active) {
    return NextResponse.json({ status: "forbidden" }, { status: 403 })
  }

  try {
    const canonical = await resolveCanonicalLead({
      admin,
      requestedLeadId: leadResult.data,
      userId: user.id,
    })
    if (leadResult.data && canonical.leadId !== leadResult.data) {
      return NextResponse.json(
        { status: "forbidden" },
        { headers: { "Cache-Control": "private, no-store" }, status: 403 },
      )
    }
    const readinessInput = {
      userId: user.id,
      email: user.email,
      leadId: canonical.leadId,
      expectedQuizSourceKind: canonical.expectedQuizSourceKind,
    }
    const readiness = retryLink
      ? await linkExactPlanBereitSourceToProfile(admin, readinessInput)
      : await loadPlanBereitReadiness(admin, readinessInput)

    return NextResponse.json(readiness, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[plan-bereit] readiness failed", error)
    return NextResponse.json(
      { status: "transient_error" },
      { headers: { "Cache-Control": "private, no-store" }, status: 500 },
    )
  }
}

async function resolveMissingFactPatch(request: Request) {
  const leadResult = z.string().uuid().safeParse(new URL(request.url).searchParams.get("lead"))
  if (!leadResult.success) {
    return NextResponse.json({ status: "invalid_source" }, { status: 400 })
  }
  const body = missingFactPatchSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ status: "invalid_source" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 })
  }

  const admin = createAdminClient()
  const [active, oneTimeAccessState] = await Promise.all([
    hasCurrentAppAccess(admin, { userId: user.id, email: user.email }),
    resolveOneTimeAccessState(admin, user.id),
  ])
  if (!active && oneTimeAccessState === "paid_pending") {
    return NextResponse.json(
      { status: "paid_pending" },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }
  if (!active) {
    return NextResponse.json({ status: "forbidden" }, { status: 403 })
  }

  try {
    const canonical = await resolveCanonicalLead({
      admin,
      requestedLeadId: leadResult.data,
      userId: user.id,
    })
    if (canonical.leadId !== leadResult.data) {
      return NextResponse.json(
        { status: "forbidden" },
        { headers: { "Cache-Control": "private, no-store" }, status: 403 },
      )
    }
    const readiness = await updateMissingPlanBereitSourceFact(admin, {
      userId: user.id,
      email: user.email,
      leadId: leadResult.data,
      expectedQuizSourceKind: canonical.expectedQuizSourceKind,
      sourceVersion: body.data.sourceVersion,
      field: body.data.field,
      value: body.data.value,
    })

    return NextResponse.json(readiness, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[plan-bereit] source patch failed", error)
    return NextResponse.json(
      { status: "transient_error" },
      { headers: { "Cache-Control": "private, no-store" }, status: 500 },
    )
  }
}
