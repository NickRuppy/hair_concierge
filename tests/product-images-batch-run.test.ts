import assert from "node:assert/strict"
import test from "node:test"

import { alphaCoverage, haloScore } from "../scripts/product-images/batch-run"

/**
 * Builds a synthetic RGBA raw buffer: a filled square "subject" of `size`
 * on a `size + 2*margin` fully-transparent canvas, so tests can control the
 * subject's boundary geometry precisely without needing real image files.
 */
function buildSquareSubject(params: {
  size: number
  margin: number
  fill: (x: number, y: number) => [number, number, number]
}): { data: Buffer; width: number; height: number } {
  const { size, margin, fill } = params
  const dim = size + margin * 2
  const data = Buffer.alloc(dim * dim * 4)
  for (let y = 0; y < dim; y += 1) {
    for (let x = 0; x < dim; x += 1) {
      const idx = (y * dim + x) * 4
      const insideSubject = x >= margin && x < margin + size && y >= margin && y < margin + size
      if (!insideSubject) continue
      const [r, g, b] = fill(x - margin, y - margin)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
  return { data, width: dim, height: dim }
}

test("alphaCoverage: fully transparent canvas is 0", () => {
  const { data, width, height } = buildSquareSubject({ size: 0, margin: 5, fill: () => [0, 0, 0] })
  assert.equal(alphaCoverage(data, width, height), 0)
})

test("alphaCoverage: matches the known opaque fraction of a synthetic square", () => {
  const size = 10
  const margin = 5
  const { data, width, height } = buildSquareSubject({ size, margin, fill: () => [255, 255, 255] })
  const expected = (size * size) / (width * height)
  assert.ok(Math.abs(alphaCoverage(data, width, height) - expected) < 1e-9)
})

test("haloScore: a uniformly bright subject has ~0 boundary halo", () => {
  const { data, width, height } = buildSquareSubject({
    size: 30,
    margin: 8,
    fill: () => [235, 230, 225],
  })
  const score = haloScore(data, width, height)
  assert.ok(score < 0.02, `expected a near-zero halo score for a clean subject, got ${score}`)
})

test("haloScore: a warm dark ring around the boundary scores high", () => {
  const { data, width, height } = buildSquareSubject({
    size: 30,
    margin: 8,
    fill: (x, y) => {
      const distToEdge = Math.min(x, y, 30 - 1 - x, 30 - 1 - y)
      // Cast-shadow signature: dark, warm-tinted (r > b), within the boundary ring.
      return distToEdge < 3 ? [120, 90, 60] : [235, 230, 225]
    },
  })
  const score = haloScore(data, width, height)
  assert.ok(score > 0.5, `expected a high halo score for a shadow-ringed subject, got ${score}`)
})

test("haloScore: a dark but neutral (non-warm) boundary ring does not trigger the heuristic", () => {
  const { data, width, height } = buildSquareSubject({
    size: 30,
    margin: 8,
    fill: (x, y) => {
      const distToEdge = Math.min(x, y, 30 - 1 - x, 30 - 1 - y)
      // Neutral dark (r == g == b): label text / product darks, not a warm cast shadow.
      return distToEdge < 3 ? [40, 40, 40] : [235, 230, 225]
    },
  })
  const score = haloScore(data, width, height)
  assert.ok(score < 0.02, `expected neutral dark boundary pixels to be ignored, got ${score}`)
})

test("haloScore: empty canvas does not divide by zero", () => {
  const { data, width, height } = buildSquareSubject({ size: 0, margin: 4, fill: () => [0, 0, 0] })
  assert.equal(haloScore(data, width, height), 0)
})
