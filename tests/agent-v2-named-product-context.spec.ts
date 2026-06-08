import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAgentV2NamedProductContext,
  normalizeNamedProductForComparison,
} from "../src/lib/agent-v2/named-product-context"

test("detects exact Urban Alchemy conditioner name from latest user message", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Moisture Mist Conditioner von Urban Alchemy",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
})

test("detects named product from a fuller product-detail question", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage:
      "Ich nutze gerade von Urban Alchemy den Conditioner Moisture Mist, was haelst du von dem fuer meine Haare?",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
})

test("detects named product from common what-do-you-think wording", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Was haelst du von Urban Alchemy Moisture Mist Conditioner?",
    recentMessages: [],
  })

  assert.equal(context?.plausible_exact_name, true)
  assert.equal(context?.category, "conditioner")
  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
})

test("detects quoted named product with category signal", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: 'Was haelst du vom Conditioner "Moisture Mist" von Urban Alchemy?',
    recentMessages: [],
  })

  assert.equal(context?.display_name, "Urban Alchemy Moisture Mist Conditioner")
})

test("does not classify generic category asks as named products", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Welcher Conditioner passt gerade am besten zu meinem Haar?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not include sentence-initial question words in noisy named product asks", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Welche Moisture Mist Conditioner von Urban Alchemy passt?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not classify generic product recommendation asks as named products", () => {
  const context = buildAgentV2NamedProductContext({
    latestMessage: "Kannst du mir einen leichten Conditioner empfehlen?",
    recentMessages: [],
  })

  assert.equal(context, null)
})

test("does not infer categories from aliases embedded inside product tokens", () => {
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Was haelst du von Olaplex No. 3?",
      recentMessages: [],
    }),
    null,
  )
  assert.equal(
    buildAgentV2NamedProductContext({
      latestMessage: "Was haelst du von Moroccanoil Treatment?",
      recentMessages: [],
    }),
    null,
  )
})

test("normalizes product names for overlap comparison", () => {
  assert.equal(
    normalizeNamedProductForComparison("Urban Alchemy Moisture Mist Conditioner"),
    "urban alchemy moisture mist conditioner",
  )
  assert.equal(
    normalizeNamedProductForComparison("Moisture Mist Conditioner von Urban Alchemy"),
    "moisture mist conditioner urban alchemy",
  )
})
