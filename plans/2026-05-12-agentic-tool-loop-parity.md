# Agentic Tool Loop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Keep changes Compare Lab-scoped unless a test proves a shared deterministic tool bug.

**Goal:** Bring the now-aligned Compare Lab `Produkt-Evaluation` / agentic tool-loop logic to scope parity with the current Classic comparison path before any production wiring.

**Parity Definition:** Parity means scope coverage, not Classic content or wording parity. The agentic tool loop should cover the same practical recommendation surface that Classic currently covers, but its answer quality should come from the newer agentic structure: tool routing, profile overlays, category guidance, answer-context capsules, and the rewritten prompt. Classic is the coverage baseline, not the editorial target.

**Architecture:** Preserve the new prompt structure. The main agentic prompt remains a stable orchestration charter. Category-specific knowledge lives in advisor guidance markdown and answer-context capsules. Deterministic `select_products` and `build_or_fix_routine` remain authoritative for product facts, rankings, routine steps, and hard safety policy.

**Tech Stack:** Next.js/TypeScript, Compare Lab at `/labs/agent-compare`, Node test runner via `npx tsx --test`, existing deterministic recommendation engines.

---

## Scope Order

This plan covers only Step 1 of the rollout sequence:

1. Complete parity from current agentic Compare Lab logic to Classic in scope.
2. Later: plan how the complete agentic logic plugs into production.
3. Later: implement the updated agentic logic in production.

## Source / Current State

- Current best Compare Lab variant: `guidance_tool` / `Produkt-Evaluation`.
- Classic comparator path: `runClassicAgentComparison` through the current bounded/classic route-packet flow.
- Product/routine authority already covers all selectable categories:
  - `shampoo`
  - `conditioner`
  - `leave_in`
  - `mask`
  - `oil`
  - `bondbuilder`
  - `deep_cleansing_shampoo`
  - `dry_shampoo`
  - `peeling`
- Current gap: contextual parity is uneven.
  - `load_advisor_guidance` lacks `dry_shampoo`, `peeling`, and canonical `deep_cleansing_shampoo` category coverage.
  - `agentic-consultation-brief` only preloads category guidance for shampoo, conditioner, leave-in, and mask.
  - `agentic-answer-context` has strong capsules for core flows but thinner category-specific render guidance for oil, bondbuilder, deep cleansing, dry shampoo, peeling, and normal shampoo recommendations.

## Non-Goals

- Do not wire production chat.
- Do not add another LLM classification call.
- Do not introduce a pairwise category-comparison matrix.
- Do not rewrite deterministic product ranking or routine priority unless a focused test proves a deterministic tool-output bug.
- Do not paste the Classic final render prompt wholesale into the agentic tool-loop prompt.
- Do not depend on `ConversationContextPacketV1`.

## Acceptance Criteria

- `Produkt-Evaluation` can handle all nine selectable product categories in Compare Lab with comparable or better behavior than Classic.
- Category questions, product requests, usage questions, comparisons, and multi-turn follow-ups all receive the right context.
- Concrete product facts come only from `select_products`.
- Routine structure comes only from `build_or_fix_routine`.
- Advisor guidance and answer capsules improve framing without becoming hidden deterministic routing.
- Compare Lab traces make the loaded guidance, tool calls, answer context, and state transition easy to inspect.
- The implementation does not try to match Classic wording or preserve Classic render content for its own sake; useful Classic-era ideas may be harvested only when they fit the new agentic guidance/capsule structure.

---

## Task 1: Add A Parity Matrix

**Goal:** Make scope explicit before changing behavior.

**Files:**
- Add: `docs/agentic-tool-loop-parity-matrix.md`
- Optional test fixture updates: `tests/fixtures/comparelab-prompts.json`

- [ ] Create a compact matrix with rows for the nine selectable categories and columns for:
  - category education
  - concrete product recommendation
  - usage/application
  - compare/decide
  - multi-turn follow-up/explanation
  - routine insertion/add-on
- [ ] For each cell, mark the expected source of truth:
  - `select_products`
  - `build_or_fix_routine`
  - `load_advisor_guidance`
  - `consultation_brief`
  - `answer_context`
  - prompt-only global rule
- [ ] Mark known weak cells before implementation:
  - dry shampoo guidance/rendering
  - peeling guidance/rendering
  - deep cleansing alias consistency
  - bondbuilder explanation follow-ups
  - oil use-case disambiguation beyond product selection
  - shampoo normal recommendation shape versus only redirect framing

## Task 2: Bring Advisor Guidance To Category Parity

**Goal:** Every selectable product category should be loadable as advisor guidance.

**Files:**
- Modify: `src/lib/agent/contracts.ts`
- Modify: `src/lib/agent/guidance/catalog.ts`
- Modify: `src/lib/agent/tools/load-advisor-guidance.ts`
- Add: `data/agent-guidance/topics/dry-shampoo/*`
- Add: `data/agent-guidance/topics/peeling/*`
- Test: `tests/agent-guidance.spec.ts`

- [ ] For any missing or thin category content, do a small external evidence check before writing guidance. Prefer AAD, Mayo Clinic, Cleveland Clinic, or similarly reputable medical/professional sources. Keep the result conservative and cosmetic; do not turn weak evidence into hard rules.
- [ ] Use source-backed content especially for currently missing/thin categories:
  - dry shampoo: temporary oil absorption/freshness support; not a replacement for washing with regular shampoo and water; avoid layering indefinitely; brush/comb out as directed; useful as a bridge between washes.
  - peeling/scalp exfoliation: occasional buildup/flaking support for suitable scalps; choose method/frequency by skin/scalp tolerance; avoid strong mechanical/chemical exfoliation when scalp is irritated, very sensitive, inflamed, painful, or symptoms are persistent.
- [ ] Add `topic:dry_shampoo` and `topic:peeling` to `GUIDANCE_IDS`.
- [ ] Register both topics in the guidance catalog.
- [ ] Add advisor categories:
  - `dry_shampoo`
  - `peeling`
  - `deep_cleansing_shampoo` as an alias normalized to `deep_cleansing`
- [ ] Keep `bondbuilder` normalized to `bond_builder`.
- [ ] Extend category inference in `load-advisor-guidance.ts` for:
  - dry shampoo / Trockenshampoo
  - peeling / Kopfhautpeeling / scalp scrub
  - deep cleansing shampoo / Tiefenreinigungsshampoo / Reinigungsshampoo
- [ ] Create topic markdown for dry shampoo and peeling using the same editorial shape as current harmonized topic docs:
  - category role
  - best fit
  - weak fit
  - decision axes
  - profile interplay
  - compare against other categories
  - answer guidance
  - guardrails / avoid
- [ ] Include a short source note in the markdown or adjacent internal docs if a new claim materially depends on external research.
- [ ] Add tests proving each category loads the correct topic guidance and no generic-only fallback occurs when the category is named.

**Initial external anchors for implementation:**

- AAD dry shampoo guidance: dry shampoo is not a substitute for washing with regular shampoo and water; wash after one or two dry-shampoo uses; apply/spread/brush out according to directions.
- AAD safe exfoliation guidance: method and frequency should match skin tolerance; dry/sensitive skin may need gentler approaches; over-exfoliation can cause redness and irritation.
- AAD/Mayo/Cleveland Clinic scalp guidance: persistent flakes, itch, inflammation, or seborrheic-dermatitis-like symptoms should be handled conservatively and may need dermatological evaluation rather than cosmetic escalation.

## Task 3: Expand Consultation Brief Candidate Guidance

**Goal:** The first agentic model step should see lightweight relevant category context for all supported categories when the turn makes that category salient.

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-consultation-brief.ts`
- Test: `tests/agentic-tool-loop.spec.ts` or `tests/agent-guidance.spec.ts`

- [ ] Extend `CATEGORY_TOPIC_BY_KEYWORD` to include:
  - `topic:hair_oiling`
  - `topic:bond_builder`
  - `topic:deep_cleansing`
  - `topic:dry_shampoo`
  - `topic:peeling`
- [ ] Use bounded keyword/topic detection only to preload candidate context; do not turn this into routing authority.
- [ ] Add tests that the consultation brief includes relevant candidate guidance for oil, bondbuilder, deep cleansing, dry shampoo, and peeling prompts.
- [ ] Confirm broad routine prompts still load `playbook:build_or_fix_routine`.

## Task 4: Harvest Classic Render Strength Into Answer Context

**Goal:** Move Classic's useful category-specific answer shape into modular capsules, not a giant prompt blob.

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add or strengthen category capsules for:
  - `category.shampoo.recommend`
  - `category.oil.recommend`
  - `category.bondbuilder.recommend`
  - `category.deep_cleansing.recommend`
  - `category.dry_shampoo.recommend`
  - `category.peeling.recommend`
  - `category.dry_shampoo.guardrail`
  - `category.peeling.scalp_guardrail`
- [ ] Attach capsules primarily from actual tool outputs:
  - selected product category
  - routine plan category/priority context
  - loaded advisor guidance
  - conversation state
- [ ] Use keyword detection only as a fallback when no tool output exists and the user asked a conceptual category question.
- [ ] Add tests that each selected category receives the expected capsule IDs.
- [ ] Add tests that dry shampoo answers include the core caveat: it can absorb oil visually but does not clean the scalp and should be washed out later.
- [ ] Add tests that peeling answers stay cosmetic and conservative for irritated/sensitive/scalp-symptom contexts.

## Task 5: Keep The Agentic Prompt Coherent

**Goal:** Integrate parity into the rewritten prompt structure without bloating it.

**Files:**
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] Keep `AGENTIC_TOOL_LOOP_PROMPT` as orchestration, not category documentation.
- [ ] Add at most a small rule reminding the model:
  - category-specific rendering comes from `answer_context` and loaded advisor guidance
  - product facts/rankings come from `select_products`
  - routine structure comes from `build_or_fix_routine`
- [ ] Verify no new instruction conflicts with:
  - conceptual category answers should not auto-product-list
  - explicit product requests should call `select_products`
  - broad routine asks should use `build_or_fix_routine`

## Task 6: Add Tool-Loop Parity Regression Tests

**Goal:** Prove the parity work in automation before manual Compare Lab testing.

**Files:**
- Modify: `tests/agentic-tool-loop.spec.ts`
- Modify: `tests/agent-guidance.spec.ts`
- Modify if useful: `tests/agent-select-products-tool.spec.ts`
- Modify if useful: `tests/agent-final-render-prompt.spec.ts`

- [ ] Add dry shampoo product recommendation test.
- [ ] Add dry shampoo conceptual/usage test.
- [ ] Add peeling product recommendation test.
- [ ] Add peeling conceptual/usage test.
- [ ] Add deep cleansing alias/comparison test.
- [ ] Add bondbuilder explanation/follow-up test.
- [ ] Add oil compare/use-case test that does not collapse all oil use cases into one.
- [ ] Add shampoo product answer test that uses shampoo-specific framing without refusing the request.
- [ ] Add multi-turn thread test:
  - routine basics
  - category follow-up
  - concrete product request
  - explanation of why that product/category came first

## Task 7: Update Compare Lab Evaluation Prompts

**Goal:** Make final manual testing representative of the full parity surface.

**Files:**
- Modify: `tests/fixtures/comparelab-prompts.json`
- Modify if needed: `src/lib/agent/compare/held-out-turns.ts`

- [ ] Add one held-out multi-turn thread each for:
  - dry shampoo
  - peeling
  - deep cleansing
  - bondbuilder
  - oil use-case comparison
  - broad routine add-on flow
- [ ] Keep expected/manual-review notes focused on behavior, not exact wording.
- [ ] Ensure Compare Lab logs still expose:
  - selected variant
  - tool calls
  - loaded advisor guidance IDs
  - answer context capsule IDs
  - blocked tool calls
  - state transition

## Task 8: Verification

**Automated verification:**

```bash
npx tsx --test tests/agent-guidance.spec.ts
npx tsx --test tests/agentic-tool-loop.spec.ts
npx tsx --test tests/agent-final-render-prompt.spec.ts tests/agent-select-products-tool.spec.ts
npm run typecheck
git diff --check
```

**Optional Compare Lab/API verification if related files changed:**

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

**Manual Compare Lab verification:**

- Select `Produkt-Evaluation` as the Tool Loop variant.
- Compare against Classic on at least six flows:
  - dry shampoo
  - peeling
  - deep cleansing
  - bondbuilder
  - oil use-case comparison
  - broad routine add-on flow
- Pass condition: agentic Tool Loop is at least as complete as Classic in category scope and better or equal in multi-turn continuity, structure, tool use, and groundedness.

## Handoff Notes

- This plan intentionally does not decide production wiring. Once this plan is green, create a separate production integration plan that starts from the completed agentic Compare Lab logic.
- The biggest risk is overloading the prompt. Keep category detail in guidance/capsules.
- The second biggest risk is hidden routing through keyword patches. Keyword/category detection may preload context, but final product/routine authority must remain the tools.
