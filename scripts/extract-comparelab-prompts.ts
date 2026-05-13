/**
 * Extract only the user-message prompts from local CompareLab/Agent Compare exports.
 *
 * Output shape:
 * [
 *   ["single turn prompt"],
 *   ["first user turn", "second user turn"]
 * ]
 */

import fs from "fs"
import path from "path"

type JsonRecord = Record<string, unknown>
type SourceKind = "agent_compare_jsonl" | "question_batch_json" | "adversarial_batch_json"

const DEFAULT_OUTPUT = path.resolve("tests/fixtures/comparelab-prompts.json")

function parseArgs(args: string[]): { output: string; inputs: string[]; dedupe: boolean } {
  const inputs: string[] = []
  let output = DEFAULT_OUTPUT
  let shouldDedupe = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--output" && args[i + 1]) {
      output = path.resolve(args[i + 1])
      i += 1
    } else if (arg === "--input" && args[i + 1]) {
      inputs.push(path.resolve(args[i + 1]))
      i += 1
    } else if (arg === "--dedupe") {
      shouldDedupe = true
    } else if (arg === "--help") {
      console.log(`Usage:
  npx tsx scripts/extract-comparelab-prompts.ts
  npx tsx scripts/extract-comparelab-prompts.ts --dedupe
  npx tsx scripts/extract-comparelab-prompts.ts --input path/to/agent-compare-runs.jsonl`)
      process.exit(0)
    }
  }

  return { output, inputs, dedupe: shouldDedupe }
}

function discoverInputs(): string[] {
  const roots = new Set<string>()
  const cwd = process.cwd()
  roots.add(cwd)

  const parent = path.dirname(cwd)
  if (path.basename(parent) === ".worktrees") {
    roots.add(parent)
  }

  const rootWorktrees = path.join(cwd, ".worktrees")
  if (fs.existsSync(rootWorktrees)) {
    roots.add(rootWorktrees)
  }

  const files: string[] = []
  for (const root of roots) {
    walk(root, files)
  }

  return [...new Set(files)]
    .filter((file) => classifySource(file) !== null)
    .sort((a, b) => a.localeCompare(b))
}

function walk(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
}

function classifySource(file: string): SourceKind | null {
  const base = path.basename(file)
  if (base === "agent-compare-runs.jsonl") return "agent_compare_jsonl"
  if (/^question-batch-compare-.*\.json$/.test(base)) return "question_batch_json"
  if (/^agent-compare-adversarial-.*\.json$/.test(base)) return "adversarial_batch_json"
  return null
}

function loadPromptSets(file: string, kind: SourceKind): string[][] {
  if (kind === "agent_compare_jsonl") {
    return fs
      .readFileSync(file, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => messagesFromRun(JSON.parse(line) as JsonRecord))
      .filter((messages) => messages.length > 0)
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown
  if (kind === "question_batch_json") {
    return (Array.isArray(raw) ? raw : [])
      .map((item) => {
        const record = asRecord(item)
        const body = asRecord(record.body)
        return [stringOrNull(record.prompt) ?? stringOrNull(body.prompt) ?? ""].filter(Boolean)
      })
      .filter((messages) => messages.length > 0)
  }

  const root = asRecord(raw)
  return (Array.isArray(root.runs) ? root.runs : [])
    .map((item) => {
      const record = asRecord(item)
      const body = asRecord(record.body)
      return [stringOrNull(record.prompt) ?? stringOrNull(body.prompt) ?? ""].filter(Boolean)
    })
    .filter((messages) => messages.length > 0)
}

function messagesFromRun(record: JsonRecord): string[] {
  const results = asRecord(record.results)
  const resultWithTurns = [results.agent, results.current]
    .map(asRecord)
    .find((result) => Array.isArray(result.turns) && result.turns.length > 0)

  if (resultWithTurns && Array.isArray(resultWithTurns.turns)) {
    return resultWithTurns.turns
      .map((turn) => stringOrNull(asRecord(turn).prompt)?.trim() ?? "")
      .filter(Boolean)
  }

  const prompt = stringOrNull(record.prompt)?.trim() ?? ""
  if (!prompt) return []

  const lines = prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length > 1 ? lines : [prompt]
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function dedupe(promptSets: string[][]): string[][] {
  const seen = new Set<string>()
  const deduped: string[][] = []

  for (const messages of promptSets) {
    const key = JSON.stringify(messages)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(messages)
  }

  return deduped
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const inputs = args.inputs.length > 0 ? args.inputs : discoverInputs()
  const promptSets = inputs.flatMap((input) => {
    const kind = classifySource(input)
    return kind ? loadPromptSets(input, kind) : []
  })
  const output = args.dedupe ? dedupe(promptSets) : promptSets

  fs.mkdirSync(path.dirname(args.output), { recursive: true })
  fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`, "utf-8")

  console.log(`Wrote ${output.length} CompareLab prompt set(s) to ${args.output}`)
  console.log(`  Turns: ${output.reduce((sum, messages) => sum + messages.length, 0)}`)
  console.log(
    `  Multi-turn prompt sets: ${output.filter((messages) => messages.length > 1).length}`,
  )
  if (args.dedupe) {
    console.log(`  Removed duplicates: ${promptSets.length - output.length}`)
  }
}

main()
