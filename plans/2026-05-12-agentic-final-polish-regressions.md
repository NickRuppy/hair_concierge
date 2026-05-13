# Agentic Final Polish Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete regressions found in the final Compare Lab multi-turn runs while keeping the tool-loop architecture simple, deterministic where it should be deterministic, and Compare Lab-only.

**Architecture:** Keep the rewritten orchestrator prompt and the existing authoritative tools. Add focused regression tests first, then repair four stable boundaries: final-answer hygiene, oil-purpose inference, prior-product explanation routing, and scalp-safe multi-turn routine context. Do not add an LLM classification step, do not introduce pairwise category matrices, and do not wire production chat.

**Tech Stack:** Next.js App Router, TypeScript, Node test runner via `tsx --test`, existing agentic tool loop, deterministic `select_products` and `build_or_fix_routine`, Compare Lab at `/labs/agent-compare`.

---

## Spec / Source

- Base design: `docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`
- Current branch plan lineage:
  - `plans/2026-05-05-agentic-tool-loop.md`
  - `plans/2026-05-11-agentic-advisor-guidance-harvest.md`
  - `plans/2026-05-11-agentic-multi-category-guidance.md`
  - `plans/2026-05-12-agentic-context-conflict-repair.md`
  - `plans/2026-05-12-agentic-overlay-guidance-polish.md`
- Fresh evidence: five Compare Lab API multi-turn replays saved locally in `tmp/agent-lab-five-multiturn-runs.json`

## User Situation

The `Produkt-Evaluation` / guidance-tool variant is now usually better than the classic baseline, but a final round of testing exposed four real failure modes:

1. Generic "lass es mich wissen" closers still leak in variants not covered by the current sanitizer.
2. Oil-purpose inference can misclassify "als Finish, nicht auf die Kopfhaut" as pre-wash/scalp oil because it sees the word `kopfhaut`.
3. Explanation follow-ups such as "warum proteinlastige Conditioner?" are under-grounded when the agent only loads general guidance instead of reusing authoritative product-selection facts.
4. Scalp symptom multi-turn context is not strong enough when the user asks an anaphoric follow-up like "was kann ich bis dahin in der Routine machen?", causing generic routine steps to be framed too close to scalp treatment.

## Promised End-State

After this pass:

- The same five multi-turn runs no longer show the identified regressions.
- Finish-oil requests with explicit "not scalp" wording select finish/length oil behavior, not pre-wash natural oils.
- "Why did you recommend X?" answers are grounded in `select_products` output when the prior turn involved product recommendations.
- Scalp symptom follow-ups keep the recent scalp facts in the current answer without mutating the saved profile.
- Routine answers do not frame mask, oil, or deep-cleansing/reset as soothing scalp treatment for irritated/dandruff/dry-flake cases.
- Final answers end with a concrete next step or stop cleanly, not generic "let me know" language.

## Scope Boundaries

- In scope: Compare Lab tool loop, tests, deterministic tool-input projection, answer-context capsules, final-output sanitizer.
- Out of scope: production chat wiring, additional LLM classification calls, broad prompt rewrite, new product ranking rules, pairwise category-comparison matrix.
- Preserve: deterministic `select_products` and `build_or_fix_routine` authority.
- Preserve: user-stated current facts apply to the current answer; they do not permanently overwrite the saved profile.

## Target File Map

- Final-answer hygiene:
  - Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Test: `tests/agentic-tool-loop.spec.ts`
- Oil-purpose inference:
  - Modify: `src/lib/oil/purpose.ts`
  - Test: `tests/agent-select-products-tool.spec.ts`
  - Optional low-level test if a file exists/gets created: `tests/oil-flow.spec.ts`
- Prior product explanation routing:
  - Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Test: `tests/agentic-tool-loop.spec.ts`
  - Test: `tests/agent-final-render-prompt.spec.ts`
- Scalp-safe routine context:
  - Modify: `src/lib/agent/orchestrator/current-turn-context.ts`
  - Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Modify only if needed: `src/lib/routines/planner.ts`
  - Test: `tests/agentic-tool-loop.spec.ts`
  - Test: `tests/agent-final-render-prompt.spec.ts`
  - Test only if planner behavior must change: `tests/routine-planner.spec.ts`
- Verification script or scratch replay:
  - Use: `tmp/agent-lab-five-multiturn-runs.json`
  - Do not commit real run logs.

---

## Task 1: Add Focused Regression Tests First

**Goal:** Capture the four exact observed failures before changing implementation.

- [ ] **Step 1: Add a final-closer regression in `tests/agentic-tool-loop.spec.ts`**

Add a test near the existing final-answer polish tests around the `tool-loop polishes...` block. The failing input should include the exact leaked pattern:

```ts
"Oel kann als Finish fuer trockene Spitzen sinnvoll sein. Wenn du mehr ueber die Anwendung oder konkrete Produkte wissen moechtest, lass es mich wissen!"
```

Expected after polish:

```ts
"Oel kann als Finish fuer trockene Spitzen sinnvoll sein."
```

Also add one variant:

```ts
"Wenn du mehr ueber die Anwendung oder konkrete Produktempfehlungen erfahren moechtest, lass es mich wissen!"
```

Expected: the generic closer is removed or replaced with one concrete next step only when a specific next step is available.

- [ ] **Step 2: Add oil-purpose regression for explicit finish and negated scalp**

In `tests/agent-select-products-tool.spec.ts`, add a test using an oil product request like:

```ts
message: "eher als finish, nicht auf die kopfhaut"
category: "oil"
```

Expected assertions:

```ts
assert.equal(runtime.categories.oil.targetProfile?.purpose, "styling_finish")
assert.notEqual(runtime.categories.oil.targetProfile?.purpose, "pre_wash_oiling")
```

If the exact runtime helper in the file uses `light_finish` for this phrasing, assert that the purpose is one of `["styling_finish", "light_finish"]` and explicitly not `pre_wash_oiling`.

- [ ] **Step 3: Add prior-product explanation routing regression**

In `tests/agentic-tool-loop.spec.ts`, add a multi-turn tool-loop test:

1. First turn has a conditioner product recommendation state or prior assistant text that selected conditioner products.
2. Latest user message: `warum schlaegst du proteinlastige conditioner vor?`
3. Stub model initially attempts only `load_advisor_guidance`, if needed, then verify the loop either instructs/selects `select_products` or blocks the insufficient path and uses `select_products`.

Expected assertions:

```ts
assert.deepEqual(result.tool_calls.map((call) => call.name), ["select_products", "submit_final_answer"])
assert.equal(result.tool_calls[0]?.input?.category, "conditioner")
assert.match(result.final_answer, /Protein|Balance|Struktur|Feuchtigkeit/i)
```

The important invariant is not exact wording. The invariant is: explanation of prior concrete product picks must be grounded by product-selection facts, not only generic guidance.

- [ ] **Step 4: Add scalp routine follow-up regression**

In `tests/agentic-tool-loop.spec.ts`, add a multi-turn test with recent messages:

```ts
[
  { role: "user", content: "meine kopfhaut juckt und ich habe schuppen, welches shampoo soll ich nehmen?" },
  { role: "user", content: "eher trockene kleine schueppchen und gereizt" },
  { role: "user", content: "ok und was kann ich bis dahin in der routine machen?" },
]
```

Expected assertions:

```ts
assert.ok(result.answer_context?.capsule_ids.includes("routine.scalp_safety"))
assert.doesNotMatch(result.final_answer, /Maske[^.?!]*(beruhigt|Kopfhaut|Schuppen)/i)
assert.doesNotMatch(result.final_answer, /Tiefenreinigung[^.?!]*(beruhigt|Kopfhaut|Schuppen)/i)
assert.doesNotMatch(result.final_answer, /\bSie\b/)
```

Acceptable answer shape: gentle interim routine guidance, avoid aggressive scalp friction, conditioner/mask only for lengths if mentioned, professional/dermatological caveat only for persistent or strong symptoms.

- [ ] **Step 5: Run focused tests and confirm they fail for the intended reason**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-select-products-tool.spec.ts
```

Expected: new tests fail on the specific missing behaviors above. Existing unrelated tests should not be newly broken by the test addition itself.

## Task 2: Generalize Final-Answer Hygiene

**Goal:** Remove broad generic closing formulas without hardcoding whole answers.

- [ ] **Step 1: Update `polishAgenticFinalAnswer()` in `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`**

Extend the existing end-anchored sanitizer with one generalized closer pattern that catches:

- `Wenn du mehr ueber die Anwendung oder konkrete Produkte wissen moechtest, lass es mich wissen!`
- `Wenn du mehr ueber die Anwendung oder konkrete Produktempfehlungen erfahren moechtest, lass es mich wissen!`
- `Wenn du weitere Fragen zur Anwendung oder Produktauswahl hast, lass es mich wissen!`

Constraints:

- Anchor to the end of the answer.
- Do not remove specific final questions such as `Sollen wir als naechstes Ziel oder Problem anschauen?`
- Do not alter product names or body text.

- [ ] **Step 2: Run final-hygiene tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: closer regression passes; previous final-answer polish tests still pass.

## Task 3: Fix Oil-Purpose Inference From First Principles

**Goal:** Purpose detection should prioritize the user's application intent, not isolated words.

- [ ] **Step 1: Update `inferOilPurposeFromMessage()` in `src/lib/oil/purpose.ts`**

Implement these priority rules:

1. Explicit finish/styling/length wording wins:
   - `finish`
   - `glanz`
   - `spitzen`
   - `laengen`
   - `flyaways`
   - `frizz`
   - `styling`
2. Negated scalp wording suppresses scalp/pre-wash inference:
   - `nicht auf die kopfhaut`
   - `nicht an die kopfhaut`
   - `nicht fuer die kopfhaut`
   - `nur in die spitzen`
   - `nur in die laengen`
3. True pre-wash/scalp intent still works:
   - `vor dem waschen`
   - `pre-wash`
   - `einwirken`
   - `kopfhaut massieren`
   - `scalp oiling`

Implementation shape:

```ts
const hasExplicitFinishIntent = includesAny(text, STYLING_OIL_EXPLICIT_TERMS) ||
  includesAny(text, STYLING_OIL_CONTEXT_TERMS) ||
  includesAny(text, DRY_OIL_EXPLICIT_TERMS) ||
  includesAny(text, DRY_OIL_CONTEXT_TERMS)

const hasNegatedScalpIntent = matchesAny(text, NEGATED_SCALP_OIL_PATTERNS)

if (hasExplicitFinishIntent && hasNegatedScalpIntent) {
  return includesAny(text, DRY_OIL_CONTEXT_TERMS) ? "light_finish" : "styling_finish"
}
```

Then evaluate true natural/pre-wash intent after negation-aware finish logic.

- [ ] **Step 2: Add or update unit coverage for natural/pre-wash still working**

Add test cases for:

```ts
"ich will oel vor dem waschen einwirken lassen" -> "pre_wash_oiling"
"ich moechte die kopfhaut mit oel massieren" -> "pre_wash_oiling"
"trockenes oel fuer die spitzen, nicht auf die kopfhaut" -> "light_finish"
"eher als finish, nicht auf die kopfhaut" -> "styling_finish" or "light_finish", never "pre_wash_oiling"
```

- [ ] **Step 3: Run oil/product tests**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/recommendation-engine-selection.test.ts
```

Expected: oil purpose regression passes; existing oil reranking and oil missing-info tests still pass.

## Task 4: Route Prior Product Explanations Back Through Product Facts

**Goal:** When the user asks why concrete recommendations were made, answer from the authoritative product trace.

- [ ] **Step 1: Add a lightweight explanation-intent helper in `run-agentic-tool-turn.ts` or nearby**

Detect explanation follow-ups conservatively:

```ts
function hasPriorRecommendationExplanationIntent(message: string): boolean {
  const text = normalizeIntentText(message)
  return /\bwarum\b/.test(text) &&
    /\b(?:schlaegst|empfiehlst|empfohlen|diese|die|proteinlastig|produkte?|conditioner|leave in|leave-in|shampoo|maske|oel|oil)\b/.test(text)
}
```

Use existing conversation state when available:

- `conversationState.last_product_category`
- `conversationState.active_product_category`
- prior tool-loop state if present

If no category can be inferred, do not guess. Let the model ask a brief clarification or load guidance.

- [ ] **Step 2: Ensure the loop selects `select_products` for explanation follow-ups with known category**

If the model tries to answer a known prior product explanation with only `load_advisor_guidance`, steer/block and call `select_products` for the known category.

Keep this narrow:

- only after a prior product recommendation or known active product category
- only for "why these recommendations" style messages
- do not route conceptual category curiosity to products

- [ ] **Step 3: Add answer-context capsule for product explanation**

In `src/lib/agent/orchestrator/agentic-answer-context.ts`, add:

```ts
| "product.explain_prior_recommendation"
```

Instruction:

```ts
"Wenn die Nutzerin fragt, warum eine vorherige Produktauswahl empfohlen wurde, erklaere aus selected_products.profile_basis, category_guidance, supported_claims und comparison_facts. Sage klar, welche Profil- oder Produktachsen die Empfehlung tragen. Wenn mehrere Produkte fachlich nah beieinander liegen, sage das offen. Keine neuen Claims und keine internen Trace-Woerter."
```

Add it when `hasPriorRecommendationExplanationIntent(latestUserMessage)` and `selectedProducts` exists.

- [ ] **Step 4: Tighten the prompt contract**

In `src/lib/agent/orchestrator/prompt.ts`, add one short bullet under tool choice:

```txt
- Wenn die Nutzerin fragt, warum eine vorherige konkrete Produktempfehlung gemacht wurde, nutze select_products fuer die bekannte Kategorie erneut, damit die Begruendung aus Produkt- und Profilfakten kommt.
```

- [ ] **Step 5: Run routing and prompt tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts
```

Expected: the prior-product explanation test passes; conceptual category curiosity tests still block premature product calls.

## Task 5: Carry Recent Scalp Facts Into Anaphoric Routine Follow-Ups

**Goal:** "Was kann ich bis dahin machen?" should inherit the recent scalp problem for the current answer only.

- [ ] **Step 1: Extend recent-message context projection**

In `src/lib/agent/orchestrator/current-turn-context.ts`, add a small helper that can inspect recent user messages when the latest message is anaphoric.

Anaphoric triggers:

```ts
/\b(?:bis dahin|solange|in der routine|was kann ich machen|was soll ich machen|und jetzt|ok und)\b/i
```

Scalp facts to carry from recent user messages:

- `juckt`, `juckende kopfhaut`, `gereizt`, `brennt`
- `schuppen`
- `trockene kleine schueppchen`
- `fettige gelbliche schuppen`

Projection behavior:

- add current-turn active concern for scalp condition
- do not mutate the saved profile
- include evidence text in conflict/context metadata

- [ ] **Step 2: Feed the carried context into `buildRoutineInput()`**

In `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`, ensure `buildRoutineInput()` receives the enriched `CurrentTurnContextOverlay`, not only facts from the latest user message.

Expected behavior:

- `hairProfile` sent to `build_or_fix_routine` can include current-turn scalp condition for this call.
- conflict metadata remains available for final answer context.

- [ ] **Step 3: Add `routine.scalp_safety` answer capsule**

In `src/lib/agent/orchestrator/agentic-answer-context.ts`, add:

```ts
| "routine.scalp_safety"
```

Instruction:

```ts
"Bei aktuellen Juckreiz-, Reizungs-, Schuppen- oder trockene-Schueppchen-Faellen Routineantworten kopfhautschonend rahmen: keine Maske, kein Oel und keine Tiefenreinigung als Kopfhaut-Behandlung oder Beruhigung darstellen. Conditioner/Maske nur fuer Laengen/Spitzen nennen, wenn sie relevant sind. Fuer die Kopfhaut: mild reinigen, nicht stark rubbeln/kratzen, aggressive Peelings/Reset vorsichtig behandeln, und bei anhaltenden/starken Symptomen professionelle Abklaerung nennen."
```

Add it when:

- routine plan exists, and
- current-turn context has scalp irritation/dandruff/dry-flake signal, or latest/recent user message has those scalp signals.

- [ ] **Step 4: Only adjust planner projection if the answer-context fix is insufficient**

If the routine tool itself still returns misleading scalp-treatment slots after enriched context, add a narrow projection caveat in `src/lib/routines/planner.ts`:

- for scalp-sensitive context, mask caveat says length-care only
- reset/deep-cleansing is not framed as soothing scalp care unless the planner already selected a scalp-specific shampoo/clarify slot for oily build-up

Do not change general routine priority unless the focused test proves the planner output is itself wrong.

- [ ] **Step 5: Run scalp routine tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/routine-planner.spec.ts
```

Expected: the scalp follow-up regression passes; existing sensitive-scalp planner tests still pass.

## Task 6: Replay The Five Multi-Turn Runs

**Goal:** Verify that the actual behaviors observed in Compare Lab improved, not only the unit seams.

- [ ] **Step 1: Start or reuse the worktree dev server**

Run:

```bash
npm run dev:worktree
```

Expected: Compare Lab is available at `http://localhost:3274/labs/agent-compare` or the worktree-assigned port.

- [ ] **Step 2: Replay the five scenarios against `toolLoopVariant: "guidance_tool"`**

Use the same five prompt chains from `tmp/agent-lab-five-multiturn-runs.json`:

1. Routine improvement -> leave-in -> density -> "aber maske und oel nicht dazu?"
2. Shampoo/frizz caveat -> user insists on shampoo -> asks better lever next
3. Routine -> conditioner -> "warum proteinlastige conditioner?"
4. Dry tips/oily roots -> oil product -> "eher als finish, nicht auf die kopfhaut"
5. Itchy scalp/dandruff -> dry flakes/irritated -> routine until then

- [ ] **Step 3: Check the outcomes manually**

Expected:

- no generic "lass es mich wissen" closer
- oil run selects finish/length oil behavior, not natural pre-wash oils
- conditioner/protein explanation references profile/product axes rather than generic protein advice only
- scalp routine answer avoids mask/reset as scalp treatment
- tone remains `du`, not formal `Sie`

## Task 7: Final Verification

- [ ] Run focused suite:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/agent-select-products-tool.spec.ts
```

- [ ] Run adjacent safety suite:

```bash
npx tsx --test tests/agent-routine-tool.spec.ts tests/routine-planner.spec.ts tests/recommendation-engine-selection.test.ts
```

- [ ] Run typecheck:

```bash
npm run typecheck
```

- [ ] Run whitespace check:

```bash
git diff --check
```

- [ ] Before handoff, remove or keep untracked `tmp/` files out of the commit:

```bash
git status --short
```

Expected: no real Compare Lab run logs are staged.

## Execution Handoff

Use `superpowers:subagent-driven-development`.

Recommended split:

1. Worker A: Task 1 + Task 2 final-answer hygiene.
2. Worker B: Task 3 oil-purpose inference.
3. Worker C: Task 4 prior-product explanation routing.
4. Worker D: Task 5 scalp routine carry/safety.
5. Parent agent: integrate, run Task 6/7 verification, and review diffs.

Review focus:

- Keep fixes generic to stable boundaries, not prompt-specific one-offs.
- Reject any change that adds a second LLM classification call.
- Reject any change that wires production chat.
- Reject any answer-copy test that overfits exact German prose instead of behavior.
