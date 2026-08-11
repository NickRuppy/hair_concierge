import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/ops/catalog-repairs/2026-08-11-ogx-search-identities",
)

const productIds = [
  "3f3c7d89-9e7b-4e91-85f7-d3c58d304918",
  "bef4f219-2c1f-4e02-8e3a-93056b95465a",
  "7b5ec424-d21f-4eb8-999e-7aed98e94b86",
]

const targetIdentities = [
  {
    line: "Thick & Full +",
    name: "Biotin & Collagen Shampoo",
    displayName: "Thick & Full + Biotin & Collagen Shampoo",
    currentName: "OGX Biotin & Collagen",
    imageFingerprint: "ogx-ogx-biotin-collagen-89197267cf81.webp",
  },
  {
    line: "Strength & Length +",
    name: "Keratin Oil Shampoo",
    displayName: "Strength & Length + Keratin Oil Shampoo",
    currentName: "OGX Keratin Oil",
    imageFingerprint: "ogx-ogx-keratin-oil-c2bde030beb2.webp",
  },
  {
    line: "Refreshing Scalp +",
    name: "Rosemary Mint Shampoo",
    displayName: "Refreshing Scalp + Rosemary Mint Shampoo",
    currentName: "OGX Rosemary",
    imageFingerprint: "ogx-ogx-rosemary-c14a74393fc0.webp",
  },
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

test("escapeRegExp escapes every JavaScript regular-expression metacharacter", () => {
  const value = String.raw`OGX \\ Thick & Full + (Shampoo)? [385ml].*`
  assert.match(value, new RegExp(`^${escapeRegExp(value)}$`))
})

test("OGX search identity repair package is guarded, source-scoped, and rollbackable", async () => {
  const before = JSON.parse(await readFile(path.join(directory, "before.json"), "utf8")) as {
    brand: { id: string; canonicalName: string }
    products: Array<{
      id: string
      current: { name: string; productLineId: null; imagePathFingerprint: string }
      target: { productLine: string; name: string; stage3DisplayName: string }
    }>
    privacy: Record<string, boolean>
    scope: {
      notMigration: boolean
      productionWritePrepared: boolean
      productColumnsAllowed: string[]
    }
  }
  const [repair, rollback, readme] = await Promise.all(
    ["repair.sql", "rollback.sql", "README.md"].map((file) =>
      readFile(path.join(directory, file), "utf8"),
    ),
  )

  assert.equal(before.brand.id, "3bef8ddb-49c4-47a4-9103-faca256bb34a")
  assert.equal(before.brand.canonicalName, "OGX")
  assert.equal(before.scope.notMigration, true)
  assert.equal(before.scope.productionWritePrepared, false)
  assert.deepEqual(before.scope.productColumnsAllowed, ["name", "product_line_id"])
  assert.deepEqual(
    before.products.map((product) => product.id),
    productIds,
  )
  for (const [index, identity] of targetIdentities.entries()) {
    const product = before.products[index]
    assert.equal(product.current.name, identity.currentName)
    assert.equal(product.current.productLineId, null)
    assert.equal(product.current.imagePathFingerprint, identity.imageFingerprint)
    assert.equal(product.target.productLine, identity.line)
    assert.equal(product.target.name, identity.name)
    assert.equal(product.target.stage3DisplayName, identity.displayName)
    assert.match(repair, new RegExp(escapeRegExp(identity.currentName)))
    assert.match(repair, new RegExp(escapeRegExp(identity.imageFingerprint)))
    assert.match(repair, new RegExp(escapeRegExp(identity.line)))
    assert.match(repair, new RegExp(escapeRegExp(identity.name)))
    assert.match(rollback, new RegExp(escapeRegExp(identity.currentName)))
    assert.match(rollback, new RegExp(escapeRegExp(identity.line)))
    assert.match(rollback, new RegExp(escapeRegExp(identity.name)))
    assert.match(readme, new RegExp(escapeRegExp(identity.displayName)))
  }
  assert.equal(before.privacy.containsUserIds, false)
  assert.equal(before.privacy.containsEmail, false)
  assert.equal(before.privacy.containsRawUserText, false)
  assert.equal(before.privacy.containsUserHistory, false)

  assert.match(repair, /BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE/)
  assert.match(repair, /pg_advisory_xact_lock/)
  assert.match(repair, /catalog-repair:2026-08-11-ogx-search-identities/)
  assert.match(repair, /brand_id = v_brand_id/)
  assert.match(repair, /product_line_id IS NULL/)
  assert.match(repair, /category_key = 'shampoo'/)
  assert.match(repair, /is_active = true/)
  assert.match(repair, /lifecycle_status = 'active'/)
  assert.match(repair, /INSERT INTO public\.product_lines/)
  assert.match(repair, /product_intake_review_normalize_identity_text/)
  assert.match(
    repair,
    /UPDATE public\.products\s+SET name = v_biotin_name, product_line_id = v_thick_full_line_id/,
  )
  assert.match(
    repair,
    /UPDATE public\.products\s+SET name = v_keratin_name, product_line_id = v_strength_length_line_id/,
  )
  assert.match(
    repair,
    /UPDATE public\.products\s+SET name = v_rosemary_name, product_line_id = v_refreshing_scalp_line_id/,
  )
  assert.match(repair, /search identity repair postcondition failed/)

  assert.match(rollback, /BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE/)
  assert.match(rollback, /search identity rollback post-state guard failed/)
  assert.match(rollback, /SET name = 'OGX Biotin & Collagen', product_line_id = NULL/)
  assert.match(rollback, /DELETE FROM public\.product_lines pl/)
  assert.match(
    rollback,
    /NOT EXISTS \(SELECT 1 FROM public\.products p WHERE p\.product_line_id = pl\.id\)/,
  )
  assert.match(
    rollback,
    /NOT EXISTS \(SELECT 1 FROM public\.brand_aliases a WHERE a\.product_line_id = pl\.id\)/,
  )
  assert.match(rollback, /search identity rollback final postcondition failed/)

  const mutableSql = `${repair}\n${rollback}`
  assert.doesNotMatch(mutableSql, /DELETE FROM public\.products/i)
  assert.doesNotMatch(
    mutableSql,
    /user_products|product_submissions|intake_history|personal_plan_product_drafts|personal_plans/i,
  )
  assert.doesNotMatch(mutableSql, /updated_at/i)
  assert.doesNotMatch(mutableSql, /CREATE OR REPLACE FUNCTION/i)
  assert.match(readme, /no database change has been made/)
  assert.match(readme, /not a migration/)
})
