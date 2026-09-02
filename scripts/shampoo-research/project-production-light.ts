import { createHash } from "node:crypto"
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
import path from "node:path"

import { z } from "zod"

import {
  projectShampooProductionLight,
  renderShampooProductionLightMarkdown,
  shampooProductionLightInputSchema,
  type ShampooProductionLightOutcome,
} from "@/lib/shampoo/production-light-adapter"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"

const BATCH_VERSION = "shampoo-production-light-batch-v1" as const
const batchManifestSchema = z
  .object({
    version: z.literal(BATCH_VERSION),
    products: z
      .array(
        z
          .object({
            productId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
            exactProductName: z.string().min(1),
            gtinAliases: z.array(z.string().regex(/^\d{8,14}$/)).min(1),
            selectionNotes: z.string().min(1),
            input: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export type ProductionLightCliArgs = {
  input?: string
  manifest?: string
  output: string
  overwrite: boolean
}

type PreparedMember = {
  productId: string
  exactProductName: string
  gtinAliases: string[]
  inputPath: string
  relativeInputPath?: string
  inputSha256: string
  outcome: ShampooProductionLightOutcome
}

type SingleResult = {
  kind: "single"
  status: ShampooProductionLightOutcome["status"]
  inputSha256: string
}
type BatchResult = {
  kind: "batch"
  ready: number
  routed: number
  needsResearch: number
  products: number
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  return value
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

function readJson(filePath: string): { value: unknown; sha256: string } {
  let bytes: Buffer
  try {
    bytes = readFileSync(filePath)
  } catch (error) {
    throw new Error(
      `Input is unreadable: ${filePath} (${error instanceof Error ? error.message : String(error)})`,
    )
  }
  const content = bytes.toString("utf8")
  try {
    return { value: JSON.parse(content), sha256: createHash("sha256").update(bytes).digest("hex") }
  } catch (error) {
    throw new Error(
      `Malformed JSON: ${filePath} (${error instanceof Error ? error.message : String(error)})`,
    )
  }
}

function structuralErrors(input: unknown): string[] {
  const parsed = shampooProductionLightInputSchema.safeParse(input)
  if (parsed.success) return []
  return parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
}

function assertNoPathEscape(baseDirectory: string, memberPath: string): string {
  if (path.isAbsolute(memberPath))
    throw new Error(
      `Batch member input path must be relative and cannot escape the manifest directory: ${memberPath}`,
    )
  const resolved = path.resolve(baseDirectory, memberPath)
  const relative = path.relative(baseDirectory, resolved)
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Batch member input path escapes the manifest directory: ${memberPath}`)
  return resolved
}

function canonicalGtinSet(gtins: string[]): string[] {
  return [...new Set(gtins.map((gtin) => canonicalizeGtin(gtin) ?? gtin))].sort()
}

function prepareSingle(inputPath: string): PreparedMember {
  const { value: input, sha256: inputSha256 } = readJson(inputPath)
  const errors = structuralErrors(input)
  if (errors.length)
    throw new Error(`Invalid Shampoo Production Light input ${inputPath}: ${errors.join("; ")}`)
  const outcome = projectShampooProductionLight(input)
  const parsed = shampooProductionLightInputSchema.parse(input)
  return {
    productId: parsed.identity.productId,
    exactProductName: parsed.identity.exactProductName,
    gtinAliases: parsed.identity.gtinAliases,
    inputPath,
    inputSha256,
    outcome,
  }
}

function prepareBatch(manifestPath: string): PreparedMember[] {
  const { value: manifestRaw } = readJson(manifestPath)
  const manifestResult = batchManifestSchema.safeParse(manifestRaw)
  if (!manifestResult.success)
    throw new Error(
      `Invalid Shampoo Production Light batch manifest: ${manifestResult.error.issues.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`).join("; ")}`,
    )
  const manifest = manifestResult.data
  const ids = new Set<string>()
  for (const product of manifest.products) {
    if (ids.has(product.productId))
      throw new Error(`Duplicate batch product ID: ${product.productId}`)
    ids.add(product.productId)
  }

  const manifestDirectory = path.dirname(path.resolve(manifestPath))
  const members = manifest.products.map((product) => {
    const inputPath = assertNoPathEscape(manifestDirectory, product.input)
    const member = prepareSingle(inputPath)
    if (member.productId !== product.productId)
      throw new Error(
        `Batch product ID ${product.productId} does not match input identity.productId ${member.productId}`,
      )
    if (member.exactProductName !== product.exactProductName)
      throw new Error(
        `Batch exact product name for ${product.productId} does not match input identity.exactProductName`,
      )
    const manifestGtins = canonicalGtinSet(product.gtinAliases)
    const inputGtins = canonicalGtinSet(member.gtinAliases)
    if (JSON.stringify(manifestGtins) !== JSON.stringify(inputGtins))
      throw new Error(
        `Batch GTIN aliases for ${product.productId} do not match input identity.gtinAliases`,
      )
    return {
      ...member,
      relativeInputPath: path.relative(manifestDirectory, inputPath).split(path.sep).join("/"),
    }
  })
  return members.sort((left, right) => compareCodeUnits(left.productId, right.productId))
}

function writeArtifact(directory: string, outcome: ShampooProductionLightOutcome) {
  writeFileSync(path.join(directory, "production-light.json"), stableJson(outcome), "utf8")
  writeFileSync(
    path.join(directory, "production-light-summary.md"),
    `${renderShampooProductionLightMarkdown(outcome)}\n`,
    "utf8",
  )
}

function statusCounts(members: PreparedMember[]) {
  return members.reduce(
    (counts, member) => {
      if (member.outcome.status === "property_lane_ready") counts.ready += 1
      else if (member.outcome.status === "routed_deep_cleansing") counts.routed += 1
      else counts.needsResearch += 1
      return counts
    },
    { ready: 0, routed: 0, needsResearch: 0 },
  )
}

function renderBatchSummary(
  members: PreparedMember[],
  counts: ReturnType<typeof statusCounts>,
): string {
  const rows = members
    .map(
      (member) =>
        `| ${member.productId} | ${member.outcome.status} | ${member.productId}/production-light-summary.md |`,
    )
    .join("\n")
  return `# Shampoo Production Light v1 batch summary\n\n- Property lane ready: ${counts.ready}\n- Routed deep cleansing: ${counts.routed}\n- Needs research: ${counts.needsResearch}\n- Total: ${members.length}\n\n| Product ID | Outcome | Review artifact |\n| --- | --- | --- |\n${rows}\n`
}

function assertWritableOutput(output: string, overwrite: boolean) {
  if (!existsSync(output)) return
  if (!lstatSync(output).isDirectory())
    throw new Error(`Output path must be a directory: ${output}`)
  if (!overwrite && readdirSync(output).length > 0)
    throw new Error(`Refusing to replace nonempty output directory without --overwrite: ${output}`)
}

function publishStaging(output: string, staging: string, overwrite: boolean) {
  if (!existsSync(output)) {
    renameSync(staging, output)
    return
  }
  if (!overwrite) {
    // An existing empty directory is safe to replace, but cannot be a rename target itself.
    rmSync(output, { recursive: true, force: false })
    renameSync(staging, output)
    return
  }

  const backup = `${output}.previous-${process.pid}`
  if (existsSync(backup))
    throw new Error(`Refusing to replace output because backup path already exists: ${backup}`)
  renameSync(output, backup)
  try {
    renameSync(staging, output)
  } catch (error) {
    renameSync(backup, output)
    throw error
  }
  rmSync(backup, { recursive: true, force: false })
}

function writeAtomically(output: string, overwrite: boolean, write: (staging: string) => void) {
  const resolvedOutput = path.resolve(output)
  if (resolvedOutput === path.parse(resolvedOutput).root)
    throw new Error("Output directory cannot be a filesystem root")
  assertWritableOutput(resolvedOutput, overwrite)
  const parent = path.dirname(resolvedOutput)
  mkdirSync(parent, { recursive: true })
  const staging = mkdtempSync(path.join(parent, `.${path.basename(resolvedOutput)}.staging-`))
  try {
    write(staging)
    publishStaging(resolvedOutput, staging, overwrite)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
}

export function parseProductionLightCliArgs(argv: string[]): ProductionLightCliArgs {
  const parsed: Partial<ProductionLightCliArgs> = { overwrite: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--overwrite") {
      parsed.overwrite = true
      continue
    }
    if (argument === "--input" || argument === "--manifest" || argument === "--output") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`)
      const key = argument.slice(2) as "input" | "manifest" | "output"
      if (parsed[key]) throw new Error(`${argument} may only be supplied once`)
      parsed[key] = value
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (!parsed.output) throw new Error("--output is required")
  if ((parsed.input ? 1 : 0) + (parsed.manifest ? 1 : 0) !== 1)
    throw new Error("Provide exactly one of --input or --manifest")
  return {
    input: parsed.input,
    manifest: parsed.manifest,
    output: parsed.output,
    overwrite: parsed.overwrite ?? false,
  }
}

export function runProductionLightCli(args: ProductionLightCliArgs): SingleResult | BatchResult {
  if (Boolean(args.input) === Boolean(args.manifest))
    throw new Error("Provide exactly one of input or manifest")
  if (args.input) {
    const member = prepareSingle(path.resolve(args.input))
    writeAtomically(args.output, args.overwrite, (staging) =>
      writeArtifact(staging, member.outcome),
    )
    return { kind: "single", status: member.outcome.status, inputSha256: member.inputSha256 }
  }

  const members = prepareBatch(path.resolve(args.manifest!))
  const counts = statusCounts(members)
  writeAtomically(args.output, args.overwrite, (staging) => {
    for (const member of members) {
      const directory = path.join(staging, member.productId)
      mkdirSync(directory)
      writeArtifact(directory, member.outcome)
    }
    const products = members.map((member) => ({
      productId: member.productId,
      status: member.outcome.status,
      artifactDirectory: member.productId,
      input: member.relativeInputPath,
      inputSha256: member.inputSha256,
    }))
    writeFileSync(
      path.join(staging, "batch-summary.json"),
      stableJson({ version: "shampoo-production-light-batch-summary-v1", counts, products }),
      "utf8",
    )
    writeFileSync(
      path.join(staging, "batch-summary.md"),
      renderBatchSummary(members, counts),
      "utf8",
    )
  })
  return { kind: "batch", ...counts, products: members.length }
}

function main() {
  try {
    const result = runProductionLightCli(parseProductionLightCliArgs(process.argv.slice(2)))
    process.stdout.write(`${stableJson(result)}`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

if (require.main === module) main()
