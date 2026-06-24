import { NextResponse } from "next/server"
import { normalizeIdentityText } from "@/lib/product-identity"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { ERR_UNAUTHORIZED } from "@/lib/vocabulary"

type BrandRow = {
  id: string
  canonical_name: string
  normalized_name: string | null
}

type ProductLineRow = {
  id: string
  brand_id: string
  canonical_name: string
  normalized_name: string | null
}

type BrandAliasRow = {
  brand_id: string
  product_line_id: string | null
  alias: string
  normalized_alias: string | null
}

type BrandOption = {
  id: string
  type: "brand" | "alias"
  label: string
  brand_id: string
  product_line_id: string | null
}

function optionSearchText(option: BrandOption): string {
  return normalizeIdentityText(option.label)
}

function addOption(options: BrandOption[], seen: Set<string>, option: BrandOption, query: string) {
  const normalized = optionSearchText(option)
  if (query && !normalized.includes(query)) return

  const key = `${option.brand_id}:${option.product_line_id ?? ""}:${normalized}`
  if (seen.has(key)) return
  seen.add(key)
  options.push(option)
}

export async function GET(request: Request) {
  if (!isProductIntakeEnabled()) {
    return NextResponse.json(
      { error: "Produktaufnahme ist aktuell deaktiviert.", code: "product_intake_disabled" },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = normalizeIdentityText(searchParams.get("q") ?? "")
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10)
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1), 50)
  const admin = createAdminClient()

  const [brandsResult, linesResult, aliasesResult] = await Promise.all([
    admin.from("brands").select("id, canonical_name, normalized_name"),
    admin.from("product_lines").select("id, brand_id, canonical_name, normalized_name"),
    admin.from("brand_aliases").select("brand_id, product_line_id, alias, normalized_alias"),
  ])

  if (brandsResult.error || linesResult.error || aliasesResult.error) {
    return NextResponse.json({ error: "Marken konnten nicht geladen werden." }, { status: 500 })
  }

  const brands = (brandsResult.data ?? []) as BrandRow[]
  const productLines = (linesResult.data ?? []) as ProductLineRow[]
  const aliases = (aliasesResult.data ?? []) as BrandAliasRow[]
  const linesByBrandId = new Map<string, ProductLineRow[]>()

  for (const line of productLines) {
    const current = linesByBrandId.get(line.brand_id) ?? []
    current.push(line)
    linesByBrandId.set(line.brand_id, current)
  }

  const options: BrandOption[] = []
  const seen = new Set<string>()

  for (const brand of brands) {
    addOption(
      options,
      seen,
      {
        id: `brand:${brand.id}`,
        type: "brand",
        label: brand.canonical_name,
        brand_id: brand.id,
        product_line_id: null,
      },
      query,
    )

    for (const line of linesByBrandId.get(brand.id) ?? []) {
      addOption(
        options,
        seen,
        {
          id: `line:${line.id}`,
          type: "brand",
          label: `${brand.canonical_name} ${line.canonical_name}`,
          brand_id: brand.id,
          product_line_id: line.id,
        },
        query,
      )
    }
  }

  for (const alias of aliases) {
    addOption(
      options,
      seen,
      {
        id: `alias:${alias.brand_id}:${alias.product_line_id ?? "brand"}:${normalizeIdentityText(
          alias.alias,
        )}`,
        type: "alias",
        label: alias.alias,
        brand_id: alias.brand_id,
        product_line_id: alias.product_line_id,
      },
      query,
    )
  }

  options.sort((left, right) => left.label.localeCompare(right.label, "de"))

  return NextResponse.json({ options: options.slice(0, limit) })
}
