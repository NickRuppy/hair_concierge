export const PRODUCT_SPEC_RELATIONSHIP_BY_TABLE = {
  product_shampoo_specs: "product_shampoo_specs_product_category_fkey",
  product_leave_in_specs: "product_leave_in_specs_product_category_fkey",
  product_bondbuilder_specs: "product_bondbuilder_specs_product_category_fkey",
  product_mask_specs: "product_mask_specs_product_category_fkey",
  product_oil_specs: "product_oil_specs_product_category_fkey",
  product_heat_protectant_specs: "product_heat_protectant_specs_product_category_fkey",
  product_scalp_care_specs: "product_scalp_care_specs_product_category_fkey",
  product_dry_shampoo_specs: "product_dry_shampoo_specs_product_category_fkey",
  product_deep_cleansing_shampoo_specs:
    "product_deep_cleansing_shampoo_specs_product_category_fkey",
} as const

export type EmbeddedProductSpecTable = keyof typeof PRODUCT_SPEC_RELATIONSHIP_BY_TABLE

export function embedProductSpec(table: EmbeddedProductSpecTable, columns: string): string {
  return `${table}!${PRODUCT_SPEC_RELATIONSHIP_BY_TABLE[table]}(${columns})`
}

export const PRODUCT_APPLICATION_FACTS_SELECT = [
  "id",
  "image_url",
  "category",
  "category_key",
  "is_active",
  "lifecycle_status",
  "is_chaarlie_recommended",
  embedProductSpec(
    "product_leave_in_specs",
    "format,roles,provides_heat_protection,heat_protection_max_c,heat_activation_required,application_stage",
  ),
  embedProductSpec(
    "product_bondbuilder_specs",
    "application_mode,treatment_mode,product_format,usage_protocol",
  ),
  embedProductSpec("product_mask_specs", "weight,concentration,balance_direction"),
  embedProductSpec("product_oil_specs", "weight,role_support,provides_heat_protection"),
  embedProductSpec("product_heat_protectant_specs", "provides_heat_protection"),
  embedProductSpec("product_scalp_care_specs", "primary_role,presentation_format,rinse_mode"),
  embedProductSpec("product_dry_shampoo_specs", "format"),
].join(",")

export class CatalogDatabaseReadError extends Error {
  constructor() {
    super("catalog_database_read_failed")
    this.name = "CatalogDatabaseReadError"
  }
}
