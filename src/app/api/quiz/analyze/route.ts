import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeSchema } from "@/lib/quiz/validators"
import OpenAI from "openai"
import { ahaFallback, shareQuoteFallback } from "@/lib/quiz/results-lookup"

const openai = new OpenAI()

const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { leadId, name, quizAnswers } = analyzeSchema.parse(body)

    const supabase = createAdminClient()

    // Verify lead exists before calling GPT-4o
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .single()

    if (!existingLead) {
      return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 })
    }

    const pulltest = (quizAnswers.pulltest as string) ?? ""
    const safeName = name.replace(/[^\p{L}\p{N}\s'-]/gu, "").slice(0, 50)

    // Try GPT-4o for personalized insight + shareable quote
    let insight: string
    let shareQuote: string
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Du bist TomBot, ein erfahrener Haar-Experte. Antworte als JSON mit zwei Feldern:\n\n1. "insight": Ein kurzer, persoenlicher Aha-Moment (2-3 Saetze). Erklaere, was bei der bisherigen Haarpflege wahrscheinlich schief lief. Sei direkt und empathisch. Verwende den Vornamen.\n\n2. "share_quote": Ein punchiger Satz (max 15 Woerter) von Tom ueber dieses Haar — motivierend, persoenlich, geeignet fuer eine Instagram-Story-Karte. Kein Hashtag, keine Emojis.\n\nBeispiel: {"insight": "Lisa, deine Haare ...", "share_quote": "Deine Locken brauchen Protein, nicht noch mehr Feuchtigkeit."}',
          },
          {
            role: "user",
            content: `Name: ${safeName}\nQuiz-Antworten: ${JSON.stringify(quizAnswers)}`,
          },
        ],
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? ""
      const parsed = JSON.parse(raw) as { insight?: string; share_quote?: string }
      insight = parsed.insight ?? ahaFallback[pulltest] ?? ahaFallback.stretches_bounces!
      shareQuote = parsed.share_quote ?? shareQuoteFallback[pulltest] ?? shareQuoteFallback.stretches_bounces!
    } catch {
      // Fallback to static text
      insight = ahaFallback[pulltest] ?? ahaFallback.stretches_bounces!
      shareQuote = shareQuoteFallback[pulltest] ?? shareQuoteFallback.stretches_bounces!
    }

    // Cache insight + share quote in leads table
    await supabase
      .from("leads")
      .update({ ai_insight: insight, share_quote: shareQuote })
      .eq("id", leadId)

    return NextResponse.json({ insight, shareQuote })
  } catch (err) {
    console.error("Analyze API error:", err)
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 400 })
  }
}
