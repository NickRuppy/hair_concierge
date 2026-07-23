// Remove in-image body linework so PNGs become hair-only assets.
// Rule: a non-background pixel is body linework if there is NO lilac hair-fill pixel
// within RADIUS px of it (hair outline + interior lines always sit next to fill;
// isolated thin strokes = neck/shoulders/collar residue). Also converts any remaining
// opaque near-cream pixels to background (fixes the "necklace" residue class).
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "out")
const RADIUS = 5
const names = process.argv.slice(2)
if (!names.length) {
  console.error("usage: strip-body.mjs <name...>")
  process.exit(1)
}

const nearCream = (r, g, b) =>
  Math.abs(r - 250) <= 12 && Math.abs(g - 248) <= 12 && Math.abs(b - 245) <= 12
// lilac fill family incl. shade + crescent: cool-tinted light pixels
const isFill = (r, g, b) => {
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.84 && b >= r - 2 && b - g >= 2 && !nearCream(r, g, b)
}

for (const name of names) {
  const path = join(DIR, `${name}.png`)
  const img = sharp(readFileSync(path))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()

  // downsampled fill-proximity map: mark blocks containing fill, then dilate by RADIUS
  const BS = 8
  const bw = Math.ceil(width / BS),
    bh = Math.ceil(height / BS)
  const fillBlocks = new Uint8Array(bw * bh)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (isFill(raw[o], raw[o + 1], raw[o + 2]))
        fillBlocks[Math.floor(y / BS) * bw + Math.floor(x / BS)] = 1
    }
  }
  const reach = Math.ceil(RADIUS / BS) + 1
  const nearFill = new Uint8Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let found = 0
      for (let dy = -reach; dy <= reach && !found; dy++) {
        for (let dx = -reach; dx <= reach && !found; dx++) {
          const ny = by + dy,
            nx = bx + dx
          if (ny >= 0 && nx >= 0 && ny < bh && nx < bw && fillBlocks[ny * bw + nx]) found = 1
        }
      }
      nearFill[by * bw + bx] = found
    }
  }

  let removed = 0,
    creamFixed = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
      if (nearCream(r, g, b)) continue
      if (!nearFill[Math.floor(y / BS) * bw + Math.floor(x / BS)]) {
        raw[o] = 250
        raw[o + 1] = 248
        raw[o + 2] = 245
        removed += 1
      }
    }
  }
  // second pass handled in process-images: cream -> alpha via flood; here also neutralize
  // enclosed cream-ish warm residues (e.g. collar) that flood fill cannot reach
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
    const warmLight = r > 235 && g > 215 && b > 180 && r - b > 12
    if (warmLight) {
      raw[o] = 250
      raw[o + 1] = 248
      raw[o + 2] = 245
      creamFixed += 1
    }
  }
  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path)
  console.log(`${name}: body px removed=${removed}, warm residue fixed=${creamFixed}`)
}
