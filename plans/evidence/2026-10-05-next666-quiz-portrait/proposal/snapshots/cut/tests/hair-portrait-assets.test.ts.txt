import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  GENERIC_PORTRAIT_ASSET,
  PORTRAIT_ASSET_MANIFEST,
  PORTRAIT_MARKER_KEYS,
  resolveHairPortraitAsset,
} from "../src/lib/quiz/hair-portrait-assets"
import { derivePortraitConfig } from "../src/lib/quiz/portrait-config"
import type { PortraitHairPattern, PortraitLength } from "../src/lib/quiz/portrait-config"
import type { QuizAnswers } from "../src/lib/quiz/types"

const textures: PortraitHairPattern[] = ["straight", "wavy", "curly", "coily"]
const lengths: PortraitLength[] = ["very_short", "short", "medium", "long", "very_long"]

function required(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    structure: "wavy",
    density: "medium",
    hair_length: "medium",
    treatment: ["natur"],
    ...overrides,
  }
}

test("portrait manifest resolves every texture and length to its exact runtime filename", () => {
  for (const texture of textures) {
    for (const length of lengths) {
      const config = derivePortraitConfig(required({ structure: texture, hair_length: length }))
      const asset = resolveHairPortraitAsset(config)
      const filename = `${texture}-${length.replace("_", "-")}.webp`

      assert.equal(asset.src, `/images/quiz/hair-portrait/${filename}`)
    }
  }
})

test("portrait manifest has exactly the 20 personalized assets and the 21 runtime WebPs", () => {
  const expectedFiles = new Set([
    "generic.webp",
    ...textures.flatMap((texture) =>
      lengths.map((length) => `${texture}-${length.replace("_", "-")}.webp`),
    ),
  ])
  const runtimeFiles = new Set(
    readdirSync(join(process.cwd(), "public/images/quiz/hair-portrait")).filter((file) =>
      file.endsWith(".webp"),
    ),
  )
  const manifestFiles = new Set([
    GENERIC_PORTRAIT_ASSET.src.split("/").at(-1),
    ...Object.values(PORTRAIT_ASSET_MANIFEST).map((asset) => asset.src.split("/").at(-1)),
  ])

  assert.equal(Object.keys(PORTRAIT_ASSET_MANIFEST).length, 20)
  assert.deepEqual(runtimeFiles, expectedFiles)
  assert.deepEqual(manifestFiles, expectedFiles)
})

test("only the three approved pixies own their body line", () => {
  const ownBodyKeys = Object.entries(PORTRAIT_ASSET_MANIFEST)
    .filter(([, asset]) => asset.ownBody)
    .map(([key]) => key)
    .sort()

  assert.deepEqual(ownBodyKeys, ["curly-very-short", "straight-very-short", "wavy-very-short"])
  assert.equal(GENERIC_PORTRAIT_ASSET.ownBody, false)
})

test("every portrait entry has exactly three mobile-safe marker button centres", () => {
  for (const [key, asset] of Object.entries({
    generic: GENERIC_PORTRAIT_ASSET,
    ...PORTRAIT_ASSET_MANIFEST,
  })) {
    assert.deepEqual(Object.keys(asset.markers).sort(), [...PORTRAIT_MARKER_KEYS].sort(), key)

    for (const marker of PORTRAIT_MARKER_KEYS) {
      const point = asset.markers[marker]
      assert.ok(point.x >= 18 && point.x <= 82, `${key} ${marker} x must be mobile-safe`)
      assert.ok(point.y >= 18 && point.y <= 82, `${key} ${marker} y must be mobile-safe`)
    }
  }
})

test("resolver uses the config's already-normalized treated pattern and generic fallback", () => {
  const perm = derivePortraitConfig(
    required({ structure: "straight", hair_length: "long", treatment: ["dauerwelle"] }),
  )
  const straightened = derivePortraitConfig(
    required({ structure: "curly", hair_length: "short", treatment: ["chemisch_geglaettet"] }),
  )
  const conflicting = derivePortraitConfig(
    required({
      structure: "coily",
      hair_length: "medium",
      treatment: ["dauerwelle", "chemisch_geglaettet"],
    }),
  )

  assert.equal(resolveHairPortraitAsset(perm).src, "/images/quiz/hair-portrait/curly-long.webp")
  assert.equal(
    resolveHairPortraitAsset(straightened).src,
    "/images/quiz/hair-portrait/straight-short.webp",
  )
  assert.equal(
    resolveHairPortraitAsset(conflicting).src,
    "/images/quiz/hair-portrait/coily-medium.webp",
  )
  assert.equal(
    resolveHairPortraitAsset(derivePortraitConfig(required({ density: undefined }))),
    GENERIC_PORTRAIT_ASSET,
  )
})
