import type { ScoreConfig } from "@langfuse/core"
import {
  fetchProductionTraceCandidates,
  getLangfuseClientOrThrow,
  getSupabaseAdminClientOrThrow,
  loadLocalEnv,
  parseArgs,
  readNumberArg,
  readStringArg,
} from "./shared"

const SCORE_CONFIGS = [
  {
    name: "hc_manual_review_pass",
    dataType: "BOOLEAN" as const,
    description: "Overall manual review decision for a production chat trace.",
  },
  {
    name: "hc_review_groundedness",
    dataType: "NUMERIC" as const,
    minValue: 0,
    maxValue: 1,
    description: "Manual review score for grounding quality.",
  },
  {
    name: "hc_review_recommendation_relevance",
    dataType: "NUMERIC" as const,
    minValue: 0,
    maxValue: 1,
    description: "Manual review score for recommendation relevance.",
  },
  {
    name: "hc_review_clarification_quality",
    dataType: "NUMERIC" as const,
    minValue: 0,
    maxValue: 1,
    description: "Manual review score for clarification quality.",
  },
  {
    name: "hc_review_overclaim_risk",
    dataType: "NUMERIC" as const,
    minValue: 0,
    maxValue: 1,
    description: "Manual review score for overclaim risk. Lower is better.",
  },
] as const

async function ensureScoreConfigs(): Promise<ScoreConfig[]> {
  const langfuse = getLangfuseClientOrThrow()
  const existing = await langfuse.api.scoreConfigs.get({ limit: 100 })
  const configsByName = new Map(existing.data.map((config) => [config.name, config]))
  const ensured: ScoreConfig[] = []

  for (const config of SCORE_CONFIGS) {
    const current = configsByName.get(config.name)
    if (current && !current.isArchived) {
      ensured.push(current)
      continue
    }

    const created = await langfuse.api.scoreConfigs.create(config)
    ensured.push(created)
  }

  return ensured
}

async function listAllQueues() {
  const langfuse = getLangfuseClientOrThrow()
  const queues = []
  let page = 1

  while (true) {
    const response = await langfuse.api.annotationQueues.listQueues({ page, limit: 100 })
    queues.push(...response.data)
    if (page >= response.meta.totalPages) break
    page += 1
  }

  return queues
}

async function ensureQueue(
  name: string,
  description: string,
  scoreConfigIds: string[],
  fallbackQueue?: { id: string; name: string } | null,
): Promise<{ id: string; name: string }> {
  const langfuse = getLangfuseClientOrThrow()
  const existing = (await listAllQueues()).find((queue) => queue.name === name)
  if (existing) {
    return { id: existing.id, name: existing.name }
  }

  try {
    const created = await langfuse.api.annotationQueues.createQueue({
      name,
      description,
      scoreConfigIds,
    })

    return { id: created.id, name: created.name }
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined

    if (statusCode === 405 && fallbackQueue) {
      console.log(
        `Queue limit reached on current Langfuse plan. Reusing "${fallbackQueue.name}" for "${name}".`,
      )
      return fallbackQueue
    }

    throw error
  }
}

async function listQueueObjectIds(queueId: string): Promise<Set<string>> {
  const langfuse = getLangfuseClientOrThrow()
  const objectIds = new Set<string>()
  let page = 1

  while (true) {
    const response = await langfuse.api.annotationQueues.listQueueItems(queueId, {
      page,
      limit: 100,
    })

    for (const item of response.data) {
      objectIds.add(item.objectId)
    }

    if (page >= response.meta.totalPages) break
    page += 1
  }

  return objectIds
}

async function addMissingQueueItems(queueId: string, traceIds: string[]): Promise<number> {
  const langfuse = getLangfuseClientOrThrow()
  const existingIds = await listQueueObjectIds(queueId)
  let created = 0

  for (const traceId of traceIds) {
    if (existingIds.has(traceId)) continue

    await langfuse.api.annotationQueues.createQueueItem(queueId, {
      objectId: traceId,
      objectType: "TRACE",
    })
    created += 1
  }

  return created
}

async function main() {
  loadLocalEnv()

  const args = parseArgs(process.argv.slice(2))
  const sinceDays = readNumberArg(args, "--since-days", 30)
  const negativeLimit = readNumberArg(args, "--negative-limit", 50)
  const zeroFeedbackLimit = readNumberArg(args, "--zero-feedback-limit", 25)
  const positiveLimit = readNumberArg(args, "--positive-limit", 10)
  const fetchLimit = readNumberArg(args, "--fetch-limit", 500)
  const promptVersions = (readStringArg(args, "--prompt-versions", "") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value))

  const supabase = getSupabaseAdminClientOrThrow()
  const candidates = await fetchProductionTraceCandidates(supabase, sinceDays, fetchLimit)
  const scoreConfigs = await ensureScoreConfigs()
  const scoreConfigIds = scoreConfigs.map((config) => config.id)
  const existingQueues = await listAllQueues()
  let fallbackQueue: { id: string; name: string } | null =
    existingQueues.length > 0 ? { id: existingQueues[0].id, name: existingQueues[0].name } : null

  const queues = [
    {
      name: "HC Thumbs Down Review",
      description: "All recent traces with explicit negative user feedback.",
      traceIds: candidates
        .filter((candidate) => candidate.feedbackScore === -1)
        .slice(0, negativeLimit)
        .map((candidate) => candidate.langfuseTraceId),
    },
    {
      name: "HC No Feedback Sample",
      description: "Sample of recent traces without explicit user feedback.",
      traceIds: candidates
        .filter((candidate) => candidate.feedbackScore === null)
        .slice(0, zeroFeedbackLimit)
        .map((candidate) => candidate.langfuseTraceId),
    },
    {
      name: "HC Thumbs Up Sample",
      description: "Sample of recent positively rated traces for contrast review.",
      traceIds: candidates
        .filter((candidate) => candidate.feedbackScore === 1)
        .slice(0, positiveLimit)
        .map((candidate) => candidate.langfuseTraceId),
    },
    {
      name: "HC Prompt Change Review",
      description:
        "Recent traces tied to the current prompt rollout. Use --prompt-versions to target specific versions.",
      traceIds: candidates
        .filter((candidate) =>
          promptVersions.length > 0
            ? candidate.promptVersion !== null && promptVersions.includes(candidate.promptVersion)
            : candidate.promptIsFallback === false && candidate.promptVersion !== null,
        )
        .slice(0, zeroFeedbackLimit)
        .map((candidate) => candidate.langfuseTraceId),
    },
  ]

  for (const queue of queues) {
    const ensuredQueue = await ensureQueue(
      queue.name,
      queue.description,
      scoreConfigIds,
      fallbackQueue,
    )
    fallbackQueue = ensuredQueue
    const created = await addMissingQueueItems(ensuredQueue.id, queue.traceIds)
    console.log(
      `${queue.name} -> ${ensuredQueue.name}: ${created} new item(s), ${queue.traceIds.length} requested`,
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
