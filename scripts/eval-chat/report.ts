/**
 * Chat Evaluation Harness — Report Writer
 */

import fs from "fs"
import path from "path"
import type { EvalReport, ScenarioResult } from "./types"

export function buildReport(
  scenarios: ScenarioResult[],
  baseUrl: string,
  startTime: number,
): EvalReport {
  const totalAssertions = scenarios.reduce(
    (sum, s) => sum + s.turns.reduce((ts, t) => ts + t.assertions.length, 0),
    0,
  )
  const assertionFailures = scenarios.reduce(
    (sum, s) =>
      sum + s.turns.reduce((ts, t) => ts + t.assertions.filter((a) => !a.passed).length, 0),
    0,
  )

  return {
    timestamp: new Date().toISOString(),
    base_url: baseUrl,
    duration_ms: Date.now() - startTime,
    summary: {
      total_scenarios: scenarios.length,
      passed: scenarios.filter((s) => s.passed).length,
      failed: scenarios.filter((s) => !s.passed).length,
      total_assertions: totalAssertions,
      assertion_failures: assertionFailures,
    },
    scenarios,
  }
}

export function writeReport(report: EvalReport): string {
  const dir = path.join(process.cwd(), "test-results", "chat-eval")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const filePath = path.join(dir, `chat-eval-${timestamp}.json`)
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2))
  return filePath
}

export function printSummary(report: EvalReport): void {
  const { summary, scenarios } = report

  console.log("")
  console.log(
    `Chat Eval: ${summary.passed}/${summary.total_scenarios} passed` +
      (summary.failed > 0 ? ` (${summary.failed} failed)` : ""),
  )
  console.log(
    `  Assertions: ${summary.total_assertions - summary.assertion_failures}/${summary.total_assertions} passed`,
  )
  console.log(`  Duration: ${(report.duration_ms / 1000).toFixed(1)}s`)
  console.log("")

  for (const scenario of scenarios) {
    const icon = scenario.passed ? "  PASS" : "  FAIL"
    console.log(`${icon}  ${scenario.id} — ${scenario.name}`)

    if (!scenario.passed) {
      for (const turn of scenario.turns) {
        const failures = turn.assertions.filter((a) => !a.passed)
        for (const f of failures) {
          console.log(
            `        turn ${turn.turn_index}: [${f.tier}] ${f.name} — expected: ${f.expected}, got: ${f.actual}`,
          )
        }
        if (turn.judge_result && turn.judge_result.verdict === "fail") {
          console.log(`        turn ${turn.turn_index}: [judge] ${turn.judge_result.reasoning}`)
          for (const issue of turn.judge_result.issues) {
            console.log(`          - ${issue}`)
          }
        }
      }
    }
  }

  console.log("")
}
