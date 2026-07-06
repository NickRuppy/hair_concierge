import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildRoutineChatSeedMessage,
  type RoutineChatTriggerInput,
  type RoutineChatTriggerType,
} from "@/lib/routines/chat-triggers"
import { loadRoutineArtifactData } from "@/lib/routines/load-routine-artifact-data"
import { shapeRoutineForUi } from "@/lib/routines/shape-for-ui"
import type { RoutineArtifactData, RoutineUiCard, RoutineUiShape } from "@/lib/routines/types"
import {
  formatRoutineFrequency,
  routineCardStatusDescription,
} from "@/components/routine/routine-card-model"
import { ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"

const ROUTINE_CHAT_TRIGGER_TYPES = new Set<RoutineChatTriggerType>([
  "onboard_category",
  "discuss_product",
  "alternatives",
])

type TriggerRouteClient = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null } }>
  }
  from(table: "conversations"): {
    insert(payload: { user_id: string; title: null; is_active: true }): {
      select(columns: "id"): {
        single(): Promise<{ data: { id: string } | null; error: { message?: string } | null }>
      }
    }
  }
}

export interface RoutineChatTriggerPostHandlerDeps {
  createClient?: () => Promise<TriggerRouteClient>
  loadRoutineArtifactData?: (params: { userId: string }) => Promise<RoutineArtifactData>
  shapeRoutineForUi?: (input: {
    hairProfile: RoutineArtifactData["hairProfile"]
    usageRows: RoutineArtifactData["usageRows"]
    careBalanceRows: RoutineArtifactData["runtime"]["careBalance"]["rows"]
    pendingSubmissionsById: RoutineArtifactData["pendingSubmissionsById"]
    activeDismissedCategories?: RoutineArtifactData["activeDismissedCategories"]
  }) => RoutineUiShape
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseRoutineChatTriggerInput(body: unknown): RoutineChatTriggerInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null

  const candidate = body as Record<string, unknown>
  const type = candidate.type
  if (typeof type !== "string" || !ROUTINE_CHAT_TRIGGER_TYPES.has(type as RoutineChatTriggerType)) {
    return null
  }

  return {
    type: type as RoutineChatTriggerType,
    cardId: optionalString(candidate.cardId),
    usageId: optionalString(candidate.usageId),
    productId: optionalString(candidate.productId),
    category: optionalString(candidate.category),
  }
}

function shapeRoutine(
  data: RoutineArtifactData,
  shaper: NonNullable<RoutineChatTriggerPostHandlerDeps["shapeRoutineForUi"]>,
) {
  return shaper({
    hairProfile: data.hairProfile,
    usageRows: data.usageRows,
    careBalanceRows: data.runtime.careBalance.rows,
    pendingSubmissionsById: data.pendingSubmissionsById,
    activeDismissedCategories: data.activeDismissedCategories,
  })
}

function findRoutineCard(
  routine: RoutineUiShape,
  input: RoutineChatTriggerInput,
): RoutineUiCard | null {
  if (input.cardId) {
    return routine.cards.find((card) => card.id === input.cardId) ?? null
  }
  if (input.usageId) {
    return routine.cards.find((card) => card.usageRow?.id === input.usageId) ?? null
  }
  if (input.productId) {
    return routine.cards.find((card) => card.product?.id === input.productId) ?? null
  }
  if (input.category) {
    return routine.cards.find((card) => card.category === input.category) ?? null
  }
  return null
}

function serverRoutineTriggerInput(
  parsed: RoutineChatTriggerInput,
  card: RoutineUiCard,
): RoutineChatTriggerInput {
  return {
    type: parsed.type,
    cardId: card.id,
    usageId: card.usageRow?.id ?? null,
    productId: card.product?.id ?? null,
    category: card.category,
    categoryLabel: card.categoryLabel,
    productName: card.productName,
    brand: card.product?.brand ?? null,
    currentFrequency: formatRoutineFrequency(card.currentFrequency),
    targetFrequency: card.frequencyTarget?.preferredFrequency
      ? formatRoutineFrequency(card.frequencyTarget.preferredFrequency)
      : null,
    reason: routineCardStatusDescription(card),
  }
}

export function createRoutineChatTriggerPostHandler(
  overrides: RoutineChatTriggerPostHandlerDeps = {},
) {
  const deps: Required<RoutineChatTriggerPostHandlerDeps> = {
    createClient: async () => (await createClient()) as unknown as TriggerRouteClient,
    loadRoutineArtifactData,
    shapeRoutineForUi,
    ...overrides,
  }

  return async function routineChatTriggerPostHandler(request: Request) {
    const supabase = await deps.createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    let parsed: RoutineChatTriggerInput | null
    try {
      parsed = parseRoutineChatTriggerInput(await request.json())
    } catch {
      parsed = null
    }

    if (!parsed) {
      return NextResponse.json({ error: "Ungültiger Routine-Trigger" }, { status: 400 })
    }

    const routineData = await deps.loadRoutineArtifactData({ userId: user.id })
    const routine = shapeRoutine(routineData, deps.shapeRoutineForUi)
    const card = findRoutineCard(routine, parsed)
    if (!card) {
      return NextResponse.json({ error: "Routine-Kontext wurde nicht gefunden." }, { status: 404 })
    }

    const { data: createdConversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: null,
        is_active: true,
      })
      .select("id")
      .single()

    if (error || !createdConversation) {
      return NextResponse.json({ error: fehler("Erstellen", "der Unterhaltung") }, { status: 500 })
    }

    return NextResponse.json({
      conversationId: createdConversation.id,
      seedMessage: buildRoutineChatSeedMessage(serverRoutineTriggerInput(parsed, card)),
    })
  }
}

export const POST = createRoutineChatTriggerPostHandler()
