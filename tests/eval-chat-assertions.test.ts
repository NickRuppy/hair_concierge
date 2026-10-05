import assert from "node:assert/strict"
import test from "node:test"

import { runContentAssertions } from "../scripts/eval-chat/assertions"
import { SCENARIOS } from "../scripts/eval-chat/fixtures"
import type { SSEResult } from "../scripts/eval-chat/types"

function contentResult(content: string): SSEResult {
  return {
    conversation_id: null,
    assistant_message_id: null,
    langfuse_trace_id: null,
    langfuse_trace_url: null,
    content,
    done_data: null,
    products: [],
    error: null,
    latency_ms: 0,
  }
}

function fixtureContent(id: string) {
  const scenario = SCENARIOS.find((item) => item.id === id)
  assert.ok(scenario, `missing ${id} fixture`)
  const content = scenario.turns[0]?.content
  assert.ok(content, `missing ${id} content assertions`)
  return content
}

test("bondbuilder fixture accepts its captured bounded repair disclaimer", () => {
  const results = runContentAssertions(
    contentResult("Pflege kann sie glätten, aber nicht dauerhaft reparieren."),
    fixtureContent("goal-bondbuilder-damage-fit"),
  )

  const forbiddenClaims = results.find((result) => result.name === "forbidden_claims")
  assert.equal(forbiddenClaims?.passed, true, JSON.stringify(results))
})

test("tangling fixture accepts Partien as a sectioning synonym", () => {
  const results = runContentAssertions(
    contentResult("Teile die Haare noch nass in 3–6 Partien."),
    fixtureContent("concern-tangling-german-wording"),
  )

  const requiredKeywords = results.find((result) => result.name === "required_keywords")
  assert.equal(requiredKeywords?.passed, true, JSON.stringify(results))
})

test("bondbuilder forbidden claims allow only immediate, single local negation", () => {
  const expected = fixtureContent("goal-bondbuilder-damage-fit")
  const cases = [
    ["Pflege kann sie glätten, aber nicht dauerhaft reparieren.", true],
    ["Es kann nur nicht dauerhaft reparieren.", true],
    ["Es heilt nicht.", true],
    ["Pflege kann sie NICHT dauerhaft\nreparieren.", true],
    ["Dieses Produkt kann dauerhaft reparieren.", false],
    ["Pflege kann nicht dauerhaft reparieren. Dieses Produkt kann dauerhaft reparieren.", false],
    ["Pflege hilft nicht bei Frizz, kann aber dauerhaft reparieren.", false],
    ["Es kann nicht nur dauerhaft reparieren.", false],
    ["Es kann nicht nicht dauerhaft reparieren.", false],
    ["Es heilt nicht nur, es pflegt.", false],
    ["Eine Narbe verheilt langsam.", true],
  ] as const

  for (const [content, passes] of cases) {
    const result = runContentAssertions(contentResult(content), expected).find(
      (assertion) => assertion.name === "forbidden_claims",
    )
    assert.equal(result?.passed, passes, `${content}: ${JSON.stringify(result)}`)
  }
})

test("literal forbidden keywords still reject negated occurrences exactly", () => {
  const result = runContentAssertions(contentResult("Pflege kann nicht dauerhaft reparieren."), {
    forbidden_keywords: ["dauerhaft reparieren"],
  }).find((assertion) => assertion.name === "forbidden_keywords")

  assert.equal(result?.passed, false)
})
