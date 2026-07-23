#!/usr/bin/env node
// Measure the visible alpha bounds for the approved runtime portrait library.
// Usage: node scripts/portrait/measure-bounds.mjs [--assets <directory>]
import { readdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

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
if (files.length !== 21) {
  throw new Error(`Expected exactly 21 .webp portraits in ${assetDir}, found ${files.length}.`)
}

const percent = (value, total) => ((value / total) * 100).toFixed(1)

for (const file of files) {
  const image = sharp(join(assetDir, file))
  const { width, height } = await image.metadata()
  if (!width || !height) throw new Error(`Could not read dimensions for ${file}.`)
  const raw = await image.ensureAlpha().raw().toBuffer()
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (raw[(y * width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX === -1) throw new Error(`${file} contains no visible alpha.`)
  const bounds = `${minX},${minY}–${maxX},${maxY}`
  const percentages = `${percent(minX, width)}%,${percent(minY, height)}%–${percent(maxX + 1, width)}%,${percent(maxY + 1, height)}%`
  console.log(`${file}\t${width}×${height}\talpha ${bounds}\t${percentages}`)
}
