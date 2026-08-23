import type { RoutinePayload } from "@/lib/personal-plan/routine/contracts"
import type { RoutineProductPresentation } from "@/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"

import { RoutineCategoryCard } from "./routine-item-card"

type RoutineItem = RoutinePayload["items"][number]

export function RoutineSection({
  title,
  items,
  variant = "routine",
  emptyLabel,
  onItemDetail,
  presentation = null,
  productPresentation = null,
}: {
  title: "Deine Basis" | "Optional" | "Später ergänzen"
  items: RoutineItem[]
  variant?: "routine" | "later"
  emptyLabel?: string
  onItemDetail?: (item: RoutineItem) => void
  presentation?: PortfolioPresentation | null
  productPresentation?: RoutineProductPresentation | null
}) {
  const headingId = `${title.toLowerCase().replaceAll(" ", "-").replaceAll("ä", "ae")}-heading`
  const categoryGroups = [
    ...items
      .reduce((groups, item) => {
        const group = groups.get(item.category) ?? []
        group.push(item)
        groups.set(item.category, group)
        return groups
      }, new Map<string, RoutineItem[]>())
      .entries(),
  ]

  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      <h2 id={headingId} className="px-0.5 text-[13px] font-bold text-[#291a43]">
        {title}
      </h2>
      {items.length === 0 && emptyLabel ? (
        <p className="rounded-[18px] border border-dashed border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : null}
      <div className="grid gap-2.5" data-routine-card-list>
        {categoryGroups.map(([category, groupedItems]) => (
          <RoutineCategoryCard
            key={category}
            category={category}
            items={groupedItems}
            variant={variant}
            onDetail={onItemDetail}
            presentation={presentation}
            productPresentation={productPresentation}
          />
        ))}
      </div>
    </section>
  )
}
