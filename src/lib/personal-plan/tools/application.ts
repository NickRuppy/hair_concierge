import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"

import {
  dayAnchorIndex,
  placementForAnchor,
  type ToolAsset,
  type ToolCapability,
  type ToolConditionalReason,
  type ToolDayAnchor,
  type ToolGuidance,
  type ToolOccurrence,
  type ToolOccurrenceAnchor,
  type ToolPlacement,
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
  /** Position on the shared day graph — the ordering authority (`D7`). */
  anchor: ToolOccurrenceAnchor
  /** Coarse phase, DERIVED from `anchor`. */
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

// Ordering is the graph's job (`D7`); `ToolPlacement` only groups a rendered
// step into its coarse phase.
export { type ToolPlacement } from "./contracts"

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

/**
 * German instructions per capability.
 *
 * The record is TOTAL on purpose: a recommended Tool step that renders with an
 * empty instruction block is a step the user cannot act on, and the missing
 * `create_volume` and `airflow_shape` entries are exactly how heated, heatless
 * and shaping-brush steps shipped with nothing under the heading. A new
 * capability now fails the type check instead of silently rendering blank.
 *
 * Register: telegram-short, du-form, „empfohlen" rather than „nötig, sonst
 * Schaden".
 */
const CAPABILITY_ACTIONS_DE: Record<ToolCapability, string[]> = {
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
  concentrate_airflow: [
    "Setz die Stylingdüse auf und richte den Luftstrom auf eine Partie.",
    "Führe ihn von oben nach unten mit.",
  ],
  air_shape: ["Arbeite in Partien und lass jede Partie kurz auskühlen."],
  airflow_shape: [
    "Führe die Bürste mit dem Luftstrom durch eine Partie.",
    "Lass jede Partie kurz auskühlen, bevor du sie loslässt.",
  ],
  straighten: [
    "Arbeite in dünnen Partien und zieh in einem ruhigen Zug durch.",
    "Geh pro Partie nur einmal durch, wenn es reicht.",
  ],
  smooth: ["Arbeite in Partien von oben nach unten, ohne Druck."],
  curl: [
    "Wickle eine Partie auf und halte sie nur kurz.",
    "Lass jede Locke auskühlen, bevor du sie anfasst.",
  ],
  wave: ["Arbeite in Partien und setz die Wellen locker.", "Lass sie vollständig auskühlen."],
  create_volume: [
    "Arbeite in Partien und heb sie am Ansatz leicht ab.",
    "Lass die Form vollständig auskühlen oder trocknen, bevor du sie löst.",
  ],
  set_style: ["Setze in Partien und lass die Form vollständig auskühlen oder trocknen."],
  define_pattern: [
    "Arbeite in Partien und stör das Muster so wenig wie möglich.",
    "Fass es danach so wenig wie möglich an.",
  ],
  preserve_shape: ["Leg die Form locker ab, damit sie erhalten bleibt."],
  section_hair: [
    "Teile das Haar in Partien, damit du überall gleichmäßig arbeiten kannst.",
    // C04: the low-tension fallback belongs to the step itself, not to a note
    // somewhere else. Proactive guidance — no claim about how you clip today.
    "Nur so fest wie nötig — lös es, setz es um oder nimm es ab, wenn es zieht oder wehtut.",
  ],
  secure_gently: [
    "Binde locker; nimm es ab, sobald es zieht.",
    "Nur so fest wie nötig — lös es, setz es um oder nimm es ab, wenn es zieht oder wehtut.",
  ],
  hold_hair: ["Halte die Partie locker; nichts soll spannen."],
  apply_product: ["Setze das Produkt gezielt am Ansatz oder auf der Kopfhaut auf."],
  wash_scalp_assist: ["Arbeite mit leichtem Druck in kreisenden Bewegungen."],
  // N06: comfortable coverage, loose fit, and loosen/reposition/remove on
  // pulling or pain. Containment and style preservation only — no repair,
  // growth or breakage-prevention claim.
  reduce_surface_friction: [
    "Deck den gewünschten Bereich bequem ab; getragene Formen sitzen locker am Ansatz.",
    "Lös es, setz es um oder nimm es ab, wenn es zieht oder wehtut.",
  ],
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
  transitions: Array<{
    stepKey: string
    copyDe: string
    anchor: ToolOccurrenceAnchor
    placement: ToolPlacement
  }>
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
    if (!occursOn(input.dayType, occurrence.anchor)) continue
    const placement = placementForAnchor(occurrence.anchor)
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
      actionsDe: CAPABILITY_ACTIONS_DE[occurrence.capability],
      conditionalNoteDe: occurrence.executable
        ? null
        : CONDITIONAL_NOTES_DE[occurrence.conditionalReason ?? "unknown_ownership"],
      anchor: occurrence.anchor,
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
    if (!occursOn(input.dayType, entry.anchor)) return []
    const copyDe = GUIDANCE_COPY_DE[entry.copyKey]
    if (!copyDe) return []
    return [
      {
        stepKey: entry.guidanceKey,
        copyDe,
        anchor: entry.anchor,
        placement: placementForAnchor(entry.anchor),
      },
    ]
  })

  // Sections and guidance are returned in graph order so every caller renders
  // the same sequence, and so the view adapter can interleave them with the
  // product steps that sit on the very same graph.
  return {
    shelf,
    sections: [...sections].sort(byAnchor),
    transitions: [...transitions].sort(byAnchor),
  }
}

function byAnchor(
  left: { anchor: ToolOccurrenceAnchor },
  right: { anchor: ToolOccurrenceAnchor },
): number {
  return dayAnchorIndex(left.anchor) - dayAnchorIndex(right.anchor)
}

/**
 * Which days a graph position can occur on.
 *
 * The wash positions belong to a wash day. The drying and styling positions
 * belong to every day on which a styling session can genuinely happen — the
 * four wash days plus the styling day — so a Glätteisen session no longer
 * disappears from the Stylingtag just because it moved onto the heat position.
 * `nightly` happens every day.
 */
const STYLING_SESSION_ANCHORS = new Set<ToolDayAnchor>([
  "dry_pre_heat",
  "heat_tool",
  "dry_finish",
  "styling_session",
])

function occursOn(dayType: ApplicationDayTypeKey, anchor: ToolOccurrenceAnchor): boolean {
  if (anchor.position === "nightly") return true
  if (STYLING_SESSION_ANCHORS.has(anchor.position)) return STYLING_DAYS.has(dayType)
  return WASH_DAYS.has(dayType)
}
