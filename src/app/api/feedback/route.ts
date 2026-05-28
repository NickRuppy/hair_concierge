import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED, fehler } from "@/lib/vocabulary"

const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  pageUrl: z.string().max(2048).optional(),
  userAgent: z.string().max(512).optional(),
})

export async function POST(request: Request) {
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
    page_url: parsed.data.pageUrl ?? null,
    user_agent: parsed.data.userAgent ?? null,
  })

  if (error) {
    return NextResponse.json({ error: fehler("Speichern", "des Feedbacks") }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
