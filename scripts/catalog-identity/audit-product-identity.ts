import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

type ProductRow = {
  id: string
  name: string
  brand: string | null
  brand_id: string | null
  category: string | null
  product_line_id: string | null
  is_active: boolean
  lifecycle_status: string | null
  sort_order: number | null
  affiliate_link: string | null
  image_url: string | null
}

type BrandRow = {
  id: string
  canonical_name: string
  normalized_name: string | null
}

type ProductLineRow = {
  id: string
  brand_id: string | null
  canonical_name: string
  normalized_name: string | null
}

type ProposalRow = {
  id: string
  category: string
  status: string
  confidence: "high" | "medium" | "review"
  action_bucket:
    | "name_remove_brand_and_line"
    | "name_remove_brand"
    | "brand_and_name_cleanup"
    | "manual_review"
  current_name: string
  proposed_name: string
  current_brand: string
  proposed_brand: string
  canonical_brand: string
  current_line: string
  proposed_line: string
  current_card: string
  proposed_card: string
  update_fields: string
  reasons: string
  notes: string
}

const outDir = path.join(process.cwd(), "ops", "product-identity-cleanup", "2026-06-28")

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/@/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
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

function csvEscape(value: string | number): string {
  const text = String(value)
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function htmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function displayIdentity(brand: string, line: string, name: string): string {
  const identity = unique([brand, line]).join(" · ")
  return identity ? `${name}\n${identity}` : name
}

function lineWithoutBrand(line: string, brand: string): string {
  const normalizedLine = normalize(line)
  const normalizedBrand = normalize(brand)
  if (!normalizedLine || !normalizedBrand) return line
  if (!normalizedLine.startsWith(`${normalizedBrand} `)) return line
  return line.slice(brand.length).trim()
}

function proposeName(product: ProductRow, canonicalBrand: string, line: string): string {
  let next = product.name.trim()
  const currentBrand = product.brand?.trim() ?? ""
  const lineMinusCurrentBrand = lineWithoutBrand(line, currentBrand)
  const lineMinusCanonicalBrand = lineWithoutBrand(line, canonicalBrand)
  const prefixes = unique([
    currentBrand && lineMinusCurrentBrand ? `${currentBrand} ${lineMinusCurrentBrand}` : "",
    canonicalBrand && lineMinusCanonicalBrand ? `${canonicalBrand} ${lineMinusCanonicalBrand}` : "",
    currentBrand && line ? `${currentBrand} ${line}` : "",
    canonicalBrand && line ? `${canonicalBrand} ${line}` : "",
    currentBrand,
    canonicalBrand,
    line,
    lineMinusCurrentBrand,
    lineMinusCanonicalBrand,
  ]).sort((left, right) => right.length - left.length)

  let changed = true
  while (changed) {
    changed = false
    for (const prefix of prefixes) {
      const before = next
      next = stripLeadingIdentity(next, prefix)
      if (next !== before) changed = true
    }
  }

  return next || product.name.trim()
}

function containsLineInBrand(currentBrand: string, canonicalBrand: string, line: string): boolean {
  const normalizedBrand = normalize(currentBrand)
  const normalizedCanonical = normalize(canonicalBrand)
  const normalizedLine = normalize(line)
  if (!normalizedBrand || !normalizedLine) return false
  if (normalizedBrand === normalizedLine) return true
  if (normalizedBrand.endsWith(` ${normalizedLine}`)) return true
  return Boolean(normalizedCanonical && normalizedBrand.startsWith(`${normalizedCanonical} `))
}

function containsIdentityPrefix(name: string, identity: string): boolean {
  const normalizedName = normalize(name)
  const normalizedIdentity = normalize(identity)
  return Boolean(
    normalizedIdentity &&
    (normalizedName === normalizedIdentity || normalizedName.startsWith(`${normalizedIdentity} `)),
  )
}

function classifyProposal(params: {
  product: ProductRow
  canonicalBrand: string
  line: string
  proposedName: string
  proposedBrand: string
}): Pick<ProposalRow, "action_bucket" | "confidence" | "reasons" | "notes"> | null {
  const { product, canonicalBrand, line, proposedName, proposedBrand } = params
  const currentBrand = product.brand?.trim() ?? ""
  const currentName = product.name.trim()
  const reasons: string[] = []
  const notes: string[] = []

  if (containsIdentityPrefix(currentName, currentBrand)) reasons.push("name starts with brand")
  if (containsIdentityPrefix(currentName, canonicalBrand) && canonicalBrand !== currentBrand) {
    reasons.push("name starts with canonical brand")
  }
  if (containsIdentityPrefix(currentName, line)) reasons.push("name starts with product line")
  const lineMinusBrand = lineWithoutBrand(line, currentBrand || canonicalBrand)
  if (lineMinusBrand !== line && containsIdentityPrefix(currentName, lineMinusBrand)) {
    reasons.push("name starts with product line without brand")
  }

  const brandChanges = proposedBrand !== currentBrand
  const nameChanges = proposedName !== currentName
  if (!brandChanges && !nameChanges) return null

  if (brandChanges) {
    reasons.push("brand contains line; brand_id resolves to cleaner canonical brand")
  }

  const proposedNameLooksGeneric =
    /^(?:shampoo|conditioner|spülung|haaröl|öl|maske|haarmaske|leave-in|leave in)$/i.test(
      proposedName,
    )
  if (proposedNameLooksGeneric) {
    notes.push("Proposed name is generic; review whether line should stay visible")
  }

  const lineInName =
    Boolean(line) &&
    (containsIdentityPrefix(
      currentName,
      `${currentBrand} ${lineWithoutBrand(line, currentBrand)}`,
    ) ||
      containsIdentityPrefix(
        currentName,
        `${canonicalBrand} ${lineWithoutBrand(line, canonicalBrand)}`,
      ) ||
      containsIdentityPrefix(currentName, line) ||
      containsIdentityPrefix(currentName, lineWithoutBrand(line, currentBrand || canonicalBrand)))

  if (brandChanges) {
    return {
      action_bucket: "brand_and_name_cleanup",
      confidence: "review",
      reasons: unique(reasons).join("; "),
      notes: unique(["Brand field change needs explicit approval", ...notes]).join("; "),
    }
  }

  if (lineInName) {
    return {
      action_bucket: "name_remove_brand_and_line",
      confidence: proposedNameLooksGeneric ? "review" : "high",
      reasons: unique(reasons).join("; "),
      notes: notes.join("; "),
    }
  }

  return {
    action_bucket: "name_remove_brand",
    confidence: "medium",
    reasons: unique(reasons).join("; "),
    notes: notes.join("; "),
  }
}

function buildHtml(rows: ProposalRow[], summary: Record<string, number>): string {
  const grouped = rows.reduce<Record<string, ProposalRow[]>>((acc, row) => {
    const key = `${row.confidence} / ${row.action_bucket}`
    acc[key] = acc[key] ?? []
    acc[key].push(row)
    return acc
  }, {})

  const sections = Object.entries(grouped)
    .map(([heading, sectionRows]) => {
      const body = sectionRows
        .map(
          (row) => `
            <tr>
              <td><code>${htmlEscape(row.id)}</code></td>
              <td>${htmlEscape(row.category)}</td>
              <td>${htmlEscape(row.confidence)}</td>
              <td>${htmlEscape(row.update_fields)}</td>
              <td><strong>${htmlEscape(row.current_name)}</strong><br><span>${htmlEscape(row.current_brand)}${row.current_line ? ` · ${htmlEscape(row.current_line)}` : ""}</span></td>
              <td><strong>${htmlEscape(row.proposed_name)}</strong><br><span>${htmlEscape(row.proposed_brand)}${row.proposed_line ? ` · ${htmlEscape(row.proposed_line)}` : ""}</span></td>
              <td>${htmlEscape(row.reasons)}${row.notes ? `<br><em>${htmlEscape(row.notes)}</em>` : ""}</td>
            </tr>`,
        )
        .join("\n")
      return `
        <section>
          <h2>${htmlEscape(heading)} <span>${sectionRows.length}</span></h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Confidence</th>
                <th>Fields</th>
                <th>Current card identity</th>
                <th>Proposed card identity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </section>`
    })
    .join("\n")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Product Identity Cleanup Review</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #2b2430; background: #fbfaf8; }
    h1 { margin-bottom: 4px; }
    p { color: #665d67; max-width: 960px; line-height: 1.5; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
    .metric { border: 1px solid #ddd7df; background: #fff; border-radius: 8px; padding: 12px 14px; min-width: 150px; }
    .metric strong { display: block; font-size: 22px; color: #2f194d; }
    section { margin-top: 30px; }
    h2 { font-size: 18px; margin-bottom: 10px; }
    h2 span { color: #6f4cad; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2dce4; }
    th, td { border-bottom: 1px solid #ebe6ed; padding: 9px 10px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #f2eef7; color: #493b53; position: sticky; top: 0; }
    td span, em { color: #6f6870; }
    code { font-size: 11px; }
  </style>
</head>
<body>
  <h1>Product Identity Cleanup Review</h1>
  <p>Dry-run audit of active production products. Proposed cleanup follows the display rule: product name should hold the product-specific name, while brand and product line live in their own columns.</p>
  <div class="summary">
    ${Object.entries(summary)
      .map(
        ([key, value]) => `<div class="metric"><strong>${value}</strong>${htmlEscape(key)}</div>`,
      )
      .join("\n")}
  </div>
  ${sections}
</body>
</html>`
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    },
  )

  const { data: products, error: productError } = await supabase
    .from("products")
    .select(
      "id,name,brand,brand_id,category,product_line_id,is_active,lifecycle_status,sort_order,affiliate_link,image_url",
    )
    .eq("is_active", true)
    .order("brand", { ascending: true })
    .order("name", { ascending: true })

  if (productError) throw productError

  const brandIds = unique(
    ((products ?? []) as ProductRow[]).map((product) => product.brand_id ?? ""),
  )
  const lineIds = unique(
    ((products ?? []) as ProductRow[]).map((product) => product.product_line_id ?? ""),
  )

  const [{ data: brands, error: brandError }, { data: lines, error: lineError }] =
    await Promise.all([
      brandIds.length
        ? supabase.from("brands").select("id,canonical_name,normalized_name").in("id", brandIds)
        : Promise.resolve({ data: [], error: null }),
      lineIds.length
        ? supabase
            .from("product_lines")
            .select("id,brand_id,canonical_name,normalized_name")
            .in("id", lineIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (brandError) throw brandError
  if (lineError) throw lineError

  const brandsById = new Map(((brands ?? []) as BrandRow[]).map((brand) => [brand.id, brand]))
  const linesById = new Map(((lines ?? []) as ProductLineRow[]).map((line) => [line.id, line]))

  const proposalRows: ProposalRow[] = []
  for (const product of (products ?? []) as ProductRow[]) {
    const currentBrand = product.brand?.trim() ?? ""
    const canonicalBrand =
      brandsById.get(product.brand_id ?? "")?.canonical_name?.trim() ?? currentBrand
    const currentLine = linesById.get(product.product_line_id ?? "")?.canonical_name?.trim() ?? ""
    const proposedBrand =
      currentLine && containsLineInBrand(currentBrand, canonicalBrand, currentLine)
        ? canonicalBrand
        : currentBrand
    const proposedName = proposeName(product, proposedBrand || canonicalBrand, currentLine)
    const classification = classifyProposal({
      product,
      canonicalBrand,
      line: currentLine,
      proposedName,
      proposedBrand,
    })
    if (!classification) continue

    const updateFields = unique([
      proposedName !== product.name.trim() ? "name" : "",
      proposedBrand !== currentBrand ? "brand" : "",
    ])

    proposalRows.push({
      id: product.id,
      category: product.category ?? "",
      status: product.lifecycle_status ?? (product.is_active ? "active" : "inactive"),
      confidence: classification.confidence,
      action_bucket: classification.action_bucket,
      current_name: product.name,
      proposed_name: proposedName,
      current_brand: currentBrand,
      proposed_brand: proposedBrand,
      canonical_brand: canonicalBrand,
      current_line: currentLine,
      proposed_line: currentLine,
      current_card: displayIdentity(currentBrand, currentLine, product.name),
      proposed_card: displayIdentity(proposedBrand, currentLine, proposedName),
      update_fields: updateFields.join(","),
      reasons: classification.reasons,
      notes: classification.notes,
    })
  }

  proposalRows.sort((left, right) => {
    const confidenceRank = { high: 0, review: 1, medium: 2 }
    return (
      confidenceRank[left.confidence] - confidenceRank[right.confidence] ||
      left.action_bucket.localeCompare(right.action_bucket) ||
      left.current_brand.localeCompare(right.current_brand) ||
      left.current_name.localeCompare(right.current_name)
    )
  })

  const summary = {
    "active products audited": (products ?? []).length,
    "cleanup candidates": proposalRows.length,
    "high confidence": proposalRows.filter((row) => row.confidence === "high").length,
    "needs review": proposalRows.filter((row) => row.confidence === "review").length,
    "medium brand-prefix cleanup": proposalRows.filter((row) => row.confidence === "medium").length,
    "brand field changes": proposalRows.filter((row) => row.update_fields.includes("brand")).length,
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    path.join(outDir, "product-identity-cleanup-proposals.json"),
    JSON.stringify(
      { generated_at: new Date().toISOString(), summary, rows: proposalRows },
      null,
      2,
    ),
  )
  const csvColumns = [
    "confidence",
    "action_bucket",
    "update_fields",
    "id",
    "category",
    "current_name",
    "proposed_name",
    "current_brand",
    "proposed_brand",
    "canonical_brand",
    "current_line",
    "proposed_line",
    "reasons",
    "notes",
  ] satisfies Array<keyof ProposalRow>
  writeFileSync(
    path.join(outDir, "product-identity-cleanup-proposals.csv"),
    [
      csvColumns.join(","),
      ...proposalRows.map((row) => csvColumns.map((column) => csvEscape(row[column])).join(",")),
    ].join("\n"),
  )
  writeFileSync(path.join(outDir, "review.html"), buildHtml(proposalRows, summary))

  console.log(JSON.stringify({ outDir, summary }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
