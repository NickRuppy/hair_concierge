import assert from "node:assert/strict"
import test from "node:test"

import {
  dedupeByConfidence,
  classifyForOutput,
  type ResultRow,
} from "../src/lib/affiliate-research/aggregate"

function row(p: Partial<ResultRow>): ResultRow {
  return {
    id: "x",
    brand: "Brand",
    name: "Name",
    chosen_url: "",
    host: "",
    confidence: "none",
    matched_tokens: "",
    notes: "",
    ...p,
  }
}

test("dedupeByConfidence keeps highest confidence per id", () => {
  const rows = [
    row({ id: "a", confidence: "none" }),
    row({ id: "a", confidence: "high", chosen_url: "https://www.dm.de/p" }),
    row({ id: "b", confidence: "medium" }),
  ]
  const out = dedupeByConfidence(rows)
  assert.equal(out.length, 2)
  const a = out.find((r) => r.id === "a")!
  assert.equal(a.confidence, "high")
})

test("dedupeByConfidence tie-breaks on allowlisted host > brand-direct > other", () => {
  const rows = [
    row({
      id: "a",
      confidence: "high",
      chosen_url: "https://other-shop.example/p",
      host: "other-shop.example",
    }),
    row({ id: "a", confidence: "high", chosen_url: "https://www.dm.de/p", host: "www.dm.de" }),
  ]
  const out = dedupeByConfidence(rows)
  assert.equal(out.length, 1)
  assert.equal(out[0].host, "www.dm.de")
})

test("classifyForOutput approves confidence=high with allowlisted host and tokens", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://www.dm.de/p/foo",
    host: "www.dm.de",
    matched_tokens: "Aqua|Revive",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "approved")
})

test("classifyForOutput sends confidence=medium to review", () => {
  const r = row({
    id: "a",
    confidence: "medium",
    chosen_url: "https://olaplex.com/p",
    host: "olaplex.com",
    matched_tokens: "No3",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /confidence/i)
})

test("classifyForOutput sends confidence=high but denylisted host to review", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://idealo.de/p",
    host: "idealo.de",
    matched_tokens: "Foo",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /denylisted/i)
})

test("classifyForOutput sends confidence=high but empty matched_tokens to review", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://www.dm.de/p",
    host: "www.dm.de",
    matched_tokens: "",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /matched_tokens/i)
})
