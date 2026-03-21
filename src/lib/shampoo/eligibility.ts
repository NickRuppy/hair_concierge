import { HAIR_THICKNESSES, type HairThickness } from "@/lib/vocabulary"
import {
  SHAMPOO_BUCKETS,
  type ShampooBucket,
  type ShampooBucketPair,
  isShampooCategory,
} from "@/lib/shampoo/constants"

export interface ShampooBucketPairInput {
  thickness: string
  shampoo_bucket?: string
  concern?: string
}

export interface ShampooEligibilitySource {
  name?: string
  category?: string | null
  suitable_thicknesses?: string[]
  suitable_hair_textures?: string[]
  suitable_concerns?: string[]
  shampoo_bucket_pairs?: ShampooBucketPairInput[]
}

function sortShampooPairs(pairs: ShampooBucketPair[]): ShampooBucketPair[] {
  return [...pairs].sort((a, b) => {
    const thicknessDiff = HAIR_THICKNESSES.indexOf(a.thickness) - HAIR_THICKNESSES.indexOf(b.thickness)
    if (thicknessDiff !== 0) return thicknessDiff

    return SHAMPOO_BUCKETS.indexOf(a.shampoo_bucket) - SHAMPOO_BUCKETS.indexOf(b.shampoo_bucket)
  })
}

function dedupeShampooPairs(pairs: ShampooBucketPair[]): ShampooBucketPair[] {
  const uniquePairs = new Map<string, ShampooBucketPair>()

  for (const pair of pairs) {
    uniquePairs.set(`${pair.thickness}|${pair.shampoo_bucket}`, pair)
  }

  return sortShampooPairs([...uniquePairs.values()])
}

function getProductLabel(product: ShampooEligibilitySource): string {
  return product.name ? `Shampoo "${product.name}"` : "Shampoo"
}

function normalizeThickness(value: string, product: ShampooEligibilitySource, sourceLabel: string): HairThickness {
  const normalizedValue = value.trim()
  if (HAIR_THICKNESSES.includes(normalizedValue as HairThickness)) {
    return normalizedValue as HairThickness
  }

  throw new Error(
    `${getProductLabel(product)} hat eine ungueltige Haardicke in ${sourceLabel}: "${value}".`
  )
}

function normalizeBucket(value: string, product: ShampooEligibilitySource, sourceLabel: string): ShampooBucket {
  const normalizedValue = value.trim()
  if (SHAMPOO_BUCKETS.includes(normalizedValue as ShampooBucket)) {
    return normalizedValue as ShampooBucket
  }

  throw new Error(
    `${getProductLabel(product)} hat einen ungueltigen Shampoo-Bucket in ${sourceLabel}: "${value}".`
  )
}

export function normalizeShampooBucketPairs(product: ShampooEligibilitySource): ShampooBucketPair[] {
  if (!isShampooCategory(product.category)) return []

  const explicitPairs = product.shampoo_bucket_pairs ?? []
  if (explicitPairs.length > 0) {
    const normalizedPairs = explicitPairs.map((pair, index) => {
      const rawBucket = pair.shampoo_bucket ?? pair.concern
      if (!rawBucket?.trim()) {
        throw new Error(
          `${getProductLabel(product)} hat ein unvollstaendiges Exact-Pair in shampoo_bucket_pairs[${index}].`
        )
      }

      return {
        thickness: normalizeThickness(pair.thickness, product, `shampoo_bucket_pairs[${index}].thickness`),
        shampoo_bucket: normalizeBucket(rawBucket, product, `shampoo_bucket_pairs[${index}]`),
      }
    })

    return dedupeShampooPairs(normalizedPairs)
  }

  const thicknesses = (product.suitable_thicknesses?.length
    ? product.suitable_thicknesses
    : product.suitable_hair_textures ?? [])
    .map((value) => normalizeThickness(value, product, "suitable_thicknesses"))
  const buckets = (product.suitable_concerns ?? [])
    .map((value) => normalizeBucket(value, product, "suitable_concerns"))

  if (thicknesses.length === 0 || buckets.length === 0) {
    throw new Error(
      `${getProductLabel(product)} braucht entweder shampoo_bucket_pairs oder gueltige suitable_thicknesses + suitable_concerns.`
    )
  }

  return dedupeShampooPairs(
    thicknesses.flatMap((thickness) =>
      buckets.map((shampoo_bucket) => ({
        thickness,
        shampoo_bucket,
      }))
    )
  )
}

export function mapShampooPairsToMetadata(
  pairs: ShampooBucketPair[]
): Array<{ thickness: string; concern: string }> {
  return pairs.map((pair) => ({
    thickness: pair.thickness,
    concern: pair.shampoo_bucket,
  }))
}
