# Product Intake Research Queue Runner

Date: 2026-06-29
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke`
Branch: `codex/product-intake-full-flow-smoke`

## Goal

Turn raw product-intake submissions into reviewable research packages before Nick opens the
review app. The review app should be for final human approval of researched identity, sources,
category specs, and image decisions, not for empty draft shells.

## Chosen Direction

Build the v1 as a local, command-driven research queue runner.

Plain language:

- A new command finds `pending_review` submissions.
- It prepares local package folders when needed.
- It runs package-local image discovery for missing/broken image candidates, so Nick sees a raw
  candidate to judge instead of an empty image section whenever the sources can supply one.
- It produces a clear Codex research worklist with exact package paths and next steps.
- Codex or a scheduled Codex automation performs the actual product/web/image research in that
  local package.
- Approval remains dry-run-first and requires Nick's explicit approval for the exact package.

Implementation should reuse existing primitives:

- `prepareResearchPackagesFromQueue` creates/skips package folders idempotently.
- `listReviewPackages` already walks package folders and computes validation/image status.
- `dryRunProductIntakeReadyForReview` remains the source of truth for product payload readiness.
- `approve-package` remains the approval/upload/product-write gate.

## Non-Goals

- Do not auto-approve products.
- Do not upload images or write reviewed products into Supabase from the review app.
- Do not build a production background worker yet. The command boundary should be suitable for a
  later deployed cron/worker, but this plan ships the local/daily runner first.
- Do not make the app call an LLM or browse the web from the browser UI.
- Do not change recommendation behavior for user-submitted products.

## Safety Boundaries

- Default commands must be dry-run/read-only for Supabase writes.
- The v1 queue runner must not write Supabase status or payload data at all.
- `approve-package --apply --confirm` remains the only command that may create/link the product,
  upload/verify final image, and notify the user.
- The review app may save local package decisions only.
- Existing dirty files from chat/onboarding testing must be preserved.

## Package State Predicates

Use a local `package_state` field so package readiness does not get confused with the Supabase
`product_submissions.status = ready_for_review` value.

- `package_needs_research`: `payload.final` is missing or not an object. This is the empty shell
  state produced by package preparation.
- `package_in_progress`: `payload.final` exists but live validation is not ok, or image finalization
  is missing/pending/needs work.
- `package_ready_for_review`: live validation is ok and image finalization is either
  `approved_asset` or `no_image_approved_for_now`.
- `package_blocked`: the package cannot be read or has structurally invalid JSON/missing required
  files. Do not infer domain uncertainty as blocked; domain uncertainty belongs in research notes.

## Lifecycle

Current rough state:

```text
pending_review -> local empty package -> manual research -> ready_for_review -> approval
```

Target v1 state:

```text
pending_review
  -> research queue runner
  -> needs_research package with clear Codex worklist
  -> Codex fills final payload, sources, specs, image candidate/finalization
  -> ready_for_review package
  -> Nick reviews in review app
  -> dry-run approve-package
  -> Nick-approved apply command
```

Scheduling will run the queue runner and Codex research prompt daily or twice daily. That should be a
Codex automation after the command exists, not hard-coded into the app.

## Implementation Steps

1. Add a queue-runner command.
   - Add `scripts/product-intake/research-queue.ts`.
   - Add `products:intake:research-queue` to `package.json`.
   - It should call `prepareResearchPackagesFromQueue` to create packages for `pending_review`
     submissions.
   - It should call `listReviewPackages` to inspect package readiness.
   - It should classify each package using the `package_state` predicates above.
   - It should print a compact JSON or table worklist with package path, submission identity, current
     blockers, and exact next local commands.

2. Run automatic image discovery from the queue runner.
   - For packages with `image_candidate_status` of `missing`, `remote_only`, or `broken`, call the
     same package-local image search primitive used by the review app.
   - Write only package files (`image-search-*.json`, `image-candidates.json`, and
     `images/source/replacement-*.png`).
   - Skip packages whose image search already completed unless the operator passes
     `--force-image-search`.
   - Keep this deterministic v1 focused on trusted product-source and retailer-source discovery. A
     later LLM vision judge can compare multiple ambiguous candidates, but the v1 must not fake a
     vision judgment it is not performing.

3. Keep Supabase writes out of the runner.
   - Default mode is dry-run/no Supabase mutation.
   - No command in this plan may call approval apply.
   - Defer a future `researching` status transition until the queue can consistently load both
     `pending_review` and `researching` rows and the write creates real value beyond changing status.

4. Make empty packages visibly not reviewable.
   - Update `scripts/product-intake/review-app.ts` to label packages without `final` payload as
     `Noch nicht recherchiert`.
   - Disable or hide image/property/package approval controls for packages that are only prepared
     shells.
   - Show the exact next command: `npm run products:intake:research-queue -- --limit=N`.

5. Document the operator flow.
   - Update `docs/product-intake-research-ops.md`.
   - Explain the difference between prepared package, researched package, ready package, and approved
     package.
   - Add daily/twice-daily Codex automation guidance without creating production writes.

6. Add tests.
   - Unit-test package classification and worklist rendering.
   - Update the script exposure assertion in `tests/product-intake-review-scripts.test.ts`.
   - Add review-app behavior tests if practical; otherwise cover helper functions exported from the
     app.

## Verification

Run:

```bash
npx tsx --test tests/product-intake-research-package.test.ts
npx tsx --test tests/product-intake-review-scripts.test.ts
npx tsx --test tests/product-intake-review-app.test.ts
npm run ci:verify
```

Manual smoke:

```bash
npm run products:intake:research-queue -- --limit=5
npm run products:intake:review-app -- --port=3908
```

Expected manual result:

- Fresh empty Syoss package appears as not researched, not review-ready.
- Review-ready old package still appears reviewable.
- No approval/upload/apply command runs without Nick approving the exact package.

## Scheduling Follow-Up

After the command and UI state are verified, create a paused or active Codex cron automation that runs
daily or twice daily in this worktree. The automation prompt should:

- run the queue runner,
- research a bounded number of submissions,
- update local packages,
- run dry-run validation,
- report ready/not-ready packages,
- stop before upload, approval apply, commit, push, or PR.
