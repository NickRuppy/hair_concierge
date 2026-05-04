import {
  buildRoutinePlan,
  deriveRoutineContext,
  projectRoutinePlanForLayer,
} from "@/lib/routines/planner"
import type {
  HairProfile,
  RoutineLayer,
  RoutinePlan,
  RoutineProductCategory,
  RoutineSlotAdvice,
} from "@/lib/types"

export type BuildOrFixRoutineAction = "keep" | "add" | "adjust" | "remove"
export type RoutineObjective = "build_routine" | "fix_routine"

export interface BuildOrFixRoutineStep {
  id: string
  label: string
  necessity: "core" | "recommended" | "optional"
  action: BuildOrFixRoutineAction
  category: string | null
  frequency: string | null
  reasons: string[]
  caveats: string[]
  fillable: boolean
}

export interface BuildOrFixRoutineMissingInfo {
  key: "hair_texture" | "wash_frequency" | "current_routine_products"
  label: string
  why_it_matters: string
  blocking: boolean
  expected_type: "HairTexture" | "WashFrequency" | "RoutineProduct[]"
}

export interface BuildOrFixRoutineProjection {
  objective: string | null
  steps: BuildOrFixRoutineStep[]
  missing_info: BuildOrFixRoutineMissingInfo[]
  confidence: number
}

export interface BuildOrFixRoutineToolInput {
  objective?: RoutineObjective | null
  message?: string | null
  hairProfile: HairProfile | null
  layer?: RoutineLayer | null
  requestedCategory?: RoutineProductCategory | null
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function normalizeObjective(value: string | null | undefined): RoutineObjective | null {
  return value === "build_routine" || value === "fix_routine" ? value : null
}

function projectNecessity(slot: RoutineSlotAdvice): BuildOrFixRoutineStep["necessity"] {
  if (slot.kind === "instruction") {
    return "optional"
  }

  if (slot.action === "avoid") {
    return "optional"
  }

  if (
    slot.phase === "base_wash" &&
    slot.kind === "product_slot" &&
    (slot.category === "shampoo" || slot.category === "conditioner")
  ) {
    return "core"
  }

  if (slot.phase === "base_wash") {
    return "recommended"
  }

  if (slot.phase === "maintenance") {
    return "recommended"
  }

  return "optional"
}

function projectAction(slot: RoutineSlotAdvice): BuildOrFixRoutineStep["action"] {
  switch (slot.action) {
    case "keep":
      return "keep"
    case "adjust":
    case "upgrade":
      return "adjust"
    case "add":
      return "add"
    case "avoid":
      return "remove"
  }
}

function projectStep(slot: RoutineSlotAdvice): BuildOrFixRoutineStep {
  return {
    id: slot.id,
    label: slot.label,
    necessity: projectNecessity(slot),
    action: projectAction(slot),
    category: slot.category,
    frequency: slot.cadence,
    reasons: slot.rationale,
    caveats: slot.caveats,
    fillable: slot.product_linkable,
  }
}

function findRoutineSlot(plan: RoutinePlan, id: string): RoutineSlotAdvice | null {
  for (const section of plan.sections) {
    const slot = section.slots.find((candidate) => candidate.id === id)
    if (slot) return slot
  }

  return null
}

function projectRoutineSteps(params: {
  plan: RoutinePlan
  layer: RoutineLayer | null
  requestedCategory: RoutineProductCategory | null
}): BuildOrFixRoutineStep[] {
  if (!params.layer) {
    return params.plan.sections.flatMap((section) => section.slots.map(projectStep))
  }

  const projection = projectRoutinePlanForLayer(params.plan, params.layer, {
    requestedCategory: params.requestedCategory,
  })

  return projection.visible_slot_ids
    .map((slotId) => findRoutineSlot(params.plan, slotId))
    .filter((slot): slot is RoutineSlotAdvice => Boolean(slot))
    .map(projectStep)
}

function buildMissingInfo(params: {
  objective: RoutineObjective | null
  hairProfile: HairProfile | null
  context: ReturnType<typeof deriveRoutineContext>
}): BuildOrFixRoutineMissingInfo[] {
  const { objective, hairProfile, context } = params
  const missing: BuildOrFixRoutineMissingInfo[] = []

  if (!context.hair_texture) {
    missing.push({
      key: "hair_texture",
      label: "Haarmuster",
      why_it_matters: "Das Haarmuster legt fest, wie die Basisroutine strukturiert wird.",
      blocking: false,
      expected_type: "HairTexture",
    })
  }

  if (!context.wash_frequency) {
    missing.push({
      key: "wash_frequency",
      label: "Waschfrequenz",
      why_it_matters: "Die Waschfrequenz bestimmt, wie oft die Routine wirklich greifen muss.",
      blocking: false,
      expected_type: "WashFrequency",
    })
  }

  if (objective !== "build_routine" && (hairProfile?.current_routine_products ?? []).length === 0) {
    missing.push({
      key: "current_routine_products",
      label: "Aktuelle Routine",
      why_it_matters:
        "Ohne die vorhandenen Schritte laesst sich nicht sauber sagen, was beibehalten oder ersetzt werden sollte.",
      blocking: false,
      expected_type: "RoutineProduct[]",
    })
  }

  return missing
}

function buildPlannerPrompt(params: {
  objective: RoutineObjective | null
  message: string | null
}): string {
  const parts: string[] = []

  if (params.objective === "build_routine") {
    parts.push("Routine neu aufbauen.")
  } else if (params.objective === "fix_routine") {
    parts.push("Bestehende Routine vereinfachen und korrigieren. Zu viele Produkte vermeiden.")
  }

  if (params.message) {
    parts.push(params.message)
  }

  return parts.join("\n\n")
}

export function projectRoutinePlan(params: {
  objective?: RoutineObjective | null
  hairProfile: HairProfile | null
  message?: string | null
  usesBondBuilder?: boolean
  layer?: RoutineLayer | null
  requestedCategory?: RoutineProductCategory | null
}): BuildOrFixRoutineProjection {
  const objective = normalizeObjective(params.objective)
  const prompt = buildPlannerPrompt({
    objective,
    message: normalizeText(params.message),
  })
  const context = deriveRoutineContext(params.hairProfile, prompt)
  const plan: RoutinePlan = buildRoutinePlan(params.hairProfile, prompt, {
    usesBondBuilder: params.usesBondBuilder ?? false,
  })

  const inventoryMatters = objective !== "build_routine"
  const completedBase =
    Number(Boolean(context.hair_texture)) + Number(Boolean(context.wash_frequency))
  const completed =
    completedBase +
    (inventoryMatters ? Number((params.hairProfile?.current_routine_products ?? []).length > 0) : 0)
  const denominator = inventoryMatters ? 3 : 2

  return {
    objective,
    steps: projectRoutineSteps({
      plan,
      layer: params.layer ?? null,
      requestedCategory: params.requestedCategory ?? null,
    }),
    missing_info: buildMissingInfo({ objective, hairProfile: params.hairProfile, context }),
    confidence: Math.round((completed / denominator) * 100) / 100,
  }
}

export function createBuildOrFixRoutineTool() {
  return async function buildOrFixRoutineTool(
    params: BuildOrFixRoutineToolInput,
  ): Promise<BuildOrFixRoutineProjection> {
    return projectRoutinePlan(params)
  }
}

export { projectRoutinePlan as projectBuildOrFixRoutinePlan }
