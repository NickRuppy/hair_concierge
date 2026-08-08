"use server"

import type { Stage2HandoffPayload } from "@/components/personal-plan-refinement/refinement-flow"

import { prepareStage3EntryContextForLab } from "./integration"

export async function prepareStage3EntryContextAction(payload: Stage2HandoffPayload) {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("The integrated Personal Plan preview is development-only")
  }
  return prepareStage3EntryContextForLab(payload).entryContext
}
