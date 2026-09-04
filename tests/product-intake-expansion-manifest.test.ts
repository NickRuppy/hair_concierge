import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  deriveRequiredProtocolRoles,
  validateExpansionManifest,
  type ExpansionManifestValidationReport,
} from "../src/lib/product-intake/expansion-manifest"

const FIXTURES_DIR = path.join(__dirname, "fixtures", "expansion-manifest")

async function loadFixture(name: string): Promise<unknown> {
  const contents = await readFile(path.join(FIXTURES_DIR, `${name}.json`), "utf8")
  return JSON.parse(contents)
}

function allViolations(report: ExpansionManifestValidationReport): string[] {
  return [
    ...report.envelopeViolations,
    ...report.products.flatMap((product) => product.violations),
    ...report.existingProductUpdates.flatMap((update) => update.violations),
  ]
}

function assertSomeViolation(report: ExpansionManifestValidationReport, needle: string) {
  const violations = allViolations(report)
  const found = violations.some((violation) => violation.includes(needle))
  assert.ok(found, `expected a violation containing "${needle}", got:\n${violations.join("\n")}`)
}

test("valid-manifest.json: all products and existing_product_updates pass, no false positives", async () => {
  const raw = await loadFixture("valid-manifest")
  const report = validateExpansionManifest(raw)

  assert.equal(report.envelopeViolations.length, 0, report.envelopeViolations.join("\n"))
  for (const product of report.products) {
    assert.equal(
      product.status,
      "pass",
      `products[${product.index}] (${product.label}) unexpectedly failed:\n${product.violations.join("\n")}`,
    )
  }
  for (const update of report.existingProductUpdates) {
    assert.equal(
      update.status,
      "pass",
      `existing_product_updates[${update.index}] unexpectedly failed:\n${update.violations.join("\n")}`,
    )
  }
  assert.equal(report.ok, true)
  assert.equal(report.summary.totalProducts, 5)
  assert.equal(report.summary.productsPassed, 5)
  assert.equal(report.summary.productsFailed, 0)
  assert.equal(report.deviationFlagged.length, 0)
  assert.equal(report.excludedEans.length, 0)
  assert.equal(report.duplicateEans.length, 0)
})

test("bad-check-digit.json fails on the EAN's GS1 check digit", async () => {
  const report = validateExpansionManifest(await loadFixture("bad-check-digit"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "GS1 mod-10 check digit")
})

test("is-chaarlie-recommended-true.json fails the schema-level hard pin (R3)", async () => {
  const report = validateExpansionManifest(await loadFixture("is-chaarlie-recommended-true"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "final.product.is_chaarlie_recommended")
})

test("missing-runtime-consumed-field.json fails F-03 non-null tightening (shampoo cleansing_intensity)", async () => {
  const report = validateExpansionManifest(await loadFixture("missing-runtime-consumed-field"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(
    report,
    "final.category_specs.product_shampoo_specs.0.cleansing_intensity: runtime-consumed field must not be null (F-03)",
  )
})

test("missing-protocol-source-text.json fails on protocol.product_source.text", async () => {
  const report = validateExpansionManifest(await loadFixture("missing-protocol-source-text"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "final.protocols.0.product_source.text")
})

test("mask-without-contact-time.json fails: TPL-MASK requires contact_time", async () => {
  const report = validateExpansionManifest(await loadFixture("mask-without-contact-time"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "TPL-MASK protocols require contact_time")
})

test("heat-without-usable-on-dry-hair.json fails: heat templates require usable_on_dry_hair", async () => {
  const report = validateExpansionManifest(await loadFixture("heat-without-usable-on-dry-hair"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(
    report,
    "final.protocols.1.usable_on_dry_hair: TPL-LEAVEIN-HEAT protocols require usable_on_dry_hair",
  )
})

test("unknown-template-id.json fails on an unrecognized template_id enum value", async () => {
  const report = validateExpansionManifest(await loadFixture("unknown-template-id"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "final.protocols.0.template_id")
})

test("empty-thickness-eligibility.json fails: thickness_eligibility must be non-empty", async () => {
  const report = validateExpansionManifest(await loadFixture("empty-thickness-eligibility"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "fail")
  assertSomeViolation(report, "final.thickness_eligibility")
})

test("existing-product-update-no-action.json fails: at least one action required", async () => {
  const report = validateExpansionManifest(await loadFixture("existing-product-update-no-action"))
  assert.equal(report.ok, false)
  assert.equal(report.products[0].status, "pass")
  assert.equal(report.existingProductUpdates[0].status, "fail")
  assertSomeViolation(report, "existing_product_updates entry requires at least one action")
})

test("cross-product duplicate EANs are flagged and fail the manifest", () => {
  const manifestWithDuplicateEan = JSON.parse(
    JSON.stringify({
      batch_id: "S5-EXP-duplicate-ean-check",
      generated_at: "2026-09-02T09:00:00.000Z",
      products: [],
      existing_product_updates: [
        {
          product_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          add_identifiers: [
            {
              type: "ean",
              value: "4001234567891",
              cross_source_agreement: true,
              source_urls: ["https://www.dm.de/a"],
              excluded_from_apply: false,
            },
          ],
        },
        {
          product_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          add_identifiers: [
            {
              type: "ean",
              value: "4001234567891",
              cross_source_agreement: true,
              source_urls: ["https://www.dm.de/b"],
              excluded_from_apply: false,
            },
          ],
        },
      ],
    }),
  )

  const report = validateExpansionManifest(manifestWithDuplicateEan)
  assert.equal(report.duplicateEans.length, 1)
  assert.equal(report.duplicateEans[0].value, "4001234567891")
  assert.equal(report.ok, false)
})

test("deriveRequiredProtocolRoles: oil ignores the legacy heat role and derives only real purposes", () => {
  const roles = deriveRequiredProtocolRoles("oil", {
    product_oil_specs: {
      role_support: ["leave_on_fibre_conditioning", "pre_heat_protection"],
      provides_heat_protection: true,
    },
  })
  assert.deepEqual(roles, ["leave_on_fibre_conditioning"])
})

test("oil expansion requires an explicit heat capability flag", async () => {
  const raw = (await loadFixture("valid-manifest")) as {
    products: Array<{
      final: {
        product: { category_key: string }
        category_specs: { product_oil_specs?: { provides_heat_protection?: boolean } }
      }
    }>
  }
  const oil = raw.products.find((item) => item.final.product.category_key === "oil")!
  delete oil.final.category_specs.product_oil_specs!.provides_heat_protection
  const report = validateExpansionManifest(raw)

  assert.equal(report.ok, false)
  assertSomeViolation(report, "final.category_specs.product_oil_specs")
})

test("oil expansion rejects pre_heat_protection as a fourth purpose", async () => {
  const raw = (await loadFixture("valid-manifest")) as {
    products: Array<{
      final: {
        product: { category_key: string }
        category_specs: {
          product_oil_specs?: {
            role_support: string[]
            provides_heat_protection?: boolean
          }
        }
        protocols: unknown[]
      }
    }>
  }
  const oil = raw.products.find((item) => item.final.product.category_key === "oil")!
  oil.final.category_specs.product_oil_specs!.provides_heat_protection = true
  oil.final.category_specs.product_oil_specs!.role_support.push("pre_heat_protection")
  const report = validateExpansionManifest(raw)
  assert.equal(report.ok, false)
  assertSomeViolation(report, "final.category_specs.product_oil_specs")
})

test("deriveRequiredProtocolRoles: leave_in requires pre_heat_protection only when provides_heat_protection is true", () => {
  assert.deepEqual(
    deriveRequiredProtocolRoles("leave_in", {
      product_leave_in_specs: { provides_heat_protection: false },
    }),
    ["post_wash_leave_in"],
  )
  assert.deepEqual(
    deriveRequiredProtocolRoles("leave_in", {
      product_leave_in_specs: { provides_heat_protection: true },
    }),
    ["post_wash_leave_in", "pre_heat_protection"],
  )
})
