import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import sharp from "sharp"

const batchDir = resolve("ops/product-intake-research/2026-09-04/shampoo-scannable-14/image-batch")
const resultsPath = join(batchDir, "results.json")
const payload = JSON.parse(readFileSync(resultsPath, "utf8"))

const preserveSourceAlpha = new Set(["gliss-liquid-silk", "schauma-repair-pflege"])

for (const result of payload.results) {
  if (!preserveSourceAlpha.has(result.id)) continue

  const cutout = join(batchDir, "cutouts", `${result.id}-source-alpha.png`)
  const qaWhite = join(batchDir, "qa", `${result.id}-white.webp`)
  const qaMagenta = join(batchDir, "qa", `${result.id}-magenta.webp`)
  const metadata = await sharp(result.files.original).metadata()
  const width = metadata.width
  const height = metadata.height
  if (!metadata.hasAlpha || !width || !height) {
    throw new Error(`${result.id}: exact source is not a usable alpha image`)
  }

  await sharp(result.files.original).png().toFile(cutout)
  for (const [path, background] of [
    [qaWhite, "#ffffff"],
    [qaMagenta, "#ff00ff"],
  ]) {
    await sharp({ create: { width, height, channels: 3, background } })
      .composite([{ input: cutout }])
      .webp({ quality: 94 })
      .toFile(path)
  }

  result.status = "flagged"
  result.reason =
    "Operator restored the clean exact-source alpha after automated deshadow damaged the packshot; confirm the source-alpha edges in manual review."
  result.path_taken = ["alpha_passthrough"]
  result.files.cutout = cutout
  result.files.qa_white = qaWhite
  result.files.qa_magenta = qaMagenta
}

payload.summary.ok = payload.results.filter((result) => result.status === "ok").length
payload.summary.flagged = payload.results.filter((result) => result.status === "flagged").length
payload.summary.failed = payload.results.filter((result) => result.status === "failed").length

writeFileSync(resultsPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(
  `Prepared image review: ok=${payload.summary.ok} flagged=${payload.summary.flagged} failed=${payload.summary.failed}`,
)
