// Repair over-normalized fills: large near-white cool/neutral components -> #efe9f7,
// small ones (shine crescents) preserved. Also optional global skin-island removal (--ears).
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "out")
const args = process.argv.slice(2)
const doEars = args.includes("--ears")
const names = args.filter((a) => !a.startsWith("--"))

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const nearCream = (r, g, b) =>
  Math.abs(r - 250) <= 9 && Math.abs(g - 248) <= 9 && Math.abs(b - 245) <= 9

for (const name of names) {
  const path = join(DIR, `${name}.png`)
  const img = sharp(readFileSync(path))
  const { width, height } = await img.metadata()
  const raw = await img.ensureAlpha().raw().toBuffer()
  const total = width * height

  if (doEars) {
    let ears = 0
    for (let i = 0; i < total; i++) {
      const o = i * 4
      const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
      if (r > 190 && r - b > 22 && r - g > 8 && g > 120) {
        raw[o] = 250
        raw[o + 1] = 248
        raw[o + 2] = 245
        ears += 1
      }
    }
    console.log(`${name}: skin islands removed px=${ears}`)
  }

  // washed-fill candidate: near-white, cool or neutral tint, NOT the warm cream bg
  const isWashed = (o) => {
    const [r, g, b] = [raw[o], raw[o + 1], raw[o + 2]]
    if (nearCream(r, g, b)) return false
    return lum(r, g, b) > 0.93 && b >= r - 4
  }

  const seen = new Uint8Array(total)
  let restored = 0
  for (let start = 0; start < total; start++) {
    if (seen[start] || !isWashed(start * 4)) continue
    const comp = []
    const q = [start]
    while (q.length) {
      const idx = q.pop()
      if (idx < 0 || idx >= total || seen[idx]) continue
      if (!isWashed(idx * 4)) continue
      seen[idx] = 1
      comp.push(idx)
      const x = idx % width
      if (x > 0) q.push(idx - 1)
      if (x < width - 1) q.push(idx + 1)
      q.push(idx - width, idx + width)
    }
    if (comp.length > total * 0.06) {
      for (const idx of comp) {
        const o = idx * 4
        raw[o] = 239
        raw[o + 1] = 233
        raw[o + 2] = 247
      }
      restored += comp.length
    }
  }
  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path)
  console.log(`${name}: restored fill px=${restored} (${Math.round((restored / total) * 100)}%)`)
}
