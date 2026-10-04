import assert from "node:assert/strict"
import test from "node:test"

import { mapModuleProjections } from "../../../src/lib/personal-plan/persistence/stage2-refinement-supabase"

const base = { needVersionId: "v-1", projectedAtRevision: 2, stage3Handoff: true }

test("mapModuleProjections keeps the facts_rebase origin on each entry", () => {
  assert.deepEqual(
    mapModuleProjections({
      products: { ...base, origin: "facts_rebase" },
      habits: { ...base, stage3Handoff: false, origin: "facts_rebase" },
    }),
    {
      products: { ...base, origin: "facts_rebase" },
      habits: { ...base, stage3Handoff: false, origin: "facts_rebase" },
    },
  )
})

test("mapModuleProjections drops any other origin value", () => {
  for (const origin of ["user", "FACTS_REBASE", "", 1, null, {}, true]) {
    const mapped = mapModuleProjections({ products: { ...base, origin } })
    assert.deepEqual(mapped, { products: base }, `origin ${JSON.stringify(origin)} must be dropped`)
    assert.equal("origin" in (mapped.products ?? {}), false)
  }
})

test("mapModuleProjections leaves an absent origin absent", () => {
  const mapped = mapModuleProjections({ products: base })
  assert.deepEqual(mapped, { products: base })
  assert.equal("origin" in (mapped.products ?? {}), false)
})

test("mapModuleProjections still skips malformed entries and non-objects", () => {
  assert.deepEqual(mapModuleProjections(null), {})
  assert.deepEqual(mapModuleProjections([]), {})
  assert.deepEqual(
    mapModuleProjections({ products: { origin: "facts_rebase" }, habits: "nope" }),
    {},
  )
})
