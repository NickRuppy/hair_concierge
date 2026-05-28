# Agent V2 Conversation Closure Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the tests-first loop. Use `superpowers:executing-plans` by default; this is a focused guidance/validator/eval pass, not a multi-workstream feature.

**Spec:** [docs/superpowers/specs/2026-05-27-agent-v2-conversation-closure-polish-design.md](/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/docs/superpowers/specs/2026-05-27-agent-v2-conversation-closure-polish-design.md)

**User Situation:** GPT-5.4 / Agent V2 has strong reasoning and tool use, but final chat closings can still feel generic, overly passive, repetitive, or like a product CTA. The desired behavior is not a new architecture; it is better conversational judgment at the end of the message.

**Promised End-State:** Production Agent V2 answers close naturally in German with a slightly proactive warm-coach style: stop cleanly when done, ask one material question when needed, or offer one concrete feasible next step. Severe bad closers are blocked by the final-answer validator; weaker issues are warnings/eval signals.

**Chosen Architecture:** Single-call GPT-5.4-native answer composition. Improve base guidance, terminal-answer validation, and regression/eval coverage. Do not add chips, a second model call, a separate closure selector, or a full terminal contract rewrite.

**Aligned Decisions From Review:**

- The goal is general closure intelligence, not fixing one Pantene/Leave-in edge case.
- The visible close is owned by `payload.user_facing_answer_de`.
- Keep `next_step_offer_de` in the schema for compatibility, but treat it as nullable legacy metadata. It must not be required to preserve routine context or introduce a second offer.
- Closures must not open unsupported analysis lanes. In particular, do not proactively offer INCI/ingredient-list analysis, whether pasted, linked, photographed, or named, unless future dedicated ingredient tooling exists.
- User-initiated named-product product-detail questions remain inside the existing `select_products`/catalog contract. If ingredient-related product facts are unsupported, the answer should say so and stay with supported fit data; the close still must not invite INCI analysis.
- Block only objectively bad closers: generic bait, impossible offers, unsupported capability/claim promises, repeated already-answered questions, or multiple stacked closing questions.
- Style quality, warmth, mild redundancy, and missed better-close opportunities are warnings/eval/manual-review signals, not hard validator blocks.
- Positive smart-closure examples should be behavioral expectations, not approved German snippets or deterministic phrase templates. The user reviews candidate cases before they become fixtures.
- Default posture is medium proactive; light/clean-stop for complete answers; stronger `Ich kann ...` offers only when genuinely useful and serviceable.

## Scope Boundaries

- Production chat / Agent V2 behavior only.
- No legacy RAG.
- No clickable chips.
- No second model call.
- No deterministic final-answer renderer.
- No schema rework unless tests prove the natural approach cannot stabilize.
- No removal of `next_step_offer_de` from the schema in this pass.
- No recommendation-engine logic changes.
- No product-claim expansion.
- No ingredient/INCI analysis lane.
- Keep visible text in German.
- Preserve the current Agent V2 tool and terminal answer flow.

## Target File Map

- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
  - Merge the closure policy, voice standard, and anti-pattern examples into the existing `Natural Conversation Frame` section.
- Modify: `data/agent-v2/guidance/base/general-advice.json`
  - Align general-advice next-step guidance with the new policy.
- Modify: `data/agent-v2/guidance/base/general-advice.md`
  - Keep markdown and JSON guidance synchronized; both are checked-in authoritative guidance inputs.
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
  - Merge the closure posture into existing `tone.feasible_cta` / `tone.non_redundant_ending` rubrics rather than creating parallel closure metadata.
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Update terminal payload field guidance so `next_step_offer_de` is nullable legacy metadata, not the routine-return vehicle.
- Modify: `src/lib/agent-v2/validation/user-facing-language.ts`
  - Add loose bad-close detection helpers for generic, infeasible, redundant, and multi-question endings.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Wire closure findings into final-answer validation, blocking only severe objective failures and warning on style issues.
  - Loosen any current requirement that routine-thread product recommendations must include non-empty `next_step_offer_de`; routine continuity should be validated through `routine_context`.
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`
  - Add validator coverage for blocked bad closes and non-blocking weak-close warnings.
- Modify: `tests/agent-v2-guidance-compiler.spec.ts`
  - Assert the paired markdown/JSON guidance exposes the closure policy through stable rubric ids/metadata where possible, not fragile exact prose.
- Modify: `tests/agent-v2-manual-regression.spec.ts`
  - Add or update representative manual expectations for final sentence quality.
- Modify if needed: `plans/2026-05-26-agent-v2-response-quality-stabilization.md`
  - Only if this plan needs a short cross-reference; do not fold the closure work into that older plan.

## Task 0: Demote `next_step_offer_de` To Nullable Legacy Metadata

- [x] Add/update tests proving `next_step_offer_de: null` is valid for:
  - a complete `general_advice` answer.
  - a complete `routine` answer when the plan already gives the next useful move.
  - a `product_recommendation` inside an active routine thread, as long as `routine_context.active` and `routine_context.return_path` are preserved.
- [x] Update the routine-thread product recommendation validator so it requires routine context continuity, not a visible CTA.
  - Keep the `routine_context.active` and non-empty `return_path` checks.
  - Drop the `next_step_offer_de` non-emptiness check.
  - Rename or repurpose the validator id so it describes routine context continuity, not a CTA requirement.
- [x] Update terminal payload guidance:
  - `user_facing_answer_de` is the complete user-visible close.
  - `next_step_offer_de` may be null.
  - if present, it must mirror/summarize the visible final move and must not introduce a separate offer.
- [x] Remove wording in `src/lib/agent-v2/runtime/responses-agent.ts` that says routine-thread product recommendations must use `payload.next_step_offer_de` to return to routine.
- [x] Verify `data/agent-v2/guidance/base/product-recommendation.md` still allows a short bridge back to the routine, but does not route that bridge through `next_step_offer_de`.

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "next_step_offer|routine thread|conversation close"
```

Expected first run: fail.

## Task 1: Add Failing Validator Tests For Objective Bad Closers

- [x] In `tests/agent-v2-final-answer-validator.spec.ts`, add cases that should block:
  - generic close: `Moechtest du, dass ich dir mehr dazu erklaere?`
  - generic offer: `Wenn du moechtest, kann ich dir noch mehr Tipps geben.`
  - infeasible offer: `Schick mir ein Foto, dann kann ich es beurteilen.`
  - unsupported claim check: `Schick mir den Link, dann pruefe ich, ob es chelatiert.`
  - unsupported ingredient lane: proactive offers to inspect or judge INCI/ingredient lists, whether pasted, linked, photographed, or named.
  - unsupported ingredient lane must not block a user-initiated named-product `product_detail` answer that uses `select_products`/catalog data or says the current product data cannot safely confirm the claim.
  - clearly redundant product offer after products were already recommended, only when it asks to do the same completed action again.
  - two closing questions in one answer.
  - asking for a datapoint already present as a literal/specific noun in the latest user message or recent context; semantic similarity beyond literal overlap should warn or defer, not block.
- [x] Reuse existing local base-answer/request-interpretation helpers in the spec file; do not invent a broad fixture framework for this pass.
- [x] Assert the validator ids are specific enough to debug, e.g. `bad_conversation_close_generic`, `bad_conversation_close_infeasible`, `bad_conversation_close_redundant`, `bad_conversation_close_multi_question`.

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts --test-name-pattern "conversation close|bad close|generic close"
```

Expected first run: fail.

## Task 2: Add Non-Blocking Warning Tests

- [x] Add validator cases that warn, not block:
  - harmless but bland close.
  - no close on a non-trivial `general_advice` answer.
  - a suggestion that is feasible but underspecified.
  - mildly redundant or assistant-y wording that is not misleading.
  - missed opportunity for a smarter close.
  - repeated-data questions where the overlap is semantic rather than literal.
- [x] Assert warnings do not make `ok` false.
- [ ] Ensure `safety_boundary` answers are not warned for avoiding upbeat CTA energy.

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts --test-name-pattern "conversation close"
```

Expected first run: fail.

## Task 3: Implement Loose Closure Validation

- [x] Add one main helper in `src/lib/agent-v2/validation/user-facing-language.ts` or a nearby validation module:
  - `analyzeConversationClose(answer, context)`
  - It may use small private helpers, but avoid exporting a mini closure framework.
- [x] Keep detection conservative. Prefer false negatives over blocking good GPT-5.4 prose.
- [x] Use normalized text helpers for German umlaut/ASCII variants.
- [x] Block only objective severe bad patterns.
- [x] Warn for mild style/redundancy/missed-opportunity issues.
- [x] Avoid category-specific hair-care logic unless needed for obviously infeasible offers.
- [x] Treat proactive ingredient/INCI-list next-step offers as unsupported capability offers, not as serviceable clarifications.
- [x] Preserve user-initiated named-product product-detail flows: if the model used product metadata or returns an unsupported-signal caveat, the close analyzer should not block merely because the topic is ingredient-related.
- [x] Reuse the existing user-facing-language normalization path for German umlauts/ASCII variants; do not roll a separate normalizer.

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts --test-name-pattern "conversation close|user-facing language"
```

## Task 4: Merge Closure Policy Into Existing Tone And Format Guidance

- [x] In `data/agent-v2/guidance/base/tone-and-format.md`, extend the existing `Natural Conversation Frame` section; do not add a parallel closure section.
- [x] In `data/agent-v2/guidance/base/tone-and-format.json`, update the existing `tone.feasible_cta` and `tone.non_redundant_ending` rubrics, or add one stable rubric only if the existing two cannot carry the policy without ambiguity.
- [x] Encode the aligned policy:
  - slightly proactive by default for non-trivial advice,
  - balanced but suggestion-led,
  - one visible final sentence for most medium/long answers,
  - short answers may weave the close into the final paragraph,
  - ask only one material question,
  - prefer concrete feasible next-step suggestions,
  - allow concrete `Ich kann ...` sparingly,
  - forbid generic "more help" language.
- [x] Include behavioral guidance, not approved reusable German snippets:
  - what a good suggestion-led close accomplishes,
  - when a material question is worth asking,
  - when a clean stop is better,
  - why generic and infeasible closers are bad.
- [x] Ensure the guidance says the model should not force a close when the answer is complete.
- [x] Ensure the guidance says proactive ingredient/INCI-list checks are not a next-step lane, while user-initiated named-product product-detail questions remain constrained by product metadata.
- [x] Keep wording model-native and non-stiff; do not introduce a structured closure object.

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts --test-name-pattern "tone|format|next step|question"
```

## Task 5: Align General Advice Guidance

- [x] Update `data/agent-v2/guidance/base/general-advice.md` and `data/agent-v2/guidance/base/general-advice.json` together; both are checked-in guidance inputs.
- [x] Merge the aligned posture into the existing `advice.feasible_next_step` rubric instead of adding overlapping closure guidance:
  - concept first,
  - practical close,
  - no unsupported offers,
  - warm coach tone,
  - no repeated question.
- [x] Keep existing category/routine boundaries intact.
- [x] Add or update guidance compiler assertions against stable package metadata/rubric ids where possible; avoid brittle exact-prose assertions.

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

## Task 6: Add Manual Regression Cases For Closing Quality

- [x] Draft representative positive smart-closure cases in a temporary review note such as `tmp/agent-v2-closure-positive-cases.md` for user review before converting them into fixtures. Use behavioral expectations, not approved sentence templates.
- [ ] After review, add cases in `tests/agent-v2-manual-regression.spec.ts` covering:
  - general advice ends with one practical feasible next step.
  - routine answer closes with one next routine move, not a full restart.
  - product recommendation does not offer product picks again after recommending products.
  - troubleshooting asks one material diagnostic question when needed.
  - simple complete answer can stop cleanly.
  - safety boundary avoids upbeat CTA and uses only a safe next step if appropriate.
  - unsupported product-detail/claim contexts steer back to serviceable product metadata, category, routine, or usage logic without opening ingredient/INCI, photo, link, or unsupported-claim analysis.
- [ ] Keep assertions qualitative but specific, matching the existing manual-regression style.
- [ ] Do not anchor tests on exact German closing snippets unless the test is specifically about banned phrasing.

Run:

```bash
npx tsx --test tests/agent-v2-manual-regression.spec.ts
```

## Task 7: Run Focused Agent V2 Verification

- [x] Run focused tests:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts
```

- [x] Run runtime smoke around existing Agent V2 response behavior:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "final answer|routine follow-up|product follow-up|guidance"
```

- [x] Run the broader Agent V2 test cluster if time allows:

```bash
npx tsx --test tests/agent-v2-*.spec.ts
```

## Task 8: Manual Review Checklist

Review at least these production-chat style prompts in the GPT-5.4 worktree:

- `Brauche ich Leave-in?`
- `Welches Shampoo passt zu mir?`
- `Mein Conditioner macht alles platt, was soll ich tun?`
- `Fass mir die Routine kurz zusammen.`
- `Kommt Oel vor oder nach Leave-in?`
- `Ich habe juckende Kopfhaut und Schuppen, was kann ich machen?`
- `Was ist der naechste beste Schritt fuer meine Routine?`
- `Welches silikonfreie Leave-in passt zu mir?`
- `Kannst du die INCI pruefen, wenn ich sie dir schicke?`
- Multi-turn: `Welches Leave-in passt zu mir?` -> `Bau das Produkt bitte in meine Routine ein.` -> `das von Pantene`

For each answer, judge the close separately:

- Is the main answer complete first?
- Is the final sentence specific to this user turn?
- Is it warm-coach, not stiff consultant?
- Is there at most one question?
- Is the next step feasible with current tools/context?
- Is it non-redundant with the answer?
- Would stopping cleanly have been better?

Expected edge-case posture:

- For `Kannst du die INCI pruefen, wenn ich sie dir schicke?`, the answer should not offer ingredient-list analysis. It should briefly explain that INCI-based product judgment is not a supported lane here and redirect only to serviceable options such as named-product catalog facts when available, supported category fit, usage, routine placement, or asking for the product name if the user wants a catalog-grounded product-detail check.

## Task 9: Rollback / Over-Block Guard

- [x] Add a small rollback posture for the new closure analyzer:
  - New closure findings should be easy to downgrade from block to warn if Compare Lab or production review shows over-blocking.
  - Prefer a narrow constant/config flag near `analyzeConversationClose` over a broad feature system unless an existing local flag pattern is already convenient.
  - Document which validator ids are new so they can be disabled or downgraded surgically.

## Handoff

After this plan is approved:

1. Run `branch-gate` in `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan`.
2. Preserve existing uncommitted Agent V2 work; do not revert unrelated changes.
3. Implement with `superpowers:executing-plans`.
4. Run focused tests before broader Agent V2 tests.
5. Use `ready-check` before shipping because this touches trust-facing chat behavior.
