import {
  INTENT_CLASSIFICATION_PROMPT,
  MEMORY_EXTRACTION_JSON_PROMPT,
  SYSTEM_PROMPT,
  TITLE_GENERATION_PROMPT,
} from "../../src/lib/rag/prompts"
import {
  loadLocalEnv,
  getLangfuseClientOrThrow,
  getPromptLabel,
  parseArgs,
  hasFlag,
} from "./shared"

const LANGFUSE_PROMPTS = [
  {
    name: "hair-concierge-chat-system",
    fallback: SYSTEM_PROMPT,
  },
  {
    name: "hair-concierge-intent-classifier",
    fallback: INTENT_CLASSIFICATION_PROMPT,
  },
  {
    name: "hair-concierge-title-generator",
    fallback: TITLE_GENERATION_PROMPT,
  },
  {
    name: "hair-concierge-memory-extraction",
    fallback: MEMORY_EXTRACTION_JSON_PROMPT,
  },
] as const

async function main() {
  loadLocalEnv()

  const args = parseArgs(process.argv.slice(2))
  const dryRun = hasFlag(args, "--dry-run")
  const label = getPromptLabel()
  const langfuse = getLangfuseClientOrThrow()
  const commitMessage = `sync from repo (${process.env.LANGFUSE_RELEASE ?? new Date().toISOString()})`

  for (const prompt of LANGFUSE_PROMPTS) {
    try {
      const existing = await langfuse.prompt.get(prompt.name, {
        type: "text",
        label,
        maxRetries: 1,
      })
      if (existing.prompt === prompt.fallback) {
        console.log(
          `skip  ${prompt.name} (label=${label}, version=${existing.promptResponse.version})`,
        )
        continue
      }

      if (dryRun) {
        console.log(`would update ${prompt.name} for label ${label}`)
        continue
      }

      const created = await langfuse.prompt.create({
        name: prompt.name,
        type: "text",
        prompt: prompt.fallback,
        labels: [label],
        tags: ["hair-concierge", "production-chat"],
        commitMessage,
      })

      console.log(
        `update ${prompt.name} -> version ${created.promptResponse.version} (label=${label})`,
      )
      continue
    } catch {
      if (dryRun) {
        console.log(`would create ${prompt.name} for label ${label}`)
        continue
      }

      const created = await langfuse.prompt.create({
        name: prompt.name,
        type: "text",
        prompt: prompt.fallback,
        labels: [label],
        tags: ["hair-concierge", "production-chat"],
        commitMessage,
      })

      console.log(
        `create ${prompt.name} -> version ${created.promptResponse.version} (label=${label})`,
      )
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
