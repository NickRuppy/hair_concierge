import type { JsonRecord } from "@chaarlie/product-intake-core"

export type ReviewPropertyRow = {
  label: string
  value: string
}

const SPEC_TABLE_ORDER = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_mask_specs",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
  "product_dry_shampoo_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_bondbuilder_specs",
] as const

const SPEC_TABLE_COLUMNS: Record<(typeof SPEC_TABLE_ORDER)[number], string[]> = {
  product_shampoo_specs: ["thickness", "shampoo_bucket", "scalp_route", "cleansing_intensity"],
  product_conditioner_specs: ["thickness", "protein_moisture_balance"],
  product_conditioner_rerank_specs: [
    "weight",
    "repair_level",
    "balance_direction",
    "ingredient_flags",
  ],
  product_mask_specs: ["weight", "concentration", "balance_direction", "ingredient_flags"],
  product_leave_in_specs: [
    "format",
    "weight",
    "roles",
    "provides_heat_protection",
    "heat_protection_max_c",
    "heat_activation_required",
    "care_benefits",
    "ingredient_flags",
    "application_stage",
  ],
  product_leave_in_fit_specs: ["weight", "conditioner_relationship", "care_benefits"],
  product_leave_in_eligibility: ["thickness", "need_bucket", "styling_context"],
  product_oil_eligibility: ["thickness", "oil_subtype", "oil_purpose", "ingredient_flags"],
  product_dry_shampoo_specs: [
    "primary_effect",
    "hair_color_fit",
    "scalp_sensitivity_fit",
    "format",
  ],
  product_deep_cleansing_shampoo_specs: [
    "scalp_type_focus",
    "reset_intensity",
    "reset_focus",
    "color_treated_suitability",
  ],
  product_bondbuilder_specs: [
    "bond_repair_intensity",
    "application_mode",
    "bond_repair_axis",
    "treatment_mode",
    "product_format",
    "usage_protocol",
  ],
}

const PRODUCT_FIELD_ORDER = [
  "name",
  "brand",
  "category_key",
  "affiliate_link",
  "image_url",
  "price_eur",
  "currency",
  "purchase_link_status",
  "purchase_link_checked_at",
  "price_checked_at",
] as const

export function buildReviewPropertyRows(
  product: JsonRecord | null,
  categorySpecs: JsonRecord | null,
  identifiers: unknown,
): ReviewPropertyRow[] {
  return [
    ...buildProductRows(product),
    ...buildIdentifierRows(identifiers),
    ...buildCategorySpecRows(categorySpecs),
  ]
}

function buildProductRows(product: JsonRecord | null): ReviewPropertyRow[] {
  if (!product) return []

  const rows: ReviewPropertyRow[] = []
  const values: Record<(typeof PRODUCT_FIELD_ORDER)[number], unknown> = {
    name: productNameForDatabase(product),
    brand: product.canonical_brand,
    category_key: product.category_key,
    affiliate_link: product.affiliate_link,
    image_url: product.image_url,
    price_eur: product.price_eur,
    currency: product.currency,
    purchase_link_status: product.purchase_link_status,
    purchase_link_checked_at: product.purchase_link_checked_at,
    price_checked_at: product.price_checked_at,
  }

  for (const field of PRODUCT_FIELD_ORDER) {
    pushRow(rows, `products.${field}`, values[field])
  }

  return rows
}

function productNameForDatabase(product: JsonRecord): string | null {
  const parts = [
    stringValue(product.canonical_brand),
    stringValue(product.product_line),
    stringValue(product.clean_name),
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(" ") : null
}

function buildIdentifierRows(identifiers: unknown): ReviewPropertyRow[] {
  if (!Array.isArray(identifiers)) return []

  return identifiers.flatMap((identifier, index) => {
    const record = recordValue(identifier)
    if (!record) return []

    const rows: ReviewPropertyRow[] = []
    pushRow(rows, `product_identifiers[${index}].identifier_type`, record.type)
    pushRow(rows, `product_identifiers[${index}].identifier_value`, record.value)
    pushRow(rows, `product_identifiers[${index}].source`, record.source ?? "user_submitted")
    return rows
  })
}

function buildCategorySpecRows(categorySpecs: JsonRecord | null): ReviewPropertyRow[] {
  if (!categorySpecs) return []

  const rows: ReviewPropertyRow[] = []

  for (const table of SPEC_TABLE_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(categorySpecs, table)) continue
    const value = categorySpecs[table]
    const records = categorySpecRecords(value)

    records.forEach((item, rowIndex) => {
      const record = recordValue(item)
      if (!record) return

      for (const field of SPEC_TABLE_COLUMNS[table]) {
        pushRow(
          rows,
          `${table}[${rowIndex}].${field}`,
          specValue(table, record, field, categorySpecs),
        )
      }
    })
  }

  return rows
}

function categorySpecRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = recordValue(value)
  if (record && Array.isArray(record.rows)) return record.rows
  return [value]
}

function specValue(
  table: (typeof SPEC_TABLE_ORDER)[number],
  record: JsonRecord,
  field: string,
  categorySpecs: JsonRecord,
) {
  if (Object.prototype.hasOwnProperty.call(record, field)) return record[field]
  if (
    table === "product_shampoo_specs" &&
    (field === "scalp_route" || field === "cleansing_intensity") &&
    Object.prototype.hasOwnProperty.call(categorySpecs, field)
  ) {
    return categorySpecs[field]
  }
  return null
}

function pushRow(rows: ReviewPropertyRow[], label: string, value: unknown) {
  const formatted = formatDatabaseValue(value)
  if (formatted === null) return
  rows.push({ label, value: formatted })
}

function formatDatabaseValue(value: unknown): string | null {
  if (value === null) return "null"
  if (typeof value === "string") return value.trim().length > 0 ? value : null
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value) || recordValue(value)) return JSON.stringify(value)
  return null
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}
