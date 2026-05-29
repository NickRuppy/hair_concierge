import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const sourcePath = path.join(process.cwd(), "tmp/agent-compare-runs.jsonl")
const outputPath = path.join(process.cwd(), "tmp/agent-v2-positive-reference-draft.json")
const positivePattern = /\b(gut|besser|stark|natuerlich|natürlich|hilfreich|passend)\b/i

if (!existsSync(sourcePath)) {
  console.log("No tmp/agent-compare-runs.jsonl found; nothing to extract.")
  process.exit(0)
}

const records = readFileSync(sourcePath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, unknown>]
    } catch {
      return []
    }
  })

const references = records.flatMap((record, index) => {
  const judgment = record.judgment as
    | { winner?: string; note?: string; primary_reason?: string }
    | undefined
  if (!judgment || !positivePattern.test(judgment.note ?? "")) return []
  if (judgment.winner !== "current" && judgment.winner !== "agent") return []

  return [
    {
      id: `extracted-positive-${index + 1}`,
      source: "tmp/agent-compare-runs.jsonl",
      prompt: typeof record.prompt === "string" ? record.prompt : "",
      positive_feedback_note: judgment.note ?? "",
      qualities_to_preserve: [judgment.primary_reason ?? "positive_feedback"],
      requires_textual_match: false,
    },
  ]
})

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(references, null, 2)}\n`)
console.log(`Wrote ${references.length} positive reference drafts to ${outputPath}.`)
