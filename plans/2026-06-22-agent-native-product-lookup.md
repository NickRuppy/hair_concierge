# Agent-Native Product Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 call product lookup natively for concrete product candidates, while the validator deterministically blocks product-specific answers that skip or misuse lookup.

**Architecture:** Keep the model as the primary owner of product-intent understanding and tool choice. Add one strict model-owned `request_interpretation.specific_product_candidate` boolean, keep existing deterministic named-product context only as a temporary migration safety floor, and enforce the trust boundary through validator checks over structured metadata, tool history, lookup results, and visible answer text. Product intake cards remain downstream of structured `lookup_product_candidate` `not_found` metadata only. Before merge, test the model-native path without deterministic lookup enforcement and remove `namedProductContext` from lookup-required enforcement if representative checks pass.

**Tech Stack:** Next.js App Router, TypeScript, Zod strict schemas, OpenAI Responses API tool loop, AgentV2 validator/repair loop, Supabase product catalog, Node `tsx` scripts, existing Node test runner.

---

## Context

This plan corrects the product-intake chat trigger architecture discovered during Phase 5 testing of `plans/2026-06-10-product-intake-intelligence.md`.

The problem is not just lowercase matching. The deeper issue is that chat product lookup was too dependent on deterministic named-product regex/context. The target architecture is model-native: the assistant should decide to call `lookup_product_candidate` when the user wants to work with a plausible concrete product candidate. Deterministic code should enforce the safety boundary, not try to enumerate every German phrasing.

## Decisions

- No separate product-intent preflight model call.
- No mandatory product-classification tool step.
- Strengthen first-pass AgentV2 instructions and the `lookup_product_candidate` tool description so repair is the exception, not the normal path.
- Add exactly one required field to `AgentV2RequestInterpretationSchema`:

  ```ts
  specific_product_candidate: boolean
  ```

- `specific_product_candidate` is identity-only: true means a plausible concrete product candidate is present in the latest turn or active conversation context. It does not by itself mean lookup is required.
- Use existing `request_interpretation.evidence_quote`; do not add a separate product evidence quote in this plan.
- Do not add `product_identity_confidence`.
- Keep existing `namedProductContext` as a temporary independent safety floor during implementation, but do not expand regex as the main solution.
- Before merge, test the model-native path without deterministic lookup enforcement and remove `namedProductContext` from lookup-required enforcement. Keep it only as non-authoritative prompt/debug context unless implementation proves that creates a concrete regression Nick accepts.
- During Tasks 1-6, lookup is required when:
  - model-owned interpretation says `specific_product_candidate === true` and the turn has product-specific intent, or
  - existing deterministic named-product context says a plausible exact product is present and its intent requires lookup.
- After Task 6B, lookup-required enforcement comes from the model-owned interpretation path only; `namedProductContext` may remain as non-authoritative prompt/debug context.
- Product-specific intent includes product detail/evaluation, product-specific claims, named-product clarification, and routine add/replace/mutation involving a product.
- Product lookup should be called even for partial concrete candidates. If category or identity is incomplete, the lookup tool returns `ambiguous` or `insufficient_identity`; the assistant clarifies from that result.
- Intake card appears immediately only for current-turn `lookup_product_candidate` result `not_found` with supported category and structured `intake_offer`.
- Ambiguous or insufficient identity loops through clarification and a later lookup; no intake card appears until a confident supported-category `not_found`.
- Unsupported category returns a friendly no-intake response and preserves observability for future category expansion.
- Offline replay against historical `user_product_usage` rows is read-only, anonymized, local/developer-only for now.

## Accepted Deviations During Implementation

- Task 3 social/domain consistency: the `specific_product_candidate=false` production check was patched in the same edit as the lookup predicate, then immediately covered with a focused regression test before the Task 3 gate passed.
- Task 6 replay was implemented by a subagent with isolated ownership of `scripts/product-intake/replay-user-product-usage-lookup.ts` and `tests/product-intake-replay-user-product-usage-lookup.spec.ts`; the main thread reviewed the files and reran the targeted test/typecheck.
- Task 6B runtime repair fixtures were adjusted to load product-recommendation guidance for product-detail turns; otherwise the repair loop correctly prioritized missing guidance before lookup and the test was asserting the wrong repair shape.
- Task 7 chat eval initially failed only the stale `simple-faq` metadata expectation (`faq|hybrid`); the fixture was updated to allow the production AgentV2 `agent_v2_responses` retrieval mode while keeping visible-answer assertions unchanged.
- Final autoreview found two multi-lookup correlation risks. The patch preserves lookup input identity in validation summaries, requires lookup identity/category to match the final interpreted candidate, and prevents chat intake cards from using an unrelated later lookup result.
- Follow-up review found two identity-correlation edge cases. The validator no longer lets a lookup `evidence_quote` satisfy identity by itself, no longer accepts a generic product/category fragment such as `Conditioner` when the lookup brand differs, and now uses token-set matching to preserve legitimate word-order variants such as `Urban Alchemy Moisture Mist Conditioner`.
- Final correctness review found three remaining correlation/backstop risks. The patch makes the chat intake selector ignore product-name-only matches when a lookup supplied a different brand, requires lookup when the final visible answer makes a product-specific claim about deterministic named-product context even if the model forgot `specific_product_candidate`, and removes broad `recentEvidenceText` from lookup identity matching so stale earlier turns cannot satisfy the current candidate.
- Second final correctness review found two narrower residual holes. The patch now requires the lookup brand to appear in the matched current-turn evidence when a lookup supplied a brand, lets the chat intake selector compare against the current user message as well as the final evidence quote, and applies the visible named-product claim backstop across all lookup-guarded answer modes rather than only `general_advice`.
- Post-Claude/superpowers review fixups tightened the final card boundary and reduced false positives: chat intake cards now require `specific_product_candidate=true`, a matching current-turn lookup, and `not_found`; lookup matching is based on the mentioned product identity rather than the final answer target category; background product mentions are explicitly instructed to keep `specific_product_candidate=false`; and generic routine/planning phrases such as `Routine mit Conditioner` no longer fabricate product identities.
- Final read-only review found two additional correlation gaps. The patch now prevents unresolved lookups for a merely mentioned product from blocking unrelated grounded recommendations, while still blocking claims about the unresolved product itself, and requires chat intake-card lookup matches to include the lookup category term in the matched evidence so same-brand/same-line wrong-category lookups do not render a card.
- Final follow-up review found that structured lookup identities could make pronoun/category claims about the unresolved product slip through when the answer did not repeat the full brand/name. The patch now falls back to named-product-context category relevance for unresolved product-specific claim blocking, so `Das Shampoo passt gut` remains blocked after an unresolved `Acme Hydra Glow Shampoo` lookup while unrelated grounded conditioner recommendations remain allowed.
- Final subagent review found that a doubly over-eager model could mark a background product mention as `specific_product_candidate=true`, call lookup, and render an intake card for an unrelated washing-frequency answer. The patch now requires the final answer to have product-detail/product-selection/compare intent, or a product-involving routine mutation, before a `not_found` lookup can render the chat intake card.
- Post-review correlation fix: product-selection/compare answers now require the lookup category to match the final answer target category before a `not_found` lookup can render a chat intake card. This prevents an unknown background shampoo lookup from attaching an intake card to a conditioner recommendation answer.
- Post-review false-negative fix: product-detail/add-style answers may render an intake card when the lookup category matches the final answer target category, even if the user did not literally type the category word in the product name.
- Follow-up product idea, intentionally out of this correctness patch: if a background product lookup is `not_found`, the assistant may later add a small natural-language follow-up offer to add that background product after answering the user's main question. This should be a separate answer-composition change, not an immediate intake-card render.

## Replay Result Summary

- Latest report path: `tmp/product-lookup-replay-2026-06-22T18-29-32-500Z.json` (local ignored artifact; do not commit raw examples).
- Earlier matching report paths: `tmp/product-lookup-replay-2026-06-22T18-21-27-497Z.json`, `tmp/product-lookup-replay-2026-06-22T18-09-59-878Z.json`, `tmp/product-lookup-replay-2026-06-22T18-03-35-579Z.json`, `tmp/product-lookup-replay-2026-06-22T17-58-25-997Z.json`, `tmp/product-lookup-replay-2026-06-22T17-46-01-135Z.json`, `tmp/product-lookup-replay-2026-06-22T17-13-08-786Z.json`.
- Rows: 429 total, 398 tested, 31 skipped for missing product name.
- Status counts: `found_exact=0`, `ambiguous=0`, `not_found=3`, `insufficient_identity=378`, `unsupported_category=17`, `skipped_missing_product_name=31`.
- Privacy check: no `user_id`, `email`, `conversation_id`, or person `name` keys found in the report.
- Manual review concern: historical rows are mostly too sparse for exact matching, so the replay is useful as a baseline and shows why the new photo/text intake path needs richer identity capture.

## Source Links

- Current product-intake master plan: `plans/2026-06-10-product-intake-intelligence.md`
- Claude review of this plan: `plans/2026-06-22-agent-native-product-lookup.claude-review.md`
- OpenAI tool/function calling guidance: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI Structured Outputs guidance: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Agents/guardrails guidance: https://developers.openai.com/api/docs/guides/agents
- OpenAI evals guidance: https://developers.openai.com/api/docs/guides/evals

## Scope Boundaries

In scope:

- AgentV2 request interpretation schema, prompts, tool descriptions, runtime fallback builders, validators, tests, and product lookup replay script.
- Verification that product intake card metadata comes only from lookup `not_found` results.
- Read-only offline replay of existing onboarding product entries as a pre-merge verification phase.

Out of scope:

- New product-intent classifier model call.
- Mandatory product-classifier tool.
- More regex expansions beyond preserving the existing floor.
- Removing the `namedProductContext` module entirely; this plan removes it from lookup enforcement only.
- Changes to the product matching algorithm unless tests expose a direct integration bug.
- Admin UI or production mutation from replay results.
- Formal CI replay eval with committed thresholds; this comes after we learn from the local diagnostic.

## Target File Map

- Modify: `src/lib/agent-v2/contracts.ts`
  - Add `specific_product_candidate` to `AgentV2RequestInterpretationSchema`.
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Update terminal field guidance, named-product lookup guidance, deterministic fallback answers, repair behavior if needed, and interpretation summary if useful.
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
  - Strengthen `lookup_product_candidate` description with when-to-call, partial identity, status behavior, and non-examples.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Enforce lookup from model-owned field OR deterministic floor, preserve visible-answer backstops, and validate social/domain/safety consistency.
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
  - Verify current `productIntakeOffer` extraction remains structured lookup-result-only; patch only if tests show prose-derived leakage.
- Create: `scripts/product-intake/replay-user-product-usage-lookup.ts`
  - Read-only anonymized replay for historical onboarding product usage rows.
- Test: `tests/agent-v2-contracts.spec.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`
- Test: `tests/agent-v2-named-product-context.spec.ts`
- Create: `tests/product-intake-replay-user-product-usage-lookup.spec.ts`
- Modify: `plans/2026-06-10-product-intake-intelligence.md`
  - Add a cross-reference/status note to this focused plan.

---

## Task 1: Add Model-Owned Product Candidate Field

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify tests/factories in:
  - `tests/agent-v2-contracts.spec.ts`
  - `tests/agent-v2-final-answer-validator.spec.ts`
  - `tests/agent-v2-responses-runtime.spec.ts`
  - `tests/agent-v2-production-chat-pipeline.spec.ts`
  - any other test file surfaced by typecheck

- [x] **Step 1: Write failing schema tests**

  Add or update contract tests proving `request_interpretation.specific_product_candidate` is required and boolean.

  Expected cases:
  - valid interpretation includes `specific_product_candidate: false`
  - product-detail interpretation can include `specific_product_candidate: true`
  - missing field fails strict schema parsing
  - non-boolean field fails strict schema parsing

- [x] **Step 2: Run contract test and verify failure**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-contracts.spec.ts
  ```

  Expected: FAIL because schema does not yet include the required field.

- [x] **Step 3: Add schema field**

  In `AgentV2RequestInterpretationSchema`, add:

  ```ts
  specific_product_candidate: z.boolean(),
  ```

  Semantics to preserve in comments or nearby prompt, not schema:
  - true means the user mentioned or actively refers to a plausible concrete product candidate in the latest turn or active context
  - false for broad category asks, broad brand-family asks, social/domain/safety turns, generic education, and product-category-only descriptions

- [x] **Step 4: Update test factories and literal fixtures**

  Update every `requestInterpretation(...)` helper to default:

  ```ts
  specific_product_candidate: false
  ```

  Update raw `request_interpretation` literals found by:

  ```bash
  rg "request_interpretation:\\s*\\{" tests src -n
  ```

  Do not blindly default product-detail tests to false; set true when the test is about a concrete named product.

  Also update all typed runtime fallback `request_interpretation` literals in `src/lib/agent-v2/runtime/responses-agent.ts` in this task. Most deterministic fallback/social/domain/error answers should set `specific_product_candidate: false`. This must happen before Task 1 typecheck so the per-task gate is real.

- [x] **Step 5: Run contract and type checks**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-contracts.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 2: Strengthen First-Pass Agent Instructions

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Write failing runtime prompt/tool-description tests**

  Add tests asserting the built AgentV2 tool/prompt text contains these concepts:
  - every final answer includes `specific_product_candidate`
  - call `lookup_product_candidate` for plausible concrete product candidates when the user wants Chaarlie to evaluate, clarify, add, replace, continue using, or make claims about that product
  - use lookup even when identity/category is partial; pass `category: null` when category/use is unclear
  - do not call lookup for broad category or broad brand-family recommendation asks
  - lookup statuses drive behavior: `found_exact`, `not_found`, `ambiguous`, `insufficient_identity`, `unsupported_category`

- [x] **Step 2: Run targeted runtime tests and verify failure**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  ```

  Expected: FAIL on missing wording / schema guidance.

- [x] **Step 3: Update terminal guidance**

  In `buildTerminalPayloadFieldGuidance()`, update:

  ```text
  Every submit_final_answer must include request_interpretation with primary_intent, product_request_kind, routine_intent, care_category, requested_product_count, count_policy, evidence_quote, confidence, and specific_product_candidate.
  ```

  Add concise policy:

  ```text
  Set request_interpretation.specific_product_candidate=true when the latest turn or active context contains a plausible concrete product candidate, even if brand/name/category is partial. Keep it false for broad category asks, broad brand-family asks, generic category education, and social/domain/safety turns.
  ```

  Update social/domain guidance to include `specific_product_candidate false`.

- [x] **Step 4: Update lookup tool description**

  In `lookup_product_candidate` description, make the contract explicit:
  - lookup is the product identity resolver
  - call it for concrete product candidates before product-specific answers
  - partial identity is allowed
  - `category: null` is allowed when unclear
  - ambiguous/insufficient means clarify, not intake
  - `not_found` with supported category may render intake card
  - no lookup for broad asks like `Welche Pantene Produkte empfiehlst du?`

- [x] **Step 5: Update named-product context guidance**

  Update `buildNamedProductContextGuidance()` and any nearby prompt text that currently says lookup is needed only when identity/category are "specific enough." Reconcile it with this plan:
  - concrete partial candidates should still call `lookup_product_candidate`
  - category/use can be `null` when unclear
  - ambiguous/insufficient lookup results drive clarification
  - broad brand-family/category asks still do not require lookup

- [x] **Step 6: Run focused tests**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 3: Validator Lookup Enforcement

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [x] **Step 1: Write failing validator tests**

  Add tests for:

  1. `specific_product_candidate: true` + `product_request_kind: "product_detail"` + intake enabled + no lookup -> blocks with `product_lookup_required`.
  2. `namedProductContext: null` but `specific_product_candidate: true` -> still blocks when product-specific intent exists.
  3. `specific_product_candidate: false` but existing `namedProductContext.plausible_exact_name` with product-specific intent -> still blocks. This preserves the independent floor.
  4. broad brand/category ask with `specific_product_candidate: false` -> no product lookup block.
  5. background product mention with `specific_product_candidate: true`, `product_request_kind: "none"`, routine intent `none`, and non-product-specific answer -> no lookup block.
  6. social/domain-boundary answer with `specific_product_candidate: true` -> block as inconsistent metadata.
  7. visible product-specific claim after missing/unresolved lookup -> block even if metadata tries to look generic.
  8. `specific_product_candidate: true` + product-specific intent + existing `lookup_product_candidate` call in `toolCallHistory` -> no `product_lookup_required` block.

- [x] **Step 2: Run validator tests and verify failure**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
  ```

  Expected: FAIL on missing new field enforcement.

- [x] **Step 3: Implement lookup-required predicate**

  Refactor `validateNamedProductLookupRequired` into a more general lookup validator.

  Desired predicate shape:

  ```ts
  const modelRequiresLookup =
    answer.request_interpretation.specific_product_candidate === true &&
    isNamedProductLookupTurn(answer) &&
    isLookupGuardedAnswerMode(answer)

  const deterministicFloorRequiresLookup =
    Boolean(context.namedProductContext?.plausible_exact_name) &&
    requiresNamedProductResolution(answer, context)

  const requiresLookup = modelRequiresLookup || deterministicFloorRequiresLookup
  ```

  Preserve:
  - `productIntakeEnabled === false` means no lookup requirement
  - existing `lookup_product_candidate` call in `toolCallHistory` means no lookup requirement for both model-owned and deterministic-floor paths
  - existing product-claim guards after unresolved lookup
  - existing `namedProductContext` background behavior

- [x] **Step 4: Validate social/domain/safety consistency**

  Extend existing social/domain interpretation consistency to require:

  ```ts
  interpretation.specific_product_candidate === false
  ```

  For safety-boundary answers, follow the existing style: block only if product-specific fields contradict the answer mode.

- [x] **Step 5: Run validator tests**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 4: Repair Loop And Runtime Behavior

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Write failing repair/runtime tests**

  Add tests for:
  - model submits product-detail final answer with `specific_product_candidate: true` and no lookup; validator repair requires `lookup_product_candidate` next
  - repair instruction calls lookup before another terminal answer
  - first-pass model can call lookup directly and no repair occurs
  - background product mention does not force lookup
  - broad brand-family ask does not force lookup

- [x] **Step 2: Run runtime tests and verify failure**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  ```

  Expected: FAIL until validator/runtime repairs route the new trigger to `lookup_product_candidate`.

- [x] **Step 3: Patch repair routing if needed**

  The existing repair code already maps `product_lookup_required` to `lookup_product_candidate`. Preserve that path. Patch only if new validator errors are not routed through the existing repair state.

- [x] **Step 4: Ensure repair prompt remains tool-first**

  Confirm the repair prompt says:

  ```text
  Call only these missing required tools in order: lookup_product_candidate.
  ```

  Do not allow a repaired prose-only deferral before lookup.

- [x] **Step 5: Run runtime tests**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 5: Product Intake Offer Metadata Contract

**Files:**
- Modify only if needed: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [x] **Step 1: Write/adjust pipeline tests**

  Ensure tests prove:
  - `not_found` with supported category and `intake_offer` surfaces `productIntakeOffer`
  - `ambiguous` does not surface intake offer
  - `insufficient_identity` does not surface intake offer
  - `unsupported_category` does not surface intake offer
  - final answer prose saying "not in database" without lookup metadata does not surface intake offer
  - product intake card metadata remains structured lookup-result metadata, not copy parsing

- [x] **Step 2: Run pipeline tests and verify failures if contract is incomplete**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
  ```

- [x] **Step 3: Patch pipeline only if tests expose a gap**

  Preserve the current intended contract:

  ```text
  productIntakeOffer comes from lookup_product_candidate result.intake_offer only.
  ```

  Do not parse visible assistant text.

- [x] **Step 4: Run pipeline tests**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 6: Offline Historical Product Usage Replay

**Phase role:** Pre-merge verification. The core implementation PR may be opened before this task is run, but the stack must not merge until the replay has been run and reviewed, unless Nick explicitly waives it.

**Files:**
- Create: `scripts/product-intake/replay-user-product-usage-lookup.ts`
- Test: `tests/product-intake-replay-user-product-usage-lookup.spec.ts`

- [x] **Step 1: Write failing mapping tests**

  Add tests for a pure helper that maps anonymized `user_product_usage` rows to lookup input:

  ```ts
  {
    category: row.category,
    product_name_text: row.product_name,
    brand_text: row.brand_text ?? null
  }
  ```

  Test cases:
  - old row with only `category` + `product_name`
  - newer row with `brand_text`
  - empty product name is skipped or reported as `skipped_missing_product_name`
  - no user id/email appears in the output shape

- [x] **Step 2: Run mapping test and verify failure**

  Run:

  ```bash
  npx tsx --test tests/product-intake-replay-user-product-usage-lookup.spec.ts
  ```

  Expected: FAIL because script/helper does not exist.

- [x] **Step 3: Implement developer-only replay script**

  Script behavior:
  - read Supabase env the same way existing scripts do
  - follow the anonymized export pattern from `scripts/product-identity/export-catalog.ts`
  - fetch only anonymized fields from `user_product_usage`:

    ```sql
    category, product_name, brand_text, frequency_range, match_status, product_id
    ```

  - no `user_id`, email, name, or conversation id in output
  - load product lookup catalog/brand catalog through existing repository/helper patterns
  - call the same `lookupProductCandidate` adapter used by AgentV2
  - use `eligibilityMode: "intake_dedupe"`
  - do not create product submissions
  - do not trigger intake cards
  - do not mutate database
  - write report under `tmp/`

  Suggested report fields:

  ```ts
  {
    generated_at: string
    total_rows: number
    tested_rows: number
    skipped_missing_product_name: number
    status_counts: Record<ProductLookupStatus | "skipped_missing_product_name", number>
    category_counts: Record<string, number>
    examples_by_status: Record<string, Array<{
      category: string | null
      product_name: string | null
      brand_text: string | null
      frequency_range: string | null
      match_status: string | null
      lookup_status: string
      candidate_count: number
      product_id_present_before_replay: boolean
    }>>
  }
  ```

- [x] **Step 4: Run mapping test**

  Run:

  ```bash
  npx tsx --test tests/product-intake-replay-user-product-usage-lookup.spec.ts
  ```

  Expected: PASS.

- [x] **Step 5: Run replay manually**

  Run from a developer machine with Supabase env available:

  ```bash
  npx tsx scripts/product-intake/replay-user-product-usage-lookup.ts --limit=500 --examples-per-status=10
  ```

  Expected:
  - report written to `tmp/product-lookup-replay-<date>.json`
  - no user identifiers in report
  - console prints status counts and report path

  If production Supabase access is unavailable, document the blocker. Do not merge unless the replay is run and reviewed or Nick explicitly waives this gate.

## Task 6B: Retire Deterministic Lookup Enforcement Floor

**Phase role:** Final cleanup after Tasks 1-6 and local testing pass. This is where the temporary regex-backed floor stops being a lookup-enforcement source of truth.

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify if needed: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Write failing cleanup tests**

  Add tests proving:
  - `specific_product_candidate: false` + `namedProductContext.plausible_exact_name` does not by itself trigger `product_lookup_required`
  - `specific_product_candidate: true` + product-specific intent still triggers `product_lookup_required`
  - visible product-specific claims after missing/unresolved lookup still block
  - existing `lookup_product_candidate` call in `toolCallHistory` still suppresses duplicate lookup-required errors

- [x] **Step 2: Run cleanup tests and verify failure**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  ```

- [x] **Step 3: Remove deterministic lookup enforcement**

  Remove `namedProductContext` from the lookup-required predicate. Keep the module as non-authoritative prompt/debug context if useful, but it must not independently force lookup or intake behavior.

  Preserve:
  - model-owned `specific_product_candidate` lookup enforcement
  - unresolved/missing lookup visible-answer guards
  - structured lookup result contract for intake cards

- [x] **Step 4: Run focused verification**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  npm run typecheck
  ```

  Expected: PASS.

## Task 7: Chat Evals And Manual Smoke

**Files:**
- Modify existing chat eval fixtures if present; otherwise add focused test cases near current AgentV2 chat eval/test harness.
- Test likely candidates:
  - `tests/agent-v2-production-chat-pipeline.spec.ts`
  - `tests/agent-v2-responses-runtime.spec.ts`
  - existing `npm run test:chat` fixture set

- [x] **Step 1: Add golden chat cases**

  Required scenarios:
  - lowercase concrete product: `kannst du mir sagen, was du von meinem jean & lean conditioner hältst`
  - partial concrete product with unclear category: `Was hältst du von Garnier Hair Food?`
  - not-found supported category -> intake offer
  - ambiguous -> clarification, no intake card
  - broad brand-family ask: `Welche Pantene Produkte empfiehlst du?` -> no lookup/intake requirement
  - background mention: `Ich benutze Pantene Pro-V Shampoo. Wie oft sollte ich waschen?` -> no forced lookup
  - unsupported category -> no intake card

- [x] **Step 2: Run focused suites**

  Run:

  ```bash
  npx tsx --test tests/agent-v2-named-product-context.spec.ts
  npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
  npx tsx --test tests/agent-v2-responses-runtime.spec.ts
  npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
  ```

  Expected: PASS.

- [x] **Step 3: Run chat eval**

  ```bash
  npm run test:chat
  ```

  This is required verification for this plan. It does not replace focused AgentV2 tests, browser smoke, or the historical replay.

  Result: PASS on 2026-06-22 against `http://localhost:3168`, 13/13 scenarios and 68/68 assertions. Report: `test-results/chat-eval/chat-eval-2026-06-22T17-42-49.json`.

- [ ] **Step 4: Manual browser smoke**

  With dev server running, test:
  - unknown concrete product -> assistant defers and intake card appears
  - ambiguous product -> assistant asks clarification and no card appears
  - broad category/brand ask -> no intake card

  Use existing login/dev account flow from the repo's QA conventions.

## Task 8: Documentation And Master Plan Cross-Reference

**Files:**
- Modify: `plans/2026-06-10-product-intake-intelligence.md`
- Modify: `plans/2026-06-22-agent-native-product-lookup.md` if implementation discoveries change scope

- [x] **Step 1: Update master product-intake plan**

  Add a short note in the implementation ledger that AgentV2 product lookup correctness is split into this focused plan:

  ```text
  Agent-native product lookup and validator enforcement are tracked in plans/2026-06-22-agent-native-product-lookup.md. This is the source of truth for the Phase 5 post-smoke architecture correction.
  ```

- [x] **Step 2: Record replay result summary after running it**

  Once the offline replay is run, add a short verification note to this focused plan:
  - report path
  - total rows tested
  - status counts
  - any manual review concerns

  Do not commit raw production-derived examples unless they are sanitized and explicitly approved as fixtures.

## Final Verification

Run before code review:

```bash
npm run typecheck
npx tsx --test tests/agent-v2-contracts.spec.ts
npx tsx --test tests/agent-v2-named-product-context.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/product-intake-replay-user-product-usage-lookup.spec.ts
```

Run chat eval:

```bash
npm run test:chat
```

Manual smoke and historical replay are required before merge because this touches visible chat behavior and product-intake card rendering.

## Review Gates

- Run `$superpowers:requesting-code-review` after implementation and focused checks.
- Run Claude code review after implementation if Claude CLI is available.
- Run `ready-check` before shipping because this changes trust-sensitive chat behavior.
- Do not commit, push, PR, merge, or apply migrations without explicit user approval.

## Execution Handoff

Recommended execution: `superpowers:subagent-driven-development`.

Use one subagent for schema/validator/runtime changes and a separate subagent for the offline replay script if parallelism is desired. Review after each task group because schema changes can produce broad fixture churn.
