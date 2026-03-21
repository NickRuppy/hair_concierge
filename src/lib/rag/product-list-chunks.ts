import {
  mapShampooPairsToMetadata,
  normalizeShampooBucketPairs,
  type ShampooBucketPairInput,
} from "@/lib/shampoo/eligibility"
import { isShampooCategory } from "@/lib/shampoo/constants"

const CONCERN_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  irritationen: "Kopfhautirritationen",
  normal: "normale Pflege",
  "dehydriert-fettig": "dehydrierte oder fettige Kopfhaut",
  trocken: "trockene Kopfhaut",
  protein: "Proteinbedarf",
  feuchtigkeit: "Feuchtigkeitsbedarf",
  performance: "Performance-Pflege",
  nix: "allgemeine Pflege (keine besonderen Probleme)",
  "natuerliches-oel": "natuerliche Oelpflege",
  stylingoel: "Styling mit Oel",
  trockenoel: "Trockenoel-Pflege",
}

const THICKNESS_LABELS: Record<string, string> = {
  fine: "feines Haar",
  normal: "mittelstarkes Haar (normale Haardicke)",
  coarse: "dickes Haar",
}

export interface ProductListChunkProduct {
  name: string
  brand?: string
  category?: string
  suitable_thicknesses?: string[]
  suitable_hair_textures?: string[]
  suitable_concerns?: string[]
  shampoo_bucket_pairs?: ShampooBucketPairInput[]
  tags?: string[]
}

export interface ProductListChunkData {
  content: string
  sourceName: string
  chunkIndex: number
  metadata: Record<string, unknown>
}

function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-")
}

function uniqueValues(values: string[] | undefined, fallback: string): string[] {
  const cleaned = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
  return cleaned.length > 0 ? cleaned : [fallback]
}

export function buildProductListChunks(
  allProducts: ProductListChunkProduct[]
): ProductListChunkData[] {
  const groups = new Map<string, ProductListChunkProduct[]>()

  for (const product of allProducts) {
    const category = product.category || "Sonstiges"
    if (isShampooCategory(category)) {
      const normalizedPairs = mapShampooPairsToMetadata(normalizeShampooBucketPairs(product))
      for (const pair of normalizedPairs) {
        const key = `${category}|${pair.thickness}|${pair.concern}`
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(product)
      }
      continue
    }

    const thicknesses = uniqueValues(product.suitable_thicknesses, "alle")
    const concerns = uniqueValues(product.suitable_concerns, "allgemein")

    for (const thickness of thicknesses) {
      for (const concern of concerns) {
        const key = `${category}|${thickness}|${concern}`
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(product)
      }
    }
  }

  const chunks: ProductListChunkData[] = []
  let chunkIndex = 0

  for (const [key, products] of groups) {
    const [category, thickness, concern] = key.split("|")
    const thicknessLabel = THICKNESS_LABELS[thickness] || thickness
    const concernLabel = CONCERN_LABELS[concern] || concern

    const productLines = products.map((product) => {
      if (product.brand && product.brand !== product.name) {
        return `- ${product.name} (${product.brand})`
      }
      return `- ${product.name}`
    })

    const content =
      `Toms Produktempfehlungen: ${category} fuer ${thicknessLabel} bei ${concernLabel}\n\n` +
      `Folgende ${category}-Produkte empfiehlt Tom Hannemann fuer Menschen mit ${thicknessLabel} ` +
      `und dem Anliegen "${concernLabel}":\n\n` +
      productLines.join("\n") +
      `\n\nInsgesamt ${products.length} empfohlene Produkte in dieser Kategorie.`

    chunks.push({
      content,
      sourceName: `produktmatrix/${slugifyCategory(category)}`,
      chunkIndex: chunkIndex++,
      metadata: {
        category,
        thickness,
        concern,
        product_count: products.length,
        product_names: products.map((product) => product.name),
        language: "de",
      },
    })
  }

  return chunks
}
