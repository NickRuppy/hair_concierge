import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runPipeline } from "@/lib/rag/pipeline"
import { extractConversationMemory } from "@/lib/rag/memory-extractor"
import { chatMessageSchema } from "@/lib/validators"
import { ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

// Rate limiting: simple in-memory store
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 1000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count++
  return true
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Zu viele Nachrichten. Bitte warte einen Moment." },
      { status: 429 }
    )
  }

  const body = await request.json()
  const parsed = chatMessageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Nachricht", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { message, conversation_id, image_url } = parsed.data

  try {
    const { stream, conversationId, intent, matchedProducts, sources } = await runPipeline({
      message,
      conversationId: conversation_id,
      userId: user.id,
      imageUrl: image_url,
    })

    // Save user message
    const admin = createAdminClient()
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      image_url: image_url ?? null,
    })

    // Create SSE response
    const encoder = new TextEncoder()
    const sseStream = new ReadableStream({
      async start(controller) {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "conversation_id", data: conversationId })}\n\n`
          )
        )

        const reader = stream.getReader()
        let fullContent = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = new TextDecoder().decode(value)
            fullContent += text

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "content_delta", data: text })}\n\n`
              )
            )
          }

          // Send matched products — suppress if response is consultation-mode (asking questions)
          const questionCount = (fullContent.match(/\?/g) || []).length
          const productsToSend = matchedProducts.length > 0 && questionCount < 2
            ? matchedProducts.slice(0, 3)
            : []
          if (productsToSend.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "product_recommendations", data: productsToSend })}\n\n`
              )
            )
          }

          // Send citation sources
          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "sources", data: sources })}\n\n`
              )
            )
          }

          // Save assistant message (with products for persistence)
          const admin = createAdminClient()
          await admin.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullContent,
            rag_context: sources.length > 0 ? { sources } : null,
            product_recommendations: productsToSend.length > 0 ? productsToSend : null,
          })

          // Update conversation updated_at
          await admin
            .from("conversations")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId)

          // Extract conversation memory (fire-and-forget)
          extractConversationMemory(conversationId, user.id).catch(() => {})

          // Increment user message count
          await admin
            .from("profiles")
            .update({
              message_count_this_month:
                (await admin
                  .from("profiles")
                  .select("message_count_this_month")
                  .eq("id", user.id)
                  .single()
                  .then((r) => r.data?.message_count_this_month || 0)) + 1,
            })
            .eq("id", user.id)

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", data: { intent } })}\n\n`
            )
          )
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", data: { message: "Stream-Fehler aufgetreten" } })}\n\n`
            )
          )
        }

        controller.close()
      },
    })

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat pipeline error:", error)
    return NextResponse.json(
      { error: fehler("Verarbeitung") },
      { status: 500 }
    )
  }
}

// List conversations
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: fehler("Laden") }, { status: 500 })
  }

  return NextResponse.json({ conversations })
}
