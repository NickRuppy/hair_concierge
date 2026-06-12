import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  MANIFEST_HEADER,
  type ProductImageProcessingMethod,
  type ProductImageQualityConfidence,
  type ProductImageSourceType,
} from "./manifest"

const batchDir =
  process.argv.find((arg) => arg.startsWith("--batch-dir="))?.slice("--batch-dir=".length) ??
  "data/product-images/pilot-2026-06-10"
const expectedCount = Number(
  process.argv
    .find((arg) => arg.startsWith("--expected-count="))
    ?.slice("--expected-count=".length) ?? 20,
)
const candidateFileArgs = process.argv
  .filter((arg) => arg.startsWith("--candidate-file="))
  .map((arg) => arg.slice("--candidate-file=".length))
const candidateFilesArg = process.argv.find((arg) => arg.startsWith("--candidate-files="))
const configuredCandidateFiles = [
  ...(candidateFilesArg
    ?.slice("--candidate-files=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? []),
  ...candidateFileArgs,
]

if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
  throw new Error(`--expected-count must be a positive integer, got ${expectedCount}`)
}

interface PilotProduct {
  id: string
  brand: string
  name: string
  category: string
  affiliate_link: string
}

interface CandidateResult {
  product: PilotProduct
  candidates: Array<{
    url: string
    source: string
    localPath?: string
  }>
}

interface FinalAsset {
  product_id: string
  product: string
  source_image_url: string
  final_file: string
  sha256: string
  notes: string
}

interface MergedDecision {
  product_id: string
  source_round: string
  comment: string
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }

  values.push(current)
  return values
}

function readCsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0)
  const header = parseCsvLine(lines[0] ?? "")
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]))
  })
}

function csvCell(value: unknown): string {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function candidateFiles(): string[] {
  const relativePaths =
    configuredCandidateFiles.length > 0
      ? configuredCandidateFiles
      : [
          "image-candidates.json",
          "fallback/image-candidates.json",
          "fallback2/image-candidates.json",
          "fallback3/image-candidates.json",
          "fallback4/image-candidates.json",
          "k18-clean/image-candidates.json",
        ]

  return relativePaths.map((relativePath) => join(batchDir, relativePath))
}

function buildSourcePageMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of candidateFiles()) {
    try {
      const results = readJson<CandidateResult[]>(file)
      for (const result of results) {
        for (const candidate of result.candidates) {
          map.set(candidate.url, result.product.affiliate_link)
          if (candidate.localPath) map.set(candidate.localPath, result.product.affiliate_link)
        }
      }
    } catch {
      // Optional fallback files do not always exist in early pilot runs.
    }
  }
  return map
}

function sourceTypeFor(url: string): ProductImageSourceType {
  const host = new URL(url).hostname.replace(/^www\./, "")
  if (/(epres|k18hair|olaplex)\./.test(host)) return "brand"
  if (/(amazon|ebay)\./.test(host)) return "marketplace"
  if (/(google|bing|duckduckgo)\./.test(host)) return "search_result"
  return "retailer"
}

function confidenceFor(sourceType: ProductImageSourceType): ProductImageQualityConfidence {
  return sourceType === "search_result" || sourceType === "unknown" ? "medium" : "high"
}

function main(): void {
  const products = readCsv(join(batchDir, "pilot-products.csv")) as unknown as PilotProduct[]
  const productsById = new Map(products.map((product) => [product.id, product]))
  const finalAssets = readJson<FinalAsset[]>(join(batchDir, "final-assets.json"))
  const decisions = readJson<MergedDecision[]>(join(batchDir, "merged-review-decisions.json"))
  const decisionsById = new Map(decisions.map((decision) => [decision.product_id, decision]))
  const sourcePageByImageUrl = buildSourcePageMap()

  if (finalAssets.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} final assets, found ${finalAssets.length}`)
  }

  const rows = finalAssets.map((asset) => {
    const product = productsById.get(asset.product_id)
    if (!product) throw new Error(`Missing product metadata for ${asset.product_id}`)

    const sourcePageUrl = sourcePageByImageUrl.get(asset.source_image_url) ?? product.affiliate_link
    const sourceType = sourceTypeFor(sourcePageUrl)
    const decision = decisionsById.get(asset.product_id)
    const notes = [
      "approved pilot image",
      decision?.source_round ? `source_round=${decision.source_round}` : "",
      decision?.comment ? `review_note=${decision.comment}` : "",
    ]
      .filter(Boolean)
      .join("; ")

    return {
      product_id: asset.product_id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      source_page_url: sourcePageUrl,
      source_image_url: asset.source_image_url,
      source_type: sourceType,
      quality_confidence: confidenceFor(sourceType),
      processing_method: "local" satisfies ProductImageProcessingMethod,
      final_file: asset.final_file,
      asset_sha256: asset.sha256,
      user_approved: "yes",
      notes,
    }
  })

  const csv = [
    MANIFEST_HEADER.join(","),
    ...rows.map((row) => MANIFEST_HEADER.map((key) => csvCell(row[key])).join(",")),
  ].join("\n")

  const manifestPath = join(batchDir, "manifest.csv")
  writeFileSync(manifestPath, `${csv}\n`)
  console.log(`Wrote ${manifestPath}`)
}

main()
