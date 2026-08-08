import { NextResponse } from "next/server"

import {
  createStage1PersistenceService,
  type Stage1PersistenceDependencies,
} from "@/lib/personal-plan/persistence/stage1-service"
import { createStage1SupabaseDependencies } from "@/lib/personal-plan/persistence/stage1-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export type Stage1RouteDeps = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>
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
      persistence: createStage1SupabaseDependencies(createAdminClient() as never),
    }),
  )
}

export async function POST() {
  return GET()
}

export async function handleStage1LoadOrCreate(deps: Stage1RouteDeps) {
  const user = await deps.getAuthenticatedUser()
  if (!user) return { status: 401, body: { error: "unauthorized" } }

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
