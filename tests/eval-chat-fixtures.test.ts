import assert from "node:assert/strict"
import test from "node:test"

import { SCENARIOS } from "../scripts/eval-chat/fixtures"

test("chat eval fixtures include a CI-smoke short-confirmation follow-up scenario", () => {
  const scenario = SCENARIOS.find((item) => item.id === "leave-in-offer-confirmation")

  assert.ok(scenario)
  assert.equal(scenario.ci_smoke, true)
  assert.equal(scenario.turns.length, 2)
  assert.match(scenario.turns[0]?.message ?? "", /Leave-in gegen Frizz/)
  assert.equal(scenario.turns[1]?.message, "Ja bitte")
  assert.equal(scenario.turns[0]?.metadata?.product_count_min, 1)
  assert.ok(scenario.turns[0]?.content?.required_keywords?.includes("anwende"))
  assert.ok(
    scenario.turns[1]?.content?.forbidden_keywords?.some((keyword) =>
      keyword.includes("nicht sicher"),
    ),
  )
})

test("chat eval fixtures keep representative multi-turn runtime prompts", () => {
  const multiTurnIds = SCENARIOS.filter((scenario) => scenario.turns.length > 1).map(
    (scenario) => scenario.id,
  )

  assert.deepEqual(
    new Set(multiTurnIds),
    new Set([
      "owc-followup",
      "leave-in-offer-confirmation",
      "followup-offer-recommend-confirmation",
      "followup-offer-compare-confirmation",
      "followup-offer-plan-confirmation",
      "followup-offer-adjust-confirmation",
      "followup-offer-troubleshoot-confirmation",
      "followup-offer-missing-contextual-clarification",
      "followup-offer-cleared-contextual-clarification",
      "routine-summary-followup",
      "explicit-branch-followup",
      "clarification-cap",
    ]),
  )
})

test("chat eval fixtures include representative follow-up offer scenarios", () => {
  const ids = new Set(SCENARIOS.map((scenario) => scenario.id))

  for (const id of [
    "followup-offer-recommend-confirmation",
    "followup-offer-compare-confirmation",
    "followup-offer-plan-confirmation",
    "followup-offer-adjust-confirmation",
    "followup-offer-troubleshoot-confirmation",
    "followup-offer-missing-contextual-clarification",
    "followup-offer-cleared-contextual-clarification",
  ]) {
    assert.equal(ids.has(id), true, `${id} missing`)
  }
})
