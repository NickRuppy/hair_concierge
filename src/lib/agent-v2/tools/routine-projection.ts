import type {
  BuildOrFixRoutineMissingInfo,
  BuildOrFixRoutineProjection,
  RoutineCareBalanceContext,
} from "@/lib/agent/tools/build-or-fix-routine"
import type { AgentV2RoutineLayer } from "@/lib/agent-v2/contracts"

export interface AgentV2RoutineProjection {
  tool_name: "build_or_fix_routine"
  routine_layer: AgentV2RoutineLayer
  layer_purpose: string
  visible_steps: Array<{
    step_id: string
    label: string
    display_role: string
    category: string | null
    necessity: string
    action: string
    frequency: string | null
    short_reason: string
    caveats: string[]
    product_recommendation_allowed_if_explicit: boolean
  }>
  next_layer_options: Array<"goals" | "problems" | "deep_dive">
  return_path: Array<"goals" | "problems" | "deep_dive">
  product_request_policy: {
    default: "do_not_name_products"
    if_user_explicitly_asks: "call_select_products_for_requested_category"
  }
  care_balance_context?: RoutineCareBalanceContext | null
  missing_required_data: BuildOrFixRoutineMissingInfo[]
  conversation_prompt_de: string
}

export function projectRoutineForAgentV2(
  projection: BuildOrFixRoutineProjection,
  options: {
    requestedLayer?: AgentV2RoutineLayer | null
    includeCareBalanceContext?: boolean
  } = {},
): AgentV2RoutineProjection {
  const routineLayer = options.requestedLayer ?? inferRoutineLayer(projection)

  return {
    tool_name: "build_or_fix_routine",
    routine_layer: routineLayer,
    layer_purpose: LAYER_PURPOSES[routineLayer],
    visible_steps: projection.steps.map((step) => ({
      step_id: step.id,
      label: buildVisibleStepLabel(step),
      display_role: buildDisplayRole(step.necessity, step.action),
      category: step.category,
      necessity: step.necessity,
      action: step.action,
      frequency: step.frequency,
      short_reason: buildVisibleShortReason(step),
      caveats: step.caveats,
      product_recommendation_allowed_if_explicit: Boolean(step.fillable && step.category),
    })),
    next_layer_options: getNextLayerOptions(routineLayer),
    return_path: getReturnPath(routineLayer),
    product_request_policy: {
      default: "do_not_name_products",
      if_user_explicitly_asks: "call_select_products_for_requested_category",
    },
    ...(options.includeCareBalanceContext
      ? { care_balance_context: projection.care_balance_context ?? null }
      : {}),
    missing_required_data: projection.missing_info,
    conversation_prompt_de: getConversationPrompt(routineLayer),
  }
}

function buildVisibleStepLabel(step: BuildOrFixRoutineProjection["steps"][number]): string {
  if (step.category === "leave_in" && /^leave-in\s*\/\s*finish$/i.test(step.label.trim())) {
    return "Leichtes Leave-in"
  }

  return step.label
}

function buildVisibleShortReason(step: BuildOrFixRoutineProjection["steps"][number]): string {
  const reason = step.reasons[0] ?? ""
  if (step.category !== "leave_in") return reason

  return reason
    .replace(/\bEin Leave-in oder Finish-Schritt\b/g, "Ein Leave-in-Schritt")
    .replace(/\bLeave-in oder Finish-Schritt\b/g, "Leave-in-Schritt")
    .replace(/\bFinish-Schritt\b/g, "Leave-in-Schritt")
}

const LAYER_PURPOSES: Record<AgentV2RoutineLayer, string> = {
  basics: "Show shampoo, conditioner, and the single highest-impact extra lever.",
  goals: "Show up to three goal-directed routine levers.",
  problems: "Show up to three problem-solving routine levers.",
  deep_dive: "Explain the requested routine step or category in detail.",
}

function inferRoutineLayer(projection: BuildOrFixRoutineProjection): AgentV2RoutineLayer {
  if (projection.steps.length <= 1) {
    return "deep_dive"
  }

  return "basics"
}

function buildDisplayRole(necessity: string, action: string): string {
  if (necessity === "core") {
    return "Basis"
  }

  if (action === "remove") {
    return "Reduzieren"
  }

  if (necessity === "recommended") {
    return "Naechster Hebel"
  }

  return "Optional"
}

function getNextLayerOptions(
  layer: AgentV2RoutineLayer,
): Array<"goals" | "problems" | "deep_dive"> {
  if (layer === "basics") {
    return ["goals", "problems"]
  }

  if (layer === "goals" || layer === "problems") {
    return ["deep_dive"]
  }

  return []
}

function getReturnPath(layer: AgentV2RoutineLayer): Array<"goals" | "problems" | "deep_dive"> {
  if (layer === "deep_dive") {
    return ["goals", "problems"]
  }

  return []
}

function getConversationPrompt(layer: AgentV2RoutineLayer): string {
  if (layer === "basics") {
    return "Moechtest du als Naechstes eher sehen, was dich deinen Zielen naeherbringt, oder was konkrete Probleme loest?"
  }

  if (layer === "goals") {
    return "Wenn du moechtest, koennen wir danach die konkrete Produktauswahl fuer den wichtigsten Ziel-Hebel anschauen."
  }

  if (layer === "problems") {
    return "Wenn du moechtest, koennen wir danach den wichtigsten Problem-Hebel als Produkt-Deep-Dive anschauen."
  }

  return "Danach koennen wir zur Routine zurueckgehen und den naechsten Hebel einordnen."
}
