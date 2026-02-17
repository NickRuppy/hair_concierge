import { createClient } from "@/lib/supabase/server"
import { quoteSchema } from "@/lib/validators"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

export async function GET() {
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

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: fehler("Laden", "der Zitate") },
      { status: 500 }
    )
  }

  return NextResponse.json({ quotes: quotes || [] })
}

export async function POST(request: Request) {
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

  const body = await request.json()
  const parsed = quoteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: fehler("Erstellen", "des Zitats") },
      { status: 500 }
    )
  }

  return NextResponse.json({ quote }, { status: 201 })
}
