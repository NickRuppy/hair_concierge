/**
 * Chat Evaluation Harness — Entry Point
 *
 * Usage:
 *   npx tsx scripts/eval-chat/run.ts
 *   npx tsx scripts/eval-chat/run.ts --base-url https://chaarlie.de
 *   npx tsx scripts/eval-chat/run.ts --scenario owc-followup
 *   npx tsx scripts/eval-chat/run.ts --ci-smoke
 *   npx tsx scripts/eval-chat/run.ts --skip-judge
 *   npx tsx scripts/eval-chat/run.ts --ci-smoke --concurrency 2
 */

import fs from "fs"
import path from "path"

// ── Load .env.local (same pattern as eval-retrieval.ts) ──────────────────
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }
}

import { SCENARIOS } from "./fixtures"
import {
  createTestSession,
  upsertHairProfile,
  sendMessage,
  fetchLatestAssistantMessage,
  fetchConversationTurnTrace,
} from "./client"
import { runMetadataAssertions, runContentAssertions } from "./assertions"
import { runJudge, runQualityRubric } from "./judge"
import { publishEvalExperiment } from "./langfuse"
import { buildReport, writeReport, printSummary, countHardAssertionFailures } from "./report"
import {
  buildFailedTurnDebugArtifact,
  fetchEvalServerInfo,
  writeFailedTurnDebugArtifact,
  type EvalServerInfo,
} from "./debug-artifacts"
import { mapWithConcurrency } from "./concurrency"
import type {
  ScenarioResult,
  TurnResult,
  AssertionResult,
  LangfuseExperimentSummary,
  EvalScenario,
} from "./types"

// ── CLI args ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let baseUrl = "http://localhost:3000"
  let scenarioFilter: string | null = null
  let ciSmoke = false
  let skipJudge = false
  let langfusePublish = process.env.LANGFUSE_EVAL_PUBLISH === "1"
  let langfuseRunName: string | null = null
  let langfuseExperimentName = "Chaarlie Chat Eval"
  let concurrency = Number(process.env.CHAT_EVAL_CONCURRENCY ?? "1")

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) {
      baseUrl = args[++i]
    } else if (args[i] === "--scenario" && args[i + 1]) {
      scenarioFilter = args[++i]
    } else if (args[i] === "--ci-smoke") {
      ciSmoke = true
    } else if (args[i] === "--skip-judge") {
      skipJudge = true
    } else if (args[i] === "--langfuse-publish") {
      langfusePublish = true
    } else if (args[i] === "--langfuse-run-name" && args[i + 1]) {
      langfuseRunName = args[++i]
    } else if (args[i] === "--langfuse-experiment-name" && args[i + 1]) {
      langfuseExperimentName = args[++i]
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = Number(args[++i])
    }
  }

  if (!Number.isFinite(concurrency) || concurrency < 1) {
    concurrency = 1
  }

  return {
    baseUrl,
    scenarioFilter,
    ciSmoke,
    skipJudge,
    langfusePublish,
    langfuseRunName,
    langfuseExperimentName,
    concurrency: Math.floor(concurrency),
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function runScenario(params: {
  scenario: EvalScenario
  baseUrl: string
  supabaseUrl: string
  serviceRoleKey: string
  anonKey: string
  skipJudge: boolean
  serverInfo: EvalServerInfo
}): Promise<{ result: ScenarioResult; debugArtifactPaths: string[]; logs: string[] }> {
  const { scenario, baseUrl, supabaseUrl, serviceRoleKey, anonKey, skipJudge, serverInfo } = params
  const logs: string[] = [`\n--- ${scenario.id}: ${scenario.name} ---`]
  const debugArtifactPaths: string[] = []
  const log = (line: string) => logs.push(line)

  // Fresh user per scenario (isolates state)
  const session = await createTestSession(supabaseUrl, serviceRoleKey, anonKey)

  try {
    await upsertHairProfile(
      session.admin,
      session.userId,
      scenario.hair_profile,
      scenario.routine_inventory ?? [],
    )

    let conversationId: string | null = null
    const turnResults: TurnResult[] = []
    const conversationHistory: string[] = []

    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i]
      log(`  Turn ${i + 1}: "${turn.message.slice(0, 60)}..."`)

      const sse = await sendMessage(
        baseUrl,
        session.cookie,
        turn.message,
        conversationId ?? undefined,
      )

      if (sse.error) {
        log(`    ERROR: ${sse.error.slice(0, 200)}`)
      }

      // Track conversation ID for multi-turn
      if (sse.conversation_id) {
        conversationId = sse.conversation_id
      }

      // Run assertions
      const assertions: AssertionResult[] = []

      if (turn.metadata) {
        assertions.push(...runMetadataAssertions(sse, turn.metadata))
      }

      if (turn.content) {
        assertions.push(...runContentAssertions(sse, turn.content))
      }

      // DB persistence check (verify rag_context is persisted)
      if (conversationId && sse.content.length > 0) {
        // Small delay to let async persistence complete
        await new Promise((r) => setTimeout(r, 1000))
        const dbMsg = await fetchLatestAssistantMessage(session.admin, conversationId)
        if (dbMsg) {
          const dbSourceCount = dbMsg.rag_context?.sources
            ? (dbMsg.rag_context.sources as unknown[]).length
            : 0
          assertions.push({
            tier: "db",
            name: "message_persisted",
            passed: dbMsg.content !== null && dbMsg.content.length > 0,
            expected: "assistant message persisted",
            actual: dbMsg.content ? `${dbMsg.content.length} chars` : "null",
          })
          assertions.push({
            tier: "db",
            name: "rag_context_persisted",
            passed:
              dbSourceCount === sse.sources.length ||
              (sse.sources.length === 0 && dbSourceCount === 0),
            expected: `${sse.sources.length} sources`,
            actual: `${dbSourceCount} sources`,
          })
        }
      }

      // LLM judge
      let judgeResult = null
      if (turn.judge && !skipJudge) {
        judgeResult = await runJudge(
          turn.message,
          sse,
          turn.judge,
          scenario.hair_profile,
          scenario.routine_inventory,
          conversationHistory.length > 0 ? conversationHistory.join("\n") : undefined,
        )

        assertions.push({
          tier: "judge",
          name: "llm_judge",
          passed: judgeResult.verdict === "pass",
          expected: "pass",
          actual: `${judgeResult.verdict} (${judgeResult.score.toFixed(2)})`,
        })
      }

      const qualityRubric = skipJudge
        ? null
        : await runQualityRubric(
            turn.message,
            sse,
            scenario.hair_profile,
            scenario.routine_inventory,
            conversationHistory.length > 0 ? conversationHistory.join("\n") : undefined,
          )

      const allPassed = assertions.every((a) => a.passed)
      const failCount = assertions.filter((a) => !a.passed).length

      log(
        `    ${allPassed ? "PASS" : "FAIL"} (${assertions.length - failCount}/${assertions.length} assertions)` +
          ` [${sse.latency_ms}ms]`,
      )

      if (!allPassed) {
        for (const f of assertions.filter((a) => !a.passed)) {
          log(
            `      [${f.severity ?? "hard"}][${f.tier}] ${f.name}: expected ${f.expected}, got ${f.actual}`,
          )
        }
        try {
          const traceLookup = await fetchConversationTurnTrace(session.admin, {
            assistantMessageId: sse.assistant_message_id,
            conversationId,
          })
          const artifact = buildFailedTurnDebugArtifact({
            baseUrl,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            turnIndex: i + 1,
            message: turn.message,
            sseResult: sse,
            assertions,
            serverInfo,
            traceRow: traceLookup.traceRow,
            traceError: traceLookup.error,
          })
          const artifactPath = writeFailedTurnDebugArtifact(artifact)
          debugArtifactPaths.push(artifactPath)
          log(`      Debug artifact: ${artifactPath}`)
        } catch (error) {
          log(
            `      Debug artifact failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      turnResults.push({
        turn_index: i + 1,
        message: turn.message,
        sse_result: sse,
        assertions,
        judge_result: judgeResult,
        quality_rubric: qualityRubric,
        all_passed: allPassed,
      })

      // Build conversation context for judge
      conversationHistory.push(`Nutzer: ${turn.message}`)
      if (sse.content) {
        conversationHistory.push(`Assistent: ${sse.content.slice(0, 200)}`)
      }
    }

    const scenarioPassed = turnResults.every((t) => t.all_passed)
    return {
      result: {
        id: scenario.id,
        name: scenario.name,
        passed: scenarioPassed,
        turns: turnResults,
      },
      debugArtifactPaths,
      logs,
    }
  } finally {
    await session.cleanup()
  }
}

async function main() {
  const {
    baseUrl,
    scenarioFilter,
    ciSmoke,
    skipJudge,
    langfusePublish,
    langfuseRunName,
    langfuseExperimentName,
    concurrency,
  } = parseArgs()
  const startTime = Date.now()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
    process.exit(1)
  }

  const scenarios = scenarioFilter
    ? SCENARIOS.filter((s) => s.id === scenarioFilter)
    : ciSmoke
      ? SCENARIOS.filter((s) => s.ci_smoke)
      : SCENARIOS

  if (scenarios.length === 0) {
    console.error(`No scenario found with id "${scenarioFilter}"`)
    process.exit(1)
  }

  console.log(
    `Running ${scenarios.length} scenario(s) against ${baseUrl}${skipJudge ? " (skip judge)" : ""} with concurrency ${concurrency}`,
  )
  const serverInfo = await fetchEvalServerInfo(baseUrl)
  if (serverInfo.available) {
    console.log(
      `Server debug: ${serverInfo.git_sha?.slice(0, 8) ?? "unknown"} on ${
        serverInfo.git_branch ?? "unknown"
      }${serverInfo.git_dirty ? " (dirty)" : ""}, started ${
        serverInfo.server_started_at ?? "unknown"
      }`,
    )
  } else {
    console.log(`Server debug: unavailable (${serverInfo.error})`)
  }

  const debugArtifactPaths: string[] = []
  let langfuseExperiment: LangfuseExperimentSummary | null = null

  const scenarioRuns = await mapWithConcurrency(scenarios, concurrency, (scenario) =>
    runScenario({
      scenario,
      baseUrl,
      supabaseUrl,
      serviceRoleKey,
      anonKey,
      skipJudge,
      serverInfo,
    }),
  )
  const results = scenarioRuns.map((run) => run.result)
  for (const run of scenarioRuns) {
    console.log(run.logs.join("\n"))
    debugArtifactPaths.push(...run.debugArtifactPaths)
  }

  if (langfusePublish) {
    try {
      langfuseExperiment = await publishEvalExperiment({
        baseUrl,
        scenarios,
        results,
        skipJudge,
        experimentName: langfuseExperimentName,
        runName: langfuseRunName ?? undefined,
      })
      console.log(
        `Langfuse experiment published: ${langfuseExperiment.run_name} (${langfuseExperiment.experiment_id})`,
      )
      if (langfuseExperiment.dataset_run_url) {
        console.log(`Langfuse URL: ${langfuseExperiment.dataset_run_url}`)
      }
    } catch (error) {
      console.error(
        `Failed to publish Langfuse experiment: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Write report
  const report = buildReport(results, baseUrl, startTime, langfuseExperiment)
  const reportPath = writeReport(report)
  printSummary(report)
  console.log(`Report: ${reportPath}`)
  if (debugArtifactPaths.length > 0) {
    console.log("Debug artifacts:")
    for (const artifactPath of debugArtifactPaths) {
      console.log(`  ${artifactPath}`)
    }
  }

  const hardFailures = countHardAssertionFailures(results)

  if (ciSmoke) {
    process.exit(hardFailures > 0 ? 1 : 0)
  } else if (report.summary.failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(2)
})
