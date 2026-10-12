import assert from "node:assert/strict"
import test from "node:test"

import {
  CONSULT_SOURCE_PART_KEYS,
  changedConsultSourceParts,
  consultSourceParts,
} from "../src/lib/discovery/consult-brief/hash"
import type { ConsultInput } from "../src/lib/discovery/consult-brief/input"
import { consultGoldenProfile, consultGoldenSource } from "./fixtures/consult-brief/golden-profiles"

/**
 * consult-brief-d item 3: a stale brief says WHAT changed. The input is fingerprinted per part
 * a consultant recognises; every input key belongs to exactly one part, so no change can move
 * the brief's hash without naming a part.
 */

const nomi = consultGoldenSource(consultGoldenProfile("nomi"))

test("every ConsultInput key belongs to exactly one part", () => {
  const assigned = Object.values(CONSULT_SOURCE_PART_KEYS).flat()
  assert.equal(new Set(assigned).size, assigned.length, "a key in two parts")
  assert.deepEqual([...assigned].sort(), Object.keys(nomi.input).sort())
})

test("the source carries the parts it was assembled from", () => {
  assert.deepEqual(nomi.sourceParts, consultSourceParts(nomi.input))
})

test("a changed product names „Produkte & Entscheidungen“ and nothing else", () => {
  const before = consultSourceParts(nomi.input)
  const input: ConsultInput = {
    ...nomi.input,
    products: nomi.input.products.map((product, index) =>
      index === 0 ? { ...product, decision: "swap" } : product,
    ),
  }
  assert.deepEqual(changedConsultSourceParts(before, consultSourceParts(input)), [
    "Produkte & Entscheidungen",
  ])
})

test("a new score and a new prompt version are named in display order", () => {
  const before = consultSourceParts(nomi.input)
  const after = consultSourceParts({ ...nomi.input, baselineScore: 6.5 }, "consult-brief-v999")
  assert.deepEqual(changedConsultSourceParts(before, after), ["Ausgangswert", "Brief-Vorlage"])
})

test("unchanged input names nothing; a brief stored without parts names nothing", () => {
  const parts = consultSourceParts(nomi.input)
  assert.deepEqual(changedConsultSourceParts(parts, consultSourceParts(nomi.input)), [])
  assert.deepEqual(changedConsultSourceParts(undefined, parts), [])
  assert.deepEqual(changedConsultSourceParts(parts, null), [])
})
