"use server"

import type { ToolRoutineSection } from "@/lib/personal-plan/tools/read-view"

import { journeyRoutineToolSection, type JourneyToolSessionInput } from "./routine-tools"

/** Labs-only: the Routine „Deine Tools" for the journey session's current answers. */
export async function journeyRoutineToolSectionAction(
  input: JourneyToolSessionInput,
): Promise<ToolRoutineSection | null> {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("The Feinschliff journey lab is development-only")
  }
  return journeyRoutineToolSection(input)
}
