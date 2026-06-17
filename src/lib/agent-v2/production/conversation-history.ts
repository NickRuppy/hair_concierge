import { createAdminClient } from "@/lib/supabase/admin"
import type { Message } from "@/lib/types"

type ConversationHistoryQueryResult = {
  data: Message[] | null
  error: unknown
}

type ConversationHistoryClient = {
  from(table: "messages"): {
    select(columns: string): {
      eq(
        column: "conversation_id",
        value: string,
      ): {
        order(
          column: "created_at",
          options: { ascending: boolean },
        ): {
          limit(count: number): Promise<ConversationHistoryQueryResult>
        }
      }
    }
  }
}

type ConversationOwnershipQueryResult = {
  data: { id: string } | null
  error: unknown
}

type ConversationOwnershipClient = {
  from(table: "conversations"): {
    select(columns: string): {
      eq(
        column: "id" | "user_id",
        value: string,
      ): {
        eq(
          column: "id" | "user_id",
          value: string,
        ): {
          maybeSingle(): Promise<ConversationOwnershipQueryResult>
        }
        maybeSingle(): Promise<ConversationOwnershipQueryResult>
      }
    }
  }
}

export async function loadAgentV2ProductionConversationHistory(
  conversationId: string,
  client: unknown = createAdminClient(),
): Promise<Message[]> {
  const admin = client as ConversationHistoryClient
  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    console.error("Failed to load AgentV2 production conversation history:", error)
    return []
  }

  return ((data as Message[]) ?? []).slice().reverse()
}

export async function verifyAgentV2ProductionConversationOwnership(
  params: { conversationId: string; userId: string },
  client: unknown = createAdminClient(),
): Promise<boolean> {
  const admin = client as ConversationOwnershipClient
  const { data, error } = await admin
    .from("conversations")
    .select("id")
    .eq("id", params.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to verify AgentV2 production conversation ownership:", error)
    return false
  }

  return Boolean(data?.id)
}
