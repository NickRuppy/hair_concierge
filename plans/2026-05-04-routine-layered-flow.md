# Routine Layered Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the tests-first loop. Use `superpowers:subagent-driven-development` if splitting routine planner, orchestration, and prompt work across independent files; otherwise use `superpowers:executing-plans`.

**Spec Source:** Planning conversation from May 3-4, 2026 plus production `origin/main` conversation-state implementation at `db2b1b8`.

**User Situation:** Tester feedback shows the first routine answer is too long on mobile and feels like an exhaustive add-on dump. Multi-turn routine follow-ups should feel like a natural consultation: basics first, then goal/problem layers, then focused deep dives, with product cards only when explicitly requested.

**Promised End-State:** A fresh routine request produces a concise, natural German `basics` answer with Shampoo, Conditioner, and one highest-priority lever. Follow-up turns reveal only the relevant layer (`goals`, `problems`, or `deep_dive`) using conversation state. Routine product cards are withheld unless the user explicitly asks for concrete products.

**Architecture:** Keep one deterministic full `RoutinePlan`, but introduce a routine turn resolver and layer projection before synthesis. Conversation state owns the active routine layer and pending offer. The routine planner owns priority ranking and layer slot selection. The synthesizer receives only the projected routine layer for the current turn. Product selection is gated by explicit product-request intent, not by routine slot presence.

---

## Alignment Summary

### Locked Decisions

- Apply the layered routine flow to fresh routine requests, including starter-card routine prompts.
- The first answer should be concise but explanatory, not a rigid script.
- `basics` always mentions Shampoo and Conditioner:
  - briefly and positively when they already fit,
  - as an adjustment when their focus should change,
  - as a missing base when absent.
- `basics` adds one highest-priority lever.
- Priority is care-risk first, but ranked from hair failure modes, not from easiest detection:
  1. buildup/overload/reset blockage if it prevents care from working
  2. active severe breakage or structural failure
  3. mechanical stress as supporting guardrail, or main lever only when clearly dominant
  4. ongoing chemical/heat exposure that is likely worsening damage
  5. scalp issues that change routine safety
  6. strong dryness/frizz/tangling cluster
  7. stated cosmetic goal
  8. optional/advanced modules only when explicit or strongly justified
- For severe damage/breakage, choose care-product-first:
  1. Conditioner upgrade
  2. Leave-in / Finish
  3. Mask cadence
  4. Bond Builder
  5. Reset first only when buildup is blocking care
- Behavior signals are included as supporting guardrails when present.
- `goals` and `problems` layers show only the top 2-3 relevant levers.
- `deep_dive` focuses one category/module, such as Leave-in, Maske, OWC, Bond Builder, Reset, etc.
- Next-step offers should be natural and profile-based, not internal taxonomy labels.
- Routine product cards should appear only when the user explicitly asks for concrete products.

### Non-Goals

- Do not build a saved routine artifact.
- Do not replace the merged conversation-state system.
- Do not create a second routine-specific persistence table.
- Do not hardcode full answer prose templates.
- Do not show product cards from routine slots unless the current turn is an explicit product ask.
- Do not attempt a full conversation-frame v2 migration in this plan.

### Current Production Constraints

- Production state has `routine_layer`, `pending_offer`, `answered_slots`, and `last_assistant_action`.
- Today, `basics` mainly means "assistant asked for missing routine basics." This plan changes semantics so `basics` can also mean "assistant answered the first routine layer."
- The orchestrator currently passes the previous loaded state into synthesis, even after computing `conversationStateTransition`. Layered routine answers need an effective current state, usually the transition's `next_state`.
- `attachProductsToRoutinePlan()` currently attaches routine products by default. This must be gated.
- A vague routine follow-up such as "Und Leave-in?" should stay in routine deep-dive mode. An explicit product ask such as "Welches Leave-in empfiehlst du konkret?" should use product recommendation mode and product cards.

---

## Target File Map

| Path | Responsibility |
| --- | --- |
| `src/lib/types.ts` | Add routine priority/layer projection types and routine turn policy trace fields if needed |
| `src/lib/routines/planner.ts` | Compute priority lever, layer membership, top 2-3 slots, projected routine plan |
| `src/lib/routines/product-attachments.ts` | Accept an explicit attachment policy so routine cards are skipped by default |
| `src/lib/rag/conversation-state.ts` | Refine routine state transitions for answered basics and category follow-ups |
| `src/lib/rag/orchestrator/conversation-orchestrator.ts` | Derive effective routine turn, pass projected plan/state to synthesis, gate product selection |
| `src/lib/rag/synthesizer.ts` | Prompt the LLM to compose only the current routine layer naturally |
| `src/lib/rag/debug-trace.ts` | Include enough trace data to debug layer choice/product gating if new fields are added |
| `tests/routine-planner.spec.ts` | Priority ranking, layer projection, product-linkable slots not auto-attached |
| `tests/conversation-state.spec.ts` | State transition semantics for answered basics, layer choices, product-vs-deep-dive boundary |
| `tests/chat-debug-trace.spec.ts` | Trace includes routine layer/product gate data if trace schema changes |
| `tests/agent-production-chat-pipeline.spec.ts` or focused chat pipeline tests | End-to-end routing for routine basics, "Und Leave-in?", and explicit product ask |

---

## Task 1: Lock Routine Layer Contracts With Failing Tests

**Goal:** Establish the expected routine layers before production code changes.

**Files:**
- Test: `tests/routine-planner.spec.ts`
- Modify later: `src/lib/types.ts`
- Modify later: `src/lib/routines/planner.ts`

- [ ] Add tests proving a fresh complete routine request exposes `initial_slot_ids` or equivalent projected slots:
  - `base-shampoo`
  - `base-conditioner`
  - exactly one priority lever
- [ ] Add a test for damage/breakage priority:
  - profile has breakage/damage/rough cuticle
  - selected lever is care-product-first
  - conditioner upgrade wins before mask/bond builder unless reset blockage is present
- [ ] Add a test for reset preemption:
  - waxy/coated/heavy product rotation/hard water signals
  - reset lever can win over cosmetic goals
- [ ] Add a test for stated goal fallback:
  - no strong care risk
  - curl definition / frizz / shine goal picks the matching goal lever
- [ ] Add tests that `goals` and `problems` projections return no more than 2-3 visible levers.
- [ ] Add a deep-dive projection test for "Und Leave-in?" style category follow-up.

Run:

```bash
npx playwright test tests/routine-planner.spec.ts
```

Expected first run: fails because layer projection and priority-lever contracts do not exist yet.

---

## Task 2: Add Routine Priority And Layer Projection

**Goal:** The planner should build the full routine internally, then expose only the layer needed for the current turn.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/routines/planner.ts`
- Test: `tests/routine-planner.spec.ts`

- [ ] Add minimal public types:
  - `RoutinePriorityLeverSource = "care_risk" | "stated_goal" | "inferred_need"`
  - `RoutinePriorityLever`
  - `RoutineLayer = "basics" | "goals" | "problems" | "deep_dive"`
  - `RoutineLayerProjection` or equivalent selected-slot metadata
- [ ] Implement `selectRoutinePriorityLever(...)` after full slot construction.
- [ ] Encode the v2 risk order:
  - reset blockage may preempt when strong
  - severe breakage/structural damage picks care-product-first
  - mechanical signals add guardrails and only win if dominant
  - heat/chemical exposure is high priority when ongoing but does not automatically outrank active damage
  - stated goal wins when no stronger risk exists
- [ ] For severe damage, implement care-product category order:
  1. Conditioner upgrade
  2. Leave-in / Finish
  3. Mask cadence
  4. Bond Builder
  5. Reset only when blocking care
- [ ] Implement `projectRoutinePlanForLayer(...)`:
  - `basics`: Shampoo + Conditioner + priority lever
  - `goals`: top 2-3 goal-directed levers
  - `problems`: top 2-3 concern/risk-directed levers
  - `deep_dive`: one requested category/topic/module, with only necessary supporting guardrails
- [ ] Preserve existing full-plan behavior for internal retrieval/debug if needed, but do not expose all slots to synthesis for the first answer.
- [ ] Keep routine display copy data structural: labels, reasons, caveats, next-offer hints. Do not hardcode final paragraphs.

Run:

```bash
npx playwright test tests/routine-planner.spec.ts
```

---

## Task 3: Update Conversation State Semantics For Routine Layers

**Goal:** The merged state system should represent the actual routine answer layer, not only missing-frame clarification.

**Files:**
- Modify: `src/lib/rag/conversation-state.ts`
- Test: `tests/conversation-state.spec.ts`

- [ ] Add/adjust tests for a complete first routine answer:
  - classification is `routine_help` / `routine`
  - router does not clarify
  - assistant action is `answered_routine_basics`
  - next state is `active_topic = "routine"`, `routine_layer = "basics"`, `pending_offer = "routine_goals_or_problems"`
- [ ] Keep the existing "asked missing routine basics" behavior for incomplete routine frames.
- [ ] Add tests for choosing next layer:
  - user replies with goal direction -> `routine_layer = "goals"`
  - user replies with problem direction -> `routine_layer = "problems"`
  - `pending_offer` advances to `routine_other_layer` or `routine_deep_dive` according to the answer shape
- [ ] Add tests for vague category follow-up inside routine:
  - previous state is routine
  - user says "Und Leave-in?"
  - next state becomes `routine_layer = "deep_dive"`
  - `last_product_category = "leave_in"`
  - no product recommendation override is forced
- [ ] Keep explicit product requests as product mode:
  - "Welches Leave-in empfiehlst du mir konkret?"
  - classification remains `product_recommendation` / `leave_in`
  - state may switch to `active_topic = "leave_in"` while preserving recent routine context through history/state trace

Run:

```bash
npx playwright test tests/conversation-state.spec.ts
```

---

## Task 4: Add A Routine Turn Resolver In The Orchestrator

**Goal:** One small adapter should decide the current routine layer, visible plan, and product-card policy before retrieval/products/synthesis.

**Files:**
- Modify: `src/lib/rag/orchestrator/conversation-orchestrator.ts`
- Optional create: `src/lib/rag/routine-turn.ts` if the logic becomes too large
- Test: `tests/agent-production-chat-pipeline.spec.ts` or a focused pipeline test

- [ ] Add failing tests for three chat turns:
  - fresh complete routine request -> projected `basics`, no routine product cards
  - active routine + "Und Leave-in?" -> projected `deep_dive`, no product cards
  - active routine + "Welches Leave-in empfiehlst du konkret?" -> normal product recommendation with product cards allowed
- [ ] Compute `conversationStateTransition` before final routine projection and synthesis.
- [ ] Use an effective state for response composition:
  - usually `conversationStateTransition.next_state`
  - avoid passing stale previous state when the current turn just entered `basics`
- [ ] Introduce a routine turn policy object:

```ts
interface RoutineTurnPolicy {
  shouldPlanRoutine: boolean
  layer: "basics" | "goals" | "problems" | "deep_dive" | null
  requestedDeepDiveCategory: ProductCategory | null
  allowProductAttachments: boolean
  nextOffer: "goals_or_problems" | "other_layer" | "deep_dive" | null
}
```

- [ ] Treat vague category mentions inside active routine as `shouldPlanRoutine = true` even when intent is `followup` and category is `leave_in`, `mask`, `bondbuilder`, etc.
- [ ] Do not fight explicit product recommendation classification. Let product mode handle "welches Produkt" wording.
- [ ] Pass the projected routine plan, not the full routine dump, into `composeResponse`.

Run focused pipeline tests after implementation.

---

## Task 5: Gate Routine Product Attachments

**Goal:** Routine answers remain category-level unless the user explicitly asks for concrete products.

**Files:**
- Modify: `src/lib/routines/product-attachments.ts`
- Modify: `src/lib/rag/orchestrator/conversation-orchestrator.ts`
- Test: `tests/routine-planner.spec.ts`
- Test: pipeline test from Task 4

- [ ] Add tests proving `attachProductsToRoutinePlan` is skipped for normal routine basics/goals/problems/deep-dive answers.
- [ ] Allow product cards only when the current user message is an explicit product request, normally handled by existing product-selection path.
- [ ] If a future routine-specific explicit product path is needed, pass an explicit `allowProductAttachments: true`; do not infer it from `product_linkable`.
- [ ] Keep `product_linkable` on slots because it remains useful metadata for future product asks and debug traces.
- [ ] Ensure `matched_products` is empty for routine logic-only turns.

Run:

```bash
npx playwright test tests/routine-planner.spec.ts
```

---

## Task 6: Update Synthesis Prompt For Natural Layered Answers

**Goal:** The LLM should turn structured layer data into natural German Beratung, without stiff templates or hidden add-on dumps.

**Files:**
- Modify: `src/lib/rag/synthesizer.ts`
- Test: `tests/routine-planner.spec.ts`
- Optional test: `tests/agent-final-render-prompt.spec.ts` if this repo keeps prompt-contract tests there

- [ ] Add prompt contract for routine layers:
  - explain Shampoo and Conditioner as basics
  - keep already-fitting basics positive and short
  - explain the priority lever and why it matters
  - do not enumerate hidden add-ons
  - no product names/cards unless provided by explicit product mode
  - offer the next step naturally based on profile, not as "goal-oriented/problem-oriented" labels
- [ ] Include layer metadata in `formatRoutinePlan` or equivalent projected-plan formatting:
  - current layer
  - visible slots
  - priority lever reason
  - allowed next offer
  - hidden slots are not displayed as answer material
- [ ] Keep exact German prose flexible. The prompt should constrain content/density, not dictate full paragraphs.
- [ ] Add prompt tests for:
  - "Erste Routine-Antwort" or equivalent layer marker
  - no "zaehle alle Add-ons auf" behavior
  - natural next-offer instruction
  - product cards absent for routine logic-only turns

Run:

```bash
npx playwright test tests/routine-planner.spec.ts
```

---

## Task 7: Trace And Debug The Layer Decision

**Goal:** When routine behavior feels wrong in testing, admin traces should show whether the issue was classification, state transition, layer projection, or synthesis.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/app/admin/conversations/[id]/page.tsx` only if current trace UI needs a readable summary
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] Add trace fields only if existing `routine_plan` + `conversation_state` are not enough.
- [ ] Recommended trace shape:

```ts
routine_turn_policy?: {
  layer: "basics" | "goals" | "problems" | "deep_dive" | null
  visible_slot_ids: string[]
  priority_lever_slot_id: string | null
  allow_product_attachments: boolean
  next_offer: string | null
}
```

- [ ] Add trace tests proving:
  - fresh routine basics logs visible slots and product gate false
  - "Und Leave-in?" logs deep dive and product gate false
  - explicit product ask logs product mode / product gate true through existing product trace
- [ ] Keep admin UI copy German if new UI copy is added.

---

## Task 8: Add End-To-End Routine Flow Regressions

**Goal:** Prove the behavior users complained about is fixed, not just the isolated helpers.

**Files:**
- Test: `tests/agent-production-chat-pipeline.spec.ts` or `tests/chat-response.spec.ts`
- Optional manual chat smoke

- [ ] Add an integration fixture for:
  1. user asks "Welche Routine passt am besten zu meinem Haarprofil?"
  2. first answer uses only Shampoo, Conditioner, priority lever
  3. no product cards
  4. answer offers a natural next step
- [ ] Add follow-up fixture:
  1. previous state is routine basics with pending offer
  2. user says "Dann eher Richtung Definition"
  3. answer shows only top 2-3 goal levers
- [ ] Add problem layer fixture:
  1. user says "Und was gegen Frizz und trockene Spitzen?"
  2. answer shows only top 2-3 problem/risk levers
- [ ] Add deep-dive fixture:
  1. user says "Und Leave-in?"
  2. answer explains Leave-in's routine role
  3. no product cards
- [ ] Add explicit product fixture:
  1. user says "Welches Leave-in empfiehlst du mir konkret?"
  2. product recommendation path runs
  3. product cards can appear

---

## Verification

Run focused tests first:

```bash
npx playwright test tests/routine-planner.spec.ts
npx playwright test tests/conversation-state.spec.ts
npx playwright test tests/chat-debug-trace.spec.ts
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
```

Then run broader checks:

```bash
npm run typecheck
npm run lint
npm run build
```

Manual smoke test in local chat:

1. Start a mobile-sized chat with "Welche Routine passt am besten zu meinem Haarprofil?"
2. Confirm the first response is short enough for mobile and includes only basics + one lever.
3. Continue with a goal direction.
4. Continue with a problem direction.
5. Ask "Und Leave-in?"
6. Ask "Welches Leave-in empfiehlst du mir konkret?"
7. Inspect admin trace for `conversation_state`, visible layer, and product-card gating.

Because this touches recommendation behavior, copy, and trust, run `ready-check` before shipping.

---

## Definition Of Done

- The first routine answer no longer dumps Shampoo, Conditioner, CWC, Leave-in, brushes, masks, reset, oiling, bond builder, and other modules at once.
- The first answer still feels like real Beratung: it explains why Shampoo and Conditioner are the base and why the chosen lever matters.
- Goal/problem follow-ups show only 2-3 relevant levers.
- Vague category follow-ups inside routine produce routine deep dives, not product cards.
- Explicit product requests produce product recommendations/cards with routine context available.
- Conversation traces make layer choice and product gating diagnosable.
- All focused and broader verification commands pass, or any remaining warnings/gaps are documented before handoff.

## Execution Handoff

Start implementation in a fresh repo-local worktree from `origin/main`.

Recommended next skill: `superpowers:subagent-driven-development` if splitting planner/orchestrator/prompt tasks; otherwise `superpowers:executing-plans`.
