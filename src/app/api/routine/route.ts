import { NextResponse } from "next/server"

import { createRoutineApiHandlers } from "@/lib/routines/api-handlers"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { createDismissal } from "@/lib/routines/dismissals"
import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { shapeRoutineForUi } from "@/lib/routines/shape-for-ui"

const handlers = createRoutineApiHandlers({
  createClient,
  createAdminClient,
  loadRoutineArtifactData,
  shapeRoutineForUi,
  createDismissal,
})

export async function GET() {
  const result = await handlers.getRoutine()
  return NextResponse.json(result.body, { status: result.status })
}
