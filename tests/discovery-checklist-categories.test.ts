import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_INTAKE_CATEGORY_COPY,
  DISCOVERY_INTAKE_CATEGORY_COUNT,
  DISCOVERY_INTAKE_GROUPS,
} from "../src/components/discovery/intake/categories"
import { DISCOVERY_INTAKE_CATEGORIES } from "../src/lib/discovery/intake"

/**
 * The checklist's display grouping is UI-only, but it is still load-bearing:
 * completeness is derived from the ten category keys, and the participant can
 * only answer what the four groups put on screen.
 */

test("the checklist's display groups cover every category exactly once", () => {
  // Completeness is derived from the ten category keys, but the participant can
  // only answer what the four groups put on screen: a key missing from the groups
  // would make „Absenden" unreachable, and a duplicate would double-count nothing
  // while showing the same row twice.
  const grouped = DISCOVERY_INTAKE_GROUPS.flatMap((group) =>
    group.categories.map((category) => category.key),
  )
  assert.equal(grouped.length, DISCOVERY_INTAKE_CATEGORY_COUNT)
  assert.deepEqual([...grouped].sort(), [...DISCOVERY_INTAKE_CATEGORIES].sort())
  assert.equal(new Set(grouped).size, grouped.length)
  assert.equal(DISCOVERY_INTAKE_CATEGORY_COUNT, DISCOVERY_INTAKE_CATEGORIES.length)

  // Every row also needs its German gender, or the headings read wrong.
  for (const key of DISCOVERY_INTAKE_CATEGORIES) {
    const copy = DISCOVERY_INTAKE_CATEGORY_COPY[key]
    assert.ok(copy, `no checklist copy for ${key}`)
    assert.ok(copy.label.length > 0)
    assert.match(copy.possessive, /^Dein(e)?$/)
    assert.match(copy.interrogative, /^Welche(s|n)?$/)
  }
})
