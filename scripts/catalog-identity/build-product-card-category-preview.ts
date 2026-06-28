import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

import {
  buildCompactProductFacts,
  formatProductPrice,
} from "@/components/chat/product-display-model"
import type { Product } from "@/lib/types"

type ProductRow = {
  id: string
  name: string
  brand: string | null
  category: string | null
  category_key: string | null
  image_url: string | null
  price_eur: number | null
  currency: string | null
  product_line_id: string | null
  affiliate_link: string | null
  is_active: boolean
  lifecycle_status: string | null
  sort_order: number | null
  suitable_concerns: string[] | null
  suitable_thicknesses: string[] | null
  tags: string[] | null
}

type ProductLineRow = {
  id: string
  canonical_name: string
}

type LeaveInSpecRow = {
  product_id: string
  format: string | null
  weight: string | null
  roles: string[] | null
  provides_heat_protection: boolean | null
  care_benefits: string[] | null
  application_stage: string[] | null
}

type IdentityProposalRow = {
  id: string
  current_name: string
  proposed_name: string
  current_brand: string
  proposed_brand: string
  current_line: string
  proposed_line: string
}

const outDir = path.join(process.cwd(), "ops", "product-card-category-preview", "2026-06-28")
const identityProposalPath = path.join(
  process.cwd(),
  "ops",
  "product-identity-cleanup",
  "2026-06-28",
  "product-identity-cleanup-proposals.json",
)

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function htmlEscape(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function hash(value: string): number {
  let acc = 0
  for (let index = 0; index < value.length; index += 1) {
    acc = (acc * 31 + value.charCodeAt(index)) >>> 0
  }
  return acc
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
}

function stripLeadingIdentity(name: string, prefix: string): string {
  const trimmed = prefix.trim()
  if (!trimmed) return name
  const pattern = new RegExp(`^${escapeRegex(trimmed)}(?:\\s+|[-–—:]+\\s*)`, "i")
  return name.replace(pattern, "").trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function loadIdentityProposals(): Map<string, IdentityProposalRow> {
  const raw = JSON.parse(readFileSync(identityProposalPath, "utf8")) as {
    rows: IdentityProposalRow[]
  }
  return new Map(raw.rows.map((row) => [row.id, row]))
}

function applyCanonicalPreviewOverrides(product: Product, originalName: string): Product {
  const next = { ...product }

  if (originalName === "Garnier Hair Food Aloe Vera") {
    next.brand = "Garnier"
    next.product_line_name = "Fructis"
    next.name = "Hair Food Aloe Vera"
  } else if (originalName === "Garnier Hair Food Macadamia") {
    next.brand = "Garnier"
    next.product_line_name = "Fructis"
    next.name = "Hair Food Macadamia"
  } else if (originalName === "Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung") {
    next.brand = "Garnier"
    next.product_line_name = "Fructis"
    next.name = "Hair Food Aloe Vera Feuchtigkeits-Spülung"
  } else if (originalName === "Gliss Kur Aqua Revive Conditioner") {
    next.brand = "Gliss"
    next.product_line_name = "Aqua Revive"
    next.name = "Aqua Revive Conditioner"
  } else if (originalName === "Guhl Bond+ Reparatur Spülung") {
    next.brand = "Guhl"
    next.product_line_name = "Bond+ Reparatur"
    next.name = "Reparatur Spülung"
  } else if (originalName === "OGX Renewing Argan Oil of Morocco Conditioner") {
    next.brand = "OGX"
    next.product_line_name = "Argan Oil of Morocco"
    next.name = "Renewing Conditioner"
  } else if (originalName === "Syoss Intense Volume Shampoo") {
    next.brand = "Syoss"
    next.product_line_name = "Intense Volume"
    next.name = "Shampoo"
  }

  return next
}

function cleanPreviewName(product: Product): Product {
  const prefixes = unique([
    product.brand ?? "",
    product.product_line_name ?? "",
    product.brand && product.product_line_name
      ? `${product.brand} ${product.product_line_name}`
      : "",
  ]).sort((left, right) => right.length - left.length)

  let nextName = product.name
  for (const prefix of prefixes) {
    nextName = stripLeadingIdentity(nextName, prefix)
  }

  return { ...product, name: nextName || product.name }
}

function identityLabel(product: Product): string {
  return [product.brand, product.product_line_name]
    .map((value) => value?.trim())
    .filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
    )
    .join(" · ")
}

function buildProduct(
  row: ProductRow,
  lineName: string | null,
  spec: LeaveInSpecRow | null,
  proposal: IdentityProposalRow | null,
): Product {
  const originalName = row.name
  const product = {
    ...row,
    name: proposal?.proposed_name ?? row.name,
    brand: proposal?.proposed_brand ?? row.brand ?? "",
    description: null,
    short_description: null,
    category: row.category,
    category_key: row.category_key ?? undefined,
    product_line_name: proposal?.proposed_line || lineName,
    image_url: row.image_url,
    price_eur: row.price_eur,
    currency: row.currency ?? "EUR",
    affiliate_link: row.affiliate_link,
    suitable_concerns: row.suitable_concerns ?? [],
    suitable_thicknesses: row.suitable_thicknesses ?? [],
    tags: row.tags ?? [],
    is_active: row.is_active,
    lifecycle_status: row.lifecycle_status,
    sort_order: row.sort_order,
    recommendation_meta: null,
    leave_in_specs: spec
      ? {
          product_id: spec.product_id,
          format: spec.format as Product["leave_in_specs"] extends infer Specs
            ? Specs extends { format?: infer Format }
              ? Format
              : never
            : never,
          weight: spec.weight as Product["leave_in_specs"] extends infer Specs
            ? Specs extends { weight?: infer Weight }
              ? Weight
              : never
            : never,
          roles: spec.roles ?? [],
          provides_heat_protection: Boolean(spec.provides_heat_protection),
          care_benefits: spec.care_benefits ?? [],
          application_stage: spec.application_stage ?? [],
          conditioner_relationship: null,
        }
      : null,
    created_at: "",
    updated_at: "",
  } as Product

  return cleanPreviewName(applyCanonicalPreviewOverrides(product, originalName))
}

function renderCard(product: Product): string {
  const identity = identityLabel(product)
  const facts = buildCompactProductFacts(product)
  const price = formatProductPrice(product.price_eur, product.currency)
  const image = product.image_url
    ? `<img src="${htmlEscape(product.image_url)}" alt="" loading="lazy">`
    : `<div class="fallback">${htmlEscape(product.category?.slice(0, 1) ?? "?")}</div>`

  return `
    <article class="card">
      <div class="image">${image}</div>
      <div class="content">
        ${identity ? `<div class="identity">${htmlEscape(identity)}</div>` : ""}
        <div class="name">${htmlEscape(product.name)}</div>
        <div class="chips">
          ${facts.map((fact) => `<span class="chip ${fact.source}">${htmlEscape(fact.label)}</span>`).join("")}
        </div>
      </div>
      ${price ? `<div class="price">${htmlEscape(price)}</div>` : ""}
      <div class="chevron">›</div>
    </article>
  `
}

function renderSection(title: string, products: Product[]): string {
  return `
    <section>
      <h2>${htmlEscape(title)} <span>${products.length}</span></h2>
      <div class="grid">
        ${products.map(renderCard).join("")}
      </div>
    </section>
  `
}

async function main() {
  config({ path: ".env.local" })
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  )

  const { data: rows, error } = await supabase
    .from("products")
    .select(
      "id,name,brand,category,category_key,image_url,price_eur,currency,product_line_id,affiliate_link,is_active,lifecycle_status,sort_order,suitable_concerns,suitable_thicknesses,tags",
    )
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })

  if (error) throw error

  const productRows = (rows ?? []) as ProductRow[]
  const lineIds = [...new Set(productRows.map((row) => row.product_line_id).filter(Boolean))]
  const { data: lineRows, error: lineError } = await supabase
    .from("product_lines")
    .select("id,canonical_name")
    .in("id", lineIds)
  if (lineError) throw lineError

  const { data: specRows, error: specError } = await supabase
    .from("product_leave_in_specs")
    .select(
      "product_id,format,weight,roles,provides_heat_protection,care_benefits,application_stage",
    )
  if (specError) throw specError

  const lines = new Map(
    (lineRows as ProductLineRow[]).map((line) => [line.id, line.canonical_name]),
  )
  const specs = new Map((specRows as LeaveInSpecRow[]).map((spec) => [spec.product_id, spec]))
  const proposals = loadIdentityProposals()
  const products = productRows.map((row) =>
    buildProduct(
      row,
      lines.get(row.product_line_id ?? "") ?? null,
      specs.get(row.id) ?? null,
      proposals.get(row.id) ?? null,
    ),
  )
  const byCategory = new Map<string, Product[]>()

  for (const product of products) {
    const key = product.category ?? "Unbekannt"
    byCategory.set(key, [...(byCategory.get(key) ?? []), product])
  }

  const sampleSections = [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "de-DE"))
    .map(([category, items]) => {
      const sampled = [...items]
        .sort((left, right) => hash(`${category}:${left.id}`) - hash(`${category}:${right.id}`))
        .slice(0, 3)
      return renderSection(category, sampled)
    })

  const stressNames = [
    "Syoss Intense Volume Shampoo",
    "Jean&Len Colorglow Granatapfel Rose Conditioner",
    "Guhl Bond+ Reparatur Spülung",
    "OGX Renewing Argan Oil of Morocco Conditioner",
    "Garnier Hair Food Aloe Vera",
    "Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung",
    "Neqi Moisture Mystery Conditioner",
    "Neqi Volume Victory Conditioner",
  ]
  const stressProducts = stressNames
    .map((name) => productRows.find((row) => row.name === name))
    .filter((row): row is ProductRow => Boolean(row))
    .map((row) =>
      buildProduct(
        row,
        lines.get(row.product_line_id ?? "") ?? null,
        specs.get(row.id) ?? null,
        proposals.get(row.id) ?? null,
      ),
    )

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product Card Target Display Preview</title>
  <style>
    :root {
      --text-heading: #2f2146;
      --text-caption: #726a74;
      --brand-plum-ice: #f0e8f8;
      --primary: #6f4cad;
      --border: #e3dde5;
      --bg: #fbfaf8;
      --card: #fff;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text-heading);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 1160px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(24px, 4vw, 38px);
      letter-spacing: 0;
    }
    p {
      max-width: 820px;
      color: var(--text-caption);
      line-height: 1.5;
      margin: 0 0 24px;
    }
    section { margin-top: 28px; }
    h2 {
      margin: 0 0 10px;
      font-size: 17px;
    }
    h2 span {
      color: var(--text-caption);
      font-weight: 500;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
    }
    .card {
      min-width: 0;
      min-height: 98px;
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--card);
      padding: 12px;
      box-shadow: 0 1px 3px rgba(36, 25, 50, 0.04);
    }
    .image, .image img, .fallback {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      border-radius: 12px;
    }
    .image img {
      object-fit: cover;
      background: #f6f1ef;
    }
    .fallback {
      display: grid;
      place-items: center;
      color: var(--primary);
      background: var(--brand-plum-ice);
      font-weight: 700;
    }
    .content {
      min-width: 0;
      flex: 1 1 auto;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      line-height: 1.25;
      font-weight: 700;
    }
    .identity {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
      color: var(--text-caption);
      font-size: 11px;
      line-height: 1.25;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
      min-width: 0;
    }
    .chip {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-radius: 999px;
      background: var(--brand-plum-ice);
      color: var(--primary);
      padding: 2px 8px;
      font-size: 10px;
      line-height: 16px;
      font-weight: 600;
    }
    .category {
      background: #ebe8ff;
      color: #46328d;
    }
    .price {
      flex: 0 0 auto;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 700;
    }
    .chevron {
      flex: 0 0 auto;
      color: var(--text-caption);
      font-size: 24px;
      line-height: 1;
    }
    @media (max-width: 520px) {
      main { padding-inline: 12px; }
      .grid { grid-template-columns: 1fr; }
      .card { min-height: 94px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Product Card Target Display Preview</h1>
    <p>Seeded sample of three active live products per category, plus identity stress cases. This preview applies the proposed identity cleanup before rendering: first line is brand/line, second line is target product name, then category chip and compact facts.</p>
    ${sampleSections.join("")}
    ${renderSection("Identity Stress Cases", stressProducts)}
  </main>
</body>
</html>`

  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, "review.html"), html)
  console.log(path.join(outDir, "review.html"))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
