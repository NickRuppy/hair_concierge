Verdict report below.

---

**Verdict:** Approve with revisions — the direction is sound and well-grounded, but the test plan as written would not prove the new behavior, and the hardest case (mixed answers) has no specified mechanism. Fix the three items below before handing to a subagent.

**Lean shape**
- **Irreducible goal:** When an answer assesses a *resolved* product, an *unrelated pending* product in conversation state must not block it; a pending product blocks only when the answer actually claims about *that* product.
- **Cut or defer:**
  - **Task 1, regression #1 already exists** — `tests/agent-v2-final-answer-validator.spec.ts:2015` ("validator does not let stale pending active product block resolved product assessment follow-up") is *exactly* the plan's first proposed regression (resolved Head & Shoulders shampoo + pending Balea `leave_in`, answer about shampoo only, expects no `product_lookup_unresolved`). It's an uncommitted working change in this very workspace. Don't re-add it; reference/extend it.
  - **Architecture-Direction bullet "Each assessed resolved product id must be trusted by exact lookup / trusted selection / active resolved context"** is *already enforced* by `validateProductAssessmentGrounding` (`final-answer-validator.ts:1492`, via `collectResolvedProductAssessmentIds` at `:1579`). The new work is purely on the *pending-blocking* side (`validateProductLookupResultClaims` at `:1699`). Scope the plan to that to avoid a second source of truth for resolved-side validation.
- **Hard tradeoff the plan is avoiding:** distinguishing "deferring an unresolved product" from "claiming about it" in free German prose. The plan says "careful wording" (Open Risks) but specifies no detector and no acceptance criterion. See Blocker 2.

**Prior art**
- **Scope-a-guard-to-its-entity / relevance filtering:** matches the canonical "prefer stable IDs, fall back to fuzzy match" shape — the plan correctly prioritises `assessed_product_ids` / `tool_grounding.product_ids` over name/category. ✔
- **Claim-vs-deferral detection:** there is no canonical "this sentence asserts vs. defers" primitive — this is NLP-hard. Treat as genuinely novel → demands a much higher scrutiny bar (explicit acceptance criteria, fixtures), which the plan does not provide. Missing invariant.

**Blockers** (will regress or fail to deliver the goal as written)

1. **The real residual gap — same-category pending vs. resolved — is missing from the task list.** The committed+uncommitted "category patch" (`final-answer-validator.ts:2027-2032`, an *uncommitted* change confirmed via `git diff`) already makes a *cross-category* pending product non-blocking. So all three of Task 1's regressions (shampoo-resolved vs. `leave_in`-pending) are already handled — they won't prove anything new. The case product-scoping *uniquely* fixes is a pending product in the **same category** as the resolved one: it passes the category check at `:2029`, then matches on `hasPersonalizedHairContext` + `hasCategoryReference` + `hasSuitabilityAssessmentPredicate` (`:2034-2038`) and wrongly blocks. **Add a same-category regression (resolved shampoo A + pending shampoo B, answer about A only → no block) as the headline test** — without it, the plan ships ID-scoping logic with zero proof it changed behavior.

2. **Mixed-answer regression (Task 1 #3) has no mechanism and currently blocks.** `unresolvedLookupResultMakesProductSpecificClaim` (`:2007`) evaluates claim predicates over the *entire* `user_facing_answer_de`. A mixed answer that asserts the shampoo ("…passt…") and defers the leave-in ("…noch in Prüfung…") will (a) trip `hasNamedProductClaimPredicate` on the shampoo sentence and (b) match the named, unresolved leave-in via the name/category fallback — so it blocks. The plan's rule "use name/category fallback only when no id signal exists" does **not** resolve this: the deferred product genuinely has *no* ID yet *is* named in the prose. The plan needs a concrete deferral-vs-claim detector (e.g. per-sentence/per-product claim scoping) with an acceptance criterion, or it must explicitly descope the mixed case. As written, regression #3 will fail.

3. **`unresolvedLookupResultMatchesPendingCategoryAssessment` has two call sites, not one.** Task 3 says "replace or narrow" it, but it's invoked at both `final-answer-validator.ts:1724` (relevance filter) and `:1743` (product-specific-claim check). Both must change consistently or the function will be partly bypassed/partly enforced. Call this out for the executor.

**High-confidence issues** (correctness, not preference)
- **Verification command is below project standard.** The plan runs `npm run typecheck` only (line 158); CLAUDE.md mandates `npm run ci:verify` (= `typecheck && lint && build`, confirmed in `package.json`). New helpers risk eslint failures (unused vars/params). Add `npm run lint`. (The `npx tsx --test tests/...` invocation is correct — it matches the `test:agent` script's `tsx --test` runner.)
- **Proposed helper names are clean** — `buildProductAssessmentClaimTargets` / `unresolvedLookupResultMatchesClaimTarget` don't exist yet (grep confirms). No collision. ✔

**Smaller / nice-to-haves**
- **Task 4 runtime seam:** `tests/agent-v2-responses-runtime.spec.ts` is 266 KB; adding a runtime regression there is non-trivial. The plan already hedges ("if a runtime seam is too expensive, document why and keep the validator regression as the controlling proof") — acceptable, but given Blocker 1, make the *validator same-category* test the controlling proof, not the cross-category one.
- **Problem section is stale.** It narrates the cross-category failure as the live bug, but that bug is already patched + tested in this workspace (uncommitted). Reframe the Problem around the same-category residual gap so the executor doesn't "fix" an already-green case.
- **Memory check:** `MEMORY.md` has no prior decision on this validator; nothing re-opened. No recorded constraint skipped. ✔

**Bottom line**
Ship after re-shaping the test surface, not as-is. The architecture direction (ID-first claim-target scoping) is correct and grounded, and the resolved-side invariants it relies on already exist. But two of the three proposed regressions are either already covered (`:2015`) or already-green by category narrowing, the one case that justifies the whole change (same-category pending vs. resolved) is absent, and the mixed-answer case is specified by aspiration rather than mechanism. Concretely: (1) add a same-category disambiguation regression as the headline proof; (2) specify a deferral-vs-claim detector with acceptance criteria or descope the mixed case; (3) note both call sites of the rewritten matcher and switch verification to `npm run ci:verify`.

Want me to spec the leaner counter-proposal (drop redundant regression #1, headline the same-category test, and sketch a per-product deferral detector) so you can compare side-by-side?
