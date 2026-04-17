/**
 * Chat Evaluation Harness — Entry Point
 *
 * Usage:
 *   npx tsx scripts/eval-chat/run.ts
 *   npx tsx scripts/eval-chat/run.ts --base-url https://hair-concierge.vercel.app
 *   npx tsx scripts/eval-chat/run.ts --scenario owc-followup
 *   npx tsx scripts/eval-chat/run.ts --skip-judge
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
} from "./client"
import { runMetadataAssertions, runContentAssertions } from "./assertions"
import { runJudge, runQualityRubric } from "./judge"
import { publishEvalExperiment } from "./langfuse"
import { buildReport, writeReport, printSummary } from "./report"
import type {
  ScenarioResult,
  TurnResult,
  AssertionResult,
  LangfuseExperimentSummary,
} from "./types"

// ── CLI args ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let baseUrl = "http://localhost:3000"
  let scenarioFilter: string | null = null
  let skipJudge = false
  let langfusePublish = process.env.LANGFUSE_EVAL_PUBLISH === "1"
  let langfuseRunName: string | null = null
  let langfuseExperimentName = "Hair Concierge Chat Eval"

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) {
      baseUrl = args[++i]
    } else if (args[i] === "--scenario" && args[i + 1]) {
      scenarioFilter = args[++i]
    } else if (args[i] === "--skip-judge") {
      skipJudge = true
    } else if (args[i] === "--langfuse-publish") {
      langfusePublish = true
    } else if (args[i] === "--langfuse-run-name" && args[i + 1]) {
      langfuseRunName = args[++i]
    } else if (args[i] === "--langfuse-experiment-name" && args[i + 1]) {
      langfuseExperimentName = args[++i]
    }
  }

  return {
    baseUrl,
    scenarioFilter,
    skipJudge,
    langfusePublish,
    langfuseRunName,
    langfuseExperimentName,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const {
    baseUrl,
    scenarioFilter,
    skipJudge,
    langfusePublish,
    langfuseRunName,
    langfuseExperimentName,
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

  const scenarios = scenarioFilter ? SCENARIOS.filter((s) => s.id === scenarioFilter) : SCENARIOS

  if (scenarios.length === 0) {
    console.error(`No scenario found with id "${scenarioFilter}"`)
    process.exit(1)
  }

  console.log(
    `Running ${scenarios.length} scenario(s) against ${baseUrl}${skipJudge ? " (skip judge)" : ""}`,
  )

  const results: ScenarioResult[] = []
  let langfuseExperiment: LangfuseExperimentSummary | null = null

  for (const scenario of scenarios) {
    console.log(`\n--- ${scenario.id}: ${scenario.name} ---`)

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
        console.log(`  Turn ${i + 1}: "${turn.message.slice(0, 60)}..."`)

        const sse = await sendMessage(
          baseUrl,
          session.cookie,
          turn.message,
          conversationId ?? undefined,
        )

        if (sse.error) {
          console.log(`    ERROR: ${sse.error.slice(0, 200)}`)
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

        console.log(
          `    ${allPassed ? "PASS" : "FAIL"} (${assertions.length - failCount}/${assertions.length} assertions)` +
            ` [${sse.latency_ms}ms]`,
        )

        if (!allPassed) {
          for (const f of assertions.filter((a) => !a.passed)) {
            console.log(`      [${f.tier}] ${f.name}: expected ${f.expected}, got ${f.actual}`)
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
      results.push({
        id: scenario.id,
        name: scenario.name,
        passed: scenarioPassed,
        turns: turnResults,
      })
    } finally {
      await session.cleanup()
    }
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

  process.exit(report.summary.failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(2)
})
