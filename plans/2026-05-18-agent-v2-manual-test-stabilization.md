# AgentV2 Manual Test Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for implementation. Use TDD for validator, runtime, Compare Lab, and answer-quality guidance changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize AgentV2 after the latest manual Compare Lab runs so correct tool choices survive validation, routine/product context carries across turns, and German answer quality feels production-ready.

**Architecture:** Keep AgentV2 as one Responses-based loop with typed tools and terminal `submit_final_answer`. Do not add a deterministic German intent router or separate renderer. Improve the boundaries around evidence validation, repair, session/run traces, product-context continuity, product naming, and answer style.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, Zod, Node test runner, Compare Lab JSONL traces, AgentV2 guidance packages.

---

## Source Runs

This plan comes from two saved Compare Lab judgments:

- `tmp/agent-compare-runs.jsonl` line 14, `2026-05-18T09:47:12.440Z`, Nick routine chain:
  1. "Ich möchte meine Routine verbessern. Wie kann ich da am besten vorgehen?"
  2. "okay ja dann zeig mir mal meine angepasste routine"
  3. "okay ja mehr glanz wäre gut"
  4. "Ja zeig mir gerne welcher Leave-In am besten passt."
- `tmp/agent-compare-runs.jsonl` line 15, `2026-05-18T10:05:57.241Z`, Phil product follow-up chain:
  1. "ich brauch mal ein neues shampoo aber weiß nicht welches"
  2. "ah sollte ich auch eine spülung verwenden?"
  3. "ja sag mir gerne welchr gut passt"

## User Situation

Manual testing shows AgentV2 is improving. The tool routes are mostly correct, but the system still creates avoidable visible failures and quality issues:

- Nick turn 2 called `build_or_fix_routine` correctly, but validation rejected a semantically correct evidence quote (`zeige mir meine angepasste routine` vs latest user text `zeig mir mal meine angepasste routine`), then terminal-only repair could not fix the prior tool argument.
- The failed Nick turn replaced the active routine context summary with a fallback clarification, weakening the next turn's session state.
- Nick turn 4 produced a strong Leave-in recommendation but required terminal repair because the first `routine_product_deep_dive` payload missed required fields.
- Phil turn 1 and turn 3 selected the correct tools and products, but the German prose used English-ish vocabulary (`Picks`, `Fit`) and the final next-step offer showed weak referential continuity: it did not seem aware that shampoo had already been recommended earlier in the chain.
- Phil's shampoo and conditioner top recommendations shared the same display name (`Langhaarmädchen Lovely Long`) across different categories, but product cards and answer introductions already carry category context; no product-name change is planned.
- Unsaved Compare Lab runs can be lost if the tester does not click judgment save; this is accepted for now to keep Compare Lab simple.

## Promised End-State

After implementation:

- Correct AgentV2 tool decisions are not discarded by brittle evidence quote matching.
- Repair either fixes the failure family or falls back without corrupting the last good routine state.
- Routine deep-dive payload failures become rare through clearer terminal contract guidance.
- Product follow-up answers use structured conversation state to resolve references, avoid repeating stale offers, and choose natural next steps.
- German user-facing prose avoids casual English labels unless a product name requires them.
- Saved Compare Lab judgments remain the analysis source; unsaved draft autosave is explicitly out of scope.

## Scope Boundaries

In scope:

- AgentV2 runtime, validator, Compare Lab runner, guidance package text, and focused tests.
- Answer-quality guidance that is specific, testable, and low-risk.

Out of scope:

- Production V1 chat loop changes.
- Recommendation ranking changes.
- Product catalog migrations or data cleanup.
- A separate renderer model call.
- A deterministic German intent router.
- Durable production memory.
- Compare Lab draft autosave.
- Product display-name rewriting for same-name catalog entries.
- UI redesign of Compare Lab beyond trace persistence/debug needs.

## Open Decisions Before Implementation

These decisions should be aligned before coding:

1. **Evidence quote strictness** — LOCKED
   - Evidence quotes are lightweight provenance, not semantic intent validation.
   - Block only empty, useless, or completely ungrounded evidence.
   - Mild normalization is allowed for casing, punctuation, diacritics, and decorative quotes.
   - Do not build German synonym/intent logic into the validator.
   - Non-exact but plausible evidence mismatches should become trace warnings, not user-visible fallback failures.

2. **Repair scope**
   - LOCKED: keep terminal-only repair for this pass.
   - Do not add tool-aware repair now.
   - Lightweight evidence provenance should prevent the Nick-style false failure without adding another repair path.
   - Revisit tool-aware repair only if future evals show valid tool calls still fail after evidence validation becomes non-blocking for plausible provenance mismatches.

3. **Routine context on failed turns** — LOCKED
   - Real clarifications that pass validation remain normal conversation context.
   - Failure fallbacks created by validation failure, repair failure, or generic runtime recovery must not replace the last valid routine thread summary, visible steps, or layer.
   - Failed turns still stay visible in turn history and trace/debug output.

4. **Product-context / referential-continuity context inside Compare Lab** — LOCKED
   - Keep explicit per-run conversation state in Compare Lab session state only.
   - This state is tool-derived factual continuity and conversation continuity, not routing logic.
   - It lists prior surfaced product categories, product IDs, product names, and the last product category.
   - Do not add a deterministic `last_assistant_offer_de` field for now.
   - The transcript remains available for natural language continuity; guidance should remind GPT-5.4-mini to inspect the previous assistant question/offer when the latest user turn is short or referential.
   - Do not encode special rules such as `never offer shampoo again`; keep the guidance outcome-level: resolve ambiguous follow-ups against recent context and advance the conversation instead of repeating stale ground.

5. **English-ish vocabulary** — LOCKED
   - Use outcome-first German style guidance plus non-runtime regression/eval checks.
   - Do not add a live hard validator that blocks final answers because of individual words.
   - Guidance should prefer natural German advisor vocabulary such as `Empfehlungen`, `passt gut zu dir`, `passende Option`, `nächster Schritt`, and `Zusatzpflege`.
   - Avoid casual English helper labels unless they are part of a product name, category name users know, or truly natural German usage in context.
   - Regression checks should preserve known manual feedback examples without becoming broad deterministic style policing.

6. **Ambiguous same-line product names** — LOCKED OUT OF SCOPE
   - Do not change product display names for now.
   - Catalog names remain the source of truth.
   - Product cards already carry category tags, and product recommendation introductions should frame the category, e.g. `diese Shampoos` or `diese Spülungen`.
   - If future testing shows users remain confused, revisit category-aware display labels then.

7. **Compare Lab autosave** — LOCKED OUT OF SCOPE
   - Do not add draft autosave for now.
   - Saved judgments remain the source for manual run review.
   - Testing discipline: click `Urteil speichern` for every run that should be analyzed later.

## Target File Map

- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Relax meaningful evidence matching without accepting vague words.
  - Keep provenance based on latest user message, recent evidence text, and active routine context.
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Classify evidence/tool mismatch failures more safely.
  - Preserve contextual fallbacks without corrupting routine thread state.
  - Strengthen terminal guidance for `routine_product_deep_dive`.
  - Add German vocabulary constraints to runtime instructions if not fully handled by guidance.
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Preserve last valid routine context on failed turns.
  - Track per-run referential continuity context across turns.
  - Include prior surfaced products/categories and the last surfaced product category.
- Modify: `src/lib/agent-v2/contracts.ts`
  - Add a small AgentV2 product-thread context schema if needed.
- Modify: `src/components/labs/agent-compare-lab.tsx`
  - No autosave UI changes in this plan.
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
  - Add German vocabulary and structure rules.
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
  - Add outcome-level continuity guidance for product follow-ups and next-step offers.
- Modify: `data/agent-v2/guidance/base/answer-contract.md`
  - Re-emphasize required `routine_product_deep_dive` fields and visible answer completeness.
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-v2-tool-projections.spec.ts`
- Test: `tests/agent-compare-api.spec.ts`
- Test: `tests/agent-v2-manual-regression.spec.ts`

## Task 1: Make Evidence Quotes Lightweight Provenance

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add a failing evidence test for Nick turn 2**

Add a test where:

```ts
latestUserMessage = "okay ja dann zeig mir mal meine angepasste routine"
request_interpretation.evidence_quote = "angepasste routine"
build_or_fix_routine.evidence_quote = "zeige mir meine angepasste routine"
```

Expected: validation does not block. It may emit a non-blocking provenance warning if the quote is not an exact normalized substring.

- [ ] **Step 2: Add a failing evidence test for vague evidence**

Use:

```ts
latestUserMessage = "okay ja dann zeig mir mal meine angepasste routine"
request_interpretation.evidence_quote = "routine"
```

Expected: validation fails with `request_interpretation_evidence`.

- [ ] **Step 3: Implement lightweight provenance matching**

Update evidence validation so it:

- blocks empty evidence
- blocks clearly useless evidence such as a single generic token
- blocks evidence that is completely absent from latest user message, recent evidence text, and active routine context
- accepts exact normalized containment
- allows casing, punctuation, diacritic, and decorative quote normalization
- emits warnings rather than blocking for plausible but non-exact evidence

Do not add German synonym dictionaries, domain intent mappings, or word-variation rules.

- [ ] **Step 4: Run focused validation tests**

Run:

```bash
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: all validator tests pass.

## Task 2: Preserve Last Valid Routine Context On Failed Turns

**Files:**
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add a failing multi-turn Compare runner test**

Model a two-turn routine flow:

1. Turn 1 returns a valid `routine` answer with visible steps.
2. Turn 2 returns a validation fallback/repair failure.

Expected:

- Turn 2 answer may be fallback.
- The stored routine thread context after turn 2 remains the valid context from turn 1.
- The fallback answer does not become `routineThreadContext.summary_de`.
- A naturally validated `answer_mode="clarification"` turn still remains visible in conversation history and trace.

- [ ] **Step 2: Implement last-valid context preservation**

Update the routine thread update path so it only writes a new routine context when:

- `result.final_answer` validates successfully
- `failure_stage` is null
- `answer_mode` is routine-compatible and not fallback clarification

- [ ] **Step 3: Ensure trace still records the failed turn**

The failed turn should remain visible in `turns[].agent_v2_trace`, including validation errors and fallback reason.

- [ ] **Step 4: Run focused runtime/compare tests**

Run:

```bash
node --import tsx --test tests/agent-v2-compare-runner.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Expected: all focused tests pass.

## Task 3: Reduce Routine Deep-Dive Terminal Repairs

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `data/agent-v2/guidance/base/answer-contract.md`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add a test for `routine_product_deep_dive` required fields in repair guidance**

Assert runtime instructions include this exact required field set for `routine_product_deep_dive`:

```txt
user_facing_answer_de, step_id, category, recommendations, return_to_routine_offer_de
```

- [ ] **Step 2: Strengthen terminal mode guidance**

Add mode-specific guidance:

```txt
For answer_mode=routine_product_deep_dive, payload must include step_id, category, recommendations, and return_to_routine_offer_de. Do not use comparison_notes_de or usage_notes_de as substitutes.
```

- [ ] **Step 3: Run focused runtime tests**

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: all runtime tests pass.

## Task 4: Track Referential Continuity Across Turns

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add product/conversation continuity context schema**

Add a small context shape:

```ts
{
  selected_categories: SelectableProductCategory[]
  selected_products: Array<{
    product_id: string
    name: string
    category: SelectableProductCategory
  }>
  last_product_category: SelectableProductCategory | null
}
```

- [ ] **Step 2: Add a failing Phil regression test**

Run a three-turn fake Compare flow:

1. shampoo recommendation
2. conditioner education
3. conditioner recommendation

Expected: turn 3 input includes continuity context showing:

- prior surfaced `shampoo` products
- the current active category from turn 2/3 is `conditioner`
- the latest user ask is a product recommendation follow-up

- [ ] **Step 3: Add outcome-level continuity instruction**

Add to AgentV2 input:

```txt
Use the recent conversation and surfaced product facts to resolve ambiguous follow-ups and choose a natural next step. If the latest user message is short or referential, check whether it answers the previous assistant question or next-step offer before choosing tools or writing the final answer. If a category or product was already surfaced, account for it in your wording instead of acting as if it is new.
```

- [ ] **Step 4: Add regression assertion for referential continuity**

In `tests/agent-v2-manual-regression.spec.ts`, add a fixture for the Phil chain and assert the expected answer-quality outcome:

- the final answer recognizes the current follow-up is about conditioner
- the final next step advances the conversation through usage, routine integration, comparison, or choosing among the conditioner options
- the final answer does not behave as if prior shampoo recommendations do not exist

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --import tsx --test tests/agent-v2-compare-runner.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-manual-regression.spec.ts
```

Expected: all focused tests pass.

## Task 5: Improve German Answer Vocabulary Without Runtime Style Policing

**Files:**
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `tests/agent-v2-manual-regression.spec.ts`

- [ ] **Step 1: Add guidance compiler test**

Assert `base.tone_and_format.v1` includes German alternatives:

- `Empfehlungen` instead of `Picks`
- `passt gut` or `passend` instead of `Fit`
- `nächster Schritt` instead of `Deep Dive`

- [ ] **Step 2: Update tone guidance**

Add:

```md
Use natural German advisor vocabulary. Prefer "Empfehlungen", "passt gut zu dir", "passende Option", "nächster Schritt", and "Zusatzpflege". Avoid casual English helper labels when a natural German wording is clearer, but do not treat individual words as hard runtime bans when they are part of product names, familiar category language, or otherwise natural in context.
```

- [ ] **Step 3: Add non-runtime regression examples**

In manual regression fixtures, capture the Phil turn 1 answer-quality expectation:

- prefer `Meine 3 Empfehlungen` or similarly natural German section wording
- prefer `passt gut zu dir`, `ähnlich passend`, or `gute Alternative` over casual English `Fit`
- do not add a live validator that blocks user responses solely on these words

Expected improved shape:

```txt
Meine 3 Empfehlungen:
...
ähnlich passend für dich
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --import tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts
```

Expected: all focused tests pass.

## Verification Plan

Automated checks:

```bash
npm run test:agent
npm run typecheck
npm run lint
git diff --check
```

Manual Compare Lab checks:

1. Re-run Nick routine chain.
   - Turn 2 should show the adapted routine, not clarification.
   - Turn 3 should still continue into shine goals.
   - Routine context should not be overwritten by failed fallback text.
2. Re-run Phil product chain.
   - Turn 1 should avoid `Picks` and `Fit`.
   - Turn 3 should recommend conditioners.
   - Turn 3 should show continuity with the prior shampoo recommendation and advance the conversation naturally.
   - Same-name product lines may remain catalog names; category context should be clear from intro/card category tags.
3. Save each run intended for review and confirm `tmp/agent-compare-runs.jsonl` records curated saved judgment data.

## Ready Check

Because this touches recommendation behavior, answer copy, trust boundaries, and Compare Lab UI/dev workflow, run `ready-check` before claiming implementation readiness.

## Execution Handoff

After decisions are aligned:

1. Use `branch-gate`.
2. Stay in the existing AgentV2 worktree unless branch hygiene requires a new child worktree.
3. Use `superpowers:subagent-driven-development`.
4. Commit each task slice after focused tests pass.
