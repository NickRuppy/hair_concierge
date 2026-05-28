import {
  buildRoutinePlan,
  deriveRoutineContext,
  projectRoutinePlanForLayer,
} from "@/lib/routines/planner"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  type RecommendationEngineRuntime,
} from "@/lib/recommendation-engine/runtime"
import {
  buildRoutineItemsFromInventoryCategories,
  type PersistenceRoutineItemRow,
} from "@/lib/recommendation-engine/adapters/from-persistence"
import {
  buildCareBalanceToolContext,
  type CareBalanceToolContext,
  type CareBalanceToolRow,
} from "@/lib/agent/tools/care-balance-context"
import type { BuildOrFixRoutineToolInput as AgentV2BuildOrFixRoutineToolInput } from "@/lib/agent-v2/tools/tool-definitions"
import type {
  HairProfile,
  RoutineLayer,
  RoutinePlan,
  RoutineProduct,
  RoutineProductCategory,
  RoutineSlotAdvice,
} from "@/lib/types"

export type BuildOrFixRoutineAction = "keep" | "add" | "adjust" | "remove"
export type RoutineObjective = "build_routine" | "fix_routine"
type BuildOrFixRoutineMutationKind = AgentV2BuildOrFixRoutineToolInput["mutation_kind"]

const CURRENT_ROUTINE_PRODUCT_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
  "serum",
  "scrub",
] as const satisfies readonly RoutineProduct[]

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

export interface BuildOrFixRoutineAdjacentLever {
  step_id: string
  label: string
  category: string | null
  role: "everyday_maintenance" | "cleanup_reset" | "optional_extra" | "supporting_step"
  reason: string
}

export interface BuildOrFixRoutinePriorityContext {
  selected_step_id: string | null
  selected_label: string | null
  selected_category: string | null
  selected_role: BuildOrFixRoutineAdjacentLever["role"] | null
  selected_reason: string | null
  adjacent_levers: BuildOrFixRoutineAdjacentLever[]
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
  priority_context?: BuildOrFixRoutinePriorityContext | null
  care_balance_context?: RoutineCareBalanceContext | null
}

export type RoutineCareBalanceContext = CareBalanceToolContext
export type RoutineCareBalanceRow = CareBalanceToolRow

export interface BuildOrFixRoutineToolInput {
  objective?: RoutineObjective | null
  message?: string | null
  hairProfile: HairProfile | null
  layer?: RoutineLayer | null
  requestedCategory?: RoutineProductCategory | null
  mutationKind?: BuildOrFixRoutineMutationKind
  routineItems?: PersistenceRoutineItemRow[]
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

function hasCurrentRoutineCategory(
  hairProfile: HairProfile | null,
  category: RoutineProductCategory | null,
): boolean {
  if (!category) return false
  const currentRoutineProducts = hairProfile?.current_routine_products ?? []
  if (
    CURRENT_ROUTINE_PRODUCT_CATEGORIES.includes(category as RoutineProduct) &&
    currentRoutineProducts.includes(category as RoutineProduct)
  ) {
    return true
  }

  const productsUsed = normalizeText(hairProfile?.products_used)?.toLowerCase() ?? ""
  return productsUsed.includes(category.toLowerCase())
}

function anchorRoutineReasons(params: {
  slot: RoutineSlotAdvice
  hairProfile: HairProfile | null
}): string[] {
  const reasons = [...params.slot.rationale]
  const action = projectAction(params.slot)
  const category = params.slot.category

  if (action === "keep" && hasCurrentRoutineCategory(params.hairProfile, category)) {
    reasons.unshift(
      `${params.slot.label} ist bereits ein vorhandener Startpunkt in deiner Routine.`,
    )
  }

  if (action === "add" && category === "conditioner") {
    reasons.unshift(`${params.slot.label} ist die naechste sinnvolle Ergaenzung nach dem Shampoo.`)
  }

  return Array.from(new Set(reasons))
}

function projectStep(
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
): BuildOrFixRoutineStep {
  return {
    id: slot.id,
    label: slot.label,
    necessity: projectNecessity(slot),
    action: projectAction(slot),
    category: slot.category,
    frequency: slot.cadence,
    reasons: anchorRoutineReasons({ slot, hairProfile }),
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

function classifyRoutineStepRole(slot: RoutineSlotAdvice): BuildOrFixRoutineAdjacentLever["role"] {
  if (slot.id.includes("hair-reset") || slot.topic_ids.includes("tiefenreinigung")) {
    return "cleanup_reset"
  }

  if (slot.category === "leave_in") {
    return "everyday_maintenance"
  }

  if (slot.phase === "occasional") {
    return "optional_extra"
  }

  return "supporting_step"
}

function projectAdjacentLever(slot: RoutineSlotAdvice): BuildOrFixRoutineAdjacentLever {
  return {
    step_id: slot.id,
    label: slot.label,
    category: slot.category,
    role: classifyRoutineStepRole(slot),
    reason: slot.rationale[0] ?? "",
  }
}

function projectPriorityContext(plan: RoutinePlan): BuildOrFixRoutinePriorityContext | null {
  const selectedSlot = plan.priority_lever
    ? findRoutineSlot(plan, plan.priority_lever.slot_id)
    : null
  if (!selectedSlot) return null

  const adjacentLevers = plan.sections
    .flatMap((section) => section.slots)
    .filter((slot) => slot.id !== selectedSlot.id)
    .filter(
      (slot) => slot.category === "leave_in" || slot.category === "mask" || slot.category === "oil",
    )
    .slice(0, 3)
    .map(projectAdjacentLever)

  return {
    selected_step_id: selectedSlot.id,
    selected_label: selectedSlot.label,
    selected_category: selectedSlot.category,
    selected_role: classifyRoutineStepRole(selectedSlot),
    selected_reason: plan.priority_lever?.reason ?? selectedSlot.rationale[0] ?? null,
    adjacent_levers: adjacentLevers,
  }
}

function buildRoutineCareBalanceContext(
  runtime: RecommendationEngineRuntime,
): RoutineCareBalanceContext {
  const rowsWithActions = runtime.careBalance.rows.filter(
    (row) => row.recommendation !== "no_action",
  )
  const rows = rowsWithActions.length > 0 ? rowsWithActions : runtime.careBalance.rows

  return buildCareBalanceToolContext({ runtime, rows })
}

function projectRoutineSteps(params: {
  plan: RoutinePlan
  hairProfile: HairProfile | null
  layer: RoutineLayer | null
  requestedCategory: RoutineProductCategory | null
  mutationKind: BuildOrFixRoutineMutationKind | undefined
}): BuildOrFixRoutineStep[] {
  if (!params.layer) {
    return params.plan.sections.flatMap((section) =>
      section.slots.map((slot) => projectStep(slot, params.hairProfile)),
    )
  }

  const projection = projectRoutinePlanForLayer(params.plan, params.layer, {
    requestedCategory: params.requestedCategory,
    preferRequestedCategory: params.mutationKind === "add_step",
  })

  return projection.visible_slot_ids
    .map((slotId) => findRoutineSlot(params.plan, slotId))
    .filter((slot): slot is RoutineSlotAdvice => Boolean(slot))
    .map((slot) => projectStep(slot, params.hairProfile))
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
  mutationKind?: BuildOrFixRoutineMutationKind
  routineItems?: PersistenceRoutineItemRow[]
}): BuildOrFixRoutineProjection {
  const objective = normalizeObjective(params.objective)
  const prompt = buildPlannerPrompt({
    objective,
    message: normalizeText(params.message),
  })
  const context = deriveRoutineContext(params.hairProfile, prompt)
  const forceRequestedCategory =
    params.mutationKind === "add_step" ? (params.requestedCategory ?? null) : null
  const plan: RoutinePlan = buildRoutinePlan(params.hairProfile, prompt, {
    usesBondBuilder: params.usesBondBuilder ?? false,
    forceRequestedCategory,
  })
  const routineItems =
    params.routineItems ??
    buildRoutineItemsFromInventoryCategories(params.hairProfile?.current_routine_products)
  const runtime = buildRecommendationEngineRuntimeFromPersistence(params.hairProfile, routineItems)

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
      hairProfile: params.hairProfile,
      layer: params.layer ?? null,
      requestedCategory: params.requestedCategory ?? null,
      mutationKind: params.mutationKind,
    }),
    missing_info: buildMissingInfo({ objective, hairProfile: params.hairProfile, context }),
    confidence: Math.round((completed / denominator) * 100) / 100,
    priority_context: projectPriorityContext(plan),
    care_balance_context: buildRoutineCareBalanceContext(runtime),
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
