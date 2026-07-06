import assert from "node:assert/strict"
import test from "node:test"

import { buildFailedTurnDebugArtifact } from "../scripts/eval-chat/debug-artifacts"
import type { AssertionResult, SSEResult } from "../scripts/eval-chat/types"

const failedAssertion: AssertionResult = {
  tier: "metadata",
  name: "response_mode",
  passed: false,
  expected: "answer_direct",
  actual: "clarify_only",
}

const sseResult: SSEResult = {
  conversation_id: "conversation_1",
  assistant_message_id: "assistant_1",
  langfuse_trace_id: "trace_1",
  langfuse_trace_url: "https://example.com/trace_1",
  content: "Ich bin mir gerade nicht sicher, was du genau möchtest.",
  done_data: {
    response_mode: "clarify_only",
    policy_overrides: ["agent_v2", "visible_failure"],
  },
  sources: [],
  products: [],
  error: null,
  latency_ms: 1234,
}

test("buildFailedTurnDebugArtifact snapshots sanitized AgentV2 failure details", () => {
  const artifact = buildFailedTurnDebugArtifact({
    baseUrl: "http://localhost:3589",
    scenarioId: "shampoo-recommend-and-refine",
    scenarioName: "Shampoo request",
    turnIndex: 1,
    message: "Ich brauche ein Shampoo",
    sseResult,
    assertions: [failedAssertion],
    serverInfo: {
      available: true,
      base_url: "http://localhost:3589",
      git_sha: "abc123",
      git_branch: "codex/test",
      git_dirty: true,
      server_started_at: "2026-06-18T08:00:00.000Z",
    },
    traceRow: {
      status: "failed",
      trace: {
        prompt_refs: {
          synthesis: {
            name: "chaarlie-agent-v2-responses-care-balance",
            version: null,
            label: "staging",
            is_fallback: true,
          },
        },
        router_decision: {
          retrieval_mode: "agent_v2_responses",
          response_mode: "clarify_only",
          policy_overrides: ["agent_v2", "visible_failure"],
        },
        decision_context: {
          matched_products: [],
          category_decision: null,
        },
        agent_v2_trace: {
          failure_stage: "repair_failed",
          followup_offer: {
            type: "recommend",
            label_de: "Ich kann dir passende Shampoos empfehlen.",
          },
          followup_offer_execution: "product_selection",
          followup_offer_resolution: "resolved",
          loaded_guidance_package_ids: ["base.product_recommendation.v1"],
          validation_errors: [
            {
              validator_id: "request_interpretation_evidence",
              reason_code: "evidence_quote_too_short_or_generic",
              message: "Evidence quote is too short.",
              suggested_value: "Ich brauche ein Shampoo",
            },
          ],
          validation_warnings: [],
          repair_attempts: [
            {
              reason: "terminal_answer_validation",
              validation_errors: [{ validator_id: "request_interpretation_evidence" }],
            },
          ],
          blocked_tool_calls: [{ name: "submit_final_answer", reason: "invalid_json" }],
          tool_calls: [
            {
              name: "select_products",
              arguments: { category: "shampoo", verbose: "x".repeat(800) },
              output_summary: { product_count: 3 },
            },
          ],
          model_steps: [{ raw: "large model payload that must not be copied" }],
        },
      },
    },
  })

  assert.equal(artifact.scenario_id, "shampoo-recommend-and-refine")
  assert.equal(artifact.visible_reply, sseResult.content)
  assert.equal(artifact.server.available, true)
  assert.equal(artifact.server.git_sha, "abc123")
  assert.equal(artifact.trace_error, null)
  assert.equal(artifact.prompt?.source, "fallback")
  assert.equal(artifact.agent_v2?.failure_stage, "repair_failed")
  assert.deepEqual(artifact.agent_v2?.loaded_guidance_package_ids, [
    "base.product_recommendation.v1",
  ])
  assert.equal(
    (artifact.agent_v2?.validation_errors[0] as Record<string, unknown>)?.reason_code,
    "evidence_quote_too_short_or_generic",
  )
  assert.deepEqual(
    (artifact.agent_v2?.repair_attempts[0] as Record<string, unknown>)?.["validation_errors"],
    [{ validator_id: "request_interpretation_evidence" }],
  )
  assert.equal(artifact.agent_v2?.followup_offer_type, "recommend")
  assert.equal(artifact.agent_v2?.followup_offer_execution, "product_selection")
  assert.equal(artifact.agent_v2?.followup_offer_resolution, "resolved")
  assert.equal(
    (artifact.agent_v2?.tool_calls[0] as Record<string, unknown>)?.name,
    "select_products",
  )
  assert.equal(
    JSON.stringify(artifact).includes("large model payload that must not be copied"),
    false,
  )
})

test("buildFailedTurnDebugArtifact records unavailable server debug info", () => {
  const artifact = buildFailedTurnDebugArtifact({
    baseUrl: "https://example.com",
    scenarioId: "oil-missing-profile",
    scenarioName: "Oil request",
    turnIndex: 1,
    message: "Welches Haaröl passt zu mir?",
    sseResult,
    assertions: [failedAssertion],
    serverInfo: {
      available: false,
      base_url: "https://example.com",
      status: 404,
      error: "debug endpoint unavailable",
    },
    traceRow: null,
    traceError: "permission denied for table conversation_turn_traces",
  })

  assert.equal(artifact.server.available, false)
  assert.equal(artifact.server.status, 404)
  assert.equal(artifact.trace_available, false)
  assert.equal(artifact.trace_error, "permission denied for table conversation_turn_traces")
  assert.equal(artifact.agent_v2, null)
})
