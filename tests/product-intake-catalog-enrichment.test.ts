import assert from "node:assert/strict"
import test from "node:test"

import {
  CATALOG_ENRICHMENT_SCHEMA_VERSION,
  catalogEnrichmentFingerprint,
  generateCatalogEnrichmentIndex,
  isCatalogEnrichmentManifestPath,
  previewCatalogEnrichment,
  validateCatalogEnrichmentManifest,
  type CatalogEnrichmentManifest,
} from "../src/lib/product-intake/catalog-enrichment"
import { validateProductIntakeApprovalPayload } from "../src/lib/product-intake/category-validators"

function manifest(overrides: Record<string, unknown> = {}) {
  const heatSpec = { format: "spray", provides_heat_protection: true }
  const heatProtocol = {
    category: "heat_protectant",
    role: "pre_heat_protection",
    cadence: null,
    application_stage: "before_heat",
    application_state: "dry",
    placement: "lengths",
    contact_time_seconds: null,
    rinse_action: "leave_in",
    reapplication: "not_stated",
    instruction_modifiers: [],
    source_label: "Hersteller",
    source_url: "https://example.test/product",
    source_text: "Vor der Hitze anwenden.",
  }
  const product = {
    canonical_brand: " Acme ",
    product_line: null,
    clean_name: " Conditioner ",
    category_key: "heat_protectant",
    affiliate_link: "https://example.test/product",
    image_url: null,
    price_eur: 12.5,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: "2026-08-09T10:00:00.000Z",
    price_checked_at: "2026-08-09T10:00:00.000Z",
  }
  const catalogContent = {
    name: "Conditioner",
    brand: "Acme",
    category: "heat_protectant",
    affiliate_link: "https://example.test/product",
    purchase_link_status: "available",
    purchase_link_checked_at: "2026-08-09T10:00:00.000Z",
    price_checked_at: "2026-08-09T10:00:00.000Z",
    price_eur: 12.5,
    currency: "EUR",
    image_asset_path: "assets/acme.webp",
    image_sha256: "a".repeat(64),
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: false,
    brand_id: null,
    product_line_id: null,
    image_url: null,
  }
  return {
    schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
    batch_id: "personal-plan-launch-v1",
    product_key: "acme-heat-protectant",
    category_key: "heat_protectant",
    lifecycle_classification: "new_product",
    identity: { canonical_brand: "Acme", clean_name: "Conditioner", identifiers: [] },
    duplicate_check: { checked_at: "2026-08-09T10:00:00.000Z", candidates: [] },
    sources: [{ label: "Hersteller", type: "manufacturer", url: "https://example.test/product" }],
    commercial: {
      purchase_url: "https://example.test/product",
      status: "available",
      price_eur: 12.5,
      currency: "EUR",
    },
    catalog_state: {
      origin: "curated",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
    image: {
      local_asset_path: "assets/acme.webp",
      expected_storage_path: "assets/acme.webp",
      final_sha256: "a".repeat(64),
      qa_state: "pending",
    },
    product_payload: {
      final: {
        product,
        identifiers: [],
        category_specs: {
          product_heat_protectant_specs: heatSpec,
          product_application_protocols: [heatProtocol],
        },
        sources: [
          { url: "https://example.test/product", title: "Hersteller", evidence: "Produktdetails" },
        ],
        field_rationales: {
          "product.canonical_brand": "Hersteller",
          "product.clean_name": "Hersteller",
          "product.category_key": "Kategorie",
          "product.affiliate_link": "Kaufquelle",
          "product.image_url": "B1 löst die geprüfte lokale Datei auf.",
          "product.price_eur": "Kaufquelle",
          "product.purchase_link_status": "Kaufquelle",
          "category_specs.product_heat_protectant_specs": "Hersteller",
          "category_specs.product_application_protocols": "Hersteller",
        },
        review: { manual_reviewed: true },
      },
    },
    category_payload: {
      product_heat_protectant_specs: heatSpec,
      product_application_protocols: [heatProtocol],
    },
    planned_operations: [
      { type: "insert_product", table: "products", catalog_content: catalogContent },
      {
        type: "upsert",
        table: "product_heat_protectant_specs",
        rows: [{ product_id: "__PRODUCT_ID__", ...heatSpec }],
      },
      {
        type: "upsert",
        table: "product_application_protocols",
        rows: [{ product_id: "__PRODUCT_ID__", ...heatProtocol }],
      },
    ],
    validation: { state: "pending" },
    review: { state: "pending" },
    disposition: { state: "researching", may_enter_deliverable_b: false },
    ...overrides,
  }
}

test("new-product manifests require duplicate evidence, have no target id, and plan only catalog work", () => {
  const result = validateCatalogEnrichmentManifest(manifest())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.planned_operations.length, 3)
  }
})

test("manufacturer SKUs are accepted while unknown identifier types remain rejected", () => {
  const base = manifest()
  const final = base.product_payload.final

  const manufacturerSku = validateProductIntakeApprovalPayload({
    final: {
      ...final,
      identifiers: [
        { type: " manufacturer_sku ", value: "100434", source: "The Ordinary" },
        { type: "manufacturer_sku", value: "NART:69658-00000-26", source: "Eucerin" },
      ],
      category_specs: base.category_payload,
    },
  })
  assert.equal(manufacturerSku.ok, true)
  if (manufacturerSku.ok) {
    assert.deepEqual(manufacturerSku.normalizedPayload.final.identifiers, [
      { type: "manufacturer_sku", value: "100434", source: "The Ordinary" },
      { type: "manufacturer_sku", value: "NART:69658-00000-26", source: "Eucerin" },
    ])
  }

  const unknownIdentifier = validateProductIntakeApprovalPayload({
    final: {
      ...final,
      identifiers: [{ type: "supplier_reference", value: "100434", source: "The Ordinary" }],
      category_specs: base.category_payload,
    },
  })
  assert.equal(unknownIdentifier.ok, false)
})

test("new-product manifests require exact curated catalog content derived from the approved final payload", () => {
  const valid = validateCatalogEnrichmentManifest(manifest())
  assert.equal(valid.ok, true)

  for (const override of [
    { catalog_state: undefined },
    {
      catalog_state: {
        origin: "submission",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
      },
    },
    {
      catalog_state: {
        origin: "curated",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
      },
    },
    {
      catalog_state: {
        origin: "curated",
        is_active: true,
        lifecycle_status: "draft",
        is_chaarlie_recommended: false,
      },
    },
    {
      catalog_state: {
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        extra: true,
      },
    },
    { commercial: { purchase_url: "https://example.test/product", status: "unavailable" } },
    {
      catalog_state: {
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
      },
      commercial: { purchase_url: "https://example.test/product", status: "unavailable" },
    },
    { product_payload: {} },
  ]) {
    assert.equal(validateCatalogEnrichmentManifest(manifest(override)).ok, false)
  }
})

test("new-product insert content fails closed on drift or resolved B1 fields and preview exposes the proposal", () => {
  const drifted = manifest()
  const insert = drifted.planned_operations[0] as { catalog_content: Record<string, unknown> }
  insert.catalog_content.name = "Different"
  assert.equal(validateCatalogEnrichmentManifest(drifted).ok, false)

  const resolved = manifest()
  ;(
    resolved.planned_operations[0] as { catalog_content: Record<string, unknown> }
  ).catalog_content.image_url = "https://example.test/product.webp"
  assert.equal(validateCatalogEnrichmentManifest(resolved).ok, false)

  const preview = previewCatalogEnrichment(manifest())
  assert.equal("errors" in preview, false)
  if (!("errors" in preview)) {
    assert.deepEqual(
      preview.catalog_content,
      (manifest().planned_operations[0] as { catalog_content: Record<string, unknown> })
        .catalog_content,
    )
    assert.deepEqual(preview.pending_b1_resolutions, ["brand_id", "product_line_id", "image_url"])
  }
})

test("new-product manifests require exactly one product insert before spec operations", () => {
  const missingInsert = validateCatalogEnrichmentManifest(
    manifest({
      planned_operations: [{ type: "upsert", table: "product_conditioner_specs", rows: [{}] }],
    }),
  )
  assert.equal(missingInsert.ok, false)
  if (!missingInsert.ok)
    assert.ok(missingInsert.errors.includes("new_product must plan exactly one insert_product"))

  const duplicateInsert = validateCatalogEnrichmentManifest(
    manifest({
      planned_operations: [
        { type: "insert_product", table: "products" },
        { type: "insert_product", table: "products" },
      ],
    }),
  )
  assert.equal(duplicateInsert.ok, false)
  if (!duplicateInsert.ok)
    assert.ok(duplicateInsert.errors.includes("new_product must plan exactly one insert_product"))
})

test("new-product operations must be derived from the shared category validator", () => {
  const malformed = validateCatalogEnrichmentManifest(
    manifest({
      category_payload: {},
      planned_operations: [{ type: "insert_product", table: "products" }],
    }),
  )
  assert.equal(malformed.ok, false)
  if (!malformed.ok) {
    assert.ok(
      malformed.errors.some((error) => error.startsWith("product intake category validation:")),
    )
    assert.ok(
      malformed.errors.includes(
        "new_product planned spec operations do not match shared category validation",
      ),
    )
  }
})

test("approved category specs cannot diverge from the operation-driving category payload", () => {
  const divergent = manifest()
  divergent.product_payload.final.category_specs = {
    ...divergent.category_payload,
    product_heat_protectant_specs: {
      format: "spray",
      provides_heat_protection: false,
    },
  }

  const result = validateCatalogEnrichmentManifest(divergent)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(
      result.errors.includes(
        "product_payload.final.category_specs must exactly match category_payload",
      ),
    )
  }
})

test("commercial price and currency must match the approved product payload", () => {
  for (const commercial of [
    {
      purchase_url: "https://example.test/product",
      status: "available",
      price_eur: 99,
      currency: "EUR",
    },
    {
      purchase_url: "https://example.test/product",
      status: "available",
      price_eur: 12.5,
      currency: "USD",
    },
  ]) {
    assert.equal(validateCatalogEnrichmentManifest(manifest({ commercial })).ok, false)
  }
})

test("existing enrichment requires an exact current target fingerprint", () => {
  const existing = manifest({
    lifecycle_classification: "existing_product_enrichment",
    target_product_id: "product-1",
    target_fingerprint: "frozen",
    planned_operations: [{ type: "update_product", table: "products" }],
  })
  assert.equal(validateCatalogEnrichmentManifest(existing).ok, true)
  const stale = validateCatalogEnrichmentManifest(existing, {
    id: "product-1",
    fingerprint: "changed",
  })
  assert.equal(stale.ok, false)
  if (!stale.ok) assert.ok(stale.errors.includes("target fingerprint is stale"))
})

test("existing enrichment validates every planned category upsert against the shared validator", () => {
  const base = manifest()
  const existing = {
    lifecycle_classification: "existing_product_enrichment",
    target_product_id: "product-1",
    target_fingerprint: "frozen",
  }

  const valid = validateCatalogEnrichmentManifest(
    manifest({
      ...existing,
      planned_operations: [
        {
          type: "upsert",
          table: "product_heat_protectant_specs",
          rows: [
            {
              product_id: "product-1",
              ...base.category_payload.product_heat_protectant_specs,
            },
          ],
        },
      ],
    }),
  )
  assert.equal(valid.ok, true)

  const malformed = validateCatalogEnrichmentManifest(
    manifest({
      ...existing,
      planned_operations: [
        {
          type: "upsert",
          table: "product_heat_protectant_specs",
          rows: [{ product_id: "product-1", garbage: true }],
        },
      ],
    }),
  )
  assert.equal(malformed.ok, false)
  if (!malformed.ok) {
    assert.ok(
      malformed.errors.includes(
        "existing_product_enrichment planned spec operations do not match shared category validation",
      ),
    )
  }
})

test("duplicate candidates block a proposed new product", () => {
  const result = validateCatalogEnrichmentManifest(
    manifest({ duplicate_check: { candidates: [{ id: "existing" }] } }),
  )
  assert.equal(result.ok, false)
  if (!result.ok)
    assert.ok(result.errors.includes("new_product is blocked by duplicate candidates"))
})

test("unknown schemas and unrelated tables fail closed", () => {
  assert.equal(validateCatalogEnrichmentManifest(manifest({ schema_version: "future" })).ok, false)
  const result = validateCatalogEnrichmentManifest(
    manifest({ planned_operations: [{ type: "delete", table: "user_product_usage" }] }),
  )
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((error) => error.includes("allowlisted")))
})

test("safe manifests reject traversal, user data, secrets, and signed URLs", () => {
  for (const override of [
    { image: { local_asset_path: "../private.webp" } },
    {
      image: {
        local_asset_path: "assets/acme.webp",
        expected_storage_path: "../private.webp",
        final_sha256: "a".repeat(64),
      },
    },
    {
      image: {
        local_asset_path: "assets/acme.webp",
        expected_storage_path: "assets/acme.webp",
        final_sha256: "not-a-hash",
      },
    },
    { user_id: "user-1" },
    { api_token: "private" },
    {
      sources: [
        { label: "source", type: "manufacturer", url: "https://example.test/a?signature=secret" },
      ],
    },
    {
      sources: [
        {
          label: "source",
          type: "manufacturer",
          url: "https://example.test/a?X-Amz-Security-Token=secret",
        },
      ],
    },
  ]) {
    assert.equal(validateCatalogEnrichmentManifest(manifest(override)).ok, false)
  }
  assert.equal(
    isCatalogEnrichmentManifestPath(
      "data/catalog-enrichment/personal-plan-launch-v1/item.json",
      "/repo",
    ),
    true,
  )
  assert.equal(
    isCatalogEnrichmentManifestPath("data/catalog-enrichment/../private.json", "/repo"),
    false,
  )
})

test("approved review binds its exact content fingerprint", () => {
  const pending = manifest()
  const fingerprint = catalogEnrichmentFingerprint({
    ...pending,
    validation: undefined,
    review: undefined,
  })
  assert.equal(
    validateCatalogEnrichmentManifest(
      manifest({ review: { state: "approved", reviewed_content_fingerprint: fingerprint } }),
    ).ok,
    true,
  )
  assert.equal(
    validateCatalogEnrichmentManifest(
      manifest({ review: { state: "approved", reviewed_content_fingerprint: "wrong" } }),
    ).ok,
    false,
  )
})

test("index generation is deterministic and refuses concurrent-key collisions", () => {
  const first = manifest({ product_key: "zeta" })
  const second = manifest({ product_key: "alpha" })
  const index = generateCatalogEnrichmentIndex([first, second] as CatalogEnrichmentManifest[])
  assert.deepEqual(
    index.products.map((item) => item.product_key),
    ["alpha", "zeta"],
  )
  assert.equal(
    index.products.find((item) => item.product_key === "zeta")?.content_fingerprint,
    catalogEnrichmentFingerprint({ ...first, validation: undefined, review: undefined }),
  )
  assert.throws(
    () => generateCatalogEnrichmentIndex([first, first] as CatalogEnrichmentManifest[]),
    /duplicate product_key/,
  )
})

test("preview is always non-writing and never plans user-side effects", () => {
  const result = previewCatalogEnrichment(manifest())
  assert.equal(result.mode, "preview")
  assert.equal(result.writes, false)
  if (!("errors" in result)) {
    assert.equal(result.operations.length, 3)
    assert.equal(result.ready_for_handoff, false)
    assert.equal(result.validation_state, "pending")
    assert.equal(result.review_state, "pending")
    assert.equal(result.disposition_state, "researching")
  }
})

test("preview exposes blockers instead of presenting a blocked manifest as handoff-ready", () => {
  const result = previewCatalogEnrichment(
    manifest({
      validation: { state: "blocked_schema", blockers: ["migration missing"] },
      disposition: { state: "blocked_schema", may_enter_deliverable_b: false },
    }),
  )
  assert.equal("errors" in result, false)
  if (!("errors" in result)) {
    assert.equal(result.ready_for_handoff, false)
    assert.deepEqual(result.blockers, ["migration missing"])
  }
})

test("the frozen contract requires every catalog payload section", () => {
  for (const key of [
    "category_key",
    "commercial",
    "image",
    "product_payload",
    "category_payload",
    "validation",
    "review",
    "disposition",
  ]) {
    const value: Record<string, unknown> = manifest()
    delete value[key]
    assert.equal(validateCatalogEnrichmentManifest(value).ok, false, key)
  }
})

test("catalog_state remains a new-product-only contract", () => {
  for (const lifecycle_classification of ["excluded", "provisional_candidate"]) {
    const value: Record<string, unknown> = manifest({
      lifecycle_classification,
      planned_operations: [],
    })
    delete value.catalog_state
    assert.equal(validateCatalogEnrichmentManifest(value).ok, true, lifecycle_classification)
  }
  const newProduct: Record<string, unknown> = manifest()
  delete newProduct.catalog_state
  assert.equal(validateCatalogEnrichmentManifest(newProduct).ok, false)
})

test("excluded, provisional, and verification manifests cannot plan product inserts", () => {
  for (const lifecycle_classification of [
    "excluded",
    "provisional_candidate",
    "verification_only",
  ]) {
    const result = validateCatalogEnrichmentManifest(manifest({ lifecycle_classification }))
    assert.equal(result.ok, false, lifecycle_classification)
  }
  assert.equal(
    validateCatalogEnrichmentManifest(
      manifest({
        lifecycle_classification: "excluded",
        planned_operations: [],
      }),
    ).ok,
    true,
  )
})
