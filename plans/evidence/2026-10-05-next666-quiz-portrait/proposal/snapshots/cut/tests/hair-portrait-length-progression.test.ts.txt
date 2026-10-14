import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { measureHairFill } from "../scripts/portrait/measure-hair-fill.mjs"

const textures = ["straight", "wavy", "curly", "coily"] as const
const lengths = ["very-short", "short", "medium", "long", "very-long"] as const
const targetBottoms = [416, 480, 544, 608, 672] as const
const endpointTolerance = 8
const gapTolerance = 12

test("all canonical portrait rows follow the approved uniform length ladder", async () => {
  for (const texture of textures) {
    const measurements = await Promise.all(
      lengths.map((length) =>
        measureHairFill(
          join(process.cwd(), "public/images/quiz/hair-portrait", `${texture}-${length}.webp`),
        ),
      ),
    )

    for (const [index, measurement] of measurements.entries()) {
      const key = `${texture}-${lengths[index]}`
      assert.equal(measurement.width, 720, `${key} width`)
      assert.equal(measurement.height, 720, `${key} height`)
      assert.equal(measurement.hasAlpha, true, `${key} alpha`)
      assert.ok(
        Math.abs(measurement.bottom - targetBottoms[index]) <= endpointTolerance,
        `${key} bottom ${measurement.bottom} must be ${targetBottoms[index]}±${endpointTolerance}`,
      )

      if (index === 0) continue

      const previous = measurements[index - 1]
      const gap = measurement.bottom - previous.bottom
      assert.ok(
        Math.abs(gap - 64) <= gapTolerance,
        `${key} adjacent gap ${gap} must be 64±${gapTolerance}`,
      )
    }

    for (let index = 2; index < measurements.length; index++) {
      const key = `${texture}-${lengths[index]}`
      const previous = measurements[index - 1]
      const current = measurements[index]
      const widthRatio = current.maxWidth / previous.maxWidth

      assert.ok(
        widthRatio >= 0.8 && widthRatio <= 1.2,
        `${key} width ratio ${widthRatio.toFixed(3)} must stay within 20% of its neighbor`,
      )
      assert.ok(
        Math.abs(current.top - previous.top) <= 32,
        `${key} top shift ${Math.abs(current.top - previous.top)} must be at most 32px`,
      )
    }
  }
})
