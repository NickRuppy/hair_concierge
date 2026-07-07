import { NextResponse } from "next/server"

import { createRoutineApiHandlers } from "@/lib/routines/api-handlers"
import { createDismissal } from "@/lib/routines/dismissals"
import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { shapeRoutineForUi } from "@/lib/routines/shape-for-ui"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ category: string }> | { category: string }
}

const handlers = createRoutineApiHandlers({
  createClient,
  loadRoutineArtifactData,
  shapeRoutineForUi,
  createDismissal,
})

export async function POST(_request: Request, context: RouteContext) {
  const params = await context.params
  const result = await handlers.dismissSuggestion(params.category)
  return NextResponse.json(result.body, { status: result.status })
}
