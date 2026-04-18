import type { Product, HairProfile } from "@/lib/types"
import { getCatalogConcernLabel } from "@/lib/product-specs/concern-taxonomy"

export function getPersonalizationSentence(
  product: Product,
  hairProfile: HairProfile | null,
): string | null {
  if (!hairProfile) return null

  const parts: string[] = []

  if (hairProfile.thickness && product.suitable_thicknesses?.includes(hairProfile.thickness)) {
    const labels: Record<string, string> = {
      fine: "feines",
      normal: "normales",
      coarse: "dickes",
    }
    parts.push(`dein ${labels[hairProfile.thickness] || hairProfile.thickness} Haar`)
  }

  const matchedConcerns = (hairProfile.concerns || []).filter((c) =>
    product.suitable_concerns?.includes(c),
  )
  if (matchedConcerns.length > 0) {
    parts.push(matchedConcerns.map(getCatalogConcernLabel).join(" & "))
  }

  if (parts.length === 0) return null

  return `Empfohlen für ${parts.join(" bei ")}`
}
