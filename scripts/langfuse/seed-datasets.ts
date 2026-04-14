import type { FetchedDataset } from "@langfuse/client"
import { SCENARIOS } from "../eval-chat/fixtures"
import {
  fetchProductionTraceCandidates,
  getLangfuseClientOrThrow,
  getSupabaseAdminClientOrThrow,
  loadLocalEnv,
  parseArgs,
  readNumberArg,
  readStringArg,
} from "./shared"

async function ensureDataset(name: string, description: string): Promise<FetchedDataset> {
  const langfuse = getLangfuseClientOrThrow()

  try {
    return await langfuse.dataset.get(name)
  } catch {
    await langfuse.api.datasets.create({
      name,
      description,
      metadata: {
        source: "hair-concierge",
      },
    })
    return langfuse.dataset.get(name)
  }
}

async function seedCuratedDataset(datasetName: string): Promise<void> {
  const langfuse = getLangfuseClientOrThrow()
  const dataset = await ensureDataset(
    datasetName,
    "Curated Hair Concierge regression cases sourced from scripts/eval-chat/fixtures.ts",
  )
  const existingIds = new Set(dataset.items.map((item) => item.id))
  let created = 0

  for (const scenario of SCENARIOS) {
    const previousTurns: string[] = []

    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
      const turn = scenario.turns[turnIndex]
      const itemId = `${scenario.id}-turn-${turnIndex + 1}`

      if (existingIds.has(itemId)) {
        previousTurns.push(turn.message)
        continue
      }

      await langfuse.api.datasetItems.create({
        id: itemId,
        datasetName,
        input: {
          message: turn.message,
          prior_turn_messages: previousTurns,
          hair_profile: scenario.hair_profile,
        },
        expectedOutput:
          turn.judge?.expected_behavior ??
          "Match deterministic metadata assertions and content heuristics.",
        metadata: {
          source: "curated_eval_fixture",
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          turn_index: turnIndex + 1,
          metadata_assertions: turn.metadata ?? null,
          content_assertions: turn.content ?? null,
        },
      })

      created += 1
      previousTurns.push(turn.message)
    }
  }

  console.log(
    `Curated dataset ${datasetName}: ${created} item(s) created, ${existingIds.size} already existed`,
  )
}

async function seedProductionDataset(
  datasetName: string,
  params: {
    sinceDays: number
    negativeLimit: number
    zeroFeedbackLimit: number
    positiveLimit: number
    fetchLimit: number
  },
): Promise<void> {
  const langfuse = getLangfuseClientOrThrow()
  const supabase = getSupabaseAdminClientOrThrow()
  const dataset = await ensureDataset(
    datasetName,
    "Sampled production chat traces for triage, annotation, and offline review.",
  )
  const existingIds = new Set(dataset.items.map((item) => item.id))
  const candidates = await fetchProductionTraceCandidates(
    supabase,
    params.sinceDays,
    params.fetchLimit,
  )

  const negatives = candidates
    .filter((candidate) => candidate.feedbackScore === -1)
    .slice(0, params.negativeLimit)
  const zeroFeedback = candidates
    .filter((candidate) => candidate.feedbackScore === null)
    .slice(0, params.zeroFeedbackLimit)
  const positives = candidates
    .filter((candidate) => candidate.feedbackScore === 1)
    .slice(0, params.positiveLimit)
  const selection = [...negatives, ...zeroFeedback, ...positives]
  let created = 0

  for (const candidate of selection) {
    const itemId = `trace-${candidate.langfuseTraceId}`
    if (existingIds.has(itemId)) continue

    await langfuse.api.datasetItems.create({
      id: itemId,
      datasetName,
      sourceTraceId: candidate.langfuseTraceId,
      input: {
        user_message: candidate.userMessage,
        conversation_id: candidate.conversationId,
      },
      metadata: {
        source: "production_trace",
        created_at: candidate.createdAt,
        feedback_score: candidate.feedbackScore,
        intent: candidate.intent,
        product_category: candidate.productCategory,
        retrieval_mode: candidate.retrievalMode,
        response_mode: candidate.responseMode,
        needs_clarification: candidate.needsClarification,
        prompt_version: candidate.promptVersion,
        prompt_label: candidate.promptLabel,
        prompt_is_fallback: candidate.promptIsFallback,
        assistant_preview: candidate.assistantContent.slice(0, 1000),
      },
    })
    created += 1
  }

  console.log(
    `Production dataset ${datasetName}: ${created} item(s) created from ${selection.length} sampled traces`,
  )
}

async function main() {
  loadLocalEnv()

  const args = parseArgs(process.argv.slice(2))
  const curatedDatasetName =
    readStringArg(args, "--curated-name", "hair-concierge-curated-chat-evals") ??
    "hair-concierge-curated-chat-evals"
  const productionDatasetName =
    readStringArg(args, "--production-name", "hair-concierge-production-chat-triage") ??
    "hair-concierge-production-chat-triage"

  await seedCuratedDataset(curatedDatasetName)
  await seedProductionDataset(productionDatasetName, {
    sinceDays: readNumberArg(args, "--since-days", 30),
    negativeLimit: readNumberArg(args, "--negative-limit", 50),
    zeroFeedbackLimit: readNumberArg(args, "--zero-feedback-limit", 25),
    positiveLimit: readNumberArg(args, "--positive-limit", 10),
    fetchLimit: readNumberArg(args, "--fetch-limit", 500),
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
