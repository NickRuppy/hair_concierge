I have enough grounding to write the verdict. Here is the review report.

---

**Verdict:** Approve with revisions — re-shape Step 2, define the classification, and name the real reuse targets before handing to a subagent.

**Lean shape**
- **Irreducible goal:** Turn `pending_review` submissions into reviewable research packages, and make empty shells visibly "not researched" so the review app isn't full of empty drafts.
- **Cut or defer:**
  - **Step 2 (apply mode) is the weakest premise — cut or defer from v1.** It saves the *empty* draft payload (`buildDraftPayload` emits `sources: []`, `field_rationales: {}`, no `final` — `prepare-research.ts:202`) to Supabase and flips status `pending_review → researching`. Before real research exists this writes nothing useful and only mutates status. The runner's value is the worklist; the write adds risk without payoff.
  - **Re-use, don't rebuild.** `prepareResearchPackagesFromQueue` (`prepare-research.ts:123`) *already* composes "load `pending_review` rows" + "prepare packages" — it is exactly Step 1's first two bullets in one call. `listReviewPackages` (`review-app.ts:700`) *already* walks `ops/product-intake-research/*/*`, reads `payload.json`, and computes `validation_ok` + `image_status` — most of Step 1's "inspect and classify." The plan says "the existing queue loader / package builder" as if they must be re-wired; name these two functions so the subagent doesn't build parallel logic.
  - Step 3's "Noch nicht recherchiert" label is a one-liner (`isRecord(payload.final)` — the codebase already uses this exact check at `review-app.ts:639,680`). Keep it that small.
- **Hard tradeoff the plan is avoiding:** the classification rules themselves. It names four states but defines zero predicates.

**Prior art**
- **Queue/background runner** (at-least-once + idempotent + poison handling): package creation is correctly idempotent — `prepareResearchPackages` skips existing folders (`prepare-research.ts:90`). ✅ But the "poison/blocked" arm is named (`blocked`) with **no trigger defined** — missing invariant.
- **Optimistic locking on shared row:** apply-mode's write maps to `saveResearchedPayload` (`review-actions.ts:119`), which already guards with `.eq("status", …).eq("updated_at", …)` + status whitelist. ✅ Canonical — *if* apply mode survives.
- **Dry-run-first / kill-switch:** default read-only, `--apply` gating, approval-apply explicitly excluded. ✅ Matches safe-by-default.

**Blockers** (will derail a subagent as written)
1. **Classification predicates are undefined** — `needs_research` / `in_progress` / `ready_for_review` / `blocked` have no criteria, yet Step 5 says "unit-test package classification." There is nothing to test against; a subagent will invent the rules. Define each predicate explicitly, e.g. `needs_research` = no `payload.final`; `in_progress` = has `final` but `validation.ok === false`; `ready` = `validation.ok === true` (this is already computable — `dryRunProductIntakeReadyForReview` returns `ok:false` for draft-only payloads, `review-workflow.ts:28-53`). **`blocked` has no concrete trigger — give it one or cut it.**
2. **State-name collision with the Supabase status enum** — `ready_for_review` is already a `product_submissions.status` value (`src/lib/types.ts:340-343`) *and* a dry-run result status (`review-workflow.ts:17`). Reusing the same word for a *local package* classification will confuse every reader and test. Namespace the package states (e.g. `package_state`) or deliberately reuse the existing status vocabulary — don't silently overload it.
3. **Apply-mode ↔ `pending_review` filter incoherence** — Step 1 loads `pending_review`; Step 2 flips status to `researching`. But the loader hardcodes `statusFilter: "pending_review"` (`prepare-research.ts:133`). Once flipped, the submission is invisible to the runner's own loader and to a `pending_review` worklist on the next run — only re-discoverable by scanning local folders. The plan never reconciles this. Either the runner must also load `researching` rows, or the status flip must be removed/deferred (see Lean Shape).

**High-confidence issues** (correctness, not preference)
- **Verification misses the file it changes.** Step 3 edits `review-app.ts`, but the Verification block runs only `product-intake-research-package.test.ts` + `product-intake-review-scripts.test.ts` + `tsc`. The dedicated `tests/product-intake-review-app.test.ts` (the 43 KB file that actually covers review-app behavior) is not run. Add it.
- **Verification command deviates from project standard.** Plan uses `npx tsc --noEmit --pretty false`; CLAUDE.md mandates `npm run ci:verify` (typecheck + lint + build). `npx tsx --test` is fine — it matches `test:node`'s `tsx --test` runner — but lint+build aren't exercised, and a new script file plus review-app edits can break either. Finish with `npm run ci:verify`.
- **Step 5 "update script exposure tests"** — the target is `tests/product-intake-review-scripts.test.ts:52` ("Phase 4A package scripts expose…"), which asserts exact `packageJson.scripts[...]` strings. The new `products:intake:research-queue` entry must be added there or that test won't cover it. Plan should name the assertion block.

**Smaller / nice-to-haves**
- Server-side approval gating already exists (`review-app.ts:841-865` throws if product/image/properties aren't ready). Step 3's "disable/hide approval controls" is UI defense-in-depth, not a correctness gate — keep it light.
- Safety boundary "preserve existing dirty files" is consistent with `appendProductAdditionRecord` (`review-actions.ts:324`, merge-not-clobber). Good; the dirty `data/product-additions/2026-06-27-user-submitted.json` in git status is safe.
- Docs Step 4 updates the existing `docs/product-intake-research-ops.md` (22 KB) rather than adding a file. ✅ No sprawl.

**Bottom line**
The shape is right: a dry-run-by-default queue runner that emits a Codex worklist and marks empty packages not-reviewable is the correct, minimal v1, and it sits cleanly on safe primitives that already exist. Before this goes to a subagent, fix three things: (1) write down the classification predicates and rename to dodge the `ready_for_review` status collision; (2) either cut apply-mode from v1 or reconcile its `researching` flip with the hardcoded `pending_review` loader; (3) point the plan at the real reuse targets — `prepareResearchPackagesFromQueue`, `listReviewPackages`, `saveResearchedPayload`, and the script-exposure assertion — and run `tests/product-intake-review-app.test.ts` + `npm run ci:verify` in the Verification block. With those, it's ready to execute.

Want me to spec the leaner counter-proposal (runner = `prepareResearchPackagesFromQueue` + classification over `listReviewPackages`, no apply-mode) so you can compare side-by-side?
