import assert from "node:assert/strict"
import test from "node:test"

import { buildReport, countHardAssertionFailures } from "../scripts/eval-chat/report"
import type { ScenarioResult, SSEResult } from "../scripts/eval-chat/types"

const emptySseResult: SSEResult = {
  conversation_id: null,
  assistant_message_id: null,
  langfuse_trace_id: null,
  langfuse_trace_url: null,
  content: "",
  done_data: null,
  sources: [],
  products: [],
  error: null,
  latency_ms: 0,
}

test("buildReport separates hard and soft assertion failures", () => {
  const scenarios: ScenarioResult[] = [
    {
      id: "soft-only",
      name: "Soft only",
      passed: false,
      turns: [
        {
          turn_index: 1,
          message: "Hallo",
          sse_result: emptySseResult,
          assertions: [
            {
              tier: "content",
              name: "must_be_german",
              passed: false,
              severity: "soft",
              expected: ">=3 German markers",
              actual: "1 marker",
            },
            {
              tier: "metadata",
              name: "intent",
              passed: false,
              expected: "recommendation",
              actual: "general_chat",
            },
          ],
          judge_result: null,
          quality_rubric: null,
          all_passed: false,
        },
      ],
    },
  ]

  const report = buildReport(scenarios, "http://localhost:3000", Date.now())

  assert.equal(report.summary.assertion_failures, 2)
  assert.equal(report.summary.hard_assertion_failures, 1)
  assert.equal(report.summary.soft_assertion_failures, 1)
  assert.equal(countHardAssertionFailures(scenarios), 1)
})
