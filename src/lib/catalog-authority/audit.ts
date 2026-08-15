import {
  CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS,
  CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS,
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type CatalogAuthorityAuditIssue,
  CatalogAuthorityAuditReceipt,
  CatalogAuthorityAuditSnapshot,
  type CatalogAuthorityAuditIssueCode,
  type CatalogAuditFactRow,
  type CatalogAuditProduct,
  type PersonalPlanCategory,
} from "./contracts"
import { normalizeCategoryKey } from "@/lib/product-identity"

type CategoryFactRule = {
  one: readonly string[]
  many: readonly string[]
}

const CATEGORY_FACT_RULES: Record<PersonalPlanCategory, CategoryFactRule> = {
  shampoo: { one: [], many: ["product_shampoo_specs"] },
  conditioner: {
    one: ["product_conditioner_rerank_specs"],
    many: ["product_conditioner_specs"],
  },
  leave_in: {
    one: ["product_leave_in_specs"],
    many: ["product_leave_in_eligibility"],
  },
  heat_protectant: { one: ["product_heat_protectant_specs"], many: [] },
  oil: { one: ["product_oil_specs"], many: ["product_oil_eligibility"] },
  mask: { one: ["product_mask_specs"], many: [] },
  scalp_care: { one: ["product_scalp_care_specs"], many: [] },
  dry_shampoo: { one: ["product_dry_shampoo_specs"], many: [] },
  bondbuilder: { one: ["product_bondbuilder_specs"], many: [] },
  deep_cleansing_shampoo: {
    one: ["product_deep_cleansing_shampoo_specs"],
    many: [],
  },
}

const PUBLICATION_DEFECT_CODES = new Set<CatalogAuthorityAuditIssueCode>([
  "category_missing_or_invalid",
  "origin_invalid",
  "category_fact_product_mismatch",
  "required_spec_missing",
  "singleton_spec_duplicate",
  "contextual_matrix_empty",
  "contextual_matrix_incomplete",
  "required_protocol_missing",
  "exact_protocol_category_mismatch",
  "exact_protocol_scope_mismatch",
  "overlapping_product_guidance_authority",
  "overlapping_category_fact_authority",
  "provenance_missing",
])

export function auditCatalogAuthority(
  snapshot: CatalogAuthorityAuditSnapshot,
): CatalogAuthorityAuditReceipt {
  const issues: CatalogAuthorityAuditIssue[] = []
  const products = new Map(snapshot.products.map((product) => [product.productId, product]))
  const countsByCategory: CatalogAuthorityAuditReceipt["countsByCategory"] = {}
  for (const category of PERSONAL_PLAN_PRODUCT_CATEGORIES) countsByCategory[category] = 0

  const add = (
    code: CatalogAuthorityAuditIssueCode,
    product: CatalogAuditProduct | null,
    relation: string | null,
    detail: string,
    category: PersonalPlanCategory | null = product?.categoryKey ?? null,
  ) => {
    issues.push({ code, productId: product?.productId ?? null, category, relation, detail })
  }

  for (const product of snapshot.products) {
    if (product.categoryKey) countsByCategory[product.categoryKey]! += 1
    if (product.origin !== "curated" && product.origin !== "user_submitted") {
      add("origin_invalid", product, "products", `unsupported origin ${product.origin}`)
    }
    if (!product.categoryKey) {
      add("category_missing_or_invalid", product, "products", "category_key is missing or invalid")
    }
    if (
      product.legacyCategory !== null &&
      normalizeCategory(product.legacyCategory) !== product.categoryKey
    ) {
      add(
        "legacy_category_divergence",
        product,
        "products",
        `legacy category ${product.legacyCategory} differs from category_key`,
      )
    }
    if (
      thicknessApplies(product.categoryKey) &&
      product.canonicalThicknesses !== null &&
      !sameSet(product.canonicalThicknesses, product.suitableThicknesses)
    ) {
      add(
        "legacy_thickness_divergence",
        product,
        "products",
        "suitable_thicknesses differs from canonical eligibility",
      )
    }
    if (
      product.canonicalConcerns !== null &&
      !sameSet(product.canonicalConcerns, product.suitableConcerns)
    ) {
      add(
        "legacy_concern_divergence",
        product,
        "products",
        "suitable_concerns differs from canonical eligibility",
      )
    }
  }

  for (const row of snapshot.facts) {
    const product = products.get(row.productId) ?? null
    if (!product) {
      add(
        "orphan_authority_row",
        null,
        row.table,
        `fact row references missing product ${row.productId}`,
        row.expectedCategory,
      )
      continue
    }
    if (product.categoryKey !== row.expectedCategory) {
      add(
        "category_fact_product_mismatch",
        product,
        row.table,
        `fact category ${row.expectedCategory} differs from product category`,
        row.expectedCategory,
      )
    }
    if (
      row.table === "product_leave_in_fit_specs" &&
      snapshot.facts.some(
        (candidate) =>
          candidate.productId === row.productId && candidate.table === "product_leave_in_specs",
      )
    ) {
      add(
        "overlapping_category_fact_authority",
        product,
        row.table,
        "legacy Leave-in fit facts overlap canonical Leave-in specs",
        "leave_in",
      )
    }
  }

  if (snapshot.rowCounts.product_thickness_eligibility !== undefined) {
    const normalizedThicknessKeys = new Set(
      snapshot.facts
        .filter((row) => row.table === "product_thickness_eligibility" && row.thickness)
        .map((row) => [row.productId, row.expectedCategory, row.thickness].join("\0")),
    )
    for (const row of snapshot.facts) {
      if (
        !row.thickness ||
        ![
          "product_shampoo_specs",
          "product_conditioner_specs",
          "product_leave_in_eligibility",
          "product_oil_eligibility",
        ].includes(row.table)
      ) {
        continue
      }
      if (
        !normalizedThicknessKeys.has(
          [row.productId, row.expectedCategory, row.thickness].join("\0"),
        )
      ) {
        add(
          "contextual_matrix_incomplete",
          products.get(row.productId) ?? null,
          row.table,
          "contextual thickness has no normalized eligibility reference",
          row.expectedCategory,
        )
      }
    }
  }

  for (const protocol of snapshot.protocols) {
    const product = products.get(protocol.productId) ?? null
    if (!product) {
      add(
        "orphan_authority_row",
        null,
        "product_application_protocols",
        `protocol references missing product ${protocol.productId}`,
      )
      continue
    }
    if (protocol.category !== product.categoryKey) {
      add(
        "exact_protocol_category_mismatch",
        product,
        "product_application_protocols",
        "protocol category differs from product category",
      )
    }
    if (
      protocol.scopeKind !== "product" ||
      protocol.scopeProductId !== product.productId ||
      protocol.scopeCategory !== product.categoryKey
    ) {
      add(
        "exact_protocol_scope_mismatch",
        product,
        "product_application_protocols",
        "protocol payload scope differs from indexed product/category",
      )
    }
    if (!protocol.v2Complete) {
      add(
        "exact_protocol_scope_mismatch",
        product,
        "product_application_protocols",
        "protocol V2 pointer contract is missing or inconsistent",
      )
    }
    if (!protocol.v1SchemaValid) {
      add(
        "exact_protocol_scope_mismatch",
        product,
        "product_application_protocols",
        "protocol V1 payload schemaVersion is missing or invalid",
      )
    }
  }

  for (const guidance of snapshot.guidance) {
    if (!guidance.productId) continue
    const product = products.get(guidance.productId) ?? null
    if (!product) {
      add(
        "orphan_authority_row",
        null,
        "application_guidance_protocols",
        `guidance references missing product ${guidance.productId}`,
      )
      continue
    }
    if (
      guidance.scopeKind === "product" &&
      guidance.status === "active" &&
      snapshot.protocols.some(
        (protocol) =>
          protocol.productId === guidance.productId &&
          protocol.category === guidance.categoryKey &&
          protocol.role === guidance.roleKey,
      )
    ) {
      add(
        "overlapping_product_guidance_authority",
        product,
        "application_guidance_protocols",
        `active product guidance overlaps exact protocol for role ${guidance.roleKey ?? "<none>"}`,
      )
    }
  }

  for (const evidence of snapshot.evidence) {
    if (!products.has(evidence.productId)) {
      add(
        "orphan_authority_row",
        null,
        "personal_plan_catalog_fact_evidence",
        `evidence references missing product ${evidence.productId}`,
      )
    }
  }

  for (const product of snapshot.products) {
    auditProductFacts(product, snapshot.facts, add)
    auditProductProtocols(product, snapshot, add)
    if (requiresPublicationCompleteness(product)) {
      const hasEvidence = snapshot.evidence.some(
        (row) =>
          row.productId === product.productId &&
          Boolean(row.sourceUrl?.trim()) &&
          Boolean(row.contentFingerprint?.trim()),
      )
      if (!hasEvidence) {
        add(
          "provenance_missing",
          product,
          "personal_plan_catalog_fact_evidence",
          "published product has no complete fact evidence row",
        )
      }
    }
  }

  for (const product of snapshot.products) {
    if (
      requiresPublicationCompleteness(product) &&
      issues.some(
        (issue) =>
          issue.productId === product.productId && PUBLICATION_DEFECT_CODES.has(issue.code),
      )
    ) {
      add(
        "publication_incomplete",
        product,
        "products",
        "published product fails the catalogue authority contract",
      )
    }
  }

  if (snapshot.schemaObjects === null) {
    add(
      "schema_inspection_missing",
      null,
      null,
      "schema constraints and indexes were not inspected",
    )
  } else {
    const actual = new Map(snapshot.schemaObjects.map((object) => [object.name, object]))
    const mustBeValidated = new Set<string>(CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS)
    for (const name of CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS) {
      const object = actual.get(name)
      if (!object || (mustBeValidated.has(name) && !object.valid)) {
        add(
          "required_index_or_constraint_missing",
          null,
          object?.kind ?? null,
          object ? `${name} is not validated` : `${name} is missing`,
        )
      }
    }
  }

  const deduped = dedupeAndSortIssues(issues)
  const issueCounts: CatalogAuthorityAuditReceipt["issueCounts"] = {}
  for (const issue of deduped) issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1
  return {
    schemaVersion: 1,
    mode: "read_only",
    inspectedAt: snapshot.inspectedAt,
    productCount: snapshot.products.length,
    countsByCategory,
    countsByRelation: Object.fromEntries(
      Object.entries(snapshot.rowCounts).sort(([left], [right]) => left.localeCompare(right)),
    ),
    issueCounts,
    issues: deduped,
    clean: deduped.length === 0,
  }
}

function thicknessApplies(category: PersonalPlanCategory | null): boolean {
  return category !== "heat_protectant" && category !== "dry_shampoo" && category !== "scalp_care"
}

function auditProductFacts(
  product: CatalogAuditProduct,
  facts: CatalogAuditFactRow[],
  add: (
    code: CatalogAuthorityAuditIssueCode,
    product: CatalogAuditProduct | null,
    relation: string | null,
    detail: string,
    category?: PersonalPlanCategory | null,
  ) => void,
): void {
  if (!product.categoryKey) {
    add(
      "required_spec_missing",
      product,
      null,
      "category facts cannot be selected without category",
    )
    return
  }
  const rules = CATEGORY_FACT_RULES[product.categoryKey]
  for (const table of rules.one) {
    const rows = facts.filter((row) => row.productId === product.productId && row.table === table)
    if (rows.length === 0)
      add("required_spec_missing", product, table, "required singleton fact is missing")
    if (rows.length > 1)
      add("singleton_spec_duplicate", product, table, `expected one row, found ${rows.length}`)
    if (rows.some((row) => !row.complete))
      add("required_spec_missing", product, table, "required singleton fact is incomplete")
  }
  for (const table of rules.many) {
    const rows = facts.filter((row) => row.productId === product.productId && row.table === table)
    if (rows.length === 0) {
      add("contextual_matrix_empty", product, table, "required contextual fact matrix is empty")
      add(
        "contextual_matrix_incomplete",
        product,
        table,
        "required contextual fact matrix has no complete entries",
      )
    }
    if (
      rows.some((row) => !row.complete || !row.contextualKey) ||
      new Set(rows.map((row) => row.contextualKey)).size !== rows.length
    ) {
      add(
        "contextual_matrix_incomplete",
        product,
        table,
        "contextual fact matrix contains incomplete or duplicate entries",
      )
    }
  }
  if (
    product.categoryKey !== "heat_protectant" &&
    product.categoryKey !== "dry_shampoo" &&
    product.categoryKey !== "scalp_care" &&
    (product.canonicalThicknesses === null || product.canonicalThicknesses.length === 0)
  ) {
    add(
      "contextual_matrix_empty",
      product,
      "product_thickness_eligibility",
      "canonical thickness eligibility is empty",
    )
  }
}

function auditProductProtocols(
  product: CatalogAuditProduct,
  snapshot: CatalogAuthorityAuditSnapshot,
  add: (
    code: CatalogAuthorityAuditIssueCode,
    product: CatalogAuditProduct | null,
    relation: string | null,
    detail: string,
    category?: PersonalPlanCategory | null,
  ) => void,
): void {
  for (const role of product.requiredRoles) {
    const complete = snapshot.protocols.some(
      (protocol) =>
        protocol.productId === product.productId &&
        protocol.category === product.categoryKey &&
        protocol.role === role &&
        protocol.scopeKind === "product" &&
        protocol.scopeProductId === product.productId &&
        protocol.scopeCategory === product.categoryKey &&
        Boolean(protocol.sourceUrl?.trim()) &&
        Boolean(protocol.sourceText?.trim()) &&
        protocol.evidenceSourceUrls.includes(protocol.sourceUrl ?? "") &&
        protocol.v1SchemaValid &&
        protocol.v2Complete,
    )
    if (!complete) {
      add(
        "required_protocol_missing",
        product,
        "product_application_protocols",
        `complete exact protocol is missing for role ${role}`,
      )
    }
  }
}

function requiresPublicationCompleteness(product: CatalogAuditProduct): boolean {
  if (product.dispositioned) return false
  return (
    (product.origin === "curated" && product.isActive && product.lifecycleStatus === "active") ||
    product.recommendable
  )
}

function normalizeCategory(value: string): PersonalPlanCategory | null {
  const normalized = normalizeCategoryKey(value)
  if (!normalized) return null
  if (PERSONAL_PLAN_PRODUCT_CATEGORIES.includes(normalized as PersonalPlanCategory)) {
    return normalized as PersonalPlanCategory
  }
  return null
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return [...new Set(left)].sort().join("\0") === [...new Set(right)].sort().join("\0")
}

function dedupeAndSortIssues(issues: CatalogAuthorityAuditIssue[]): CatalogAuthorityAuditIssue[] {
  const unique = new Map(
    issues.map((issue) => [
      [issue.code, issue.productId, issue.category, issue.relation, issue.detail].join("\0"),
      issue,
    ]),
  )
  return [...unique.values()].sort((left, right) =>
    [left.productId ?? "", left.code, left.relation ?? "", left.detail]
      .join("\0")
      .localeCompare(
        [right.productId ?? "", right.code, right.relation ?? "", right.detail].join("\0"),
      ),
  )
}
