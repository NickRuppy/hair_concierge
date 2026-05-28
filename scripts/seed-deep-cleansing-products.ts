import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

import {
  DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES,
  isDeepCleansingShampooCategory,
  type ProductDeepCleansingShampooSpecs,
} from "@/lib/deep-cleansing-shampoo/constants"

type DeepCleansingSeedProduct = {
  name: string
  brand: string
  description: string
  short_description: string
  retailer_url: string
  source_url: string
  source_note: string
  mapping_reason: string
  price_eur: number | null
  currency: "EUR"
  sort_order: number
  specs: Omit<ProductDeepCleansingShampooSpecs, "product_id">
}

type DeepCleansingCatalogRow = {
  id: string
  brand: string | null
  name: string | null
  category: string | null
  is_active: boolean | null
  image_url?: string | null
  tags?: string[] | null
  suitable_thicknesses?: string[] | null
  suitable_concerns?: string[] | null
}

const CATEGORY = "Tiefenreinigungsshampoo"
const DEEP_CLEANSING_CATEGORY_ALIASES = [...DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES]
const EXPECTED_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const EXPECTED_SUPABASE_HOSTNAME = `${EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`
const CONFIRM_PROJECT_FLAG = `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`

export const STALE_DEEP_CLEANSING_DEACTIVATION_PATCH = {
  is_active: false,
  lifecycle_status: "discontinued",
} as const

export const DEEP_CLEANSING_SEED_PRODUCTS = [
  {
    name: "PEPTIDE PREP Detox Shampoo",
    brand: "K18",
    description:
      "Starkes Detox-Shampoo fuer gelegentlichen Reset bei Stylingaufbau, Sebum und Metall-/Hartwasser-Kontext.",
    short_description: "Starker breiter Reset fuer Aufbau, Sebum und Metalle.",
    retailer_url: "https://www.douglas.de/de/p/5010965040",
    source_url: "https://www.k18hair.com/products/peptide-prep-detox-shampoo-8-5oz",
    source_note:
      "K18 states color-safe, removes product buildup, sebum, copper, metals from hard/tap water, and is weekly/as-needed.",
    mapping_reason:
      "Product/sebum buildup plus copper/metals from hard-water claims make this broad-spectrum detox; explicit color-safe supports color suitability.",
    price_eur: 44,
    currency: "EUR",
    sort_order: 9301,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "strong",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Detox Shampoo",
    brand: "OUAI",
    description:
      "Starkes Detox-Shampoo fuer oeligen Ansatz, Stylingaufbau und Hartwasser-Ablagerungen.",
    short_description: "Starker Detox-Reset fuer Oel, Stylingaufbau und Hartwasser.",
    retailer_url: "https://www.douglas.de/de/p/5002559007",
    source_url: "https://theouai.com/products/detox-shampoo?pp=0",
    source_note:
      "OUAI states it removes dirt/oil/impurities, styling buildup and hard-water deposits, with color-treated safety in FAQ.",
    mapping_reason:
      "Oil/styling buildup plus hard-water deposits make this broad-spectrum detox; FAQ color-treated safety supports color suitability.",
    price_eur: 24.99,
    currency: "EUR",
    sort_order: 9302,
    specs: {
      scalp_type_focus: "oily",
      reset_intensity: "strong",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "No.4C Bond Maintenance Clarifying Shampoo",
    brand: "OLAPLEX",
    description:
      "Klaerendes Shampoo fuer woechentlichen oder gelegentlichen Reset bei Produktaufbau, Oel und Umwelt-/Mineral-Kontext.",
    short_description: "Mittlerer breiter Reset fuer Aufbau, Oel und Mineral-Kontext.",
    retailer_url: "https://www.douglas.de/de/p/5010837003",
    source_url:
      "https://es.olaplex.com/products/olaplex-n-4c-bond-maintenance-clarifying-shampoo-eu",
    source_note:
      "OLAPLEX says weekly/as-needed clarifying removes pollution, chlorine, heavy metals, hard-water minerals, excess oil and product buildup; safe for colored/chemically treated hair.",
    mapping_reason:
      "Product/oil buildup plus pollution, chlorine, metals and hard-water minerals make this broad-spectrum detox; colored/chemically treated safety is explicit.",
    price_eur: 34,
    currency: "EUR",
    sort_order: 9303,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Hair Cleansing Cream Shampoo",
    brand: "Redken",
    description:
      "Starkes klaerendes Shampoo fuer Produktreste, Oel, Hartwasser-Mineralien und Umweltbelastung.",
    short_description: "Starker breiter Reset fuer Rueckstaende, Oel und Hartwasser.",
    retailer_url: "https://www.douglas.de/de/p/5010218791",
    source_url:
      "https://www.redken.eu/de-de/produkte/haarpflege/hair-cleansing-cream-shampoo/hair-cleansing-cream-shampoo",
    source_note:
      "Redken DE says it removes dry shampoo, product residue, hard-water minerals, excess oil and pollution; suitable for color-treated hair.",
    mapping_reason:
      "Dry-shampoo/product residue and oil plus hard-water minerals and pollution make this broad-spectrum detox; color-treated suitability is explicit.",
    price_eur: null,
    currency: "EUR",
    sort_order: 9304,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "strong",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Clarifying Detox Shampoo",
    brand: "Living Proof",
    description:
      "Klaerendes Detox-Shampoo fuer Produkt-/Pollution-Aufbau, Oel, Hartwasser-Metalle und Chlorverfaerbungen.",
    short_description: "Mittlerer breiter Reset fuer Aufbau, Oel, Metalle und Chlor.",
    retailer_url: "https://www.douglas.de/de/p/5011588110",
    source_url: "https://www.livingproof.com/products/clarifying-detox-shampoo",
    source_note:
      "Living Proof says it removes product/pollution buildup, excess oil, heavy metals from hard water, chlorine discoloration/copper; safe for color/chemically treated hair.",
    mapping_reason:
      "Product/pollution buildup and oil plus hard-water metals, chlorine discoloration and copper make this broad-spectrum detox; color/chemically treated safety is explicit.",
    price_eur: 31.99,
    currency: "EUR",
    sort_order: 9305,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Serie Expert Metal DX Shampoo",
    brand: "L'Oreal Professionnel",
    description:
      "Anti-Metall-Shampoo fuer Metallpartikel-Kontext bei naturbelassenem, gefaerbtem, geschaedigtem oder blondiertem Haar.",
    short_description: "Mittlerer Spezial-Reset fuer Metall-Kontext.",
    retailer_url: "https://www.douglas.de/de/p/5011380000",
    source_url: "https://www.lorealprofessionnel.de/alle-produkte/haarpflege/metal-dx-shampoo",
    source_note:
      "L'Oreal DE positions it as anti-metal shampoo with glicoamine removing/neutralizing metal particles, preventing color change, recommended for natural, colored, damaged, or bleached hair.",
    mapping_reason:
      "The claim is specifically metal-particle focused rather than broad product/sebum buildup; colored/bleached hair recommendation supports color suitability.",
    price_eur: null,
    currency: "EUR",
    sort_order: 9306,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "metal_mineral_hard_water",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Hard Water Wellness Shampoo",
    brand: "Malibu C",
    description:
      "Chelating Shampoo fuer Hartwasser-Mineralien und metallische Verfaerbungsrisiken.",
    short_description: "Mittlerer Spezial-Reset fuer Hartwasser-Mineralien.",
    retailer_url: "https://www.notino.de/malibu-c/hard-water-wallness-tiefenreinigendes-shampoo/",
    source_url: "https://malibuc.com/products/hard-water-wellness-shampoo?variant=42862183678015",
    source_note:
      "Malibu C states chelating hard-water shampoo for mineral buildup, calcium/magnesium, iron/copper discoloration; no explicit color-safe claim captured for this shampoo.",
    mapping_reason:
      "The claim is hard-water mineral and metal discoloration specific; no explicit color-safe claim was captured, so suitability stays unknown.",
    price_eur: null,
    currency: "EUR",
    sort_order: 9307,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "metal_mineral_hard_water",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    name: "Clarifying Shampoo",
    brand: "Moroccanoil",
    description:
      "Tiefenreinigendes Shampoo fuer belastetes Haar mit Aufbau, Hartwasser-/Mineralablagerungen, Chlor und Umweltbelastung.",
    short_description: "Mittlerer breiter Reset fuer Aufbau, Mineralien und Chlor.",
    retailer_url:
      "https://www.parfumdreams.de/Moroccanoil/Haarpflege/Pflege/Clarifying-Shampoo/index_42428.aspx",
    source_url: "https://www.moroccanoil.com/products/clarifying-shampoo",
    source_note:
      "Moroccanoil states deep-cleansing for hair burdened by buildup, hard water/mineral deposits, chlorine and environmental impurities; color-safe.",
    mapping_reason:
      "Buildup plus hard-water/mineral deposits, chlorine and environmental impurities make this broad-spectrum detox; color-safe claim is explicit.",
    price_eur: 23.49,
    currency: "EUR",
    sort_order: 9308,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "SOLU Shampoo",
    brand: "Davines",
    description:
      "Tiefenreinigendes Shampoo fuer Ablagerungen, Schmutz, Stylingrueckstaende und urbane Umweltbelastung.",
    short_description: "Mittlerer breiter Reset fuer Rueckstaende und Pollution.",
    retailer_url: "https://de.davines.com/products/solu-shampoo",
    source_url: "https://de.davines.com/products/solu-shampoo",
    source_note:
      "Davines DE says deep-cleansing for scalp and hair, removes deposits, dirt, styling residue and urban pollution. No explicit color-safe or mineral-removal claim captured.",
    mapping_reason:
      "Styling residue plus deposits and dirt support a product/styling buildup reset; color suitability remains unknown without an explicit color-safe claim.",
    price_eur: 25,
    currency: "EUR",
    sort_order: 9309,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    name: "Sunday Clarifying Shampoo",
    brand: "Bumble and bumble",
    description:
      "Woechentliches klaerendes Shampoo fuer Produktreste, ueberschuessiges Oel und Pollutants bei nicht farbbehandeltem Haar.",
    short_description: "Starker Reset fuer Produktreste und Oel.",
    retailer_url:
      "https://www.notino.de/bumble-and-bumble/bb-sunday-shampoo-reinigendes-detox-shampoo/",
    source_url:
      "https://www.bumbleandbumble.com/product/19047/219/care/shampoos/sunday-clarifying-shampoo",
    source_note:
      "Bumble says weekly clarifying lifts product residue, excess oil and pollutants, and explicitly excludes color-treated hair.",
    mapping_reason:
      "The primary lane is product residue and excess oil; pollutant mention is present but no mineral/hard-water specialization, and color-treated hair is excluded.",
    price_eur: null,
    currency: "EUR",
    sort_order: 9310,
    specs: {
      scalp_type_focus: "oily",
      reset_intensity: "strong",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
] as const satisfies readonly DeepCleansingSeedProduct[]

function productKey(product: Pick<DeepCleansingCatalogRow, "brand" | "name">): string {
  return `${product.brand ?? ""}\u0000${product.name ?? ""}`
}

const PLANNED_PRODUCT_KEYS = new Set(DEEP_CLEANSING_SEED_PRODUCTS.map(productKey))

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
  ]
}

export function findUnexpectedActiveDeepCleansingProducts(
  products: DeepCleansingCatalogRow[],
): string[] {
  return products
    .filter((product) => isDeepCleansingShampooCategory(product.category) && product.is_active)
    .filter((product) => !PLANNED_PRODUCT_KEYS.has(productKey(product)))
    .map((product) => product.id)
}

export function assertDeepCleansingSeedApplyTarget(params: {
  supabaseUrl: string
  argv?: readonly string[]
}): void {
  const argv = params.argv ?? process.argv
  const hostname = new URL(params.supabaseUrl).hostname

  if (hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `Refusing to apply deep-cleansing seed to unexpected Supabase project: ${hostname}. ` +
        `Expected ${EXPECTED_SUPABASE_HOSTNAME}.`,
    )
  }

  if (!argv.includes(CONFIRM_PROJECT_FLAG)) {
    throw new Error(
      `Refusing to apply deep-cleansing seed without ${CONFIRM_PROJECT_FLAG}. ` +
        "Dry-run output is still available without confirmation.",
    )
  }
}

function printSeedMatrix() {
  console.table(
    DEEP_CLEANSING_SEED_PRODUCTS.map((product) => ({
      brand: product.brand,
      product: product.name,
      retailer_url: product.retailer_url,
      source_url: product.source_url,
      source_note: product.source_note,
      price: product.price_eur == null ? "none" : `${product.price_eur} ${product.currency}`,
      scalp_type_focus: product.specs.scalp_type_focus,
      reset_intensity: product.specs.reset_intensity,
      reset_focus: product.specs.reset_focus,
      color_treated_suitability: product.specs.color_treated_suitability,
      mapping_reason: product.mapping_reason,
    })),
  )
}

async function main() {
  const apply = process.argv.includes("--apply")
  const deactivateStale = process.argv.includes("--deactivate-stale")
  printSeedMatrix()

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply after Nick confirms the seed matrix.")
    if (deactivateStale) {
      console.log("--deactivate-stale is ignored without --apply.")
    }
    return
  }

  loadEnv({ path: ".env.local" })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  assertDeepCleansingSeedApplyTarget({ supabaseUrl })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const seededProductIds: string[] = []

  for (const product of DEEP_CLEANSING_SEED_PRODUCTS) {
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("id,tags,suitable_thicknesses,suitable_concerns,image_url")
      .eq("brand", product.brand)
      .eq("name", product.name)
      .maybeSingle()

    if (lookupError) throw lookupError
    const existingCatalogRow = existing as DeepCleansingCatalogRow | null
    const tags = uniqueNonEmpty([
      ...(existingCatalogRow?.tags ?? []),
      "tiefenreinigung",
      "clarifying",
      product.specs.reset_focus,
    ])
    const suitableThicknesses = uniqueNonEmpty([
      ...(existingCatalogRow?.suitable_thicknesses ?? []),
      "fine",
      "normal",
      "coarse",
    ])
    const suitableConcerns = uniqueNonEmpty([
      ...(existingCatalogRow?.suitable_concerns ?? []),
      "healthy_scalp",
    ])

    const payload = {
      name: product.name,
      brand: product.brand,
      description: product.description,
      short_description: product.short_description,
      category: CATEGORY,
      affiliate_link: product.retailer_url,
      image_url: existingCatalogRow?.image_url ?? null,
      price_eur: product.price_eur,
      currency: product.currency,
      tags,
      suitable_thicknesses: suitableThicknesses,
      suitable_concerns: suitableConcerns,
      is_active: true,
      lifecycle_status: "active",
      sort_order: product.sort_order,
    }

    const { data: saved, error: productError } = existingCatalogRow
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", existingCatalogRow.id)
          .select("id")
          .single()
      : await supabase.from("products").insert(payload).select("id").single()

    if (productError) throw productError
    seededProductIds.push(saved.id)

    const { error: specError } = await supabase.from("product_deep_cleansing_shampoo_specs").upsert(
      {
        product_id: saved.id,
        ...product.specs,
      },
      { onConflict: "product_id" },
    )

    if (specError) throw specError
  }

  const { data: activeDeepCleansingProducts, error: activeLookupError } = await supabase
    .from("products")
    .select("id,brand,name,category,is_active")
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
    .eq("is_active", true)

  if (activeLookupError) throw activeLookupError

  const unexpectedActiveIds = findUnexpectedActiveDeepCleansingProducts(
    (activeDeepCleansingProducts ?? []) as DeepCleansingCatalogRow[],
  )

  if (unexpectedActiveIds.length > 0 && deactivateStale) {
    const { error: deactivateError } = await supabase
      .from("products")
      .update(STALE_DEEP_CLEANSING_DEACTIVATION_PATCH)
      .in("id", unexpectedActiveIds)

    if (deactivateError) throw deactivateError
    console.log(`Deactivated ${unexpectedActiveIds.length} unexpected deep-cleansing products.`)
  } else if (unexpectedActiveIds.length > 0) {
    console.warn(
      `Found ${unexpectedActiveIds.length} active deep-cleansing products outside the reviewed seed matrix. ` +
        "Leaving them active. Re-run with --apply --deactivate-stale only after reviewing those rows.",
    )
  }

  const { count: activeCount, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
    .eq("is_active", true)

  if (countError) throw countError
  if (deactivateStale && activeCount !== seededProductIds.length) {
    throw new Error(
      `Expected ${seededProductIds.length} active deep-cleansing products, found ${
        activeCount ?? 0
      }`,
    )
  }

  console.log(`Seeded ${DEEP_CLEANSING_SEED_PRODUCTS.length} deep-cleansing products.`)
}

if (process.argv[1]?.endsWith("seed-deep-cleansing-products.ts")) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
