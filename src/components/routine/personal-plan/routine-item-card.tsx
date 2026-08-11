import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import { Button } from "@/components/ui/button"
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

const purposeDescriptions: Record<string, string> = {
  shampoo_everyday: "Regelmäßige Reinigung für deine Kopfhaut.",
  shampoo_dandruff: "Hilft, deine Kopfhautpflege gezielter einzuplanen.",
  conditioner_rinse_out: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
  post_wash_leave_in: "Gibt den Längen Pflege, die im Haar bleibt.",
  pre_heat_application: "Bereitet die Längen auf Hitze-Styling vor.",
  intensive_conditioning_mask: "Gibt den Längen eine intensive, auswaschbare Pflegeeinheit.",
  pre_wash_fibre_treatment: "Pflegt die Längen vor der Haarwäsche.",
  leave_on_fibre_conditioning: "Bleibt im Haar und ergänzt die Pflege nach der Wäsche.",
  dry_finish: "Schließt die Routine als Finish für die Längen ab.",
  residue_reset: "Entfernt Rückstände, wenn die Routine einen Reset braucht.",
  mineral_reset: "Hilft gegen mineralische Ablagerungen in den Längen.",
  root_refresh_bridge: "Frischt den Ansatz zwischen Haarwäschen auf.",
  pre_heat_protection: "Schützt dein Haar vor passender Hitze-Anwendung.",
  specialized_bond_treatment: "Ergänzt die Routine, wenn Strukturpflege sinnvoll ist.",
  scalp_comfort: "Beruhigt die Kopfhaut, wenn sie zusätzliche Pflege braucht.",
  scalp_flake_oil_adjunct: "Ergänzt die Kopfhautpflege punktuell.",
  density_claim_tonic: "Unterstützt die Kopfhautpflege als Leave-on-Schritt.",
  scalp_exfoliant: "Löst Schuppen und Rückstände kontrolliert von der Kopfhaut.",
}

const timingLabelsByRole: Record<string, string> = {
  shampoo_everyday: "Haarwäsche",
  shampoo_dandruff: "Haarwäsche",
  conditioner_rinse_out: "Nach Shampoo",
  post_wash_leave_in: "Nach der Wäsche",
  pre_heat_application: "Vor Hitze",
  intensive_conditioning_mask: "Nach Shampoo",
  pre_wash_fibre_treatment: "Vor der Haarwäsche",
  leave_on_fibre_conditioning: "Nach der Wäsche",
  dry_finish: "Im trockenen Haar",
  residue_reset: "Statt Shampoo",
  mineral_reset: "Statt Shampoo",
  root_refresh_bridge: "Zwischen Wäschen",
  pre_heat_protection: "Vor Hitze",
  specialized_bond_treatment: "Nach Herstellerangabe",
  scalp_comfort: "Auf der Kopfhaut",
  scalp_flake_oil_adjunct: "Vor der Wäsche",
  density_claim_tonic: "Auf der Kopfhaut",
  scalp_exfoliant: "Vor der Wäsche",
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

const categoryAccentBorders: Record<string, string> = {
  shampoo: "border-amber-300",
  conditioner: "border-sky-300",
  mask: "border-violet-300",
  oil: "border-rose-300",
  leave_in: "border-emerald-300",
  heat_protectant: "border-orange-300",
  scalp_care: "border-teal-300",
  dry_shampoo: "border-lime-300",
  bondbuilder: "border-fuchsia-300",
  deep_cleansing_shampoo: "border-yellow-300",
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
  return typeof name === "string" && name.length > 0 ? name : "Noch kein Produkt gewählt"
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
    return (
      recommendedFrequencyLabels[item.cadence.userOverride] ??
      cadenceLabels[item.cadence.userOverride] ??
      "Nach deinem gewählten Rhythmus"
    )
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

function routinePurposeDescription(item: RoutineItem) {
  return (
    purposeDescriptions[item.purposeKey] ??
    `${routineCategoryLabel(item.category)} passend zu deinem Bedarfsplan.`
  )
}

function routineTimingLabel(item: RoutineItem) {
  return timingLabelsByRole[item.role] ?? timingLabelsByRole[item.purposeKey] ?? "Im Plan"
}

export function routineFitLabel(item: RoutineItem) {
  if (item.state.availability === "none") {
    return item.state.systemAssessment === "basis" ? "Basis-Lücke" : "Optional offen"
  }
  if (item.state.availability === "pending_review") return "Analyse läuft"
  if (item.state.fitDecision === "informed_override") return "Bewusste Wahl"
  if (item.state.systemAssessment === "not_recommended") return "Bewusste Wahl"
  if (!item.executable) return "Nicht einsatzbereit"
  return "✓ Passt"
}

function detailCopy(item: RoutineItem) {
  if (item.state.availability === "none" && item.state.systemAssessment === "basis") {
    return "Für diesen Basis-Baustein fehlt noch ein Produkt. Ergänze ihn, bevor die Anwendung vollständig wird."
  }
  if (item.state.availability === "none") {
    return "Kein Bestandteil deiner aktiven Routine. Du kannst diesen optionalen Baustein später ergänzen."
  }
  if (item.state.availability === "pending_review") {
    return "Dieses Produkt wartet noch auf Analyse und bleibt bis dahin nicht ausführbar."
  }
  return `${routinePurposeDescription(item)} Rhythmus: ${routineCadenceLabel(item)}. Zeitpunkt: ${routineTimingLabel(item)}.`
}

export function RoutineItemCard({
  item,
  variant = "routine",
  onDetail,
}: {
  item: RoutineItem
  variant?: "routine" | "later"
  onDetail?: (item: RoutineItem) => void
}) {
  const purpose = routinePurposeLabel(item.purposeKey)
  const category = routineCategoryLabel(item.category)
  const visibleCategory = variant === "later" ? `${category} optional` : category
  const product = productName(item)
  const cadence = routineCadenceLabel(item)
  const status = getRoutineStatus(item).label
  const fit = routineFitLabel(item)
  const timing = routineTimingLabel(item)
  const accessibleName = `Zweck: ${purpose}; Kategorie: ${category}; Produkt: ${product}; Status: ${status}; Rhythmus: ${cadence}`

  return (
    <Card
      className={cn(
        "overflow-hidden border border-[rgba(107,80,160,0.14)] bg-white/95 shadow-sm shadow-[rgba(47,31,71,0.06)]",
        variant === "routine" && "transition-shadow hover:shadow-md motion-reduce:transition-none",
        variant === "later" && "border-dashed bg-[var(--surface-soft)] shadow-none",
      )}
      role="group"
      aria-label={accessibleName}
    >
      <CardHeader className="gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="grid gap-4 sm:grid-cols-[4.75rem_1fr]">
          <div
            aria-hidden="true"
            className={cn(
              "flex aspect-[3/4] h-24 w-20 items-center justify-center rounded-[20px] border border-[rgba(107,80,160,0.10)] bg-gradient-to-br from-[#fff9f5] to-[#f4edf9] text-2xl font-semibold text-[var(--brand-plum)] shadow-inner",
              categoryAccentBorders[item.category] ?? "border-stone-200",
            )}
          >
            {category.slice(0, 1)}
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                {visibleCategory}
              </p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-plum)]">
                {fit}
              </span>
            </div>
            <CardTitle className="mt-2 text-lg leading-tight sm:text-xl">{product}</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {routinePurposeDescription(item)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[14px] bg-[#f8f5f2] px-3 py-2">
            <p className="text-xs text-muted-foreground">Rhythmus</p>
            <p className="mt-0.5 font-semibold text-foreground">{cadence}</p>
          </div>
          <div className="rounded-[14px] bg-[#f8f5f2] px-3 py-2">
            <p className="text-xs text-muted-foreground">Wann</p>
            <p className="mt-0.5 font-semibold text-foreground">{timing}</p>
          </div>
        </div>
        {item.state.availability === "none" && item.state.systemAssessment === "basis" ? (
          <p className="rounded-[14px] bg-[var(--status-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--status-danger-text)]">
            Für diesen Basis-Baustein fehlt noch ein Produkt.
          </p>
        ) : null}
        <details className="group rounded-[14px] border border-border bg-white px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Anwendungsdetails
          </summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">{detailCopy(item)}</p>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RoutineStatusBadge item={item} />
          {onDetail ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onDetail(item)}>
              Detail öffnen
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
