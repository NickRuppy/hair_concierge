import assert from "node:assert/strict"
import test from "node:test"
import {
  NIGHT_PROTECTIONS,
  TOWEL_TECHNIQUES,
  normalizeNightProtectionValues,
  normalizeTowelTechniqueValue,
} from "../src/lib/vocabulary/onboarding-care"

test("towel technique canonicalizes legacy German values", () => {
  assert.equal(normalizeTowelTechniqueValue("rubbeln"), "rough_rubbing")
  assert.equal(normalizeTowelTechniqueValue("tupfen"), "gentle_press")
})

test("towel technique options expose language-independent data keys", () => {
  assert.deepEqual(TOWEL_TECHNIQUES, ["rough_rubbing", "gentle_press"])
})

test("night protection canonicalizes legacy loose braid and bun values", () => {
  assert.deepEqual(normalizeNightProtectionValues(["loose_braid"]), ["loose_tied"])
  assert.deepEqual(normalizeNightProtectionValues(["loose_bun"]), ["loose_tied"])
  assert.deepEqual(normalizeNightProtectionValues(["loose_braid", "loose_bun"]), ["loose_tied"])
})

test("night protection options expose only the canonical loose tied value", () => {
  assert.ok(NIGHT_PROTECTIONS.includes("loose_tied"))
  assert.ok(!NIGHT_PROTECTIONS.includes("loose_braid" as never))
  assert.ok(!NIGHT_PROTECTIONS.includes("loose_bun" as never))
})
