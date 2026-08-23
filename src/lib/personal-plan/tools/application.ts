import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"

import type {
  ToolAsset,
  ToolCapability,
  ToolConditionalReason,
  ToolGuidance,
  ToolOccurrence,
} from "./contracts"
import { TOOL_FAMILY_LABELS, TOOL_PRODUCT_TYPE_LABELS, toolImageAlt, toolImageSrc } from "./labels"

/**
 * Projects the Routine's durable Tool authority into the existing Anwendung
 * architecture.
 *
 * Tools become normal shelf objects and normal image-led use sections — never a
 * pill row, a capability chip or a new day type. A behaviour-only route stays an
 * ordinary text step, and anything unverified fails closed on its own step
 * without blocking unrelated product steps.
 */

export type ToolUseSectionView = {
  kind: "tool_use"
  stepKey: string
  assetKey: string
  typeLabelDe: string
  familyLabelDe: string
  imageUrl: string
  imageAltDe: string
  purposeDe: string
  actionsDe: string[]
  /** Non-null when this use cannot be executed yet; the step stays visible and honest. */
  conditionalNoteDe: string | null
  /** Anchor position inside the day's ordered sequence. */
  placement: ToolPlacement
}

export type ToolShelfSlotView = {
  kind: "tool"
  assetKey: string
  typeLabelDe: string
  imageUrl: string
  imageAltDe: string
  familyLabelDe: string
}

export type ToolPlacement = "wash" | "post_wash" | "drying" | "styling" | "nightly"

const WASH_DAYS = new Set<ApplicationDayTypeKey>([
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
])
// Every day on which a styling session can genuinely happen. Restricting this to
// wash_day and styling_day silently dropped Tool use from intensive-care,
// bond-repair and clarifying wash days, which are ordinary wash days too.
const STYLING_DAYS = new Set<ApplicationDayTypeKey>([
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "styling_day",
])

/** Ordered anchor slots inside one day. */
export const TOOL_PLACEMENT_ORDER: readonly ToolPlacement[] = [
  "wash",
  "post_wash",
  "drying",
  "styling",
  "nightly",
]

const CAPABILITY_ACTIONS_DE: Partial<Record<ToolCapability, string[]>> = {
  detangle: [
    "Beginne in den Spitzen und arbeite dich nach oben.",
    "Löse Knoten sanft; zieh nicht durch.",
  ],
  distribute_product: ["Verteile das Produkt gleichmäßig durch die Längen."],
  dry_hair: ["Halte etwas Abstand und bewege den Luftstrom."],
  diffuse_airflow: [
    "Nimm den Diffusor-Aufsatz, wenn dein Gerät einen hat.",
    "Führe die Längen locker in den Aufsatz, statt sie zu bewegen.",
  ],
  air_shape: ["Arbeite in Partien und lass jede Partie kurz auskühlen."],
  set_style: ["Setze in Partien und lass die Form vollständig auskühlen oder trocknen."],
  section_hair: ["Teile das Haar in Partien, damit du überall gleichmäßig arbeiten kannst."],
  secure_gently: ["Binde locker; nimm es ab, sobald es zieht."],
  apply_product: ["Setze das Produkt gezielt am Ansatz oder auf der Kopfhaut auf."],
  wash_scalp_assist: ["Arbeite mit leichtem Druck in kreisenden Bewegungen."],
  reduce_surface_friction: ["Nutze es über Nacht so, wie es für dich bequem ist."],
  contain_hair: ["Halte die Längen locker zusammen; nichts soll spannen."],
  absorb_water: ["Drücke das Wasser sanft aus, statt zu rubbeln."],
  plop: ["Lege die Längen locker in das Tuch und wickle es ohne Zug ein."],
}

const CONDITIONAL_NOTES_DE: Record<ToolConditionalReason, string> = {
  unverified_capability:
    "Ob deine Form dafür geeignet ist, wissen wir nicht sicher — geh behutsam vor und hör auf, wenn es zieht.",
  unknown_ownership: "Wir wissen noch nicht, ob du so etwas hast. Ergänze es im Feinschliff.",
  explicit_none: "Dafür fehlt dir noch ein passendes Tool. Ein konkretes Produkt folgt.",
  catalog_gap: "Wir haben dafür noch kein geprüftes Produkt. Ein konkretes Produkt folgt.",
  unverified_settings: "Zu Stufen und Temperatur haben wir für dein Gerät keine geprüften Angaben.",
  unverified_attachment: "Ob dein Gerät den passenden Aufsatz hat, ist nicht geprüft.",
  unverified_use_state: "Ob das Gerät auf feuchtem Haar genutzt werden darf, ist nicht geprüft.",
}

const GUIDANCE_COPY_DE: Record<string, string> = {
  "personal_plan.tools.guidance.gentle_towel_handling":
    "Drücke das Wasser sanft aus oder scrunche es ein – rubbel nicht.",
}

export type ToolDayProjection = {
  shelf: ToolShelfSlotView[]
  sections: ToolUseSectionView[]
  /** Behaviour-only guidance, rendered as ordinary transition steps. */
  transitions: Array<{ stepKey: string; copyDe: string; placement: ToolPlacement }>
}

export function projectToolsForDay(input: {
  dayType: ApplicationDayTypeKey
  assets: readonly ToolAsset[]
  occurrences: readonly ToolOccurrence[]
  guidance: readonly ToolGuidance[]
}): ToolDayProjection {
  const assetByKey = new Map(input.assets.map((asset) => [asset.assetKey, asset]))
  const sections: ToolUseSectionView[] = []
  const shelfKeys = new Set<string>()
  const shelf: ToolShelfSlotView[] = []

  for (const occurrence of input.occurrences) {
    const placement = placementFor(occurrence.anchor)
    if (!placement || !occursOn(input.dayType, placement)) continue
    const asset = assetByKey.get(occurrence.assetKey)
    if (!asset) continue
    const lead = asset.productTypes[0]

    sections.push({
      kind: "tool_use",
      stepKey: occurrence.occurrenceKey,
      assetKey: asset.assetKey,
      typeLabelDe: TOOL_PRODUCT_TYPE_LABELS[lead],
      familyLabelDe: TOOL_FAMILY_LABELS[asset.family],
      imageUrl: toolImageSrc(lead),
      imageAltDe: toolImageAlt(lead),
      purposeDe: asset.purposeKey,
      actionsDe: CAPABILITY_ACTIONS_DE[occurrence.capability] ?? [],
      conditionalNoteDe: occurrence.executable
        ? null
        : CONDITIONAL_NOTES_DE[occurrence.conditionalReason ?? "unknown_ownership"],
      placement,
    })

    // Only a Tool the user can actually reach for belongs on the day's shelf.
    if (occurrence.executable && !shelfKeys.has(asset.assetKey)) {
      shelfKeys.add(asset.assetKey)
      shelf.push({
        kind: "tool",
        assetKey: asset.assetKey,
        typeLabelDe: TOOL_PRODUCT_TYPE_LABELS[lead],
        imageUrl: toolImageSrc(lead),
        imageAltDe: toolImageAlt(lead),
        familyLabelDe: TOOL_FAMILY_LABELS[asset.family],
      })
    }
  }

  const transitions = input.guidance.flatMap((entry) => {
    const placement = placementFor(entry.anchor)
    if (!placement || !occursOn(input.dayType, placement)) return []
    const copyDe = GUIDANCE_COPY_DE[entry.copyKey]
    if (!copyDe) return []
    return [{ stepKey: entry.guidanceKey, copyDe, placement }]
  })

  // Sections and guidance are returned in day order so every caller renders the
  // same sequence: wash aids, detangling, drying, styling, then the nightly step.
  return {
    shelf,
    sections: [...sections].sort(byPlacement),
    transitions: [...transitions].sort(byPlacement),
  }
}

function byPlacement(
  left: { placement: ToolPlacement },
  right: { placement: ToolPlacement },
): number {
  return (
    TOOL_PLACEMENT_ORDER.indexOf(left.placement) - TOOL_PLACEMENT_ORDER.indexOf(right.placement)
  )
}

function placementFor(anchor: ToolOccurrence["anchor"]): ToolPlacement | null {
  switch (anchor.kind) {
    case "wash_day":
      return anchor.phase
    case "nightly":
      return "nightly"
    case "styling_session":
      return "styling"
    case "after_step":
    case "before_step":
      return "post_wash"
  }
}

function occursOn(dayType: ApplicationDayTypeKey, placement: ToolPlacement): boolean {
  if (placement === "nightly") return true
  if (placement === "styling") return STYLING_DAYS.has(dayType)
  return WASH_DAYS.has(dayType)
}
