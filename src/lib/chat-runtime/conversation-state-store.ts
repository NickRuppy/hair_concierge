import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createDefaultConversationState,
  normalizeConversationState,
} from "@/lib/chat-runtime/conversation-state"
import type {
  ConversationState,
  ConversationStatePersistenceTrace,
  ConversationStateTransition,
} from "@/lib/types"
import {
  normalizeAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
  type AgentV2ConversationStateV2,
} from "@/lib/agent-v2/production/persisted-session-state"

type PersistableConversationStateTransition =
  | ConversationStateTransition
  | AgentV2ConversationStateTransition

export function buildConversationStateUpsertPayload(params: {
  conversationId: string
  userId: string
  transition: PersistableConversationStateTransition
}) {
  return {
    conversation_id: params.conversationId,
    user_id: params.userId,
    state_version: params.transition.next_state.version,
    state: params.transition.next_state,
    last_transition: params.transition,
    updated_at: new Date().toISOString(),
  }
}

export async function loadConversationState(
  supabase: SupabaseClient,
  conversationId: string | null | undefined,
): Promise<ConversationState> {
  if (!conversationId) return createDefaultConversationState()

  const { data, error } = await supabase
    .from("conversation_states")
    .select("state")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load conversation state:", error)
    return createDefaultConversationState()
  }

  return normalizeConversationState(data?.state)
}

export async function loadAgentV2ConversationState(
  supabase: SupabaseClient,
  conversationId: string | null | undefined,
  userId?: string,
): Promise<AgentV2ConversationStateV2> {
  if (!conversationId) return normalizeAgentV2ConversationState(null)

  let query = supabase
    .from("conversation_states")
    .select("state")
    .eq("conversation_id", conversationId)

  if (userId) {
    query = query.eq("user_id", userId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error("Failed to load AgentV2 conversation state:", error)
    return normalizeAgentV2ConversationState(null)
  }

  return normalizeAgentV2ConversationState(data?.state)
}

export async function loadAgentV2ConversationStateForUser(
  supabase: SupabaseClient,
  params: { conversationId: string | null | undefined; userId: string },
): Promise<AgentV2ConversationStateV2> {
  if (!params.conversationId) return normalizeAgentV2ConversationState(null)

  const { data, error } = await supabase
    .from("conversation_states")
    .select("state")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load AgentV2 conversation state:", error)
    return normalizeAgentV2ConversationState(null)
  }

  return normalizeAgentV2ConversationState(data?.state)
}

export async function persistConversationStateTransition(
  supabase: SupabaseClient,
  params: {
    conversationId: string
    userId: string
    transition: PersistableConversationStateTransition
  },
): Promise<ConversationStatePersistenceTrace> {
  try {
    const { error } = await supabase
      .from("conversation_states")
      .upsert(buildConversationStateUpsertPayload(params), { onConflict: "conversation_id" })

    if (error) {
      console.error("Failed to persist conversation state:", error)
      return {
        status: "failed",
        error: error.message,
      }
    }

    return {
      status: "persisted",
      error: null,
    }
  } catch (error) {
    console.error("Failed to persist conversation state:", error)
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Unknown conversation state persistence error",
    }
  }
}
