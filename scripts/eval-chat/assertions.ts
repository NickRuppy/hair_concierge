/**
 * Chat Evaluation Harness — Three-Tier Assertion Engine
 */

import type { SSEResult, MetadataAssertions, ContentHeuristics, AssertionResult } from "./types"

// ── Tier 1: Metadata assertions (deterministic) ─────────────────────────

export function runMetadataAssertions(
  sse: SSEResult,
  expected: MetadataAssertions,
): AssertionResult[] {
  const results: AssertionResult[] = []
  const done = sse.done_data ?? {}

  if (expected.intent !== undefined) {
    const actual = done.intent as string | undefined
    const allowed = Array.isArray(expected.intent) ? expected.intent : [expected.intent]
    results.push({
      tier: "metadata",
      name: "intent",
      passed: actual !== undefined && allowed.includes(actual),
      expected: allowed.join(" | "),
      actual: actual ?? "(missing)",
    })
  }

  if (expected.response_mode !== undefined) {
    const actual = done.response_mode as string | undefined
    const allowed = Array.isArray(expected.response_mode)
      ? expected.response_mode
      : [expected.response_mode]
    results.push({
      tier: "metadata",
      name: "response_mode",
      passed: actual !== undefined && allowed.includes(actual),
      expected: allowed.join(" | "),
      actual: actual ?? "(missing)",
    })
  }

  if (expected.needs_clarification !== undefined) {
    const actual = done.needs_clarification as boolean | undefined
    results.push({
      tier: "metadata",
      name: "needs_clarification",
      passed: actual === expected.needs_clarification,
      expected: String(expected.needs_clarification),
      actual: String(actual ?? "(missing)"),
    })
  }

  if (expected.policy_overrides_include) {
    const actual = (done.policy_overrides as string[]) ?? []
    for (const tag of expected.policy_overrides_include) {
      results.push({
        tier: "metadata",
        name: `policy_overrides includes "${tag}"`,
        passed: actual.includes(tag),
        expected: `contains "${tag}"`,
        actual: actual.join(", ") || "(empty)",
      })
    }
  }

  if (expected.policy_overrides_exclude) {
    const actual = (done.policy_overrides as string[]) ?? []
    for (const tag of expected.policy_overrides_exclude) {
      results.push({
        tier: "metadata",
        name: `policy_overrides excludes "${tag}"`,
        passed: !actual.includes(tag),
        expected: `not contains "${tag}"`,
        actual: actual.join(", ") || "(empty)",
      })
    }
  }

  if (expected.product_count_min !== undefined) {
    const actual = sse.products.length
    results.push({
      tier: "metadata",
      name: "product_count_min",
      passed: actual >= expected.product_count_min,
      expected: `>= ${expected.product_count_min}`,
      actual: String(actual),
    })
  }

  if (expected.product_count_max !== undefined) {
    const actual = sse.products.length
    results.push({
      tier: "metadata",
      name: "product_count_max",
      passed: actual <= expected.product_count_max,
      expected: `<= ${expected.product_count_max}`,
      actual: String(actual),
    })
  }

  return results
}

// ── Tier 2: Content heuristics (pattern matching) ────────────────────────

const GERMAN_MARKERS = [
  "und",
  "die",
  "das",
  "ist",
  "nicht",
  "dein",
  "Haar",
  "oder",
  "auch",
  "wenn",
  "aber",
  "fuer",
  "für",
  "ich",
  "deine",
  "Kopfhaut",
]

const LOCAL_NEGATORS = new Set(["nicht", "niemals", "keinesfalls"])
const WORD_PATTERN = /\p{L}+/gu
const CLAUSE_BOUNDARY_PATTERN = /[.!?;,:]/gu

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

function hasForbiddenClaim(content: string, claim: string): boolean {
  const normalizedContent = content.toLowerCase().replace(/\s+/gu, " ").trim()
  const normalizedClaim = claim.toLowerCase().replace(/\s+/gu, " ").trim()
  const claimPattern = escapePattern(normalizedClaim).replace(/ /gu, "\\s+")
  const matcher = new RegExp(`(?<![\\p{L}\\p{N}_])${claimPattern}(?![\\p{L}\\p{N}_])`, "gu")

  for (const match of normalizedContent.matchAll(matcher)) {
    const index = match.index ?? 0
    const claimEnd = index + match[0].length
    const precedingContent = normalizedContent.slice(0, index)
    const previousBoundary = [...precedingContent.matchAll(CLAUSE_BOUNDARY_PATTERN)].at(-1)
    const clauseStart = (previousBoundary?.index ?? -1) + 1
    const followingBoundary = normalizedContent.slice(claimEnd).search(CLAUSE_BOUNDARY_PATTERN)
    const clauseEnd =
      followingBoundary === -1 ? normalizedContent.length : claimEnd + followingBoundary
    const precedingWords = normalizedContent.slice(clauseStart, index).match(WORD_PATTERN) ?? []
    const followingWords = normalizedContent.slice(claimEnd, clauseEnd).match(WORD_PATTERN) ?? []
    const precedingNegators = precedingWords.slice(-3).filter((word) => LOCAL_NEGATORS.has(word))
    const followingNegators = followingWords.slice(0, 3).filter((word) => LOCAL_NEGATORS.has(word))
    const previousWord = precedingWords.at(-1)
    const nextWord = followingWords[0]
    const negatedBefore = LOCAL_NEGATORS.has(previousWord ?? "") && precedingNegators.length === 1
    const negatedAfter = LOCAL_NEGATORS.has(nextWord ?? "") && followingNegators.length === 1
    const hasRepeatedNegator = precedingNegators.length + followingNegators.length > 1
    const negationExtendsToOnly = negatedAfter && followingWords[1] === "nur"

    if ((!negatedBefore && !negatedAfter) || hasRepeatedNegator || negationExtendsToOnly) {
      return true
    }
  }

  return false
}

export function runContentAssertions(
  sse: SSEResult,
  expected: ContentHeuristics,
): AssertionResult[] {
  const results: AssertionResult[] = []
  const content = sse.content

  if (expected.must_be_german) {
    const lower = content.toLowerCase()
    const germanHits = GERMAN_MARKERS.filter((w) => lower.includes(w.toLowerCase()))
    results.push({
      tier: "content",
      name: "must_be_german",
      passed: germanHits.length >= 3,
      severity: "soft",
      expected: ">=3 German markers",
      actual: `${germanHits.length} markers (${germanHits.slice(0, 5).join(", ")})`,
    })
  }

  if (expected.required_keywords) {
    const lower = content.toLowerCase()
    const found = expected.required_keywords.filter((kw) => lower.includes(kw.toLowerCase()))
    results.push({
      tier: "content",
      name: "required_keywords",
      passed: found.length > 0,
      expected: `at least one of: ${expected.required_keywords.join(", ")}`,
      actual: found.length > 0 ? `found: ${found.join(", ")}` : "none found",
    })
  }

  if (expected.forbidden_keywords) {
    const lower = content.toLowerCase()
    const found = expected.forbidden_keywords.filter((kw) => lower.includes(kw.toLowerCase()))
    results.push({
      tier: "content",
      name: "forbidden_keywords",
      passed: found.length === 0,
      expected: `none of: ${expected.forbidden_keywords.join(", ")}`,
      actual: found.length === 0 ? "none found" : `found: ${found.join(", ")}`,
    })
  }

  if (expected.forbidden_claims) {
    const found = expected.forbidden_claims.filter((claim) => hasForbiddenClaim(content, claim))
    results.push({
      tier: "content",
      name: "forbidden_claims",
      passed: found.length === 0,
      expected: `none of: ${expected.forbidden_claims.join(", ")}`,
      actual: found.length === 0 ? "none found" : `found: ${found.join(", ")}`,
    })
  }

  if (expected.min_length !== undefined) {
    results.push({
      tier: "content",
      name: "min_length",
      passed: content.length >= expected.min_length,
      expected: `>= ${expected.min_length} chars`,
      actual: `${content.length} chars`,
    })
  }

  return results
}
