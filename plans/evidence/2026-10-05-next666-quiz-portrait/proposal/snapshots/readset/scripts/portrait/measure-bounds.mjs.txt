#!/usr/bin/env node
// Measure the visible alpha bounds for the approved runtime portrait library.
// Usage: node scripts/portrait/measure-bounds.mjs [--assets <directory>]
import { readdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { measureHairFill } from "./measure-hair-fill.mjs"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "../..")
const defaultAssets = join(repoRoot, "public/images/quiz/hair-portrait")
const args = process.argv.slice(2)

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/portrait/measure-bounds.mjs [--assets <directory>]")
  console.log(`Default assets directory: ${defaultAssets}`)
  process.exit(0)
}

const assetFlag = args.indexOf("--assets")
if (assetFlag !== -1 && (!args[assetFlag + 1] || args.length !== 2)) {
  console.error("usage: measure-bounds.mjs [--assets <directory>]")
  process.exit(1)
}
if (assetFlag === -1 && args.length > 0) {
  console.error("usage: measure-bounds.mjs [--assets <directory>]")
  process.exit(1)
}

const assetDir = assetFlag === -1 ? defaultAssets : resolve(args[assetFlag + 1])
const files = readdirSync(assetDir)
  .filter((file) => file.endsWith(".webp"))
  .sort()
if (assetFlag === -1 && files.length !== 21) {
  throw new Error(`Expected exactly 21 .webp portraits in ${assetDir}, found ${files.length}.`)
}
if (files.length === 0) throw new Error(`No .webp portraits found in ${assetDir}.`)

const percent = (value, total) => ((value / total) * 100).toFixed(1)

for (const file of files) {
  const measurement = await measureHairFill(join(assetDir, file))
  const { width, height, top, bottom, maxWidth, alphaBottom } = measurement
  console.log(
    [
      file,
      `${width}×${height}`,
      `hair ${top}–${bottom}`,
      `${percent(top, height)}%–${percent(bottom + 1, height)}%`,
      `max-width ${maxWidth}`,
      `alpha-bottom ${alphaBottom}`,
    ].join("\t"),
  )
}
