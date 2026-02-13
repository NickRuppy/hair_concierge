import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { leadSchema } from "@/lib/quiz/validators"

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
    const parsed = leadSchema.parse(body)

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: parsed.name,
        email: parsed.email,
        marketing_consent: parsed.marketingConsent,
        quiz_answers: parsed.quizAnswers,
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
