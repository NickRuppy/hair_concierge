import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildRoutineChatSeedMessage,
  type RoutineChatTriggerInput,
  type RoutineChatTriggerType,
} from "@/lib/routines/chat-triggers"
import { buildConversationStateUpsertPayload } from "@/lib/chat-runtime/conversation-state-store"
import {
  createDefaultAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
} from "@/lib/agent-v2/production/persisted-session-state"
import type {
  AgentV2ActiveProductContext,
  AgentV2ActiveResolvedProductContext,
} from "@/lib/agent-v2/resolved-product-selection-adapter"
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
  from(table: "conversations" | "conversation_states"): {
    insert(payload: { user_id: string; title: string | null; is_active: true }): {
      select(columns: "id"): {
        single(): Promise<{ data: { id: string } | null; error: { message?: string } | null }>
      }
    }
    upsert(
      payload: ReturnType<typeof buildConversationStateUpsertPayload>,
      options: { onConflict: "conversation_id" },
    ): Promise<{ error: { message?: string } | null }>
  }
}

type TriggerDbError = { message?: string }
type TriggerConversationUpdateBuilder = PromiseLike<{ error: TriggerDbError | null }> & {
  eq(column: "id" | "user_id", value: string): TriggerConversationUpdateBuilder
}

type TriggerStateClient = {
  from(table: "conversation_states"):
    | {
        upsert(
          payload: ReturnType<typeof buildConversationStateUpsertPayload>,
          options: { onConflict: "conversation_id" },
        ): Promise<{ error: TriggerDbError | null }>
      }
    | never
  from(table: "conversations"):
    | {
        update(payload: { is_active: false }): TriggerConversationUpdateBuilder
      }
    | never
}

export interface RoutineChatTriggerPostHandlerDeps {
  createClient?: () => Promise<TriggerRouteClient>
  createStateClient?: () => TriggerStateClient
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

/**
 * Sidebar title for the seeded conversation. `/api/chat` only titles
 * conversations it creates itself, so routine-triggered chats must get a
 * meaningful German title at creation time (no LLM call needed).
 */
function conversationTitle(type: RoutineChatTriggerInput["type"], card: RoutineUiCard): string {
  if (type === "onboard_category") return `Routine · ${card.categoryLabel}`
  const productName = card.productName?.trim()
  const subject = productName && productName.length <= 40 ? productName : card.categoryLabel
  return type === "alternatives" ? `Alternativen · ${subject}` : `Routine · ${subject}`
}

function buildRoutineProductConversationStateTransition(params: {
  card: RoutineUiCard
  seedMessage: string
  nowIso?: string
}): AgentV2ConversationStateTransition | null {
  const productId = params.card.product?.id?.trim()
  const displayName = params.card.productName?.trim()
  if (!productId || !displayName) return null

  const previousState = createDefaultAgentV2ConversationState()
  const activeProductContext: AgentV2ActiveProductContext = {
    status: "resolved",
    product_id: productId,
    submission_id: null,
    category: params.card.category,
    brand_text: params.card.product?.brand ?? null,
    product_name_text: displayName,
    display_name: displayName,
    original_user_message: params.seedMessage,
    source: "routine_inventory",
    updated_at: params.nowIso ?? new Date().toISOString(),
  }
  const activeResolvedProductContext: AgentV2ActiveResolvedProductContext = {
    source: "routine_inventory",
    product_id: productId,
    name: displayName,
    category: params.card.category,
    original_user_message: params.seedMessage,
  }

  return {
    previous_state: previousState,
    next_state: {
      ...previousState,
      agent_v2: {
        ...previousState.agent_v2,
        active_product_contexts: [activeProductContext],
        active_resolved_product_context: activeResolvedProductContext,
      },
    },
    reason: "routine_chat_trigger_seeded_product_context",
    changed_fields: [
      "agent_v2.active_product_contexts",
      "agent_v2.active_resolved_product_context",
    ],
    classifier_override: null,
    updated_by_engine: previousState.engine,
  }
}

async function deactivateCreatedConversation(
  stateClient: TriggerStateClient,
  params: { conversationId: string; userId: string },
): Promise<void> {
  try {
    const { error } = await stateClient
      .from("conversations")
      .update({ is_active: false })
      .eq("id", params.conversationId)
      .eq("user_id", params.userId)

    if (error) {
      console.error("Failed to deactivate failed routine-trigger conversation:", error)
    }
  } catch (error) {
    console.error("Failed to deactivate failed routine-trigger conversation:", error)
  }
}

export function createRoutineChatTriggerPostHandler(
  overrides: RoutineChatTriggerPostHandlerDeps = {},
) {
  const deps: Required<RoutineChatTriggerPostHandlerDeps> = {
    createClient: async () => (await createClient()) as unknown as TriggerRouteClient,
    createStateClient: () => createAdminClient() as unknown as TriggerStateClient,
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
        title: conversationTitle(parsed.type, card),
        is_active: true,
      })
      .select("id")
      .single()

    if (error || !createdConversation) {
      return NextResponse.json({ error: fehler("Erstellen", "der Unterhaltung") }, { status: 500 })
    }

    const seedMessage = buildRoutineChatSeedMessage(serverRoutineTriggerInput(parsed, card))
    const stateTransition =
      parsed.type === "discuss_product"
        ? buildRoutineProductConversationStateTransition({ card, seedMessage })
        : null
    if (stateTransition) {
      const stateClient = deps.createStateClient()
      const { error: stateError } = await stateClient.from("conversation_states").upsert(
        buildConversationStateUpsertPayload({
          conversationId: createdConversation.id,
          userId: user.id,
          transition: stateTransition,
        }),
        { onConflict: "conversation_id" },
      )

      if (stateError) {
        console.error("Failed to seed routine conversation state:", stateError)
        await deactivateCreatedConversation(stateClient, {
          conversationId: createdConversation.id,
          userId: user.id,
        })
        return NextResponse.json(
          { error: fehler("Speichern", "des Routine-Kontexts") },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      conversationId: createdConversation.id,
      seedMessage,
    })
  }
}

export const POST = createRoutineChatTriggerPostHandler()
