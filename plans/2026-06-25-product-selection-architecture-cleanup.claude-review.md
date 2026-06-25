I have enough grounding. Let me write the verdict.

---

**Verdict:** Approve with revisions — the cleanup is real and well-grounded, but Phase 2 (adapter placement) will create a circular dependency as written, and the plan under-specifies which duplicate types it is collapsing. Fix those before handing to a subagent.

---

**Lean shape**

- **Irreducible goal:** Before shipping the (already-verified, already-patched) product-lookup clarification feature, give the selected product one authoritative *source* object and pull the scattered lookup-outcome branches out of the 1,746-line `chat-pipeline.ts`, so future selection-grounding regressions are harder.
- **Cut or defer:**
  - **Phase 5 (test split) is the most deferrable.** It does nothing for production-regression risk — `tests/agent-v2-production-chat-pipeline.spec.ts` is 5,834 lines with 13 `createProductSelectionPostHandler` call sites (`tests/agent-v2-production-chat-pipeline.spec.ts:839–1653`), and the plan itself adds a "verify no coverage lost" checklist item (line 265), which is a tell that the split carries coverage-loss risk for pure ergonomics. Split *after* ship, or only after Phases 1–4 are green.
  - **Trim the `ResolvedProductSelection` helper list (plan lines 88–95).** "derive a stable selection key" already exists as `createStableUuidFromParts` (`route.ts:86-92`); "normalize nullable category/name fields" already exists inline (`route.ts:343-350`). Reuse/move these, don't re-invent them as new domain helpers, or you get abstraction laundering.
- **Hard tradeoff the plan is avoiding:** *Whether to refactor at all before ship.* Line 37 calls this "required before shipping," but the feature is verified and both motivating bugs are already patched (per `2026-06-25-product-lookup-clarification-card.md:744-756`). So this is risk-*reduction*, not a blocker — and the refactor itself mutates the shared `runAgentV2ProductionPipeline` that serves **all** chat, not just product lookups. The honest framing is "ship-then-cleanup vs cleanup-then-ship," and the plan asserts the latter without weighing the regression risk of refactoring the main chat path on top of an entirely uncommitted feature diff (every touched file is `M`/`??` in git status — there is no committed baseline to diff or revert to).

---

**Prior art**

- **Canonical domain model + adapter (hexagonal / ports-and-adapters):** Canonical invariant — the domain model has no dependency on the infra/adapter layer; adapters depend on the domain, never the reverse. The product-domain side respects this (plan line 96: "must not import AgentV2 runtime types" — achievable, since `src/lib/product-intake/` has no AgentV2 imports today). **The AgentV2 adapter side violates it** — see Blocker 1.
- **Extract Function / Move Function (Fowler):** Canonical invariant — behavior-preserving, characterization tests already in place before moving. Satisfied: dense pipeline/route tests exist and the handoff note (lines 323-327) mandates behavior preservation. OK.
- **Idempotent single-use action + stable idempotency key:** The route already implements key→replay (`route.ts:86-92`, `findExistingSelectionMessage` `route.ts:49-76`, duplicate-key replay `route.ts:458-487`). Plan Phase 4 preserves it. OK.
- **"One canonical representation" claim — overstated.** After this change there will still be ≥5 selection shapes: the new `ResolvedProductSelection`, the wire/persisted `ProductLookupSelectionContext` (`types.ts:861`), runtime `AgentV2TrustedSelectedProductContext` (`responses-agent.ts:121`), `AgentV2ActiveResolvedProductContext`, and `AgentV2StoredProductProjection`. The pattern legitimately makes one object the *source* and derives the rest — but the plan's prose ("one canonical representation," line 12) could mislead an executor into trying to delete the wire/runtime types and break serialization or the validator seam. Reword to "one source, typed adapters derive the rest."

---

**Blockers** (will fail or regress as written)

1. **Phase 2 adapter placement creates a circular dependency.** The plan puts the adapter at `src/lib/agent-v2/production/resolved-product-selection-adapter.ts` (line 103) and says "Move selected-product conversion logic out of `responses-agent.ts`" (line 224). But `responses-agent.ts` is the **runtime** layer and does *not* import from `production/`; `production/chat-pipeline.ts` imports *from* runtime (`chat-pipeline.ts:37`). The conversion functions the plan wants to absorb — `buildTrustedSelectedProductLookupResult` (`responses-agent.ts:1110`) and `buildTrustedSelectedProductProjection` (`responses-agent.ts:1130`) — are *used inside* `responses-agent.ts` (`:326`, `:332`) and consume types defined there. Moving them to `production/` forces `responses-agent → production → responses-agent` = cycle. **Fix:** either (a) place the AgentV2 adapter + the shared types (`AgentV2TrustedSelectedProductContext`, `AgentV2ActiveResolvedProductContext`) in `runtime/` or a shared `agent-v2/` module so both layers import down, or (b) explicitly scope Phase 2 so only the *chat-pipeline-side* conversions move (`buildActiveResolvedProductContext` `:1150`, `buildStoredProjectionForTrustedSelectedProduct` `:1195`, `buildNextActiveResolvedProductContext` `:1182`) and the runtime-side ones stay put. State which, because "where possible" (line 224) silently hides this.

2. **The plan does not enumerate the actual type duplication it must collapse — and one pair has *divergent* definitions.**
   - `AgentV2ActiveResolvedProductContext` is declared twice, identically: `responses-agent.ts:137` and `persisted-session-state.ts:32`.
   - `AgentV2StoredProductProjection` is declared twice with **different shapes**: `persisted-session-state.ts:16` = `Pick<Partial<AgentV2SelectProductsProjection>, "tool_name"|"category"|"valid_product_ids"|"products">` vs `chat-pipeline.ts:119` = `Partial<AgentV2SelectProductsProjection>` (all fields). The plan's `ProductLookupTurnOutcome.priorSelectedProductProjection: AgentV2StoredProductProjection` (line 146) is therefore ambiguous about which type it means. An executor extracting the builder must pick one and update both call sites, or typecheck will pass while semantics drift. **Fix:** add an explicit "consolidate these named duplicates → single home" step listing the exact file:line pairs.

---

**High-confidence issues** (correctness, not preference)

- **The active→trusted projection is non-trivial and must be preserved exactly during extraction.** `responses-agent.ts:306-324` re-labels a persisted `active_resolved_product_context` (whose own `source` is `"product_lookup_selection"`) into a `"product_lookup_clarification"`-shaped trusted context with a *synthesized* `lookup_identity` (`brand_text: null`, `product_name_text: name`, `evidence_quote: name`). A naive adapter that maps fields 1:1 will change `evidence_quote`/`brand_text` and shift what the validator grounds against. The plan flags "ensure validator grounding still receives equivalent data" (line 227) but doesn't name this specific transform — call it out so it isn't lost.
- **This is the trust-boundary seam; getting it wrong regresses in both directions.** `buildTrustedSelectedProductLookupResult` (`responses-agent.ts:1110-1128`) feeds `productLookupResults` (`:330-333`) into the validator context (`:390-399`). If the extracted adapter changes the synthetic `found_exact` shape, either valid selection answers get rejected (feature regression) or unverified product claims slip through (trust regression). Plan Phase 2 checklist (lines 228-231) covers the *intent*; add an assertion-level acceptance criterion (e.g. a test that the adapter output is byte-identical to the current inline result for a fixed input).
- **No general-chat (non-product) regression check.** Every verification scenario (plan lines 294-301) is a product-lookup flow, yet the refactor edits `runAgentV2ProductionPipeline`/`runAgentV2ResponsesTurn`, which build validation context for *every* turn (`responses-agent.ts:390-399` runs unconditionally). Add at least one plain non-product chat smoke + run `npm run test:chat` (the chat eval) to confirm the shared path is unchanged.

---

**Smaller / nice-to-haves**

- **Checkpoint the verified feature before refactoring.** The whole feature is uncommitted (git status: `M` across the touched files, `product-selection/` untracked). A "behavior-preserving" refactor with no committed baseline can't be cleanly diffed or reverted. Commit the green feature first (the handoff note already says don't push without approval — a local checkpoint commit is compatible with that).
- Preserve the `category` cast at `chat-pipeline.ts:1201` (`as AgentV2StoredProductProjection["category"]`) when unifying the projection type, or the category union will reject `string | null`.
- Verification block is otherwise solid: all 8 referenced test files exist, and `typecheck` / `ci:verify` resolve to real scripts (`package.json`). Good.
- Rollback note: the plan inherits `PRODUCT_INTAKE_ENABLED` as the kill-switch (other plan line 798-799), but that flag does **not** gate a regression the refactor introduces in the *general* pipeline path. Don't lean on it as the rollback story for this refactor; the rollback story is "revert the refactor commit," which is another reason for the checkpoint above.

---

**Bottom line**

Don't ship to a subagent verbatim. The premise is sound and grounded — the duplication is real (`AgentV2ActiveResolvedProductContext` ×2, `AgentV2StoredProductProjection` ×2-divergent), `chat-pipeline.ts` genuinely carries ~20 lookup-outcome helpers (lines 197-1218), and the canonical-source + adapter shape is the right pattern. But fix two things first: (1) re-place the Phase 2 adapter so it doesn't invert the runtime→production layering into a cycle, and (2) make Phase 1/2 explicitly enumerate the duplicate types to collapse, including the divergent `AgentV2StoredProductProjection`. Then add a general-chat regression smoke and a checkpoint commit, and consider deferring Phase 5 (test split) until after the production-risk phases are green. With those revisions it's a clean, low-risk extraction.

Want me to spec the corrected Phase 2 (adapter + shared types in `runtime/`, with the exact functions that move vs stay) so you can drop it into the plan?
