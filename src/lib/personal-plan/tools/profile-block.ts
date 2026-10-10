import type { ToolFamily } from "./contracts"
import { buildToolCheckpointGroups, type ToolCheckpointGroup } from "./checkpoint"
import type { ToolInventory } from "./facts"
import { TOOL_OVERVIEW_SECTIONS, type ToolOverviewSectionKey } from "./labels"

/**
 * The Profil card „Deine Tools" (plan `plans/2026-10-09-hair-tools-port.md` Task 11): the tools
 * the member herself reported, one group per family in wash-day order (the checkpoint's grouping,
 * so both screens read the same), each group tagged with the overview section it belongs to.
 * Pure, no I/O.
 */

export type ProfileToolsGroup = ToolCheckpointGroup & { sectionKey: ToolOverviewSectionKey }

export type ProfileToolsBlock = {
  /** Owned tools across all groups (the card's „N Tools" badge). */
  count: number
  groups: ProfileToolsGroup[]
}

const SECTION_KEY_BY_FAMILY = new Map<ToolFamily, ToolOverviewSectionKey>(
  TOOL_OVERVIEW_SECTIONS.flatMap((section) =>
    section.families.map((family) => [family, section.key] as const),
  ),
)

/**
 * `null` when the member has confirmed nothing yet (an empty reported inventory → „Noch nicht
 * angegeben"). A confirmed inventory without any owned tool („Nichts davon" everywhere) is an
 * empty block instead — the member answered.
 */
export function buildProfileToolsBlock(inventory: ToolInventory): ProfileToolsBlock | null {
  if (Object.keys(inventory).length === 0) return null
  const groups = buildToolCheckpointGroups(inventory).map((group) => ({
    ...group,
    sectionKey: SECTION_KEY_BY_FAMILY.get(group.family)!,
  }))
  return { count: groups.reduce((total, group) => total + group.items.length, 0), groups }
}
