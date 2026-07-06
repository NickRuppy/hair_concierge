I have enough grounding. Here's the verdict.

---

**Verdict:** Approve with revisions — the completed work (checked boxes) is well-grounded in the tree; the **three unchecked items are real but under-specified** for a fresh subagent. Tighten those three before handoff.

This plan is a hybrid design-doc + status tracker, already ~80% executed in `.worktrees/selected-product-facts-card-polish`. I verified the completed claims against code rather than re-running the suite; the remaining-work risk lives entirely in the three unchecked boxes (plan lines 260–262).

**Lean shape**
- **Irreducible goal:** On a one-product follow-up or post-selection turn, load facts for *that exact* product via `load_product_facts` and answer from them — never collapse to generic clarification or invented facts.
- **Cut / narrow / reuse:**
  - *Item #3 (trace summary):* don't invent a new summary structure. The pipeline already builds `debugTrace` (`chat-pipeline.ts:1255`, returned at `:1337`) and `PipelineTraceDraft` already carries `repair_attempts` / tool calls / failure stage (`types.ts:1076`). Narrow the item to "expose the existing trace fields to the route and persist them," not "design a new summary."
  - *Item #2:* the lookup-driven generic clarification is **already** suppressed on trusted-selection turns — `suppressStaleLookupActions` forces `productLookupActionsAllowed = false` (`product-lookup-turn-outcome.ts:96–99`), which short-circuits the clarification path to `null` (`:218`). The only genuine residual gap is the *model's own* `answer_mode:"clarification"`. Narrow the item to that one path.
  - *Item #1:* category-scoped pending-review blocking already exists (`buildPendingReviewCategoryFollowupFallback` `:936`, gated by `latestMessageLooksLikePendingProductFollowupForCategory` `:1021–1044`). The patch is a delta, not a build — scope it to the exact precedence gap.
- **Hard tradeoff the plan avoids:** DB-persisted per-turn observability vs. Langfuse. The selection turn already wires `langfuse_trace_id`/`langfuse_trace_url` (`route.ts:200–201, 626`). The plan doesn't say why those traces are insufficient and a second copy in `rag_context` is needed. State the why, or defer #3.

**Prior art**
- *Tool design (name the tool for the task):* matches OpenAI guidance the plan cites. `load_product_facts` is distinct, backend-injects the ID, schema omits `product_id` — verified `tool-definitions.ts:134–139, 166–173`. OK.
- *LLM agent loop — bounded repair w/ forced structured tool:* matches canonical shape. `buildRepairState` forces `load_product_facts` on `product_assessment_grounding` / `trusted_product_unverified_caveat` (`responses-agent.ts:1887–1893`). OK.
- *Fail-closed (no broad fallback):* `requireSingleResolvedProduct: true` verified in prod (`chat-pipeline.ts:1116`) and compare runner (`run-agent-v2.ts:900`, test `agent-v2-compare-runner.spec.ts:186–194`). Matches "fail closed, not fall open." OK.
- *Observability:* canonical is structured trace to the APM you already have (Langfuse). Item #3 duplicates into `rag_context` **without a typed field** — see Blocker 1.

**Blockers** (will stall the subagent as written)
1. **Item #3 has no storage contract.** `MessageRagContext` (`types.ts:821–828`) has fields for sources/engine_trace/lookup_selection but **none** for a selection trace summary; `buildAssistantDecisionContext` (`stream-events.ts:24–57`) has no param for one; and `route.ts:663–669` never reads `pipelineResult.debugTrace`. "Persist selection-turn trace summary" gives a subagent no schema to target. Fix: name the new `MessageRagContext` field + its shape, add the `buildAssistantDecisionContext` param, and reuse `debugTrace` fields (`tool_calls`, `failure_stage`, `repair_attempts`) rather than recomputing "whether `load_product_facts` was called."

**High-confidence issues** (correctness/spec, not preference)
- **Item #1 is a restated rule, not a located gap.** It targets a 1500-line file with deep fallback precedence (`product-lookup-turn-outcome.ts:169–185`). The plan repeats the rule (lines 144–147) but doesn't pin the actual failure: e.g. when `deterministicLookupFallback` is null, does a new named-product turn get pre-empted by `pendingReviewCategoryFollowupFallback` (`:145–152`)? Hand the subagent the exact precedence path + a failing test, or it will patch by guess.
- **Item #2 doesn't name the enforcement layer.** Given the lookup-clarification path is already suppressed (above), the residual "what do you mean?" can only come from the model's own `clarification` answer. The plan must say *where* the guard lives (validator? `buildProductLookupTurnOutcome`? route?) — otherwise three plausible layers, three different patches. The plan's own caution ("Do not assume context is empty without a test," line 170) is good and should be kept.

**Smaller / nice-to-haves**
- **Verification skips the project finish gate.** Plan runs `npm run typecheck` + targeted `tsx --test` (lines 207–217, 268–277) but **not** `npm run ci:verify` (which adds `lint` + `build`, per `package.json`) and no `codex:codex-rescue` review / `/ship` — both mandated by CLAUDE.md "Finishing a Feature Branch." Add before push.
- **Brittle test pattern perpetuated.** `agent-v2-compare-runner.spec.ts:191–193` asserts on *source text* via regex. The plan's "Required coverage" (lines 191–200) leans on this style; prefer behavioral assertions where feasible.
- **Non-determinism in tests:** `new Date().toISOString()` in the outcome builder (`product-lookup-turn-outcome.ts:167`) — fine in prod, but flag for any snapshot test added under items #1–#3.
- **i18n:** fallback/pending copies are native German ("noch in Prüfung", `:965`) — good.

**Bottom line**
The shipped portion is sound and grounded — `load_product_facts`, the fail-closed projection, the validator grounding gate, and the forced-repair loop all exist as the plan claims. Don't re-review that. Before a subagent picks up the three open boxes, do three things: (1) give item #3 a concrete `MessageRagContext` field and point it at the existing `debugTrace` instead of a new summary; (2) convert item #1 from a restated rule into a located precedence gap + failing test; (3) name the enforcement layer for item #2's model-clarification guard. Then add `npm run ci:verify` + codex review to the finish step. With those, it's ready to hand off.

Want me to spec the leaner counter-proposal for items #1–#3 (exact field shapes, target functions, and the failing tests) so a subagent can execute without guessing?
