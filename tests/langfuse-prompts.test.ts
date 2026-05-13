import assert from "node:assert/strict"
import test from "node:test"

import { LANGFUSE_PROMPTS } from "../src/lib/langfuse/prompts"
import {
  AGENT_FINAL_RENDER_PROMPT,
  AGENT_ROUTE_CLASSIFIER_PROMPT,
  AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  AGENTIC_TOOL_LOOP_PROMPT,
} from "../src/lib/agent/orchestrator/prompt"

test("Langfuse prompt registry includes current agentic chat prompts", () => {
  assert.equal(LANGFUSE_PROMPTS.agentRouteClassifier.fallback, AGENT_ROUTE_CLASSIFIER_PROMPT)
  assert.equal(LANGFUSE_PROMPTS.agenticToolLoop.fallback, AGENTIC_TOOL_LOOP_PROMPT)
  assert.equal(
    LANGFUSE_PROMPTS.agenticContextualComposer.fallback,
    AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  )
  assert.equal(LANGFUSE_PROMPTS.agentFinalRender.fallback, AGENT_FINAL_RENDER_PROMPT)
})

test("Langfuse prompt names are unique", () => {
  const names = Object.values(LANGFUSE_PROMPTS).map((prompt) => prompt.name)

  assert.equal(new Set(names).size, names.length)
})
