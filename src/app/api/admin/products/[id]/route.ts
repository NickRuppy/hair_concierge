import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validators"
import { generateEmbedding } from "@/lib/openai/embeddings"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"
import { isConditionerCategory } from "@/lib/conditioner/constants"
import { isLeaveInCategory } from "@/lib/leave-in/constants"
import { isMaskCategory } from "@/lib/mask/constants"
import { SHAMPOO_SOURCE_MANAGED_MESSAGE, isShampooCategory } from "@/lib/shampoo/constants"

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

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("name, brand, description, tags, category")
    .eq("id", id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: fehler("Laden", "des Produkts") },
      { status: 404 }
    )
  }

  if (isShampooCategory(existing.category) || isShampooCategory(parsed.data.category)) {
    return NextResponse.json(
      { error: SHAMPOO_SOURCE_MANAGED_MESSAGE },
      { status: 409 }
    )
  }

  const { conditioner_specs, leave_in_specs, mask_specs, ...productPayload } = parsed.data

  const { data: product, error } = await supabase
    .from("products")
    .update({ ...productPayload, updated_at: new Date().toISOString() })
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
    existing.name !== productPayload.name ||
    existing.brand !== productPayload.brand ||
    existing.description !== productPayload.description ||
    existing.category !== productPayload.category ||
    JSON.stringify(existing.tags) !== JSON.stringify(productPayload.tags)

  if (isConditionerCategory(product.category)) {
    if (conditioner_specs) {
      const { error: conditionerSpecsError } = await supabase
        .from("product_conditioner_rerank_specs")
        .upsert({
          product_id: product.id,
          ...conditioner_specs,
          updated_at: new Date().toISOString(),
        })

      if (conditionerSpecsError) {
        return NextResponse.json(
          { error: fehler("Speichern", "der Conditioner-Spezifikation") },
          { status: 500 }
        )
      }
    }

    await supabase
      .from("product_leave_in_specs")
      .delete()
      .eq("product_id", product.id)
    await supabase
      .from("product_mask_specs")
      .delete()
      .eq("product_id", product.id)
  } else if (isLeaveInCategory(product.category)) {
    if (leave_in_specs) {
      const { error: specsError } = await supabase
        .from("product_leave_in_specs")
        .upsert({
          product_id: product.id,
          ...leave_in_specs,
          updated_at: new Date().toISOString(),
        })

      if (specsError) {
        return NextResponse.json(
          { error: fehler("Speichern", "der Leave-in-Spezifikation") },
          { status: 500 }
        )
      }
    }
    await supabase
      .from("product_conditioner_rerank_specs")
      .delete()
      .eq("product_id", product.id)
    await supabase
      .from("product_mask_specs")
      .delete()
      .eq("product_id", product.id)
  } else if (isMaskCategory(product.category)) {
    if (mask_specs) {
      const { error: maskSpecsError } = await supabase
        .from("product_mask_specs")
        .upsert({
          product_id: product.id,
          ...mask_specs,
          updated_at: new Date().toISOString(),
        })

      if (maskSpecsError) {
        return NextResponse.json(
          { error: fehler("Speichern", "der Masken-Spezifikation") },
          { status: 500 }
        )
      }
    }
    await supabase
      .from("product_conditioner_rerank_specs")
      .delete()
      .eq("product_id", product.id)
    await supabase
      .from("product_leave_in_specs")
      .delete()
      .eq("product_id", product.id)
  } else {
    await supabase
      .from("product_conditioner_rerank_specs")
      .delete()
      .eq("product_id", product.id)
    await supabase
      .from("product_leave_in_specs")
      .delete()
      .eq("product_id", product.id)
    await supabase
      .from("product_mask_specs")
      .delete()
      .eq("product_id", product.id)
  }

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

  // Hydrate category specs for the response
  let hydratedConditionerSpecs = null
  let hydratedLeaveInSpecs = null
  let hydratedMaskSpecs = null
  if (isConditionerCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_conditioner_rerank_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedConditionerSpecs = specs ?? null
  }
  if (isLeaveInCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_leave_in_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedLeaveInSpecs = specs ?? null
  }
  if (isMaskCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_mask_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedMaskSpecs = specs ?? null
  }

  return NextResponse.json({
    product: {
      ...product,
      conditioner_specs: hydratedConditionerSpecs,
      leave_in_specs: hydratedLeaveInSpecs,
      mask_specs: hydratedMaskSpecs,
    },
  })
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

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("category")
    .eq("id", id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: fehler("Laden", "des Produkts") },
      { status: 404 }
    )
  }

  if (isShampooCategory(existing.category)) {
    return NextResponse.json(
      { error: SHAMPOO_SOURCE_MANAGED_MESSAGE },
      { status: 409 }
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
