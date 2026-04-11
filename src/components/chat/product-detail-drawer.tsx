"use client"

import type { Product, HairProfile } from "@/lib/types"
import { getPersonalizationSentence } from "@/lib/product-utils"
import { SHAMPOO_BUCKET_LABELS } from "@/lib/shampoo/constants"
import {
  HAIR_TEXTURE_LABELS,
  HAIR_THICKNESS_LABELS,
  HAIR_DENSITY_LABELS,
  PROTEIN_MOISTURE_LABELS,
  CUTICLE_CONDITION_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  CHEMICAL_TREATMENT_LABELS,
} from "@/lib/vocabulary"
import {
  CONDITIONER_WEIGHT_LABELS,
  CONDITIONER_REPAIR_LEVEL_LABELS,
} from "@/lib/conditioner/constants"
import {
  LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS,
  LEAVE_IN_NEED_BUCKET_LABELS,
  LEAVE_IN_STYLING_CONTEXT_LABELS,
  LEAVE_IN_WEIGHT_LABELS,
} from "@/lib/leave-in/constants"
import {
  OIL_SUBTYPE_LABELS,
  OIL_USE_MODE_LABELS,
} from "@/lib/oil/constants"
import { ProductImage } from "./product-image"
import { Badge } from "@/components/ui/badge"
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { ExternalLink } from "lucide-react"

interface ProductDetailDrawerProps {
  product: Product | null
  hairProfile: HairProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductDetailDrawer({
  product,
  hairProfile,
  open,
  onOpenChange,
}: ProductDetailDrawerProps) {
  if (!product) return null

  const personalization = getPersonalizationSentence(product, hairProfile)
  const description = product.short_description || product.description

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader className="gap-4 pb-4">
          <ProductImage
            imageUrl={product.image_url}
            category={product.category}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            {product.brand && (
              <p className="text-sm font-medium text-muted-foreground">
                {product.brand}
              </p>
            )}
            <BottomSheetTitle className="text-lg">{product.name}</BottomSheetTitle>
            {product.category && (
              <Badge variant="secondary" className="mt-2">
                {product.category}
              </Badge>
            )}
          </div>
        </BottomSheetHeader>

        <div className="space-y-4 pt-2">
          {/* Personalization */}
          {personalization && (
            <div className="rounded-lg bg-primary/10 px-4 py-3">
              <p className="text-sm font-medium text-primary">
                {personalization}
              </p>
            </div>
          )}

          {product.recommendation_meta && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Empfehlungskontext
              </p>
              <p className="text-sm font-medium text-foreground">
                Score: {product.recommendation_meta.score.toFixed(1)}
              </p>
              {product.recommendation_meta.top_reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Warum passend</p>
                  <ul className="mt-1 space-y-1">
                    {product.recommendation_meta.top_reasons.map((reason) => (
                      <li key={reason} className="text-sm text-foreground">
                        - {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {product.recommendation_meta.tradeoffs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Trade-offs</p>
                  <ul className="mt-1 space-y-1">
                    {product.recommendation_meta.tradeoffs.map((tradeoff) => (
                      <li key={tradeoff} className="text-sm text-foreground">
                        - {tradeoff}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {product.recommendation_meta.usage_hint && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Anwendung</p>
                  <p className="text-sm text-foreground">
                    {product.recommendation_meta.usage_hint}
                  </p>
                </div>
              )}
              {product.recommendation_meta.category === "shampoo" && (
                <>
                  {product.recommendation_meta.matched_bucket && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Shampoo-Bucket</p>
                      <p className="text-sm text-foreground">
                        {SHAMPOO_BUCKET_LABELS[product.recommendation_meta.matched_bucket]}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Profil-Match</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {product.recommendation_meta.matched_profile.thickness && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_THICKNESS_LABELS[product.recommendation_meta.matched_profile.thickness]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.scalp_type && (
                        <Badge variant="outline" className="text-xs">
                          {SCALP_TYPE_LABELS[product.recommendation_meta.matched_profile.scalp_type]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.scalp_condition &&
                        product.recommendation_meta.matched_profile.scalp_condition !== "none" && (
                          <Badge variant="outline" className="text-xs">
                            {SCALP_CONDITION_LABELS[product.recommendation_meta.matched_profile.scalp_condition]}
                          </Badge>
                        )}
                    </div>
                  </div>
                </>
              )}
              {product.recommendation_meta.category === "conditioner" && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {product.recommendation_meta.matched_balance_need && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Pflegefokus</p>
                        <p className="text-sm text-foreground">
                          {product.recommendation_meta.matched_balance_need === "moisture" && "Feuchtigkeit"}
                          {product.recommendation_meta.matched_balance_need === "balanced" && "Ausgewogene Pflege"}
                          {product.recommendation_meta.matched_balance_need === "protein" && "Protein"}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.matched_weight && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Gewicht</p>
                        <p className="text-sm text-foreground">
                          {CONDITIONER_WEIGHT_LABELS[product.recommendation_meta.matched_weight]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.matched_repair_level && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Repair-Level</p>
                        <p className="text-sm text-foreground">
                          {CONDITIONER_REPAIR_LEVEL_LABELS[product.recommendation_meta.matched_repair_level]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.matched_profile.protein_moisture_balance && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Zugtest</p>
                        <p className="text-sm text-foreground">
                          {PROTEIN_MOISTURE_LABELS[product.recommendation_meta.matched_profile.protein_moisture_balance]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Profil-Match</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {product.recommendation_meta.matched_profile.thickness && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_THICKNESS_LABELS[product.recommendation_meta.matched_profile.thickness]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.density && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_DENSITY_LABELS[product.recommendation_meta.matched_profile.density]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.cuticle_condition && (
                        <Badge variant="outline" className="text-xs">
                          {CUTICLE_CONDITION_LABELS[product.recommendation_meta.matched_profile.cuticle_condition]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.chemical_treatment.map((treatment) => (
                        <Badge key={treatment} variant="outline" className="text-xs">
                          {CHEMICAL_TREATMENT_LABELS[treatment] ?? treatment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {product.recommendation_meta.category === "leave_in" && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {product.recommendation_meta.need_bucket && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Pflegefokus</p>
                        <p className="text-sm text-foreground">
                          {LEAVE_IN_NEED_BUCKET_LABELS[product.recommendation_meta.need_bucket]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.styling_context && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Styling-Kontext</p>
                        <p className="text-sm text-foreground">
                          {LEAVE_IN_STYLING_CONTEXT_LABELS[product.recommendation_meta.styling_context]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.conditioner_relationship && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Conditioner-Rolle</p>
                        <p className="text-sm text-foreground">
                          {LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[product.recommendation_meta.conditioner_relationship]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.matched_weight && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Gewicht</p>
                        <p className="text-sm text-foreground">
                          {LEAVE_IN_WEIGHT_LABELS[product.recommendation_meta.matched_weight]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Profil-Match</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {product.recommendation_meta.matched_profile.hair_texture && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_TEXTURE_LABELS[product.recommendation_meta.matched_profile.hair_texture]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.thickness && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_THICKNESS_LABELS[product.recommendation_meta.matched_profile.thickness]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.density && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_DENSITY_LABELS[product.recommendation_meta.matched_profile.density]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.cuticle_condition && (
                        <Badge variant="outline" className="text-xs">
                          {CUTICLE_CONDITION_LABELS[product.recommendation_meta.matched_profile.cuticle_condition]}
                        </Badge>
                      )}
                      {product.recommendation_meta.matched_profile.chemical_treatment.map((treatment) => (
                        <Badge key={treatment} variant="outline" className="text-xs">
                          {CHEMICAL_TREATMENT_LABELS[treatment] ?? treatment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {product.recommendation_meta.category === "oil" && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {product.recommendation_meta.matched_subtype && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Oel-Typ</p>
                        <p className="text-sm text-foreground">
                          {OIL_SUBTYPE_LABELS[product.recommendation_meta.matched_subtype]}
                        </p>
                      </div>
                    )}
                    {product.recommendation_meta.use_mode && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Anwendung</p>
                        <p className="text-sm text-foreground">
                          {OIL_USE_MODE_LABELS[product.recommendation_meta.use_mode]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Profil-Match</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {product.recommendation_meta.matched_profile.thickness && (
                        <Badge variant="outline" className="text-xs">
                          {HAIR_THICKNESS_LABELS[product.recommendation_meta.matched_profile.thickness]}
                        </Badge>
                      )}
                      {product.recommendation_meta.adjunct_scalp_support && (
                        <Badge variant="outline" className="text-xs">
                          Kopfhaut-supportiv
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Short product note */}
          {product.tom_take && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kurze Einordnung
              </p>
              <p className="text-sm italic text-foreground">
                &ldquo;{product.tom_take}&rdquo;
              </p>
            </div>
          )}

          {/* Description */}
          {description && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beschreibung
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}

          {/* Hair types */}
          {product.suitable_thicknesses?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Geeignete Haardicke
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.suitable_thicknesses.map((ht) => (
                  <Badge key={ht} variant="outline" className="text-xs">
                    {HAIR_THICKNESS_LABELS[ht as keyof typeof HAIR_THICKNESS_LABELS] ?? ht}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {product.suitable_concerns?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hilft bei
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.suitable_concerns.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {OIL_SUBTYPE_LABELS[c as keyof typeof OIL_SUBTYPE_LABELS] ?? c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Price + affiliate link */}
          {(product.price_eur || product.affiliate_link) && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              {product.price_eur && (
                <span className="text-lg font-bold text-primary">
                  {product.price_eur.toFixed(2)} \u20AC
                </span>
              )}
              {product.affiliate_link && (
                <a
                  href={product.affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Kaufen
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
