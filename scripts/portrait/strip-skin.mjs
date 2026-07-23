// Remove filled skin regions (peach/flesh tones) via flood fill from the bottom border,
// keeping darker outline strokes intact. Runs on out/ originals, writes back to out/.
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "out")
const files = process.argv.slice(2)
if (!files.length) {
  console.error("usage: strip-skin.mjs <name...>")
  process.exit(1)
}

// skin: light, warm, saturated toward red/orange — distinctly warmer than cream bg (#faf8f5)
const isSkin = (r, g, b) => r > 190 && r - b > 22 && r - g > 8 && g > 120
// bg cream for replacement
const BG = [250, 248, 245]

for (const name of files) {
  const path = join(DIR, `${name}.png`)
  const img = sharp(readFileSync(path))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()
  const px = (x, y) => (y * width + x) * 4

  const visited = new Uint8Array(width * height)
  const queue = []
  // seed from the bottom third of the border (skin regions touch bottom/sides)
  for (let x = 0; x < width; x++) queue.push([x, height - 2])
  for (let y = Math.floor(height * 0.5); y < height; y++) queue.push([1, y], [width - 2, y])

  let changed = 0
  while (queue.length) {
    const [x, y] = queue.pop()
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue
    const idx = y * width + x
    if (visited[idx]) continue
    visited[idx] = 1
    const o = px(x, y)
    const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
    const skin = isSkin(r, g, b)
    const nearBg =
      Math.abs(r - BG[0]) <= 14 && Math.abs(g - BG[1]) <= 14 && Math.abs(b - BG[2]) <= 14
    if (!skin && !nearBg) continue // stop at outline strokes / hair
    if (skin) {
      raw[o] = BG[0]
      raw[o + 1] = BG[1]
      raw[o + 2] = BG[2]
      changed += 1
    }
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path)
  console.log(`${name}: replaced ${changed} skin px`)
}
