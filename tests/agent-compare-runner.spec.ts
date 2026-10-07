import assert from "node:assert/strict"
import test from "node:test"
import {
  AGENT_COMPARE_MULTI_TURN_CHAINS,
  AGENT_COMPARE_PROMPT_TEMPLATES,
} from "../src/lib/agent/compare/prompt-packs"
import {
  AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS,
  DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT,
  resolveAgentCompareAnswerCompositionMode,
  resolveAgentCompareConsultationBriefOverride,
  resolveAgentCompareToolLoopVariant,
  shouldEnableAdvisorGuidanceTool,
} from "../src/lib/agent/compare/tool-loop-variants"

test("compare lab presents product evaluation as the recommended mode", () => {
  assert.equal(DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT, "guidance_tool")
  assert.deepEqual(AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS, [
    { value: "guidance_tool", label: "Produkt-Evaluation (Legacy)" },
    { value: "inline_context", label: "Beratungsbrief (Legacy)" },
    { value: "composer_context", label: "Composer-Kontext (Legacy)" },
    { value: "baseline", label: "Baseline ohne Zusatzkontext" },
  ])
})

test("tool-loop variants resolve runtime context behavior explicitly", () => {
  assert.equal(resolveAgentCompareToolLoopVariant(undefined), "guidance_tool")
  assert.equal(resolveAgentCompareToolLoopVariant("baseline"), "baseline")
  assert.equal(resolveAgentCompareAnswerCompositionMode("guidance_tool"), "inline_context")
  assert.equal(resolveAgentCompareConsultationBriefOverride("guidance_tool"), undefined)
  assert.equal(shouldEnableAdvisorGuidanceTool("guidance_tool"), true)
  assert.equal(resolveAgentCompareAnswerCompositionMode("inline_context"), "inline_context")
  assert.equal(resolveAgentCompareConsultationBriefOverride("inline_context"), undefined)
  assert.equal(shouldEnableAdvisorGuidanceTool("inline_context"), false)
  assert.equal(resolveAgentCompareAnswerCompositionMode("composer_context"), "composer_context")
  assert.equal(resolveAgentCompareConsultationBriefOverride("composer_context"), undefined)
  assert.equal(shouldEnableAdvisorGuidanceTool("composer_context"), false)
  assert.equal(resolveAgentCompareAnswerCompositionMode("baseline"), undefined)
  assert.equal(resolveAgentCompareConsultationBriefOverride("baseline"), null)
  assert.equal(shouldEnableAdvisorGuidanceTool("baseline"), false)
})

test("compare prompt packs include crafted multi-turn chains with failure coverage", () => {
  assert.deepEqual(
    AGENT_COMPARE_MULTI_TURN_CHAINS.map((chain) => chain.id),
    [
      "routine-to-typoed-shampoo",
      "leave-in-lighter-usage",
      "routine-simplify-mask-conditioner-summary",
      "dry-shampoo-bridge-usage",
      "peeling-sensitive-scalp",
      "deep-cleansing-vs-shampoo",
      "bondbuilder-explain-followup",
      "oil-use-case-comparison",
      "routine-add-on-full-spectrum",
      "agent-v2-review-routine-first-extra-product",
      "agent-v2-review-previous-offer-reference",
    ],
  )

  const shampooChain = AGENT_COMPARE_MULTI_TURN_CHAINS[0]
  assert.deepEqual(shampooChain.failure_classes, [
    "semantic_state_conflict",
    "tool_not_called",
    "category_switch",
  ])
  assert.match(shampooChain.turns[1], /welcges Shampoo/i)

  const parityChains = AGENT_COMPARE_MULTI_TURN_CHAINS.slice(3, 9)
  assert.deepEqual(
    parityChains.map((chain) => chain.id),
    [
      "dry-shampoo-bridge-usage",
      "peeling-sensitive-scalp",
      "deep-cleansing-vs-shampoo",
      "bondbuilder-explain-followup",
      "oil-use-case-comparison",
      "routine-add-on-full-spectrum",
    ],
  )
  assert.ok(
    parityChains.every(
      (chain) =>
        chain.failure_classes.includes("category_guidance_scope") ||
        chain.failure_classes.includes("category_comparison") ||
        chain.failure_classes.includes("routine_category_overview"),
    ),
  )

  assert.ok(
    parityChains.every((chain) => chain.turns.length >= 3 && chain.failure_classes.length > 0),
  )
  assert.deepEqual(
    AGENT_COMPARE_MULTI_TURN_CHAINS.slice(9).map((chain) => chain.id),
    ["agent-v2-review-routine-first-extra-product", "agent-v2-review-previous-offer-reference"],
  )
  assert.ok(
    AGENT_COMPARE_MULTI_TURN_CHAINS.slice(9).every(
      (chain) => chain.turns.length >= 2 && chain.failure_classes.length > 0,
    ),
  )
})

test("crafted compare prompts include the agentic tool-loop seed cases", () => {
  const ids = AGENT_COMPARE_PROMPT_TEMPLATES.map((template) => template.id)

  assert.ok(ids.includes("tool-loop-typoed-shampoo"))
  assert.ok(ids.includes("tool-loop-pronoun-followup"))
  assert.ok(ids.includes("tool-loop-topic-pivot"))
})
