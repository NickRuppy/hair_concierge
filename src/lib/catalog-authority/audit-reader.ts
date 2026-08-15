import {
  CATALOG_AUTHORITY_SCHEMA_VERSION,
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  catalogAuthorityAuditSnapshotSchema,
  type CatalogAuthorityAuditSnapshot,
  type CatalogAuditFactRow,
  type CatalogAuditProduct,
  type CatalogAuditSchemaObject,
  type PersonalPlanCategory,
} from "./contracts"

type Row = Record<string, unknown>

export type CatalogAuditReadRequest = {
  table: string
  orderBy: readonly string[]
}

export type CatalogAuditReadResult = {
  rows: Row[]
  exactCount: number
}

export type CatalogAuditDataSource = {
  readAll(request: CatalogAuditReadRequest): Promise<CatalogAuditReadResult>
}

const FACT_TABLES = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_heat_protectant_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_mask_specs",
  "product_scalp_care_specs",
  "product_dry_shampoo_specs",
  "product_bondbuilder_specs",
  "product_deep_cleansing_shampoo_specs",
] as const

const ELIGIBILITY_TABLES = ["product_thickness_eligibility", "product_concern_eligibility"] as const

const TABLE_CATEGORY: Record<(typeof FACT_TABLES)[number], PersonalPlanCategory> = {
  product_shampoo_specs: "shampoo",
  product_conditioner_specs: "conditioner",
  product_conditioner_rerank_specs: "conditioner",
  product_leave_in_specs: "leave_in",
  product_leave_in_fit_specs: "leave_in",
  product_leave_in_eligibility: "leave_in",
  product_heat_protectant_specs: "heat_protectant",
  product_oil_specs: "oil",
  product_oil_eligibility: "oil",
  product_mask_specs: "mask",
  product_scalp_care_specs: "scalp_care",
  product_dry_shampoo_specs: "dry_shampoo",
  product_bondbuilder_specs: "bondbuilder",
  product_deep_cleansing_shampoo_specs: "deep_cleansing_shampoo",
}

const FACT_ORDER: Record<(typeof FACT_TABLES)[number], readonly string[]> = {
  product_shampoo_specs: ["product_id", "thickness", "shampoo_bucket"],
  product_conditioner_specs: ["product_id", "thickness", "protein_moisture_balance"],
  product_conditioner_rerank_specs: ["product_id"],
  product_leave_in_specs: ["product_id"],
  product_leave_in_fit_specs: ["product_id"],
  product_leave_in_eligibility: ["product_id", "thickness", "need_bucket", "styling_context"],
  product_heat_protectant_specs: ["product_id"],
  product_oil_specs: ["product_id"],
  product_oil_eligibility: ["product_id", "thickness", "oil_subtype"],
  product_mask_specs: ["product_id"],
  product_scalp_care_specs: ["product_id"],
  product_dry_shampoo_specs: ["product_id"],
  product_bondbuilder_specs: ["product_id"],
  product_deep_cleansing_shampoo_specs: ["product_id"],
}

const READ_REQUESTS: readonly CatalogAuditReadRequest[] = [
  { table: "products", orderBy: ["id"] },
  {
    table: "product_thickness_eligibility",
    orderBy: ["product_id", "category_key", "thickness"],
  },
  {
    table: "product_concern_eligibility",
    orderBy: ["product_id", "category_key", "concern_key"],
  },
  ...FACT_TABLES.map((table) => ({ table, orderBy: FACT_ORDER[table] })),
  {
    table: "product_application_protocols",
    orderBy: ["product_id", "category", "role", "application_family"],
  },
  { table: "application_guidance_protocols", orderBy: ["product_id", "id"] },
  {
    table: "personal_plan_catalog_fact_evidence",
    orderBy: ["product_id", "fact_key", "source_url"],
  },
  { table: "personal_plan_product_search_dispositions", orderBy: ["product_id"] },
]

export async function readCatalogAuthorityAuditSnapshot(
  source: CatalogAuditDataSource,
  options: {
    inspectedAt?: string
    schemaObjects?: CatalogAuditSchemaObject[] | null
  } = {},
): Promise<CatalogAuthorityAuditSnapshot> {
  const entries = await Promise.all(
    READ_REQUESTS.map(async (request) => [request.table, await source.readAll(request)] as const),
  )
  const results = new Map(entries)
  const rows = new Map([...results].map(([table, result]) => [table, result.rows] as const))
  const factRowsByTable = new Map(
    FACT_TABLES.map((table) => [table, rows.get(table) ?? []] as const),
  )
  const facts = [
    ...FACT_TABLES.flatMap((table) =>
      (factRowsByTable.get(table) ?? []).flatMap((row) => normalizeFactRow(table, row)),
    ),
    ...ELIGIBILITY_TABLES.flatMap((table) =>
      (rows.get(table) ?? []).flatMap((row) => normalizeEligibilityRow(table, row)),
    ),
  ]
  const dispositionedIds = new Set(
    (rows.get("personal_plan_product_search_dispositions") ?? [])
      .map((row) => text(row.product_id))
      .filter((value): value is string => value !== null),
  )
  const products = (rows.get("products") ?? []).flatMap((row) =>
    normalizeProduct(row, factRowsByTable, dispositionedIds),
  )
  const snapshot = {
    schemaVersion: CATALOG_AUTHORITY_SCHEMA_VERSION,
    inspectedAt: options.inspectedAt ?? new Date().toISOString(),
    products,
    facts,
    protocols: (rows.get("product_application_protocols") ?? []).flatMap(normalizeProtocol),
    guidance: (rows.get("application_guidance_protocols") ?? []).flatMap((row) => {
      const id = text(row.id)
      const categoryKey = text(row.category_key)
      const scopeKind = text(row.scope_kind)
      const status = text(row.status)
      if (!id || !categoryKey || !scopeKind || !status) return []
      return [
        {
          id,
          scopeKind,
          productId: text(row.product_id),
          categoryKey,
          roleKey: text(row.role_key),
          status,
        },
      ]
    }),
    evidence: (rows.get("personal_plan_catalog_fact_evidence") ?? []).flatMap((row) => {
      const productId = text(row.product_id)
      const factKey = text(row.fact_key)
      if (!productId || !factKey) return []
      return [
        {
          productId,
          factKey,
          sourceUrl: text(row.source_url),
          contentFingerprint: text(row.content_fingerprint),
        },
      ]
    }),
    rowCounts: Object.fromEntries(
      READ_REQUESTS.map((request) => [request.table, results.get(request.table)?.exactCount ?? 0]),
    ),
    schemaObjects: options.schemaObjects ?? null,
  }
  return catalogAuthorityAuditSnapshotSchema.parse(snapshot)
}

export function catalogAuthorityAuditReadRequests(): CatalogAuditReadRequest[] {
  return READ_REQUESTS.map((request) => ({ ...request, orderBy: [...request.orderBy] }))
}

function normalizeProduct(
  row: Row,
  facts: Map<(typeof FACT_TABLES)[number], Row[]>,
  dispositionedIds: Set<string>,
): CatalogAuditProduct[] {
  const productId = text(row.id)
  if (!productId) return []
  const categoryKey = category(text(row.category_key))
  const suitableThicknesses = textArray(row.suitable_thicknesses)
  const suitableConcerns = textArray(row.suitable_concerns)
  return [
    {
      productId,
      origin: text(row.origin) ?? "<missing>",
      categoryKey,
      legacyCategory: text(row.category),
      isActive: row.is_active === true,
      lifecycleStatus: text(row.lifecycle_status),
      recommendable: row.is_chaarlie_recommended === true,
      suitableThicknesses,
      suitableConcerns,
      canonicalThicknesses: canonicalThicknesses(productId, categoryKey, facts),
      // Task 2's normalized rows are expand-phase projections of this legacy
      // field. Do not claim independent canonical parity until repair and the
      // transactional publication boundary take ownership in later tasks.
      canonicalConcerns: null,
      requiredRoles: requiredRoles(productId, categoryKey, facts),
      dispositioned: dispositionedIds.has(productId),
    },
  ]
}

function normalizeFactRow(table: (typeof FACT_TABLES)[number], row: Row): CatalogAuditFactRow[] {
  const productId = text(row.product_id)
  if (!productId) return []
  return [
    {
      table,
      productId,
      expectedCategory: TABLE_CATEGORY[table],
      complete: factComplete(table, row),
      contextualKey: contextualKey(table, row),
      thickness: text(row.thickness),
    },
  ]
}

function normalizeEligibilityRow(
  table: (typeof ELIGIBILITY_TABLES)[number],
  row: Row,
): CatalogAuditFactRow[] {
  const productId = text(row.product_id)
  const expectedCategory = category(text(row.category_key))
  const value = text(table === "product_thickness_eligibility" ? row.thickness : row.concern_key)
  if (!productId || !expectedCategory || !value) return []
  return [
    {
      table,
      productId,
      expectedCategory,
      complete: true,
      contextualKey: value,
      thickness: table === "product_thickness_eligibility" ? value : null,
    },
  ]
}

function factComplete(table: (typeof FACT_TABLES)[number], row: Row): boolean {
  switch (table) {
    case "product_shampoo_specs":
      return present(row, "thickness", "shampoo_bucket", "scalp_route", "cleansing_intensity")
    case "product_conditioner_specs":
      return (
        present(row, "thickness", "protein_moisture_balance") &&
        [
          "stretches_stays",
          "protein",
          "snaps",
          "moisture",
          "stretches_bounces",
          "balanced",
        ].includes(text(row.protein_moisture_balance) ?? "")
      )
    case "product_conditioner_rerank_specs":
      return present(row, "weight", "repair_level", "balance_direction")
    case "product_leave_in_specs": {
      const roles = textArray(row.plan_roles)
      const stages = textArray(row.application_stage)
      const roleStageValid =
        (roles.includes("post_wash_leave_in") && stages.includes("towel_dry")) ||
        (roles.includes("pre_heat_application") &&
          row.provides_heat_protection === true &&
          stages.includes("pre_heat"))
      return (
        present(row, "weight", "care_direction", "repair_support_level") &&
        roles.length > 0 &&
        textArray(row.functional_benefits).length > 0 &&
        roleStageValid
      )
    }
    case "product_leave_in_fit_specs":
      return present(row, "weight", "conditioner_relationship")
    case "product_leave_in_eligibility":
      return present(row, "thickness", "need_bucket", "styling_context")
    case "product_heat_protectant_specs":
      return typeof row.provides_heat_protection === "boolean"
    case "product_oil_specs":
      return present(row, "weight") && textArray(row.role_support).length > 0
    case "product_oil_eligibility":
      return present(row, "thickness", "oil_subtype")
    case "product_mask_specs":
      return (
        present(row, "weight", "balance_direction", "repair_support_level") &&
        textArray(row.functional_benefits).length > 0
      )
    case "product_scalp_care_specs":
      return (
        present(row, "primary_role", "presentation_format", "rinse_mode") &&
        text(row.presentation_format) !== "unknown"
      )
    case "product_dry_shampoo_specs":
      return present(row, "primary_effect", "hair_color_fit", "scalp_sensitivity_fit", "format")
    case "product_bondbuilder_specs":
      return present(row, "application_mode", "treatment_mode", "product_format", "usage_protocol")
    case "product_deep_cleansing_shampoo_specs":
      return (
        ["product_sebum_buildup", "metal_mineral_hard_water", "broad_spectrum_detox"].includes(
          text(row.reset_focus) ?? "",
        ) && present(row, "scalp_type_focus", "color_treated_suitability")
      )
  }
}

function contextualKey(table: (typeof FACT_TABLES)[number], row: Row): string | null {
  switch (table) {
    case "product_shampoo_specs":
      return joined(row, "thickness", "shampoo_bucket", "scalp_route")
    case "product_conditioner_specs":
      return joined(row, "thickness", "protein_moisture_balance")
    case "product_leave_in_eligibility":
      return joined(row, "thickness", "need_bucket", "styling_context")
    case "product_oil_eligibility":
      return joined(row, "thickness", "oil_subtype")
    default:
      return null
  }
}

function canonicalThicknesses(
  productId: string,
  categoryKey: PersonalPlanCategory | null,
  facts: Map<(typeof FACT_TABLES)[number], Row[]>,
): string[] | null {
  if (!categoryKey) return null
  if (categoryKey === "heat_protectant") return null
  // Shampoo is the only current thickness fact whose legacy sync trigger has
  // been retired. Conditioner, Leave-in, and Oil still derive their rows from
  // suitable_thicknesses, so comparing them would only compare a projection.
  const table = categoryKey === "shampoo" ? "product_shampoo_specs" : undefined
  if (!table) return null
  const values = (facts.get(table) ?? [])
    .filter((row) => text(row.product_id) === productId)
    .map((row) => text(row.thickness))
    .filter((value): value is string => value !== null)
  return [...new Set(values)].sort()
}

function requiredRoles(
  productId: string,
  categoryKey: PersonalPlanCategory | null,
  facts: Map<(typeof FACT_TABLES)[number], Row[]>,
): string[] {
  if (!categoryKey) return []
  const rows = (table: (typeof FACT_TABLES)[number]) =>
    (facts.get(table) ?? []).filter((row) => text(row.product_id) === productId)
  switch (categoryKey) {
    case "shampoo":
      return unique(
        rows("product_shampoo_specs").map((row) =>
          text(row.shampoo_bucket) === "schuppen" ? "shampoo_dandruff" : "shampoo_everyday",
        ),
      )
    case "conditioner":
      return ["conditioner_rinse_out"]
    case "leave_in":
      return unique(
        rows("product_leave_in_specs").flatMap((row) =>
          textArray(row.plan_roles).map((role) =>
            role === "pre_heat_application" ? "pre_heat_protection" : role,
          ),
        ),
      )
    case "heat_protectant":
      return ["pre_heat_protection"]
    case "oil":
      return unique(rows("product_oil_specs").flatMap((row) => textArray(row.role_support)))
    case "mask":
      return ["intensive_conditioning_mask"]
    case "scalp_care":
      return unique(rows("product_scalp_care_specs").map((row) => text(row.primary_role)))
    case "dry_shampoo":
      return ["root_refresh_bridge"]
    case "bondbuilder":
      return ["specialized_bond_treatment"]
    case "deep_cleansing_shampoo":
      return unique(
        rows("product_deep_cleansing_shampoo_specs").flatMap((row) => {
          const focus = text(row.reset_focus)
          if (focus === "broad_spectrum_detox") return ["residue_reset", "mineral_reset"]
          if (focus === "product_sebum_buildup") return ["residue_reset"]
          if (focus === "metal_mineral_hard_water") return ["mineral_reset"]
          return []
        }),
      )
  }
}

function normalizeProtocol(row: Row) {
  const productId = text(row.product_id)
  if (!productId) return []
  const payload = record(row.guidance_payload)
  const scope = record(payload?.scope)
  const payloadV2 = record(row.guidance_payload_v2)
  const scopeV2 = record(payloadV2?.scope)
  const evidence = Array.isArray(payload?.evidence) ? payload.evidence : []
  return [
    {
      productId,
      category: text(row.category),
      role: text(row.role),
      scopeKind: text(scope?.kind),
      scopeProductId: text(scope?.productId),
      scopeCategory: text(scope?.category),
      sourceUrl: text(row.source_url),
      sourceText: text(row.source_text),
      evidenceSourceUrls: evidence
        .map((value) => text(record(value)?.sourceUrl))
        .filter((value): value is string => value !== null),
      v1SchemaValid: payload?.schemaVersion === 1 || payload?.schemaVersion === "1",
      v2Complete:
        payloadV2?.schemaVersion === 2 &&
        payloadV2.contractKind === "product_pointer" &&
        text(scopeV2?.kind) === "product" &&
        text(scopeV2?.productId) === productId &&
        text(scopeV2?.category) === text(row.category) &&
        text(payloadV2.sourceRole) === text(row.role) &&
        Boolean(text(payloadV2.applicationFamily)?.trim()) &&
        "runtimeBlockerCode" in (payloadV2 ?? {}) &&
        payloadV2?.runtimeBlockerCode === null,
    },
  ]
}

function category(value: string | null): PersonalPlanCategory | null {
  return value && PERSONAL_PLAN_PRODUCT_CATEGORIES.includes(value as PersonalPlanCategory)
    ? (value as PersonalPlanCategory)
    : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((entry): entry is string => entry !== null)
    : []
}

function record(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null
}

function present(row: Row, ...keys: string[]): boolean {
  return keys.every((key) => text(row[key]) !== null)
}

function joined(row: Row, ...keys: string[]): string | null {
  const values = keys.map((key) => text(row[key]))
  return values.every((value) => value !== null) ? values.join(":") : null
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
}
