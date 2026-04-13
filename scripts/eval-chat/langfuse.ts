import { LangfuseClient } from "@langfuse/client"
import type {
  EvalScenario,
  LangfuseExperimentSummary,
  QualityRubricResult,
  ScenarioResult,
  TurnResult,
} from "./types"

interface PublishEvalExperimentParams {
  baseUrl: string
  scenarios: EvalScenario[]
  results: ScenarioResult[]
  skipJudge: boolean
  experimentName: string
  runName?: string
}

interface EvalExperimentItem {
  input: {
    scenario_id: string
    scenario_name: string
    turn_index: number
    message: string
    hair_profile: EvalScenario["hair_profile"]
    base_url: string
  }
  expectedOutput: {
    expected_behavior: string | null
  }
  metadata: {
    live_trace_id: string | null
    live_trace_url: string | null
    conversation_id: string | null
    assistant_message_id: string | null
    assertion_failures: number
    assertion_count: number
    turn_passed: boolean
    judge_score: number | null
    rubric: QualityRubricResult | null
    latency_ms: number
    source_count: number
    product_count: number
  }
  output: {
    assistant_response: string
    done_data: Record<string, unknown> | null
    error: string | null
  }
}

function isConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY &&
    process.env.LANGFUSE_BASE_URL,
  )
}

function getClient(): LangfuseClient {
  if (!isConfigured()) {
    throw new Error(
      "Langfuse env vars missing. Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL.",
    )
  }

  return new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  })
}

function buildItems(
  baseUrl: string,
  scenarios: EvalScenario[],
  results: ScenarioResult[],
): EvalExperimentItem[] {
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
  const items: EvalExperimentItem[] = []

  for (const scenarioResult of results) {
    const scenario = scenariosById.get(scenarioResult.id)
    if (!scenario) continue

    for (const turnResult of scenarioResult.turns) {
      const scenarioTurn = scenario.turns[turnResult.turn_index - 1]
      const assertionFailures = turnResult.assertions.filter(
        (assertion) => !assertion.passed,
      ).length

      items.push({
        input: {
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          turn_index: turnResult.turn_index,
          message: turnResult.message,
          hair_profile: scenario.hair_profile,
          base_url: baseUrl,
        },
        expectedOutput: {
          expected_behavior: scenarioTurn?.judge?.expected_behavior ?? null,
        },
        metadata: {
          live_trace_id: turnResult.sse_result.langfuse_trace_id,
          live_trace_url: turnResult.sse_result.langfuse_trace_url,
          conversation_id: turnResult.sse_result.conversation_id,
          assistant_message_id: turnResult.sse_result.assistant_message_id,
          assertion_failures: assertionFailures,
          assertion_count: turnResult.assertions.length,
          turn_passed: turnResult.all_passed,
          judge_score: turnResult.judge_result?.score ?? null,
          rubric: turnResult.quality_rubric,
          latency_ms: turnResult.sse_result.latency_ms,
          source_count: turnResult.sse_result.sources.length,
          product_count: turnResult.sse_result.products.length,
        },
        output: {
          assistant_response: turnResult.sse_result.content,
          done_data: turnResult.sse_result.done_data,
          error: turnResult.sse_result.error,
        },
      })
    }
  }

  return items
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildInternalEvalQuality(turn: TurnResult): number {
  const assertionPassRate =
    turn.assertions.length === 0
      ? Number(turn.all_passed)
      : turn.assertions.filter((assertion) => assertion.passed).length / turn.assertions.length

  const rubric = turn.quality_rubric
  const rubricQuality = rubric
    ? average([
        rubric.groundedness,
        rubric.recommendation_relevance,
        rubric.clarification_quality,
        1 - rubric.overclaim_risk,
        rubric.overall_quality,
      ])
    : assertionPassRate

  const expectationScore = turn.judge_result?.score ?? rubricQuality

  return average([assertionPassRate, rubricQuality, expectationScore])
}

export async function publishEvalExperiment(
  params: PublishEvalExperimentParams,
): Promise<LangfuseExperimentSummary> {
  const { baseUrl, scenarios, results, skipJudge, experimentName, runName } = params
  const langfuse = getClient()
  const items = buildItems(baseUrl, scenarios, results)

  const turnByKey = new Map<string, TurnResult>()
  for (const scenario of results) {
    for (const turn of scenario.turns) {
      turnByKey.set(`${scenario.id}:${turn.turn_index}`, turn)
    }
  }
  const outputByKey = new Map(
    items.map((item) => [`${item.input.scenario_id}:${item.input.turn_index}`, item.output]),
  )

  const experiment = await langfuse.experiment.run<
    EvalExperimentItem["input"],
    EvalExperimentItem["expectedOutput"],
    EvalExperimentItem["metadata"]
  >({
    name: experimentName,
    runName,
    description: "Production chat regression run published from the local eval harness.",
    metadata: {
      base_url: baseUrl,
      release: process.env.LANGFUSE_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      skip_judge: skipJudge,
      scenario_count: scenarios.length,
      turn_count: items.length,
    },
    data: items,
    task: async (item) => {
      const experimentItem = item as EvalExperimentItem

      return {
        input: experimentItem.input,
        expected_output: experimentItem.expectedOutput,
        metadata: experimentItem.metadata,
        output:
          outputByKey.get(
            `${experimentItem.input.scenario_id}:${experimentItem.input.turn_index}`,
          ) ?? null,
      }
    },
    evaluators: [
      async ({ input, metadata, output }) => {
        const turn = turnByKey.get(`${input.scenario_id}:${input.turn_index}`)
        const quality = turn ? buildInternalEvalQuality(turn) : 0
        return {
          name: "internal_eval_quality",
          value: quality,
          comment:
            turn?.quality_rubric?.summary ??
            `assertion_failures=${metadata?.assertion_failures ?? 0}`,
          metadata: output?.metadata,
        }
      },
      async ({ metadata }) => ({
        name: "assertion_pass_rate",
        value:
          !metadata || metadata.assertion_count === 0
            ? Number(metadata?.turn_passed ?? 0)
            : (metadata.assertion_count - metadata.assertion_failures) / metadata.assertion_count,
      }),
      async ({ metadata }) => ({
        name: "scenario_expectation_score",
        value: metadata?.judge_score ?? 0,
      }),
      async ({ metadata }) => ({
        name: "groundedness",
        value: metadata?.rubric?.groundedness ?? 0,
      }),
      async ({ metadata }) => ({
        name: "recommendation_relevance",
        value: metadata?.rubric?.recommendation_relevance ?? 0,
      }),
      async ({ metadata }) => ({
        name: "clarification_quality",
        value: metadata?.rubric?.clarification_quality ?? 0,
      }),
      async ({ metadata }) => ({
        name: "overclaim_risk",
        value: metadata?.rubric?.overclaim_risk ?? 0,
      }),
      async ({ metadata }) => ({
        name: "turn_passed",
        value: metadata?.turn_passed ? 1 : 0,
        dataType: "BOOLEAN" as const,
      }),
    ],
    runEvaluators: [
      async ({ itemResults }) => {
        const qualityScores = itemResults
          .flatMap((result) => result.evaluations)
          .filter((evaluation) => evaluation.name === "internal_eval_quality")
          .map((evaluation) => (typeof evaluation.value === "number" ? evaluation.value : 0))

        return {
          name: "internal_eval_quality_average",
          value: average(qualityScores),
        }
      },
    ],
  })

  await langfuse.flush()

  return {
    experiment_id: experiment.experimentId,
    run_name: experiment.runName,
    dataset_run_id: experiment.datasetRunId,
    dataset_run_url: experiment.datasetRunUrl,
  }
}
