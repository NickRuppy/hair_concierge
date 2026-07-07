import { NextResponse } from "next/server"

import { createRoutineApiHandlers } from "@/lib/routines/api-handlers"
import { createDismissal } from "@/lib/routines/dismissals"
import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { shapeRoutineForUi } from "@/lib/routines/shape-for-ui"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }> | { id: string }
}

const handlers = createRoutineApiHandlers({
  createClient,
  loadRoutineArtifactData,
  shapeRoutineForUi,
  createDismissal,
})

async function routeId(context: RouteContext): Promise<string> {
  const params = await context.params
  return params.id
}

export async function PATCH(request: Request, context: RouteContext) {
  const result = await handlers.patchProduct(await routeId(context), await request.json())
  return NextResponse.json(result.body, { status: result.status })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const result = await handlers.deleteProduct(await routeId(context))
  return NextResponse.json(result.body, { status: result.status })
}
