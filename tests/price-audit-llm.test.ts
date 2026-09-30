import assert from "node:assert/strict"
import test from "node:test"

import {
  extractJsonAnswer,
  isAcceptableEvidenceUrl,
  llmResearchPrompt,
  observeViaLlm,
} from "../src/lib/price-audit/adapters/llm"
import type { PriceAuditCandidate } from "../src/lib/price-audit/contracts"

function candidate(overrides: Partial<PriceAuditCandidate> = {}): PriceAuditCandidate {
  return {
    id: "product-1",
    name: "No.5 Leave-In",
    brand: "Olaplex",
    affiliateLink: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
    priceEur: 34,
    priceCheckedAt: "2026-06-09T00:00:00.000Z",
    purchaseLinkStatus: "available",
    isChaarlieRecommended: true,
    canonicalGtin14s: [],
    ...overrides,
  }
}

const answer = (payload: Record<string, unknown>) =>
  `[codex] thinking...\nSome reasoning here { not json }\n${JSON.stringify(payload)}\ntokens used\n123`

test("llm adapter confirms a researched price with gate-passing evidence", async () => {
  const observation = await observeViaLlm(candidate(), {
    runResearch: async (prompt) => {
      assert.match(prompt, /Olaplex/)
      assert.match(prompt, /No\.5 Leave-In/)
      return answer({
        found: true,
        price_eur: 34.0,
        buyable_at_stored_link: true,
        evidence_url: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
        observed_name: "Original OLAPLEX N°5 Leave-In Conditioner",
        notes: "official shop",
      })
    },
  })
  assert.deepEqual(observation, {
    kind: "confirmed",
    identity: "llm_research",
    priceEur: 34.0,
    buyable: true,
    buyableSource: "text",
    evidenceUrl: "https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner",
    observedName: "Original OLAPLEX N°5 Leave-In Conditioner",
  })
})

test("llm adapter carries an unavailability claim as buyable=false", async () => {
  const observation = await observeViaLlm(candidate(), {
    runResearch: async () =>
      answer({
        found: true,
        price_eur: 34.0,
        buyable_at_stored_link: false,
        evidence_url: "https://www.douglas.de/de/p/olaplex-no5",
        observed_name: "Olaplex No.5",
        notes: "",
      }),
  })
  assert.equal(observation.kind, "confirmed")
  assert.equal(observation.kind === "confirmed" ? observation.buyable : null, false)
})

test("llm adapter rejects aggregator evidence and unusable urls", async () => {
  for (const url of ["https://www.idealo.de/preisvergleich/x", "not a url", null]) {
    const observation = await observeViaLlm(candidate(), {
      runResearch: async () =>
        answer({
          found: true,
          price_eur: 29.99,
          buyable_at_stored_link: true,
          evidence_url: url,
          observed_name: "x",
          notes: "",
        }),
    })
    assert.equal(observation.kind, "mismatch", String(url))
    assert.equal(observation.kind === "mismatch" ? observation.reason : null, "no_price_found")
  }
})

test("llm adapter reports found=false as not_found and garbage output as failure", async () => {
  const notFound = await observeViaLlm(candidate(), {
    runResearch: async () =>
      answer({
        found: false,
        price_eur: null,
        buyable_at_stored_link: null,
        evidence_url: null,
        observed_name: null,
        notes: "could not establish product",
      }),
  })
  assert.equal(notFound.kind, "mismatch")
  assert.equal(notFound.kind === "mismatch" ? notFound.reason : null, "not_found")

  const garbage = await observeViaLlm(candidate(), {
    runResearch: async () => "no json anywhere",
  })
  assert.deepEqual(garbage, { kind: "failed", reason: "adapter_unavailable" })

  const thrown = await observeViaLlm(candidate(), {
    runResearch: async () => {
      throw new Error("codex died")
    },
  })
  assert.deepEqual(thrown, { kind: "failed", reason: "adapter_unavailable" })
})

test("evidence gate accepts known retailers and brand-direct shops only", () => {
  assert.equal(isAcceptableEvidenceUrl("https://www.dm.de/p/d/1/x", null), true)
  assert.equal(isAcceptableEvidenceUrl("https://olaplex.de/products/no5", "Olaplex"), true)
  assert.equal(isAcceptableEvidenceUrl("https://www.geizhals.de/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://random-blog.example.com/review", "Olaplex"), false)
})

test("extractJsonAnswer takes the final json object out of noisy cli output", () => {
  assert.deepEqual(extractJsonAnswer('log {"a":1} more {"found":true}'), { found: true })
  assert.equal(extractJsonAnswer("nothing here"), null)
})

test("prompt contains the anti-aggregator and default-size rules", () => {
  const prompt = llmResearchPrompt(candidate())
  assert.match(prompt, /idealo/)
  assert.match(prompt, /default consumer size/)
})
