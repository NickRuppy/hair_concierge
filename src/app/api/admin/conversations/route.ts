import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: ERR_FORBIDDEN },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  const admin = createAdminClient()

  // Get conversations with user profile info and last message preview
  const { data: conversations, error, count } = await admin
    .from("conversations")
    .select(
      "id, user_id, title, message_count, created_at, updated_at, profiles!inner(full_name, email)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json(
      { error: fehler("Laden", "der Konversationen") },
      { status: 500 }
    )
  }

  // Fetch last message preview for each conversation
  const conversationIds = (conversations || []).map((c) => c.id)
  let lastMessages: Record<string, string> = {}

  if (conversationIds.length > 0) {
    // Get the most recent user message per conversation using distinct on
    const { data: messages } = await admin
      .from("messages")
      .select("conversation_id, content, role")
      .in("conversation_id", conversationIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })

    if (messages) {
      // Group by conversation_id, take first (most recent) per conversation
      for (const msg of messages) {
        if (!lastMessages[msg.conversation_id] && msg.content) {
          lastMessages[msg.conversation_id] = msg.content
        }
      }
    }
  }

  const result = (conversations || []).map((c) => ({
    id: c.id,
    user_id: c.user_id,
    title: c.title,
    message_count: c.message_count,
    created_at: c.created_at,
    updated_at: c.updated_at,
    user_name: (c.profiles as unknown as { full_name: string | null; email: string })?.full_name,
    user_email: (c.profiles as unknown as { full_name: string | null; email: string })?.email,
    last_message_preview: lastMessages[c.id]
      ? lastMessages[c.id].slice(0, 120)
      : null,
  }))

  return NextResponse.json({ conversations: result, total: count || 0 })
}
