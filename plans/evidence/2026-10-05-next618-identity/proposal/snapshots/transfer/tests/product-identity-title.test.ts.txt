import assert from "node:assert/strict"
import test from "node:test"

import { composeProductIdentityTitle } from "../src/lib/product-identity/display-title"

test("product identity title composes brand, line and name without visible duplication", () => {
  assert.equal(
    composeProductIdentityTitle({
      brand: "Neqi",
      productLine: "NEQI x @_the.beautiful.people",
      name: "Leave-In Moisturizing Mist",
    }),
    "NEQI x @_the.beautiful.people Leave-In Moisturizing Mist",
  )
  assert.equal(
    composeProductIdentityTitle({
      brand: "Garnier Wahre Schätze",
      productLine: "Wahre Schätze",
      name: "Honig Schätze Shampoo",
    }),
    "Garnier Wahre Schätze Honig Schätze Shampoo",
  )
  assert.equal(
    composeProductIdentityTitle({
      brand: "Syoss",
      productLine: "Intense Fullness",
      name: "Syoss Intense Fullness Shampoo",
    }),
    "Syoss Intense Fullness Shampoo",
  )
})

test("product identity title ignores blank identity parts", () => {
  assert.equal(
    composeProductIdentityTitle({ brand: "  ", productLine: null, name: "Repair Shampoo" }),
    "Repair Shampoo",
  )
})
