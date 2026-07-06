**Verdict:** Re-shape first (split into per-phase plans) — then approve each phase with the fixes below. As a single artifact this is a sound strategy document but **not** a subagent hand-off.

---

**Lean shape**

- **Irreducible goal:** A durable, visible intake review surface where Nick approves/publishes a researched product from one place, without babysitting local Codex package files. State survives outside the Codex thread.
- **Cut or defer:**
  - **Reuse, don't rebuild the research/image engine.** dm/retailer image adapters, candidate gathering, identity-token rejection reasons, source-page URL extraction, GTIN matching, and candidate image inspection already exist in `scripts/product-intake/review-app.ts` (3,558 lines) and are imported by `scripts/product-intake/research-queue.ts:8-14`. The worker module list (`sources.ts`, `images.ts`, lines 461-466) reads as greenfield. Frame Phases 2-3 as *extract a shared lib out of `review-app.ts`*, or you'll ship a second parallel implementation.
  - **Notification, approval-apply, and dry-run are already solved** — see Prior art. The plan re-states them as new requirements. Point the implementer at the existing functions instead of re-specifying.
  - **Confidence model (lines 468-506):** since v1 requires Nick to review *every* product (Decision register line 101), numeric confidence is decoration, not a gate, except the "approve all high-confidence fields" threshold. Defer the multi-factor scoring to bands until there's review history; keep evidence/source/rationale (which is the load-bearing part).
- **Hard tradeoff the plan avoids:** *Where does stage state live?* Lines 113 and 127 offer both "add states to `product_submissions.status`" **and** "if too disruptive, keep it on the job table" — that's deferring the one decision every downstream task depends on. It must be picked before a subagent starts. (Recommendation: keep `rework_requested`/`publishing` on `product_intake_research_jobs.status` only — see Blocker 1; the codebase already models rework as a *package* state, not a submission status: `review-app.ts:156,843`.)

---

**Prior art**

- **Background job / worker** → at-least-once + idempotent + visibility timeout + poison-message. Plan matches well: optimistic claim RPC, `locked_by`/`locked_at`, `attempt_count`, `next_run_at`, retry-with-backoff, unique partial index for one non-terminal job (lines 178-182). **Missing invariants:** no named max-attempt cutoff, no stale-lock TTL value, and **no per-invocation serverless time budget** — heavy routes here cap at `maxDuration = 60` (`src/app/api/chat/route.ts:20`); a research+vision-per-submission loop in one cron tick will exceed it. Specify *claim-one-job-per-invocation*.
- **Cron route auth** → the existing cron (`vercel.json` → `/api/billing/reconcile`) authenticates via `CRON_SECRET` (`src/app/api/billing/reconcile/route.ts:26`). The plan's research cron route (line 261) doesn't mention it. Match the existing shape.
- **Schema migration** → expand/backfill/contract, reversible. Plan says "additive only, do not remove fields" (line 131) — good — **but** a status-state change is *not* purely additive: it requires `DROP CONSTRAINT … ADD CONSTRAINT` and touches every existing status consumer. Don't file it under "additive."
- **Publish / form submit** → idempotent POST + confirm + preflight-immediately-before. Plan matches (lines 342-359). Idempotency is already enforced by `product_submissions_success_product_check` and the notification claim. Good.
- **Optimistic locking on shared row** → conditional update on `locked_at` / claim RPC. Matches.

---

**Blockers** (will fail or regress as written)

1. **Status states `rework_requested` and `publishing` are not allowed by the DB.** The `product_submissions_status_check` constraint permits exactly `pending_review, researching, ready_for_review, needs_more_info, matched_existing, approved, rejected, cancelled_by_user` — `supabase/migrations/20260612130000_product_intake_submissions.sql:227-238`, and no later migration alters it (grep across `supabase/migrations/` confirms). Any code that writes `status = 'rework_requested'` or `'publishing'` to `product_submissions` throws a runtime CHECK violation. **Fix:** decide up front — keep these two on `product_intake_research_jobs.status` only (recommended; the job table already carries `running`/`waiting_for_rework`), or ship a `DROP+ADD` constraint migration and re-verify all consumers. The plan must commit before any task uses these strings.
2. **The plan's state list drops an existing, in-use status.** `cancelled_by_user` is a real status (`src/lib/product-intake/repository-types.ts:66`, `src/lib/types.ts:347`, `scripts/product-intake/queue-reporting.ts:80`, `scripts/product-intake/cleanup-photos.ts:107`) but is absent from the plan's "Proposed states" (lines 113-124) and the queue lanes (lines 377-383). A subagent rebuilding the state machine/queue from this plan would silently drop it. Reconcile the plan's 9 states against the DB's actual 8.

---

**High-confidence issues** (correctness, not preference)

- **Admin auth is already solved — the plan's hedge is misleading.** Every admin API route gates on `profile.is_admin` from `profiles` (e.g. `src/app/api/admin/products/route.ts:40-44`, `quotes/route.ts:18-22`); admin pages are `"use client"` and fetch through those gated APIs (`src/app/admin/products/page.tsx:1`). "If admin auth is not fully ready, keep it behind the existing local dev/admin mechanism" (line 372) is wrong direction — point new routes at the existing `is_admin` guard. The route map (lines 449-455) lists **no auth**; the publish route especially must replicate it.
- **Vision judging is genuinely new build, not reuse.** `finalize-package-image.ts` only references Vision/rembg as a *manual documented step* (lines 234, 350) — there is no programmatic vision call today (corroborated by memory `reference_product_image_bg_removal.md`: Vision is a pilot/manual packshot step). Phase 3 is from-scratch; scope it as such, not as "reuse existing finalize-image logic" (line 539 conflates the two).
- **Reuse the canonical idempotent notification path.** `sendProductIntakeReviewNotification` (`src/lib/product-intake/notifications.ts`) already does atomic claim (`.is("notification_sent_at", null)`) + `already_sent` short-circuit + rollback (lines 239-307). The CLI apply path uses `notifyReviewResult` (`scripts/product-intake/review-actions.ts`). Name *one* path to reuse so the "must be idempotent and retry-safe" requirement (line 107) isn't re-implemented.
- **The apply/preflight path already exists — cite it.** `approveSubmissionById` (apply/confirm flags, `scripts/product-intake/approve.ts:22`) → `approveReviewedSubmission` → RPC `product_intake_approve_reviewed_product` (`review-actions.ts:185`), plus `product_intake_link_existing_product`, `product_intake_request_more_info`, `product_intake_reject_submission` (`review-actions.ts:221,253,285`) and `buildApprovePackageDryRun` (`approve-package.ts:128`). Phase 5 "publish preflight + publish" is wiring these to a button, not new write logic — say so to prevent re-authoring.

---

**Smaller / nice-to-haves**

- Verification plan (lines 636-677) lists test *names* but no commands. Add the project gate `npm run ci:verify` and the standard finish step (`codex:codex-rescue` agent on `git diff main...HEAD`, then `/ship`) per CLAUDE.md — currently absent.
- `product_submissions_success_product_check` requires `approved_product_id IS NOT NULL` for `approved`/`matched_existing` (`…submissions.sql:239-242`). The publish RPC already satisfies this; note it so a subagent doesn't set the terminal status without the product id.
- Module-list inconsistency: `identity.ts` appears in "Suggested library modules" (line 461) but is missing from "File Map / Likely new files" (lines 603-609). Reconcile.
- Pervasive fuzzy verbs ("Ensure", "where possible", "when available", "Compare against existing good images") are fine for a strategy doc but will be read as read-only confirmations by a reasoning subagent. Each phase needs concrete acceptance commands before hand-off.
- `intake_dedupe` claim verified correct: `isProductEligibleForMode(…, "intake_dedupe")` returns `productIsActive(product)` (`src/lib/product-catalog/eligibility.ts:112-113`), i.e. all active products incl. non-recommended — matches line 106.

---

**Bottom line**

The direction is right and unusually well-grounded for a strategy draft: the job/artifact/decision table model is a clean fit, the DB tables are genuinely new, the cron mechanism exists, and the publish/notification/dedupe machinery you need is already built. But it is six PR-sized phases in one document with fuzzy verbs throughout — answer your own review question (line 717) with **yes, split into per-phase plans.** Before any subagent executes: (1) resolve where `rework_requested`/`publishing` live (Blocker 1) and reconcile against the 8 real statuses incl. `cancelled_by_user` (Blocker 2); (2) re-frame the research/image worker as an *extraction from `review-app.ts`*, not greenfield, and isolate Vision as the one truly new build; (3) wire publish/preflight/notify to the existing `approveSubmissionById` + RPCs + `sendProductIntakeReviewNotification` rather than re-specifying them; (4) gate every new route on the existing `is_admin` pattern and the cron on `CRON_SECRET`. Each phase then becomes a clean, executable plan.

Want me to spec Phase 1 (durable state + cockpit shell) as a standalone, subagent-ready plan with the state decision resolved, so you can see the leaner per-phase shape?
