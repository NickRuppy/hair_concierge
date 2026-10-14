import sharp from "sharp"

import { measureHairFill } from "./measure-hair-fill.mjs"

const USAGE =
  "usage: normalize-hair-endpoint.mjs --input <path> --output <path> --target <px> [--width <px>] [--top <px>]"

function parseArguments(argv) {
  const values = new Map()

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]

    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(USAGE)
    }

    values.set(key.slice(2), value)
  }

  const input = values.get("input")
  const output = values.get("output")
  const target = Number(values.get("target"))
  const targetWidthValue = values.get("width")
  const targetWidth = targetWidthValue === undefined ? undefined : Number(targetWidthValue)
  const targetTopValue = values.get("top")
  const targetTop = targetTopValue === undefined ? undefined : Number(targetTopValue)

  if (
    !input ||
    !output ||
    !Number.isInteger(target) ||
    target <= 0 ||
    (targetWidth !== undefined && (!Number.isInteger(targetWidth) || targetWidth <= 0)) ||
    (targetTop !== undefined && (!Number.isInteger(targetTop) || targetTop < 0))
  ) {
    throw new Error(USAGE)
  }

  return { input, output, target, targetWidth, targetTop }
}

const { input, output, target, targetWidth, targetTop } = parseArguments(process.argv.slice(2))
const before = await measureHairFill(input)
const desiredTop = targetTop ?? before.top

if (target <= desiredTop || target >= before.height || desiredTop >= before.height) {
  throw new Error(
    `Target ${target} must be below hair top ${desiredTop} and inside ${before.height}px canvas.`,
  )
}

const scaleY = (target - desiredTop) / (before.bottom - before.top)
const translateY = desiredTop - before.top * scaleY
const scaleX = targetWidth === undefined ? 1 : targetWidth / before.maxWidth
const resizedHeight = Math.max(1, Math.round(before.height * scaleY))
const resizedWidth = Math.max(1, Math.round(before.width * scaleX))
const destinationTop = Math.round(translateY)
const destinationLeft = Math.round((before.width - resizedWidth) / 2)
const sourceTop = Math.max(0, -destinationTop)
const sourceLeft = Math.max(0, -destinationLeft)
const canvasTop = Math.max(0, destinationTop)
const canvasLeft = Math.max(0, destinationLeft)
const visibleHeight = Math.min(resizedHeight - sourceTop, before.height - canvasTop)
const visibleWidth = Math.min(resizedWidth - sourceLeft, before.width - canvasLeft)

if (visibleHeight <= 0 || visibleWidth <= 0) {
  throw new Error("Endpoint transform places the entire portrait outside its canvas.")
}

const resized = await sharp(input)
  .resize(resizedWidth, resizedHeight, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  })
  .extract({
    left: sourceLeft,
    top: sourceTop,
    width: visibleWidth,
    height: visibleHeight,
  })
  .toBuffer()

await sharp({
  create: {
    width: before.width,
    height: before.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: resized, left: canvasLeft, top: canvasTop }])
  .webp({ quality: 88, alphaQuality: 100, smartSubsample: true })
  .toFile(output)

const after = await measureHairFill(output)
console.log(
  JSON.stringify({
    input,
    output,
    target,
    before: {
      top: before.top,
      bottom: before.bottom,
      maxWidth: before.maxWidth,
    },
    transform: {
      scaleX: Number(scaleX.toFixed(6)),
      scaleY: Number(scaleY.toFixed(6)),
      translateX: destinationLeft,
      translateY: Number(translateY.toFixed(3)),
    },
    after: {
      top: after.top,
      bottom: after.bottom,
      maxWidth: after.maxWidth,
    },
  }),
)
