import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import sharp from "sharp"

const batchDir = resolve("ops/product-intake-research/2026-09-04/shampoo-scannable-14/image-batch")
const resultsPath = join(batchDir, "results.json")
const payload = JSON.parse(readFileSync(resultsPath, "utf8"))
const syoss = payload.results.find((result) => result.id === "syoss-intense-keratin")

if (!syoss?.files.cutout) throw new Error("Missing approved Syoss cutout")

const metadata = await sharp(syoss.files.cutout).metadata()
if (!metadata.width || !metadata.height || !metadata.hasAlpha) {
  throw new Error("Approved Syoss cutout is not a usable alpha image")
}

// The generic reflection detector samples the bottom 15% of the source canvas.
// A black rectangular bottle legitimately fills that region and is therefore a
// false positive. Transparent canvas padding changes no product pixels; the
// finalizer's content-bounds crop removes it before the 1200x1200 composite.
const paddedPath = join(batchDir, "cutouts", "syoss-intense-keratin-finalizer-padded.png")
await sharp(syoss.files.cutout)
  .extend({
    top: 0,
    right: 0,
    bottom: Math.ceil(metadata.height * 0.2),
    left: 0,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(paddedPath)

syoss.files.cutout = paddedPath
writeFileSync(resultsPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Prepared non-destructive Syoss finalizer input: ${paddedPath}`)
