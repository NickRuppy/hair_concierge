// Library normalization on out/*.png (pre-strip):
// 1) hair-fill hue lock: light purple/gray/blue/pink-tinted fills -> lilac family (#efe9f7 ramp)
// 2) body-stroke unify: warm tan/red-brown strokes -> soft plum-gray
// 3) per-cell artifact erase: mid-purple stains (curly-short), small stray ink ticks (curly-medium)
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "out")
const files = process.argv.slice(2)
if (!files.length) {
  console.error("usage: normalize.mjs <name...> [--stains] [--ticks]")
  process.exit(1)
}
const doStains = files.includes("--stains")
const doTicks = files.includes("--ticks")
const names = files.filter((f) => !f.startsWith("--"))

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const nearCream = (r, g, b) =>
  Math.abs(r - 250) <= 12 && Math.abs(g - 248) <= 12 && Math.abs(b - 245) <= 12

for (const name of names) {
  const path = join(DIR, `${name}.png`)
  const img = sharp(readFileSync(path))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()
  let fills = 0,
    strokes = 0,
    stains = 0,
    ticks = 0

  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
    if (nearCream(r, g, b)) continue
    const L = lum(r, g, b)

    // 1) fill lock: light, tinted cool/purple/pink -> lilac ramp preserving lightness
    const coolTint = b > r && b - g >= 4
    const pinkTint = r - g >= 8 && b - g >= 4
    const grayTint = Math.abs(r - b) <= 6 && Math.abs(r - g) <= 6 && L > 0.78 && L < 0.93
    if (L > 0.74 && (coolTint || pinkTint || grayTint)) {
      // fixed ramp: L=0.965 -> white (crescent), L=0.92 -> #efe9f7 (fill), lower -> toward #e2d7f0
      const t = Math.max(0, Math.min(1.3, (0.965 - L) / 0.045))
      raw[o] = Math.round(250 - t * (250 - 226))
      raw[o + 1] = Math.round(247 - t * (247 - 215))
      raw[o + 2] = Math.round(253 - t * (253 - 240))
      fills += 1
      continue
    }

    // 2) stroke unify: warm tan/red-brown mid-tones -> soft plum-gray, keep lightness
    const warm = r > b + 25 && r > g + 8 && L > 0.25 && L < 0.8
    if (warm) {
      const keep = L * 255
      raw[o] = Math.round(keep * 0.62 + 60)
      raw[o + 1] = Math.round(keep * 0.55 + 48)
      raw[o + 2] = Math.round(keep * 0.72 + 70)
      strokes += 1
      continue
    }

    // 3a) stain erase: mid-purple mid-saturation patches -> fill color
    if (doStains && L > 0.6 && L <= 0.86 && b > r && b - g >= 10 && r - g >= 2) {
      raw[o] = 239
      raw[o + 1] = 233
      raw[o + 2] = 247
      stains += 1
    }
  }

  // 3b) tick erase: small isolated dark components in the lower 45% of the image
  if (doTicks) {
    const isInk = (o) => lum(raw[o], raw[o + 1], raw[o + 2]) < 0.45
    const seen = new Uint8Array(width * height)
    const yStart = Math.floor(height * 0.55)
    for (let y = yStart; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (seen[idx] || !isInk(idx * 4)) continue
        // BFS component
        const comp = []
        const q = [[x, y]]
        let touchesTop = false
        while (q.length) {
          const [cx, cy] = q.pop()
          if (cx < 0 || cy < yStart || cx >= width || cy >= height) {
            if (cy < yStart) touchesTop = true
            continue
          }
          const ci = cy * width + cx
          if (seen[ci] || !isInk(ci * 4)) continue
          seen[ci] = 1
          comp.push(ci)
          q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
        }
        // small isolated component not connected upward = stray tick
        if (!touchesTop && comp.length > 0 && comp.length < 900) {
          for (const ci of comp) {
            const o = ci * 4
            raw[o] = 250
            raw[o + 1] = 248
            raw[o + 2] = 245
          }
          ticks += comp.length
        }
      }
    }
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path)
  console.log(`${name}: fills=${fills} strokes=${strokes} stains=${stains} tickpx=${ticks}`)
}
