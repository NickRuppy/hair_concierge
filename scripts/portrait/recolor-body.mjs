// For own-body cells (very-short cuts where the neck stays in-image): recolor body
// linework (ink pixels NOT near hair fill) to the standardized code-body color #8f84a8,
// so image bodies and the code-drawn shoulder line read as one system.
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "out")
const RADIUS = 6
const TARGET = [143, 132, 168] // #8f84a8
const names = process.argv.slice(2)
if (!names.length) {
  console.error("usage: recolor-body.mjs <name...>")
  process.exit(1)
}

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const nearCream = (r, g, b) =>
  Math.abs(r - 250) <= 12 && Math.abs(g - 248) <= 12 && Math.abs(b - 245) <= 12
const isFill = (r, g, b) => {
  const L = lum(r, g, b)
  return L > 0.84 && b >= r - 2 && b - g >= 2 && !nearCream(r, g, b)
}

for (const name of names) {
  const path = join(DIR, `${name}.png`)
  const img = sharp(readFileSync(path))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()

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

  let recolored = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
      if (nearCream(r, g, b)) continue
      if (lum(r, g, b) >= 0.84) continue
      if (nearFill[Math.floor(y / BS) * bw + Math.floor(x / BS)]) continue
      // blend toward target keeping some darkness variation for AA
      const k = 0.85
      raw[o] = Math.round(r * (1 - k) + TARGET[0] * k)
      raw[o + 1] = Math.round(g * (1 - k) + TARGET[1] * k)
      raw[o + 2] = Math.round(b * (1 - k) + TARGET[2] * k)
      recolored += 1
    }
  }
  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path)
  console.log(`${name}: body px recolored=${recolored}`)
}
