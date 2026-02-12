import { createClient } from "@/lib/supabase/server"
import { hairProfileFullSchema } from "@/lib/validators"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: hairProfile } = await supabase
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  return NextResponse.json({ profile, hairProfile })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = hairProfileFullSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Daten", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("hair_profiles")
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Speichern" },
      { status: 500 }
    )
  }

  return NextResponse.json({ hairProfile: data })
}
