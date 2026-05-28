import assert from "node:assert/strict"
import test from "node:test"

import { runCompareWithAdapters } from "../src/lib/agent/compare/run-compare"
import {
  AGENT_COMPARE_MULTI_TURN_CHAINS,
  AGENT_COMPARE_PROMPT_TEMPLATES,
} from "../src/lib/agent/compare/prompt-packs"
import { HELD_OUT_AGENT_COMPARE_TURNS } from "../src/lib/agent/compare/held-out-turns"
import { AGENT_COMPARE_SCENARIOS } from "../src/lib/agent/compare/scenarios"
import {
  AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS,
  DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT,
  resolveAgentCompareAnswerCompositionMode,
  resolveAgentCompareConsultationBriefOverride,
  shouldEnableAdvisorGuidanceTool,
} from "../src/lib/agent/compare/tool-loop-variants"
import type { AgentCompareScenario } from "../src/lib/agent/compare/types"

const scenario: AgentCompareScenario = {
  id: "test",
  label: "Test",
  message: "Original",
  hair_profile: { hair_texture: "wavy" },
}

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

test("runCompareWithAdapters uses the override prompt for both systems", async () => {
  const prompts: string[] = []
  const variants: Array<string | undefined> = []

  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    toolLoopVariant: "inline_context",
    runCurrent: async ({ prompt, toolLoopVariant }) => {
      prompts.push(`current:${prompt}`)
      variants.push(toolLoopVariant)
      return {
        system: "classic",
        answer: "current answer",
        latency_ms: 10,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
    runAgent: async ({ prompt, toolLoopVariant }) => {
      prompts.push(`agent:${prompt}`)
      variants.push(toolLoopVariant)
      return {
        system: "tool_loop",
        answer: "agent answer",
        latency_ms: 12,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
  })

  assert.deepEqual(prompts, ["current:Override", "agent:Override"])
  assert.deepEqual(variants, ["inline_context", "inline_context"])
  assert.equal(result.prompt, "Override")
  assert.equal(result.toolLoopVariant, "inline_context")
  assert.equal(result.results.length, 2)
})

test("runCompareWithAdapters resolves omitted tool-loop variant to product evaluation", async () => {
  const variants: Array<string | undefined> = []

  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    runCurrent: async ({ toolLoopVariant }) => {
      variants.push(toolLoopVariant)
      return {
        system: "classic",
        answer: "current answer",
        latency_ms: 10,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
    runAgent: async ({ toolLoopVariant }) => {
      variants.push(toolLoopVariant)
      return {
        system: "tool_loop",
        answer: "agent answer",
        latency_ms: 12,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
  })

  assert.deepEqual(variants, ["guidance_tool", "guidance_tool"])
  assert.equal(result.toolLoopVariant, "guidance_tool")
})

test("runCompareWithAdapters tolerates one-sided failures", async () => {
  const consultationBrief = {
    charter: ["Answer the current user delta first."],
    routine_staging: [],
    product_vs_education: [],
    profile_overlays: [],
    candidate_guidance: [
      { id: "topic:shampoo", kind: "topic", title: "Shampoo", content: "Shampoo guidance" },
    ],
  }
  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    runCurrent: async () => {
      throw new Error("current failed")
    },
    runAgent: async () => ({
      system: "tool_loop",
      answer: "agent answer",
      latency_ms: 12,
      debug_lines: ["tool: get_user_context"],
      matched_products: [],
      tool_loop_trace: {
        consultation_brief: consultationBrief,
        tool_calls: [{ name: "select_products" }],
      },
      error: null,
    }),
  })

  const current = result.results.find((entry) => entry.system === "classic")
  const agent = result.results.find((entry) => entry.system === "tool_loop")

  assert.equal(current?.error, "current failed")
  assert.equal(agent?.answer, "agent answer")
  assert.deepEqual(
    (agent?.tool_loop_trace as { consultation_brief?: unknown } | undefined)?.consultation_brief,
    consultationBrief,
  )
})

test("runCompareWithAdapters can run Tool Loop against AgentV2 without Classic", async () => {
  const systems: string[] = []

  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    systems: ["tool_loop", "agent_v2"],
    runCurrent: async () => {
      throw new Error("classic should not run")
    },
    runAgent: async () => {
      systems.push("tool_loop")
      return {
        system: "tool_loop",
        answer: "tool loop answer",
        latency_ms: 12,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
    runAgentV2: async () => {
      systems.push("agent_v2")
      return {
        system: "agent_v2",
        answer: "agent v2 answer",
        latency_ms: 15,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
  })

  assert.deepEqual(systems, ["tool_loop", "agent_v2"])
  assert.deepEqual(
    result.results.map((entry) => entry.system),
    ["tool_loop", "agent_v2"],
  )
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

test("held-out compare turns are explicitly marked unavailable until real testing data exists", () => {
  assert.deepEqual(HELD_OUT_AGENT_COMPARE_TURNS, [])
})

test("compare scenarios include leave-in heat and relationship cases with required profile signals", () => {
  const leaveInScenarios = AGENT_COMPARE_SCENARIOS.filter((entry) =>
    entry.id.startsWith("leave-in-"),
  )

  assert.deepEqual(
    leaveInScenarios.map((entry) => entry.id),
    [
      "leave-in-high-heat-protection",
      "leave-in-blow-dry-moderate",
      "leave-in-ingredient-unsupported",
      "leave-in-replacement-vs-booster",
    ],
  )

  const highHeat = leaveInScenarios.find((entry) => entry.id === "leave-in-high-heat-protection")
  assert.deepEqual(highHeat?.hair_profile.styling_tools, ["flat_iron"])
  assert.equal(highHeat?.hair_profile.uses_heat_protection, false)

  const moderateHeat = leaveInScenarios.find((entry) => entry.id === "leave-in-blow-dry-moderate")
  assert.deepEqual(moderateHeat?.hair_profile.styling_tools, ["blow_dryer"])
  assert.equal(moderateHeat?.hair_profile.uses_heat_protection, true)

  assert.ok(
    leaveInScenarios.every(
      (entry) =>
        entry.hair_profile.thickness &&
        entry.hair_profile.density &&
        entry.hair_profile.protein_moisture_balance &&
        entry.hair_profile.drying_method &&
        Array.isArray(entry.hair_profile.styling_tools) &&
        typeof entry.hair_profile.uses_heat_protection === "boolean",
    ),
  )
})

test("compare scenarios include care balance golden eval coverage", () => {
  const careBalanceScenarios = AGENT_COMPARE_SCENARIOS.filter((entry) =>
    entry.id.startsWith("care-balance-"),
  )

  assert.deepEqual(
    careBalanceScenarios.map((entry) => entry.id),
    [
      "care-balance-daily-oil-flat-buildup",
      "care-balance-missing-conditioner-dry-tangled",
      "care-balance-rare-conditioner-high-shampoo",
      "care-balance-blow-dryer-heat-protection",
      "care-balance-flat-iron-no-heat-protectant",
      "care-balance-hot-air-brush-thermal-rollers",
      "care-balance-deep-cleansing-vulnerable",
      "care-balance-daily-dry-shampoo-replacement",
      "care-balance-peeling-irritated-scalp",
      "care-balance-current-turn-correction",
    ],
  )

  const byId = new Map(careBalanceScenarios.map((entry) => [entry.id, entry]))
  const dailyOil = byId.get("care-balance-daily-oil-flat-buildup")
  assert.equal(
    dailyOil?.routine_inventory?.find((item) => item.category === "oil")?.frequency_range,
    "daily",
  )
  assert.ok(dailyOil?.hair_profile.concerns?.includes("oily_scalp"))
  assert.match(dailyOil?.message ?? "", /Oel|Build-up/i)

  const missingConditioner = byId.get("care-balance-missing-conditioner-dry-tangled")
  assert.equal(
    missingConditioner?.routine_inventory?.some((item) => item.category === "conditioner"),
    false,
  )
  assert.ok(missingConditioner?.hair_profile.concerns?.includes("dryness"))
  assert.ok(missingConditioner?.hair_profile.concerns?.includes("tangling"))

  const rareConditioner = byId.get("care-balance-rare-conditioner-high-shampoo")
  assert.equal(
    rareConditioner?.routine_inventory?.find((item) => item.category === "conditioner")
      ?.frequency_range,
    "1_2x",
  )
  assert.equal(
    rareConditioner?.routine_inventory?.find((item) => item.category === "shampoo")
      ?.frequency_range,
    "3_4x",
  )

  const blowDryerOnly = byId.get("care-balance-blow-dryer-heat-protection")
  assert.deepEqual(blowDryerOnly?.hair_profile.styling_tools, ["blow_dryer"])
  assert.equal(blowDryerOnly?.hair_profile.drying_method, "blow_dry")
  assert.equal(blowDryerOnly?.hair_profile.uses_heat_protection, false)

  const flatIron = byId.get("care-balance-flat-iron-no-heat-protectant")
  assert.deepEqual(flatIron?.hair_profile.styling_tools, ["flat_iron"])
  assert.equal(flatIron?.hair_profile.heat_styling, "several_weekly")
  assert.equal(flatIron?.hair_profile.uses_heat_protection, false)

  const indirectHeat = byId.get("care-balance-hot-air-brush-thermal-rollers")
  assert.deepEqual(indirectHeat?.hair_profile.styling_tools, ["hot_air_brush", "thermal_rollers"])

  const deepCleanse = byId.get("care-balance-deep-cleansing-vulnerable")
  assert.equal(
    deepCleanse?.routine_inventory?.find((item) => item.category === "deep_cleansing_shampoo")
      ?.frequency_range,
    "1_2x",
  )
  assert.equal(deepCleanse?.hair_profile.hair_texture, "curly")
  assert.ok(deepCleanse?.hair_profile.chemical_treatment?.includes("colored"))
  assert.ok(deepCleanse?.hair_profile.concerns?.includes("hair_damage"))

  const dryShampoo = byId.get("care-balance-daily-dry-shampoo-replacement")
  assert.equal(
    dryShampoo?.routine_inventory?.find((item) => item.category === "dry_shampoo")?.frequency_range,
    "daily",
  )
  assert.match(dryShampoo?.message ?? "", /statt Waschen|Waschen ersetzen/i)

  const peeling = byId.get("care-balance-peeling-irritated-scalp")
  assert.equal(peeling?.hair_profile.scalp_condition, "irritated")
  assert.ok(peeling?.routine_inventory?.some((item) => item.category === "peeling"))

  const correction = byId.get("care-balance-current-turn-correction")
  assert.equal(correction?.hair_profile.thickness, "coarse")
  assert.match(correction?.message ?? "", /Korrektur|eigentlich fein/i)
})
