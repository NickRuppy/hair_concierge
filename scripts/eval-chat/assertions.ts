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

  if (expected.retrieval_mode !== undefined) {
    const actual = done.retrieval_mode as string | undefined
    const allowed = Array.isArray(expected.retrieval_mode)
      ? expected.retrieval_mode
      : [expected.retrieval_mode]
    results.push({
      tier: "metadata",
      name: "retrieval_mode",
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

  if (expected.source_count_min !== undefined) {
    const actual = sse.sources.length
    results.push({
      tier: "metadata",
      name: "source_count_min",
      passed: actual >= expected.source_count_min,
      expected: `>= ${expected.source_count_min}`,
      actual: String(actual),
    })
  }

  if (expected.source_count_max !== undefined) {
    const actual = sse.sources.length
    results.push({
      tier: "metadata",
      name: "source_count_max",
      passed: actual <= expected.source_count_max,
      expected: `<= ${expected.source_count_max}`,
      actual: String(actual),
    })
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
      expected: ">=3 German markers",
      actual: `${germanHits.length} markers (${germanHits.slice(0, 5).join(", ")})`,
    })
  }

  if (expected.citations_present) {
    const hasCitation = /\[\d+\]/.test(content)
    results.push({
      tier: "content",
      name: "citations_present",
      passed: hasCitation,
      expected: "contains [N] citation",
      actual: hasCitation ? "found" : "none found",
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
