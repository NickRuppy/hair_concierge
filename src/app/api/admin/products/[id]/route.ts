import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validators"
import { generateEmbedding } from "@/lib/openai/embeddings"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
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
  const parsed = productSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Fetch existing product to check if embedding-relevant fields changed
  const { data: existing } = await supabase
    .from("products")
    .select("name, brand, description, tags, category")
    .eq("id", id)
    .single()

  const { data: product, error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: fehler("Aktualisieren", "des Produkts") },
      { status: 500 }
    )
  }

  // Regenerate embedding if relevant fields changed
  const embeddingFieldsChanged =
    !existing ||
    existing.name !== parsed.data.name ||
    existing.brand !== parsed.data.brand ||
    existing.description !== parsed.data.description ||
    existing.category !== parsed.data.category ||
    JSON.stringify(existing.tags) !== JSON.stringify(parsed.data.tags)

  if (embeddingFieldsChanged) {
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
      // Embedding generation failed but product was updated successfully
      console.error(fehler("Generieren", "des Embeddings"))
    }
  }

  return NextResponse.json({ product })
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

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) {
    return NextResponse.json(
      { error: fehler("Löschen", "des Produkts") },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
