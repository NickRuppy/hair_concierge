import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeSchema } from "@/lib/quiz/validators"
import OpenAI from "openai"
import { ahaFallback } from "@/lib/quiz/results-lookup"

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

    // Try GPT-4o for personalized insight
    let insight: string
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "Du bist TomBot, ein erfahrener Haar-Experte. Schreibe einen kurzen, persoenlichen Aha-Moment (2-3 Saetze) auf Deutsch. Erklaere, was bei der bisherigen Haarpflege wahrscheinlich schief lief, basierend auf den Quiz-Antworten. Sei direkt und empathisch. Verwende den Vornamen.",
          },
          {
            role: "user",
            content: `Name: ${safeName}\nQuiz-Antworten: ${JSON.stringify(quizAnswers)}`,
          },
        ],
      })

      insight = completion.choices[0]?.message?.content?.trim() ?? ahaFallback[pulltest] ?? ahaFallback.stretches_bounces!
    } catch {
      // Fallback to static text
      insight = ahaFallback[pulltest] ?? ahaFallback.stretches_bounces!
    }

    // Cache insight in leads table
    await supabase
      .from("leads")
      .update({ ai_insight: insight })
      .eq("id", leadId)

    return NextResponse.json({ insight })
  } catch (err) {
    console.error("Analyze API error:", err)
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 400 })
  }
}
