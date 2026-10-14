import sharp from "sharp"

export const HAIR_FILL_MEASUREMENT = Object.freeze({
  alphaCutoff: 200,
  minLuminance: 0.78,
  maxLuminance: 0.985,
  minPixelsPerRow: 18,
})

function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export async function measureHairFill(path) {
  const image = sharp(path)
  const metadata = await image.metadata()
  const { width, height, hasAlpha } = metadata

  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${path}.`)
  }

  const raw = await image.ensureAlpha().raw().toBuffer()
  let alphaBottom = -1
  let top = -1
  let bottom = -1
  let maxWidth = 0

  for (let y = 0; y < height; y++) {
    let count = 0
    let minX = width
    let maxX = -1

    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const r = raw[offset]
      const g = raw[offset + 1]
      const b = raw[offset + 2]
      const alpha = raw[offset + 3]

      if (alpha > 0) alphaBottom = y

      const lightness = luminance(r, g, b)
      if (
        alpha <= HAIR_FILL_MEASUREMENT.alphaCutoff ||
        lightness <= HAIR_FILL_MEASUREMENT.minLuminance ||
        lightness >= HAIR_FILL_MEASUREMENT.maxLuminance
      ) {
        continue
      }

      count++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }

    if (count < HAIR_FILL_MEASUREMENT.minPixelsPerRow) continue

    if (top === -1) top = y
    bottom = y
    maxWidth = Math.max(maxWidth, maxX - minX + 1)
  }

  if (top === -1 || bottom === -1) {
    throw new Error(`${path} contains no measurable hair fill.`)
  }

  return {
    width,
    height,
    hasAlpha: hasAlpha === true,
    top,
    bottom,
    maxWidth,
    alphaBottom,
  }
}
