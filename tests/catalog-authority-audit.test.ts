import assert from "node:assert/strict"
import test from "node:test"

import { auditCatalogAuthority } from "../src/lib/catalog-authority/audit"
import {
  CATALOG_AUTHORITY_FORBIDDEN_SCHEMA_OBJECTS,
  CATALOG_AUTHORITY_AUDIT_ISSUE_CODES,
  CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS,
  CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS,
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type CatalogAuthorityAuditSnapshot,
  type CatalogAuditFactRow,
  type CatalogAuditProduct,
} from "../src/lib/catalog-authority/contracts"

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111"

test("a complete ten-category fixture has no authority issues", () => {
  const products = PERSONAL_PLAN_PRODUCT_CATEGORIES.map((category, index) =>
    completeProduct(category, uuid(index + 1)),
  )
  const snapshot = completeSnapshot(products)
  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(receipt.clean, true)
  assert.equal(receipt.productCount, 10)
  assert.deepEqual(receipt.issues, [])
  assert.deepEqual(
    receipt.countsByCategory,
    Object.fromEntries(PERSONAL_PLAN_PRODUCT_CATEGORIES.map((category) => [category, 1])),
  )
})

test("legacy display labels normalize to the canonical category keys", () => {
  const displayLabels = {
    shampoo: "Shampoo",
    conditioner: "Conditioner Profi",
    leave_in: "Leave-in",
    heat_protectant: "heat_protectant",
    oil: "Öle",
    mask: "Maske",
    scalp_care: "scalp_care",
    dry_shampoo: "Trockenshampoo",
    bondbuilder: "Bondbuilder",
    deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
  } as const
  const products = PERSONAL_PLAN_PRODUCT_CATEGORIES.map((category, index) => ({
    ...completeProduct(category, uuid(index + 101)),
    legacyCategory: displayLabels[category],
  }))

  const receipt = auditCatalogAuthority(completeSnapshot(products))

  assert.equal(receipt.issueCounts.legacy_category_divergence, undefined)
  assert.equal(receipt.clean, true)
})

test("publication completeness matches current bypass and recommendability rules", () => {
  const inactiveCurated = incompleteProduct(uuid(201), {
    origin: "curated",
    isActive: false,
    lifecycleStatus: "inactive",
  })
  const userSubmitted = incompleteProduct(uuid(202), {
    origin: "user_submitted",
    isActive: true,
    lifecycleStatus: "active",
  })
  const dispositioned = incompleteProduct(uuid(203), {
    dispositioned: true,
  })
  const recommendable = incompleteProduct(uuid(204), {
    origin: "user_submitted",
    isActive: false,
    lifecycleStatus: "inactive",
    recommendable: true,
  })
  const activeCurated = incompleteProduct(uuid(205))
  const snapshot = completeSnapshot([
    inactiveCurated,
    userSubmitted,
    dispositioned,
    recommendable,
    activeCurated,
  ])
  snapshot.facts = []
  snapshot.protocols = []
  snapshot.evidence = []

  const receipt = auditCatalogAuthority(snapshot)
  const incompleteIds = receipt.issues
    .filter((issue) => issue.code === "publication_incomplete")
    .map((issue) => issue.productId)

  assert.deepEqual(incompleteIds, [recommendable.productId, activeCurated.productId])
})

test("publication roll-up includes defects discovered before category completeness checks", () => {
  const product = completeProduct("mask", uuid(206))
  const snapshot = completeSnapshot([product])
  snapshot.protocols.push({
    ...snapshot.protocols[0]!,
    role: "optional_role",
    scopeKind: "application_family",
  })

  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(receipt.issueCounts.exact_protocol_scope_mismatch, 1)
  assert.equal(receipt.issueCounts.publication_incomplete, 1)
})

test("thickness is non-applicable for heat protectant, dry shampoo, and scalp care", () => {
  const products = (["heat_protectant", "dry_shampoo", "scalp_care"] as const).map(
    (category, index) => ({
      ...completeProduct(category, uuid(210 + index)),
      suitableThicknesses: category === "heat_protectant" ? ["fine"] : [],
      canonicalThicknesses: [],
    }),
  )

  const receipt = auditCatalogAuthority(completeSnapshot(products))

  assert.equal(receipt.issueCounts.contextual_matrix_empty, undefined)
  assert.equal(receipt.issueCounts.legacy_thickness_divergence, undefined)
  assert.equal(receipt.clean, true)
})

test("converged composite constraints must be validated", () => {
  const snapshot = completeSnapshot([completeProduct("shampoo", uuid(213))])
  snapshot.schemaObjects = requiredSchemaObjects().map((object) => ({
    ...object,
    valid: object.name.endsWith("_product_category_fkey") ? false : object.valid,
  }))

  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(receipt.issueCounts.required_index_or_constraint_missing, 14)
  assert.equal(receipt.clean, false)
})

test("converged schema rejects every redundant single-column product relationship", () => {
  const snapshot = completeSnapshot([completeProduct("shampoo", uuid(216))])
  snapshot.schemaObjects!.push(
    ...CATALOG_AUTHORITY_FORBIDDEN_SCHEMA_OBJECTS.map((name) => ({
      kind: "constraint" as const,
      name,
      valid: true,
      definition: "FOREIGN KEY (product_id) REFERENCES products(id)",
    })),
  )

  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(
    receipt.issueCounts.required_index_or_constraint_missing,
    CATALOG_AUTHORITY_FORBIDDEN_SCHEMA_OBJECTS.length,
  )
  assert.equal(receipt.clean, false)
})

test("pre-existing product spine constraints must remain validated", () => {
  const snapshot = completeSnapshot([completeProduct("shampoo", uuid(214))])
  snapshot.schemaObjects = requiredSchemaObjects().map((object) => ({
    ...object,
    valid: object.name !== "products_origin_check",
  }))

  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(receipt.issueCounts.required_index_or_constraint_missing, 1)
  assert.match(
    receipt.issues.find((issue) => issue.code === "required_index_or_constraint_missing")!.detail,
    /products_origin_check is not validated/,
  )
})

test("expand-phase audit reports contextual thicknesses missing normalized eligibility", () => {
  const product = completeProduct("shampoo", uuid(215))
  const snapshot = completeSnapshot([product])
  snapshot.rowCounts.product_thickness_eligibility = 0

  const receipt = auditCatalogAuthority(snapshot)

  assert.equal(receipt.issueCounts.contextual_matrix_incomplete, 1)
  assert.match(
    receipt.issues.find((issue) => issue.code === "contextual_matrix_incomplete")!.detail,
    /no normalized eligibility reference/,
  )
})

test("target normalized thickness debt remains visible for required singleton categories", () => {
  const products = (["mask", "bondbuilder", "deep_cleansing_shampoo"] as const).map(
    (category, index) => ({
      ...completeProduct(category, uuid(220 + index)),
      canonicalThicknesses: null,
    }),
  )

  const receipt = auditCatalogAuthority(completeSnapshot(products))

  assert.equal(receipt.issueCounts.contextual_matrix_empty, 3)
  assert.equal(receipt.issueCounts.publication_incomplete, 3)
})

test("the audit emits every stable issue code for realistic split-authority defects", () => {
  const valid = completeProduct("shampoo", PRODUCT_ID)
  const conditioner = completeProduct("conditioner", "22222222-2222-4222-8222-222222222222")
  const snapshot = completeSnapshot([valid, conditioner])
  snapshot.products[0] = {
    ...valid,
    origin: "legacy",
    categoryKey: null,
    legacyCategory: "conditioner",
    canonicalThicknesses: ["fine"],
    suitableThicknesses: ["coarse"],
    canonicalConcerns: ["dryness"],
    suitableConcerns: ["breakage"],
  }
  snapshot.facts = [
    {
      table: "product_leave_in_specs",
      productId: PRODUCT_ID,
      expectedCategory: "leave_in",
      complete: true,
      contextualKey: null,
      thickness: null,
    },
    {
      table: "product_leave_in_fit_specs",
      productId: PRODUCT_ID,
      expectedCategory: "leave_in",
      complete: true,
      contextualKey: null,
      thickness: null,
    },
    {
      table: "product_shampoo_specs",
      productId: PRODUCT_ID,
      expectedCategory: "shampoo",
      complete: false,
      contextualKey: "normal:everyday",
      thickness: "normal",
    },
    {
      table: "product_conditioner_rerank_specs",
      productId: conditioner.productId,
      expectedCategory: "conditioner",
      complete: true,
      contextualKey: null,
      thickness: null,
    },
    {
      table: "product_conditioner_rerank_specs",
      productId: conditioner.productId,
      expectedCategory: "conditioner",
      complete: true,
      contextualKey: null,
      thickness: null,
    },
    {
      table: "product_conditioner_specs",
      productId: "33333333-3333-4333-8333-333333333333",
      expectedCategory: "conditioner",
      complete: true,
      contextualKey: "normal:balanced",
      thickness: "normal",
    },
  ]
  snapshot.protocols = [
    {
      productId: PRODUCT_ID,
      category: "conditioner",
      role: "shampoo_everyday",
      scopeKind: "application_family",
      scopeProductId: "22222222-2222-4222-8222-222222222222",
      scopeCategory: "conditioner",
      sourceUrl: null,
      sourceText: null,
      evidenceSourceUrls: [],
      v1SchemaValid: false,
      v2Complete: false,
    },
    ...requiredProtocols(valid),
  ]
  snapshot.guidance = [
    {
      id: "overlap",
      scopeKind: "product",
      productId: PRODUCT_ID,
      categoryKey: "shampoo",
      roleKey: "shampoo_everyday",
      status: "active",
    },
  ]
  snapshot.evidence = []
  snapshot.schemaObjects = []

  const receipt = auditCatalogAuthority(snapshot)
  const withoutSchemaInspection = { ...snapshot, schemaObjects: null }
  const schemaReceipt = auditCatalogAuthority(withoutSchemaInspection)
  const codes = new Set([...receipt.issues, ...schemaReceipt.issues].map((issue) => issue.code))

  for (const code of CATALOG_AUTHORITY_AUDIT_ISSUE_CODES) {
    assert.equal(codes.has(code), true, `missing audit issue ${code}`)
  }
  assert.equal(receipt.clean, false)
})

function completeSnapshot(products: CatalogAuditProduct[]): CatalogAuthorityAuditSnapshot {
  const facts = products.flatMap((product) => requiredFacts(product))
  return {
    schemaVersion: 1,
    inspectedAt: "2026-08-15T12:00:00.000Z",
    products,
    facts,
    protocols: products.flatMap((product) => requiredProtocols(product)),
    guidance: [],
    evidence: products.map((product) => ({
      productId: product.productId,
      factKey: `${product.categoryKey}.authority_facts`,
      sourceUrl: "https://example.com/source",
      contentFingerprint: "fingerprint",
    })),
    rowCounts: {
      products: products.length,
      product_application_protocols: products.flatMap((product) => requiredProtocols(product))
        .length,
      personal_plan_catalog_fact_evidence: products.length,
    },
    schemaObjects: requiredSchemaObjects(),
  }
}

function completeProduct(
  category: (typeof PERSONAL_PLAN_PRODUCT_CATEGORIES)[number],
  productId: string,
): CatalogAuditProduct {
  return {
    productId,
    origin: "curated",
    categoryKey: category,
    legacyCategory: category,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: category === "heat_protectant" ? [] : ["normal"],
    suitableConcerns: ["dryness"],
    canonicalThicknesses: category === "heat_protectant" ? [] : ["normal"],
    canonicalConcerns: ["dryness"],
    requiredRoles: rolesFor(category),
    dispositioned: false,
  }
}

function incompleteProduct(
  productId: string,
  overrides: Partial<CatalogAuditProduct> = {},
): CatalogAuditProduct {
  return {
    ...completeProduct("shampoo", productId),
    recommendable: false,
    ...overrides,
  }
}

function requiredFacts(product: CatalogAuditProduct): CatalogAuditFactRow[] {
  const id = product.productId
  switch (product.categoryKey) {
    case "shampoo":
      return [fact("product_shampoo_specs", id, "shampoo", "normal:everyday", "normal")]
    case "conditioner":
      return [
        fact("product_conditioner_specs", id, "conditioner", "normal:balanced", "normal"),
        fact("product_conditioner_rerank_specs", id, "conditioner"),
      ]
    case "leave_in":
      return [
        fact("product_leave_in_specs", id, "leave_in"),
        fact("product_leave_in_eligibility", id, "leave_in", "normal:moisture:air", "normal"),
      ]
    case "heat_protectant":
      return [fact("product_heat_protectant_specs", id, "heat_protectant")]
    case "oil":
      return [
        fact("product_oil_specs", id, "oil"),
        fact("product_oil_eligibility", id, "oil", "normal:finish", "normal"),
      ]
    case "mask":
      return [fact("product_mask_specs", id, "mask")]
    case "scalp_care":
      return [fact("product_scalp_care_specs", id, "scalp_care")]
    case "dry_shampoo":
      return [fact("product_dry_shampoo_specs", id, "dry_shampoo")]
    case "bondbuilder":
      return [fact("product_bondbuilder_specs", id, "bondbuilder")]
    case "deep_cleansing_shampoo":
      return [fact("product_deep_cleansing_shampoo_specs", id, "deep_cleansing_shampoo")]
    case null:
      return []
  }
}

function fact(
  table: string,
  productId: string,
  expectedCategory: NonNullable<CatalogAuditProduct["categoryKey"]>,
  contextualKey: string | null = null,
  thickness: string | null = null,
): CatalogAuditFactRow {
  return { table, productId, expectedCategory, complete: true, contextualKey, thickness }
}

function requiredProtocols(product: CatalogAuditProduct) {
  const rolesByCategory = {
    shampoo: ["shampoo_everyday"],
    conditioner: ["conditioner_rinse_out"],
    leave_in: ["post_wash_leave_in"],
    heat_protectant: ["pre_heat_protection"],
    oil: ["dry_finish"],
    mask: ["intensive_conditioning_mask"],
    scalp_care: ["scalp_comfort"],
    dry_shampoo: ["root_refresh_bridge"],
    bondbuilder: ["specialized_bond_treatment"],
    deep_cleansing_shampoo: ["residue_reset"],
  } as const
  if (!product.categoryKey) return []
  return rolesByCategory[product.categoryKey].map((role) => ({
    productId: product.productId,
    category: product.categoryKey,
    role,
    scopeKind: "product",
    scopeProductId: product.productId,
    scopeCategory: product.categoryKey,
    sourceUrl: "https://example.com/source",
    sourceText: "Verified source text",
    evidenceSourceUrls: ["https://example.com/source"],
    v1SchemaValid: true,
    v2Complete: true,
  }))
}

function requiredSchemaObjects() {
  return CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS.map((name) => ({
    kind: name.endsWith("_idx") ? ("index" as const) : ("constraint" as const),
    name,
    valid: true,
    definition: "verified test constraint",
  }))
}

function rolesFor(category: NonNullable<CatalogAuditProduct["categoryKey"]>): string[] {
  return {
    shampoo: ["shampoo_everyday"],
    conditioner: ["conditioner_rinse_out"],
    leave_in: ["post_wash_leave_in"],
    heat_protectant: ["pre_heat_protection"],
    oil: ["dry_finish"],
    mask: ["intensive_conditioning_mask"],
    scalp_care: ["scalp_comfort"],
    dry_shampoo: ["root_refresh_bridge"],
    bondbuilder: ["specialized_bond_treatment"],
    deep_cleansing_shampoo: ["residue_reset"],
  }[category]
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`
}
