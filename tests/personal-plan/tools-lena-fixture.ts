import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import { buildToolView, type ToolView } from "@/lib/personal-plan/tools/read-view"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type { CareHabitsV1, FieldProvenanceValue } from "@/lib/user-facts/schema"

import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

/**
 * Lena (plan §6): Föhn, Warmluftbürste, Glätteisen, Rundbürste, Grobzinkiger Kamm,
 * Mikrofaser-Handtuch, Glatter Kissenbezug (z. B. Seide, Satin) — every page answered by her (`user` provenance).
 * These are the read-time inputs `buildToolView` gets on the Routine and Anwendung surfaces.
 */
export function lenaNeedSnapshot(): InitialNeedPlanSnapshot {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-10-10T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

export type LenaOptions = {
  /** Default `gentle_press`. `rough_rubbing` makes the engine emit the towel correction. */
  towelTechnique?: "gentle_press" | "rough_rubbing"
  /** Default `mikrofaser` (owned and reported). `frottee` leaves the towel page unreported. */
  towelMaterial?: "mikrofaser" | "frottee"
  /** A scalp product with an application job in the shown Routine (→ Applikator). */
  scalpJob?: boolean
}

export function lenaFacts(options: LenaOptions = {}): {
  careHabits: Partial<CareHabitsV1>
  fieldProvenance: Record<string, FieldProvenanceValue>
} {
  const material = options.towelMaterial ?? "mikrofaser"
  const careHabits = {
    toolFamiliesWithSomething: [
      ...(material === "mikrofaser" ? ["drying_textiles"] : []),
      "brushes_combs",
      "airflow",
      "heated_styling",
      "heatless_styling",
      "securing_sectioning",
      "night_protection",
    ],
    toolForms_wash_application_1: [],
    ...(material === "mikrofaser" ? { toolForms_drying_textiles_1: ["microfiber_towel"] } : {}),
    toolForms_brushes_combs_1: ["wide_tooth_comb"],
    toolForms_brushes_combs_2: ["round_brush"],
    toolForms_airflow_1: ["hair_dryer", "hot_air_brush"],
    toolForms_heated_styling_1: ["flat_iron"],
    toolForms_heatless_styling_1: [],
    toolForms_securing_sectioning_1: [],
    toolForms_securing_sectioning_2: [],
    toolForms_night_protection_1: ["pillowcase"],
    towel: { material, technique: options.towelTechnique ?? "gentle_press" },
    dryingRoutes: ["air_dry", "ordinary_blow_dry"],
    additionalHeatTools: ["dryer_brush", "straightener"],
    nightProtection: ["silk_satin_pillow"],
  } as unknown as Partial<CareHabitsV1>
  return {
    careHabits,
    fieldProvenance: Object.fromEntries(Object.keys(careHabits).map((key) => [key, "user"])),
  }
}

/** The part of a Routine payload the engine reads for the scalp application job. */
export function lenaRoutine(options: LenaOptions = {}): RoutinePayloadV1 {
  return {
    source: { refinedVersionId: "refined-1" },
    items: options.scalpJob
      ? [{ category: "scalp_care", role: "scalp_comfort", state: { inclusion: "included" } }]
      : [],
  } as unknown as RoutinePayloadV1
}

export function lenaToolView(options: LenaOptions = {}): ToolView {
  const view = buildToolView({
    ...lenaFacts(options),
    needSnapshot: lenaNeedSnapshot(),
    routine: lenaRoutine(options),
    hasOptionalPage: false,
    toolsEnabled: true,
  })
  if (!view) throw new Error("unreachable")
  return view
}
