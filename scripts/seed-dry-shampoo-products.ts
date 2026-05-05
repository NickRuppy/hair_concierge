import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

import type { ProductDryShampooSpecs } from "@/lib/dry-shampoo/constants"

loadEnv({ path: ".env.local" })

type DryShampooSeedProduct = {
  name: string
  brand: string
  description: string
  affiliate_link: string
  price_eur: number
  currency: "EUR"
  sort_order: number
  specs: Omit<ProductDryShampooSpecs, "product_id">
}

const CATEGORY = "Trockenshampoo"

const DRY_SHAMPOO_SEED_PRODUCTS: DryShampooSeedProduct[] = [
  {
    name: "Trockenshampoo Original",
    brand: "Batiste",
    description:
      "Klassisches Trockenshampoo fuer einen kurzen Ansatz-Refresh zwischen zwei Haarwaeschen.",
    affiliate_link: "https://www.dm.de/batiste-trockenshampoo-original-p5010724527481.html",
    price_eur: 3.75,
    currency: "EUR",
    sort_order: 9201,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Jedes Haar",
    brand: "ISANA",
    description:
      "Universelles Trockenshampoo fuer gelegentliches Auffrischen am Ansatz, wenn Waschen gerade nicht moeglich ist.",
    affiliate_link:
      "https://www.rossmann.de/de/pflege-und-duft-isana-trockenshampoo-jedes-haar/p/4305615554532",
    price_eur: 1.99,
    currency: "EUR",
    sort_order: 9202,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Kopfhaut Sensitive",
    brand: "Balea",
    description:
      "Sensitive Trockenshampoo-Option fuer eine kurze Between-Wash-Bruecke ohne aktive Kopfhautbeschwerden.",
    affiliate_link: "https://www.dm.de/balea-trockenshampoo-kopfhaut-sensitive-p4066447438789.html",
    price_eur: 1.95,
    currency: "EUR",
    sort_order: 9203,
    specs: {
      primary_effect: "sensitive_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "sensitive_ok",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Sensible Kopfhaut",
    brand: "Batiste",
    description:
      "Sensitive Refresh-Option fuer seltene Notfall- oder Tag-2-Situationen ohne Jucken, Schuppen oder Irritation.",
    affiliate_link:
      "https://www.dm.de/batiste-trockenshampoo-sensible-kopfhaut-leichter-duft-p5010724004777.html",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9204,
    specs: {
      primary_effect: "sensitive_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "sensitive_ok",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Schaum Kopfhaut Sensitive",
    brand: "Balea",
    description:
      "Schaum-/Liquid-Format fuer eine sensitive kurze Ansatz-Bruecke, nicht als Reinigungsschritt.",
    affiliate_link:
      "https://www.dm.de/balea-trockenshampoo-schaum-kopfhaut-sensitive-p4067796069556.html",
    price_eur: 1.45,
    currency: "EUR",
    sort_order: 9205,
    specs: {
      primary_effect: "sensitive_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "sensitive_ok",
      format: "foam_or_liquid",
    },
  },
  {
    name: "Trockenshampoo Liquid to Dry",
    brand: "got2b",
    description: "Liquid-to-dry Trockenshampoo fuer einen kurzen klassischen Refresh am Ansatz.",
    affiliate_link: "https://www.dm.de/p/d/2476987/got2b-trockenshampoo-liquid-to-dry",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9206,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "normal_only",
      format: "foam_or_liquid",
    },
  },
  {
    name: "Trockenshampoo Extra Volumen",
    brand: "got2b",
    description:
      "Trockenshampoo fuer mehr Ansatzvolumen und Griff als gelegentliche Styling-Bruecke.",
    affiliate_link:
      "https://geizhals.de/got2b-trockenwaesche-extra-volumen-trockenshampoo-a2375994.html",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9207,
    specs: {
      primary_effect: "volume_texture",
      hair_color_fit: "universal",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Blond",
    brand: "Batiste",
    description: "Farbfit-Option fuer blondes oder helles Haar bei einem kurzen Ansatz-Refresh.",
    affiliate_link: "https://www.dm.de/p/d/1435894/batiste-trockenshampoo-blond",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9208,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "blonde_light",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo Bruenett",
    brand: "Batiste",
    description: "Farbfit-Option fuer braunes Haar bei einer gelegentlichen Between-Wash-Bruecke.",
    affiliate_link: "https://www.dm.de/batiste-trockenshampoo-bruenett-p5010724527474.html",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9209,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "brown",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
  {
    name: "Trockenshampoo dunkel",
    brand: "Batiste",
    description: "Farbfit-Option fuer dunkles Haar bei einem kurzen kosmetischen Ansatz-Refresh.",
    affiliate_link: "https://www.dm.de/batiste-trockenshampoo-dunkel-p5010724527443.html",
    price_eur: 3.95,
    currency: "EUR",
    sort_order: 9210,
    specs: {
      primary_effect: "classic_refresh",
      hair_color_fit: "dark",
      scalp_sensitivity_fit: "normal_only",
      format: "aerosol_spray",
    },
  },
]

function printSeedMatrix() {
  console.table(
    DRY_SHAMPOO_SEED_PRODUCTS.map((product) => ({
      product: product.name,
      brand: product.brand,
      price: `${product.price_eur} ${product.currency}`,
      link: product.affiliate_link,
      primary_effect: product.specs.primary_effect,
      hair_color_fit: product.specs.hair_color_fit,
      scalp_sensitivity_fit: product.specs.scalp_sensitivity_fit,
      format: product.specs.format,
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

  for (const product of DRY_SHAMPOO_SEED_PRODUCTS) {
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
      category: CATEGORY,
      affiliate_link: product.affiliate_link,
      price_eur: product.price_eur,
      currency: product.currency,
      tags: ["trockenshampoo", "between-wash", product.specs.format],
      suitable_concerns: ["oily_scalp"],
      is_active: true,
      lifecycle_status: "active",
      sort_order: product.sort_order,
    }

    const { data: saved, error: productError } = existing
      ? await supabase.from("products").update(payload).eq("id", existing.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single()

    if (productError) throw productError

    const { error: specError } = await supabase.from("product_dry_shampoo_specs").upsert(
      {
        product_id: saved.id,
        ...product.specs,
      },
      { onConflict: "product_id" },
    )

    if (specError) throw specError
  }

  console.log(`Seeded ${DRY_SHAMPOO_SEED_PRODUCTS.length} dry-shampoo products.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
