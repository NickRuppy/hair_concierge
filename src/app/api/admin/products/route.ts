import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { productSchema } from "@/lib/validators"
import { generateEmbedding } from "@/lib/openai/embeddings"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"
import { isBondbuilderCategory, type ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import { isConditionerCategory, type ProductConditionerSpecs } from "@/lib/conditioner/constants"
import {
  isDeepCleansingShampooCategory,
  type ProductDeepCleansingShampooSpecs,
} from "@/lib/deep-cleansing-shampoo/constants"
import { isDryShampooCategory, type ProductDryShampooSpecs } from "@/lib/dry-shampoo/constants"
import { isLeaveInCategory, type ProductLeaveInFitSpecs } from "@/lib/leave-in/constants"
import { isMaskCategory, type ProductMaskSpecs } from "@/lib/mask/constants"
import {
  SHAMPOO_BUCKETS,
  SHAMPOO_SOURCE_MANAGED_MESSAGE,
  isShampooCategory,
  type ShampooBucketPair,
} from "@/lib/shampoo/constants"
import { isPeelingCategory, type ProductPeelingSpecs } from "@/lib/peeling/constants"
import { HAIR_THICKNESSES } from "@/lib/vocabulary"

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
    return NextResponse.json({ error: ERR_FORBIDDEN }, { status: 403 })
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: fehler("Laden", "der Produkte") }, { status: 500 })
  }

  const rows = products || []
  const shampooIds = rows
    .filter((product) => isShampooCategory(product.category))
    .map((product) => product.id)
  const conditionerIds = rows
    .filter((product) => isConditionerCategory(product.category))
    .map((product) => product.id)
  const leaveInIds = rows
    .filter((product) => isLeaveInCategory(product.category))
    .map((product) => product.id)
  const maskIds = rows
    .filter((product) => isMaskCategory(product.category))
    .map((product) => product.id)
  const bondbuilderIds = rows
    .filter((product) => isBondbuilderCategory(product.category))
    .map((product) => product.id)
  const deepCleansingShampooIds = rows
    .filter((product) => isDeepCleansingShampooCategory(product.category))
    .map((product) => product.id)
  const dryShampooIds = rows
    .filter((product) => isDryShampooCategory(product.category))
    .map((product) => product.id)
  const peelingIds = rows
    .filter((product) => isPeelingCategory(product.category))
    .map((product) => product.id)

  let conditionerSpecsByProductId = new Map<string, ProductConditionerSpecs>()
  let shampooPairsByProductId = new Map<string, ShampooBucketPair[]>()
  if (shampooIds.length > 0) {
    const adminClient = createAdminClient()
    const { data: shampooPairs, error: shampooPairsError } = await adminClient
      .from("product_shampoo_specs")
      .select("product_id, thickness, shampoo_bucket")
      .in("product_id", shampooIds)

    if (shampooPairsError) {
      return NextResponse.json(
        { error: fehler("Laden", "der Shampoo-Eligibility") },
        { status: 500 },
      )
    }

    shampooPairsByProductId = (shampooPairs || []).reduce((map, row) => {
      const currentPairs = map.get(row.product_id) ?? []
      currentPairs.push({
        thickness: row.thickness as ShampooBucketPair["thickness"],
        shampoo_bucket: row.shampoo_bucket as ShampooBucketPair["shampoo_bucket"],
      })
      currentPairs.sort((left, right) => {
        const thicknessDiff =
          HAIR_THICKNESSES.indexOf(left.thickness) - HAIR_THICKNESSES.indexOf(right.thickness)
        if (thicknessDiff !== 0) return thicknessDiff

        return (
          SHAMPOO_BUCKETS.indexOf(left.shampoo_bucket) -
          SHAMPOO_BUCKETS.indexOf(right.shampoo_bucket)
        )
      })
      map.set(row.product_id, currentPairs)
      return map
    }, new Map<string, ShampooBucketPair[]>())
  }

  if (conditionerIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_conditioner_rerank_specs")
      .select("*")
      .in("product_id", conditionerIds)

    conditionerSpecsByProductId = new Map(
      ((specs || []) as ProductConditionerSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let specsByProductId = new Map<string, ProductLeaveInFitSpecs>()
  if (leaveInIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_leave_in_fit_specs")
      .select("*")
      .in("product_id", leaveInIds)

    specsByProductId = new Map(
      ((specs || []) as ProductLeaveInFitSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let maskSpecsByProductId = new Map<string, ProductMaskSpecs>()
  if (maskIds.length > 0) {
    const { data: maskSpecs } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in("product_id", maskIds)

    maskSpecsByProductId = new Map(
      ((maskSpecs || []) as ProductMaskSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let bondbuilderSpecsByProductId = new Map<string, ProductBondbuilderSpecs>()
  if (bondbuilderIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_bondbuilder_specs")
      .select("*")
      .in("product_id", bondbuilderIds)

    bondbuilderSpecsByProductId = new Map(
      ((specs || []) as ProductBondbuilderSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let deepCleansingShampooSpecsByProductId = new Map<string, ProductDeepCleansingShampooSpecs>()
  if (deepCleansingShampooIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_deep_cleansing_shampoo_specs")
      .select("*")
      .in("product_id", deepCleansingShampooIds)

    deepCleansingShampooSpecsByProductId = new Map(
      ((specs || []) as ProductDeepCleansingShampooSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let dryShampooSpecsByProductId = new Map<string, ProductDryShampooSpecs>()
  if (dryShampooIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_dry_shampoo_specs")
      .select("*")
      .in("product_id", dryShampooIds)

    dryShampooSpecsByProductId = new Map(
      ((specs || []) as ProductDryShampooSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  let peelingSpecsByProductId = new Map<string, ProductPeelingSpecs>()
  if (peelingIds.length > 0) {
    const { data: specs } = await supabase
      .from("product_peeling_specs")
      .select("*")
      .in("product_id", peelingIds)

    peelingSpecsByProductId = new Map(
      ((specs || []) as ProductPeelingSpecs[]).map((spec) => [spec.product_id, spec]),
    )
  }

  const hydrated = rows.map((product) => ({
    ...product,
    shampoo_bucket_pairs: shampooPairsByProductId.get(product.id) ?? null,
    conditioner_specs: conditionerSpecsByProductId.get(product.id) ?? null,
    leave_in_specs: specsByProductId.get(product.id) ?? null,
    mask_specs: maskSpecsByProductId.get(product.id) ?? null,
    bondbuilder_specs: bondbuilderSpecsByProductId.get(product.id) ?? null,
    deep_cleansing_shampoo_specs: deepCleansingShampooSpecsByProductId.get(product.id) ?? null,
    dry_shampoo_specs: dryShampooSpecsByProductId.get(product.id) ?? null,
    peeling_specs: peelingSpecsByProductId.get(product.id) ?? null,
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
    return NextResponse.json({ error: ERR_FORBIDDEN }, { status: 403 })
  }

  const body = await request.json()
  const parsed = productSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (isShampooCategory(parsed.data.category)) {
    return NextResponse.json({ error: SHAMPOO_SOURCE_MANAGED_MESSAGE }, { status: 409 })
  }

  const {
    conditioner_specs,
    leave_in_specs,
    mask_specs,
    bondbuilder_specs,
    deep_cleansing_shampoo_specs,
    dry_shampoo_specs,
    peeling_specs,
    ...productPayload
  } = parsed.data

  const { data: product, error } = await supabase
    .from("products")
    .insert(productPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: fehler("Erstellen", "des Produkts") }, { status: 500 })
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
        { status: 500 },
      )
    }
  }

  if (isLeaveInCategory(product.category) && leave_in_specs) {
    const { error: specsError } = await supabase.from("product_leave_in_fit_specs").upsert({
      product_id: product.id,
      ...leave_in_specs,
    })

    if (specsError) {
      // Roll back the orphaned product row
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Leave-in-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isMaskCategory(product.category) && mask_specs) {
    const { error: maskSpecsError } = await supabase.from("product_mask_specs").upsert({
      product_id: product.id,
      ...mask_specs,
    })

    if (maskSpecsError) {
      // Roll back the orphaned product row
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Masken-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isBondbuilderCategory(product.category) && bondbuilder_specs) {
    const { error: bondbuilderSpecsError } = await supabase
      .from("product_bondbuilder_specs")
      .upsert({
        product_id: product.id,
        ...bondbuilder_specs,
      })

    if (bondbuilderSpecsError) {
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Bondbuilder-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isDeepCleansingShampooCategory(product.category) && deep_cleansing_shampoo_specs) {
    const { error: deepCleansingShampooSpecsError } = await supabase
      .from("product_deep_cleansing_shampoo_specs")
      .upsert({
        product_id: product.id,
        ...deep_cleansing_shampoo_specs,
      })

    if (deepCleansingShampooSpecsError) {
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Tiefenreinigungs-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isDryShampooCategory(product.category) && dry_shampoo_specs) {
    const { error: dryShampooSpecsError } = await supabase
      .from("product_dry_shampoo_specs")
      .upsert({
        product_id: product.id,
        ...dry_shampoo_specs,
      })

    if (dryShampooSpecsError) {
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Trockenshampoo-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isPeelingCategory(product.category) && peeling_specs) {
    const { error: peelingSpecsError } = await supabase.from("product_peeling_specs").upsert({
      product_id: product.id,
      ...peeling_specs,
    })

    if (peelingSpecsError) {
      await supabase.from("products").delete().eq("id", product.id)
      return NextResponse.json(
        { error: fehler("Speichern", "der Peeling-Spezifikation") },
        { status: 500 },
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
    await adminClient.from("products").update({ embedding }).eq("id", product.id)
  } catch {
    // Embedding generation failed but product was created successfully
    console.error(fehler("Generieren", "des Embeddings"))
  }

  return NextResponse.json({ product }, { status: 201 })
}
