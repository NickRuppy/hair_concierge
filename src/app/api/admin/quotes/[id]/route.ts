import { createClient } from "@/lib/supabase/server"
import { quoteSchema } from "@/lib/validators"
import { NextResponse } from "next/server"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Keine Admin-Berechtigung" },
      { status: 403 }
    )
  }

  const body = await request.json()
  const parsed = quoteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Daten", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data: quote, error } = await supabase
    .from("quotes")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Zitats" },
      { status: 500 }
    )
  }

  return NextResponse.json({ quote })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Keine Admin-Berechtigung" },
      { status: 403 }
    )
  }

  const { error } = await supabase.from("quotes").delete().eq("id", id)

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Löschen des Zitats" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
