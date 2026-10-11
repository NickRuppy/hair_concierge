import assert from "node:assert/strict"
import test from "node:test"

import {
  loadVisibleHairColor,
  readUserVisibleHairColor,
} from "../src/lib/user-facts/visible-hair-color"

const userProvenance = { care_habits: { fields: { dryShampooVisibleHairColor: "user" } } }

test("visible hair colour: a user-answered value is returned", () => {
  assert.equal(
    readUserVisibleHairColor({ dryShampooVisibleHairColor: "brown" }, userProvenance),
    "brown",
  )
})

test("visible hair colour: assumed or historical provenance is ignored", () => {
  for (const provenance of ["assumed", "unknown_historical"]) {
    assert.equal(
      readUserVisibleHairColor(
        { dryShampooVisibleHairColor: "light_blonde" },
        { care_habits: { fields: { dryShampooVisibleHairColor: provenance } } },
      ),
      null,
    )
  }
})

test("visible hair colour: invalid, missing or malformed values return null", () => {
  assert.equal(
    readUserVisibleHairColor({ dryShampooVisibleHairColor: "red" }, userProvenance),
    null,
  )
  assert.equal(readUserVisibleHairColor({}, userProvenance), null)
  assert.equal(readUserVisibleHairColor(null, userProvenance), null)
  assert.equal(readUserVisibleHairColor({ dryShampooVisibleHairColor: "dark" }, null), null)
  assert.equal(readUserVisibleHairColor({ dryShampooVisibleHairColor: "dark" }, {}), null)
  assert.equal(readUserVisibleHairColor("brown", userProvenance), null)
})

function fakeClient(result: { data?: unknown; error?: unknown } | Error) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      if (result instanceof Error) throw result
      return { data: result.data ?? null, error: result.error ?? null }
    },
  }
  return { from: () => builder } as never
}

test("visible hair colour loader reads care habits with provenance", async () => {
  const color = await loadVisibleHairColor(
    fakeClient({
      data: {
        care_habits: { dryShampooVisibleHairColor: "dark" },
        facts_provenance: userProvenance,
      },
    }),
    "user-1",
  )
  assert.equal(color, "dark")
})

test("visible hair colour loader fails open on read errors and missing rows", async () => {
  assert.equal(await loadVisibleHairColor(fakeClient({ error: { message: "boom" } }), "u"), null)
  assert.equal(await loadVisibleHairColor(fakeClient({ data: null }), "u"), null)
  assert.equal(await loadVisibleHairColor(fakeClient(new Error("network")), "u"), null)
})
