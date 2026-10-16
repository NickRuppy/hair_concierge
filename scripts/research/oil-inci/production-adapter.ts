import { readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  projectOilForProduction,
  renderOilProjectionSummary,
  type OilProjectionOutcome,
} from "@/lib/oil-research/production-adapter"
import { OilResearchInputSchema } from "@/lib/oil-research/contracts"
import { publishDirectoryAtomically } from "./artifact-io"

const MAX_INPUT_BYTES = 1024 * 1024

export type OilProductionAdapterCliArgs = {
  input: string
  output: string
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

export function parseOilProductionAdapterCliArgs(argv: string[]): OilProductionAdapterCliArgs {
  const parsed: Partial<OilProductionAdapterCliArgs> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument !== "--input" && argument !== "--output") {
      throw new Error(`Unknown argument: ${argument}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`)
    const key = argument.slice(2) as keyof OilProductionAdapterCliArgs
    if (parsed[key]) throw new Error(`${argument} may only be supplied once`)
    parsed[key] = value
    index += 1
  }
  if (!parsed.input) throw new Error("--input is required")
  if (!parsed.output) throw new Error("--output is required")
  return { input: parsed.input, output: parsed.output }
}

export function runOilProductionAdapterCli(args: OilProductionAdapterCliArgs): {
  status: OilProjectionOutcome["status"]
} {
  const inputPath = path.resolve(args.input)
  const inputStat = statSync(inputPath)
  if (!inputStat.isFile()) throw new Error(`Oil research input must be a file: ${inputPath}`)
  if (inputStat.size > MAX_INPUT_BYTES) {
    throw new Error(`Oil research input exceeds the 1 MiB limit: ${inputPath}`)
  }
  const sourceBytes = readFileSync(inputPath)
  if (sourceBytes.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`Oil research input exceeds the 1 MiB limit: ${inputPath}`)
  }
  let raw: unknown
  try {
    raw = JSON.parse(sourceBytes.toString("utf8"))
  } catch (error) {
    throw new Error(
      `Oil research input is unreadable or malformed: ${inputPath} (${error instanceof Error ? error.message : String(error)})`,
    )
  }

  const parsed = OilResearchInputSchema.safeParse(raw)
  const outcome = projectOilForProduction(raw)
  if (!parsed.success && outcome.status === "property_projection_ready") {
    throw new Error("Oil projector returned ready for an invalid research envelope")
  }

  publishDirectoryAtomically(args.output, (staging) => {
    // Preserve precisely the submitted bytes; this is the immutable source
    // record even when the projection has a semantic refusal.
    writeFileSync(path.join(staging, "original-input.json"), sourceBytes)
    if (outcome.status === "property_projection_ready") {
      if (!parsed.success) throw new Error("Validated envelope is required for a ready projection")
      // The strict schema's historical record digest intentionally uses native
      // JSON key order. Sorting this envelope would invalidate that receipt.
      writeFileSync(
        path.join(staging, "research-envelope.json"),
        `${JSON.stringify(parsed.data, null, 2)}\n`,
      )
    }
    writeFileSync(path.join(staging, "production-projection.json"), stableJson(outcome))
    writeFileSync(
      path.join(staging, "projection-summary.md"),
      renderOilProjectionSummary(raw, outcome),
    )
  })
  return { status: outcome.status }
}

export function exitCodeForOilProjection(status: OilProjectionOutcome["status"]): number {
  if (status === "property_projection_ready") return 0
  if (status === "needs_research") return 1
  return 3
}

function main(): void {
  try {
    const result = runOilProductionAdapterCli(
      parseOilProductionAdapterCliArgs(process.argv.slice(2)),
    )
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = exitCodeForOilProjection(result.status)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
