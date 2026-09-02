import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const DEFAULT_MANIFEST = "data/research/shampoo-inci/v1.4-candidate/parked-research-package.json"

type Pin = { path: string; sha256: string }
type ParkedManifest = {
  status?: unknown
  productionActive?: unknown
  catalogImportAuthorized?: unknown
  policy?: Pin
  runbook?: Pin
  existingProductCandidate?: Pin & {
    activeProducts?: unknown
    propertiesPerProduct?: unknown
    lockedSourceFiles?: unknown
    lowConfidenceProperties?: unknown
    missingRationaleReferences?: unknown
  }
  weightClosure?: Pin
  newProductHoldout?: {
    manifestPath?: string
    manifestSha256?: string
    reportPath?: string
    reportSha256?: string
    adjudicationPath?: string
    adjudicationSha256?: string
    products?: unknown
    profilesReplayed?: unknown
    gatePassed?: unknown
  }
  verification?: {
    candidateReceiptPath?: string
    candidateReceiptSha256?: string
    readyCheckReceiptPath?: string
    readyCheckReceiptSha256?: string
  }
  archiveContent?: { files?: unknown; sha256?: unknown }
}

const hashFile = (filePath: string) =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex")

const ARCHIVE_PATHS = [
  "data/research/shampoo-inci",
  "docs/research/shampoo-inci",
  "docs/research/category-classification-engine-template.md",
  "plans/2026-09-01-shampoo-v14-final-method-holdout-v3.md",
] as const
const ARCHIVE_EXCLUSIONS = new Set([
  "data/research/shampoo-inci/v1.4-candidate/parked-research-package.json",
  "data/research/shampoo-inci/v1.4-candidate/archive-ready-check-receipt.json",
])

function listFiles(root: string, relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) return []
  if (!statSync(absolutePath).isDirectory()) return [relativePath]
  return readdirSync(absolutePath).flatMap((name) => listFiles(root, path.join(relativePath, name)))
}

export function fingerprintArchiveContent(root: string) {
  const files = ARCHIVE_PATHS.flatMap((archivePath) => listFiles(root, archivePath))
    .filter((filePath) => !ARCHIVE_EXCLUSIONS.has(filePath))
    .sort()
  const manifest = files
    .map((filePath) => `${filePath}\t${hashFile(path.join(root, filePath))}\n`)
    .join("")
  return { files: files.length, sha256: createHash("sha256").update(manifest).digest("hex") }
}

function addPin(
  pins: Pin[],
  pathValue: unknown,
  hashValue: unknown,
  label: string,
  errors: string[],
) {
  if (
    typeof pathValue !== "string" ||
    !pathValue.trim() ||
    typeof hashValue !== "string" ||
    !/^[a-f0-9]{64}$/.test(hashValue)
  ) {
    errors.push(`${label} requires a repository path and SHA-256`)
    return
  }
  pins.push({ path: pathValue, sha256: hashValue })
}

export function validateParkedManifest(root: string, manifest: ParkedManifest) {
  const errors: string[] = []
  if (manifest.status !== "parked_research_only")
    errors.push("package status must remain parked_research_only")
  if (manifest.productionActive !== false) errors.push("productionActive must remain false")
  if (manifest.catalogImportAuthorized !== false)
    errors.push("catalogImportAuthorized must remain false")

  const pins: Pin[] = []
  addPin(pins, manifest.policy?.path, manifest.policy?.sha256, "policy", errors)
  addPin(pins, manifest.runbook?.path, manifest.runbook?.sha256, "runbook", errors)
  addPin(
    pins,
    manifest.existingProductCandidate?.path,
    manifest.existingProductCandidate?.sha256,
    "candidate",
    errors,
  )
  addPin(
    pins,
    manifest.weightClosure?.path,
    manifest.weightClosure?.sha256,
    "weight closure",
    errors,
  )
  addPin(
    pins,
    manifest.newProductHoldout?.manifestPath,
    manifest.newProductHoldout?.manifestSha256,
    "holdout manifest",
    errors,
  )
  addPin(
    pins,
    manifest.newProductHoldout?.reportPath,
    manifest.newProductHoldout?.reportSha256,
    "holdout report",
    errors,
  )
  addPin(
    pins,
    manifest.newProductHoldout?.adjudicationPath,
    manifest.newProductHoldout?.adjudicationSha256,
    "holdout adjudication",
    errors,
  )
  addPin(
    pins,
    manifest.verification?.candidateReceiptPath,
    manifest.verification?.candidateReceiptSha256,
    "candidate verification",
    errors,
  )
  addPin(
    pins,
    manifest.verification?.readyCheckReceiptPath,
    manifest.verification?.readyCheckReceiptSha256,
    "ready-check receipt",
    errors,
  )

  for (const pin of pins) {
    const target = path.join(root, pin.path)
    if (!existsSync(target)) errors.push(`pinned file is missing: ${pin.path}`)
    else if (hashFile(target) !== pin.sha256) errors.push(`pinned file changed: ${pin.path}`)
  }

  const candidatePath = manifest.existingProductCandidate?.path
  if (typeof candidatePath === "string" && existsSync(path.join(root, candidatePath))) {
    try {
      const candidate = JSON.parse(readFileSync(path.join(root, candidatePath), "utf8")) as {
        inputLock?: { files?: Pin[] }
      }
      const sourcePins = candidate.inputLock?.files
      if (
        !Array.isArray(sourcePins) ||
        sourcePins.length !== manifest.existingProductCandidate?.lockedSourceFiles
      ) {
        errors.push("parked candidate source-lock count changed")
      } else {
        const validatedSourcePins: Pin[] = []
        for (const [index, pin] of sourcePins.entries())
          addPin(
            validatedSourcePins,
            pin?.path,
            pin?.sha256,
            `candidate source lock ${index + 1}`,
            errors,
          )
        for (const pin of validatedSourcePins) {
          const target = path.join(root, pin.path)
          if (!existsSync(target)) errors.push(`pinned file is missing: ${pin.path}`)
          else if (hashFile(target) !== pin.sha256) errors.push(`pinned file changed: ${pin.path}`)
        }
        pins.push(...validatedSourcePins)
      }
    } catch (error) {
      errors.push(
        `parked candidate is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const archiveContent = fingerprintArchiveContent(root)
  if (
    manifest.archiveContent?.files !== archiveContent.files ||
    manifest.archiveContent?.sha256 !== archiveContent.sha256
  )
    errors.push("archive content fingerprint changed")

  if (
    manifest.existingProductCandidate?.activeProducts !== 50 ||
    manifest.existingProductCandidate?.propertiesPerProduct !== 8 ||
    manifest.existingProductCandidate?.lockedSourceFiles !== 112
  )
    errors.push("parked candidate must describe 50 products with eight properties each")
  if (
    manifest.existingProductCandidate?.lowConfidenceProperties !== 0 ||
    manifest.existingProductCandidate?.missingRationaleReferences !== 0
  )
    errors.push("parked candidate must retain zero low-confidence or missing-rationale properties")
  if (
    manifest.newProductHoldout?.products !== 10 ||
    manifest.newProductHoldout?.profilesReplayed !== 18 ||
    manifest.newProductHoldout?.gatePassed !== true
  )
    errors.push("parked holdout must retain ten products, 18 profiles, and a passing gate")

  return { valid: errors.length === 0, errors, pinnedFiles: pins.length }
}

export function validateParkedPackage(root = process.cwd(), manifestPath = DEFAULT_MANIFEST) {
  const absoluteManifest = path.join(root, manifestPath)
  if (!existsSync(absoluteManifest))
    return {
      valid: false,
      errors: [`package manifest is missing: ${manifestPath}`],
      pinnedFiles: 0,
    }
  try {
    const manifest = JSON.parse(readFileSync(absoluteManifest, "utf8")) as ParkedManifest
    return validateParkedManifest(root, manifest)
  } catch (error) {
    return {
      valid: false,
      errors: [
        `package manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
      pinnedFiles: 0,
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = validateParkedPackage()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.valid) process.exitCode = 1
}
