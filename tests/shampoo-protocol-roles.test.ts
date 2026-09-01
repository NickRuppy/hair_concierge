import assert from "node:assert/strict"
import test from "node:test"

import { deriveShampooProtocolRoles } from "../src/lib/product-intake/shampoo-protocol-roles"

test("Shampoo protocol roles are derived only from canonical reviewed buckets", () => {
  assert.deepEqual(deriveShampooProtocolRoles(["schuppen"]), ["shampoo_dandruff"])
  assert.deepEqual(deriveShampooProtocolRoles(["normal"]), ["shampoo_everyday"])
  assert.deepEqual(deriveShampooProtocolRoles(["schuppen", "trocken", "schuppen"]), [
    "shampoo_dandruff",
    "shampoo_everyday",
  ])
  assert.deepEqual(deriveShampooProtocolRoles([null, "", "legacy-drift"]), [])
})
