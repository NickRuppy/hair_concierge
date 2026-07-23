#!/usr/bin/env node
// Closed-loop coily generation: roll -> measure -> accept/retry.
// Requires a portable work directory containing out/coily-short.png and out/coily-medium.png.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import sharp from "sharp"

const usage = () => {
  console.log(
    "Usage: OPENAI_API_KEY=... node scripts/portrait/closed-loop-coily.mjs --work-dir <directory> [--env-file <file>] [--max-tries <n>]",
  )
  console.log("The work directory must contain out/coily-short.png and out/coily-medium.png.")
}
const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  usage()
  process.exit(0)
}
const valueFor = (flag) => {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  if (!args[index + 1]) throw new Error(`${flag} requires a value.`)
  return args[index + 1]
}
const workDirArg = valueFor("--work-dir")
const envFile = valueFor("--env-file")
const maxTriesArg = valueFor("--max-tries")
if (!workDirArg) {
  usage()
  process.exit(1)
}
const maxTries = maxTriesArg ? Number(maxTriesArg) : 4
if (!Number.isInteger(maxTries) || maxTries < 1)
  throw new Error("--max-tries must be a positive integer.")
const keyFromEnvFile = (path) =>
  readFileSync(path, "utf8")
    .match(/^OPENAI_API_KEY=(.+)$/m)?.[1]
    ?.trim()
const key = process.env.OPENAI_API_KEY || (envFile ? keyFromEnvFile(resolve(envFile)) : undefined)
if (!key) {
  console.error("Set OPENAI_API_KEY or pass --env-file <file>.")
  process.exit(1)
}

const workDir = resolve(workDirArg)
const out = join(workDir, "out")
const candidates = join(workDir, "candidates")
mkdirSync(out, { recursive: true })
mkdirSync(candidates, { recursive: true })
for (const name of ["coily-short", "coily-medium"]) {
  const path = join(out, `${name}.png`)
  if (!existsSync(path)) throw new Error(`Missing approved reference: ${path}`)
}

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const nearCream = (r, g, b) =>
  Math.abs(r - 250) <= 14 && Math.abs(g - 248) <= 14 && Math.abs(b - 245) <= 14
async function measure(buffer) {
  const image = sharp(buffer)
  const { width, height } = await image.metadata()
  const raw = await image.ensureAlpha().raw().toBuffer()
  let bottom = 0
  let maxW = 0
  for (let y = 0; y < height; y++) {
    let count = 0
    let minX = width
    let maxX = 0
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const [r, g, b] = [raw[offset], raw[offset + 1], raw[offset + 2]]
      if (nearCream(r, g, b)) continue
      const lightness = lum(r, g, b)
      if (lightness > 0.78 && lightness < 0.985) {
        count++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
      }
    }
    if (count >= 25) {
      bottom = y
      maxW = Math.max(maxW, maxX - minX)
    }
  }
  return { bottom, maxW }
}

const shared =
  "Match the existing Chaarlie portrait library exactly: soft premium beauty illustration, pale lilac hair fill, dark plum outline, subtle white highlight, centered back view, square 1024x1024 canvas, flat cream background, no shadows, no gradients, no text. TEXTURE RULE: softly bumpy cloud silhouette with scattered short C-shaped curl marks inside - absolutely NO vertical ribbed strands, NO column or dreadlock pattern, NO parallel vertical ridges. No neck, no shoulders, no face. "

async function roll(name, references, prompt) {
  const form = new FormData()
  form.append("model", "gpt-image-1")
  form.append("prompt", prompt)
  form.append("size", "1024x1024")
  form.append("quality", "high")
  form.append("output_format", "png")
  form.append("n", "1")
  for (const reference of references) {
    form.append(
      "image[]",
      new Blob([readFileSync(join(out, `${reference}.png`))], { type: "image/png" }),
      `${reference}.png`,
    )
  }
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!response.ok)
    throw new Error(`${name}: HTTP ${response.status} ${(await response.text()).slice(0, 150)}`)
  return Buffer.from((await response.json()).data?.[0]?.b64_json ?? "", "base64")
}

async function closedLoop(name, references, prompt, accept) {
  let best
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const buffer = await roll(name, references, prompt)
    if (!buffer.length) throw new Error(`${name}: no image in response`)
    const measurement = await measure(buffer)
    const pass = accept(measurement)
    console.log(
      `${name} try ${attempt}: bottom=${measurement.bottom} width=${measurement.maxW} ${pass ? "ACCEPT" : "reject"}`,
    )
    writeFileSync(join(candidates, `${name}-${attempt}.png`), buffer)
    const score =
      Math.abs(measurement.bottom - accept.targetBottom) +
      Math.abs(measurement.maxW - accept.targetWidth)
    if (!best || score < best.score) best = { buffer, measurement, score, attempt }
    if (pass) {
      writeFileSync(join(out, `${name}.png`), buffer)
      return { ...measurement, attempt, accepted: true }
    }
  }
  writeFileSync(join(out, `${name}.png`), best.buffer)
  console.log(`${name}: no candidate passed, kept best (try ${best.attempt})`)
  return { ...best.measurement, attempt: best.attempt, accepted: false }
}

const acceptLong = (measurement) =>
  measurement.bottom >= 880 &&
  measurement.bottom <= 940 &&
  measurement.maxW >= 580 &&
  measurement.maxW <= 690
acceptLong.targetBottom = 910
acceptLong.targetWidth = 640
const acceptVeryLong = (measurement) =>
  measurement.bottom >= 955 &&
  measurement.bottom <= 1005 &&
  measurement.maxW >= 560 &&
  measurement.maxW <= 690
acceptVeryLong.targetBottom = 980
acceptVeryLong.targetWidth = 630

const long = await closedLoop(
  "coily-long",
  ["coily-short", "coily-medium"],
  shared +
    "Create the long coily version from the approved short and medium references. Keep the same maximum width as the medium reference - the hair must be equally wide and full (about 64 percent of canvas width). Extend the soft cloud clearly farther downward: the lowest point of the hair sits at about 88 percent of the canvas height, leaving clear empty background below. It must read as the same hairstyle grown longer.",
  acceptLong,
)
const veryLong = await closedLoop(
  "coily-very-long",
  ["coily-medium", "coily-long"],
  shared +
    "Create the very-long coily version from the approved medium and long references. Keep the same maximum width as the references - equally wide and full (about 64 percent of canvas width). Unmistakably the longest state: the lowest point of the hair sits at about 95 to 97 percent of the canvas height, with a thin band of empty background still visible below. It must read as the same hairstyle grown even longer.",
  acceptVeryLong,
)
console.log("RESULT", JSON.stringify({ long, veryLong }))
