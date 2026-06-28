import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteConversationSourcedMemories } from "@/lib/chat-runtime/user-memory"
import { ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"
import { attachProductLineNamesToProducts } from "@/lib/product-lines/display"
import type { Product } from "@/lib/types"

type MessageWithProductRecommendations = {
  product_recommendations?: Product[] | null
}

export async function attachProductLineNamesToMessages<T extends MessageWithProductRecommendations>(
  messages: T[],
  client?: unknown,
): Promise<T[]> {
  const productLists = messages.map((message) =>
    Array.isArray(message.product_recommendations) ? message.product_recommendations : [],
  )
  const products = productLists.flat()
  if (products.length === 0) return messages

  let enrichedProducts: Product[]
  try {
    enrichedProducts = await attachProductLineNamesToProducts(
      products,
      client ?? createAdminClient(),
      {
        onError: (error) =>
          console.error(
            "Failed to load product lines for persisted recommendation products:",
            error,
          ),
      },
    )
  } catch (error) {
    console.error("Failed to enrich persisted recommendation products:", error)
    return messages
  }
  if (enrichedProducts === products) return messages

  let cursor = 0
  return messages.map((message, index) => {
    const originalProducts = productLists[index]
    if (!originalProducts || originalProducts.length === 0) return message

    const nextProducts = enrichedProducts.slice(cursor, cursor + originalProducts.length)
    cursor += originalProducts.length
    return {
      ...message,
      product_recommendations: nextProducts,
    }
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  // Verify ownership
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!conversation) {
    return NextResponse.json({ error: "Unterhaltung nicht gefunden" }, { status: 404 })
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  const messagesWithProductLines = await attachProductLineNamesToMessages(messages || [])

  return NextResponse.json({ conversation, messages: messagesWithProductLines })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const admin = createAdminClient()
  await deleteConversationSourcedMemories(user.id, id, admin)

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: fehler("Löschen") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
