import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

import { generateEmbedding } from "@/lib/openai/embeddings"
import type { ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import type { ProductLifecycleStatus } from "@/lib/types"

loadEnv({ path: ".env.local" })

type BondbuilderSeedProduct = {
  key: string
  name: string
  brand: string
  lifecycle_status: ProductLifecycleStatus
  default_card: boolean
  description: string
  affiliate_link: string
  price_eur: number | null
  currency: "EUR"
  tags: string[]
  suitable_concerns: string[]
  specs: Omit<ProductBondbuilderSpecs, "product_id">
  relationship?: {
    type: "replaced_by" | "add_on_for"
    targetKey: string
  }
}

const BONDBUILDER_SEED_PRODUCTS: BondbuilderSeedProduct[] = [
  {
    key: "olaplex_3plus",
    name: "OLAPLEX No.3PLUS Complete Repair Treatment",
    brand: "OLAPLEX",
    lifecycle_status: "active",
    default_card: true,
    description:
      "Aktuelle OLAPLEX-Heimbehandlung fuer intensive strukturelle Repair-Unterstuetzung im Disulfid-/Crosslink-Lane.",
    affiliate_link: "https://olaplex.com/products/n-3plus-complete-repair-treatment",
    price_eur: 34,
    currency: "EUR",
    tags: ["bondbuilder", "crosslink", "olaplex", "repair"],
    suitable_concerns: ["repair"],
    specs: {
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "cream_treatment",
      usage_protocol: "olaplex_3plus",
    },
  },
  {
    key: "olaplex_0",
    name: "OLAPLEX No.0 Intensive Bond Building Treatment",
    brand: "OLAPLEX",
    lifecycle_status: "active",
    default_card: false,
    description:
      "Optionaler Primer/Booster fuer sehr starke Schaedigung vor der OLAPLEX No.3PLUS-Behandlung; kein eigenstaendiger Standard-Schritt.",
    affiliate_link: "https://olaplex.com/products/olaplex-n-0-intensive-bond-building-treatment-us",
    price_eur: 34,
    currency: "EUR",
    tags: ["bondbuilder", "booster", "olaplex", "repair"],
    suitable_concerns: ["repair"],
    specs: {
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "primer_treatment",
      usage_protocol: "olaplex_0_booster",
    },
    relationship: {
      type: "add_on_for",
      targetKey: "olaplex_3plus",
    },
  },
  {
    key: "olaplex_3_legacy",
    name: "OLAPLEX No.3 Hair Perfector",
    brand: "OLAPLEX",
    lifecycle_status: "discontinued",
    default_card: false,
    description:
      "Aeltere OLAPLEX-Vorwaschbehandlung. Nutzbar, wenn bereits vorhanden; No.3PLUS ist der aktuelle Nachfolger.",
    affiliate_link: "https://olaplex.com/collections/retail/products/hair-perfector-no-3",
    price_eur: 34,
    currency: "EUR",
    tags: ["bondbuilder", "legacy", "olaplex", "repair"],
    suitable_concerns: ["repair"],
    specs: {
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "cream_treatment",
      usage_protocol: "olaplex_3_legacy",
    },
    relationship: {
      type: "replaced_by",
      targetKey: "olaplex_3plus",
    },
  },
  {
    key: "k18_leave_in",
    name: "K18 Leave-In Molecular Repair Hair Mask",
    brand: "K18",
    lifecycle_status: "active",
    default_card: true,
    description:
      "Leave-in-Bondbuilder im Peptid-/Laengsstruktur-Lane fuer intensive strukturelle Repair-Unterstuetzung.",
    affiliate_link: "https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml",
    price_eur: 75,
    currency: "EUR",
    tags: ["bondbuilder", "k18", "peptide", "repair"],
    suitable_concerns: ["repair"],
    specs: {
      bond_repair_intensity: "intensive",
      application_mode: "post_wash_leave_in",
      bond_repair_axis: "peptide_chain",
      treatment_mode: "leave_in",
      product_format: "leave_in_mask",
      usage_protocol: "k18_leave_in",
    },
  },
  {
    key: "epres_spray",
    name: "Epres Bond Repair Treatment",
    brand: "Epres",
    lifecycle_status: "active",
    default_card: true,
    description:
      "Spray-Bondbuilder im Disulfid-/Crosslink-Lane; unkompliziertere Anwendung, mit Eric-Pressly-/OLAPLEX-Entwicklerlinie, aber weniger etabliert als OLAPLEX/K18.",
    affiliate_link: "https://epres.com/products/bond-repair-treatment",
    price_eur: 50,
    currency: "EUR",
    tags: ["bondbuilder", "crosslink", "epres", "repair", "spray"],
    suitable_concerns: ["repair"],
    specs: {
      bond_repair_intensity: "intensive",
      application_mode: "pre_shampoo",
      bond_repair_axis: "disulfide_crosslink",
      treatment_mode: "rinse_out",
      product_format: "spray_treatment",
      usage_protocol: "epres_spray",
    },
  },
]

function printSeedMatrix() {
  console.table(
    BONDBUILDER_SEED_PRODUCTS.map((product) => ({
      product: product.name,
      brand: product.brand,
      category: "Bondbuilder",
      lifecycle: product.lifecycle_status,
      price: product.price_eur == null ? "none" : `${product.price_eur} ${product.currency}`,
      default_card: product.default_card ? "yes" : "no",
      intensity: product.specs.bond_repair_intensity,
      axis: product.specs.bond_repair_axis,
      mode: product.specs.treatment_mode,
      format: product.specs.product_format,
      protocol: product.specs.usage_protocol,
      relationship: product.relationship
        ? `${product.relationship.type} -> ${product.relationship.targetKey}`
        : "none",
    })),
  )
}

async function main() {
  const apply = process.argv.includes("--apply")
  printSeedMatrix()

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply after Nick confirms the seed matrix.")
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const productIdsByKey = new Map<string, string>()

  for (const product of BONDBUILDER_SEED_PRODUCTS) {
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("id")
      .eq("brand", product.brand)
      .eq("name", product.name)
      .maybeSingle()

    if (lookupError) throw lookupError

    const payload = {
      name: product.name,
      brand: product.brand,
      description: product.description,
      category: "Bondbuilder",
      affiliate_link: product.affiliate_link,
      price_eur: product.price_eur,
      currency: product.currency,
      tags: product.tags,
      suitable_concerns: product.suitable_concerns,
      suitable_thicknesses: ["fine", "normal", "coarse"],
      is_active: true,
      lifecycle_status: product.lifecycle_status,
      sort_order: product.default_card ? 0 : 50,
    }
    const embeddingText = [
      payload.name,
      payload.brand,
      payload.description,
      payload.tags.join(", "),
      payload.category,
    ]
      .filter(Boolean)
      .join(" ")
    const embedding = await generateEmbedding(embeddingText)
    const productPayload = {
      ...payload,
      embedding,
    }

    const { data: saved, error: productError } = existing
      ? await supabase
          .from("products")
          .update(productPayload)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabase.from("products").insert(productPayload).select("id").single()

    if (productError) throw productError
    productIdsByKey.set(product.key, saved.id)

    const { error: specsError } = await supabase.from("product_bondbuilder_specs").upsert(
      {
        product_id: saved.id,
        ...product.specs,
      },
      { onConflict: "product_id" },
    )

    if (specsError) throw specsError
  }

  for (const product of BONDBUILDER_SEED_PRODUCTS) {
    if (!product.relationship) continue
    const sourceProductId = productIdsByKey.get(product.key)
    const targetProductId = productIdsByKey.get(product.relationship.targetKey)
    if (!sourceProductId || !targetProductId) {
      throw new Error(`Missing relationship IDs for ${product.key}`)
    }

    const { error: relationshipError } = await supabase.from("product_relationships").upsert(
      {
        source_product_id: sourceProductId,
        target_product_id: targetProductId,
        relationship_type: product.relationship.type,
      },
      { onConflict: "source_product_id,target_product_id,relationship_type" },
    )

    if (relationshipError) throw relationshipError
  }

  console.log("\nSeed complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
