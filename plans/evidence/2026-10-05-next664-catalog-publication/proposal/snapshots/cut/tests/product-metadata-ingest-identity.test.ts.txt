import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeCommercialFields,
  parseProductIdentityAliases,
  resolveProductIdentity,
  type ExistingProduct,
} from "../src/lib/product-metadata/ingest-identity"

const existingProduct: ExistingProduct = {
  id: "existing-id",
  category: "Leave-in",
  affiliate_link: "https://example.com/old",
  image_url: "https://example.com/old.jpg",
  price_eur: 12.99,
}

test("resolveProductIdentity fails closed when explicit id is missing", async () => {
  await assert.rejects(
    resolveProductIdentity(
      { id: "missing-id", name: "Known Product", category: "Leave-in" },
      new Map(),
      {
        findProductById: async () => null,
        findProductByNameCategory: async () => existingProduct,
      },
    ),
    /Explicit product id missing-id/,
  )
})

test("resolveProductIdentity fails closed when alias points to a missing row", async () => {
  const aliases = parseProductIdentityAliases(
    JSON.stringify([
      {
        id: "missing-alias-id",
        aliases: [{ name: "Alias Product", category: "Conditioner" }],
      },
    ]),
  )

  await assert.rejects(
    resolveProductIdentity({ name: "Alias Product", category: "Conditioner" }, aliases, {
      findProductById: async () => null,
      findProductByNameCategory: async () => existingProduct,
    }),
    /resolves to missing id missing-alias-id/,
  )
})

test("resolveProductIdentity falls back to name/category when no explicit id or alias exists", async () => {
  const resolution = await resolveProductIdentity(
    { name: "Known Product", category: "Leave-in" },
    new Map(),
    {
      findProductById: async () => {
        throw new Error("id lookup should not run")
      },
      findProductByNameCategory: async () => existingProduct,
    },
  )

  assert.equal(resolution.source, "name_category")
  assert.equal(resolution.product?.id, "existing-id")
})

test("mergeCommercialFields preserves existing commercial fields unless force overwrite is set", () => {
  assert.deepEqual(
    mergeCommercialFields(
      existingProduct,
      { affiliate_link: "", image_url: "   ", price_eur: undefined },
      false,
    ),
    {
      affiliate_link: "https://example.com/old",
      image_url: "https://example.com/old.jpg",
      price_eur: 12.99,
    },
  )

  assert.deepEqual(
    mergeCommercialFields(
      existingProduct,
      { affiliate_link: undefined, image_url: null, price_eur: undefined },
      true,
    ),
    {
      affiliate_link: null,
      image_url: null,
      price_eur: null,
    },
  )
})
