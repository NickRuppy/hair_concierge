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
