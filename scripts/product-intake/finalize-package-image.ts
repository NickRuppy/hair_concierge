import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, relative, resolve } from "node:path"

import sharp from "sharp"

const PRODUCT_IMAGE_PUBLIC_URL_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
const PRODUCT_IMAGE_BUCKET = "product-images"
const CANVAS_SIZE = 1200
const PRODUCT_MAX_SIZE = 940
const PRODUCT_TARGET_AREA = 460_000
const BACKGROUND = { r: 243, g: 239, b: 232 }
const MAGENTA_QA_BACKGROUND = { r: 255, g: 0, b: 255 }

type JsonRecord = Record<string, any>

type CutoutQualityGate =
  | {
      status: "pass"
      checks: Record<string, number>
    }
  | {
      status: "needs_image_work"
      reason: string
      checks: Record<string, number>
    }

export type FinalizePackageImageOptions = {
  packageDir: string
  allowUnreviewedCandidate?: boolean
  reviewedBy?: string
}

export type FinalizedPackageImage = {
  packageDir: string
  sourceFile: string
  selectedNoBgFile: string
  qaFile: string
  finalFile: string
  publicUrl: string
  storagePath: string
  sha256: string
}

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord
}

function readOptionalJson(path: string): JsonRecord | null {
  return existsSync(path) ? readJson(path) : null
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function reviewedCandidateFile(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, "http://review.local")
    const file = url.searchParams.get("file")
    if (file?.trim()) return file.trim().replaceAll("\\", "/")
  } catch {
    // Fall back to substring matching below for older local review URLs.
  }
  return null
}

function candidateMatchesReview(candidate: JsonRecord, reviewUrl: string | null): boolean {
  if (!reviewUrl) return false
  const localFile = stringValue(candidate.local_file)?.replaceAll("\\", "/")
  const sourceImageUrl = stringValue(candidate.source_image_url)
  const sourcePageUrl = stringValue(candidate.source_page_url)
  const reviewedFile = reviewedCandidateFile(reviewUrl)

  if (localFile && reviewedFile === localFile) return true
  if (localFile && reviewUrl.includes(localFile)) return true
  if (sourceImageUrl && reviewUrl === sourceImageUrl) return true
  if (sourcePageUrl && reviewUrl === sourcePageUrl) return true
  return false
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function contentBounds(data: Buffer, width: number, height: number): sharp.Region {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 18) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Selected image has no visible alpha content")
  }

  const margin = Math.round(Math.min(width, height) * 0.025)
  left = clamp(left - margin, 0, width - 1)
  top = clamp(top - margin, 0, height - 1)
  right = clamp(right + margin, 0, width - 1)
  bottom = clamp(bottom + margin, 0, height - 1)

  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

function targetProductSize(bounds: sharp.Region): { width: number; height: number } {
  const maxSideScale = Math.min(PRODUCT_MAX_SIZE / bounds.width, PRODUCT_MAX_SIZE / bounds.height)
  const areaScale = Math.sqrt(PRODUCT_TARGET_AREA / (bounds.width * bounds.height))
  const scale = Math.min(maxSideScale, areaScale)

  return {
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale)),
  }
}

function alphaCoverage(data: Buffer, width: number, height: number): number {
  let alphaPixels = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 18) alphaPixels += 1
    }
  }
  return alphaPixels / (width * height)
}

function cutoutQualityGate(params: {
  data: Buffer
  width: number
  height: number
  sourceAlphaCoverage: number
  usedPreparedCutout: boolean
}): CutoutQualityGate {
  const { data, width, height } = params
  const bottomStart = Math.floor(height * 0.85)
  let bottomAlpha = 0
  let bottomDark = 0
  let alphaPixels = 0
  let darkOpaquePixels = 0
  const bottomTotal = width * (height - bottomStart)
  const total = width * height

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = data[index + 3]
      if (alpha <= 18) continue
      alphaPixels += 1
      const lum = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
      if (alpha > 245 && lum < 35) darkOpaquePixels += 1
      if (y >= bottomStart) {
        bottomAlpha += 1
        if (lum < 55) bottomDark += 1
      }
    }
  }

  const checks = {
    alpha_coverage: alphaPixels / total,
    source_alpha_coverage: params.sourceAlphaCoverage,
    alpha_retention:
      params.sourceAlphaCoverage > 0 ? alphaPixels / total / params.sourceAlphaCoverage : 1,
    dark_opaque_coverage: darkOpaquePixels / total,
    bottom_alpha_coverage: bottomAlpha / bottomTotal,
    bottom_dark_coverage: bottomDark / bottomTotal,
  }

  if (
    params.usedPreparedCutout &&
    params.sourceAlphaCoverage > 0.05 &&
    params.sourceAlphaCoverage < 0.8 &&
    checks.alpha_retention < 0.55
  ) {
    return {
      status: "needs_image_work",
      reason:
        "Prepared cutout kept too little of a useful alpha source. The background-removal step likely destroyed product content.",
      checks,
    }
  }

  if (checks.dark_opaque_coverage > 0.55 && checks.alpha_coverage > 0.9) {
    return {
      status: "needs_image_work",
      reason:
        "Source/cutout still contains a mostly opaque dark background. Use Vision/rembg or find a cleaner exact product source.",
      checks,
    }
  }

  if (checks.bottom_dark_coverage > 0.12 && checks.bottom_alpha_coverage > 0.18) {
    return {
      status: "needs_image_work",
      reason:
        "Cutout still contains a dense dark reflection/background tail near the bottom. Find a cleaner source or manually remove the reflection before approval.",
      checks,
    }
  }

  return { status: "pass", checks }
}

function finalProductLabel(payload: JsonRecord, submission: JsonRecord): string {
  const product = isRecord(payload.final?.product)
    ? payload.final.product
    : isRecord(payload.draft?.product)
      ? payload.draft.product
      : {}
  return [
    stringValue(product.canonical_brand) ?? stringValue(submission.brand_text),
    stringValue(product.product_line),
    stringValue(product.clean_name) ?? stringValue(submission.product_name_text),
  ]
    .filter(Boolean)
    .join(" ")
}

function selectedCandidate(params: {
  packageDir: string
  allowUnreviewedCandidate: boolean
}): JsonRecord {
  const imageCandidates = readOptionalJson(join(params.packageDir, "image-candidates.json"))
  const candidates = Array.isArray(imageCandidates?.candidates)
    ? imageCandidates.candidates.filter(isRecord)
    : []
  if (candidates.length === 0) {
    throw new Error(`No image candidates found in ${params.packageDir}`)
  }

  const review = readOptionalJson(join(params.packageDir, "image-review.json"))
  if (review?.status === "candidate_approved") {
    const reviewUrl = stringValue(review.candidate_url)
    const matchingCandidate = candidates.find((candidate) =>
      candidateMatchesReview(candidate, reviewUrl),
    )
    if (matchingCandidate) return matchingCandidate
    if (candidates.length === 1 && stringValue(candidates[0].local_file)) {
      return candidates[0]
    }
    throw new Error(
      `Approved image review does not match a current image candidate for ${params.packageDir}. Re-approve the intended candidate in the review app.`,
    )
  }

  if (params.allowUnreviewedCandidate && candidates.length === 1) {
    return candidates[0]
  }

  throw new Error(
    `Image candidate is not approved for ${params.packageDir}. Approve it in the review app or pass --allow-unreviewed-candidate for preview-only generation.`,
  )
}

async function writeComposite(params: {
  input: Buffer
  output: string
  background: { r: number; g: number; b: number }
}): Promise<void> {
  const meta = await sharp(params.input).metadata()
  const left = Math.round((CANVAS_SIZE - (meta.width ?? PRODUCT_MAX_SIZE)) / 2)
  const top = Math.round((CANVAS_SIZE - (meta.height ?? PRODUCT_MAX_SIZE)) / 2)

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: params.background,
    },
  })
    .composite([{ input: params.input, left, top }])
    .webp({ quality: 88, effort: 5 })
    .toFile(params.output)
}

export async function finalizeProductIntakePackageImage(
  options: FinalizePackageImageOptions,
): Promise<FinalizedPackageImage> {
  const packageDir = resolve(options.packageDir)
  const submission = readJson(join(packageDir, "submission.json"))
  const payload = readJson(join(packageDir, "payload.json"))
  const candidate = selectedCandidate({
    packageDir,
    allowUnreviewedCandidate: options.allowUnreviewedCandidate === true,
  })
  const localFile = stringValue(candidate.local_file)
  if (!localFile) {
    throw new Error("Selected image candidate must have a package-local local_file")
  }

  const sourceFile = resolve(packageDir, localFile)
  if (!existsSync(sourceFile)) {
    throw new Error(`Selected local image does not exist: ${sourceFile}`)
  }
  const sourceBase = basename(localFile, extname(localFile))
  const preparedCutoutFile = join(packageDir, "images/selected-nobg", `${sourceBase}.png`)

  const sourceMeta = await sharp(sourceFile).metadata()
  const hasPreparedCutout = existsSync(preparedCutoutFile)
  if (!sourceMeta.hasAlpha && !hasPreparedCutout) {
    throw new Error(
      `Selected image has no alpha channel: ${sourceFile}. Run the documented Vision/rembg background-removal step first and place the cutout in images/selected-nobg/.`,
    )
  }

  const label = finalProductLabel(payload, submission) || basename(packageDir)
  const baseSlug = slug(label) || slug(basename(packageDir)) || "product"
  const selectedNoBgRelative = `images/selected-nobg/${baseSlug}.png`
  const qaRelative = `images/qa/${baseSlug}-magenta.webp`
  mkdirSync(join(packageDir, dirname(selectedNoBgRelative)), { recursive: true })
  mkdirSync(join(packageDir, dirname(qaRelative)), { recursive: true })
  mkdirSync(join(packageDir, "images/final"), { recursive: true })

  const { data: sourceData, info: sourceInfo } = await sharp(sourceFile)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const sourceAlphaCoverage = sourceMeta.hasAlpha
    ? alphaCoverage(sourceData, sourceInfo.width, sourceInfo.height)
    : 0

  let processingInputFile = sourceFile
  let data = sourceData
  let info = sourceInfo
  let qualityGate = cutoutQualityGate({
    data: sourceData,
    width: sourceInfo.width,
    height: sourceInfo.height,
    sourceAlphaCoverage,
    usedPreparedCutout: false,
  })

  if (!sourceMeta.hasAlpha || (qualityGate.status !== "pass" && hasPreparedCutout)) {
    const prepared = await sharp(preparedCutoutFile)
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const preparedQualityGate = cutoutQualityGate({
      data: prepared.data,
      width: prepared.info.width,
      height: prepared.info.height,
      sourceAlphaCoverage,
      usedPreparedCutout: true,
    })

    if (!sourceMeta.hasAlpha || preparedQualityGate.status === "pass") {
      processingInputFile = preparedCutoutFile
      data = prepared.data
      info = prepared.info
      qualityGate = preparedQualityGate
    }
  }
  const bounds = contentBounds(data, info.width, info.height)
  const selectedNoBgFile = join(packageDir, selectedNoBgRelative)

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(selectedNoBgFile)

  const productBuffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(bounds)
    .resize({ ...targetProductSize(bounds), fit: "fill" })
    .png()
    .toBuffer()

  const qaFile = join(packageDir, qaRelative)
  await writeComposite({
    input: productBuffer,
    output: qaFile,
    background: MAGENTA_QA_BACKGROUND,
  })

  const finalDraftFile = join(packageDir, "images/final", `${baseSlug}-draft.webp`)
  await writeComposite({
    input: productBuffer,
    output: finalDraftFile,
    background: BACKGROUND,
  })

  const sha256 = sha256File(finalDraftFile)
  const finalRelative = `images/final/${baseSlug}-${sha256.slice(0, 12)}.webp`
  const finalFile = join(packageDir, finalRelative)
  if (finalFile !== finalDraftFile) {
    renameSync(finalDraftFile, finalFile)
  }

  const dateFolder = basename(dirname(packageDir))
  const submissionId =
    stringValue(submission.id) ??
    stringValue(submission.package_metadata?.submission_id) ??
    basename(packageDir)
  const storagePath = `product-intake/${dateFolder}/${submissionId}/${basename(finalFile)}`
  const publicUrl = `${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}${storagePath}`

  writeJson(join(packageDir, "image-finalization.json"), {
    status: qualityGate.status === "pass" ? "pending" : "needs_image_work",
    notes:
      qualityGate.status === "pass"
        ? "Final product image generated locally and awaiting review approval."
        : qualityGate.reason,
    generated_at: new Date().toISOString(),
    generated_by: options.reviewedBy ?? "codex",
    quality_gate: qualityGate,
    storage_bucket: PRODUCT_IMAGE_BUCKET,
    storage_path: storagePath,
    public_url: publicUrl,
    source_page_url: stringValue(candidate.source_page_url),
    source_image_url: stringValue(candidate.source_image_url),
    source_type: stringValue(candidate.source_type) ?? "unknown",
    quality_confidence: "high",
    processing_method: "local",
    selected_source_file: relative(packageDir, sourceFile),
    selected_nobg_file: selectedNoBgRelative,
    qa_file: qaRelative,
    final_file: finalRelative,
    asset_sha256: sha256,
    user_approved: false,
  })

  return {
    packageDir,
    sourceFile,
    selectedNoBgFile,
    qaFile,
    finalFile,
    publicUrl,
    storagePath,
    sha256,
  }
}

function parsePackageDirs(args: string[]): string[] {
  return args
    .filter((arg) => !arg.startsWith("--"))
    .map((arg) => arg.trim())
    .filter(Boolean)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const packageDirs = parsePackageDirs(args)
  const allowUnreviewedCandidate = args.includes("--allow-unreviewed-candidate")
  if (packageDirs.length === 0) {
    throw new Error(
      "usage: npx tsx scripts/product-intake/finalize-package-image.ts [--allow-unreviewed-candidate] <package-dir...>",
    )
  }

  for (const packageDir of packageDirs) {
    const result = await finalizeProductIntakePackageImage({
      packageDir,
      allowUnreviewedCandidate,
    })
    console.log(`Final image: ${relative(process.cwd(), result.finalFile)}`)
    console.log(`QA image: ${relative(process.cwd(), result.qaFile)}`)
    console.log(`Pending public URL: ${result.publicUrl}`)
  }
}

if (process.argv[1]?.endsWith("finalize-package-image.ts")) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
