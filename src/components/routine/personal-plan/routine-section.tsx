import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"

import { RoutineItemCard } from "./routine-item-card"

type RoutineItem = RoutinePayloadV1["items"][number]

export function RoutineSection({
  title,
  items,
  onItemDetail,
}: {
  title: "Deine Basis" | "Optional"
  items: RoutineItem[]
  onItemDetail?: (item: RoutineItem) => void
}) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
      className="space-y-3"
    >
      <h2
        id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
        className="text-lg font-semibold tracking-tight"
      >
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <RoutineItemCard key={item.itemKey} item={item} onDetail={onItemDetail} />
        ))}
      </div>
    </section>
  )
}
