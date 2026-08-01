import { NextResponse, type NextRequest } from "next/server"

import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { resolveOneTimeAccessStateForUser } from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { createTrackerApiHandlers } from "@/lib/tracking/api-handlers"

const handlers = createTrackerApiHandlers({
  createAuthClient: createClient,
  createAdminClient,
  hasCurrentAppAccess,
  resolveOneTimeAccessState: (client, { userId }) =>
    resolveOneTimeAccessStateForUser(
      client as Parameters<typeof resolveOneTimeAccessStateForUser>[0],
      userId,
    ),
  loadRoutineArtifactData,
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  const result = await handlers.dismissNudge(body)
  return NextResponse.json(result.body, { status: result.status })
}
