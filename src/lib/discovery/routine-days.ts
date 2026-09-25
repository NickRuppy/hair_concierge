import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

import {
  DISCOVERY_STYLING_PRODUCT_TYPE,
  type DiscoveryProductType,
  type DiscoveryUsageRole,
} from "./classify"
import {
  DISCOVERY_FREQUENCY_LABELS,
  mostFrequentDiscoveryFrequency,
  type DiscoveryItemFrequency,
} from "./frequency"

/**
 * Batch 7 (plan `plans/discovery-refinement-b7/plan.md` Rev. 3, §2.1 item 4; prototype
 * round 6 `routineGroups`): „Deine Routine" composes her products back to her as day cards.
 * Pure and client-safe — its own label constants, because the DB-seeded application day
 * labels are server-only.
 *
 *  - Waschtag: shampoo, conditioner, leave-in, oil into damp hair; cadence = her MOST
 *    frequent shampoo (none known → open, asked in the call).
 *  - Intensiv-Pflegetag: pre-wash oil or conditioner, deep cleansing, bondbuilder, mask;
 *    cadence = her most frequent mask or bondbuilder.
 *  - Zwischendurch: finish oil (and a legacy role-less oil), dry shampoo, scalp care.
 *  - Styling: heat protectant and styling products (D2) — products only; her heat answers
 *    have their own page.
 *  - Weitere: products whose usage is still open („Kategorie offen").
 *
 * Only non-empty cards, in that order. Within the Waschtag and the Intensiv-Pflegetag the
 * products follow the routine's own order; everywhere else, and within a rank, capture order.
 */

export type DiscoveryRoutineDayKind = "wash_day" | "intensive_day" | "between" | "styling" | "other"

export const DISCOVERY_ROUTINE_DAY_TITLES: Record<DiscoveryRoutineDayKind, string> = {
  wash_day: "Waschtag",
  intensive_day: "Intensiv-Pflegetag",
  between: "Zwischendurch",
  styling: "Styling",
  other: "Weitere",
}

const DAY_ORDER: readonly DiscoveryRoutineDayKind[] = [
  "wash_day",
  "intensive_day",
  "between",
  "styling",
  "other",
]

/** What the composer reads of an item — `DiscoveryIntakeItemView` satisfies it. */
export type DiscoveryRoutineDayItem = {
  id: string
  source: string
  /** Her usage; `null` = „Kategorie offen". */
  category: PersonalPlanCategory | null
  usageRole?: DiscoveryUsageRole | null
  productType?: DiscoveryProductType | null
  /** `null`/absent = not asked yet (a legacy draft), `unknown` = „Weiß ich nicht". */
  frequency?: DiscoveryItemFrequency | null
}

export type DiscoveryRoutineDay<T extends DiscoveryRoutineDayItem = DiscoveryRoutineDayItem> = {
  kind: DiscoveryRoutineDayKind
  title: string
  /** The day's rhythm (Waschtag, Intensiv-Pflegetag only); `null` = open. */
  cadence: ProductFrequency | null
  /** „3–4× pro Woche" — the participant's own frequency label; `null` when open. */
  cadenceLabel: string | null
  items: T[]
}

type Placement = { day: DiscoveryRoutineDayKind; rank: number }

function placementOf(item: DiscoveryRoutineDayItem): Placement {
  if (item.productType === DISCOVERY_STYLING_PRODUCT_TYPE) return { day: "styling", rank: 0 }
  const role = item.usageRole ?? null
  switch (item.category) {
    case null:
      return { day: "other", rank: 0 }
    case "shampoo":
      return { day: "wash_day", rank: 0 }
    case "conditioner":
      return role === "pre_wash_conditioner"
        ? { day: "intensive_day", rank: 0 }
        : { day: "wash_day", rank: 1 }
    case "leave_in":
      return { day: "wash_day", rank: 2 }
    case "oil":
      if (role === "leave_on_fibre_conditioning") return { day: "wash_day", rank: 3 }
      if (role === "pre_wash_fibre_treatment") return { day: "intensive_day", rank: 0 }
      return { day: "between", rank: 0 }
    case "deep_cleansing_shampoo":
      return { day: "intensive_day", rank: 1 }
    case "bondbuilder":
      return { day: "intensive_day", rank: 2 }
    case "mask":
      return { day: "intensive_day", rank: 3 }
    case "dry_shampoo":
    case "scalp_care":
      return { day: "between", rank: 0 }
    case "heat_protectant":
      return { day: "styling", rank: 0 }
  }
}

function cadenceOf(
  kind: DiscoveryRoutineDayKind,
  items: readonly DiscoveryRoutineDayItem[],
): ProductFrequency | null {
  const sources: Partial<Record<DiscoveryRoutineDayKind, readonly PersonalPlanCategory[]>> = {
    wash_day: ["shampoo"],
    intensive_day: ["mask", "bondbuilder"],
  }
  const categories = sources[kind]
  if (!categories) return null
  return mostFrequentDiscoveryFrequency(
    items
      .filter((item) => item.category !== null && categories.includes(item.category))
      .map((item) => item.frequency),
  )
}

export function composeDiscoveryRoutineDays<T extends DiscoveryRoutineDayItem>(
  items: readonly T[],
): DiscoveryRoutineDay<T>[] {
  const placed = items
    .filter((item) => item.source !== "none")
    .map((item, index) => ({ item, index, ...placementOf(item) }))

  return DAY_ORDER.flatMap((kind): DiscoveryRoutineDay<T>[] => {
    const members = placed
      .filter((entry) => entry.day === kind)
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map((entry) => entry.item)
    if (members.length === 0) return []
    const cadence = cadenceOf(kind, members)
    return [
      {
        kind,
        title: DISCOVERY_ROUTINE_DAY_TITLES[kind],
        cadence,
        cadenceLabel: cadence ? DISCOVERY_FREQUENCY_LABELS[cadence] : null,
        items: members,
      },
    ]
  })
}
