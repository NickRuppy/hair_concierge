import { existsSync, readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import { createHash } from "node:crypto"
import type { JsonRecord } from "@chaarlie/product-intake-core"

import {
  assertAllowedProductIntakeModel,
  boundedNumber,
  nonBlankEnv,
  nonBlankString,
  normalizeRecord,
  optionalNonBlankString,
  optionalServiceTier,
  parseJsonObject,
  type CodexResearchRuntimeConfig,
} from "./shared"

export type ImageQualityJudgeDeps = {
  runCodexJson: (params: {
    outputPath: string
    prompt: string
    runtimeConfig: CodexResearchRuntimeConfig
    webSearch?: "disabled" | "live"
    imagePaths?: string[]
  }) => Promise<JsonRecord>
  outputPathForModelLane: (promptPacketPath: string, lane: "image_judge") => string
}

export type ImageQualityJudgeRuntimeConfig = CodexResearchRuntimeConfig & {
  enabled: boolean
}

export type ImageQualityDefect = {
  kind: string
  region: string
  severity: "minor" | "material" | "critical"
  explanation: string
}

export type ImageQualityVerdict = {
  verdict: "pass" | "rework" | "needs_human_review"
  confidence: number
  defects: ImageQualityDefect[]
  rationale: string
}

export type ImageQualityReference = {
  id: string
  expectedVerdict: "pass" | "rework" | "needs_human_review"
  imagePath: string
  rationale: string
  defects: Array<{ kind: string; region: string }>
}

export type ImageQualityReferenceSet = {
  version: string | null
  references: ImageQualityReference[]
  warnings: string[]
}

export async function runCodexImageQualityJudge(
  params: {
    promptPacketPath: string
    currentImagePaths: [string, string, string]
    runtimeConfig: CodexResearchRuntimeConfig
    referenceSet: ImageQualityReferenceSet
  },
  deps: ImageQualityJudgeDeps,
): Promise<ImageQualityVerdict> {
  const { runCodexJson, outputPathForModelLane } = deps
  const value = await runCodexJson({
    outputPath: outputPathForModelLane(params.promptPacketPath, "image_judge"),
    prompt: buildImageQualityJudgePrompt({ referenceSet: params.referenceSet }),
    runtimeConfig: params.runtimeConfig,
    webSearch: "disabled",
    imagePaths: [
      ...params.currentImagePaths,
      ...params.referenceSet.references.map((reference) => reference.imagePath),
    ],
  })
  return normalizeImageQualityVerdict(value)
}

export function imageQualityJudgeRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ImageQualityJudgeRuntimeConfig {
  const config = {
    enabled: env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED?.trim().toLowerCase() === "true",
    model: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_MODEL, "gpt-6-sol"),
    reasoningEffort: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_REASONING_EFFORT, "medium"),
    serviceTier: optionalServiceTier(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_SERVICE_TIER),
  }
  assertAllowedProductIntakeModel(config.model, "image quality judge")
  return config
}

export function normalizeImageQualityVerdict(value: JsonRecord): ImageQualityVerdict {
  const verdict = value.verdict
  if (verdict !== "pass" && verdict !== "rework" && verdict !== "needs_human_review") {
    throw new Error("Image quality verdict requires verdict pass, rework, or needs_human_review.")
  }
  const confidence = boundedNumber(value.confidence, 0, 1, "image_quality.confidence")
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    throw new Error("Image quality verdict requires a non-empty rationale.")
  }
  if (!Array.isArray(value.defects)) {
    throw new Error("Image quality verdict requires a defects array.")
  }

  const defects = value.defects.map((item, index): ImageQualityDefect => {
    const defect = normalizeRecord(item)
    if (!defect) throw new Error(`Image quality defect ${index} must be an object.`)
    const kind = nonBlankString(defect.kind, `image_quality.defects[${index}].kind`)
    const region = nonBlankString(defect.region, `image_quality.defects[${index}].region`)
    const severity = defect.severity
    if (severity !== "minor" && severity !== "material" && severity !== "critical") {
      throw new Error(`Image quality defect ${index} has invalid severity.`)
    }
    const explanation = nonBlankString(
      defect.explanation,
      `image_quality.defects[${index}].explanation`,
    )
    return { kind, region, severity, explanation }
  })

  if (verdict === "pass" && defects.some((defect) => defect.severity !== "minor")) {
    throw new Error("Image quality pass cannot contain material or critical defects.")
  }

  return {
    verdict,
    confidence,
    defects,
    rationale: value.rationale.trim(),
  }
}

export function loadImageQualityReferenceSet(params: {
  manifestPath: string
  rootDir: string
  maxReferences?: number
}): ImageQualityReferenceSet {
  if (!existsSync(params.manifestPath)) {
    return {
      version: null,
      references: [],
      warnings: [`Reference manifest not found: ${params.manifestPath}`],
    }
  }

  const manifest = parseJsonObject(readFileSync(params.manifestPath, "utf8"))
  const version = nonBlankString(manifest.version, "image reference manifest version")
  if (!Array.isArray(manifest.references)) {
    throw new Error("Image reference manifest requires a references array.")
  }

  const root = resolve(params.rootDir)
  const limit = Math.min(Math.max(params.maxReferences ?? 5, 0), 5)
  const references: ImageQualityReference[] = []
  const warnings: string[] = []

  for (const [index, item] of manifest.references.entries()) {
    if (references.length >= limit) break
    const entry = normalizeRecord(item)
    if (!entry) throw new Error(`Image reference ${index} must be an object.`)
    const id = nonBlankString(entry.id, `image reference ${index} id`)
    const expectedVerdict = entry.expected_verdict
    if (
      expectedVerdict !== "pass" &&
      expectedVerdict !== "rework" &&
      expectedVerdict !== "needs_human_review"
    ) {
      throw new Error(`Image reference ${id} has an invalid expected verdict.`)
    }
    const relativePath = nonBlankString(entry.relative_path, `image reference ${id} relative_path`)
    const imagePath = resolve(root, relativePath)
    if (imagePath !== root && !imagePath.startsWith(`${root}${sep}`)) {
      throw new Error(`Image reference ${id} resolves outside the configured root.`)
    }
    if (!existsSync(imagePath)) {
      warnings.push(`Image reference ${id} is missing: ${imagePath}`)
      continue
    }
    const expectedSha256 = optionalNonBlankString(entry.sha256)
    if (expectedSha256) {
      const actualSha256 = createHash("sha256").update(readFileSync(imagePath)).digest("hex")
      if (actualSha256 !== expectedSha256.toLowerCase()) {
        warnings.push(`Image reference ${id} failed SHA-256 validation.`)
        continue
      }
    }
    const rawDefects = Array.isArray(entry.defects) ? entry.defects : []
    const defects = rawDefects.map((rawDefect, defectIndex) => {
      const defect = normalizeRecord(rawDefect)
      if (!defect) throw new Error(`Image reference ${id} defect ${defectIndex} is invalid.`)
      return {
        kind: nonBlankString(defect.kind, `image reference ${id} defect kind`),
        region: nonBlankString(defect.region, `image reference ${id} defect region`),
      }
    })
    references.push({
      id,
      expectedVerdict,
      imagePath,
      rationale: nonBlankString(entry.rationale, `image reference ${id} rationale`),
      defects,
    })
  }

  return { version, references, warnings }
}

export function imageQualityPreparationDecision(params: {
  deterministicReady: boolean
  judgeEnabled: boolean
  verdict: ImageQualityVerdict["verdict"] | null
}): { finalImageReady: boolean; status: "pending_review" | "needs_image_work" } {
  const finalImageReady = params.judgeEnabled
    ? params.verdict === "pass"
    : params.deterministicReady
  return {
    finalImageReady,
    status: finalImageReady ? "pending_review" : "needs_image_work",
  }
}

export function buildImageQualityJudgePrompt(params: {
  referenceSet: ImageQualityReferenceSet
}): string {
  return [
    "You are the read-only visual quality judge for one processed Chaarlie product image.",
    "Do not edit files, write databases, approve the image, or approve publication.",
    "The first three attached images are, in order: (1) raw researched source, (2) transparent cutout rendered on magenta QA, and (3) final neutral-background render.",
    "Any remaining attached images are labeled references described in the JSON below.",
    "Inspect the whole product perimeter at high attention, especially the bottom and corners.",
    "Return rework for removable floor shadows or reflections, outer box or secondary packaging, bundles or extra objects, edge residue or halos, rectangular background remnants, jagged edges, detached pixels, or product content cut away by the mask.",
    "Do not mistake an intrinsic dark bottle base, cap, pump, label edge, or transparent packaging content for removable background residue.",
    "Return needs_human_review when image identity or edge quality cannot be determined confidently.",
    "Return exactly one JSON object with verdict (pass, rework, or needs_human_review), confidence (0..1), defects, and rationale.",
    "Each defect must include kind, region, severity (minor, material, or critical), and explanation. A pass may contain only minor observations.",
    "Reference examples:",
    JSON.stringify({
      version: params.referenceSet.version,
      examples: params.referenceSet.references.map((reference, index) => ({
        attachment_index: index + 4,
        id: reference.id,
        expected_verdict: reference.expectedVerdict,
        rationale: reference.rationale,
        defects: reference.defects,
      })),
      warnings: params.referenceSet.warnings,
    }),
  ].join("\n")
}
