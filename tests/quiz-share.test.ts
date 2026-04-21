import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizShareConfig } from "../src/lib/quiz/share"

test("mobile uses native share with the public result url", () => {
  const share = buildQuizShareConfig({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea",
    shareQuote: "Deine Haare brauchen die richtige Reihenfolge.",
    origin: "https://hair.example",
    isMobile: true,
    canNativeShare: true,
  })

  assert.equal(share?.label, "ERGEBNIS TEILEN")
  assert.equal(share?.mode, "native")
  assert.equal(share?.url, "https://hair.example/result/550e8400-e29b-41d4-a716-446655440000")
  assert.match(share?.text ?? "", /Deine Haare brauchen die richtige Reihenfolge/i)
})

test("desktop falls back to copying the public result url", () => {
  const share = buildQuizShareConfig({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea",
    shareQuote: null,
    origin: "https://hair.example",
    isMobile: false,
    canNativeShare: true,
  })

  assert.equal(share?.label, "ERGEBNIS TEILEN")
  assert.equal(share?.mode, "copy")
  assert.equal(share?.url, "https://hair.example/result/550e8400-e29b-41d4-a716-446655440000")
  assert.match(share?.text ?? "", /Leas Ergebnis/i)
})

test("missing lead id disables the share action", () => {
  const share = buildQuizShareConfig({
    leadId: null,
    name: "Lea",
    shareQuote: null,
    origin: "https://hair.example",
    isMobile: true,
    canNativeShare: true,
  })

  assert.equal(share, null)
})
