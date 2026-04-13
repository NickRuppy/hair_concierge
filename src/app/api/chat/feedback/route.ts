import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLangfuseClient } from "@/lib/openai/client"
import { ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const [{ chatFeedbackSchema }] = await Promise.all([import("@/lib/validators")])
  const body = await request.json()
  const parsed = chatFeedbackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültiges Feedback", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { message_id, score } = parsed.data
  const admin = createAdminClient()

  const { data: messageRow, error: messageError } = await admin
    .from("messages")
    .select("id, conversation_id, role, langfuse_trace_id, user_feedback_score")
    .eq("id", message_id)
    .single()

  if (messageError || !messageRow) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 })
  }

  if (messageRow.role !== "assistant") {
    return NextResponse.json({ error: "Feedback nur für Assistant-Nachrichten" }, { status: 400 })
  }

  const { data: conversationRow, error: conversationError } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", messageRow.conversation_id)
    .single()

  if (conversationError || !conversationRow || conversationRow.user_id !== user.id) {
    return NextResponse.json({ error: fehler("Speichern", "des Feedbacks") }, { status: 403 })
  }

  if (messageRow.user_feedback_score === score) {
    return NextResponse.json({ success: true, score, unchanged: true })
  }

  const feedbackTimestamp = new Date().toISOString()
  const { error: updateError } = await admin
    .from("messages")
    .update({
      user_feedback_score: score,
      user_feedback_at: feedbackTimestamp,
    })
    .eq("id", message_id)

  if (updateError) {
    return NextResponse.json({ error: fehler("Speichern", "des Feedbacks") }, { status: 500 })
  }

  const langfuse = getLangfuseClient()
  if (langfuse && messageRow.langfuse_trace_id) {
    langfuse.score.create({
      id: `chat-feedback-${message_id}`,
      traceId: messageRow.langfuse_trace_id,
      name: "user_feedback",
      value: score > 0 ? 1 : 0,
      comment: score > 0 ? "thumbs_up" : "thumbs_down",
      dataType: "BOOLEAN",
      metadata: {
        source: "chat_feedback",
        message_id,
      },
    })
    await langfuse.flush()
  }

  return NextResponse.json({
    success: true,
    score,
    feedback_at: feedbackTimestamp,
  })
}
