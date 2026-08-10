import assert from "node:assert/strict"
import test from "node:test"

import { classifyBondbuilderRelationship } from "../../../src/lib/personal-plan/products/authority/catalog-facts"

test("classifies active Bondbuilders without an add-on relationship as standalone", () => {
  assert.equal(classifyBondbuilderRelationship([]), "standalone")
  assert.equal(
    classifyBondbuilderRelationship([{ relationship_type: "replaced_by" }]),
    "standalone",
  )
})

test("classifies an add_on_for Bondbuilder as a companion", () => {
  assert.equal(classifyBondbuilderRelationship([{ relationship_type: "add_on_for" }]), "add_on")
})
