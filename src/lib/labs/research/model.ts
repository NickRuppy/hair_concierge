export const RESEARCH_CATEGORIES = [
  { id: "oil", label: "Öle", legacyHref: "/labs/research?category=oil" },
  { id: "mask", label: "Masken", legacyHref: "/labs/mask-research" },
  { id: "shampoo", label: "Shampoo", legacyHref: "/labs/shampoo-research" },
  { id: "conditioner", label: "Conditioner", legacyHref: "/labs/conditioner-research" },
  { id: "leave-in", label: "Leave-in", legacyHref: "/labs/leave-in-research" },
] as const

export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number]["id"]
export type ResearchStatus = "open" | "rework" | "approved" | "excluded" | "pending" | "blocked"

export type ResearchEvidence = {
  title: string
  text?: string | null
  items?: string[]
  original?: unknown
}

export type ResearchLane = {
  id: string
  label: string
  value: string | null
  confidence: string | null
  reasoning: string | null
  provenance: string
  comparable: boolean
  unavailableReason?: string
  original?: unknown
}

export type ResearchAction = {
  id: string
  label: string
  kind: "approve" | "rework" | "complete" | "boundary"
  propertyId?: string
  enabled: boolean
  confirmation?: string
  // Resolved again on the server before dispatch; never trusted from a request.
  nativeBody: Record<string, unknown>
}

export type ResearchProperty = {
  id: string
  label: string
  value: string
  valueLabel: string
  confidence: string | null
  reasoning: string | null
  warning: string | null
  status: ResearchStatus
  lanes: ResearchLane[]
  comparisonNote?: string
  annotations: string[]
  evidence: ResearchEvidence[]
  actions: ResearchAction[]
  group?: "formula" | "projection" | "property"
}

export type ResearchQueueItem = {
  id: string
  name: string
  fullName: string
  brand: string
  packSize: string
  status: ResearchStatus
  openCount: number
  totalCount: number
  hint: string | null
}

export type ResearchDetail = ResearchQueueItem & {
  standard: string
  valueAuthority: string
  notices: string[]
  properties: ResearchProperty[]
  evidence: ResearchEvidence[]
  actions: ResearchAction[]
  blockers: string[]
  lastDecision: string | null
  displayFingerprint: string
}

export type ResearchLabData = {
  category: ResearchCategory
  dataset: string
  categoryLabel: string
  legacyHref: string
  standard: string
  queue: ResearchQueueItem[]
  detail: ResearchDetail
  evidence: ResearchEvidence[]
}

const VALUE_LABELS: Record<string, string> = {
  suitable: "Geeignet",
  conditional: "Bedingt geeignet",
  unsuitable: "Nicht geeignet",
  light: "Leicht",
  rich: "Reichhaltig",
  pure_plant_oil: "Reines Pflanzenöl",
  plant_oil_blend: "Pflanzenöl-Mischung",
  silicone_led: "Silikonbasis",
  ester_alkane_led: "Ester-/Alkanbasis",
  water_based: "Wasserbasis",
  hybrid: "Gemischte Basis",
  surface_led: "Oberflächenpflege",
  penetration_potential: "Eindringen möglich",
  leading: "Führend",
  supporting: "Ergänzend",
  trace: "Geringer Anteil",
  absent: "Nicht enthalten",
  unknown: "Nicht geklärt",
  pump: "Pumpe",
  spray: "Spray",
  dropper: "Pipette",
  pour: "Ausgießen",
  metered_drop: "Tropfenspender",
  pre_wash_fibre_treatment: "Vor der Haarwäsche",
  leave_on_fibre_conditioning: "Pflege im Haar belassen",
  dry_finish: "Finish im trockenen Haar",
  scalp_application: "Kopfhautanwendung",
  high: "Hoch",
  moderate: "Mittel",
  medium: "Mittel",
  low: "Niedrig",
  higher: "Höher",
  lower: "Geringer",
  moisture: "Feuchtigkeit",
  protein: "Protein",
  balanced: "Ausgewogen",
  general: "Allgemeine Pflege",
  repair: "Reparatur",
  shine: "Glanz",
  smoothing: "Glättung",
  detangling: "Entwirren",
  color_care: "Farbschutz",
  curl_support: "Locken-Unterstützung",
  volume: "Volumen",
  fine: "Fein",
  normal: "Normal",
  coarse: "Kräftig",
  healthy: "Gesund",
  moderately_damaged: "Mäßig geschädigt",
  highly_damaged: "Stark geschädigt",
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
  in_category: "In der Kategorie",
  true: "Ja",
  false: "Nein",
  gentle: "Sanft",
  strong: "Stark",
  regular: "Regelmäßig",
  frequent: "Häufig",
  clarifying: "Tiefenreinigung",
  targeted: "Gezielt",
  not_targeted: "Nicht gezielt",
  supported: "Unterstützt",
  not_supported: "Nicht unterstützt",
  none: "Keine",
}

export function researchValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (Array.isArray(value)) return value.length ? value.map(researchValue).join(" · ") : "Keiner"
  if (typeof value === "object") return JSON.stringify(value)
  const text = String(value)
  return (
    VALUE_LABELS[text] ??
    text
      .split(" · ")
      .map((part) => VALUE_LABELS[part] ?? part)
      .join(" · ")
  )
}

export function confidenceLabel(confidence: string | null): string {
  if (!confidence) return "nicht angegeben"
  return (
    (
      {
        high: "hoch",
        moderate: "mittel",
        medium: "mittel",
        low: "niedrig",
        moderately_high: "mittel bis hoch",
        low_moderate: "niedrig bis mittel",
      } as Record<string, string>
    )[confidence] ?? confidence
  )
}

export function researchStatusLabel(status: ResearchStatus): string {
  return {
    open: "Offen",
    rework: "In Nacharbeit",
    approved: "Freigegeben",
    excluded: "G0 bestätigt",
    pending: "Lauf ausstehend",
    blocked: "Blockiert",
  }[status]
}

export function supportsResearchDataset(category: ResearchCategory, dataset: string): boolean {
  if (category === "oil") return ["default", "intake", "candidate"].includes(dataset)
  if (category === "shampoo") return ["default", "pilot", "wave-01", "wave-02"].includes(dataset)
  return dataset === "default"
}
