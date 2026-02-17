import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const admin = createAdminClient()

  // Fetch conversation
  const { data: conversation, error: convError } = await admin
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Konversation nicht gefunden" },
      { status: 404 }
    )
  }

  // Fetch messages
  const { data: messages, error: msgError } = await admin
    .from("messages")
    .select("id, conversation_id, role, content, image_url, product_recommendations, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  if (msgError) {
    return NextResponse.json(
      { error: fehler("Laden", "der Nachrichten") },
      { status: 500 }
    )
  }

  // Fetch user profile + hair profile
  const { data: userProfile } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at, hair_profiles(*)")
    .eq("id", conversation.user_id)
    .single()

  return NextResponse.json({
    conversation,
    messages: messages || [],
    user: userProfile,
  })
}
