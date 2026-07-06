import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises"
import { join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import sharp from "sharp"

import { PRODUCT_INTAKE_BUCKET } from "@/lib/product-intake/image-validation"
import {
  PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS,
  type ProductIntakeReviewCategoryKey,
} from "@/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "@/lib/product-intake/review-workflow"

import { createSupabaseClientFromEnv, flag, flagInt, parseArgs } from "./cli"
import {
  validateProductIntakeImageFinalization,
  type ProductIntakeImageFinalizationDecision,
} from "./image-finalization"
import { finalizeProductIntakePackageImage } from "./finalize-package-image"
import { IMAGE_FINALIZATION_FILE, RESEARCH_PACKAGE_ROOT } from "./prepare-research"
import { approveResearchPackage } from "./approve-package"

type JsonRecord = Record<string, any>

export type ReviewPackageSummary = {
  package_path: string
  submission_id: string | null
  category: string | null
  brand_text: string | null
  product_name_text: string | null
  validation_ok: boolean | null
  image_status: string
  image_candidate_status: ImageCandidateStatus
  package_state: ReviewPackageState
  package_state_reason: string
}

export type ReviewPackageDetail = {
  package_path: string
  package_state: ReviewPackageState
  package_state_reason: string
  submission: JsonRecord
  payload: JsonRecord
  validation: unknown | null
  stored_validation: unknown | null
  image_candidates: JsonRecord[]
  image_candidate_status: ImageCandidateStatus
  image_finalization: JsonRecord | null
  image_candidate_review: JsonRecord | null
  image_search_request: JsonRecord | null
  image_search_result: JsonRecord | null
  property_review: JsonRecord | null
  package_approval: JsonRecord | null
  approval_dry_run: JsonRecord | null
  approval_apply: JsonRecord | null
  source_links: ReviewSourceLink[]
  image_assets: ReviewImageAsset[]
  property_rows: ReviewPropertyRow[]
  image_refresh_error?: string | null
  research_md: string
  approval_md: string
}

export type ReviewSourceLink = {
  label: string
  url: string
  evidence: string | null
}

export type ReviewImageAsset = {
  label: string
  url: string
  kind: "user_front" | "user_barcode" | "candidate_product_image" | "final_product_image"
  source_page_url?: string | null
  source_image_url?: string | null
  source_type?: string | null
  local_file?: string | null
}

export type ReviewPropertyRow = {
  path: string
  label: string
  value: string
  rationale: string | null
  sources: ReviewSourceLink[]
  review: JsonRecord | null
}

export type ImageCandidateReviewDecision = {
  status: "candidate_approved" | "needs_new_candidate" | "comment"
  candidate_url: string | null
  notes: string
  reviewed_by: string
  reviewed_at: string
}

export type ImageSearchRequest = {
  status: "requested"
  query: string
  requirements: string[]
  reject: string[]
  preferred_sources: string[]
  notes: string
  requested_by: string
  requested_at: string
}

export type ImageSearchResult = {
  status: "candidate_found" | "no_candidate_found"
  query: string
  message: string
  attempted_pages: string[]
  attempted_images: string[]
  rejected: Array<{ url: string; reason: string }>
  candidate: JsonRecord | null
  local_file: string | null
  source_page_url: string | null
  source_image_url: string | null
  searched_at: string
}

export type PropertyReviewDecision = {
  path: string
  status: "approved" | "change_requested"
  proposed_value: string
  reviewer_value?: string | null
  notes?: string | null
  reviewed_by: string
  reviewed_at: string
}

export type PackageApprovalDecision = {
  status: "approved_for_import"
  notes: string
  reviewed_by: string
  reviewed_at: string
}

type PendingImageDecision = {
  status: "pending" | "needs_image_work"
  notes?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

type ImageFinalizationDecision = ProductIntakeImageFinalizationDecision | PendingImageDecision

export type ImageCandidateStatus = "ready" | "missing" | "remote_only" | "broken"

export type ReviewPackageState =
  | "package_needs_research"
  | "package_in_progress"
  | "package_rework_requested"
  | "package_ready_for_review"
  | "package_blocked"

export type ReviewPackageStateResult = {
  package_state: ReviewPackageState
  package_state_reason: string
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function researchRoot(rootDir: string): string {
  return resolve(rootDir, RESEARCH_PACKAGE_ROOT)
}

function resolvePackagePath(params: { rootDir: string; packagePath: string }): string {
  const root = researchRoot(params.rootDir)
  const packagePath = resolve(params.rootDir, params.packagePath)
  if (packagePath !== root && !packagePath.startsWith(`${root}${sep}`)) {
    throw new Error(`Package path is outside ${RESEARCH_PACKAGE_ROOT}: ${params.packagePath}`)
  }
  return packagePath
}

function localPackageFileUrl(params: { packagePath: string; filePath: string }): string {
  return `/api/package/file?path=${encodeURIComponent(params.packagePath)}&file=${encodeURIComponent(
    params.filePath,
  )}`
}

function resolvePackageFilePath(params: {
  rootDir: string
  packagePath: string
  filePath: string
}): string {
  const packagePath = resolvePackagePath(params)
  const normalizedFilePath = params.filePath.replaceAll("\\", "/")
  if (
    normalizedFilePath.startsWith("/") ||
    normalizedFilePath.includes("\0") ||
    !normalizedFilePath.startsWith("images/")
  ) {
    throw new Error("Package file must be a relative path under images/")
  }
  const filePath = resolve(packagePath, normalizedFilePath)
  if (filePath === packagePath || !filePath.startsWith(`${packagePath}${sep}`)) {
    throw new Error("Package file is outside the selected research package")
  }
  return filePath
}

async function resolvePackageFileReadPath(params: {
  rootDir: string
  packagePath: string
  filePath: string
}): Promise<string> {
  const packagePath = resolvePackagePath(params)
  const imagesPath = resolve(packagePath, "images")
  const filePath = resolvePackageFilePath(params)
  const [packageRealPath, imagesRealPath, fileRealPath, fileStat] = await Promise.all([
    realpath(packagePath),
    realpath(imagesPath),
    realpath(filePath),
    lstat(filePath),
  ])

  if (fileStat.isSymbolicLink()) {
    throw new Error("Package image file must not be a symlink")
  }
  if (
    imagesRealPath !== packageRealPath &&
    !imagesRealPath.startsWith(`${packageRealPath}${sep}`)
  ) {
    throw new Error("Package images directory is outside the selected research package")
  }
  if (fileRealPath === imagesRealPath || !fileRealPath.startsWith(`${imagesRealPath}${sep}`)) {
    throw new Error("Package image file is outside the selected package images directory")
  }

  return fileRealPath
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown
}

async function readOptionalJson(path: string): Promise<unknown | null> {
  try {
    return await readJson(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

async function readOptionalText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw error
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function submissionId(submission: unknown, packagePath: string): string | null {
  if (isRecord(submission)) {
    const direct = stringValue(submission.id)
    if (direct) return direct
    if (isRecord(submission.package_metadata)) {
      const metadata = stringValue(submission.package_metadata.submission_id)
      if (metadata) return metadata
    }
  }
  return packagePath.split(sep).at(-1) ?? null
}

function submissionField(submission: unknown, key: string): string | null {
  return isRecord(submission) ? stringValue(submission[key]) : null
}

function imageStatus(value: unknown): string {
  return isRecord(value) ? (stringValue(value.status) ?? "unknown") : "missing"
}

function imageReviewStatus(value: unknown): string {
  const status = imageStatus(value)
  if (status === "pending" && isRecord(value) && stringValue(value.final_file)) {
    return "final_ready"
  }
  return status
}

function validationOk(value: unknown): boolean | null {
  return isRecord(value) && typeof value.ok === "boolean" ? value.ok : null
}

function productSearchName(params: { submission: JsonRecord; payload: JsonRecord }): string {
  const product = isRecord(params.payload.final?.product)
    ? params.payload.final.product
    : isRecord(params.payload.draft?.product)
      ? params.payload.draft.product
      : {}
  return [
    stringValue(product.canonical_brand) ?? stringValue(params.submission.brand_text),
    stringValue(product.product_line),
    stringValue(product.clean_name) ?? stringValue(params.submission.product_name_text),
  ]
    .filter(Boolean)
    .join(" ")
}

function buildImageSearchRequest(params: {
  submission: JsonRecord
  payload: JsonRecord
  notes?: string | null
  requestedBy: string
  requestedAt: string
}): ImageSearchRequest {
  const productName = productSearchName({ submission: params.submission, payload: params.payload })
  const gtin = Array.isArray(params.payload.final?.identifiers)
    ? params.payload.final.identifiers
        .filter(isRecord)
        .map((identifier: JsonRecord) => stringValue(identifier.value))
        .find(Boolean)
    : null
  const queryParts = [
    productName,
    gtin,
    "official product image front packshot transparent background",
  ].filter(Boolean)

  return {
    status: "requested",
    query: queryParts.join(" "),
    requirements: [
      "Exaktes Produkt / exact product: Marke, Linie, Produktname und Packung muessen zum Research-Payload passen.",
      "Frontale Packshot-Ansicht / front-facing packshot: ganze Flasche/Tube/Dose sichtbar, nicht angeschnitten.",
      "Hintergrund / background: transparent or plain light background; keine dunkle, reflektierende oder Lifestyle-Szene.",
      "Qualitaet: mindestens ca. 700 px auf der langen Kante, scharf, keine Wasserzeichen.",
      "Quelle: bevorzugt offizielle Brand-/Henkel-/Hersteller-Quelle oder vertrauenswuerdiger Retailer.",
    ],
    reject: [
      "Kein Lifestyle-, Model-, Badezimmer- oder Regalbild.",
      "Keine dunklen / dark Spiegelungs-/Glow-Hintergruende, wenn sie nicht sauber entfernt werden koennen.",
      "Keine falsche Variante, falsche Groesse, altes Packaging oder aehnliche Produktlinie.",
      "Kein niedrig aufgeloestes, verpixeltes oder schraeg fotografiertes Bild.",
    ],
    preferred_sources: [
      "Offizielle Brand-/Hersteller-Produktseite",
      "Hersteller-DAM oder CDN-Bild",
      "Retailer-Produktseite mit exakt passender GTIN",
    ],
    notes: params.notes?.trim() ?? "",
    requested_by: params.requestedBy,
    requested_at: params.requestedAt,
  }
}

function packageGtin(payload: JsonRecord): string | null {
  if (!Array.isArray(payload.final?.identifiers)) return null
  return (
    payload.final.identifiers
      .filter(isRecord)
      .find((identifier: JsonRecord) => stringValue(identifier.type)?.toLowerCase() === "gtin")
      ?.value ?? null
  )
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function sourcePageUrls(payload: JsonRecord): string[] {
  const product = isRecord(payload.final?.product) ? payload.final.product : null
  const sourceUrls = sourceLinks(payload).map((source) => source.url)
  return uniqueStrings([
    ...sourceUrls,
    safeHttpUrl(product?.affiliate_link),
    safeHttpUrl(product?.image_url),
  ])
}

function looksLikeDirectImageUrl(url: string): boolean {
  return (
    /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(url) ||
    /^https:\/\/dm\.henkel-dam\.com\/is\/image\/henkel\//i.test(url) ||
    /^https:\/\/products\.dm-static\.com\/images\//i.test(url)
  )
}

function normalizedImageFetchUrl(url: string): string {
  if (/^https:\/\/dm\.henkel-dam\.com\/is\/image\/henkel\//i.test(url) && !url.includes("?")) {
    return `${url}?fmt=png-alpha&qlt=90&wid=900`
  }
  if (/^https:\/\/products\.dm-static\.com\/images\//i.test(url)) {
    return url.replace(/h_\d+,w_\d+/i, "h_1000,w_1000").replace(/w_\d+,h_\d+/i, "w_1000,h_1000")
  }
  return url
}

function dmDanFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "www.dm.de") return null
    return parsed.pathname.match(/\/p\/d\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

function dmSearchUrl(query: string): string {
  const url = new URL("https://product-search.services.dmtech.com/de/search/crawl")
  url.searchParams.set("query", query)
  return url.toString()
}

function dmTileUrl(dan: string): string {
  return `https://products.dm.de/product/products/tiles/DE/dans/${dan}`
}

function dmProductPageUrl(self: unknown): string | null {
  const value = stringValue(self)
  if (!value) return null
  try {
    return new URL(value, "https://www.dm.de").toString()
  } catch {
    return null
  }
}

function dmTileImageUrls(product: unknown): Array<{ imageUrl: string; pageUrl: string | null }> {
  if (!isRecord(product)) return []
  const tileData = isRecord(product.tileData) ? product.tileData : product
  const pageUrl = dmProductPageUrl(product.self) ?? dmProductPageUrl(tileData.self)
  const images = Array.isArray(tileData.images) ? tileData.images : []
  return images
    .filter(isRecord)
    .map((image) => stringValue(image.tileSrc) ?? stringValue(image.src))
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ imageUrl: normalizedImageFetchUrl(url), pageUrl }))
}

async function dmProductImagesFromDan(
  dan: string,
): Promise<Array<{ imageUrl: string; pageUrl: string | null }>> {
  const response = await fetchWithTimeout(dmTileUrl(dan))
  if (!response.ok) return []
  const body = await response.json()
  const product = isRecord(body) && isRecord(body.products) ? body.products[dan] : null
  return dmTileImageUrls(product)
}

async function dmProductImagesFromSearch(
  query: string,
): Promise<Array<{ imageUrl: string; pageUrl: string | null }>> {
  const response = await fetchWithTimeout(dmSearchUrl(query))
  if (!response.ok) return []
  const body = await response.json()
  const products = isRecord(body) && Array.isArray(body.products) ? body.products : []
  return products.flatMap((product) => dmTileImageUrls(product))
}

function htmlImageUrls(html: string, pageUrl: string): string[] {
  const urls = new Set<string>()
  const directImagePattern =
    /https?:\/\/[^"'<>\\\s]+(?:\.(?:png|jpe?g|webp)|\/is\/image\/henkel\/[^"'<>\\\s]+)(?:\?[^"'<>\\\s]*)?/gi
  for (const match of html.matchAll(directImagePattern)) {
    const safe = safeHttpUrl(match[0].replaceAll("&amp;", "&"))
    if (safe) urls.add(safe)
  }

  const attributePattern = /\b(?:src|content|data-src|data-original)=["']([^"']+)["']/gi
  for (const match of html.matchAll(attributePattern)) {
    const raw = match[1]?.replaceAll("&amp;", "&")
    if (!raw || !looksLikeDirectImageUrl(raw)) continue
    try {
      const resolved = new URL(raw, pageUrl).toString()
      const safe = safeHttpUrl(resolved)
      if (safe) urls.add(safe)
    } catch {
      // Ignore malformed image attributes from retailer pages.
    }
  }

  return [...urls]
}

function rejectImageUrlBeforeDownload(url: string): string | null {
  const lowered = url.toLowerCase()
  if (/(?:_usp-|_how-|_moo-|_vn-|_ra-|mood|teaser|background|banner)/i.test(lowered)) {
    return "URL looks like a marketing/lifestyle tile, not a clean packshot."
  }
  return null
}

const GENERIC_IMAGE_MATCH_TOKENS = new Set([
  "and",
  "background",
  "conditioner",
  "front",
  "haar",
  "hair",
  "image",
  "leave",
  "mask",
  "official",
  "oil",
  "packshot",
  "product",
  "shampoo",
  "transparent",
])

function normalizedSearchTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3 && !GENERIC_IMAGE_MATCH_TOKENS.has(token)),
    ),
  ]
}

function imageIdentityMismatchReason(params: {
  imageUrl: string
  sourcePageUrl: string | null
  productName: string
  gtin: string | null
}): string | null {
  const haystack = `${params.imageUrl} ${params.sourcePageUrl ?? ""}`.toLowerCase()
  if (params.gtin && haystack.includes(params.gtin)) return null

  const tokens = normalizedSearchTokens(params.productName)
  if (tokens.length === 0) return null
  const matchedTokens = tokens.filter((token) => haystack.includes(token))
  const minimumMatches = tokens.length === 1 ? 1 : 2
  if (matchedTokens.length >= minimumMatches) return null

  return `Image source identity does not match enough product tokens (${matchedTokens.length}/${minimumMatches}).`
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      "user-agent": "Hair Concierge product-intake review app/1.0",
      accept: "text/html,image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
    },
  })
}

async function inspectCandidateImage(buffer: Buffer): Promise<{
  width: number
  height: number
  alphaCoverage: number
  darkOpaqueCoverage: number
  normalizedPng: Buffer
}> {
  const image = sharp(buffer, { failOn: "none" }).rotate()
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const normalizedPng = await image.png().toBuffer()
  const raw = await sharp(normalizedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = raw.info.width * raw.info.height
  let alphaPixels = 0
  let darkOpaquePixels = 0
  for (let offset = 0; offset < raw.data.length; offset += 4) {
    const red = raw.data[offset] ?? 0
    const green = raw.data[offset + 1] ?? 0
    const blue = raw.data[offset + 2] ?? 0
    const alpha = raw.data[offset + 3] ?? 0
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    if (alpha > 16) alphaPixels += 1
    if (alpha > 245 && luminance < 42) darkOpaquePixels += 1
  }

  return {
    width,
    height,
    alphaCoverage: pixels > 0 ? alphaPixels / pixels : 0,
    darkOpaqueCoverage: pixels > 0 ? darkOpaquePixels / pixels : 0,
    normalizedPng,
  }
}

function candidateImageRejectionReason(params: {
  width: number
  height: number
  darkOpaqueCoverage: number
}): string | null {
  if (Math.max(params.width, params.height) < 600) {
    return "Image is too small for final product asset review."
  }
  if (params.darkOpaqueCoverage > 0.35) {
    return "Image still has a mostly opaque dark background."
  }
  return null
}

async function searchReplacementImageCandidate(params: {
  packagePath: string
  submission: JsonRecord
  payload: JsonRecord
  request: ImageSearchRequest
  searchedAt: string
}): Promise<ImageSearchResult> {
  const attemptedPages: string[] = []
  const attemptedImages: string[] = []
  const rejected: ImageSearchResult["rejected"] = []
  const productName = productSearchName({ submission: params.submission, payload: params.payload })
  const gtin = packageGtin(params.payload)
  const pageUrls = sourcePageUrls(params.payload)
  const imageUrls = new Map<string, { sourcePageUrl: string | null; enforceIdentity: boolean }>()

  for (const pageUrl of pageUrls) {
    const dmDan = dmDanFromUrl(pageUrl)
    if (dmDan) {
      attemptedPages.push(dmTileUrl(dmDan))
      try {
        for (const image of await dmProductImagesFromDan(dmDan)) {
          if (!imageUrls.has(image.imageUrl)) {
            imageUrls.set(image.imageUrl, {
              sourcePageUrl: image.pageUrl ?? pageUrl,
              enforceIdentity: false,
            })
          }
        }
      } catch (error) {
        rejected.push({
          url: dmTileUrl(dmDan),
          reason: `dm product image API could not be read: ${(error as Error).message}`,
        })
      }
    }

    if (looksLikeDirectImageUrl(pageUrl)) {
      imageUrls.set(normalizedImageFetchUrl(pageUrl), {
        sourcePageUrl: null,
        enforceIdentity: false,
      })
      continue
    }
    attemptedPages.push(pageUrl)
    try {
      const response = await fetchWithTimeout(pageUrl)
      if (!response.ok) {
        rejected.push({ url: pageUrl, reason: `Source page returned HTTP ${response.status}.` })
        continue
      }
      const html = await response.text()
      for (const imageUrl of htmlImageUrls(html, pageUrl)) {
        if (!imageUrls.has(imageUrl)) {
          imageUrls.set(imageUrl, {
            sourcePageUrl: pageUrl,
            enforceIdentity: false,
          })
        }
      }
    } catch (error) {
      rejected.push({
        url: pageUrl,
        reason: `Source page could not be read: ${(error as Error).message}`,
      })
    }
  }

  if (imageUrls.size === 0 && productName) {
    const searchUrl = dmSearchUrl(productName)
    attemptedPages.push(searchUrl)
    try {
      for (const image of await dmProductImagesFromSearch(productName)) {
        if (!imageUrls.has(image.imageUrl)) {
          imageUrls.set(image.imageUrl, {
            sourcePageUrl: image.pageUrl,
            enforceIdentity: true,
          })
        }
      }
    } catch (error) {
      rejected.push({
        url: searchUrl,
        reason: `dm product search could not be read: ${(error as Error).message}`,
      })
    }
  }

  for (const [imageUrl, source] of imageUrls) {
    const sourcePageUrl = source.sourcePageUrl
    const preflightRejection = rejectImageUrlBeforeDownload(imageUrl)
    if (preflightRejection) {
      rejected.push({ url: imageUrl, reason: preflightRejection })
      continue
    }
    if (source.enforceIdentity) {
      const identityRejection = imageIdentityMismatchReason({
        imageUrl,
        sourcePageUrl,
        productName,
        gtin,
      })
      if (identityRejection) {
        rejected.push({ url: imageUrl, reason: identityRejection })
        continue
      }
    }

    attemptedImages.push(imageUrl)
    try {
      const response = await fetchWithTimeout(normalizedImageFetchUrl(imageUrl))
      if (!response.ok) {
        rejected.push({ url: imageUrl, reason: `Image returned HTTP ${response.status}.` })
        continue
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const inspection = await inspectCandidateImage(buffer)
      const rejectionReason = candidateImageRejectionReason(inspection)
      if (rejectionReason) {
        rejected.push({ url: imageUrl, reason: rejectionReason })
        continue
      }

      const hash = createHash("sha256").update(inspection.normalizedPng).digest("hex").slice(0, 12)
      const localFile = `images/source/replacement-${hash}.png`
      const localPath = join(params.packagePath, localFile)
      await mkdir(join(params.packagePath, "images", "source"), { recursive: true })
      await writeFile(localPath, inspection.normalizedPng)

      const candidate: JsonRecord = {
        label: "Neuer Bildkandidat aus Quellensuche",
        source_page_url: sourcePageUrl,
        source_image_url: imageUrl,
        source_type: "search_result",
        source_provenance: "review_app_source_search",
        local_file: localFile,
        notes: [
          "Automatisch aus den Research-Quellen gefunden.",
          productName ? `Produktabgleich: ${productName}` : null,
          gtin ? `GTIN im Suchkontext: ${gtin}` : null,
          params.request.notes || null,
        ]
          .filter(Boolean)
          .join(" "),
        inspected: {
          width: inspection.width,
          height: inspection.height,
          alpha_coverage: Number(inspection.alphaCoverage.toFixed(4)),
          dark_opaque_coverage: Number(inspection.darkOpaqueCoverage.toFixed(4)),
        },
      }

      const existingRaw = await readOptionalJson(join(params.packagePath, "image-candidates.json"))
      const existingCandidates = imageCandidates(existingRaw)
      const alreadyExists = existingCandidates.some(
        (existing) => stringValue(existing.source_image_url) === imageUrl,
      )
      const nextCandidates = alreadyExists
        ? existingCandidates.map((existing) =>
            stringValue(existing.source_image_url) === imageUrl
              ? {
                  ...existing,
                  source_page_url: stringValue(existing.source_page_url) ?? sourcePageUrl,
                  source_type: stringValue(existing.source_type) ?? candidate.source_type,
                  source_provenance:
                    stringValue(existing.source_provenance) ?? candidate.source_provenance,
                  inspected: isRecord(existing.inspected)
                    ? existing.inspected
                    : candidate.inspected,
                }
              : existing,
          )
        : [...existingCandidates, candidate]
      await writeJson(join(params.packagePath, "image-candidates.json"), {
        candidates: nextCandidates,
      })

      return {
        status: "candidate_found",
        query: params.request.query,
        message: "Neuer Bildkandidat gefunden und lokal im Paket gespeichert.",
        attempted_pages: attemptedPages,
        attempted_images: attemptedImages,
        rejected,
        candidate,
        local_file: stringValue(candidate.local_file),
        source_page_url: sourcePageUrl,
        source_image_url: imageUrl,
        searched_at: params.searchedAt,
      }
    } catch (error) {
      rejected.push({
        url: imageUrl,
        reason: `Image could not be processed: ${(error as Error).message}`,
      })
    }
  }

  return {
    status: "no_candidate_found",
    query: params.request.query,
    message:
      "Keine bessere Quelle in den vorhandenen Research-Links gefunden. Codex/Web-Recherche oder manuelle Bildquelle noetig.",
    attempted_pages: attemptedPages,
    attempted_images: attemptedImages,
    rejected,
    candidate: null,
    local_file: null,
    source_page_url: null,
    source_image_url: null,
    searched_at: params.searchedAt,
  }
}

export function classifyReviewPackageState(params: {
  payload: unknown
  validation: unknown
  imageFinalization: unknown
  imageCandidateStatus?: ImageCandidateStatus
  propertyReviewStatus?: "change_requested" | null
}): ReviewPackageStateResult {
  if (!isRecord(params.payload)) {
    return {
      package_state: "package_blocked",
      package_state_reason: "payload.json is missing or not an object",
    }
  }

  if (!isRecord(params.payload.final)) {
    return {
      package_state: "package_needs_research",
      package_state_reason: "No final researched payload yet",
    }
  }

  const image = imageStatus(params.imageFinalization)
  const imageReady = image === "approved_asset" || image === "no_image_approved_for_now"
  const productReady = validationOk(params.validation) === true
  const candidateStatus = params.imageCandidateStatus ?? null

  if (productReady && params.propertyReviewStatus === "change_requested") {
    return {
      package_state: "package_rework_requested",
      package_state_reason:
        "Nick requested property changes; update the research payload before final approval",
    }
  }

  if (productReady && imageReady) {
    return {
      package_state: "package_ready_for_review",
      package_state_reason: "Product data and image decision are ready for Nick review",
    }
  }

  if (productReady && !imageReady && candidateStatus === "missing") {
    return {
      package_state: "package_needs_research",
      package_state_reason: "No product image candidate in package",
    }
  }

  if (productReady && !imageReady && candidateStatus === "remote_only") {
    return {
      package_state: "package_needs_research",
      package_state_reason: "Product image candidate is not cached locally",
    }
  }

  if (productReady && !imageReady && candidateStatus === "broken") {
    return {
      package_state: "package_needs_research",
      package_state_reason: "Product image candidate local file is missing",
    }
  }

  const blockers = [
    productReady ? null : "product data is not validation-ready",
    imageReady ? null : "image decision is not finalized",
  ].filter(Boolean)

  return {
    package_state: "package_in_progress",
    package_state_reason: blockers.join("; "),
  }
}

function supportedReviewCategory(value: unknown): ProductIntakeReviewCategoryKey | null {
  const category = stringValue(value)
  if (!category) return null
  return PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS.includes(category as ProductIntakeReviewCategoryKey)
    ? (category as ProductIntakeReviewCategoryKey)
    : null
}

function livePackageValidation(params: {
  submission: unknown
  payload: unknown
  packagePath: string
}): unknown | null {
  const category = supportedReviewCategory(submissionField(params.submission, "category"))
  if (!category) return null
  return dryRunProductIntakeReadyForReview({
    id:
      submissionId(params.submission, params.packagePath) ??
      params.packagePath.split(sep).at(-1) ??
      "",
    category,
    researched_payload: params.payload,
  })
}

function displayValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) {
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return value.map(String).join(", ")
    }
    return JSON.stringify(value)
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.every(([, child]) => !isRecord(child) && !Array.isArray(child))) {
      return entries.map(([key, child]) => `${key}: ${displayValue(child)}`).join(" · ")
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function safeHttpUrl(value: unknown): string | null {
  const raw = stringValue(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null
  } catch {
    return null
  }
}

function leafLabel(path: string): string {
  const normalized = path.replace(/\[\d+\]/g, "")
  return normalized.split(".").at(-1) ?? path
}

function humanPropertyLabel(path: string): string {
  const exactLabels: Record<string, string> = {
    "product.canonical_brand": "Marke",
    "product.product_line": "Produktlinie",
    "product.clean_name": "Produktname",
    "product.category_key": "Kategorie",
    "product.affiliate_link": "Produktlink",
    "product.image_url": "Bildquelle",
    "product.price_eur": "Preis",
    "product.currency": "Waehrung",
    "product.purchase_link_status": "Kauf-Link Status",
    "product.purchase_link_checked_at": "Kauf-Link geprueft am",
    "product.price_checked_at": "Preis geprueft am",
    "category_specs.product_conditioner_rerank_specs.weight": "Gewichtung",
    "category_specs.product_conditioner_rerank_specs.repair_level": "Repair-Level",
    "category_specs.product_conditioner_rerank_specs.balance_direction": "Pflege-Richtung",
    "category_specs.product_conditioner_rerank_specs.ingredient_flags": "Inhaltsstoff-Hinweise",
  }
  if (exactLabels[path]) return exactLabels[path]

  const identifierMatch = /^identifiers\[(\d+)\]$/.exec(path)
  if (identifierMatch) return `Kennung ${Number(identifierMatch[1]) + 1}`

  const conditionerSpecMatch = /^category_specs\.product_conditioner_specs\[(\d+)\]$/.exec(path)
  if (conditionerSpecMatch) {
    return `Conditioner-Eignung ${Number(conditionerSpecMatch[1]) + 1}`
  }

  return leafLabel(path).replaceAll("_", " ")
}

function childRationaleLabel(parentPath: string, childPath: string): string {
  return childPath
    .slice(parentPath.length + 1)
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .join(" ")
    .replaceAll("_", " ")
}

function parentArrayPath(path: string): string | null {
  const match = /^(.*)\[\d+\]$/.exec(path)
  return match ? match[1] : null
}

function rationaleForPath(rationales: JsonRecord, path: string): string | null {
  const parts: string[] = []
  const parent = parentArrayPath(path)
  const parentRationale = parent ? stringValue(rationales[parent]) : null
  const exactRationale = stringValue(rationales[path])

  if (parentRationale) parts.push(parentRationale)
  if (exactRationale) parts.push(exactRationale)

  for (const [key, value] of Object.entries(rationales)) {
    if (!key.startsWith(`${path}.`)) continue
    const rationale = stringValue(value)
    if (!rationale) continue
    const label = childRationaleLabel(path, key)
    parts.push(label ? `${label}: ${rationale}` : rationale)
  }

  return parts.length ? parts.join("\n\n") : null
}

function flattenLeaves(params: {
  value: unknown
  prefix: string
  rows: Array<{ path: string; value: string }>
}) {
  if (Array.isArray(params.value)) {
    if (params.value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      params.rows.push({ path: params.prefix, value: displayValue(params.value) })
      return
    }

    if (
      params.value.every(
        (item) =>
          isRecord(item) &&
          Object.values(item).every((child) => !isRecord(child) && !Array.isArray(child)),
      )
    ) {
      params.value.forEach((item, index) => {
        params.rows.push({ path: `${params.prefix}[${index}]`, value: displayValue(item) })
      })
      return
    }

    params.value.forEach((item, index) => {
      flattenLeaves({ value: item, prefix: `${params.prefix}[${index}]`, rows: params.rows })
    })
    return
  }

  if (isRecord(params.value)) {
    for (const [key, child] of Object.entries(params.value)) {
      flattenLeaves({
        value: child,
        prefix: params.prefix ? `${params.prefix}.${key}` : key,
        rows: params.rows,
      })
    }
    return
  }

  params.rows.push({ path: params.prefix, value: displayValue(params.value) })
}

function sourceLinks(payload: JsonRecord): ReviewSourceLink[] {
  const finalSources = isRecord(payload.final) ? payload.final.sources : null
  if (!Array.isArray(finalSources)) return []

  return finalSources
    .map((source) => {
      if (!isRecord(source)) return null
      const url = safeHttpUrl(source.url)
      if (!url) return null
      return {
        label: stringValue(source.title) ?? url,
        url,
        evidence: stringValue(source.evidence),
      }
    })
    .filter((source): source is ReviewSourceLink => Boolean(source))
}

function imageCandidates(value: unknown): JsonRecord[] {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.candidates)
      ? value.candidates
      : []

  return candidates.filter((candidate): candidate is JsonRecord => isRecord(candidate))
}

export function imageCandidateStatus(params: {
  rootDir: string
  packagePath: string
  imageCandidates: JsonRecord[]
}): ImageCandidateStatus {
  if (params.imageCandidates.length === 0) return "missing"

  let hasRemoteCandidate = false
  let hasBrokenLocalCandidate = false

  for (const candidate of params.imageCandidates) {
    const localFile = stringValue(candidate.local_file)
    const sourceImageUrl = safeHttpUrl(candidate.source_image_url)
    if (sourceImageUrl) hasRemoteCandidate = true

    if (!localFile) continue

    try {
      const localPath = resolvePackageFilePath({
        rootDir: params.rootDir,
        packagePath: params.packagePath,
        filePath: localFile,
      })
      if (existsSync(localPath)) return "ready"
      hasBrokenLocalCandidate = true
    } catch {
      hasBrokenLocalCandidate = true
    }
  }

  if (hasBrokenLocalCandidate) return "broken"
  return hasRemoteCandidate ? "remote_only" : "missing"
}

function propertyRows(params: {
  payload: JsonRecord
  sources: ReviewSourceLink[]
  propertyReview: unknown
}): ReviewPropertyRow[] {
  const final = isRecord(params.payload.final) ? params.payload.final : null
  if (!final) return []

  const rawRows: Array<{ path: string; value: string }> = []
  if (isRecord(final.product)) {
    flattenLeaves({ value: final.product, prefix: "product", rows: rawRows })
  }
  if (Array.isArray(final.identifiers)) {
    flattenLeaves({ value: final.identifiers, prefix: "identifiers", rows: rawRows })
  }
  if (isRecord(final.category_specs)) {
    flattenLeaves({ value: final.category_specs, prefix: "category_specs", rows: rawRows })
  }

  const rationales = isRecord(final.field_rationales) ? final.field_rationales : {}
  const decisions =
    isRecord(params.propertyReview) && isRecord(params.propertyReview.decisions)
      ? params.propertyReview.decisions
      : {}

  return rawRows.map((row) => ({
    path: row.path,
    label: humanPropertyLabel(row.path),
    value: row.value,
    rationale: rationaleForPath(rationales, row.path),
    sources: params.sources,
    review: isCurrentPropertyReview(row, decisions[row.path]) ? decisions[row.path] : null,
  }))
}

function isCurrentPropertyReview(
  row: { path: string; value: string },
  decision: unknown,
): decision is JsonRecord {
  return isRecord(decision) && decision.proposed_value === row.value
}

function propertyReviewStatus(rows: ReviewPropertyRow[]): "change_requested" | null {
  return rows.some((row) => row.review?.status === "change_requested") ? "change_requested" : null
}

function imageAssets(params: {
  rootDir: string
  packagePath: string
  submission: JsonRecord
  payload: JsonRecord
  imageCandidates: JsonRecord[]
  imageFinalization: JsonRecord | null
}): ReviewImageAsset[] {
  const assets: ReviewImageAsset[] = []
  const imageReview = isRecord(params.submission.image_review)
    ? params.submission.image_review
    : null
  const frontUrl = imageReview ? stringValue(imageReview.front_image_signed_url) : null
  const barcodeUrl = imageReview ? stringValue(imageReview.barcode_image_signed_url) : null
  const product = isRecord(params.payload.final?.product)
    ? params.payload.final.product
    : isRecord(params.payload.draft?.product)
      ? params.payload.draft.product
      : null
  const candidateUrl = product ? safeHttpUrl(product.image_url) : null

  const safeFrontUrl = safeHttpUrl(frontUrl)
  const safeBarcodeUrl = safeHttpUrl(barcodeUrl)

  if (safeFrontUrl) {
    assets.push({ label: "Vorderseite vom User", url: safeFrontUrl, kind: "user_front" })
  }
  if (safeBarcodeUrl) {
    assets.push({ label: "Barcode vom User", url: safeBarcodeUrl, kind: "user_barcode" })
  }

  let hasPackageCandidate = false
  for (const candidate of [...params.imageCandidates].reverse()) {
    const localFile = stringValue(candidate.local_file)
    const sourceImageUrl = safeHttpUrl(candidate.source_image_url)
    const sourcePageUrl = safeHttpUrl(candidate.source_page_url)
    const label = stringValue(candidate.label) ?? "Kandidat fuer Produktbild"
    let url = sourceImageUrl

    if (localFile) {
      try {
        const localPath = resolvePackageFilePath({
          rootDir: params.rootDir,
          packagePath: params.packagePath,
          filePath: localFile,
        })
        if (existsSync(localPath)) {
          url = localPackageFileUrl({ packagePath: params.packagePath, filePath: localFile })
        }
      } catch {
        url = sourceImageUrl
      }
    }

    if (!url) continue
    hasPackageCandidate = true
    assets.push({
      label,
      url,
      kind: "candidate_product_image",
      source_page_url: sourcePageUrl,
      source_image_url: sourceImageUrl,
      source_type: stringValue(candidate.source_type),
      local_file: localFile,
    })
  }

  if (!hasPackageCandidate && candidateUrl) {
    assets.push({
      label: "Kandidat fuer Produktbild",
      url: candidateUrl,
      kind: "candidate_product_image",
      source_image_url: candidateUrl,
    })
  }

  const finalFile = params.imageFinalization
    ? stringValue(params.imageFinalization.final_file)
    : null
  if (finalFile) {
    try {
      const finalPath = resolvePackageFilePath({
        rootDir: params.rootDir,
        packagePath: params.packagePath,
        filePath: finalFile,
      })
      if (existsSync(finalPath)) {
        assets.push({
          label: "Finales Chaarlie-Bild",
          url: localPackageFileUrl({ packagePath: params.packagePath, filePath: finalFile }),
          kind: "final_product_image",
          local_file: finalFile,
        })
      }
    } catch {
      // Keep the package readable; the finalization form will still show metadata.
    }
  }

  return assets
}

function replaceImageAssetUrl(params: {
  assets: ReviewImageAsset[]
  kind: ReviewImageAsset["kind"]
  url: string
}): ReviewImageAsset[] {
  const existingIndex = params.assets.findIndex((asset) => asset.kind === params.kind)
  if (existingIndex >= 0) {
    return params.assets.map((asset, index) =>
      index === existingIndex ? { ...asset, url: params.url } : asset,
    )
  }

  const label =
    params.kind === "user_front"
      ? "Vorderseite vom User"
      : params.kind === "user_barcode"
        ? "Barcode vom User"
        : "Kandidat fuer Produktbild"
  return [...params.assets, { label, url: params.url, kind: params.kind }]
}

export async function applySignedUploadUrls(params: {
  detail: ReviewPackageDetail
  signUrl: (path: string) => Promise<string>
}): Promise<ReviewPackageDetail> {
  let imageAssets = [...params.detail.image_assets]
  const frontPath = stringValue(params.detail.submission.front_image_path)
  const barcodePath = stringValue(params.detail.submission.barcode_image_path)
  const imageReview = isRecord(params.detail.submission.image_review)
    ? { ...params.detail.submission.image_review }
    : {}

  if (frontPath) {
    const signedUrl = await params.signUrl(frontPath)
    imageReview.front_image_signed_url = signedUrl
    imageAssets = replaceImageAssetUrl({ assets: imageAssets, kind: "user_front", url: signedUrl })
  }
  if (barcodePath) {
    const signedUrl = await params.signUrl(barcodePath)
    imageReview.barcode_image_signed_url = signedUrl
    imageAssets = replaceImageAssetUrl({
      assets: imageAssets,
      kind: "user_barcode",
      url: signedUrl,
    })
  }

  return {
    ...params.detail,
    submission: {
      ...params.detail.submission,
      image_review: imageReview,
    },
    image_assets: imageAssets,
  }
}

function ensurePayloadProduct(payload: JsonRecord): JsonRecord {
  if (!isRecord(payload.final)) payload.final = {}
  const final = payload.final
  if (!isRecord(final.product)) final.product = {}
  return final.product
}

function ensurePayloadFieldRationales(payload: JsonRecord): JsonRecord {
  if (!isRecord(payload.final)) payload.final = {}
  const final = payload.final
  if (!isRecord(final.field_rationales)) final.field_rationales = {}
  return final.field_rationales
}

function patchPayloadForDecision(
  payload: JsonRecord,
  decision: ImageFinalizationDecision,
): boolean {
  if (decision.status === "pending" || decision.status === "needs_image_work") {
    return false
  }

  const product = ensurePayloadProduct(payload)
  const rationales = ensurePayloadFieldRationales(payload)

  if (decision.status === "approved_asset") {
    product.image_url = decision.public_url
    rationales["product.image_url"] =
      decision.notes?.trim() || "Approved Chaarlie-hosted final product image."
    return true
  }

  if (decision.status === "no_image_approved_for_now") {
    product.image_url = null
    rationales["product.image_url"] = decision.notes
    return true
  }

  return false
}

function finalProductImageUrl(payload: JsonRecord): unknown {
  if (!isRecord(payload.final)) return null
  if (!isRecord(payload.final.product)) return null
  return payload.final.product.image_url
}

function validateFinalDecision(payload: JsonRecord, decision: ImageFinalizationDecision) {
  if (decision.status === "pending" || decision.status === "needs_image_work") return
  const validation = validateProductIntakeImageFinalization({
    value: decision,
    finalProductImageUrl: finalProductImageUrl(payload),
  })
  if (!validation.ok) {
    throw new Error(validation.reason)
  }
}

type ApprovedImageSourceType = "brand" | "retailer" | "marketplace" | "search_result" | "unknown"

function approvedImageSourceType(value: unknown): ApprovedImageSourceType {
  if (
    value === "brand" ||
    value === "retailer" ||
    value === "marketplace" ||
    value === "search_result" ||
    value === "unknown"
  ) {
    return value
  }
  return "search_result"
}

function normalizeApprovedImageDecision(
  decision: ImageFinalizationDecision,
): ImageFinalizationDecision {
  if (decision.status !== "approved_asset") return decision
  const sourceType = approvedImageSourceType(decision.source_type)
  if (sourceType === decision.source_type) return decision

  return {
    ...decision,
    source_type: sourceType,
    notes: [decision.notes, `Original review-app source type: ${String(decision.source_type)}`]
      .filter(Boolean)
      .join(" "),
  }
}

function commandPackagePath(packagePath: string): string {
  const relativePath = relative(process.cwd(), packagePath)
  return relativePath.startsWith("..") ? packagePath : relativePath
}

function approvalCommands(packagePath: string): { dry_run: string; apply: string } {
  const packageArg = commandPackagePath(packagePath)
  const base = `npm run products:intake:approve-package -- --package ${packageArg} --reviewed-by nick`
  return {
    dry_run: base,
    apply: `${base} --apply --confirm`,
  }
}

async function runApprovalDryRun(params: {
  rootDir: string
  packagePath: string
  reviewedBy: string
  reviewNotes: string | null
}): Promise<JsonRecord> {
  const packagePath = resolvePackagePath(params)
  const commands = approvalCommands(packagePath)
  try {
    const result = await approveResearchPackage({
      packageDir: packagePath,
      reviewedBy: params.reviewedBy,
      reviewNotes: params.reviewNotes,
      apply: false,
      confirm: false,
    })
    const record = {
      ok: true,
      generated_at: new Date().toISOString(),
      commands,
      result,
    }
    await writeJson(join(packagePath, "approval-dry-run.json"), record)
    return record
  } catch (error) {
    const record = {
      ok: false,
      generated_at: new Date().toISOString(),
      commands,
      error: (error as Error).message,
    }
    await writeJson(join(packagePath, "approval-dry-run.json"), record)
    return record
  }
}

function cloneJsonRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord
}

export async function listReviewPackages(params: {
  rootDir: string
}): Promise<ReviewPackageSummary[]> {
  const root = researchRoot(params.rootDir)
  if (!existsSync(root)) return []

  const summaries: ReviewPackageSummary[] = []
  const dateEntries = await readdir(root, { withFileTypes: true })

  for (const dateEntry of dateEntries) {
    if (!dateEntry.isDirectory()) continue
    const datePath = join(root, dateEntry.name)
    const packageEntries = await readdir(datePath, { withFileTypes: true })
    for (const packageEntry of packageEntries) {
      if (!packageEntry.isDirectory()) continue
      const packagePath = join(datePath, packageEntry.name)
      const submission = await readOptionalJson(join(packagePath, "submission.json"))
      const storedValidation = await readOptionalJson(join(packagePath, "validation.json"))
      const payload = await readOptionalJson(join(packagePath, "payload.json"))
      const validation =
        payload === null
          ? storedValidation
          : (livePackageValidation({ submission, payload, packagePath }) ?? storedValidation)
      const imageFinalization = await readOptionalJson(join(packagePath, IMAGE_FINALIZATION_FILE))
      const rawImageCandidates = await readOptionalJson(join(packagePath, "image-candidates.json"))
      const propertyReview = await readOptionalJson(join(packagePath, "property-review.json"))
      const sources = isRecord(payload) ? sourceLinks(payload) : []
      const rows = isRecord(payload) ? propertyRows({ payload, sources, propertyReview }) : []
      const candidates = imageCandidates(rawImageCandidates)
      const candidateStatus = imageCandidateStatus({
        rootDir: params.rootDir,
        packagePath,
        imageCandidates: candidates,
      })
      const packageState = classifyReviewPackageState({
        payload,
        validation,
        imageFinalization,
        imageCandidateStatus: candidateStatus,
        propertyReviewStatus: propertyReviewStatus(rows),
      })

      summaries.push({
        package_path: packagePath,
        submission_id: submissionId(submission, packagePath),
        category: submissionField(submission, "category"),
        brand_text: submissionField(submission, "brand_text"),
        product_name_text: submissionField(submission, "product_name_text"),
        validation_ok: validationOk(validation),
        image_status: imageReviewStatus(imageFinalization),
        image_candidate_status: candidateStatus,
        ...packageState,
      })
    }
  }

  return summaries.sort((left, right) => right.package_path.localeCompare(left.package_path))
}

export async function readReviewPackage(params: {
  rootDir: string
  packagePath: string
}): Promise<ReviewPackageDetail> {
  const packagePath = resolvePackagePath(params)
  const submission = await readJson(join(packagePath, "submission.json"))
  const payload = await readJson(join(packagePath, "payload.json"))
  const storedValidation = await readOptionalJson(join(packagePath, "validation.json"))
  const validation = livePackageValidation({ submission, payload, packagePath }) ?? storedValidation
  const rawImageCandidates = await readOptionalJson(join(packagePath, "image-candidates.json"))
  const candidates = imageCandidates(rawImageCandidates)
  const imageFinalization = await readOptionalJson(join(packagePath, IMAGE_FINALIZATION_FILE))
  const imageCandidateReview = await readOptionalJson(join(packagePath, "image-review.json"))
  const imageSearchRequest = await readOptionalJson(join(packagePath, "image-search-request.json"))
  const imageSearchResult = await readOptionalJson(join(packagePath, "image-search-result.json"))
  const propertyReview = await readOptionalJson(join(packagePath, "property-review.json"))
  const packageApproval = await readOptionalJson(join(packagePath, "package-approval.json"))
  const approvalDryRun = await readOptionalJson(join(packagePath, "approval-dry-run.json"))
  const approvalApply = await readOptionalJson(join(packagePath, "approval-apply.json"))

  if (!isRecord(submission)) {
    throw new Error(`submission.json must contain an object: ${packagePath}`)
  }
  if (!isRecord(payload)) {
    throw new Error(`payload.json must contain an object: ${packagePath}`)
  }
  if (imageFinalization !== null && !isRecord(imageFinalization)) {
    throw new Error(`${IMAGE_FINALIZATION_FILE} must contain an object: ${packagePath}`)
  }
  if (imageCandidateReview !== null && !isRecord(imageCandidateReview)) {
    throw new Error(`image-review.json must contain an object: ${packagePath}`)
  }
  if (propertyReview !== null && !isRecord(propertyReview)) {
    throw new Error(`property-review.json must contain an object: ${packagePath}`)
  }
  if (packageApproval !== null && !isRecord(packageApproval)) {
    throw new Error(`package-approval.json must contain an object: ${packagePath}`)
  }

  const sources = sourceLinks(payload)
  const rows = propertyRows({ payload, sources, propertyReview })
  const candidateStatus = imageCandidateStatus({
    rootDir: params.rootDir,
    packagePath,
    imageCandidates: candidates,
  })
  const packageState = classifyReviewPackageState({
    payload,
    validation,
    imageFinalization,
    imageCandidateStatus: candidateStatus,
    propertyReviewStatus: propertyReviewStatus(rows),
  })

  return {
    package_path: packagePath,
    ...packageState,
    submission,
    payload,
    validation,
    stored_validation: storedValidation,
    image_candidates: candidates,
    image_candidate_status: candidateStatus,
    image_finalization: imageFinalization,
    image_candidate_review: imageCandidateReview,
    image_search_request: isRecord(imageSearchRequest) ? imageSearchRequest : null,
    image_search_result: isRecord(imageSearchResult) ? imageSearchResult : null,
    property_review: propertyReview,
    package_approval: packageApproval,
    approval_dry_run: isRecord(approvalDryRun) ? approvalDryRun : null,
    approval_apply: isRecord(approvalApply) ? approvalApply : null,
    source_links: sources,
    image_assets: imageAssets({
      rootDir: params.rootDir,
      packagePath,
      submission,
      payload,
      imageCandidates: candidates,
      imageFinalization,
    }),
    property_rows: rows,
    research_md: await readOptionalText(join(packagePath, "research.md")),
    approval_md: await readOptionalText(join(packagePath, "approval.md")),
  }
}

export async function saveImageCandidateReview(params: {
  rootDir: string
  packagePath: string
  decision: ImageCandidateReviewDecision
}): Promise<ReviewPackageDetail> {
  const packagePath = resolvePackagePath(params)
  await writeJson(join(packagePath, "image-review.json"), params.decision)
  return readReviewPackage({ rootDir: params.rootDir, packagePath })
}

export async function processApprovedImageCandidate(params: {
  rootDir: string
  packagePath: string
  reviewedBy?: string
}): Promise<ReviewPackageDetail> {
  const packagePath = resolvePackagePath(params)
  await finalizeProductIntakePackageImage({
    packageDir: packagePath,
    reviewedBy: params.reviewedBy ?? "codex",
  })
  return readReviewPackage({ rootDir: params.rootDir, packagePath })
}

export async function requestReplacementImageSearch(params: {
  rootDir: string
  packagePath: string
  notes?: string | null
  requestedBy: string
  requestedAt: string
}): Promise<{
  detail: ReviewPackageDetail
  image_search_request: ImageSearchRequest
  image_search_result: ImageSearchResult
}> {
  const packagePath = resolvePackagePath(params)
  const submission = await readOptionalJson(join(packagePath, "submission.json"))
  const payload = await readOptionalJson(join(packagePath, "payload.json"))
  if (!isRecord(submission) || !isRecord(payload)) {
    throw new Error("Image search requires valid submission.json and payload.json")
  }

  const request = buildImageSearchRequest({
    submission,
    payload,
    notes: params.notes,
    requestedBy: params.requestedBy,
    requestedAt: params.requestedAt,
  })

  await writeJson(join(packagePath, "image-search-request.json"), request)
  await writeJson(join(packagePath, "image-review.json"), {
    status: "needs_new_candidate",
    candidate_url: null,
    notes: request.notes,
    reviewed_by: params.requestedBy,
    reviewed_at: params.requestedAt,
  } satisfies ImageCandidateReviewDecision)
  const searchResult = await searchReplacementImageCandidate({
    packagePath,
    submission,
    payload,
    request,
    searchedAt: params.requestedAt,
  })
  await writeJson(join(packagePath, "image-search-result.json"), searchResult)
  if (searchResult.status === "candidate_found") {
    await writeJson(join(packagePath, "image-review.json"), {
      status: "comment",
      candidate_url: searchResult.local_file,
      notes: "Neue Rohbild-Quelle gefunden. Bitte diesen Kandidaten pruefen.",
      reviewed_by: params.requestedBy,
      reviewed_at: params.requestedAt,
    } satisfies ImageCandidateReviewDecision)
  }

  return {
    detail: await readReviewPackage({ rootDir: params.rootDir, packagePath }),
    image_search_request: request,
    image_search_result: searchResult,
  }
}

export async function savePropertyReviewDecision(params: {
  rootDir: string
  packagePath: string
  decision: PropertyReviewDecision
}): Promise<ReviewPackageDetail> {
  const packagePath = resolvePackagePath(params)
  const reviewPath = join(packagePath, "property-review.json")
  const existing = await readOptionalJson(reviewPath)
  const review = isRecord(existing) ? existing : {}
  const decisions = isRecord(review.decisions) ? review.decisions : {}

  decisions[params.decision.path] = params.decision
  await writeJson(reviewPath, {
    ...review,
    reviewed_by: params.decision.reviewed_by,
    reviewed_at: params.decision.reviewed_at,
    decisions,
  })
  return readReviewPackage({ rootDir: params.rootDir, packagePath })
}

export async function savePackageApprovalDecision(params: {
  rootDir: string
  packagePath: string
  decision: PackageApprovalDecision
}): Promise<ReviewPackageDetail> {
  const detail = await readReviewPackage(params)
  if (validationOk(detail.validation) !== true) {
    throw new Error("Product data must be ready before final approval.")
  }
  if (detail.image_candidate_review?.status !== "candidate_approved") {
    throw new Error("Image candidate must be approved before final approval.")
  }
  const imageFinalization = validateProductIntakeImageFinalization({
    value: detail.image_finalization,
    finalProductImageUrl: finalProductImageUrl(detail.payload),
  })
  if (!imageFinalization.ok) {
    throw new Error(imageFinalization.reason)
  }

  const decisions =
    isRecord(detail.property_review) && isRecord(detail.property_review.decisions)
      ? detail.property_review.decisions
      : {}
  const missing = detail.property_rows.filter((row) => {
    if (row.path === "product.image_url" && imageFinalization.ok) return false
    return (
      !isCurrentPropertyReview(row, decisions[row.path]) ||
      decisions[row.path].status !== "approved"
    )
  })
  if (missing.length > 0) {
    throw new Error(
      `All properties must be approved before final approval (${missing.length} open).`,
    )
  }

  const packagePath = resolvePackagePath(params)
  await writeJson(join(packagePath, "package-approval.json"), params.decision)
  return readReviewPackage({ rootDir: params.rootDir, packagePath })
}

export async function saveImageFinalizationDecision(params: {
  rootDir: string
  packagePath: string
  decision: ImageFinalizationDecision
}): Promise<ReviewPackageDetail> {
  const packagePath = resolvePackagePath(params)
  const decision = normalizeApprovedImageDecision(params.decision)
  const payloadPath = join(packagePath, "payload.json")
  const payload = await readJson(payloadPath)
  const existingDecision = await readOptionalJson(join(packagePath, IMAGE_FINALIZATION_FILE))
  if (!isRecord(payload)) {
    throw new Error(`payload.json must contain an object: ${payloadPath}`)
  }
  const existingQualityGate = isRecord(existingDecision) ? existingDecision.quality_gate : null
  if (
    params.decision.status === "approved_asset" &&
    isRecord(existingQualityGate) &&
    existingQualityGate.status !== "pass"
  ) {
    throw new Error(
      `Final product image cannot be approved while quality gate is ${String(
        existingQualityGate.status,
      )}.`,
    )
  }

  const nextPayload = cloneJsonRecord(payload)
  const payloadChanged = patchPayloadForDecision(nextPayload, decision)
  validateFinalDecision(nextPayload, decision)

  if (payloadChanged) {
    await writeJson(payloadPath, nextPayload)
    await writeJson(join(packagePath, IMAGE_FINALIZATION_FILE), decision)
  } else {
    await writeJson(join(packagePath, IMAGE_FINALIZATION_FILE), decision)
  }

  return readReviewPackage({ rootDir: params.rootDir, packagePath })
}

function jsonResponse(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  })
  response.end(JSON.stringify(value, null, 2))
}

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "application/octet-stream"
}

async function fileResponse(response: ServerResponse, path: string) {
  const bytes = await readFile(path)
  response.writeHead(200, {
    "content-type": contentTypeForPath(path),
    "cache-control": "no-store",
  })
  response.end(bytes)
}

function htmlResponse(response: ServerResponse, value: string) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  })
  response.end(value)
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks).toString("utf8")
  return body.trim() ? JSON.parse(body) : null
}

async function routeRequest(params: {
  request: IncomingMessage
  response: ServerResponse
  rootDir: string
}) {
  const url = new URL(params.request.url ?? "/", "http://127.0.0.1")

  try {
    if (params.request.method === "GET" && url.pathname === "/") {
      htmlResponse(params.response, renderAppHtml())
      return
    }

    if (params.request.method === "GET" && url.pathname === "/api/packages") {
      jsonResponse(params.response, 200, await listReviewPackages({ rootDir: params.rootDir }))
      return
    }

    if (params.request.method === "GET" && url.pathname === "/api/package") {
      const packagePath = url.searchParams.get("path")
      if (!packagePath) throw new Error("Missing package path")
      const detail = await readReviewPackage({ rootDir: params.rootDir, packagePath })
      jsonResponse(params.response, 200, await withFreshSignedUploadUrls(detail))
      return
    }

    if (params.request.method === "GET" && url.pathname === "/api/package/file") {
      const packagePath = url.searchParams.get("path")
      const filePath = url.searchParams.get("file")
      if (!packagePath || !filePath) throw new Error("Missing package path or file path")
      await fileResponse(
        params.response,
        await resolvePackageFileReadPath({
          rootDir: params.rootDir,
          packagePath,
          filePath,
        }),
      )
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/image-finalization") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string" || !isRecord(body.decision)) {
        throw new Error("Expected { packagePath, decision }")
      }
      jsonResponse(
        params.response,
        200,
        await saveImageFinalizationDecision({
          rootDir: params.rootDir,
          packagePath: body.packagePath,
          decision: body.decision as ImageFinalizationDecision,
        }),
      )
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/image-review") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string" || !isRecord(body.decision)) {
        throw new Error("Expected { packagePath, decision }")
      }
      jsonResponse(
        params.response,
        200,
        await saveImageCandidateReview({
          rootDir: params.rootDir,
          packagePath: body.packagePath,
          decision: body.decision as ImageCandidateReviewDecision,
        }),
      )
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/process-image") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string") {
        throw new Error("Expected { packagePath }")
      }
      const detail = await processApprovedImageCandidate({
        rootDir: params.rootDir,
        packagePath: body.packagePath,
        reviewedBy: stringValue(body.reviewedBy) ?? "nick",
      })
      jsonResponse(params.response, 200, {
        ok: true,
        image_finalization: detail.image_finalization,
        detail,
      })
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/request-image-search") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string") {
        throw new Error("Expected { packagePath }")
      }
      const result = await requestReplacementImageSearch({
        rootDir: params.rootDir,
        packagePath: body.packagePath,
        notes: stringValue(body.notes) ?? "",
        requestedBy: stringValue(body.requestedBy) ?? "nick",
        requestedAt: stringValue(body.requestedAt) ?? new Date().toISOString(),
      })
      jsonResponse(params.response, 200, {
        ok: true,
        image_search_request: result.image_search_request,
        image_search_result: result.image_search_result,
        detail: result.detail,
      })
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/property-review") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string" || !isRecord(body.decision)) {
        throw new Error("Expected { packagePath, decision }")
      }
      jsonResponse(
        params.response,
        200,
        await savePropertyReviewDecision({
          rootDir: params.rootDir,
          packagePath: body.packagePath,
          decision: body.decision as PropertyReviewDecision,
        }),
      )
      return
    }

    if (params.request.method === "POST" && url.pathname === "/api/package/package-approval") {
      const body = await readRequestJson(params.request)
      if (!isRecord(body) || typeof body.packagePath !== "string" || !isRecord(body.decision)) {
        throw new Error("Expected { packagePath, decision }")
      }
      const decision = body.decision as PackageApprovalDecision
      await savePackageApprovalDecision({
        rootDir: params.rootDir,
        packagePath: body.packagePath,
        decision,
      })
      const approvalDryRun = await runApprovalDryRun({
        rootDir: params.rootDir,
        packagePath: body.packagePath,
        reviewedBy: decision.reviewed_by,
        reviewNotes: decision.notes,
      })
      // Supabase publish is intentionally not reachable over HTTP: the ops rule
      // is that only `products:intake:approve-package -- --apply --confirm`
      // writes to Supabase. This endpoint records the decision and dry-runs.
      const approvalApply = null
      const detail = await readReviewPackage({
        rootDir: params.rootDir,
        packagePath: body.packagePath,
      })
      jsonResponse(params.response, 200, {
        ...detail,
        approval_dry_run: approvalDryRun,
        approval_apply: approvalApply ?? detail.approval_apply,
      })
      return
    }

    jsonResponse(params.response, 404, { error: "Not found" })
  } catch (error) {
    jsonResponse(params.response, 400, { error: (error as Error).message })
  }
}

async function withFreshSignedUploadUrls(
  detail: ReviewPackageDetail,
): Promise<ReviewPackageDetail> {
  const frontPath = stringValue(detail.submission.front_image_path)
  const barcodePath = stringValue(detail.submission.barcode_image_path)
  if (!frontPath && !barcodePath) return detail

  try {
    const supabase = createSupabaseClientFromEnv()
    return await applySignedUploadUrls({
      detail,
      signUrl: async (path) => {
        const { data, error } = await supabase.storage
          .from(PRODUCT_INTAKE_BUCKET)
          .createSignedUrl(path, 60 * 60)
        if (error) throw error
        return data.signedUrl
      },
    })
  } catch (error) {
    return {
      ...detail,
      image_refresh_error: (error as Error).message,
    }
  }
}

export function renderAppHtml(): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Product Intake Review</title>
    <style>
      :root {
        color: #302a2d;
        background: #fbfaf8;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body { margin: 0; }
      header {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 18px 24px;
        border-bottom: 1px solid #e8e1de;
        background: rgba(251, 250, 248, 0.96);
      }
      h1 { margin: 0; font-size: 22px; }
      main {
        display: grid;
        grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
        gap: 20px;
        padding: 20px 24px 32px;
      }
      .panel {
        border: 1px solid #e6dfdc;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 8px 24px rgba(48, 42, 45, 0.06);
      }
      .list { overflow: hidden; }
      .row {
        display: block;
        width: 100%;
        border: 0;
        border-bottom: 1px solid #eee7e4;
        background: transparent;
        padding: 14px 16px;
        text-align: left;
        cursor: pointer;
      }
      .row:hover, .row.active { background: #f5f0f6; }
      .row strong { display: block; margin-bottom: 6px; font-size: 15px; }
      .meta { color: #756c69; font-size: 13px; line-height: 1.45; }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 8px;
        background: #f1ece9;
        font-size: 12px;
        margin-top: 8px;
      }
      .detail { padding: 20px; }
      .intro {
        border: 1px solid #e9ddd8;
        border-radius: 12px;
        padding: 16px;
        margin: 0 0 18px;
        background: #fff7f5;
      }
      .intro h2 { margin: 0 0 8px; font-size: 20px; }
      .intro p { margin: 6px 0; color: #5f5653; }
      .steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .step {
        border: 1px solid #eadfdb;
        border-radius: 10px;
        padding: 10px;
        background: #fff;
        color: #5f5653;
        font-size: 13px;
      }
      .step strong {
        display: block;
        color: #302a2d;
        margin-bottom: 3px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .decision-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
        gap: 14px;
      }
      .decision-actions {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }
      .decision-button {
        border: 1px solid #eadfdb;
        border-radius: 10px;
        padding: 13px;
        background: #fff;
        color: #302a2d;
        cursor: pointer;
        text-align: left;
        font: inherit;
      }
      .decision-button strong {
        display: block;
        margin-bottom: 3px;
      }
      .decision-button.primary {
        border-color: #d86273;
        background: #fff4f5;
      }
      .decision-button:hover { background: #f8f2f0; }
      .evidence-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin: 0 0 14px;
      }
      .card {
        border: 1px solid #ece5e2;
        border-radius: 10px;
        padding: 14px;
        background: #fff;
      }
      .source-list {
        display: grid;
        gap: 10px;
        margin-top: 10px;
      }
      .source-link {
        display: block;
        border: 1px solid #ede4e0;
        border-radius: 10px;
        padding: 10px;
        color: inherit;
        text-decoration: none;
        background: #fff;
      }
      .source-link:hover { background: #faf6f4; }
      .image-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .image-tile {
        border: 1px solid #ede4e0;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .image-tile img {
        display: block;
        width: 100%;
        height: 180px;
        object-fit: contain;
        background: #f6f1ef;
      }
      .image-fallback {
        display: none;
        min-height: 160px;
        padding: 18px;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: #f6f1ef;
        color: #756c69;
      }
      .image-tile.broken img { display: none; }
      .image-tile.broken .image-fallback { display: flex; }
      .image-tile a {
        display: block;
        padding: 9px 10px;
        color: inherit;
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
      }
      .review-section {
        border: 1px solid #e6dfdc;
        border-radius: 12px;
        padding: 18px;
        margin-top: 16px;
        background: #fff;
      }
      .image-review-grid {
        display: grid;
        grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
        gap: 16px;
      }
      .hero-image {
        border: 1px solid #ede4e0;
        border-radius: 12px;
        overflow: hidden;
        background: #f6f1ef;
      }
      .hero-image img {
        display: block;
        width: 100%;
        height: 360px;
        object-fit: contain;
      }
      .hero-image.broken img { display: none; }
      .hero-image.broken .image-fallback { display: flex; min-height: 320px; }
      .review-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .processing-feedback {
        border: 1px solid #e7ded9;
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
        background: #fbfaf8;
      }
      .processing-feedback.running {
        border-color: #d86273;
        background: #fff4f5;
      }
      .processing-feedback.ready,
      .processing-feedback.approved {
        border-color: #9ad7b3;
        background: #f0fbf5;
      }
      .processing-feedback.needs-work,
      .processing-feedback.error {
        border-color: #e4a4a4;
        background: #fff5f5;
      }
      .processing-title {
        font-weight: 800;
        margin-bottom: 4px;
      }
      .processing-body {
        color: #5f5653;
        font-size: 13px;
        line-height: 1.45;
      }
      .processing-progress {
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: #ebe3df;
        margin: 10px 0 8px;
      }
      .processing-progress-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: #d86273;
        transition: width 180ms ease;
      }
      .processing-feedback.ready .processing-progress-fill,
      .processing-feedback.approved .processing-progress-fill {
        background: #31a46b;
      }
      .processing-feedback.needs-work .processing-progress-fill,
      .processing-feedback.error .processing-progress-fill {
        background: #d45b5b;
      }
      .search-feedback {
        border: 1px solid #e1d7d2;
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
        background: #fff;
      }
      .search-feedback.requested {
        border-color: #cdbb88;
        background: #fff9e8;
      }
      .search-feedback.running {
        border-color: #d86273;
        background: #fff4f5;
      }
      .search-feedback.running .processing-progress-fill {
        background: #d86273;
      }
      .search-feedback.found {
        border-color: #9fd9b8;
        background: #effaf4;
      }
      .search-feedback.found .processing-progress-fill {
        background: #31a46b;
      }
      .search-feedback.none {
        border-color: #e0b86e;
        background: #fff9e8;
      }
      .search-feedback.none .processing-progress-fill {
        background: #d99a2b;
      }
      .search-feedback h4 {
        margin: 0 0 6px;
        font-size: 14px;
      }
      .search-feedback ul {
        margin: 8px 0 0;
        padding-left: 18px;
        color: #5f5653;
        font-size: 13px;
        line-height: 1.45;
      }
      .reference-strip {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .catalog-comparison {
        margin-bottom: 14px;
      }
      .catalog-comparison h3 {
        margin: 0 0 6px;
      }
      .catalog-comparison .meta {
        margin-bottom: 10px;
      }
      .catalog-comparison-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .catalog-comparison-tile {
        border: 1px solid #ede4e0;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .catalog-comparison-tile img {
        display: block;
        width: 100%;
        height: 260px;
        object-fit: contain;
        background: #f6f1ef;
      }
      .catalog-comparison-tile.broken img { display: none; }
      .catalog-comparison-tile.broken .image-fallback { display: flex; }
      .catalog-comparison-caption {
        padding: 8px 9px 9px;
        font-size: 12px;
        line-height: 1.35;
      }
      .catalog-comparison-caption strong,
      .catalog-comparison-caption span {
        display: block;
      }
      .catalog-comparison-caption span {
        color: #716763;
        margin-top: 2px;
      }
      .final-decision-grid {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr);
        gap: 16px;
        margin-top: 14px;
      }
      .property-table-wrap {
        max-height: 680px;
        overflow: auto;
        border: 1px solid #ece5e2;
        border-radius: 10px;
        margin-top: 12px;
        background: #fff;
      }
      .property-review-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        font-size: 13px;
      }
      .property-review-table th,
      .property-review-table td {
        border-bottom: 1px solid #f0e8e4;
        padding: 10px;
        text-align: left;
        vertical-align: top;
      }
      .property-review-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #fbfaf8;
        color: #5f5653;
        font-size: 12px;
      }
      .property-review-table th:nth-child(1) { width: 22%; }
      .property-review-table th:nth-child(2) { width: 16%; }
      .property-review-table th:nth-child(3) { width: 28%; }
      .property-review-table th:nth-child(4) { width: 16%; }
      .property-review-table th:nth-child(5) { width: 18%; }
      .property-row.change-requested td {
        background: #fff8e8;
      }
      .property-row.approved td {
        background: #f8fdf9;
      }
      .property-name { font-weight: 700; }
      .property-path {
        color: #8a817d;
        font-size: 11px;
        overflow-wrap: anywhere;
        margin-top: 3px;
      }
      .property-value {
        max-height: 86px;
        overflow: auto;
        overflow-wrap: anywhere;
        line-height: 1.4;
      }
      .property-rationale {
        max-height: 94px;
        overflow: auto;
        color: #5f5653;
        line-height: 1.4;
      }
      .property-actions-inline {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .property-note {
        min-height: 42px;
        padding: 8px;
        font-size: 13px;
      }
      .property-note-help {
        margin-top: 6px;
        color: #756c69;
        font-size: 12px;
        line-height: 1.35;
      }
      .small-button-row {
        border: 1px solid #eadfdb;
        border-radius: 999px;
        padding: 7px 10px;
        background: #fff;
        cursor: pointer;
        font: inherit;
        white-space: nowrap;
        text-align: center;
      }
      .small-button-row.primary {
        border-color: #d86273;
        background: #fff4f5;
        font-weight: 700;
      }
      .small-button {
        border: 1px solid #eadfdb;
        border-radius: 9px;
        padding: 9px 11px;
        background: #fff;
        cursor: pointer;
        font: inherit;
      }
      .small-button.primary {
        border-color: #d86273;
        background: #fff4f5;
        font-weight: 700;
      }
      .property-sources {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .source-pill {
        border: 1px solid #e3d8d3;
        border-radius: 999px;
        padding: 5px 8px;
        color: #5f5653;
        text-decoration: none;
        font-size: 12px;
        background: #fbfaf8;
      }
      label { display: block; margin: 10px 0 5px; color: #5f5653; font-size: 13px; }
      input, select, textarea {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #ded6d2;
        border-radius: 9px;
        padding: 10px 11px;
        font: inherit;
        background: #fff;
      }
      textarea { min-height: 80px; resize: vertical; }
      button.action {
        margin-top: 12px;
        border: 0;
        border-radius: 9px;
        padding: 11px 14px;
        background: #d86273;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary { background: #6d5aa4; }
      button.ghost { background: #837a76; }
      details {
        margin-top: 18px;
        border: 1px solid #ece5e2;
        border-radius: 10px;
        background: #fff;
        overflow: hidden;
      }
      summary {
        cursor: pointer;
        padding: 13px 14px;
        font-weight: 700;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #282425;
        color: #f8f3ef;
        border-radius: 10px;
        padding: 12px;
        max-height: 360px;
        overflow: auto;
      }
      .empty { padding: 28px; color: #756c69; }
      .warning {
        border: 1px solid #ead5a9;
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
        background: #fff8e8;
        color: #665333;
      }
      .status-card {
        border: 1px solid #e6dfdc;
        border-radius: 10px;
        padding: 12px;
        margin: 12px 0;
        background: #fbfaf8;
      }
      .status-card.success {
        border-color: #b8dec8;
        background: #f0fbf4;
        color: #14613a;
      }
      .status-card.danger {
        border-color: #ee9ca7;
        background: #fff5f6;
        color: #8d2637;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin: 12px 0;
      }
      @media (max-width: 860px) {
        main { grid-template-columns: 1fr; padding: 14px; }
        .steps { grid-template-columns: 1fr; }
        .evidence-grid { grid-template-columns: 1fr; }
        .image-strip { grid-template-columns: 1fr; }
        .decision-grid { grid-template-columns: 1fr; }
        .catalog-comparison-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .final-decision-grid { grid-template-columns: 1fr; }
        .property-table-wrap { max-height: none; }
        .property-review-table { min-width: 920px; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Product Intake Review</h1>
      <div class="meta">Lokale Paketpruefung. Speichert nur Package-Dateien, keine Supabase-Freigabe.</div>
    </header>
    <main>
      <section class="panel list" id="package-list"><div class="empty">Lade Pakete...</div></section>
      <section class="panel detail" id="detail"><div class="empty">Waehle links ein Paket aus.</div></section>
    </main>
    <script>
      let packages = [];
      let selectedPath = null;
      let currentDetail = null;

      const $ = (id) => document.getElementById(id);
      const escapeHtml = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
      const statusLabel = (value) => ({
        missing: "Bild fehlt",
        pending: "Bild offen",
        final_ready: "Finalbild bereit",
        needs_image_work: "Bildarbeit offen",
        approved_asset: "Bild freigegeben",
        no_image_approved_for_now: "Ohne Bild freigegeben",
      }[value] || value || "unbekannt");
      const validationLabel = (value) => value === true
        ? "Produktdaten bereit"
        : value === false
          ? "Produktdaten noch nicht bereit"
          : "Produktdaten ungeprueft";
      const packageStateLabel = (value) => ({
        package_needs_research: "Noch nicht recherchiert",
        package_in_progress: "Research in Arbeit",
        package_rework_requested: "Aenderung angefordert",
        package_ready_for_review: "Bereit zur Review",
        package_blocked: "Paket blockiert",
      }[value] || "Paketstatus unklar");
      const imageReviewLabel = (value) => ({
        candidate_approved: "Bild passt",
        needs_new_candidate: "Anderes Bild benoetigt",
        comment: "Kommentar gespeichert",
      }[value] || "Noch offen");
      const categoryLabel = (value) => ({
        shampoo: "Shampoo",
        conditioner: "Conditioner",
        leave_in: "Leave-in",
        mask: "Maske",
        oil: "Oel",
        dry_shampoo: "Trockenshampoo",
        deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
        bondbuilder: "Bondbuilder",
      }[value] || value || "Aktuelles Paket");
      const packageApprovalLabel = (value) => ({
        approved_for_import: "Final freigegeben",
      }[value] || "Noch nicht final freigegeben");
      const imageDisplayStatus = (image) =>
        image?.status === "pending" && image?.final_file
          ? "final_ready"
          : image?.status || "missing";
      const imageProcessingFeedback = (detail) => {
        const review = detail.image_candidate_review || {};
        const image = detail.image_finalization || {};
        if (image.status === "approved_asset") {
          return {
            state: "approved",
            percent: 100,
            title: "Finalbild freigegeben",
            body: "Das normalisierte Produktbild ist lokal fuer den Import freigegeben.",
          };
        }
        if (image.status === "pending" && image.final_file) {
          return {
            state: "ready",
            percent: 100,
            title: "Finalbild ist bereit zur Review",
            body: "Die Verarbeitung ist abgeschlossen. Pruefe unten das finale Chaarlie-Bild und gib es frei, wenn Groesse und Hintergrund passen.",
          };
        }
        if (image.status === "needs_image_work") {
          return {
            state: "needs-work",
            percent: 100,
            title: "Bildverarbeitung braucht Arbeit",
            body:
              image.notes ||
              "Die Verarbeitung ist gelaufen, aber die Qualitaetspruefung hat das Bild nicht freigegeben.",
          };
        }
        if (review.status === "candidate_approved") {
          return {
            state: "running",
            percent: 40,
            title: "Bildverarbeitung wartet",
            body: "Das Quellbild ist bestaetigt. Starte die Verarbeitung mit dem Button, falls sie noch nicht gelaufen ist.",
          };
        }
        return {
          state: "idle",
          percent: 0,
          title: "Bildverarbeitung",
          body: "Noch nicht gestartet. Wenn das Quellbild stimmt, klicke auf Bild passt & verarbeiten.",
        };
      };
      const renderProcessingFeedback = (detail) => {
        const feedback = imageProcessingFeedback(detail);
        return \`
          <div id="processing-feedback" class="processing-feedback \${escapeHtml(feedback.state)}" aria-live="polite">
            <div class="processing-title">\${escapeHtml(feedback.title)}</div>
            <div class="processing-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${escapeHtml(feedback.percent)}">
              <div class="processing-progress-fill" style="width: \${escapeHtml(feedback.percent)}%;"></div>
            </div>
            <div class="processing-body">\${escapeHtml(feedback.body)}</div>
          </div>
        \`;
      };
      const imageSearchGuidelines = [
        "Exaktes Produkt: Marke, Linie, Produktname und Packung muessen passen.",
        "frontale Packshot-Ansicht: ganze Packung sichtbar, nicht angeschnitten.",
        "Hintergrund: transparent oder plain light/white, keine dunkle Spiegelung.",
        "Qualitaet: scharf, ausreichend gross, keine Wasserzeichen.",
        "Kein Lifestyle-, Model-, Badezimmer-, Regal- oder Stimmungsbild.",
      ];
      const renderImageSearchFeedback = (detail) => {
        const request = detail.image_search_request || null;
        const result = detail.image_search_result || null;
        const state = result?.status === "candidate_found"
          ? "found"
          : result?.status === "no_candidate_found"
            ? "none"
            : request?.status === "requested"
              ? "running"
              : "";
        const title = result?.status === "candidate_found"
          ? "Bildsuche abgeschlossen: neuer Kandidat gefunden"
          : result?.status === "no_candidate_found"
            ? "Bildsuche abgeschlossen: kein besseres Bild gefunden"
            : request?.status === "requested"
              ? "Bildsuche laeuft"
              : "Bildsuche";
        const progress = result ? 100 : request?.status === "requested" ? 45 : 0;
        const body = result?.status === "candidate_found"
          ? \`Neuer Bildkandidat gefunden: \${escapeHtml(result.local_file || result.source_image_url || "")}\`
          : result?.status === "no_candidate_found"
            ? escapeHtml(result.message || "Die automatische Suche ist fertig. Es laeuft gerade keine weitere Suche.")
            : request?.status === "requested"
              ? \`Suche gerade in den vorhandenen Research-Quellen nach: \${escapeHtml(request.query || "")}\`
              : "Noch nicht gestartet. Der Button sucht sofort in den vorhandenen Research-Quellen.";
        const attemptedPages = Array.isArray(result?.attempted_pages) ? result.attempted_pages.length : 0;
        const attemptedImages = Array.isArray(result?.attempted_images) ? result.attempted_images.length : 0;
        const rejected = Array.isArray(result?.rejected) ? result.rejected.length : 0;
        const meta = result
          ? \`Fertig am \${escapeHtml(result.searched_at || "unbekannt")} · \${escapeHtml(attemptedPages)} Quellen · \${escapeHtml(attemptedImages)} Bilder · \${escapeHtml(rejected)} verworfen · keine Suche aktiv\`
          : request
            ? \`Gestartet am \${escapeHtml(request.requested_at || "unbekannt")} · Suche aktiv\`
            : "Keine Suche aktiv";
        return \`
          <div id="search-feedback" class="search-feedback \${state}" aria-live="polite">
            <h4>\${escapeHtml(title)}</h4>
            <div class="processing-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${escapeHtml(progress)}">
              <div class="processing-progress-fill" style="width: \${escapeHtml(progress)}%;"></div>
            </div>
            <div class="processing-body">\${body}</div>
            <div class="meta">\${meta}</div>
            \${result?.status === "no_candidate_found" ? '<div class="meta">Naechster Schritt: Codex/Web-Recherche oder manuelle Bildquelle, weil die Paket-Quellen nichts Besseres geliefert haben.</div>' : ""}
            <ul>
              \${imageSearchGuidelines.map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}
            </ul>
          </div>
        \`;
      };
      const renderApprovalDryRun = (detail) => {
        const dryRun = detail.approval_dry_run || null;
        const apply = detail.approval_apply || null;
        if (apply?.ok) {
          return \`
            <div class="status-card success">
              <strong>Supabase-Import abgeschlossen</strong>
              <div class="meta">Bild, Produktdaten, Submission-Freigabe und Folgeaktionen wurden ueber den Approve-Workflow ausgefuehrt.</div>
              \${apply.applied_at ? \`<div class="meta">Importiert am \${escapeHtml(apply.applied_at)}</div>\` : ""}
            </div>
          \`;
        }
        if (apply && !apply.ok) {
          return \`
            <div class="status-card danger">
              <strong>Supabase-Import fehlgeschlagen</strong>
              <div class="meta">\${escapeHtml(apply.error || "Bitte Fehler pruefen.")}</div>
              \${apply.commands?.apply ? \`<pre>\${escapeHtml(apply.commands.apply)}</pre>\` : ""}
            </div>
          \`;
        }
        if (!dryRun) {
          return \`
            <div class="status-card">
              <strong>Supabase-Import</strong>
              <div class="meta">Wird nach deiner finalen Paketfreigabe automatisch gestartet.</div>
            </div>
          \`;
        }
        const command = dryRun.commands?.apply || "";
        return \`
          <div class="status-card \${dryRun.ok ? "success" : ""}">
            <strong>\${dryRun.ok ? "Import-Dry-Run bestanden" : "Import-Dry-Run fehlgeschlagen"}</strong>
            <div class="meta">\${escapeHtml(dryRun.ok ? "Das Paket ist bereit fuer den Supabase-Import." : dryRun.error || "Bitte Fehler pruefen.")}</div>
            \${command ? \`<pre>\${escapeHtml(command)}</pre>\` : ""}
          </div>
        \`;
      };
      const renderSources = (sources) => sources?.length
        ? sources.map((source) => \`
            <a class="source-link" href="\${escapeHtml(source.url)}" target="_blank">
              <strong>\${escapeHtml(source.label || source.url)}</strong>
              <div class="meta">\${escapeHtml(source.evidence || source.url)}</div>
            </a>\`).join("")
        : '<p class="meta">Noch keine Quellen im Research-Paket hinterlegt.</p>';
      const renderImages = (assets) => assets?.length
        ? assets.map((asset) => \`
            <div class="image-tile">
              <img src="\${escapeHtml(asset.url)}" alt="\${escapeHtml(asset.label)}" loading="lazy" onerror="this.closest('.image-tile').classList.add('broken')" />
              <div class="image-fallback">
                <div>
                  <strong>Bild kann hier nicht geladen werden.</strong><br />
                  <span>Oeffne den Link oder erneuere das Research-Paket.</span>
                </div>
              </div>
              <a href="\${escapeHtml(asset.url)}" target="_blank">\${escapeHtml(asset.label)} oeffnen</a>
            </div>\`).join("")
        : '<p class="meta">Noch keine Bilder im Paket verfuegbar.</p>';
      const imageAsset = (detail, kind) => detail.image_assets?.find((asset) => asset.kind === kind) || null;
      const renderCandidateImage = (detail) => {
        const candidate = imageAsset(detail, "candidate_product_image");
        if (!candidate) return '<div class="empty">Noch kein Produktbild-Kandidat im Research-Paket.</div>';
        return \`
          <div class="hero-image">
            <img src="\${escapeHtml(candidate.url)}" alt="\${escapeHtml(candidate.label)}" loading="lazy" onerror="this.closest('.hero-image').classList.add('broken')" />
            <div class="image-fallback"><div><strong>Bildvorschlag nicht ladbar.</strong><br /><span>Die Quelle liefert kein Bild. Bitte anderes Bild suchen lassen.</span></div></div>
          </div>
          <p class="meta">Rohbild-Kandidat aus der Quelle. Noch nicht final verarbeitet. <a href="\${escapeHtml(candidate.url)}" target="_blank">Bildquelle oeffnen</a></p>
        \`;
      };
      const renderFinalImage = (detail) => {
        const finalImage = imageAsset(detail, "final_product_image");
        if (!finalImage) return '<div class="empty">Noch kein finales Chaarlie-Bild generiert. Fuehre zuerst das Final-Image-Skript aus.</div>';
        return \`
          <div class="hero-image">
            <img src="\${escapeHtml(finalImage.url)}" alt="\${escapeHtml(finalImage.label)}" loading="lazy" onerror="this.closest('.hero-image').classList.add('broken')" />
            <div class="image-fallback"><div><strong>Finales Bild nicht ladbar.</strong><br /><span>Bitte Paket oder generierte Datei pruefen.</span></div></div>
          </div>
          <p class="meta"><a href="\${escapeHtml(finalImage.url)}" target="_blank">Finales Bild oeffnen</a></p>
        \`;
      };
      const renderFinalComparisonTile = (detail, product) => {
        const finalImage = imageAsset(detail, "final_product_image");
        if (!finalImage) {
          return '<div class="catalog-comparison-tile"><div class="image-fallback" style="display:flex;"><div><strong>Noch kein finales Bild.</strong><br /><span>Fuehre zuerst das Final-Image-Skript aus.</span></div></div><div class="catalog-comparison-caption"><strong>Neues finales Bild</strong><span>Aktuelles Paket</span></div></div>';
        }
        const label = product.clean_name || finalImage.label || "Neues finales Bild";
        const category = categoryLabel(product.category_key);
        return \`
          <div class="catalog-comparison-tile">
            <img src="\${escapeHtml(finalImage.url)}" alt="\${escapeHtml(label)}" loading="lazy" onerror="this.closest('.catalog-comparison-tile').classList.add('broken')" />
            <div class="image-fallback"><div><strong>Finales Bild nicht ladbar.</strong><br /><span>Bitte Paket oder generierte Datei pruefen.</span></div></div>
            <div class="catalog-comparison-caption">
              <strong>Neu: \${escapeHtml(label)}</strong>
              <span>\${escapeHtml(category)}</span>
            </div>
          </div>
        \`;
      };
      const renderReferenceImages = (detail) => {
        const references = [imageAsset(detail, "user_front"), imageAsset(detail, "user_barcode")].filter(Boolean);
        return references.length
          ? references.map((asset) => \`
              <div class="image-tile">
                <img src="\${escapeHtml(asset.url)}" alt="\${escapeHtml(asset.label)}" loading="lazy" onerror="this.closest('.image-tile').classList.add('broken')" />
                <div class="image-fallback"><div><strong>Nicht ladbar.</strong><br /><span>Link oeffnen oder Paket erneuern.</span></div></div>
                <a href="\${escapeHtml(asset.url)}" target="_blank">\${escapeHtml(asset.label)} oeffnen</a>
              </div>\`).join("")
          : '<p class="meta">Keine User-Fotos im Paket.</p>';
      };
      const catalogComparisonImages = [
        {
          label: "Olaplex No.7 Bonding Oil",
          category: "Oel",
          url: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-03/7d8c0150-778d-4cb9-abf5-bfc16ad93b12/34-7d8c0150-778d-4cb9-abf5-bfc16ad93b12-olaplex-olaplex-no-7-bonding-oil-5dc5795db1a8.webp",
        },
        {
          label: "Syoss Intense Curls",
          category: "Conditioner",
          url: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/a62ae91c-69c6-466e-827e-350f518d73b5/47-a62ae91c-69c6-466e-827e-350f518d73b5-syoss-syoss-intense-curls-33e73c135d31.webp",
        },
        {
          label: "Jean&Len Repair Keratin/Mandel",
          category: "Conditioner",
          url: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/e1ad37be-9330-49b4-8add-872a30324122/29-e1ad37be-9330-49b4-8add-872a30324122-jean-len-jean-len-repair-keratin-mandel-77390c5b0538.webp",
        },
      ];
      const renderCatalogComparisonImages = () => \`
        \${catalogComparisonImages.map((asset) => \`
          <div class="catalog-comparison-tile">
            <img src="\${escapeHtml(asset.url)}" alt="\${escapeHtml(asset.label)}" loading="lazy" onerror="this.closest('.catalog-comparison-tile').classList.add('broken')" />
            <div class="image-fallback"><div><strong>DB-Bild nicht ladbar.</strong><br /><span>Oeffne das Bild in einem neuen Tab.</span></div></div>
            <div class="catalog-comparison-caption">
              <strong>\${escapeHtml(asset.label)}</strong>
              <span>\${escapeHtml(asset.category)}</span>
            </div>
          </div>\`).join("")}
      \`;
      const renderPropertyRows = (rows) => rows?.length
        ? \`<div class="property-table-wrap">
            <table class="property-review-table">
              <thead>
                <tr>
                  <th>Eigenschaft</th>
                  <th>Wert</th>
                  <th>Begruendung & Quellen</th>
                  <th>Notiz</th>
                  <th>Entscheidung</th>
                </tr>
              </thead>
              <tbody>
                \${rows.map((row, index) => \`
                  <tr class="property-row \${escapeHtml(row.review?.status === "change_requested" ? "change-requested" : row.review?.status === "approved" ? "approved" : "")}" data-property-index="\${index}">
                    <td>
                      <div class="property-name">\${escapeHtml(row.label)}</div>
                      <div class="property-path">\${escapeHtml(row.path)}</div>
                    </td>
                    <td><div class="property-value">\${escapeHtml(row.value)}</div></td>
                    <td>
                      <div class="property-rationale">\${escapeHtml(row.rationale || "Noch keine Begruendung im Research-Paket.")}</div>
                      <div class="property-sources">
                        \${row.sources?.length ? row.sources.map((source) => \`<a class="source-pill" href="\${escapeHtml(source.url)}" target="_blank">\${escapeHtml(source.label || source.url)}</a>\`).join("") : '<span class="meta">Keine Quelle verknuepft</span>'}
                      </div>
                    </td>
                    <td>
                      <textarea class="property-note" aria-label="Kommentar oder korrigierter Wert">\${escapeHtml(row.review?.notes || row.review?.reviewer_value || "")}</textarea>
                      <div class="property-note-help">Kommentar schreiben und dann "Aenderung anfordern" klicken, damit Codex diese Eigenschaft ueberarbeitet.</div>
                    </td>
                    <td>
                      <span class="badge">\${escapeHtml(row.review?.status || "offen")}</span>
                      <div class="property-actions-inline">
                        <button class="small-button-row primary property-approve" data-index="\${index}">Passt</button>
                        <button class="small-button-row property-change" data-index="\${index}">Aenderung anfordern</button>
                      </div>
                    </td>
                  </tr>\`).join("")}
              </tbody>
            </table>
          </div>\`
        : '<p class="meta">Keine finalen Eigenschaften im Paket gefunden.</p>';

      async function requestJson(url, options) {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Request failed");
        return data;
      }

      async function loadPackages() {
        packages = await requestJson("/api/packages");
        $("package-list").innerHTML = packages.length
          ? packages.map((pack) => \`
              <button class="row \${pack.package_path === selectedPath ? "active" : ""}" data-path="\${escapeHtml(pack.package_path)}">
                <strong>\${escapeHtml(pack.brand_text || "Keine Marke")} · \${escapeHtml(pack.product_name_text || "Ohne Produktname")}</strong>
                <div class="meta">\${escapeHtml(pack.category || "keine Kategorie")} · \${escapeHtml(pack.submission_id || "keine ID")}</div>
                <span class="badge">\${escapeHtml(packageStateLabel(pack.package_state))}</span>
                <span class="badge">\${escapeHtml(statusLabel(pack.image_status))}</span>
                <span class="badge">\${escapeHtml(validationLabel(pack.validation_ok))}</span>
              </button>\`).join("")
          : '<div class="empty">Keine Research-Pakete gefunden.</div>';
        document.querySelectorAll(".row").forEach((row) => {
          row.addEventListener("click", () => loadDetail(row.dataset.path));
        });
      }

      async function loadDetail(path) {
        selectedPath = path;
        if (window.location.hash !== "#" + encodeURIComponent(path)) {
          window.history.replaceState(null, "", "#" + encodeURIComponent(path));
        }
        await loadPackages();
        const detail = await requestJson(\`/api/package?path=\${encodeURIComponent(path)}\`);
        currentDetail = detail;
        const submission = detail.submission || {};
        const product = detail.payload?.final?.product || detail.payload?.draft?.product || {};
      const image = detail.image_finalization || {};
      const imageStatus = imageDisplayStatus(image);
        const refreshWarning = detail.image_refresh_error
          ? '<div class="warning">User-Upload-Links konnten nicht erneuert werden: ' + escapeHtml(detail.image_refresh_error) + '</div>'
          : "";
        const candidate = imageAsset(detail, "candidate_product_image");
        const packageApproval = detail.package_approval || {};
        const researchQueueCommand = "npm run products:intake:research-queue -- --limit=5";
        if (detail.package_state === "package_needs_research" || detail.package_state === "package_blocked") {
          $("detail").innerHTML = \`
            <div class="intro">
              <h2>\${escapeHtml(product.canonical_brand || submission.brand_text || "Produkt vorbereiten")}</h2>
              <p><strong>\${escapeHtml(product.clean_name || submission.product_name_text || "")}</strong></p>
              <p>Dieses Paket ist noch kein Review-Paket. Es enthaelt bisher nur die User-Eingabe und braucht zuerst Research durch Codex.</p>
              <div class="steps">
                <div class="step"><strong>Status</strong>\${escapeHtml(packageStateLabel(detail.package_state))}</div>
                <div class="step"><strong>Grund</strong>\${escapeHtml(detail.package_state_reason || "Noch kein finaler Research-Payload.")}</div>
                <div class="step"><strong>Naechster Schritt</strong>Research-Queue ausfuehren und Paket fuellen.</div>
              </div>
            </div>
            <section class="review-section">
              <h2>Noch nicht reviewbar</h2>
              <p class="meta">Nick soll hier erst pruefen, wenn Produktidentitaet, Quellen, Eigenschaften und Bildentscheidung recherchiert wurden.</p>
              <div class="status-card">
                <strong>Naechster lokaler Command</strong>
                <pre>\${escapeHtml(researchQueueCommand)}</pre>
              </div>
              <h3>User-Fotos als Referenz</h3>
              \${refreshWarning}
              <div class="reference-strip">\${renderReferenceImages(detail)}</div>
            </section>
            <details>
              <summary>Technischen Payload anzeigen</summary>
              <pre>\${escapeHtml(JSON.stringify(detail.payload, null, 2))}</pre>
            </details>
            <details>
              <summary>Research-Rohtext anzeigen</summary>
              <pre>\${escapeHtml(detail.research_md || "")}</pre>
            </details>
            <details>
              <summary>Approval-Checkliste anzeigen</summary>
              <pre>\${escapeHtml(detail.approval_md || "")}</pre>
            </details>
          \`;
          return;
        }
        $("detail").innerHTML = \`
          <div class="intro">
            <h2>\${escapeHtml(product.canonical_brand || submission.brand_text || "Produkt pruefen")}</h2>
            <p><strong>\${escapeHtml(product.clean_name || submission.product_name_text || "")}</strong></p>
            <p>Pruefe hier das vorgeschlagene Produktbild und die recherchierten Eigenschaften. Speichere nur deine Review-Entscheidungen; keine Supabase-Freigabe passiert hier.</p>
            <div class="steps">
              <div class="step"><strong>1. Rohbild</strong>Quellbild ansehen, bestaetigen oder neue Suche anfordern.</div>
              <div class="step"><strong>2. Verarbeitung</strong>Nach Bestaetigung wird daraus lokal das finale Chaarlie-Bild erzeugt.</div>
              <div class="step"><strong>Eigenschaften</strong>Wert, Begruendung und Quellen je Eigenschaft pruefen.</div>
            </div>
          </div>

          <section class="review-section">
            <h2>1. Rohbild-Kandidat auswaehlen</h2>
            <p class="meta">Das ist die unverarbeitete Bildquelle aus Research oder Bildsuche. Wenn sie exakt passt, startet der Button danach die lokale Verarbeitung.</p>
            <div class="image-review-grid">
              <div>
                \${renderCandidateImage(detail)}
                <div class="status-card \${detail.image_candidate_review?.status === "candidate_approved" ? "success" : ""}">
                  <strong>Bildentscheidung:</strong> \${escapeHtml(imageReviewLabel(detail.image_candidate_review?.status))}
                  \${detail.image_candidate_review?.reviewed_at ? \`<div class="meta">Gespeichert am \${escapeHtml(detail.image_candidate_review.reviewed_at)}</div>\` : ""}
                </div>
                <label>Kommentar zum Bild</label>
                <textarea id="image-review-notes">\${escapeHtml(detail.image_candidate_review?.notes || "")}</textarea>
                <div class="review-actions">
                  <button class="small-button primary" id="image-approve">Bild passt &amp; verarbeiten</button>
                  <button class="small-button" id="image-reject">Anderes Bild suchen</button>
                  <button class="small-button" id="image-comment">Kommentar speichern</button>
                </div>
                \${renderProcessingFeedback(detail)}
                \${renderImageSearchFeedback(detail)}
              </div>
              <div>
                <h3>User-Fotos als Referenz</h3>
                \${refreshWarning}
                <div class="reference-strip">\${renderReferenceImages(detail)}</div>
                <h3>Quellen</h3>
                <div class="source-list">\${renderSources(detail.source_links)}</div>
              </div>
            </div>
          </section>

          <section class="review-section">
            <h2>2. Finalbild nach Verarbeitung pruefen</h2>
            <p class="meta">Hier erscheint das lokal zugeschnittene und normalisierte Produktbild nach der Verarbeitung. Erst diese Freigabe macht es zum Kandidaten fuer das spaetere DB-Bild.</p>
            <div class="catalog-comparison">
              <h3>Groessenvergleich mit bestehenden DB-Bildern</h3>
              <p class="meta">Alle vier Bilder stehen im gleichen Format nebeneinander. Vergleiche Objektgroesse, Randabstand und Hintergrund direkt in dieser Reihe.</p>
              <div class="catalog-comparison-strip">
                \${renderFinalComparisonTile(detail, product)}
                \${renderCatalogComparisonImages()}
              </div>
            </div>
            <div class="final-decision-grid">
              <div>
                <div class="status-card \${imageStatus === "approved_asset" ? "success" : ""}">
                  <strong>Finalstatus:</strong> \${escapeHtml(statusLabel(imageStatus))}
                  \${image.asset_sha256 ? \`<div class="meta">SHA-256: \${escapeHtml(image.asset_sha256)}</div>\` : ""}
                  \${image.storage_path ? \`<div class="meta">Storage-Pfad: \${escapeHtml(image.storage_path)}</div>\` : ""}
                  \${image.public_url ? \`<div class="meta">Ziel-URL nach Upload: \${escapeHtml(image.public_url)}</div>\` : ""}
                </div>
                <label>Notiz zum finalen Bild</label>
                <textarea id="image-finalization-notes">\${escapeHtml(image.notes || "")}</textarea>
                <div class="review-actions">
                  <button class="small-button primary" id="image-final-approve">Finales Bild freigeben</button>
                  <button class="small-button" id="image-final-needs-work">Bild braucht Arbeit</button>
                </div>
              </div>
              <div class="status-card">
                <strong>Worauf achten?</strong>
                <div class="meta">Das neue Bild sollte im Vergleich nicht sichtbar groesser, kleiner oder enger beschnitten wirken als die bestehenden DB-Bilder.</div>
              </div>
            </div>
          </section>

          <section class="review-section">
            <h2>Eigenschaften pruefen</h2>
            <p class="meta">Jede Zeile zeigt Wert, Research-Begruendung und Quellen. Fuer Korrekturen schreibe einen Kommentar und klicke "Aenderung anfordern"; das Paket wird dann zur Codex-Ueberarbeitung markiert.</p>
            <div class="toolbar">
              <button class="small-button primary" id="approve-all-properties">Alle Eigenschaften passen</button>
              <span class="badge">\${escapeHtml((detail.property_rows || []).filter((row) => row.review?.status === "approved").length)} / \${escapeHtml((detail.property_rows || []).length)} freigegeben</span>
            </div>
            \${renderPropertyRows(detail.property_rows)}
          </section>

          <section class="review-section">
            <h2>Finale Paketfreigabe</h2>
            <div class="status-card \${detail.approval_apply?.ok || packageApproval.status === "approved_for_import" ? "success" : ""}">
              <strong>\${escapeHtml(detail.approval_apply?.ok ? "Final freigegeben und importiert" : packageApprovalLabel(packageApproval.status))}</strong>
              \${packageApproval.reviewed_at ? \`<div class="meta">Gespeichert am \${escapeHtml(packageApproval.reviewed_at)}</div>\` : ""}
              \${packageApproval.notes ? \`<div class="meta">\${escapeHtml(packageApproval.notes)}</div>\` : ""}
            </div>
            <p class="meta">Finale Freigabe speichert die Review-Entscheidung und erstellt den Import-Dry-Run. Der Supabase-Import passiert danach bewusst per CLI-Handoff.</p>
            <label>Finale Notiz</label>
            <textarea id="package-approval-notes">\${escapeHtml(packageApproval.notes || "")}</textarea>
            <button class="small-button primary" id="package-approve" \${detail.approval_apply?.ok ? "disabled" : ""}>Freigabe-Entscheidung speichern</button>
            \${renderApprovalDryRun(detail)}
          </section>

          <details>
            <summary>Technischen Payload anzeigen</summary>
            <pre>\${escapeHtml(JSON.stringify(detail.payload, null, 2))}</pre>
          </details>
          <details>
            <summary>Research-Rohtext anzeigen</summary>
            <pre>\${escapeHtml(detail.research_md || "")}</pre>
          </details>
          <details>
            <summary>Approval-Checkliste anzeigen</summary>
            <pre>\${escapeHtml(detail.approval_md || "")}</pre>
          </details>
        \`;
        $("image-approve").addEventListener("click", () =>
          saveImageReview("candidate_approved", candidate?.url || null),
        );
        $("image-reject").addEventListener("click", () =>
          requestImageSearch(),
        );
        $("image-comment").addEventListener("click", () =>
          saveImageReview("comment", candidate?.url || null),
        );
        $("image-final-approve").addEventListener("click", () => saveImageFinalization("approved_asset"));
        $("image-final-needs-work").addEventListener("click", () => saveImageFinalization("needs_image_work"));
        document.querySelectorAll(".property-approve").forEach((button) => {
          button.addEventListener("click", () => savePropertyReview(Number(button.dataset.index), "approved"));
        });
        document.querySelectorAll(".property-change").forEach((button) => {
          button.addEventListener("click", () => savePropertyReview(Number(button.dataset.index), "change_requested"));
        });
        $("approve-all-properties").addEventListener("click", () => saveAllPropertiesApproved());
        $("package-approve").addEventListener("click", () => savePackageApproval());
      }

      async function saveImageReview(status, candidateUrl) {
        const approveButton = $("image-approve");
        const originalLabel = approveButton.textContent;
        if (status === "candidate_approved") {
          approveButton.disabled = true;
          approveButton.textContent = "Bild wird verarbeitet...";
          setProcessingFeedback({
            state: "running",
            percent: 25,
            title: "Bildentscheidung wird gespeichert",
            body: "Deine Auswahl wird im lokalen Paket gespeichert.",
          });
        }
        try {
          await requestJson("/api/package/image-review", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              decision: {
                status,
                candidate_url: candidateUrl,
                notes: $("image-review-notes").value.trim(),
                reviewed_by: "nick",
                reviewed_at: new Date().toISOString(),
              },
            }),
          });
          if (status === "candidate_approved") {
            setProcessingFeedback({
              state: "running",
              percent: 65,
              title: "Bild wird verarbeitet",
              body: "Das Bild wird lokal zugeschnitten, normalisiert und fuer die finale Review vorbereitet.",
            });
            const processResult = await requestJson("/api/package/process-image", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                packagePath: selectedPath,
                reviewedBy: "nick",
              }),
            });
            const processedImage = processResult.image_finalization || {};
            if (processedImage.status === "pending") {
              setProcessingFeedback({
                state: "ready",
                percent: 100,
                title: "Finalbild ist bereit zur Review",
                body: "Die Verarbeitung ist fertig. Pruefe unten das finale Chaarlie-Bild.",
              });
            } else if (processedImage.status === "needs_image_work") {
              setProcessingFeedback({
                state: "needs-work",
                percent: 100,
                title: "Bildverarbeitung braucht Arbeit",
                body:
                  processedImage.notes ||
                  "Die Verarbeitung ist gelaufen, aber das Bild braucht noch Arbeit.",
              });
            } else {
              setProcessingFeedback({
                state: "running",
                percent: 90,
                title: "Bildverarbeitung abgeschlossen",
                body: "Die Detailansicht wird aktualisiert.",
              });
            }
          }
          await loadDetail(selectedPath);
        } catch (error) {
          if (status === "candidate_approved") {
            setProcessingFeedback({
              state: "error",
              percent: 100,
              title: "Bildverarbeitung fehlgeschlagen",
              body: error.message,
            });
          }
          alert(error.message);
          await loadDetail(selectedPath);
        } finally {
          approveButton.disabled = false;
          approveButton.textContent = originalLabel;
        }
      }

      function setProcessingFeedback(feedback) {
        const element = $("processing-feedback");
        if (!element) return;
        const percent = Math.max(0, Math.min(100, Number(feedback.percent || 0)));
        element.className = "processing-feedback " + (feedback.state || "running");
        element.querySelector(".processing-title").textContent =
          feedback.title || "Bildverarbeitung";
        element.querySelector(".processing-body").textContent = feedback.body || "";
        const progress = element.querySelector(".processing-progress");
        progress.setAttribute("aria-valuenow", String(percent));
        element.querySelector(".processing-progress-fill").style.width = percent + "%";
      }

      async function requestImageSearch() {
        const searchButton = $("image-reject");
        const notes = $("image-review-notes").value.trim();
        const originalLabel = searchButton.textContent;
        searchButton.disabled = true;
        searchButton.textContent = "Bildsuche laeuft...";
        setSearchFeedback({
          state: "running",
          title: "Bildsuche laeuft",
          body: "Die App prueft jetzt die vorhandenen Research-Quellen. Bitte auf dieser Ansicht bleiben; das Ergebnis erscheint gleich hier.",
          percent: 45,
        });
        try {
          const result = await requestJson("/api/package/request-image-search", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              notes,
              requestedBy: "nick",
              requestedAt: new Date().toISOString(),
            }),
          });
          const found = result.image_search_result?.status === "candidate_found";
          setSearchFeedback({
            state: found ? "found" : "none",
            title: found
              ? "Bildsuche abgeschlossen: neuer Kandidat gefunden"
              : "Bildsuche abgeschlossen: kein besseres Bild gefunden",
            body: found
              ? "Gespeichert: " + (result.image_search_result?.local_file || "neuer Kandidat")
              : result.image_search_result?.message ||
                "Keine bessere Quelle in den vorhandenen Research-Links gefunden.",
            percent: 100,
          });
          await loadDetail(selectedPath);
        } catch (error) {
          setSearchFeedback({
            state: "error",
            title: "Bildsuche konnte nicht angefordert werden",
            body: error.message,
          });
          alert(error.message);
          await loadDetail(selectedPath);
        } finally {
          searchButton.disabled = false;
          searchButton.textContent = originalLabel;
        }
      }

      function setSearchFeedback(feedback) {
        const element = $("search-feedback");
        if (!element) return;
        element.className = "search-feedback " + (feedback.state || "running");
        const title = element.querySelector("h4");
        if (title) title.textContent = feedback.title || "Bildsuche";
        const body = element.querySelector(".processing-body");
        if (body) body.textContent = feedback.body || "";
        const percent = Math.max(0, Math.min(100, Number(feedback.percent || 0)));
        const progress = element.querySelector(".processing-progress");
        if (progress) progress.setAttribute("aria-valuenow", String(percent));
        const fill = element.querySelector(".processing-progress-fill");
        if (fill) fill.style.width = percent + "%";
      }

      async function saveImageFinalization(status) {
        const image = currentDetail.image_finalization || {};
        const notes = $("image-finalization-notes").value.trim();
        const decision = status === "approved_asset"
          ? {
              status: "approved_asset",
              storage_bucket: image.storage_bucket,
              storage_path: image.storage_path,
              public_url: image.public_url,
              source_page_url: image.source_page_url,
              source_image_url: image.source_image_url || null,
              source_type: image.source_type,
              quality_confidence: image.quality_confidence,
              processing_method: image.processing_method,
              final_file: image.final_file,
              asset_sha256: image.asset_sha256,
              user_approved: true,
              quality_gate: image.quality_gate || null,
              reviewed_by: "nick",
              reviewed_at: new Date().toISOString(),
              notes: notes || "Finales Chaarlie-Produktbild freigegeben.",
            }
          : {
              ...image,
              status: "needs_image_work",
              notes,
              reviewed_by: "nick",
              reviewed_at: new Date().toISOString(),
            };
        try {
          await requestJson("/api/package/image-finalization", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              decision,
            }),
          });
          await loadDetail(selectedPath);
        } catch (error) {
          alert(error.message);
        }
      }

      async function savePropertyReview(index, status) {
        const row = currentDetail.property_rows[index];
        const card = document.querySelector('[data-property-index="' + index + '"]');
        const notes = card?.querySelector(".property-note")?.value?.trim() || "";
        if (status === "change_requested" && !notes) {
          alert("Bitte schreibe kurz, was Codex an dieser Eigenschaft aendern soll.");
          card?.querySelector(".property-note")?.focus();
          return;
        }
        try {
          await requestJson("/api/package/property-review", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              decision: {
                path: row.path,
                status,
                proposed_value: row.value,
                reviewer_value: status === "change_requested" ? notes : null,
                notes,
                reviewed_by: "nick",
                reviewed_at: new Date().toISOString(),
              },
            }),
          });
          await loadDetail(selectedPath);
        } catch (error) {
          alert(error.message);
        }
      }

      async function saveAllPropertiesApproved() {
        const now = new Date().toISOString();
        for (const row of currentDetail.property_rows || []) {
          await requestJson("/api/package/property-review", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              decision: {
                path: row.path,
                status: "approved",
                proposed_value: row.value,
                reviewer_value: null,
                notes: "",
                reviewed_by: "nick",
                reviewed_at: now,
              },
            }),
          });
        }
        await loadDetail(selectedPath);
      }

      async function savePackageApproval() {
        const product = currentDetail.payload?.final?.product || currentDetail.payload?.draft?.product || {};
        const label = [product.canonical_brand, product.clean_name].filter(Boolean).join(" ") || "dieses Paket";
        const confirmed = window.confirm(
          "Freigabe-Entscheidung speichern?\\n\\n" +
            label +
            "\\n\\nDer Supabase-Import passiert danach bewusst per CLI: npm run products:intake:approve-package -- --apply --confirm"
        );
        if (!confirmed) return;
        const button = $("package-approve");
        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Freigabe & Import laufen...";
        try {
          await requestJson("/api/package/package-approval", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packagePath: selectedPath,
              decision: {
                status: "approved_for_import",
                notes: $("package-approval-notes").value.trim(),
                reviewed_by: "nick",
                reviewed_at: new Date().toISOString(),
              },
            }),
          });
          await loadDetail(selectedPath);
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }

      loadPackages()
        .then(() => {
          const pathFromHash = window.location.hash
            ? decodeURIComponent(window.location.hash.slice(1))
            : "";
          if (pathFromHash) return loadDetail(pathFromHash);
        })
        .catch((error) => {
          $("package-list").innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
        });
    </script>
  </body>
</html>`
}

export function createReviewAppServer(params: { rootDir: string }) {
  return createServer((request, response) => {
    void routeRequest({ request, response, rootDir: params.rootDir })
  })
}

async function main() {
  const args = parseArgs()
  const port = flagInt(args, "port", 3908)
  const rootDir = flag(args, "root") ?? process.cwd()
  const server = createReviewAppServer({ rootDir })

  server.listen(port, "127.0.0.1", () => {
    const rootLabel = relative(process.cwd(), researchRoot(rootDir)) || RESEARCH_PACKAGE_ROOT
    console.log(`Product intake review app: http://127.0.0.1:${port}/`)
    console.log(`Review root: ${rootLabel}`)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
