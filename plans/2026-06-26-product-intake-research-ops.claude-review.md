I have everything I need. All claims are grounded. Here is the verdict.

---

**Verdict:** Approve with revisions — the shape is right, but three fixes are needed before a subagent executes it (one is a correctness blocker).

**Lean shape**
- **Irreducible goal:** A scheduled read-only job scaffolds local research packages from `pending_review` submissions; a human-gated wrapper applies an approved package (save payload → approve → notify) with all Supabase writes behind `--apply --confirm`.
- **Cut or defer:**
  - **The "Approval Wrapper" is ~80% already built.** `approveSubmissionById` in `scripts/product-intake/approve.ts:22-127` already loads → validates → dry-runs → approves → appends the addition record → notifies → prints product id / notification / addition-record path. `scripts/product-intake/approve-ready.ts:1-66` is the *exact* precedent for the wrapper: it reads ids, checks `ready_for_review`, runs `validateSubmissionReady`, and calls `approveSubmissionById({apply, confirm})`. Task 4 steps 4–7 are existing behavior — the wrapper should be a thin variant of `approve-ready.ts` sourced from a local package, not a re-description of the approval pipeline.
  - **Task 3 (Review Lane) is largely redundant.** `scripts/product-intake/queue.ts` already *is* the review lane: `ACTIONABLE_STATUSES = pending_review, researching, ready_for_review, needs_more_info` (`queue.ts:10-15`), `--status` for any single status, `--include-closed` for closed statuses, `--report` for counts, `--format=json` (`queue.ts:134-138`). Narrow Task 3 to the single real delta (treat `pending_review` as backlog context vs. actionable default) or drop it.
- **Hard tradeoff the plan is avoiding:** Research *quality* — the plan admits (Open Risk #1) the first version only scaffolds `payload.json` and still needs manual/Codex editing. So the "automation" automates the cheap part (folder + read dump) and leaves the expensive part manual. That's a fine v1, but the plan should say plainly that fresh packages are *expected* to fail `validation.json`.

**Prior art**
- **Human-in-the-loop dry-run→apply** (prepare read-only, write behind explicit confirm): matches the canonical shape — idempotent prepare (skip-existing), explicit `--apply --confirm`, id-match guard before write (Flow step 2). OK.
- **Optimistic locking on a shared row:** `research.ts:97-113` guards the update with `.eq("updated_at", …)`. The wrapper's two-step (save-then-approve) is safe *only because* `approveSubmissionById` re-loads the submission (`approve.ts:30`). The plan must not cache the pre-save row for the approve call. Note this invariant.
- **"Don't build a second approval implementation"** (plan's own Open Risk #3): the canonical move is to reuse `approveSubmissionById`, exactly as `approve-ready.ts` does. The plan never names this function — name it.

**Blockers** (will fail or regress as written)

1. **Wrapper step 5 "Link the approved product to `user_product_usage`" is redundant and, if implemented via `product_intake_link_existing_product`, a wrong-RPC double-write.** The approve RPC *already* relinks the usage row to the new product — `supabase/migrations/20260617120000_product_intake_review_workflow_functions.sql:842-850` sets `product_id = new_product_id, match_status = 'matched'`. The `link_existing` RPC is for the *matched-existing* path (linking to a pre-existing catalog product), not the freshly-approved path. Fix: delete step 5; state that approve handles usage linking. The Task-6 verification "`user_product_usage.product_id` is linked" is correct as an *assertion* — just not as a separate wrapper step.

2. **`research.ts` save logic is not reusable — nothing is exported.** The wrapper must write `researched_payload` to the DB and set `ready_for_review` *before* approve, because the approve RPC hard-requires `status = 'ready_for_review'` (`…review_workflow_functions.sql:386`) and `approveSubmissionById` validates `submission.researched_payload` (`approve.ts:31`). But `research.ts`'s optimistic-lock update lives inline in `main()` (`research.ts:51-116`) — there is no importable function. "Reuse existing research.ts logic" (Task 4, Open Risk #3) has nothing to import. Add an explicit task to extract `saveResearchedPayload()` into `review-actions.ts` and have both `research.ts` and the wrapper call it — otherwise the subagent will duplicate the DB write rules, which the plan itself forbids. This is the single most likely thing to break execution.

3. **The real reuse module — `scripts/product-intake/review-actions.ts` — is never mentioned.** Every function the plan needs lives there: `loadSubmission`, `validateSubmissionReady`, `approveReviewedSubmission`, `notifyReviewResult`, `appendProductAdditionRecord`, `productAdditionRecordPathForDate` (`review-actions.ts:16-263`). The plan points at `research.ts`/`approve.ts` as the reuse surface; a subagent should be pointed at `review-actions.ts` + `approveSubmissionById`. Name them in the Target File Map.

**High-confidence issues** (correctness, not preference)
- **New npm aliases aren't a real task.** Verification uses `products:intake:prepare-research` and `products:intake:approve-package` (lines 212-213), but "Likely updates: `package.json`" is too soft — add an explicit step. Also, `tests/product-intake-review-scripts.test.ts:49-65` asserts exact script wiring; adding keys is fine, but any edit to existing wiring breaks that test.
- **`prepare-research` "reuse queue/review helpers":** `queue.ts` exports `loadQueueRows` (✓ usable), but `review.ts` exports nothing — `loadSubmission`/`loadBatch`/`signedUrl` are module-local (`review.ts:47,61,77`). The Local Package Shape wants "signed image URL metadata"; that needs `signedUrl` exported or re-implemented. Flag this extraction.
- **`validation.json` will be `ok:false` for fresh packages by design.** `validateSubmissionReady` → `dryRunProductIntakeReadyForReview` needs a complete `final` payload, and `buildDraftFromSubmission` leaves `final: undefined` (`research.ts:26-49`). State this is expected so a subagent doesn't "fix" it.

**Smaller / nice-to-haves**
- `approve.ts` CLI requires `--manual-review-complete` (`approve.ts:138`), but the wrapper calls the *function*, bypassing that gate. Intentional — note that the package gate (`--apply --confirm` + id-match) replaces it.
- "Send or retry the chat notification" (step 6) is already covered: the approve RPC resets `notification_sent_at = NULL` (`…review_workflow_functions.sql:837`) and `notifyReviewResult` sends once (`approve.ts:117`). No separate retry path needed.
- Task 5 (Codex cron) names no concrete mechanism (Codex CLI cron? `schedule` skill? system cron?). Underspecified, but gated behind Stop Lines — low risk.
- Test-runner convention is correct: `npx tsx --test tests/*.test.ts` matches `test:node` (`package.json:36`); new `*.test.ts` files auto-join it. ✓ Status model is fully grounded — `ProductSubmissionStatus` union confirmed at `src/lib/types.ts:340-344`.

**Bottom line**
Ship after three edits: (1) delete the `user_product_usage` link step — the approve RPC already does it (blocker, correctness); (2) add an explicit task to extract `research.ts`'s save logic into a shared function, since the wrapper depends on it and nothing is currently importable (blocker, will break execution); (3) narrow Task 3 because `queue.ts` already is the review lane, and re-point the reuse surface at `review-actions.ts` + `approveSubmissionById`. The overall approach — read-only prepare → human-gated apply, reusing the existing approval path — is the right shape and matches the canonical dry-run/apply pattern.

Want me to spec the leaner counter-proposal (wrapper as an `approve-ready.ts` variant + a single `saveResearchedPayload` extraction) so you can compare side-by-side?
