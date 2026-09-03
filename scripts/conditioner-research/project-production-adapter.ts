import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import {
  conditionerResearchEnvelopeSchema,
  projectConditionerForProduction,
  type ConditionerProductionAdapterOutcome,
} from "@/lib/conditioner-research/production-adapter"

export type ConditionerProductionAdapterCliArgs = {
  input: string
  output: string
  overwrite: boolean
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

function renderSummary(outcome: ConditionerProductionAdapterOutcome): string {
  const header = `# Conditioner production adapter\n\nVersion: ${outcome.version}\n\nStatus: ${outcome.status}`
  if (outcome.status !== "projection_ready") {
    return `${header}\n\nProduct: ${outcome.summary.productName ?? "unknown"}\n\n## Reasons\n\n${outcome.reasons.map((reason) => `- ${reason}`).join("\n")}\n`
  }
  const rerank = outcome.productionProjection.category_specs.product_conditioner_rerank_specs
  const rows = outcome.productionProjection.category_specs.product_conditioner_specs
    .map((row) => `| ${row.thickness} | ${row.protein_moisture_balance} |`)
    .join("\n")
  const warnings = outcome.warnings.length
    ? outcome.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None"
  return `${header}\n\nProduct: ${outcome.summary.productName}\n\n## Current production projection\n\n| Thickness | Protein/moisture compatibility |\n| --- | --- |\n${rows}\n\n- Weight: ${rerank.weight}\n- Repair level: ${rerank.repair_level}\n- Balance direction: ${rerank.balance_direction}\n- Ingredient flags: ${rerank.ingredient_flags.join(", ") || "none"}\n- Required protocol: ${outcome.requiredProtocolRole}\n\n## Retained research-only fields\n\n${outcome.omittedResearchProperties.map((field) => `- ${field}`).join("\n")}\n\n## Warnings\n\n${warnings}\n`
}

function assertOutputTarget(output: string, overwrite: boolean) {
  if (!existsSync(output)) return
  if (!lstatSync(output).isDirectory()) {
    throw new Error(`Output path must be a directory: ${output}`)
  }
  if (!overwrite && readdirSync(output).length > 0) {
    throw new Error(`Refusing to replace non-empty output directory without --overwrite: ${output}`)
  }
}

function publishStaging(output: string, staging: string, overwrite: boolean) {
  if (!existsSync(output)) {
    renameSync(staging, output)
    return
  }
  if (!overwrite && readdirSync(output).length > 0) {
    throw new Error(`Refusing to replace non-empty output directory without --overwrite: ${output}`)
  }
  const backup = `${output}.previous-${process.pid}`
  if (existsSync(backup)) throw new Error(`Refusing to overwrite backup path: ${backup}`)
  renameSync(output, backup)
  try {
    renameSync(staging, output)
  } catch (error) {
    renameSync(backup, output)
    throw error
  }
  rmSync(backup, { recursive: true, force: false })
}

function writeOutputAtomically(
  output: string,
  overwrite: boolean,
  write: (staging: string) => void,
) {
  const resolved = path.resolve(output)
  if (resolved === path.parse(resolved).root) {
    throw new Error("Output directory cannot be a filesystem root")
  }
  assertOutputTarget(resolved, overwrite)
  const parent = path.dirname(resolved)
  mkdirSync(parent, { recursive: true })
  const staging = mkdtempSync(path.join(parent, `.${path.basename(resolved)}.staging-`))
  try {
    write(staging)
    publishStaging(resolved, staging, overwrite)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
}

export function parseConditionerProductionAdapterCliArgs(
  argv: string[],
): ConditionerProductionAdapterCliArgs {
  const parsed: Partial<ConditionerProductionAdapterCliArgs> = { overwrite: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--overwrite") {
      parsed.overwrite = true
      continue
    }
    if (argument === "--input" || argument === "--output") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`)
      const key = argument.slice(2) as "input" | "output"
      if (parsed[key]) throw new Error(`${argument} may only be supplied once`)
      parsed[key] = value
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (!parsed.input) throw new Error("--input is required")
  if (!parsed.output) throw new Error("--output is required")
  return {
    input: parsed.input,
    output: parsed.output,
    overwrite: parsed.overwrite ?? false,
  }
}

export function runConditionerProductionAdapterCli(args: ConditionerProductionAdapterCliArgs): {
  status: ConditionerProductionAdapterOutcome["status"]
} {
  const inputPath = path.resolve(args.input)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8"))
  } catch (error) {
    throw new Error(
      `Conditioner research input is unreadable or malformed: ${inputPath} (${error instanceof Error ? error.message : String(error)})`,
    )
  }
  const parsed = conditionerResearchEnvelopeSchema.safeParse(raw)
  const outcome = projectConditionerForProduction(raw)
  if (!parsed.success && outcome.status === "needs_research") {
    throw new Error(`Invalid Conditioner research envelope: ${outcome.reasons.join("; ")}`)
  }
  const researchEnvelope = parsed.success ? parsed.data : raw

  writeOutputAtomically(args.output, args.overwrite, (staging) => {
    writeFileSync(path.join(staging, "research-envelope.json"), stableJson(researchEnvelope))
    writeFileSync(path.join(staging, "production-projection.json"), stableJson(outcome))
    writeFileSync(path.join(staging, "projection-summary.md"), renderSummary(outcome))
  })
  return { status: outcome.status }
}

function main() {
  const result = runConditionerProductionAdapterCli(
    parseConditionerProductionAdapterCliArgs(process.argv.slice(2)),
  )
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
