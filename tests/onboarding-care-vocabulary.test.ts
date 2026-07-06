import assert from "node:assert/strict"
import test from "node:test"
import {
  NIGHT_PROTECTION_LABELS,
  NIGHT_PROTECTIONS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_MATERIALS,
  TOWEL_TECHNIQUES,
  normalizeNightProtectionValues,
  normalizeTowelTechniqueValue,
} from "../src/lib/vocabulary/onboarding-care"
import { TOWEL_MATERIAL_ICONS } from "../src/components/onboarding/onboarding-display-config"

test("towel technique canonicalizes legacy German values", () => {
  assert.equal(normalizeTowelTechniqueValue("rubbeln"), "rough_rubbing")
  assert.equal(normalizeTowelTechniqueValue("tupfen"), "gentle_press")
})

test("towel technique options expose language-independent data keys", () => {
  assert.deepEqual(TOWEL_TECHNIQUES, ["rough_rubbing", "gentle_press"])
})

test("towel material options include no towel as the final explicit option", () => {
  assert.deepEqual(TOWEL_MATERIALS, [
    "frottee",
    "mikrofaser",
    "tshirt",
    "turban_mikrofaser",
    "no_towel",
  ])
  assert.equal(
    TOWEL_MATERIAL_LABELS.no_towel,
    "Kein Handtuch: Ich lasse meine Haare tropfnass trocknen",
  )
  assert.equal(TOWEL_MATERIAL_ICONS.no_towel, "drying-air")
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

test("night protection options include length tip accessory and remove tight hairstyles", () => {
  assert.deepEqual(NIGHT_PROTECTIONS, [
    "silk_satin_pillow",
    "silk_satin_bonnet",
    "loose_tied",
    "pineapple",
    "length_tip_accessory",
  ])
  assert.equal(
    NIGHT_PROTECTION_LABELS.length_tip_accessory,
    "Längen-/Spitzenschutz (z. B. HairHOMIE)",
  )
  assert.equal(NIGHT_PROTECTION_LABELS.silk_satin_bonnet, "Bonnet / Schlafhaube")
  assert.equal(NIGHT_PROTECTION_LABELS.pineapple, "Pineapple")
  assert.ok(!NIGHT_PROTECTIONS.includes("tight_hairstyles" as never))
})

test("night protection normalization drops legacy tight hairstyles", () => {
  assert.deepEqual(normalizeNightProtectionValues(["tight_hairstyles"]), [])
  assert.deepEqual(normalizeNightProtectionValues(["silk_satin_pillow", "tight_hairstyles"]), [
    "silk_satin_pillow",
  ])
})
