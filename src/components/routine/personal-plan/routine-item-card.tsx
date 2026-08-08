import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { PRODUCT_FREQUENCY_LABELS } from "@/lib/vocabulary/frequencies"

import { getRoutineStatus, RoutineStatusBadge } from "./routine-status"

type RoutineItem = RoutinePayloadV1["items"][number]

const purposeLabels: Record<string, string> = {
  shampoo_everyday: "Regelmäßige Reinigung",
  shampoo_dandruff: "Schuppenpflege",
  conditioner_rinse_out: "Pflege nach der Reinigung",
  post_wash_leave_in: "Pflege ohne Ausspülen",
  pre_heat_application: "Pflege vor dem Hitzestyling",
  intensive_conditioning_mask: "Intensivpflege",
  pre_wash_fibre_treatment: "Pflege vor der Haarwäsche",
  leave_on_fibre_conditioning: "Pflege ohne Ausspülen",
  dry_finish: "Finish",
  residue_reset: "Tiefenreinigung",
  mineral_reset: "Mineralablagerungen entfernen",
  root_refresh_bridge: "Ansatz auffrischen",
  pre_heat_protection: "Hitzeschutz",
  specialized_bond_treatment: "Strukturpflege",
  scalp_comfort: "Kopfhaut beruhigen",
  scalp_flake_oil_adjunct: "Kopfhautöl als Ergänzung",
  density_claim_tonic: "Kopfhaut-Tonic",
  scalp_exfoliant: "Kopfhaut-Peeling",
}

const categoryLabels: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  mask: "Maske",
  oil: "Öl",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigendes Shampoo",
}

const cadenceLabels: Record<string, string> = {
  "personal_plan.cadence.none": "Nach Bedarf",
  "personal_plan.cadence.wet_wash_total": "Entsprechend deinem Waschrhythmus",
  "personal_plan.cadence.after_each_eligible_wash": "Nach jeder passenden Haarwäsche",
  "personal_plan.cadence.event_based": "Vor jedem passenden Anlass",
  "personal_plan.cadence.every_nth_wash": "Bei jeder dritten oder vierten Haarwäsche",
  "personal_plan.cadence.interval": "In deinem empfohlenen Abstand",
  ...PRODUCT_FREQUENCY_LABELS,
}

const categoryTones: Record<string, string> = {
  shampoo: "border-l-amber-300",
  conditioner: "border-l-sky-300",
  mask: "border-l-violet-300",
  oil: "border-l-rose-300",
  leave_in: "border-l-emerald-300",
  heat_protectant: "border-l-orange-300",
  scalp_care: "border-l-teal-300",
  dry_shampoo: "border-l-lime-300",
  bondbuilder: "border-l-fuchsia-300",
  deep_cleansing_shampoo: "border-l-yellow-300",
}

function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value.replaceAll("_", " ")
}

export function routinePurposeLabel(value: string) {
  return labelFor(purposeLabels, value)
}

export function routineCategoryLabel(value: string) {
  return labelFor(categoryLabels, value)
}

function productName(item: RoutineItem) {
  const name = item.product.displayName
  return typeof name === "string" && name.length > 0 ? name : "Kein Produkt ausgewählt"
}

export function RoutineItemCard({
  item,
  onDetail,
}: {
  item: RoutineItem
  onDetail?: (item: RoutineItem) => void
}) {
  const purpose = routinePurposeLabel(item.purposeKey)
  const category = routineCategoryLabel(item.category)
  const product = productName(item)
  const cadenceValue =
    typeof item.cadence.userOverride === "string"
      ? item.cadence.userOverride
      : item.cadence.displayKey
  const cadence = labelFor(cadenceLabels, cadenceValue)
  const status = getRoutineStatus(item).label
  const accessibleName = `Zweck: ${purpose}; Kategorie: ${category}; Produkt: ${product}; Status: ${status}; Rhythmus: ${cadence}`
  const showDetail = () => onDetail?.(item)

  return (
    <Card
      className={cn(
        "border-l-4 shadow-sm",
        onDetail &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        categoryTones[item.category] ?? "border-l-stone-300",
      )}
      role={onDetail ? "button" : "group"}
      tabIndex={onDetail ? 0 : undefined}
      aria-label={accessibleName}
      onClick={onDetail ? showDetail : undefined}
      onKeyDown={
        onDetail
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                showDetail()
              }
            }
          : undefined
      }
    >
      <CardHeader className="gap-3 p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Zweck</p>
            <CardTitle className="mt-1 text-base">{purpose}</CardTitle>
          </div>
          <RoutineStatusBadge item={item} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-4 pt-2 text-sm">
        <p className="font-medium">{product}</p>
        <p className="text-muted-foreground">Kategorie: {category}</p>
        <p className="text-muted-foreground">Rhythmus: {cadence}</p>
      </CardContent>
    </Card>
  )
}
