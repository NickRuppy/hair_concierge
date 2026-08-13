import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import type { RoutineProductPresentation } from "@/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"

import { RoutineCategoryCard } from "./routine-item-card"

type RoutineItem = RoutinePayloadV1["items"][number]

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
    <section aria-labelledby={headingId} className="space-y-3">
      <h2
        id={headingId}
        className="text-lg font-semibold tracking-tight text-[var(--brand-plum-darkest)]"
      >
        {title}
      </h2>
      {items.length === 0 && emptyLabel ? (
        <p className="rounded-[18px] border border-dashed border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
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
