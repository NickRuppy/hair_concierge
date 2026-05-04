import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createDefaultConversationState,
  normalizeConversationState,
} from "@/lib/rag/conversation-state"
import type {
  ConversationState,
  ConversationStatePersistenceTrace,
  ConversationStateTransition,
} from "@/lib/types"

export function buildConversationStateUpsertPayload(params: {
  conversationId: string
  userId: string
  transition: ConversationStateTransition
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

export async function persistConversationStateTransition(
  supabase: SupabaseClient,
  params: {
    conversationId: string
    userId: string
    transition: ConversationStateTransition
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
