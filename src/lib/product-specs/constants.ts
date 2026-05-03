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

export const PRODUCT_BOND_REPAIR_AXES = ["disulfide_crosslink", "peptide_chain"] as const

export type ProductBondRepairAxis = (typeof PRODUCT_BOND_REPAIR_AXES)[number]

export const PRODUCT_BOND_REPAIR_AXIS_LABELS = {
  disulfide_crosslink: "Disulfid-/Crosslink-Lane",
  peptide_chain: "Peptid-/Laengsstruktur-Lane",
} as const satisfies Record<ProductBondRepairAxis, string>

export const PRODUCT_BOND_APPLICATION_MODES = ["pre_shampoo", "post_wash_leave_in"] as const

export type ProductBondApplicationMode = (typeof PRODUCT_BOND_APPLICATION_MODES)[number]

export const PRODUCT_BOND_APPLICATION_MODE_LABELS = {
  pre_shampoo: "Vor dem Waschen",
  post_wash_leave_in: "Nach der Waesche / Leave-in",
} as const satisfies Record<ProductBondApplicationMode, string>

export const PRODUCT_BOND_TREATMENT_MODES = ["rinse_out", "leave_in"] as const

export type ProductBondTreatmentMode = (typeof PRODUCT_BOND_TREATMENT_MODES)[number]

export const PRODUCT_BOND_TREATMENT_MODE_LABELS = {
  rinse_out: "Wird ausgespuelt",
  leave_in: "Bleibt im Haar",
} as const satisfies Record<ProductBondTreatmentMode, string>

export const PRODUCT_BOND_PRODUCT_FORMATS = [
  "cream_treatment",
  "primer_treatment",
  "leave_in_mask",
  "spray_treatment",
] as const

export type ProductBondProductFormat = (typeof PRODUCT_BOND_PRODUCT_FORMATS)[number]

export const PRODUCT_BOND_PRODUCT_FORMAT_LABELS = {
  cream_treatment: "Creme-Treatment",
  primer_treatment: "Primer-Treatment",
  leave_in_mask: "Leave-in-Maske",
  spray_treatment: "Spray-Treatment",
} as const satisfies Record<ProductBondProductFormat, string>

export const PRODUCT_BOND_USAGE_PROTOCOLS = [
  "olaplex_3plus",
  "olaplex_0_booster",
  "olaplex_3_legacy",
  "k18_leave_in",
  "epres_spray",
] as const

export type ProductBondUsageProtocol = (typeof PRODUCT_BOND_USAGE_PROTOCOLS)[number]

export const PRODUCT_BOND_USAGE_PROTOCOL_LABELS = {
  olaplex_3plus: "OLAPLEX No.3PLUS",
  olaplex_0_booster: "OLAPLEX No.0 Booster",
  olaplex_3_legacy: "OLAPLEX No.3 Legacy",
  k18_leave_in: "K18 Leave-in",
  epres_spray: "Epres Spray",
} as const satisfies Record<ProductBondUsageProtocol, string>

export const PRODUCT_PEELING_TYPES = ["acid_serum", "physical_scrub"] as const

export type ProductPeelingType = (typeof PRODUCT_PEELING_TYPES)[number]

export const PRODUCT_PEELING_TYPE_LABELS = {
  acid_serum: "Saeure-Serum",
  physical_scrub: "Physisches Scrub",
} as const satisfies Record<ProductPeelingType, string>
