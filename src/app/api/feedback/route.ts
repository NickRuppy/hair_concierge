import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"

const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  pageUrl: z.string().max(2048).optional(),
  userAgent: z.string().max(512).optional(),
})

// Strip query string + hash so we never persist auth tokens, Stripe/PayPal
// session ids, magic-link codes, etc. Session Replay has the full context.
function redactUrl(url: string | undefined): string | null {
  if (!url) return null
  return url.split("?")[0].split("#")[0].slice(0, 2048)
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: ERR_INVALID_DATA }, { status: 400 })
  }

  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: ERR_INVALID_DATA }, { status: 400 })
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    message: parsed.data.message,
    page_url: redactUrl(parsed.data.pageUrl),
    user_agent: parsed.data.userAgent ?? null,
  })

  if (error) {
    return NextResponse.json({ error: fehler("Speichern", "des Feedbacks") }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
