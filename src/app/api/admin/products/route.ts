import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validators"
import { generateEmbedding } from "@/lib/openai/embeddings"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"
import { isConditionerCategory, type ProductConditionerSpecs } from "@/lib/conditioner/constants"
import { isLeaveInCategory, type ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import { isMaskCategory, type ProductMaskSpecs } from "@/lib/mask/constants"

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

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: fehler("Laden", "der Produkte") },
      { status: 500 }
    )
  }

  const rows = products || []
  const conditionerIds = rows
    .filter((product) => isConditionerCategory(product.category))
    .map((product) => product.id)
  const leaveInIds = rows
    .filter((product) => isLeaveInCategory(product.category))
    .map((product) => product.id)
  const maskIds = rows
    .filter((product) => isMaskCategory(product.category))
    .map((product) => product.id)

  let conditionerSpecsByProductId = new Map<string, ProductConditionerSpecs>()
  if (conditionerIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_conditioner_rerank_specs")
      .select("*")
      .in("product_id", conditionerIds)

    conditionerSpecsByProductId = new Map(
      ((specs || []) as ProductConditionerSpecs[]).map((spec) => [spec.product_id, spec])
    )
  }

  let specsByProductId = new Map<string, ProductLeaveInSpecs>()
  if (leaveInIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_leave_in_specs")
      .select("*")
      .in("product_id", leaveInIds)

    specsByProductId = new Map(
      ((specs || []) as ProductLeaveInSpecs[]).map((spec) => [spec.product_id, spec])
    )
  }

  let maskSpecsByProductId = new Map<string, ProductMaskSpecs>()
  if (maskIds.length > 0) {
    const { data: maskSpecs } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in("product_id", maskIds)

    maskSpecsByProductId = new Map(
      ((maskSpecs || []) as ProductMaskSpecs[]).map((spec) => [spec.product_id, spec])
    )
  }

  const hydrated = rows.map((product) => ({
    ...product,
    conditioner_specs: conditionerSpecsByProductId.get(product.id) ?? null,
    leave_in_specs: specsByProductId.get(product.id) ?? null,
    mask_specs: maskSpecsByProductId.get(product.id) ?? null,
  }))

  return NextResponse.json({ products: hydrated })
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
  const parsed = productSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { conditioner_specs, leave_in_specs, mask_specs, ...productPayload } = parsed.data

  const { data: product, error } = await supabase
    .from("products")
    .insert(productPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: fehler("Erstellen", "des Produkts") },
      { status: 500 }
    )
  }

  if (isConditionerCategory(product.category) && conditioner_specs) {
    const { error: conditionerSpecsError } = await supabase
      .from("product_conditioner_rerank_specs")
      .upsert({
        product_id: product.id,
        ...conditioner_specs,
      })

    if (conditionerSpecsError) {
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Conditioner-Spezifikation") },
        { status: 500 }
      )
    }
  }

  if (isLeaveInCategory(product.category) && leave_in_specs) {
    const { error: specsError } = await supabase
      .from("product_leave_in_specs")
      .upsert({
        product_id: product.id,
        ...leave_in_specs,
      })

    if (specsError) {
      // Roll back the orphaned product row
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Leave-in-Spezifikation") },
        { status: 500 }
      )
    }
  }

  if (isMaskCategory(product.category) && mask_specs) {
    const { error: maskSpecsError } = await supabase
      .from("product_mask_specs")
      .upsert({
        product_id: product.id,
        ...mask_specs,
      })

    if (maskSpecsError) {
      // Roll back the orphaned product row
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Masken-Spezifikation") },
        { status: 500 }
      )
    }
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
    console.error(fehler("Generieren", "des Embeddings"))
  }

  return NextResponse.json({ product }, { status: 201 })
}
