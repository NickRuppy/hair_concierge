import { NextResponse } from "next/server"

import {
  createStage1PersistenceService,
  type Stage1PersistenceDependencies,
} from "@/lib/personal-plan/persistence/stage1-service"
import { createStage1SupabaseDependencies } from "@/lib/personal-plan/persistence/stage1-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"

export const runtime = "nodejs"

export type Stage1RouteDeps = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  persistence: Stage1PersistenceDependencies
}

export async function GET() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  return toResponse(
    await handleStage1LoadOrCreate({
      getAuthenticatedUser: async () => (user ? { id: user.id } : null),
      loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
      persistence: createStage1SupabaseDependencies(createAdminClient() as never),
    }),
  )
}

export async function POST() {
  return GET()
}

export async function handleStage1LoadOrCreate(deps: Stage1RouteDeps) {
  if (!deps.persistence.isEnabled()) {
    return { status: 404, body: { error: "personal_plan_not_available" } }
  }
  const user = await deps.getAuthenticatedUser()
  if (!user) return { status: 401, body: { error: "unauthorized" } }

  let access: PersonalPlanJourneyAccess
  try {
    access = await deps.loadJourneyAccess(user.id)
  } catch {
    return { status: 503, body: { error: "temporarily_unavailable" } }
  }
  if (!canAccessPersonalPlanJourneyStage(access, "stage1")) {
    return access.kind === "paid_pending"
      ? { status: 409, body: { error: "activation_pending" } }
      : { status: 404, body: { error: "personal_plan_not_available" } }
  }

  const result = await createStage1PersistenceService(deps.persistence).loadOrCreate({
    userId: user.id,
  })
  switch (result.status) {
    case "completed":
      return {
        status: 200,
        body: {
          status: "completed",
          personalPlanId: result.personalPlanId,
          needVersionId: result.needVersionId,
          outputSnapshot: result.outputSnapshot,
        },
      }
    case "personal_plan_not_available":
      return { status: 404, body: { error: "personal_plan_not_available" } }
    case "activation_pending":
      return { status: 409, body: { error: "activation_pending" } }
    case "invalid_source":
      return { status: 409, body: { error: "invalid_source" } }
    case "temporarily_unavailable":
      return { status: 503, body: { error: "temporarily_unavailable" } }
  }
}

function toResponse(result: Awaited<ReturnType<typeof handleStage1LoadOrCreate>>) {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  })
}
