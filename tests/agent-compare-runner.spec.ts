import assert from "node:assert/strict"
import test from "node:test"

import { runCompareWithAdapters } from "../src/lib/agent/compare/run-compare"
import { AGENT_COMPARE_SCENARIOS } from "../src/lib/agent/compare/scenarios"
import type { AgentCompareScenario } from "../src/lib/agent/compare/types"

const scenario: AgentCompareScenario = {
  id: "test",
  label: "Test",
  message: "Original",
  hair_profile: { hair_texture: "wavy" },
}

test("runCompareWithAdapters uses the override prompt for both systems", async () => {
  const prompts: string[] = []

  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    runCurrent: async ({ prompt }) => {
      prompts.push(`current:${prompt}`)
      return {
        system: "current",
        answer: "current answer",
        latency_ms: 10,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
    runAgent: async ({ prompt }) => {
      prompts.push(`agent:${prompt}`)
      return {
        system: "agent",
        answer: "agent answer",
        latency_ms: 12,
        debug_lines: [],
        matched_products: [],
        error: null,
      }
    },
  })

  assert.deepEqual(prompts, ["current:Override", "agent:Override"])
  assert.equal(result.prompt, "Override")
  assert.equal(result.results.length, 2)
})

test("runCompareWithAdapters tolerates one-sided failures", async () => {
  const result = await runCompareWithAdapters({
    scenario,
    prompt: "Override",
    runCurrent: async () => {
      throw new Error("current failed")
    },
    runAgent: async () => ({
      system: "agent",
      answer: "agent answer",
      latency_ms: 12,
      debug_lines: ["tool: get_user_context"],
      matched_products: [],
      error: null,
    }),
  })

  const current = result.results.find((entry) => entry.system === "current")
  const agent = result.results.find((entry) => entry.system === "agent")

  assert.equal(current?.error, "current failed")
  assert.equal(agent?.answer, "agent answer")
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
