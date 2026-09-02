/**
 * Batch product-image cutout pipeline (T4b of
 * plans/2026-09-01-scan-db-expansion-pilot.md).
 *
 * Input: a JSON array of `{ id, source }` where `source` is a local file
 * path or an http(s) URL. For each image, runs the documented decision tree
 * (docs/product-image-background-removal.md) as far as it can be automated:
 *
 *   1. Source already ships an alpha channel -> passthrough (most common
 *      path for brand/retailer assets per the doc).
 *   2. No alpha -> macOS Vision subject-lift (removebg.swift).
 *      - "no subject found" / degenerate alpha coverage -> padded retry
 *        (removebg-padded.swift).
 *   3. A boundary-halo heuristic flags a likely baked-in cast shadow ->
 *      remove-baked-shadow.py (needs a python3 with numpy/scipy/PIL —
 *      degrades to a flag, not a crash, if no such interpreter is found).
 *
 * This script only triages: status `ok` | `flagged` | `failed`, plus which
 * path was taken and the metrics behind that call. A human makes the final
 * approve/reject call via contact-sheet.ts's review.html.
 *
 * Usage:
 *   npx tsx scripts/product-images/batch-run.ts \
 *     --input <items.json> --out <outDir> [--python <path-to-python3>]
 *
 * items.json: [{ "id": "sku-001", "source": "https://.../packshot.webp" }, ...]
 */
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

import { parseArgs, requireFlag } from "./cli-args"

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url))
const REMOVEBG_SWIFT = join(SCRIPT_DIR, "removebg.swift")
const REMOVEBG_PADDED_SWIFT = join(SCRIPT_DIR, "removebg-padded.swift")
const DESHADOW_PY = join(SCRIPT_DIR, "remove-baked-shadow.py")

// Alpha coverage below this after a cutout attempt means "nothing usable was
// kept" (Vision found no subject, or the padded retry also failed).
const MIN_ALPHA_COVERAGE = 0.01
// Boundary halo score above this triggers an active deshadow attempt.
const HALO_TRIGGER = 0.12
// Boundary halo score above this (but below the trigger, or after a deshadow
// attempt) is a soft signal — flag for human review rather than fail.
const HALO_FLAG = 0.05
// How many pixels "into" the alpha silhouette from the outside we treat as
// the boundary ring for the halo heuristic.
const BOUNDARY_RADIUS = 5

const USAGE =
  "usage: npx tsx scripts/product-images/batch-run.ts --input <items.json> --out <outDir> [--python <path>]"

export type BatchInputItem = { id: string; source: string }

export type ImagePathStep =
  | "alpha_passthrough"
  | "vision"
  | "vision_padded"
  | "deshadow"
  | "deshadow_skipped"

export type ImageResult = {
  id: string
  source: string
  status: "ok" | "flagged" | "failed"
  reason: string | null
  path_taken: ImagePathStep[]
  metrics: {
    source_had_alpha: boolean
    alpha_coverage: number
    halo_score: number
  }
  files: {
    original: string | null
    cutout: string | null
    qa_white: string | null
    qa_magenta: string | null
  }
  timing_ms: number
}

type Dirs = { sources: string; cutouts: string; qa: string }

function log(message: string): void {
  console.log(message)
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return ""
  if (contentType.includes("webp")) return ".webp"
  if (contentType.includes("avif")) return ".avif"
  if (contentType.includes("png")) return ".png"
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg"
  return ""
}

async function resolveSource(item: BatchInputItem, sourcesDir: string): Promise<string> {
  if (isUrl(item.source)) {
    const response = await fetch(item.source)
    if (!response.ok) {
      throw new Error(`download failed (HTTP ${response.status}): ${item.source}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const urlExt = extname(new URL(item.source).pathname)
    const ext = urlExt || extFromContentType(response.headers.get("content-type")) || ".jpg"
    const dest = join(sourcesDir, `${item.id}${ext}`)
    writeFileSync(dest, buffer)
    return dest
  }

  const local = resolve(item.source)
  if (!existsSync(local)) {
    throw new Error(`source file not found: ${local}`)
  }
  const ext = extname(local) || ".jpg"
  const dest = join(sourcesDir, `${item.id}${ext}`)
  copyFileSync(local, dest)
  return dest
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr
    const text = stderr ? stderr.toString().trim() : ""
    if (text) return text
  }
  return error instanceof Error ? error.message : String(error)
}

function runVision(input: string, outDir: string): { ok: boolean; reason: string | null } {
  try {
    const out = execFileSync("swift", [REMOVEBG_SWIFT, outDir, input], { encoding: "utf8" })
    const line = out.trim().split("\n").filter(Boolean).pop() ?? ""
    if (line.startsWith("OK:")) return { ok: true, reason: null }
    return { ok: false, reason: line || "Vision produced no output" }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

function runVisionPadded(input: string, output: string): { ok: boolean; reason: string | null } {
  try {
    const out = execFileSync("swift", [REMOVEBG_PADDED_SWIFT, input, output], { encoding: "utf8" })
    if (out.includes("OK:")) return { ok: true, reason: null }
    return { ok: false, reason: out.trim() || "padded retry produced no output" }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

function findPython(explicit: string | undefined): string | null {
  const candidates = [explicit, process.env.PRODUCT_IMAGE_PYTHON, "/tmp/rembg-venv/bin/python3"].filter(
    (value): value is string => Boolean(value),
  )
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function runDeshadow(
  python: string,
  input: string,
  output: string,
): { ok: boolean; reason: string | null } {
  try {
    execFileSync(python, [DESHADOW_PY, input, output], { encoding: "utf8" })
    return { ok: existsSync(output), reason: existsSync(output) ? null : "deshadow produced no output" }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
}

async function readRgba(path: string): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export function alphaCoverage(data: Buffer, width: number, height: number): number {
  const total = width * height
  if (total === 0) return 0
  let count = 0
  for (let i = 0; i < total; i += 1) {
    if (data[i * 4 + 3] > 18) count += 1
  }
  return count / total
}

/**
 * "Halo score": density of warm, dark pixels within `radius` pixels of the
 * outer edge of the alpha silhouette — the same geometric signature
 * remove-baked-shadow.py exploits (cast shadow = dark pixels connected to
 * the boundary; warm-tinted vs. neutral product darks). Multi-source BFS
 * from every fully-transparent pixel keeps this O(width*height) instead of
 * a naive per-pixel neighborhood scan.
 */
export function haloScore(data: Buffer, width: number, height: number, radius = BOUNDARY_RADIUS): number {
  const total = width * height
  if (total === 0) return 0

  const dist = new Int16Array(total).fill(-1)
  const queue = new Int32Array(total)
  let queueLength = 0

  for (let i = 0; i < total; i += 1) {
    if (data[i * 4 + 3] <= 0) {
      dist[i] = 0
      queue[queueLength] = i
      queueLength += 1
    }
  }

  let cursor = 0
  while (cursor < queueLength) {
    const idx = queue[cursor]
    cursor += 1
    const d = dist[idx]
    if (d >= radius) continue
    const x = idx % width
    const y = (idx / width) | 0
    if (x > 0 && dist[idx - 1] === -1) {
      dist[idx - 1] = d + 1
      queue[queueLength] = idx - 1
      queueLength += 1
    }
    if (x < width - 1 && dist[idx + 1] === -1) {
      dist[idx + 1] = d + 1
      queue[queueLength] = idx + 1
      queueLength += 1
    }
    if (y > 0 && dist[idx - width] === -1) {
      dist[idx - width] = d + 1
      queue[queueLength] = idx - width
      queueLength += 1
    }
    if (y < height - 1 && dist[idx + width] === -1) {
      dist[idx + width] = d + 1
      queue[queueLength] = idx + width
      queueLength += 1
    }
  }

  let boundaryTotal = 0
  let warmDark = 0
  for (let i = 0; i < total; i += 1) {
    const alpha = data[i * 4 + 3]
    if (alpha <= 0) continue
    const d = dist[i]
    if (d < 0 || d > radius) continue
    boundaryTotal += 1
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    if (lum < 200 && sat >= 6 && sat <= 60 && r >= b) warmDark += 1
  }

  return boundaryTotal > 0 ? warmDark / boundaryTotal : 0
}

async function writeComposite(
  cutout: string,
  output: string,
  background: { r: number; g: number; b: number },
): Promise<void> {
  const meta = await sharp(cutout).metadata()
  await sharp({
    create: { width: meta.width ?? 1, height: meta.height ?? 1, channels: 3, background },
  })
    .composite([{ input: cutout }])
    .webp({ quality: 85 })
    .toFile(output)
}

function failedResult(
  item: BatchInputItem,
  reason: string,
  pathTaken: ImagePathStep[],
  originalFile: string | null,
  cutoutFile: string | null,
  sourceHadAlpha: boolean,
  alphaCov: number,
  start: number,
): ImageResult {
  return {
    id: item.id,
    source: item.source,
    status: "failed",
    reason,
    path_taken: pathTaken,
    metrics: { source_had_alpha: sourceHadAlpha, alpha_coverage: alphaCov, halo_score: 0 },
    files: { original: originalFile, cutout: cutoutFile, qa_white: null, qa_magenta: null },
    timing_ms: Date.now() - start,
  }
}

export async function processItem(
  item: BatchInputItem,
  dirs: Dirs,
  pythonPath: string | null,
): Promise<ImageResult> {
  const start = Date.now()
  const pathTaken: ImagePathStep[] = []
  let originalFile: string | null = null

  try {
    originalFile = await resolveSource(item, dirs.sources)
  } catch (error) {
    return failedResult(item, errorMessage(error), pathTaken, null, null, false, 0, start)
  }

  const sourceMeta = await sharp(originalFile).metadata()
  const sourceHasAlpha = Boolean(sourceMeta.hasAlpha)
  // Source-quality gate (Nick's review 2026-09-02): a packshot whose shorter
  // dimension is under 800px upscales visibly soft in the 1200x1200 finalize.
  // The gate cannot judge CONTENT (marketing shot vs packshot) - that stays a
  // human call on the contact sheet.
  const sourceMinDim = Math.min(sourceMeta.width ?? 0, sourceMeta.height ?? 0)
  const lowResSource = sourceMinDim > 0 && sourceMinDim < 800
  const targetCutout = join(dirs.cutouts, `${item.id}.png`)
  let cutoutFile: string | null = null

  if (sourceHasAlpha) {
    await sharp(originalFile).png().toFile(targetCutout)
    cutoutFile = targetCutout
    pathTaken.push("alpha_passthrough")
  } else {
    const visionResult = runVision(originalFile, dirs.cutouts)
    if (visionResult.ok && existsSync(targetCutout)) {
      cutoutFile = targetCutout
      pathTaken.push("vision")
    } else {
      pathTaken.push("vision")
      const paddedResult = runVisionPadded(originalFile, targetCutout)
      if (paddedResult.ok && existsSync(targetCutout)) {
        cutoutFile = targetCutout
        pathTaken.push("vision_padded")
      } else {
        return failedResult(
          item,
          `no subject found (vision: ${visionResult.reason ?? "unknown"}; padded: ${paddedResult.reason ?? "unknown"})`,
          pathTaken,
          originalFile,
          null,
          sourceHasAlpha,
          0,
          start,
        )
      }
    }
  }

  let { data, width, height } = await readRgba(cutoutFile)
  let coverage = alphaCoverage(data, width, height)

  if (coverage < MIN_ALPHA_COVERAGE) {
    return failedResult(
      item,
      `degenerate alpha coverage after cutout (${(coverage * 100).toFixed(2)}%)`,
      pathTaken,
      originalFile,
      cutoutFile,
      sourceHasAlpha,
      coverage,
      start,
    )
  }

  let halo = haloScore(data, width, height)
  let status: ImageResult["status"] = "ok"
  let reason: string | null = null
  if (lowResSource) {
    status = "flagged"
    reason = `low-res source (${sourceMeta.width}x${sourceMeta.height}, min dim < 800px) - re-source a larger packshot`
  }

  if (halo > HALO_TRIGGER) {
    if (pythonPath) {
      const deshadowed = join(dirs.cutouts, `${item.id}-deshadow.png`)
      const deshadowResult = runDeshadow(pythonPath, cutoutFile, deshadowed)
      pathTaken.push("deshadow")
      if (deshadowResult.ok) {
        const reread = await readRgba(deshadowed)
        const newHalo = haloScore(reread.data, reread.width, reread.height)
        if (newHalo < halo) {
          copyFileSync(deshadowed, targetCutout)
          cutoutFile = targetCutout
          data = reread.data
          width = reread.width
          height = reread.height
          coverage = alphaCoverage(data, width, height)
          halo = newHalo
          if (halo > HALO_FLAG) {
            status = "flagged"
            reason = `deshadow reduced but did not fully clear the boundary halo score (${halo.toFixed(3)})`
          }
        } else {
          status = "flagged"
          reason = `deshadow attempted but did not reduce the halo score (before ${halo.toFixed(3)}, after ${newHalo.toFixed(3)})`
        }
      } else {
        status = "flagged"
        reason = `possible baked-in shadow (halo_score=${halo.toFixed(3)}); deshadow failed: ${deshadowResult.reason ?? "unknown"}`
      }
    } else {
      pathTaken.push("deshadow_skipped")
      status = "flagged"
      reason = `possible baked-in shadow (halo_score=${halo.toFixed(3)}); deshadow skipped — no python interpreter with numpy/scipy/PIL found (checked --python and /tmp/rembg-venv/bin/python3)`
    }
  } else if (halo > HALO_FLAG) {
    status = "flagged"
    reason = `borderline boundary halo score (${halo.toFixed(3)}) — human review recommended`
  }

  const qaWhite = join(dirs.qa, `${item.id}-white.webp`)
  const qaMagenta = join(dirs.qa, `${item.id}-magenta.webp`)
  await writeComposite(cutoutFile, qaWhite, { r: 255, g: 255, b: 255 })
  await writeComposite(cutoutFile, qaMagenta, { r: 255, g: 0, b: 255 })

  return {
    id: item.id,
    source: item.source,
    status,
    reason,
    path_taken: pathTaken,
    metrics: { source_had_alpha: sourceHasAlpha, alpha_coverage: coverage, halo_score: halo },
    files: { original: originalFile, cutout: cutoutFile, qa_white: qaWhite, qa_magenta: qaMagenta },
    timing_ms: Date.now() - start,
  }
}

async function main(): Promise<void> {
  const flags = parseArgs()
  const inputPath = requireFlag(flags, "input", USAGE)
  const outDir = requireFlag(flags, "out", USAGE)

  const items = JSON.parse(readFileSync(resolve(inputPath), "utf8")) as BatchInputItem[]
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("input JSON must be a non-empty array of { id, source }")
  }
  for (const item of items) {
    if (!item?.id || !item?.source) {
      throw new Error(`each input item needs an id and a source: ${JSON.stringify(item)}`)
    }
  }

  const resolvedOut = resolve(outDir)
  const dirs: Dirs = {
    sources: join(resolvedOut, "sources"),
    cutouts: join(resolvedOut, "cutouts"),
    qa: join(resolvedOut, "qa"),
  }
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true })

  const pythonPath = findPython(flags.get("python"))
  if (!pythonPath) {
    log(
      "Note: no python interpreter with numpy/scipy/PIL found (checked --python and /tmp/rembg-venv/bin/python3). Baked-shadow removal will be skipped and flagged instead of fixed.",
    )
  }

  const results: ImageResult[] = []
  const runStart = Date.now()
  for (const item of items) {
    log(`Processing ${item.id} (${item.source})...`)
    const result = await processItem(item, dirs, pythonPath)
    results.push(result)
    log(
      `  -> ${result.status}${result.reason ? ` (${result.reason})` : ""} [${result.path_taken.join(" > ") || "n/a"}] ${result.timing_ms}ms`,
    )
  }
  const totalMs = Date.now() - runStart

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    flagged: results.filter((r) => r.status === "flagged").length,
    failed: results.filter((r) => r.status === "failed").length,
    total_ms: totalMs,
    avg_ms_per_image: Math.round(totalMs / results.length),
    python_used: pythonPath,
    generated_at: new Date().toISOString(),
  }

  writeFileSync(join(resolvedOut, "results.json"), `${JSON.stringify({ summary, results }, null, 2)}\n`)
  log(
    `\nDone. ok=${summary.ok} flagged=${summary.flagged} failed=${summary.failed} total=${summary.total_ms}ms avg=${summary.avg_ms_per_image}ms/image`,
  )
  log(`Results: ${join(resolvedOut, "results.json")}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
