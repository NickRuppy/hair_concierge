# Agentic Context Conflict Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec / Source:** Follow-up repair pass from Compare Lab testing on May 12, 2026, building on:
- `plans/2026-05-12-agentic-overlay-guidance-polish.md`
- `plans/2026-05-11-agentic-multi-category-guidance.md`
- `docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`

**User Situation:** In Compare Lab, the `Produkt-Evaluation` tool-loop variant is now better at product asks and category comparisons, but still has recurring issues when current-turn facts conflict with saved profile/routine context. It can choose a technically valid but misplaced routine lever, especially `Tiefenreinigung/Reset`, when the user just gave fresher inventory or problem details.

**Promised End-State:** The tool loop remains a Compare Lab prototype, but its tools receive a conflict-aware current-turn context overlay. The soft profile remains the default context. If the user states a material current routine, concern, scalp issue, or safety issue in the message, the system includes that fact alongside the profile context for the current answer. Current-turn evidence should steer the answer only when explicit and relevant, and conflicts with saved profile context should be acknowledged softly when they materially change the recommendation. Routine priority stays deterministic and authoritative, but it gets better runtime facts. Product answers become more explanatory without inventing claims.

**Architecture:** Keep the existing deterministic planner and product tools authoritative. Do not rewrite routine priority from scratch. Instead, add a small current-turn context extraction/projection layer before tool execution, use it to build tool inputs and answer context, and add focused tests for the observed regressions.

**Tech Stack:** Next.js/TypeScript, Node test runner via `tsx --test`, Compare Lab at `/labs/agent-compare`.

---

## Settled Decisions

- Use **soft-profile-plus-current-evidence mode** for current-turn vs saved-context conflicts:
  - Treat the saved soft profile as the default context.
  - Do not silently overwrite or discard saved profile context.
  - Include material current-turn facts alongside the profile context.
  - Let current-turn evidence win only where it is explicit, relevant, and needed for the current answer.
  - When visible to the user, phrase it like: “In deinem gespeicherten Profil sehe ich X; wenn aktuell aber Y stimmt, würde ich ...”
- Do **not** rewrite the routine priority system. Existing planner priority is broadly correct:
  - Reset should win only for build-up/blockage/reset signals.
  - Frizz/dryness/tangling should usually prefer direct care levers such as leave-in/conditioner before reset.
- Do **not** add another LLM call or composer pass.
- Do **not** wire production chat to the tool loop in this pass.

## Non-Goals

- No production chat rollout.
- No new agent tool unless an existing tool cannot express the needed context.
- No pair-specific category-comparison matrix.
- No changes to deterministic product ranking or product claim authority.
- No broad prompt rewrite beyond the narrow answer-context instructions needed for conflict handling and richer product rendering.

## Target File Map

- Current-turn context extraction and tool input projection:
  - `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - optional helper if needed: `src/lib/agent/orchestrator/current-turn-context.ts`
- Routine context behavior:
  - `src/lib/agent/tools/build-or-fix-routine.ts`
  - `src/lib/routines/planner.ts` only if tests prove the existing planner cannot handle corrected context
- Guidance safety overlays:
  - `src/lib/agent/tools/load-advisor-guidance.ts`
- Product answer richness:
  - `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Compare Lab fixes:
  - `src/app/api/labs/agent-compare/judgments/route.ts`
  - `.gitignore` or cleanup of `tmp/agent-compare-runs.jsonl`
- Production boundary cleanup:
  - `src/lib/agent/orchestrator/route-packet.ts`
  - `src/lib/agent/orchestrator/prompt.ts`
  - related production tests if needed
- Tests:
  - `tests/agentic-tool-loop.spec.ts`
  - `tests/agent-guidance.spec.ts`
  - `tests/agent-routine-tool.spec.ts`
  - `tests/agent-compare-api.spec.ts`
  - `tests/agent-final-render-prompt.spec.ts` or route/prompt tests if production prompt wiring changes

---

## Task 1: Add Current-Turn Context Overlay Extraction

**Goal:** Convert explicit current-user facts into a small structured overlay that can be used by tool inputs and final answer context.

- [ ] Add a helper near the tool-loop orchestrator, preferably `src/lib/agent/orchestrator/current-turn-context.ts`, with a projection like:

```ts
interface CurrentTurnContextOverlay {
  routine_products: {
    value: RoutineProduct[]
    evidence: string
    conflicts_with_saved: boolean
    saved_value: RoutineProduct[]
  } | null
  active_concerns: Array<{
    field: "concerns" | "scalp_condition" | "hair_texture" | "thickness" | "density"
    value: string
    evidence: string
    selection_effect: "override" | "augment" | "caution"
  }>
  safety_overlay_ids: GuidanceId[]
}
```

- [ ] Detect explicit routine inventory phrases, including:
  - `nur Shampoo und Conditioner`
  - `ich nutze nur ...`
  - `meine Routine besteht aus ...`
  - direct product category lists such as `Shampoo, Conditioner, Öl`
- [ ] Detect explicit current-turn concerns used in observed tests:
  - `Frizz`
  - `trockene Spitzen/Längen`
  - `verknotete Spitzen`
  - `lockiges Haar`
  - `feines Haar`
  - `wenig Dichte`
  - `schnell beschwert`
  - `fettige Kopfhaut`
  - `juckende Kopfhaut`
  - `Schuppen`
  - `Haarausfall`, including separated forms like `mir fallen Haare aus`
- [ ] Keep extraction conservative: only use explicit words from the current message, not inferred lifestyle assumptions.
- [ ] Unit-test the extractor with the exact Compare Lab prompts that failed:
  - `Ich habe nur Shampoo und Conditioner. Was sollte ich als nächstes ergänzen?`
  - `Ich habe lockiges Haar, Frizz und verknotete Spitzen. Was wäre der nächste sinnvollste Schritt?`
  - `Mir fallen seit kurzem viele Haare aus. Kann ein Haaröl helfen?`

## Task 2: Apply Overlay To Routine/Product Tool Inputs

**Goal:** Tools should receive the best current-turn facts without losing saved context.

- [ ] Update `buildRoutineInput()` in `src/lib/agent/orchestrator/run-agentic-tool-turn.ts` to pass a projected hair profile:
  - start with `params.userContext.profile`
  - if current-turn routine inventory is explicit and material, include it as the current tool-call inventory while preserving conflict metadata for the answer
  - augment current-turn concerns such as `frizz`, `dryness`, `tangling`, `oily_scalp`
  - apply explicit current-turn `hair_texture`, `thickness`, and `density` as overrides for the tool call
- [ ] Preserve conflict metadata outside the profile object so final answer context can explain it.
- [ ] Update `buildSelectProductsInput()` similarly for active profile signals:
  - keep existing `inferCurrentTurnActiveProfileSignals`
  - add current-turn scalp/concern/product-purpose signals where the product selector already supports them
  - do not invent unsupported product fields
- [ ] Add tests proving that:
  - `nur Shampoo und Conditioner` makes routine basics treat shampoo/conditioner as current basis, even if saved profile has more products
  - `lockiges Haar + Frizz + verknotete Spitzen` routes priority toward `leave_in` or another direct care lever, not reset, unless build-up is explicitly present
  - current-turn `fettige Kopfhaut + trockene Längen` still lets shampoo selection use the current scalp signal

## Task 3: Make Current-Turn Safety Guidance Deterministic

**Goal:** Safety overlays must not depend on the model remembering `profileFocus`.

- [ ] Update `loadAdvisorGuidance()` / `resolveAdvisorGuidanceIds()` so current-turn safety wording deterministically contributes overlays before model-requested cosmetic overlays:
  - `overlay:hair_loss_or_thinning_guardrail`
  - `overlay:sensitive_scalp`
  - `overlay:dandruff_scalp`
- [ ] Keep the existing overlay ranking/cap, with safety overlays above cosmetic overlays.
- [ ] Add tests where `profileFocus: []` and saved profile lacks the concern:
  - `Mir fallen seit kurzem viele Haare aus. Kann ein Haaröl helfen?`
  - `Meine Kopfhaut juckt und brennt. Was soll ich nehmen?`
  - `Ich habe Schuppen und trockene Längen. Maske oder Öl?`

## Task 4: Conflict-Aware Answer Context

**Goal:** If the tool used a current-turn override, the final answer should be transparent but not bureaucratic.

- [ ] Add an answer-context capsule in `src/lib/agent/orchestrator/agentic-answer-context.ts`, for example `context.current_turn_conflict`.
- [ ] The instruction should say:
  - acknowledge conflict briefly only when it changes the recommendation
  - do not expose internal words like “override”, “overlay”, “profile patch”, “fallback”
  - use current-turn fact for the current answer
  - do not ask the user to update profile unless it is naturally helpful
- [ ] Example German phrasing:
  - `In deinem gespeicherten Profil sehe ich noch weitere Schritte; wenn du aktuell aber nur Shampoo und Conditioner nutzt, wäre der nächste sinnvolle Hebel ...`
- [ ] Add tests for answer context generation so the capsule appears when routine inventory conflicts, and does not appear for normal non-conflicting turns.

## Task 5: Product Recommendation Rendering Polish

**Goal:** Keep deterministic products authoritative, but make the final answer explain the shortlist more helpfully.

- [ ] Strengthen `product.recommendation_shape` and category-specific capsules in `agentic-answer-context.ts`:
  - start with the product type needed for this user
  - name the best first pick when supported by rank/tool facts
  - explain one meaningful difference per product using `supported_claims`, `profile_basis`, `category_guidance`, and `comparison_facts`
  - avoid flat internal catalog recitation
- [ ] Add prompt-contract tests for:
  - conditioner recommendation explains weight / care intensity / profile fit
  - leave-in recommendation explains lightness, frizz/tangling, heat-protection only when supported
  - combined product + usage prompt answers both parts
- [ ] Do not alter `select_products` ranking unless a failing test proves the deterministic output is wrong.

## Task 6: Keep Production Boundary Clean

**Goal:** Preserve the agreed boundary: Compare Lab prototype first; no production chat wiring yet; no dependency on `ConversationContextPacketV1` for this tool-loop pass.

- [ ] Review `src/lib/agent/orchestrator/route-packet.ts` and `src/lib/agent/orchestrator/prompt.ts`.
- [ ] Remove or gate production final-render dependency on `ConversationContextPacketV1` if it is part of this branch’s uncommitted diff.
- [ ] Keep any production-adjacent changes only if they are required for existing classic Compare Lab baseline and covered by tests.
- [ ] Add/update tests proving production prompt behavior did not start depending on the tool-loop context packet for this task.

## Task 7: Compare Lab Judgment And Scratch-Data Cleanup

**Goal:** Make lab feedback reliable and avoid accidental data leakage.

- [ ] Update `src/app/api/labs/agent-compare/judgments/route.ts` so `unsupported_requested_signals.field` accepts `heat_temperature`.
- [ ] Add a Compare API test that saves a judgment containing a product trace with `heat_temperature`.
- [ ] Delete untracked `tmp/agent-compare-runs.jsonl` before final handoff, or add an explicit ignored scratch-path rule if local logs should remain possible.
- [ ] Do not commit real local run data.

## Task 8: Verification

**Automated checks:**

- [ ] `npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts tests/agent-get-user-context.spec.ts`
- [ ] `npx tsx --test tests/agent-routine-tool.spec.ts tests/agent-select-products-tool.spec.ts`
- [ ] `npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts`
- [ ] `npm run typecheck`
- [ ] `git diff --check`

**Manual / Compare Lab checks:**

- [ ] Restart worktree server with `npm run dev:worktree`.
- [ ] Verify `/labs/agent-compare` responds.
- [ ] Run these prompts against `Produkt-Evaluation`:
  - `Ich habe nur Shampoo und Conditioner. Was sollte ich als nächstes ergänzen?`
  - `Ich habe lockiges Haar, Frizz und verknotete Spitzen. Was wäre der nächste sinnvollste Schritt?`
  - `Mir fallen seit kurzem viele Haare aus. Kann ein Haaröl helfen?`
  - `Ich habe plötzlich Haarausfall und meine Kopfhaut juckt. Welches Produkt soll ich nehmen?`
  - multi-turn: `Ich habe feines Haar, wenig Dichte und trockene Spitzen. Was sollte ich als nächstes ergänzen?` → `Eher gegen Frizz und trockene Längen.` → `Dann lieber Maske oder Leave-in?` → `Kannst du mir konkrete Produkte empfehlen?` → `Und wie oft sollte ich das benutzen?`
- [ ] Expected outcomes:
  - explicit current-turn inventory is acknowledged and used
  - reset does not win for frizz/tangling/dryness unless build-up/reset is explicit
  - hair-loss/scalp-risk questions avoid diagnosis/regrowth promises and separate cosmetic care from medical/scalp context
  - product answers include richer, profile-aware differences without invented claims

## Handoff

After writing this plan, use `branch-gate` if implementation begins in the same session, then execute with `superpowers:subagent-driven-development`.
