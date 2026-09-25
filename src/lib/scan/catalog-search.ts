import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"

/**
 * Shared catalog-search matcher used by both the web scan search route
 * (`src/app/api/scan/search/route.ts`) and the mobile scan search service
 * (`src/lib/mobile/scan-service.ts`). Extracted from mobile's identity-title matching
 * (shipped in PR #590) so both surfaces rank results the same way.
 *
 * Callers own loading candidate rows (with the `brands`/`product_lines` joins already
 * normalized to a single relation, not an array) and quarantine filtering; this module
 * only matches/ranks and shapes the shared result fields.
 */
export type CatalogSearchCandidate = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  sort_order: number | null
  brand_identity: { canonical_name: string | null } | null
  product_line: { canonical_name: string | null } | null
}

export type ScanSearchResult = {
  id: string
  name: string
  brand: string | null
  category: PersonalPlanCategory
  categoryLabel: string
  imageUrl: string | null
  /** The catalog product line, when the product has one — part of the display title. */
  productLine?: string | null
}

function identityParts(row: CatalogSearchCandidate) {
  return {
    brand: row.brand_identity?.canonical_name ?? row.brand,
    productLine: row.product_line?.canonical_name ?? null,
    name: row.name,
  }
}

function normalizedIdentityTitle(row: CatalogSearchCandidate): string {
  return composeProductIdentityTitle(identityParts(row)).toLocaleLowerCase()
}

const TOKEN_SEPARATOR = /[^\p{L}\p{N}]+/u
// Typo tolerance (F2): shorter tokens get none — with one edit a 2-char token matches
// almost every title token that merely starts with either of its letters.
const MIN_TYPO_TOKEN_LENGTH = 3
const SHORT_TOKEN_MAX_LENGTH = 5
// A typo'd, half-typed word ("kerasp" → "Kérastase") matches a title-word PREFIX only from
// this length on; shorter tokens compare whole words — with prefix matching a 3-letter
// token within 1 edit would hit every word sharing two of its letters ("oil" → "Olaplex").
const MIN_PREFIX_TYPO_TOKEN_LENGTH = 5

function tokenize(text: string): string[] {
  return text.split(TOKEN_SEPARATOR).filter(Boolean)
}

// Numbers are identities, not spellings: „100" must never find „200 ml", „no3" never
// „No. 4". A token with a digit — query or title side — only matches as a substring.
const HAS_DIGIT = /\p{N}/u

function typoBudget(token: string): number {
  if (token.length < MIN_TYPO_TOKEN_LENGTH || HAS_DIGIT.test(token)) return 0
  return token.length <= SHORT_TOKEN_MAX_LENGTH ? 1 : 2
}

/**
 * Optimal-string-alignment (restricted Damerau-Levenshtein) distance from `query` to
 * `target` — or, with `prefix`, to the closest PREFIX of `target` (the full target
 * included), so a typo in a half-typed token still matches. Returns early once every cell
 * of a row exceeds `budget`, keeping the ~350-row scan cheap.
 */
function editDistance(query: string, target: string, budget: number, prefix: boolean): number {
  const width = target.length + 1
  let twoBack: number[] = []
  let previous = Array.from({ length: width }, (_, column) => column)
  for (let row = 1; row <= query.length; row += 1) {
    const current = [row]
    let rowMin = row
    for (let column = 1; column < width; column += 1) {
      const cost = query[row - 1] === target[column - 1] ? 0 : 1
      let value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      )
      if (
        row > 1 &&
        column > 1 &&
        query[row - 1] === target[column - 2] &&
        query[row - 2] === target[column - 1]
      ) {
        value = Math.min(value, twoBack[column - 2] + 1)
      }
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > budget) return rowMin
    twoBack = previous
    previous = current
  }
  return prefix ? Math.min(...previous) : previous[width - 1]
}

/** 0 exact title, 1 whole-query substring, 2 every token a substring, 3 needs a typo edit. */
type MatchTier = 0 | 1 | 2 | 3

function matchTier(title: string, titleTokens: string[], query: string): MatchTier | null {
  if (title === query) return 0
  if (title.includes(query)) return 1
  let needsTypo = false
  for (const token of tokenize(query)) {
    if (titleTokens.some((titleToken) => titleToken.includes(token))) continue
    const budget = typoBudget(token)
    const prefix = token.length >= MIN_PREFIX_TYPO_TOKEN_LENGTH
    if (
      budget === 0 ||
      !titleTokens.some(
        (titleToken) =>
          !HAS_DIGIT.test(titleToken) && editDistance(token, titleToken, budget, prefix) <= budget,
      )
    ) {
      return null
    }
    needsTypo = true
  }
  return needsTypo ? 3 : 2
}

/**
 * Match over the composed product identity title (brand + product line + name,
 * de-duplicated), in tiers: exact title → whole-query substring (the original matcher,
 * still the strongest signal) → every query token found in some title token → the same
 * with typo tolerance (F2: Damerau-Levenshtein, 1 edit for tokens ≤ 5 chars, 2 above).
 * Within a tier: sort_order → localeCompare(de) → id.
 */
export function matchCatalogProducts(
  rows: CatalogSearchCandidate[],
  query: string,
): CatalogSearchCandidate[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches: Array<{ row: CatalogSearchCandidate; tier: MatchTier }> = []
  for (const row of rows) {
    const title = normalizedIdentityTitle(row)
    const tier = matchTier(title, tokenize(title), normalizedQuery)
    if (tier !== null) matches.push({ row, tier })
  }

  matches.sort(
    ({ row: left, tier: leftTier }, { row: right, tier: rightTier }) =>
      leftTier - rightTier ||
      (left.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (right.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name, "de") ||
      left.id.localeCompare(right.id),
  )

  return matches.map((match) => match.row)
}

export function toScanSearchResult(row: CatalogSearchCandidate): ScanSearchResult {
  return {
    id: row.id,
    name: row.name,
    brand: identityParts(row).brand,
    category: row.category_key as PersonalPlanCategory,
    categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
    imageUrl: row.image_url,
    productLine: identityParts(row).productLine,
  }
}

/**
 * Whether one displayed row (brand + line + name) matches `query` with the same tiers as
 * `matchCatalogProducts`. The search sheet uses it to keep only still-matching rows on
 * screen while a new query's response is pending (batch 8).
 */
export function identityMatchesQuery(
  parts: { brand: string | null; productLine?: string | null; name: string },
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return false
  const title = composeProductIdentityTitle({
    brand: parts.brand,
    productLine: parts.productLine ?? null,
    name: parts.name,
  }).toLocaleLowerCase()
  return matchTier(title, tokenize(title), normalizedQuery) !== null
}
