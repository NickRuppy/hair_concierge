import type { HairProfile, RoutineContext, RoutineSlotAction, RoutineSlotAdvice } from "@/lib/types"
import { CURLY_TEXTURES } from "@/lib/routines/constants"
import {
  deriveLeaveInStylingContextFromStages,
  hasDirectMechanicalStressSignals,
} from "@/lib/profile/signal-derivations"

const BRUSH_TOOLS_TERMS = [
  "buerste",
  "burste",
  "brush",
  "detangler",
  "detangling",
  "kamm",
  "comb",
  "paddle",
  "rundburste",
  "round brush",
  "fingerbrush",
  "denman",
  "scalp brush",
  "kopfhautbuerste",
  "applikator",
  "spruhflasche",
  "spruehflasche",
  "spruh bottle",
  "spray bottle",
  "stielkamm",
]

const DETANGLING_TERMS = [
  "entwirren",
  "detangle",
  "verhakt",
  "verknotet",
  "knoten",
  "kaemmbar",
  "kammen",
  "kaemmen",
  "nasses haar",
  "nasses entwirren",
  "wet detangling",
]

const DRY_STYLING_BRUSH_TERMS = [
  "paddle",
  "rundburste",
  "round brush",
  "foehnburste",
  "fohnburste",
  "blow dry brush",
]

const SCALP_TOOL_TERMS = [
  "kopfhaut",
  "scalp",
  "kopfhautserum",
  "scalp serum",
  "haaroel",
  "kopfhautoel",
  "hair oil",
  "applikator",
  "applikatorflasche",
  "kamm applikator",
  "scalp brush",
  "kopfhautmassage",
  "einmassieren",
]

const REFRESH_TOOL_TERMS = [
  "spruhflasche",
  "spruehflasche",
  "spray bottle",
  "sprayer",
  "refresh",
  "lockenrefresh",
  "auffrischen",
]

const SECTIONING_TERMS = ["stielkamm", "abteilen", "scheitel", "sektion", "zopf", "hochstecken"]

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)))
}

/** Accepts an already-normalized message string (via normalizeText). */
export function hasExplicitBrushToolsRequest(normalizedMessage: string): boolean {
  return includesAny(normalizedMessage, BRUSH_TOOLS_TERMS)
}

/** Accepts an already-normalized message string (via normalizeText). */
export function hasBrushToolsNeed(
  profile: HairProfile | null,
  normalizedMessage: string,
  context: RoutineContext,
): boolean {
  return (
    hasDirectMechanicalStressSignals(
      profile?.towel_technique,
      profile?.brush_type,
      profile?.night_protection,
    ) ||
    profile?.brush_type === "paddle" ||
    profile?.brush_type === "round" ||
    profile?.brush_type === "boar_bristle" ||
    includesAny(normalizedMessage, DETANGLING_TERMS)
  )
}

export function buildBrushToolsSlot(
  profile: HairProfile | null,
  context: RoutineContext,
  normalizedMessage: string,
): RoutineSlotAdvice {
  const explicitBrushRequest = hasExplicitBrushToolsRequest(normalizedMessage)
  const hasMechanicalStressSignals = hasDirectMechanicalStressSignals(
    profile?.towel_technique,
    profile?.brush_type,
    profile?.night_protection,
  )
  const stylingContext = deriveLeaveInStylingContextFromStages(
    profile?.drying_method,
    profile?.heat_styling,
    profile?.styling_tools,
  )
  const wetDetanglingRelevant =
    hasMechanicalStressSignals ||
    includesAny(normalizedMessage, DETANGLING_TERMS) ||
    explicitBrushRequest
  const scalpToolRelevant =
    includesAny(normalizedMessage, SCALP_TOOL_TERMS) ||
    context.explicit_topic_ids.includes("hair_oiling")
  const refreshToolRelevant =
    includesAny(normalizedMessage, REFRESH_TOOL_TERMS) ||
    (context.has_between_wash_days &&
      context.hair_texture !== null &&
      CURLY_TEXTURES.has(context.hair_texture))
  const sectioningRelevant = includesAny(normalizedMessage, SECTIONING_TERMS)
  const dryStylingBrushRelevant =
    profile?.brush_type === "paddle" ||
    profile?.brush_type === "round" ||
    includesAny(normalizedMessage, DRY_STYLING_BRUSH_TERMS)

  const rationale: string[] = []

  if (wetDetanglingRelevant) {
    rationale.push(
      "Zum Entwirren im nassen oder feuchten Zustand lieber mit Slip arbeiten - Conditioner oder ein leichtes Leave-in helfen beim Gleiten.",
    )
    rationale.push(
      "Beim Entwirren immer in den Spitzen anfangen und von unten nach oben arbeiten; bei dichterem oder stark verknotetem Haar lieber in Sektionen.",
    )
    rationale.push(
      "Eine weiche Detangling-Buerste oder ein grobzinkiger Kamm ist hier meist die sicherere Basis als eine straffere Stylingbuerste.",
    )
  }

  if (dryStylingBrushRelevant) {
    rationale.push(
      "Paddle- und Rundbuersten eher fuer trockenes Styling, Foehnen und Formen nutzen - nicht als Standard fuer nasses Entwirren.",
    )
  }

  if (scalpToolRelevant) {
    rationale.push(
      "Fuer Kopfhaut-Oel oder -Seren lieber scheitelweise mit Applikatorflasche oder Kamm-Applikator arbeiten und sparsam dosieren.",
    )
    rationale.push(
      "Eine Scalp-Brush bleibt optional: eher locker fuehren und die Kopfhaut sanft bewegen statt mit Druck ueber die Haut zu schrubben.",
    )
  }

  if (refreshToolRelevant) {
    rationale.push(
      "Fuer Wellen oder Locken zwischen den Waeschen reicht oft Wasser aus einer Spruehflasche zum Reaktivieren, bevor weiteres Produkt dazukommt.",
    )
  }

  if (sectioningRelevant) {
    rationale.push(
      "Ein Stielkamm ist vor allem zum Abteilen, Scheitel ziehen und Hochstecken sinnvoll - nicht zum groben Entwirren.",
    )
  }

  if (rationale.length === 0) {
    rationale.push(
      "Buersten und Tools sollten immer nach Funktion gewaehlt werden: schonendes Entwirren, sauberes Abteilen oder gezieltes Styling.",
    )
    rationale.push(
      "Je mehr Reibung und Zug entstehen, desto wichtiger werden weiche Tools, Slip und ein ruhiges Arbeiten in kleinen Abschnitten.",
    )
  }

  const caveats: string[] = [
    "Tools regelmaessig reinigen und nicht teilen, damit Rueckstaende und Kopfhautthemen nicht mitgeschleppt werden.",
  ]

  if (
    context.scalp_condition === "irritated" ||
    context.scalp_condition === "dry_flakes" ||
    context.scalp_condition === "dandruff"
  ) {
    caveats.push(
      "Bei gereizter oder schuppiger Kopfhaut auf harte Scalp-Brushes, viel Druck und Reibung verzichten.",
    )
  }

  if (context.concerns.includes("hair_loss") || context.concerns.includes("thinning")) {
    caveats.push(
      "Bei Haarausfall oder Ausduennung lieber besonders sanft arbeiten und keine aggressive Kopfhautmassage oder ruckartiges Entwirren empfehlen.",
    )
  }

  if (
    stylingContext === "heat_style" ||
    (context.heat_styling !== null && context.heat_styling !== "never")
  ) {
    caveats.push(
      "Beim Foehnen mit Buerste lieber mit Hitzeschutz und moderater Temperatur arbeiten, damit das Tool nicht zusaetzlich Schaden verstaerkt.",
    )
  }

  const needsAdjustment =
    profile?.brush_type === "paddle" ||
    profile?.brush_type === "round" ||
    profile?.brush_type === "boar_bristle" ||
    hasMechanicalStressSignals
  const action: RoutineSlotAction = needsAdjustment ? "adjust" : "add"

  return {
    id: "maintenance-brush-tools",
    kind: "instruction",
    phase: "maintenance",
    label: "Buersten & Tools",
    action,
    category: null,
    cadence: explicitBrushRequest
      ? "je nach Bedarf beim Entwirren, Auffrischen oder scheitelweisen Auftragen"
      : "im Alltag moeglichst reibungsarm einsetzen",
    rationale,
    caveats,
    topic_ids: ["brush_tools"],
    product_linkable: false,
    product_query: null,
    attachment_priority: 94,
  }
}
