import { NextResponse } from "next/server"

import { createRoutineApiHandlers } from "@/lib/routines/api-handlers"
import { createDismissal } from "@/lib/routines/dismissals"
import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { shapeRoutineForUi } from "@/lib/routines/shape-for-ui"
import { createClient } from "@/lib/supabase/server"

const handlers = createRoutineApiHandlers({
  createClient,
  loadRoutineArtifactData,
  shapeRoutineForUi,
  createDismissal,
})

export async function POST(request: Request) {
  const result = await handlers.addProduct(await request.json())
  return NextResponse.json(result.body, { status: result.status })
}
