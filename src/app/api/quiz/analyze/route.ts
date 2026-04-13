import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, QUIZ_ANALYZE_RATE_LIMIT } from "@/lib/rate-limit"
import { analyzeSchema } from "@/lib/quiz/validators"
import OpenAI from "openai"
import { ahaFallback, shareQuoteFallback } from "@/lib/quiz/results-lookup"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { getLeadStatusAfterAnalyze } from "@/lib/quiz/lead-lifecycle"

let openai: OpenAI | null = null

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI()
  }
  return openai
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"
  const rateCheck = await checkRateLimit(ip, QUIZ_ANALYZE_RATE_LIMIT)
  if (!rateCheck.allowed) {
    const status = rateCheck.error === "service_unavailable" ? 503 : 429
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status })
  }

  try {
    const body = await request.json()
    const parsed = analyzeSchema.parse(body)
    const { leadId, name } = parsed
    const quizAnswers = canonicalizeQuizAnswers(parsed.quizAnswers)

    const supabase = createAdminClient()

    // Verify lead exists before calling GPT-4o
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, ai_insight, share_quote, user_id, status")
      .eq("id", leadId)
      .single()

    if (!existingLead) {
      return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 })
    }

    if (existingLead.ai_insight && existingLead.share_quote) {
      if (existingLead.status === "captured") {
        await supabase
          .from("leads")
          .update({ status: getLeadStatusAfterAnalyze(existingLead.user_id) })
          .eq("id", leadId)
      }

      return NextResponse.json({
        insight: existingLead.ai_insight,
        shareQuote: existingLead.share_quote,
      })
    }

    const pulltest = (quizAnswers.pulltest as string) ?? ""
    const safeName = name.replace(/[^\p{L}\p{N}\s'-]/gu, "").slice(0, 50)

    // Try GPT-4o for personalized insight + shareable quote
    let insight: string
    let shareQuote: string
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Du bist ein erfahrener Haarpflege-Berater fuer Hair Concierge. Antworte als JSON mit zwei Feldern:\n\n1. "insight": Ein kurzer, persoenlicher Aha-Moment (2-3 Saetze). Erklaere, was bei der bisherigen Haarpflege wahrscheinlich schief lief. Sei direkt und empathisch. Verwende den Vornamen.\n\n2. "share_quote": Ein punchiger Satz (max 15 Woerter) ueber dieses Haar — motivierend, persoenlich, geeignet fuer eine Instagram-Story-Karte. Kein Hashtag, keine Emojis.\n\nBeispiel: {"insight": "Lisa, deine Haare ...", "share_quote": "Deine Locken brauchen Protein, nicht noch mehr Feuchtigkeit."}',
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
      shareQuote =
        parsed.share_quote ?? shareQuoteFallback[pulltest] ?? shareQuoteFallback.stretches_bounces!
    } catch {
      // Fallback to static text
      insight = ahaFallback[pulltest] ?? ahaFallback.stretches_bounces!
      shareQuote = shareQuoteFallback[pulltest] ?? shareQuoteFallback.stretches_bounces!
    }

    // Cache insight + share quote in leads table
    await supabase
      .from("leads")
      .update({
        quiz_answers: quizAnswers,
        ai_insight: insight,
        share_quote: shareQuote,
        status: getLeadStatusAfterAnalyze(existingLead.user_id),
      })
      .eq("id", leadId)

    return NextResponse.json({ insight, shareQuote })
  } catch (err) {
    console.error("Analyze API error:", err)
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 400 })
  }
}
