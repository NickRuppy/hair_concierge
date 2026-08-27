#!/usr/bin/env node
/**
 * Tool-Bildkarten postprocess (see `plans/tool-bildkarten.md`, "Nachbearbeitung").
 *
 * Takes the square 1024×1024 packshots produced by the Codex image pipeline and
 * turns each into the 1.9:1 letterbox-blur composition the card components
 * expect: a 1946×1024 canvas whose base is the source image itself, stretched
 * to the full canvas and blurred hard, with the untouched original composited
 * centered on top. The result is downscaled to 1216×640 webp q82.
 *
 * Why 1.9:1 (Codex review finding, PR #460): with square assets `object-cover`
 * cropped up to ~50 % off the tool on wide cards, and `object-contain` exposed
 * visible edges because the studio background is not exactly Plum-Ice. At 1.9:1
 * `object-cover` fills every media well (all narrower than 1.9) edge-to-edge
 * without ever cropping the tool vertically.
 *
 * Usage:
 *   node scripts/postprocess-tool-images.mjs [--src <dir>] [--out <dir>] [--force]
 *
 * Defaults: --src plans/mockups/tool-images-review-2026-08-25
 *           --out public/images/tools
 */

import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import sharp from "sharp"

const CANVAS_WIDTH = 1946
const CANVAS_HEIGHT = 1024
const OUTPUT_WIDTH = 1216
const OUTPUT_HEIGHT = 640
const WEBP_QUALITY = 82
const BLUR_SIGMA = 60

function parseArgs(argv) {
  const args = { src: "plans/mockups/tool-images-review-2026-08-25", out: "public/images/tools" }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === "--src") args.src = argv[++index]
    else if (flag === "--out") args.out = argv[++index]
    else if (flag === "--force") args.force = true
    else throw new Error(`Unknown flag: ${flag}`)
  }
  return args
}

async function postprocess(sourcePath, targetPath) {
  const source = sharp(sourcePath)
  const { width, height } = await source.metadata()
  if (!width || !height) throw new Error(`Cannot read dimensions of ${sourcePath}`)

  const original = await source.clone().png().toBuffer()

  // The letterbox base: the same image stretched across the full 1.9:1 canvas
  // and blurred until nothing recognizable survives, so the panels beside the
  // packshot read as an out-of-focus continuation of its own background.
  const base = await sharp(original)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "fill" })
    .blur(BLUR_SIGMA)
    .toBuffer()

  // The original is composited at its native size, centered — for a 1024²
  // source that is the full height of the canvas, so nothing is ever scaled.
  const scale = Math.min(CANVAS_WIDTH / width, CANVAS_HEIGHT / height)
  const placedWidth = Math.round(width * scale)
  const placedHeight = Math.round(height * scale)
  const placed =
    placedWidth === width && placedHeight === height
      ? original
      : await sharp(original).resize(placedWidth, placedHeight, { fit: "inside" }).toBuffer()

  // sharp applies `resize` before `composite` within one pipeline, so the
  // letterbox canvas has to be finished and re-opened before it is downscaled.
  const composed = await sharp(base)
    .composite([
      {
        input: placed,
        left: Math.round((CANVAS_WIDTH - placedWidth) / 2),
        top: Math.round((CANVAS_HEIGHT - placedHeight) / 2),
      },
    ])
    .png()
    .toBuffer()

  await sharp(composed)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "fill" })
    .webp({ quality: WEBP_QUALITY })
    .toFile(targetPath)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const srcDir = path.resolve(process.cwd(), args.src)
  const outDir = path.resolve(process.cwd(), args.out)
  await mkdir(outDir, { recursive: true })

  const sources = (await readdir(srcDir)).filter((name) => name.toLowerCase().endsWith(".png")).sort()
  if (sources.length === 0) {
    console.error(`No PNGs found in ${srcDir}`)
    process.exitCode = 1
    return
  }

  for (const name of sources) {
    const key = path.basename(name, path.extname(name))
    const targetPath = path.join(outDir, `${key}.webp`)
    await postprocess(path.join(srcDir, name), targetPath)
    console.log(`${name} → ${path.relative(process.cwd(), targetPath)}`)
  }
  console.log(`\n${sources.length} Bildkarten written to ${path.relative(process.cwd(), outDir)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
