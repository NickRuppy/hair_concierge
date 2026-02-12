import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validators"
import { generateEmbedding } from "@/lib/openai/embeddings"
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
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Keine Admin-Berechtigung" },
      { status: 403 }
    )
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Laden der Produkte" },
      { status: 500 }
    )
  }

  return NextResponse.json({ products: products || [] })
}

export async function POST(request: Request) {
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
  const parsed = productSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Daten", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Produkts" },
      { status: 500 }
    )
  }

  // Generate embedding from product fields
  try {
    const embeddingText = [
      product.name,
      product.brand,
      product.description,
      product.tags?.join(", "),
      product.category,
    ]
      .filter(Boolean)
      .join(" ")

    const embedding = await generateEmbedding(embeddingText)

    const adminClient = createAdminClient()
    await adminClient
      .from("products")
      .update({ embedding })
      .eq("id", product.id)
  } catch {
    // Embedding generation failed but product was created successfully
    console.error("Fehler beim Generieren des Embeddings")
  }

  return NextResponse.json({ product }, { status: 201 })
}
