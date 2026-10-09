import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBondbuilderResearchProfile } from "@/lib/bondbuilder-research/production-adapter"
import { productSchema, recommendedProductLosesMarketSegment } from "@/lib/validators"
import { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "@/lib/vocabulary"
import { NextResponse } from "next/server"
import { isBondbuilderCategory } from "@/lib/bondbuilder/constants"
import { isConditionerCategory } from "@/lib/conditioner/constants"
import { isDeepCleansingShampooCategory } from "@/lib/deep-cleansing-shampoo/constants"
import { isDryShampooCategory } from "@/lib/dry-shampoo/constants"
import { isLeaveInCategory } from "@/lib/leave-in/constants"
import { isMaskCategory } from "@/lib/mask/constants"
import { isPeelingCategory } from "@/lib/peeling/constants"
import { SHAMPOO_SOURCE_MANAGED_MESSAGE, isShampooCategory } from "@/lib/shampoo/constants"
import {
  PRODUCT_RECATEGORIZATION_REQUIRES_GUARDED_REPAIR,
  requiresGuardedProductRecategorization,
} from "@/lib/admin/product-category-write-policy"

const STRUCTURED_SPEC_TABLES = [
  "product_conditioner_rerank_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_specs",
  "product_mask_specs",
  "product_bondbuilder_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_dry_shampoo_specs",
  "product_peeling_specs",
] as const

async function deleteStructuredProductSpecs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  tables: readonly string[] = STRUCTURED_SPEC_TABLES,
) {
  for (const table of tables) {
    await supabase.from(table).delete().eq("product_id", productId)
  }
}

function getObsoleteStructuredSpecTables(category: string | null) {
  return STRUCTURED_SPEC_TABLES.filter((table) => {
    if (table === "product_leave_in_specs") {
      return true
    }

    if (table === "product_conditioner_rerank_specs") {
      return !isConditionerCategory(category)
    }

    if (table === "product_leave_in_fit_specs") {
      return !isLeaveInCategory(category)
    }

    if (table === "product_mask_specs") {
      return !isMaskCategory(category)
    }

    if (table === "product_bondbuilder_specs") {
      return !isBondbuilderCategory(category)
    }

    if (table === "product_deep_cleansing_shampoo_specs") {
      return !isDeepCleansingShampooCategory(category)
    }

    if (table === "product_dry_shampoo_specs") {
      return !isDryShampooCategory(category)
    }

    return !isPeelingCategory(category)
  })
}

async function enrichBondbuilderResearchProfile(input: {
  supabase: ReturnType<typeof createAdminClient>
  productId: string
  profile: unknown
  reviewedBy: string
  productPayload: Record<string, unknown>
  /** `undefined` means the form did not send the key. */
  marketSegment?: "drugstore" | "professional" | null
}): Promise<{ product: Record<string, unknown> } | null> {
  const validation = validateBondbuilderResearchProfile(input.profile)
  if (!validation.success) return null
  const { data: preimage, error: preimageError } = await input.supabase.rpc(
    "bondbuilder_research_preimage_v1",
    { p_product_id: input.productId },
  )
  if (preimageError || !preimage || typeof preimage !== "object") return null
  const existingProduct = (preimage as { product?: Record<string, unknown> }).product
  if (!existingProduct) return null
  // The receipt preimage deliberately omits `market_segment` (historical receipts stay equal),
  // so it is compared against the live column instead.
  if (input.marketSegment !== undefined) {
    const { data: segmentRow, error: segmentError } = await input.supabase
      .from("products")
      .select("market_segment")
      .eq("id", input.productId)
      .single()
    if (segmentError || !segmentRow) return null
    if ((segmentRow.market_segment ?? null) !== input.marketSegment) return null
  }
  // A research-only operation must not smuggle spine/lifecycle/fit changes.
  // The complete CAS preimage is checked again inside the transactional RPC.
  for (const [key, value] of Object.entries(input.productPayload)) {
    const existingValue =
      key === "price_eur" && existingProduct[key] !== null
        ? Number(existingProduct[key])
        : existingProduct[key]
    if (JSON.stringify(value) !== JSON.stringify(existingValue)) return null
  }

  const { error } = await input.supabase.rpc("bondbuilder_research_enrich_v1", {
    p_product_id: input.productId,
    p_profile: validation.profile,
    p_expected_preimage: preimage,
    p_request_id: crypto.randomUUID(),
    p_reviewed_by: input.reviewedBy,
  })
  if (error) return null
  const { data: specs, error: specsError } = await input.supabase
    .from("product_bondbuilder_specs")
    .select("*")
    .eq("product_id", input.productId)
    .single()
  if (specsError || !specs) return null
  return { product: { ...existingProduct, bondbuilder_specs: specs } }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("category, category_key, is_chaarlie_recommended, market_segment")
    .eq("id", id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: fehler("Laden", "des Produkts") }, { status: 404 })
  }

  if (isShampooCategory(existing.category) || isShampooCategory(parsed.data.category)) {
    return NextResponse.json({ error: SHAMPOO_SOURCE_MANAGED_MESSAGE }, { status: 409 })
  }

  if (requiresGuardedProductRecategorization(existing.category_key, parsed.data.category)) {
    return NextResponse.json(
      { error: PRODUCT_RECATEGORIZATION_REQUIRES_GUARDED_REPAIR },
      { status: 409 },
    )
  }

  const {
    conditioner_specs,
    leave_in_specs,
    mask_specs,
    bondbuilder_specs,
    deep_cleansing_shampoo_specs,
    dry_shampoo_specs,
    peeling_specs,
    market_segment: requestedMarketSegment,
    ...productPayloadWithoutSegment
  } = parsed.data
  if (
    recommendedProductLosesMarketSegment({
      recommended: existing.is_chaarlie_recommended,
      current: existing.market_segment,
      requested: requestedMarketSegment,
    })
  ) {
    return NextResponse.json(
      { error: "Empfohlene Produkte brauchen ein Marktsegment (Drogerie oder Profi)." },
      { status: 400 },
    )
  }
  const productPayload =
    requestedMarketSegment === undefined
      ? productPayloadWithoutSegment
      : { ...productPayloadWithoutSegment, market_segment: requestedMarketSegment }

  const nextCategory = parsed.data.category
  const updatedAt = new Date().toISOString()

  if (isBondbuilderCategory(nextCategory) && bondbuilder_specs?.research_profile != null) {
    const enriched = await enrichBondbuilderResearchProfile({
      supabase: createAdminClient(),
      productId: id,
      profile: bondbuilder_specs.research_profile,
      reviewedBy: user.id,
      productPayload: productPayloadWithoutSegment,
      marketSegment: requestedMarketSegment,
    })
    return enriched
      ? NextResponse.json(enriched)
      : NextResponse.json(
          {
            error:
              "Die Forschungsanreicherung benötigt unveränderte Produktdaten und einen gültigen geprüften Forschungsstand. Andere Änderungen bitte getrennt speichern.",
          },
          { status: 409 },
        )
  }

  if (isConditionerCategory(nextCategory) && conditioner_specs) {
    const { error: conditionerSpecsError } = await supabase
      .from("product_conditioner_rerank_specs")
      .upsert({
        product_id: id,
        ...conditioner_specs,
        updated_at: updatedAt,
      })

    if (conditionerSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Conditioner-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isLeaveInCategory(nextCategory) && leave_in_specs) {
    const { error: specsError } = await supabase.from("product_leave_in_fit_specs").upsert({
      product_id: id,
      ...leave_in_specs,
      updated_at: updatedAt,
    })

    if (specsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Leave-in-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isMaskCategory(nextCategory) && mask_specs) {
    const { error: maskSpecsError } = await supabase.from("product_mask_specs").upsert({
      product_id: id,
      ...mask_specs,
      updated_at: updatedAt,
    })

    if (maskSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Masken-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isBondbuilderCategory(nextCategory) && bondbuilder_specs) {
    const { error: bondbuilderSpecsError } = await supabase
      .from("product_bondbuilder_specs")
      .upsert({ product_id: id, ...bondbuilder_specs, updated_at: updatedAt })

    if (bondbuilderSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Bondbuilder-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isDeepCleansingShampooCategory(nextCategory) && deep_cleansing_shampoo_specs) {
    const { error: deepCleansingShampooSpecsError } = await supabase
      .from("product_deep_cleansing_shampoo_specs")
      .upsert({
        product_id: id,
        ...deep_cleansing_shampoo_specs,
        updated_at: updatedAt,
      })

    if (deepCleansingShampooSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Tiefenreinigungs-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isDryShampooCategory(nextCategory) && dry_shampoo_specs) {
    const { error: dryShampooSpecsError } = await supabase
      .from("product_dry_shampoo_specs")
      .upsert({
        product_id: id,
        ...dry_shampoo_specs,
        updated_at: updatedAt,
      })

    if (dryShampooSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Trockenshampoo-Spezifikation") },
        { status: 500 },
      )
    }
  }

  if (isPeelingCategory(nextCategory) && peeling_specs) {
    const { error: peelingSpecsError } = await supabase.from("product_peeling_specs").upsert({
      product_id: id,
      ...peeling_specs,
      updated_at: updatedAt,
    })

    if (peelingSpecsError) {
      return NextResponse.json(
        { error: fehler("Speichern", "der Peeling-Spezifikation") },
        { status: 500 },
      )
    }
  }

  const { data: product, error } = await supabase
    .from("products")
    .update({ ...productPayload, updated_at: updatedAt })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: fehler("Aktualisieren", "des Produkts") }, { status: 500 })
  }

  try {
    await deleteStructuredProductSpecs(
      supabase,
      product.id,
      getObsoleteStructuredSpecTables(nextCategory),
    )
  } catch (cleanupError) {
    console.error("Failed to delete obsolete product specs:", cleanupError)
  }

  // Hydrate category specs for the response
  let hydratedConditionerSpecs = null
  let hydratedLeaveInSpecs = null
  let hydratedMaskSpecs = null
  let hydratedBondbuilderSpecs = null
  let hydratedDeepCleansingShampooSpecs = null
  let hydratedDryShampooSpecs = null
  let hydratedPeelingSpecs = null
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
      .from("product_leave_in_fit_specs")
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
  if (isBondbuilderCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_bondbuilder_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedBondbuilderSpecs = specs ?? null
  }
  if (isDeepCleansingShampooCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_deep_cleansing_shampoo_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedDeepCleansingShampooSpecs = specs ?? null
  }
  if (isDryShampooCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_dry_shampoo_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedDryShampooSpecs = specs ?? null
  }
  if (isPeelingCategory(product.category)) {
    const { data: specs } = await supabase
      .from("product_peeling_specs")
      .select("*")
      .eq("product_id", product.id)
      .single()
    hydratedPeelingSpecs = specs ?? null
  }

  return NextResponse.json({
    product: {
      ...product,
      conditioner_specs: hydratedConditionerSpecs,
      leave_in_specs: hydratedLeaveInSpecs,
      mask_specs: hydratedMaskSpecs,
      bondbuilder_specs: hydratedBondbuilderSpecs,
      deep_cleansing_shampoo_specs: hydratedDeepCleansingShampooSpecs,
      dry_shampoo_specs: hydratedDryShampooSpecs,
      peeling_specs: hydratedPeelingSpecs,
    },
  })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: ERR_FORBIDDEN }, { status: 403 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("category")
    .eq("id", id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: fehler("Laden", "des Produkts") }, { status: 404 })
  }

  if (isShampooCategory(existing.category)) {
    return NextResponse.json({ error: SHAMPOO_SOURCE_MANAGED_MESSAGE }, { status: 409 })
  }

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: fehler("Löschen", "des Produkts") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
