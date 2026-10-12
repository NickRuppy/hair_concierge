import type { Stage2RefinementSession } from "../refinement/session"
import type { Stage2AnswerProvenance } from "../refinement/types"

import type { ToolFamily, ToolReportedForm } from "./contracts"
import { reportedToolInventory, type ToolInventory } from "./facts"
import {
  TOOL_FAMILY_SHORT_LABELS,
  TOOL_OVERVIEW_FAMILY_ORDER,
  toolImageAlt,
  toolImageSrc,
  toolReportedFormLabel,
} from "./labels"

/**
 * The Tool-Checkpoint „Das hast du schon" (plan `plans/2026-10-09-hair-tools-port.md` Task 10):
 * what the member just reported owning, shown once when the tools module hands back to the host.
 * Pure, no I/O.
 */

export type ToolCheckpointItem = {
  form: ToolReportedForm
  label: string
  imageSrc: string
  imageAlt: string
}

export type ToolCheckpointGroup = {
  family: ToolFamily
  label: string
  items: ToolCheckpointItem[]
}

/**
 * „Nur Finger" is an answer about how the member handles her hair, not something she owns — it
 * has no place on a screen titled „Das hast du schon".
 */
const NOT_OWNED_FORMS: ReadonlySet<ToolReportedForm> = new Set(["fingers"])

/**
 * One group per family with at least one owned form, in wash-day order
 * (`TOOL_OVERVIEW_SECTIONS`, pages inside a section in page order). A „Nichts davon" family
 * (`[]`) and an unknown one (absent / `null`) are omitted.
 */
export function buildToolCheckpointGroups(inventory: ToolInventory): ToolCheckpointGroup[] {
  return TOOL_OVERVIEW_FAMILY_ORDER.flatMap((family) => {
    const forms = (inventory[family] ?? []).filter((form) => !NOT_OWNED_FORMS.has(form))
    if (forms.length === 0) return []
    return [
      {
        family,
        label: TOOL_FAMILY_SHORT_LABELS[family],
        items: forms.map((form) => ({
          form,
          label: toolReportedFormLabel(form),
          imageSrc: toolImageSrc(form),
          imageAlt: toolImageAlt(form),
        })),
      },
    ]
  })
}

/**
 * The bounded counts the `personal_plan_tools_checkpoint_viewed` event carries — never a Tool
 * identity or an ownership claim. `gapCount` = families the member answered without owning
 * anything shown, `unknownCount` = families she has not reported at all.
 */
export function toolCheckpointAnalyticsCounts(
  inventory: ToolInventory,
  groups: readonly ToolCheckpointGroup[],
): { routeCount: number; ownedCount: number; gapCount: number; unknownCount: number } {
  const shown = new Set<ToolFamily>(groups.map((group) => group.family))
  let gapCount = 0
  let unknownCount = 0
  for (const family of TOOL_OVERVIEW_FAMILY_ORDER) {
    if (shown.has(family)) continue
    if (inventory[family] == null) unknownCount += 1
    else gapCount += 1
  }
  return {
    routeCount: groups.length,
    ownedCount: groups.reduce((total, group) => total + group.items.length, 0),
    gapCount,
    unknownCount,
  }
}

/**
 * `personal_plan_tools_inventory_completed`: how many families the member reported owning
 * something in versus answered with „Nichts davon" (an unticked family reads as `[]`). Bounded
 * counts only.
 */
export function toolInventoryCompletedCounts(inventory: ToolInventory): {
  reportedFamilyCount: number
  explicitNoneFamilyCount: number
} {
  let reportedFamilyCount = 0
  let explicitNoneFamilyCount = 0
  for (const family of TOOL_OVERVIEW_FAMILY_ORDER) {
    const forms = inventory[family]
    if (!Array.isArray(forms)) continue
    if (forms.length > 0) reportedFamilyCount += 1
    else explicitNoneFamilyCount += 1
  }
  return { reportedFamilyCount, explicitNoneFamilyCount }
}

function isToolQuestionId(id: string): boolean {
  return id === "tools_overview" || id.startsWith("tools:")
}

/**
 * The draft-side ownership oracle (`reportedToolInventory`, `D5`) over the session the tools
 * module completed with.
 *
 * The client session carries no answer provenance, but this runs only after a SUCCESSFUL tools
 * completion, and the server's module gate (`completeModule`) accepts that only once every tool
 * question on the module's path is answered by the member herself. So a completed tool question
 * that is still on the path is `user`. A completed tool question OFF the path is an answer the
 * current path no longer asks — treated as `assumed`, so it can never read as owned.
 */
export function toolCheckpointInventory(
  session: Pick<Stage2RefinementSession, "answers" | "completedQuestionIds" | "path">,
): ToolInventory {
  const onPath = new Set<string>(session.path.orderedQuestionIds)
  const answerProvenance: Stage2AnswerProvenance = {}
  for (const id of session.completedQuestionIds) {
    if (!isToolQuestionId(id)) continue
    answerProvenance[id] = onPath.has(id) ? "user" : "assumed"
  }
  return reportedToolInventory({
    answers: session.answers,
    completedQuestionIds: session.completedQuestionIds,
    answerProvenance,
  })
}
