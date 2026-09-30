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

test("evidence gate accepts known retailers, the stored shop host, and exact brand domains", () => {
  assert.equal(isAcceptableEvidenceUrl("https://www.dm.de/p/d/1/x", null), true)
  assert.equal(isAcceptableEvidenceUrl("https://olaplex.de/products/no5", "Olaplex"), true)
  assert.equal(isAcceptableEvidenceUrl("https://eu.curlsmith.com/products/x", "Curlsmith"), true)
  assert.equal(isAcceptableEvidenceUrl("https://www.geizhals.de/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://random-blog.example.com/review", "Olaplex"), false)
  // Brand substrings/prefixes in a foreign host are NOT brand ownership.
  assert.equal(isAcceptableEvidenceUrl("https://olaplex.attacker.example/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://olaplex-scam.com/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://olap.com/x", "Olaplex"), false)
  // Aggregator subdomains stay denied, even as the stored host.
  assert.equal(isAcceptableEvidenceUrl("https://olaplex.idealo.de/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://sub.geizhals.de/x", "Olaplex"), false)
  assert.equal(isAcceptableEvidenceUrl("https://www.idealo.de/x", "Olaplex", "idealo.de"), false)
  // The product's own stored shop host is a DB-verified alias.
  assert.equal(
    isAcceptableEvidenceUrl("https://www.neqi-hair.com/products/x", "Neqi", "neqi-hair.com"),
    true,
  )
  assert.equal(isAcceptableEvidenceUrl("https://neqi-hair.com/products/x", "Neqi", null), false)
})

test("extractJsonAnswer stays linear on large malformed output", () => {
  const hostile = "{".repeat(200_000)
  const started = performance.now()
  assert.equal(extractJsonAnswer(hostile), null)
  assert.equal(extractJsonAnswer(`${hostile} {"found":true}`)?.found, true)
  assert.ok(performance.now() - started < 1_000, "scan must stay fast on hostile input")
})

test("a malformed availability claim routes to review instead of a write", async () => {
  const observation = await observeViaLlm(candidate(), {
    runResearch: async () =>
      answer({
        found: true,
        price_eur: 34.0,
        buyable_at_stored_link: "false",
        evidence_url: "https://olaplex.de/products/no5",
        observed_name: "Olaplex No.5",
        notes: "",
      }),
  })
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "availability_unknown")
})

test("extractJsonAnswer takes the final schema answer out of noisy cli output", () => {
  assert.deepEqual(extractJsonAnswer('log {"a":1} more {"found":true}'), { found: true })
  assert.equal(extractJsonAnswer("nothing here"), null)
  // Braces inside string values must not break extraction.
  assert.deepEqual(extractJsonAnswer('x {"found":true,"notes":"has {brace} inside"}'), {
    found: true,
    notes: "has {brace} inside",
  })
  // A nested log object without the schema key never wins over the answer.
  assert.deepEqual(extractJsonAnswer('{"log":{"found":"yes"}} then {"found":false,"notes":""}'), {
    found: false,
    notes: "",
  })
  // Objects lacking the boolean `found` are not answers at all.
  assert.equal(extractJsonAnswer('{"price_eur":3}'), null)
  // Regression: a nested boolean `found` inside a later log object must not
  // hijack an earlier top-level answer.
  assert.deepEqual(
    extractJsonAnswer('{"found":false,"notes":""} then {"log":{"found":true,"price_eur":1}}'),
    { found: false, notes: "" },
  )
  // And a nested answer-shaped object alone is still no answer.
  assert.equal(extractJsonAnswer('{"log":{"found":true,"price_eur":1}}'), null)
})

test("prompt contains the anti-aggregator and default-size rules", () => {
  const prompt = llmResearchPrompt(candidate())
  assert.match(prompt, /idealo/)
  assert.match(prompt, /default consumer size/)
})
