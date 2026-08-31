import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveOneTimeAccessStateForUser as resolveOneTimeAccessState } from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { findPersonalPlanEnrollmentForUser } from "@/lib/personal-plan/enrollment"
import { isPersonalPlanAppV1AllowedForUser } from "@/lib/personal-plan/rollout-access"
import {
  beginOrBindPersonalPlanMigration,
  resolvePersonalPlanMigrationAdmission,
} from "@/lib/personal-plan/migration-admission"
import {
  MIGRATION_QUIZ_CONTEXT_COOKIE,
  MIGRATION_QUIZ_HREF,
  createMigrationQuizContextCookie,
  migrationQuizContextCookieOptions,
} from "@/lib/personal-plan/migration-quiz-context"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  linkExactPlanBereitSourceToProfile,
  loadPlanBereitInitialReadiness,
  updateMissingPlanBereitSourceFact,
  needsFreshMigrationQuiz,
  type PlanBereitQuizSourceKind,
} from "../readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type StatusDependencies = {
  createClient: typeof createClient
  createAdminClient: typeof createAdminClient
  hasCurrentAppAccess: typeof hasCurrentAppAccess
  appAllowedForUser: typeof isPersonalPlanAppV1AllowedForUser
  resolveOneTimeAccessState: typeof resolveOneTimeAccessState
  findEnrollment: typeof findPersonalPlanEnrollmentForUser
  resolveMigration: typeof resolvePersonalPlanMigrationAdmission
  beginMigration: typeof beginOrBindPersonalPlanMigration
  loadReadiness: typeof loadPlanBereitInitialReadiness
  linkSource: typeof linkExactPlanBereitSourceToProfile
}

const statusDefaults: StatusDependencies = {
  createClient,
  createAdminClient,
  hasCurrentAppAccess,
  resolveOneTimeAccessState,
  appAllowedForUser: isPersonalPlanAppV1AllowedForUser,
  findEnrollment: findPersonalPlanEnrollmentForUser,
  resolveMigration: resolvePersonalPlanMigrationAdmission,
  beginMigration: beginOrBindPersonalPlanMigration,
  loadReadiness: loadPlanBereitInitialReadiness,
  linkSource: linkExactPlanBereitSourceToProfile,
}

export function createPlanBereitStatusHandlers(overrides: Partial<StatusDependencies> = {}) {
  const deps = { ...statusDefaults, ...overrides }
  return {
    GET: (request: Request) => resolveStatus(request, false, deps),
    POST: (request: Request) => resolveStatus(request, true, deps),
  }
}

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

async function resolveCanonicalLead(
  input: {
    admin: ReturnType<typeof createAdminClient>
    requestedLeadId: string | null
    userId: string
  },
  findEnrollment = findPersonalPlanEnrollmentForUser,
): Promise<{ leadId: string | null; expectedQuizSourceKind: PlanBereitQuizSourceKind | null }> {
  const enrollment = await findEnrollment(input.admin, input.userId)
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

async function resolveStatus(request: Request, retryLink: boolean, deps = statusDefaults) {
  if (
    retryLink &&
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  ) {
    return NextResponse.json({ status: "forbidden" }, { status: 403 })
  }
  const leadParam = new URL(request.url).searchParams.get("lead")
  const leadResult = leadParam
    ? z.string().uuid().safeParse(leadParam)
    : { success: true, data: null }
  if (!leadResult.success) {
    return NextResponse.json({ status: "invalid_source" }, { status: 400 })
  }
  const supabase = await deps.createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 })
  }

  const admin = deps.createAdminClient()
  const [active, oneTimeAccessState] = await Promise.all([
    deps.hasCurrentAppAccess(admin, { userId: user.id, email: user.email }),
    deps.resolveOneTimeAccessState(admin, user.id),
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
    if (!(await deps.appAllowedForUser(user.id))) {
      return NextResponse.json({ status: "forbidden" }, { status: 403 })
    }
    const initialEnrollment = await deps.findEnrollment(admin, user.id)
    if (!initialEnrollment.artifactLeadId) {
      const migration = retryLink
        ? await deps.beginMigration({
            client: admin,
            userId: user.id,
            ownedLeadId: leadResult.data,
          })
        : await deps.resolveMigration({ client: admin, userId: user.id })
      if (migration.status === "candidate" || migration.status === "pending_source") {
        if (retryLink && migration.status === "pending_source") {
          return migrationQuizResponse(user.id, migration.enrollmentId)
        }
        return NextResponse.json(
          { status: "source_pending", initialAction: "link" },
          { headers: { "Cache-Control": "private, no-store" } },
        )
      }
    }
    const canonical = await resolveCanonicalLead(
      {
        admin,
        requestedLeadId: leadResult.data,
        userId: user.id,
      },
      deps.findEnrollment,
    )
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
      ? await deps.linkSource(admin, readinessInput)
      : await deps.loadReadiness(admin, readinessInput)

    if (retryLink && needsFreshMigrationQuiz(readiness)) {
      const migration = await deps.resolveMigration({ client: admin, userId: user.id })
      if (migration.status === "ready") {
        const { data: plan, error } = await admin
          .from("personal_plans")
          .select("current_initial_need_version_id")
          .eq("user_id", user.id)
          .maybeSingle()
        if (error) throw error
        // Once Stage 1 exists, source and routine update semantics stay unchanged.
        if (!plan?.current_initial_need_version_id)
          return migrationQuizResponse(user.id, migration.enrollmentId)
      }
    }

    return NextResponse.json(readiness, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[plan-bereit] readiness failed", error)
    return NextResponse.json(
      { status: "transient_error" },
      { headers: { "Cache-Control": "private, no-store" }, status: 500 },
    )
  }
}

function migrationQuizResponse(userId: string, enrollmentId: string) {
  const context = createMigrationQuizContextCookie(
    { userId, enrollmentId },
    process.env.FUNNEL_COOKIE_SIGNING_SECRET ?? "",
  )
  if (!context) throw new Error("migration_quiz_context_unavailable")
  const response = NextResponse.json(
    { status: "source_pending", nextHref: MIGRATION_QUIZ_HREF },
    { headers: { "Cache-Control": "private, no-store" } },
  )
  response.cookies.set(MIGRATION_QUIZ_CONTEXT_COOKIE, context, migrationQuizContextCookieOptions)
  return response
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
