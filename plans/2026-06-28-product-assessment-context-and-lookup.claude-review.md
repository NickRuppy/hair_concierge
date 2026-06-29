I have enough grounding across the contract, validator, lookup, turn-outcome, adapter, and persisted-state layers. Here is the verdict.

---

**Verdict:** Re-shape first — do not hand to a subagent as written.

The plan is well-reasoned at the decision level, but it is written as a **greenfield build** when most of its machinery already exists on this branch (uncommitted/untracked files), and its Target File Map omits three of the most load-bearing files. A subagent executing it verbatim would either hit unexplained compile errors or rebuild code that already exists.

---

**Lean shape**

- **Irreducible goal:** When a user names a product, resolve its identity (exact / clarify / intake), answer product-specific questions only from verified context, and remember the active product for follow-ups — without firing recommendation cards.
- **Most of this is already built.** Grounding the plan against the code:
  - Identity resolution + exact/clarify/intake routing: `src/lib/product-intake/product-lookup.ts` (7-status enum), `src/lib/agent-v2/product-lookup-policy.ts` (per-status pending-card + `blocks_product_specific_answer`), `src/lib/agent-v2/production/product-lookup-turn-outcome.ts` (deterministic fallback, intake offer, clarification card, active-context build).
  - "Block product claims without verified context": already enforced by `validateNamedProductLookupRequired`, `validateProductLookupResultClaims`, `validateNamedProductDetailAnswer`, `validateTrustedSelectedProductCaveat` (`final-answer-validator.ts:1531-1969`).
  - Active product context + selection receipt: `resolved-product-selection-adapter.ts`, `resolved-product-selection.ts`, persisted via `active_resolved_product_context`.
  So Tasks 2, 4, 5, 6 are **edits to existing code, not new construction.** The plan must be rewritten as a delta ("today X does Y; change it to Z"), or a GPT-5.4 subagent will duplicate/contradict the existing implementation.
- **Cut or defer:**
  - **Multi-product (max 3) + pending-context array (Task 6/7).** Active context is currently a *single* object (`AgentV2ActiveResolvedProductContext`, `persisted-session-state.ts:156`). Converting to a 3-slot array with resolved+pending entries is the largest, least-justified chunk. The single-product assessment case is the dominant one. Recommend: ship single-context + "resolved vs pending" status first; defer the max-3 array until the single path is proven.
- **Hard tradeoff the plan is avoiding:** whether `product_assessment` is a **new answer mode** at all, vs. extending `general_advice`/`product_recommendation`. The found-exact path *already* answers via `general_advice` (`product-lookup-turn-outcome.ts:690`). The only concrete win a new mode buys is structured `assessed_product_ids` grounding (which `general_advice` lacks). That may justify it — but the plan never states the justification, and a new terminal mode is the single most expensive change here (see Blockers). Decide and document this before execution.

**Prior art**

- **Adding an enum value to a discriminated union (`AgentV2TerminalAnswerSchema`):** canonical additive-schema change — but it must be paired with updating every exhaustive consumer. The codebase has two compiler-enforced ones (see Blockers). OK pattern, incompletely mapped.
- **Persisted-state shape migration (single → array):** canonical is normalize-on-read (the code already does this via `normalizeActiveResolvedProductContext`). The plan doesn't mention backfilling/normalizing already-persisted singular contexts — add it.
- **Feature rollout / kill-switch:** the entire lookup path is gated by `productIntakeEnabled`. A new answer mode on the production chat path has **no equivalent kill-switch** in the plan. Canonical: flag the new mode so it can fall back to `general_advice` if it regresses. Missing.
- **Candidate confidence tiering ("strong/weak"):** `ProductIntakeMatchCandidate.confidence` already buckets (`"exact"` / `"review"`). Map the plan's strong/weak onto existing codes rather than inventing a parallel taxonomy.

**Blockers** (will fail or regress as written)

1. **File map omits `product-lookup-turn-outcome.ts`, which has a compiler-enforced exhaustive switch.** Adding `product_assessment` makes `const exhaustive: never = answer` fail to compile at `src/lib/agent-v2/production/product-lookup-turn-outcome.ts:204` (switch at `:185-205`). A subagent told only to touch contracts/validator will hit an unexplained build break in a file it wasn't pointed at. Add the file and the required new `case "product_assessment"`.
2. **`payloadFieldsByMode` is `Record<AgentV2AnswerMode, …>` — also compiler-enforced.** New mode → compile error at `final-answer-validator.ts:198` until a payload-field entry is added. The validator is in the map but this specific obligation isn't called out.
3. **The new mode collides with the existing "product_detail ⇒ select_products required" contract.** With `product_request_kind: "product_detail"` (which assessment turns will carry) and `answer_mode: "product_assessment"`, three validators will *block* the turn: `validateInterpretationAnswerMode` (`:696-711`, allowlist excludes the new mode), `validateInterpretationToolHistory` (`:878`, requires `select_products`), and `validateProductToolRequired` (`:1448`). The `select_products` tool description itself says product_detail "requires select_products before any terminal answer" (`tool-definitions.ts:135`). Task 3 frames this as "untangle wording," but it is **validator logic across ≥3 functions plus a tool-description rewrite** — and the plan provides no "grounded by `lookup_product_candidate`" exception path equivalent to the existing `isGroundedByTrustedProductSelection` (`:1470`). Specify exactly how product_assessment becomes a recognized grounded mode.

**High-confidence issues** (correctness, not preference)

- **Locked decision "lookup broadly when category is missing" is not implemented and no task adds it.** The tool already *promises* the model it may pass `category: null` (`tool-definitions.ts:125`), but `lookupProductCandidate` hard-returns `insufficient_identity` when category is absent (`product-lookup.ts:293-299`). Task 4 ("improve fuzzy matching") never mentions a category-less search path. As written, "infer when obvious; otherwise lookup broadly" is impossible — the lookup simply refuses. Add an explicit task to support no-category lookup, or change the locked decision.
- **Active-context migration under-specifies its consumers.** Converting to max-3 + pending touches more than `persisted-session-state.ts`: the trace projection reads `.product_id`/`.category` as singular (`persisted-session-state.ts:127-130`), and `chat-pipeline.ts:448-451, 574-576, 834` and `session-state.ts:192` all thread the singular value. Enumerate these as edit sites and define normalization of old persisted singular values to the new shape.
- **`named-product-context.ts` is absent from the file map but drives the whole gate.** `isNamedProductContextActionableForLookup` keys off `named_product_intent` ∈ {evaluation, current_use_product_question, routine_add} (`:1567-1577`). The new assessment path must integrate with these intents; a subagent won't know to look here.
- **"Refresh pending submission status from Supabase when needed" (Task 6, line 244) is a fuzzy verb on the production chat path** with no trigger condition, no latency budget, and no caching. Define *when* it fires and its p95 cost, or it becomes an unbounded per-turn DB read.

**Smaller / nice-to-haves**

- Task 8 names an `"ambiguous"` candidate status; the code path for same-brand/same-category multiples is `needs_variant_selection` (`product-lookup.ts:421-430`) — `"ambiguous"` exists in the policy map but is never produced by the lookup. Point tests at the real statuses.
- Required Checks omits `tests/agent-v2-product-lookup-policy.spec.ts` even though `product-lookup-policy.ts` is being edited; add it. Also prefer the project's `npm run ci:verify` over bare `npm run typecheck` (CLAUDE.md), and note the mandated `codex:codex-rescue` branch review for the eventual finish.
- Task 1 edits contract tests, but the test list (lines 151-159) omits `tests/agent-v2-contracts.spec.ts` (it appears only under Required Checks). Add it to the touched-files list.
- No kill-switch: add a flag to disable `product_assessment` and fall back to `general_advice`, consistent with `productIntakeEnabled` gating the lookup path.

**Bottom line**

Re-shape before executing. Three changes make this subagent-ready: (1) **reframe as a delta** on the existing lookup/policy/turn-outcome/validator code, not a greenfield build; (2) **complete the file map and the new-mode obligations** — add `product-lookup-turn-outcome.ts` (exhaustive `never` switch), the `payloadFieldsByMode` record, `named-product-context.ts`, and the precise validator allowlist edits + a "grounded by lookup" exception, plus a kill-switch; (3) **resolve the two unaddressed conflicts** — the `select_products`-required-for-product_detail contract, and the category-less lookup the locked decisions assume but the code forbids. Defer the max-3 array / pending-array until single-context assessment is proven. The decision-level thinking is sound; the execution surface is just under-mapped against code that's already half-built.

Want me to spec the leaner counter-proposal (single-context, delta-framed, with the exact validator and turn-outcome edit sites enumerated) so you can compare side-by-side?
