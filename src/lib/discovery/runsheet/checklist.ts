import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"

import type { DiscoveryCockpitView } from "../cockpit"
import type { DiscoveryIntakeItem } from "../refined-routine"

/**
 * The runsheet's „Vor dem Call" checklist (consult-runsheet T2): a small, deterministic rule
 * list — the seed of the consult knowledge base. Each rule is its own predicate with a stable
 * id; the output is structured data with a stable item id, never German copy (the UI owns it).
 *
 * Pure and read-only: it reads the view's `unassigned` projection and never touches it.
 */

export type RunsheetPrepRuleId =
  | "research_open"
  | "score_missing"
  | "ask_bleach_cadence"
  | "ask_detangling"
  | "ask_where_she_shops"

export type RunsheetPrepItem =
  | {
      id: `research_open:${string}`
      kind: "research_open"
      intakeItemId: string
      /** Her product as the cockpit names it (a scanned unknown reads „Gescanntes Produkt · …"). */
      label: string
      category: PersonalPlanCategory | null
      /** The scanned barcode, when the intake row carries one and the caller passed it. */
      gtin: string | null
    }
  | { id: "score_missing"; kind: "score_missing" }
  | {
      id: "ask_bleach_cadence"
      kind: "ask_bleach_cadence"
      /** The profile's matching treatment values, as stored. */
      treatments: string[]
    }
  | {
      id: "ask_detangling"
      kind: "ask_detangling"
      triggers: Array<"elasticity_snaps" | "damage_concern">
      primaryConcern: DiagnosticConcern | null
    }
  | { id: "ask_where_she_shops"; kind: "ask_where_she_shops" }

/**
 * Her profile as the checklist reads it; every field optional (null/absent = unknown).
 *
 * - `chemicalTreatments`: any of the three stored vocabularies — `hair_profiles.chemical_treatment`
 *   (`bleached`, `colored`, …), the Idealplan snapshot's `profile.hair.chemicalTreatments`
 *   (`lightened`, `colored`, …) or the raw quiz answer (`blondiert`, `gefaerbt`, …).
 * - `elasticity`: the pull test — snapshot `profile.hair.elasticity` / quiz `pulltest` /
 *   `hair_profiles.protein_moisture_balance`, all `snaps | stretches_bounces | stretches_stays`.
 * - `primaryConcern`: her stated main problem as the cockpit's quiz projection resolves it
 *   (`DiscoveryQuizAnswers.mainConcern`).
 */
export type RunsheetPrepProfile = {
  chemicalTreatments?: readonly string[] | null
  elasticity?: string | null
  primaryConcern?: DiagnosticConcern | null
}

export type RunsheetPrepChecklistInput = {
  view: Pick<DiscoveryCockpitView, "unassigned">
  /** Captured intake rows, only to carry a research item's barcode; optional. */
  intakeItems?: ReadonlyArray<Pick<DiscoveryIntakeItem, "id" | "barcodeIdentifier">> | null
  /** The `discovery_call_sheets` row; null/absent = legacy enrollment without one. */
  callSheet?: { baselineScore: number | null | undefined } | null
  profile?: RunsheetPrepProfile | null
}

export type RunsheetPrepRule = {
  id: RunsheetPrepRuleId
  derive: (input: RunsheetPrepChecklistInput) => RunsheetPrepItem[]
}

/** Blondiert/aufgehellt or gefärbt, in every stored vocabulary (see `RunsheetPrepProfile`). */
const BLEACH_OR_COLOR_TREATMENTS = new Set([
  "bleached",
  "lightened",
  "blondiert",
  "colored",
  "gefaerbt",
])

/** „Reißt sofort" in the pull test. */
const BREAKS_IMMEDIATELY = "snaps"

/** Main concerns about structural damage (`DIAGNOSTIC_CONCERNS`). */
const DAMAGE_CONCERNS = new Set<DiagnosticConcern>(["hair_damage", "breakage", "split_ends"])

export const RUNSHEET_PREP_RULES: readonly RunsheetPrepRule[] = [
  {
    id: "research_open",
    derive: ({ view, intakeItems }) => {
      const barcodes = new Map((intakeItems ?? []).map((item) => [item.id, item.barcodeIdentifier]))
      return view.unassigned
        .filter((entry) => entry.reason === "research_pending")
        .map((entry) => ({
          id: `research_open:${entry.itemId}` as const,
          kind: "research_open" as const,
          intakeItemId: entry.itemId,
          label: entry.label,
          category: entry.category,
          gtin: barcodes.get(entry.itemId) ?? null,
        }))
    },
  },
  {
    id: "score_missing",
    derive: ({ callSheet }) =>
      typeof callSheet?.baselineScore === "number"
        ? []
        : [{ id: "score_missing", kind: "score_missing" }],
  },
  {
    id: "ask_bleach_cadence",
    derive: ({ profile }) => {
      const treatments = (profile?.chemicalTreatments ?? []).filter((value) =>
        BLEACH_OR_COLOR_TREATMENTS.has(value),
      )
      return treatments.length > 0
        ? [{ id: "ask_bleach_cadence", kind: "ask_bleach_cadence", treatments }]
        : []
    },
  },
  {
    id: "ask_detangling",
    derive: ({ profile }) => {
      const primaryConcern = profile?.primaryConcern ?? null
      const triggers: Array<"elasticity_snaps" | "damage_concern"> = []
      if (profile?.elasticity === BREAKS_IMMEDIATELY) triggers.push("elasticity_snaps")
      if (primaryConcern && DAMAGE_CONCERNS.has(primaryConcern)) triggers.push("damage_concern")
      return triggers.length > 0
        ? [{ id: "ask_detangling", kind: "ask_detangling", triggers, primaryConcern }]
        : []
    },
  },
  {
    id: "ask_where_she_shops",
    derive: () => [{ id: "ask_where_she_shops", kind: "ask_where_she_shops" }],
  },
]

/** The checklist, in rule order (research items in the view's `unassigned` order). */
export function derivePrepChecklist(input: RunsheetPrepChecklistInput): RunsheetPrepItem[] {
  return RUNSHEET_PREP_RULES.flatMap((rule) => rule.derive(input))
}
