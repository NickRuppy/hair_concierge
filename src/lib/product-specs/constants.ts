export const PRODUCT_BALANCE_TARGETS = ["protein", "moisture", "balanced"] as const

export type ProductBalanceTarget = (typeof PRODUCT_BALANCE_TARGETS)[number]

export const PRODUCT_BALANCE_TARGET_LABELS = {
  protein: "Protein",
  moisture: "Feuchtigkeit",
  balanced: "Ausgewogen",
} as const satisfies Record<ProductBalanceTarget, string>

export const PRODUCT_SCALP_TYPE_FOCUSES = ["oily", "balanced", "dry"] as const

export type ProductScalpTypeFocus = (typeof PRODUCT_SCALP_TYPE_FOCUSES)[number]

export const PRODUCT_SCALP_TYPE_FOCUS_LABELS = {
  oily: "Fettig",
  balanced: "Ausgeglichen",
  dry: "Trocken",
} as const satisfies Record<ProductScalpTypeFocus, string>

export const PRODUCT_BOND_REPAIR_INTENSITIES = ["maintenance", "intensive"] as const

export type ProductBondRepairIntensity = (typeof PRODUCT_BOND_REPAIR_INTENSITIES)[number]

export const PRODUCT_BOND_REPAIR_INTENSITY_LABELS = {
  maintenance: "Erhaltung",
  intensive: "Intensiv",
} as const satisfies Record<ProductBondRepairIntensity, string>

export const PRODUCT_BOND_APPLICATION_MODES = ["pre_shampoo", "post_wash_leave_in"] as const

export type ProductBondApplicationMode = (typeof PRODUCT_BOND_APPLICATION_MODES)[number]

export const PRODUCT_BOND_APPLICATION_MODE_LABELS = {
  pre_shampoo: "Vor dem Waschen",
  post_wash_leave_in: "Nach der Waesche / Leave-in",
} as const satisfies Record<ProductBondApplicationMode, string>

export const PRODUCT_PEELING_TYPES = ["acid_serum", "physical_scrub"] as const

export type ProductPeelingType = (typeof PRODUCT_PEELING_TYPES)[number]

export const PRODUCT_PEELING_TYPE_LABELS = {
  acid_serum: "Saeure-Serum",
  physical_scrub: "Physisches Scrub",
} as const satisfies Record<ProductPeelingType, string>
