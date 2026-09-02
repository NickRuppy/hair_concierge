/**
 * Wires approved batch cutouts (contact-sheet.ts's approved-ids.json) into
 * the SAME local finalization step product-intake already uses —
 * scripts/product-intake/finalize-package-image.ts's finalizeProductImageAsset.
 * That function is pure local file work (sharp + crypto only, no network or
 * Supabase calls); it produces the same 1200x1200 final composite and
 * search thumbnail as the manual product-intake flow, plus a quality gate.
 *
 * For every approved id this writes an image-finalization.json in a
 * package-dir shape that the EXISTING, UNMODIFIED
 * scripts/product-intake/upload-package-image.ts can upload from as-is.
 *
 * This script never touches Supabase or any bucket. Uploading is a
 * separate, explicit step a human runs per product:
 *
 *   npx tsx scripts/product-intake/upload-package-image.ts \
 *     --package <outDir>/<id> --apply --confirm
 *
 * Usage:
 *   npx tsx scripts/product-images/finalize-approved.ts \
 *     --results <batchOutDir>/results.json \
 *     --approved <batchOutDir>/approved-ids.json \
 *     --out <finalizeOutDir> [--date-folder YYYY-MM-DD]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Reused, not modified — see scripts/product-intake/finalize-package-image.ts.
import { finalizeProductImageAsset } from "../product-intake/finalize-package-image"

import { parseArgs, requireFlag } from "./cli-args"
import type { ImageResult } from "./batch-run"

const USAGE =
  "usage: npx tsx scripts/product-images/finalize-approved.ts --results <results.json> --approved <approved-ids.json> --out <outDir> [--date-folder YYYY-MM-DD]"

function todayFolder(): string {
  return new Date().toISOString().slice(0, 10)
}

async function main(): Promise<void> {
  const flags = parseArgs()
  const resultsPath = resolve(requireFlag(flags, "results", USAGE))
  const approvedPath = resolve(requireFlag(flags, "approved", USAGE))
  const outDir = resolve(requireFlag(flags, "out", USAGE))
  const dateFolder = flags.get("date-folder") ?? todayFolder()

  const payload = JSON.parse(readFileSync(resultsPath, "utf8")) as { results: ImageResult[] }
  const approvedIds = JSON.parse(readFileSync(approvedPath, "utf8")) as string[]
  if (!Array.isArray(approvedIds)) {
    throw new Error(`${approvedPath} must be a JSON array of ids (as downloaded from review.html)`)
  }

  const byId = new Map(payload.results.map((result) => [result.id, result]))
  mkdirSync(outDir, { recursive: true })

  const finalized: Array<{ id: string; qualityGateStatus: string; packageDir: string }> = []
  for (const id of approvedIds) {
    const result = byId.get(id)
    if (!result || !result.files.cutout) {
      console.warn(`skip ${id}: no cutout recorded in ${resultsPath}`)
      continue
    }

    const packageDir = join(outDir, id)
    mkdirSync(packageDir, { recursive: true })

    const finalizedAsset = await finalizeProductImageAsset({
      sourceFile: result.files.cutout,
      label: id,
      outputDir: packageDir,
      publicPathPrefix: `/local-review/${id}`,
      dateFolder,
      submissionId: id,
    })

    const decision = {
      status: "approved_asset" as const,
      storage_bucket: "product-images",
      storage_path: finalizedAsset.storagePath,
      public_url: finalizedAsset.publicUrl,
      source_page_url: result.source,
      source_type: "unknown",
      quality_confidence: "medium",
      processing_method: "local",
      final_file: relative(packageDir, finalizedAsset.finalFile),
      asset_sha256: finalizedAsset.sha256,
      thumbnail_storage_path: finalizedAsset.thumbnailStoragePath,
      thumbnail_public_url: finalizedAsset.thumbnailPublicUrl,
      thumbnail_final_file: relative(packageDir, finalizedAsset.thumbnailFile),
      thumbnail_asset_sha256: finalizedAsset.thumbnailSha256,
      user_approved: true,
      reviewed_by: "batch-image-pipeline",
      reviewed_at: new Date().toISOString(),
      notes: `Approved via contact-sheet.ts review.html; batch source=${result.source}, cutout path=${result.path_taken.join(" > ")}. NOT uploaded to Supabase Storage — run upload-package-image.ts manually.`,
      quality_gate: finalizedAsset.qualityGate,
    }

    writeFileSync(join(packageDir, "image-finalization.json"), `${JSON.stringify(decision, null, 2)}\n`)
    console.log(`${id}: quality_gate=${finalizedAsset.qualityGate.status} -> ${packageDir}/image-finalization.json`)
    finalized.push({ id, qualityGateStatus: finalizedAsset.qualityGate.status, packageDir })
  }

  console.log(
    `\nFinalized ${finalized.length}/${approvedIds.length} approved images locally (no Supabase writes).`,
  )
  const needsWork = finalized.filter((f) => f.qualityGateStatus !== "pass")
  if (needsWork.length > 0) {
    console.log(`${needsWork.length} need a closer look (quality_gate != pass): ${needsWork.map((f) => f.id).join(", ")}`)
  }
  console.log("\nTo upload one product's finalized image to Supabase Storage, a human runs:")
  console.log(
    `  npx tsx scripts/product-intake/upload-package-image.ts --package ${outDir}/<id> --apply --confirm`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
