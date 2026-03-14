import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { leadSchema } from "@/lib/quiz/validators"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { findReusableLead } from "@/lib/quiz/lead-lifecycle"

const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const DEDUPE_WINDOW_MS = 15 * 60 * 1000
const MAX_RECENT_DUPLICATE_CANDIDATES = 10

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

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
    const parsed = leadSchema.parse(body)
    const email = normalizeEmail(parsed.email)
    const quizAnswers = canonicalizeQuizAnswers(parsed.quizAnswers)

    const supabase = createAdminClient()
    const recentThreshold = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()

    const { data: recentLeads, error: recentLeadsError } = await supabase
      .from("leads")
      .select("id, quiz_answers, marketing_consent, status")
      .eq("email", email)
      .gte("created_at", recentThreshold)
      .order("created_at", { ascending: false })
      .limit(MAX_RECENT_DUPLICATE_CANDIDATES)

    if (recentLeadsError) {
      console.error("Lead dedupe lookup error:", recentLeadsError)
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
    }

    const existingLead = findReusableLead(
      (recentLeads as Array<{ id: string; quiz_answers: Record<string, unknown> | null }> | null) ?? null,
      quizAnswers
    )

    if (existingLead) {
      if (existingLead.marketing_consent !== parsed.marketingConsent) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ marketing_consent: parsed.marketingConsent })
          .eq("id", existingLead.id)

        if (updateError) {
          console.error("Lead dedupe update error:", updateError)
          return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
        }
      }

      return NextResponse.json({ leadId: existingLead.id })
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: parsed.name,
        email,
        marketing_consent: parsed.marketingConsent,
        quiz_answers: quizAnswers,
        status: "captured",
      })
      .select("id")
      .single()

    if (error) {
      console.error("Lead insert error:", error)
      return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
    }

    return NextResponse.json({ leadId: data.id })
  } catch (err) {
    console.error("Lead API error:", err)
    return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
  }
}
