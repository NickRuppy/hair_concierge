I have everything I need. Here is the verdict report.

---

**Verdict:** Approve with revisions

The plan is correctly shaped — model authors prose, structured tool output drives the card, validators guard the boundary — and its central, riskiest architectural claim checks out. But two execution details are mis-grounded against the validator layer and one new check has a kill-switch gap. Fix those four points and it's safe to hand to a subagent.

**Verified-true claims (good grounding)**
- **Core claim holds.** `lookup_product_candidate` output is serialized to the model via `buildFunctionCallOutput` → `stringifyToolOutput`, which is a plain `JSON.stringify(output)` (`responses-agent.ts:913`, `:1242`, `:1648`). So adding `assistant_guidance` to `ProductLookupResult` is model-visible with **no chat-pipeline threading** — exactly as the plan states (`product-lookup-turn-outcome.ts` / `chat-pipeline.ts:650-664` return the raw result).
- **The prompt language the plan targets exists.** `buildNamedProductContextGuidance` (`responses-agent.ts:1091-1122`) contains the "only discuss category-level plausibility or limitations if useful" line (`:1113`) that Task 3 wants to soften, and it's already gated by `productIntakeEnabled` (`:1109`).
- **Construction is confined.** Full `ProductLookupResult` objects are built only in `product-lookup.ts` (`emptyResult` + ~5 inline returns at `:326`, `:352`, `:374`, `:393`, `:412`). Making the field **required** forces TypeScript to flag every site — a strong "no silent skip" net for "populate on each result."
- **Test wiring gap is real.** `test:agent` runs `agent-v2-production-chat-pipeline.spec.ts` but **not** `agent-v2-product-lookup-clarification.spec.ts` or `agent-v2-product-selection.spec.ts` (`package.json:37`). Task 6's wiring step is justified.
- **Reuse target exists.** `normalizeGermanText` (`user-facing-language.ts:387`) is the helper Task 5 says to reuse. Correct.
- **Copy change is low-risk.** No test pins the generated `prompt_de` string; the only assertion is a non-doubling guard `/Syoss Syoss/i` (`agent-v2-product-lookup-clarification.spec.ts:967`). Task 4's worry about relaxing copy assertions is mild over-caution.

**Lean shape**
- Irreducible goal: unresolved-lookup turns read as one coherent flow — model writes the bubble, card carries the action, no product/category verdict before identity is resolved.
- **Cut:** the `assistant_guidance` struct's `claim_boundary` and `card_role_de` fields are guilty-until-justified. `claim_boundary` is a pure function of `status` (so redundant for any code that already has the status), and `card_role_de` is model-facing prose that folds naturally into `assistant_instruction_de`. Consider shipping just `pending_ui_action` + `assistant_instruction_de` unless a concrete consumer needs the other two.
- **Hard tradeoff the plan is avoiding:** "answer naturally" vs. "no category-level assessment." For `needs_variant_selection`/`category_mismatch`, warm category-level talk ("Locken-Shampoos generell…") may be *desirable*, yet the plan asks validators to block "category-level assessments." It never resolves whether that prose is wanted or forbidden, and gives no way to tell the two apart (see Blocker 2).

**Prior art**
- Structured-tool-output-drives-UI + LLM composes NL: **matches** canonical shape — cards stay metadata-driven (acceptance criterion), model authors prose. Good.
- In-band instruction injection (tool result carries an `assistant_instruction_de`): canonical risk is leak/paraphrase; plan handles it (no internal ids, `product-lookup.ts:59`). **Missing invariant:** no cap when lookup is called multiple times — guidance blobs accumulate in context. Plan's Open Risk notes verbosity but adds no bound. Minor.
- Within-answer dedup (Task 5): canonical is normalized-shingle/paragraph-hash. Plan is directionally right but the threshold ("medium/long paragraphs") is unspecified — needs a concrete length/similarity cutoff to be implementable.

**Blockers** (will fail or silently no-op as written)
1. **The validator cannot see `assistant_guidance.claim_boundary`.** Target File Map (plan line 140) says to gate the new block on `assistant_guidance.claim_boundary === "no_product_assessment_until_resolved"`. But `validateProductLookupResultClaims` consumes `AgentV2ProductLookupValidationResult` (`final-answer-validator.ts:55-65`, `:1588`), which is projected by `summarizeProductLookupResult` (`responses-agent.ts`) and **drops every field except `status`/`category`/`input_identity`/`product`**. The new field never reaches the validator. Fix: key off `status` directly (the validator already has it and it fully determines `claim_boundary`) — and delete the `assistant_guidance.claim_boundary` reference from the validator task. Threading the field through the projection is the wrong, heavier path.
2. **"Block category-level assessments" has no detection mechanism.** The existing block (`validateProductLookupResultClaims`, `final-answer-validator.ts:1612-1631`) only fires when `makesProductSpecificClaim` is true (product_recommendation/routine mode, payload product_ids, or named-product-specific claim). A `general_advice` answer giving category-level plausibility in free German prose won't trip it, and the plan supplies no regex/signal/acceptance criterion to detect "category-level assessment" in prose. As written this task either does nothing or is unimplementable. Decide: rely on prompt guidance + the existing product-specific block (and don't claim validator enforcement of category-level prose), or specify the exact detector.

**High-confidence issues**
- **No kill-switch on the two new validators.** This touches the production answer path. The new duplicate-paragraph check lands in `validateUserFacingLanguage`, which runs **unconditionally on every turn** (`final-answer-validator.ts:129`) — not behind `productIntakeEnabled`. A too-aggressive paragraph-dedup `block` could regress live answers with no rollback. Mirror the existing pattern: start as `severity: "warn"` or gate behind a module constant like `CLOSURE_BLOCK_FINDINGS_ENABLED` (`user-facing-language.ts:53`), then promote. (The category block is implicitly gated because `productLookupResults` is only populated when intake is enabled — acceptable.)
- **Repair-loop interaction.** A `block` finding *is itself* a repair trigger. A duplicate-paragraph block on repair output would request another repair; repair is bounded (`responses-agent.ts:497`, `max_repair_turns`) so it terminates at `repair_failed` → deterministic fallback, but the plan should state the check is meant to *downgrade to fallback*, not to iterate.

**Smaller / nice-to-haves**
- Be explicit that the Task-1 "bubble repeats card" regression must be a **pipeline-level** assertion (compare `answer` vs `productLookupClarification.copy.prompt_de`), since the Task-5 validator "cannot see card copy" (plan already acknowledges at line 190 — just wire Task 1 to the right layer).
- `src/lib/types.ts` ("extend only if required") is conditional and likely a no-op since the shape is pinned in `product-lookup.ts`; fine to leave, but don't let a subagent invent type churn there.
- The duplication premise is grounded: the current card copy is genuinely verbose (`product-lookup-turn-outcome.ts:317-322`, e.g. "Ich finde {requestedName} nicht eindeutig, aber ich habe…"), so Task 4's shortening is well-motivated.
- Finish step names "code review" but not the `codex:codex-rescue` agent the repo mandates (CLAUDE.md). Minor.

**Bottom line**
Ship after revisions. The architecture is sound and the headline mechanism is verified. The must-fix list is small and local: (1) gate the validator on `status`, not the invisible `assistant_guidance.claim_boundary`; (2) either define a concrete detector for "category-level assessment" or drop that as a validator guarantee; (3) give the two new validators a warn-first/kill-switch; (4) trim the 4-field guidance struct toward `pending_ui_action` + `assistant_instruction_de`. None of these change the plan's shape — they correct where enforcement actually lives.

Want me to spec the leaner `assistant_guidance` shape and the status-keyed validator change side-by-side so you can drop them straight into the plan?
