// Post-process generated portraits: strip the flat cream background via edge flood-fill
// (protects the interior shine crescent, which is nearly the same color), then trim+pad
// to a shared square canvas. Output: out-final/<name>.png with alpha.
import { readdirSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = dirname(fileURLToPath(import.meta.url))
const IN = join(DIR, "out")
const OUT = join(DIR, "out-final")
mkdirSync(OUT, { recursive: true })

const TOLERANCE = 14 // per-channel distance from sampled background color

async function stripBackground(file) {
  const img = sharp(join(IN, file))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()
  const px = (x, y) => (y * width + x) * 4

  // sample background color from the four corners (average)
  const corners = [px(2, 2), px(width - 3, 2), px(2, height - 3), px(width - 3, height - 3)]
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, o) => s + raw[o + c], 0) / 4))
  const isBg = (o) =>
    Math.abs(raw[o] - bg[0]) <= TOLERANCE &&
    Math.abs(raw[o + 1] - bg[1]) <= TOLERANCE &&
    Math.abs(raw[o + 2] - bg[2]) <= TOLERANCE

  // BFS flood fill from all border pixels
  const visited = new Uint8Array(width * height)
  const queue = []
  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1])
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y])
  }
  while (queue.length) {
    const [x, y] = queue.pop()
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const idx = y * width + x
    if (visited[idx]) continue
    visited[idx] = 1
    const o = px(x, y)
    if (!isBg(o)) continue
    raw[o + 3] = 0 // transparent
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  // soften the cut edge: pixels adjacent to transparent that are near-bg get partial alpha
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const o = px(x, y)
      if (raw[o + 3] === 0) continue
      const nearTransparent =
        raw[px(x + 1, y) + 3] === 0 ||
        raw[px(x - 1, y) + 3] === 0 ||
        raw[px(x, y + 1) + 3] === 0 ||
        raw[px(x, y - 1) + 3] === 0
      if (nearTransparent && isBg(o)) raw[o + 3] = 120
    }
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, file))
}

const files = readdirSync(IN).filter((f) => f.endsWith(".png"))
for (const f of files) {
  await stripBackground(f)
  console.log("stripped", f)
}
console.log("done", files.length, "files ->", OUT)
