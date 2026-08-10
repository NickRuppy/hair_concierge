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
  "personal_plan.cadence.unscheduled_as_needed": "Bei Bedarf",
  "personal_plan.cadence.mask_regular_interval": "In deinem empfohlenen Abstand",
  "personal_plan.cadence.role_based_wash_linked": "Passend zu deiner Haarwäsche",
  "personal_plan.cadence.product_protocol_course": "Nach Herstellerangabe",
  "personal_plan.cadence.role_keyed_product_protocol": "Nach Herstellerangabe",
  ...PRODUCT_FREQUENCY_LABELS,
}

const maskIntervalLabels: Record<string, string> = {
  weekly_1x: "1× pro Woche",
  biweekly_1x: "Etwa alle 2 Wochen",
  every_3_weeks: "Etwa alle 3 Wochen",
}

const recommendedFrequencyLabels: Record<string, string> = {
  daily_1x: "Täglich",
  weekly_5_6x: "5–6× pro Woche",
  weekly_3_4x: "3–4× pro Woche",
  weekly_2x: "2× pro Woche",
  weekly_1x: "1× pro Woche",
  biweekly_1x: "Etwa alle 2 Wochen",
  monthly_1x: "Etwa 1× pro Monat",
  less_than_monthly: "Seltener als monatlich",
}

const washLinkedCadenceLabels: Record<string, string> = {
  before_every_compatible_wash: "Vor jeder passenden Haarwäsche",
  after_every_compatible_wash: "Nach jeder passenden Haarwäsche",
  finish_after_every_compatible_wash: "Als Finish nach jeder passenden Haarwäsche",
  optional_allocation_deferred_to_day_type: "Bei Bedarf passend zu deinem Waschtag",
}

const protocolCadenceLabels: Record<string, string> = {
  as_needed_according_to_product: "Bei Bedarf nach Herstellerangabe",
  regular_according_to_product: "Regelmäßig nach Herstellerangabe",
  occasional_according_to_product: "Gelegentlich nach Herstellerangabe",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function roleCadence(
  recommended: Record<string, unknown>,
  role: string,
): Record<string, unknown> | undefined {
  const roleFrequencies = recommended.roleFrequencies
  if (!Array.isArray(roleFrequencies)) return undefined
  return roleFrequencies.find(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.role === role,
  )
}

export function routineCadenceLabel(item: RoutineItem): string {
  if (typeof item.cadence.userOverride === "string") {
    return cadenceLabels[item.cadence.userOverride] ?? "Nach deinem gewählten Rhythmus"
  }

  const recommended = item.cadence.recommended
  if (isRecord(recommended) && typeof recommended.kind === "string") {
    switch (recommended.kind) {
      case "wet_wash_total":
        return typeof recommended.target === "string"
          ? (recommendedFrequencyLabels[recommended.target] ?? "Entsprechend deinem Waschrhythmus")
          : "Entsprechend deinem Waschrhythmus"
      case "after_each_eligible_wash":
        return "Nach jeder passenden Haarwäsche"
      case "event_based":
        return "Vor jeder passenden Hitze-Anwendung"
      case "every_nth_wash":
        return recommended.every === 3
          ? "Bei jeder dritten Haarwäsche"
          : recommended.every === 4
            ? "Bei jeder vierten Haarwäsche"
            : "In deinem empfohlenen Waschrhythmus"
      case "unscheduled_as_needed":
        return "Bei Bedarf"
      case "mask_regular_interval":
        return typeof recommended.baseInterval === "string"
          ? (maskIntervalLabels[recommended.baseInterval] ?? "In deinem empfohlenen Abstand")
          : "In deinem empfohlenen Abstand"
      case "role_based_wash_linked": {
        const cadence = roleCadence(recommended, item.role)?.cadence
        return typeof cadence === "string"
          ? (washLinkedCadenceLabels[cadence] ?? "Passend zu deiner Haarwäsche")
          : "Passend zu deiner Haarwäsche"
      }
      case "product_protocol_course":
        return "Nach Herstellerangabe"
      case "role_keyed_product_protocol": {
        const cadence = roleCadence(recommended, item.role)?.cadence
        return typeof cadence === "string"
          ? (protocolCadenceLabels[cadence] ?? "Nach Herstellerangabe")
          : "Nach Herstellerangabe"
      }
    }
  }

  return cadenceLabels[item.cadence.displayKey] ?? "Nach deinem Plan"
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
  const cadence = routineCadenceLabel(item)
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
