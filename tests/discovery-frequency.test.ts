import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_FREQUENCY_LABELS,
  DISCOVERY_FREQUENCY_OPTIONS,
  DISCOVERY_FREQUENCY_SUGGESTION_HINT,
  DISCOVERY_HEAT_FREQUENCY_OPTIONS,
  discoveryFrequencySuggestion,
  mostFrequentDiscoveryFrequency,
} from "../src/lib/discovery/frequency"

/**
 * Batch 7 (plan §2.1 item 3, ruling round 4): one uniform list for every product; conditioner
 * and leave-in preselect the most recently saved shampoo's frequency („Wie dein Shampoo"),
 * nothing else is preselected, and there is no coupling afterwards.
 */

test("the product step lists every frequency, most frequent first, „Weiß ich nicht“ last", () => {
  assert.deepEqual(
    DISCOVERY_FREQUENCY_OPTIONS.map((value) => DISCOVERY_FREQUENCY_LABELS[value]),
    [
      "Täglich",
      "5–6× pro Woche",
      "3–4× pro Woche",
      "2× pro Woche",
      "1× pro Woche",
      "Alle 2 Wochen",
      "1× im Monat",
      "Seltener",
      "Weiß ich nicht",
    ],
  )
  assert.deepEqual(DISCOVERY_HEAT_FREQUENCY_OPTIONS, DISCOVERY_FREQUENCY_OPTIONS.slice(0, 8))
})

test("most frequent known frequency; unknown and unasked never count", () => {
  assert.equal(mostFrequentDiscoveryFrequency(["weekly_1x", "daily_1x", "unknown"]), "daily_1x")
  assert.equal(mostFrequentDiscoveryFrequency(["unknown", null, undefined]), null)
  assert.equal(mostFrequentDiscoveryFrequency([]), null)
})

const shampoo = (frequency: string | null, source = "catalog_search") => ({
  source,
  category: "shampoo" as const,
  frequency: frequency as never,
})

test("conditioner and leave-in suggest the most recently saved shampoo's frequency", () => {
  const items = [shampoo("weekly_2x"), shampoo("daily_1x"), shampoo("weekly_3_4x")]
  assert.equal(discoveryFrequencySuggestion("conditioner", items), "weekly_3_4x")
  assert.equal(discoveryFrequencySuggestion("leave_in", items), "weekly_3_4x")
  assert.equal(DISCOVERY_FREQUENCY_SUGGESTION_HINT, "Wie dein Shampoo")
})

test("no suggestion: other categories, no shampoo, or her last shampoo's frequency is unknown", () => {
  const items = [shampoo("weekly_2x")]
  for (const category of ["shampoo", "mask", "oil", "heat_protectant", null] as const) {
    assert.equal(discoveryFrequencySuggestion(category, items), null, String(category))
  }
  assert.equal(discoveryFrequencySuggestion("conditioner", []), null)
  assert.equal(
    discoveryFrequencySuggestion("conditioner", [shampoo("weekly_2x"), shampoo("unknown")]),
    null,
  )
  assert.equal(discoveryFrequencySuggestion("conditioner", [shampoo(null)]), null)
  // A „none“ row is no shampoo of hers.
  assert.equal(discoveryFrequencySuggestion("conditioner", [shampoo(null, "none")]), null)
})
