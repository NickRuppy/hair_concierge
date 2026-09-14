import { readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import {
  collectShampooFocusV15EvidenceRefIds,
  type ShampooFocusV15DatasetMember,
  type ShampooFocusV15ValidationResult,
  validateShampooFocusV15Dataset,
  validateShampooFocusV15Overlay,
} from "@/lib/shampoo/focus-v15"

type JsonRecord = Record<string, unknown>
type CliResult = ShampooFocusV15ValidationResult & { scope: string }

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord
}

function resultForProductDirectory(
  productDir: string,
  expectedProductId?: string,
): ShampooFocusV15ValidationResult {
  try {
    const source = readJson(resolve(productDir, "source-packet.json"))
    const formula = source.formula as JsonRecord | undefined
    const adjudicationPath = resolve(productDir, "adjudication.json")
    const adjudication = readJson(adjudicationPath)
    const finalProperties = (adjudication.finalProperties ?? adjudication.properties) as
      | Record<string, JsonRecord>
      | undefined
    const primary = finalProperties?.focusPrimary?.value
    const secondary = finalProperties?.focusSecondary?.value
    const productId = expectedProductId ?? source.product_id
    if (typeof productId !== "string" || productId.trim().length === 0)
      return { ok: false, errors: ["source-packet product_id is required"] }
    if (typeof formula?.sha256_normalized_inci !== "string")
      return { ok: false, errors: ["source-packet formula.sha256_normalized_inci is required"] }
    return validateShampooFocusV15Overlay(readJson(resolve(productDir, "focus-v15.json")), {
      productId,
      formulaFingerprintSha256: formula.sha256_normalized_inci,
      canonicalInci: String(formula.normalized_inci_string ?? ""),
      canonicalOrderedInci: Array.isArray(formula.normalized_ordered_inci)
        ? formula.normalized_ordered_inci.map(String)
        : [],
      adjudicationBytes: readFileSync(adjudicationPath),
      priorV14: { primary, secondary },
      evidenceRefIds: collectShampooFocusV15EvidenceRefIds(source, adjudication),
    })
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "invalid product directory"],
    }
  }
}

function isWithin(root: string, target: string) {
  return target === root || target.startsWith(`${root}${sep}`)
}

export function validateFocusV15ProductDirectory(productDir: string): CliResult {
  const absolute = resolve(productDir)
  return { ...resultForProductDirectory(absolute), scope: absolute }
}

export function validateFocusV15DatasetRoot(root: string): CliResult {
  const absoluteRoot = resolve(root)
  try {
    const manifest = readJson(resolve(absoluteRoot, "pilot-manifest.json"))
    const result = validateShampooFocusV15Dataset(
      manifest,
      (member: ShampooFocusV15DatasetMember) => {
        const productDir = resolve(absoluteRoot, member.path)
        if (!isWithin(absoluteRoot, productDir))
          return { ok: false, errors: ["product path escapes dataset root"] }
        return resultForProductDirectory(productDir, member.id)
      },
    )
    return { ...result, scope: absoluteRoot }
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "invalid dataset root"],
      scope: absoluteRoot,
    }
  }
}

function output(result: CliResult, json: boolean, label: "product" | "dataset") {
  if (json) {
    console.log(JSON.stringify(result))
    return
  }
  if (result.ok) console.log(`PASS focus-v15 ${label}: ${result.scope}`)
  else {
    console.log(`FAIL focus-v15 ${label}: ${result.errors.length} issue(s)`)
    for (const error of result.errors) console.log(`- ${error}`)
  }
}

function cli(args: string[]) {
  const json = args.includes("--json")
  const productIndex = args.indexOf("--product-dir")
  const rootIndex = args.indexOf("--root")
  if (productIndex >= 0 === rootIndex >= 0) {
    const result: CliResult = {
      ok: false,
      errors: ["provide exactly one of --product-dir <path> or --root <path>"],
      scope: process.cwd(),
    }
    output(result, json, "dataset")
    process.exitCode = 1
    return
  }
  const label = productIndex >= 0 ? "product" : "dataset"
  const value = args[(productIndex >= 0 ? productIndex : rootIndex) + 1]
  const result =
    label === "product"
      ? validateFocusV15ProductDirectory(value ?? "")
      : validateFocusV15DatasetRoot(value ?? "")
  output(result, json, label)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) cli(process.argv.slice(2))
