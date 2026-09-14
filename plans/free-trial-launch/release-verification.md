# Release verification — 14 September 2026

Approved scope: full Stripe and PayPal production release, both intervals with seven-day authorization-based trial; preserve all existing customers and frozen accepted terms. The original decision and journey acknowledgement remains in the canonical plan. No further product decision was introduced by implementation fixes.

## Verification and review

- Node 22 `npm run ci:verify` passed (TypeScript, ESLint with four existing warnings, optimized production build); funnel registry check passed.
- Full Node run: 7,261 of 7,266 passed in one run. Five unrelated nested `npx` invocations inherited the parent runner's `npm_config_call`; all 11 tests in that file passed with the direct Node 22 executable and clean invocation. No application change was needed for that runner issue.
- Composed billing suite: 623/623. Final provider/result/cancellation seams: 20/20. Identity rights including the production compatibility fix: 11/11. Final TypeScript passed after that fix.
- Real component browser checks: profile cancellation/management 7/7; composed profile and public declaration flow 9/9. Mobile 360/390 and desktop profile screenshots inspected. Scanner offer uses the approved asset and hierarchy.
- Opus 5/high whole-branch review covered tracked and untracked implementation, migrations and tests. Its follow-up verified all original blocking findings fixed and ran 1,723 focused trial/billing tests successfully. It reported no blockers. Review output is archived outside the repository; the parent remains responsible for the dispositions below.

## Review dispositions

- Fixed the missing PayPal success-response trial marker with actual handler tests for both intervals.
- Fixed typed PayPal recovery-plan parsing, access-conflict handling and explicit internal-test exclusions; removed the abandoned free-week plan builder.
- Returning used-trial customers go to the existing explicit paid-recovery page with frozen terms, preventing a repeat-trial offer and legacy-price fallback.
- Stripe cancellation now captures generation before refreshing provider state and applies an atomic revision/cancellation-version comparison. A raced restoration cannot be overwritten by an old cancellation; technical source cancellation and current paid successors remain recognized.
- Updated stale regression fixtures and legal expectations; admin and reactivation tests now verify actual response/contract behavior.
- Preserved the approved primary/secondary profile actions, including cancellation while management loads or fails.
- The launch-volume limits of one required notice per dispatch and serialized short admission/rights transactions are documented in the runbook. Provider-only identity reuse can still be denied at authorization and requires the existing recovery/support path. No silent paid enrollment is introduced.

## Production preparation

The ordered 35-migration chain passed against production-column-compatible local SQL, then the exact versions were applied via an isolated CLI workspace. No unrelated migration was applied. Production's safe-update extension rejected the first key-registry initialization (`DELETE requires a WHERE clause`); that transaction failed without committing. Additive migration `20260914153229_trial_identity_key_registry_safe_updates.sql` preserves all validation, retained-key overlap and access controls while only deleting obsolete registry versions and inserting absent ones. Original applied migrations were not rewritten. The bounded Opus 5/high compatibility review found no blockers; eleven rights tests and actual production initialization passed afterward.

All 36 migrations are applied. The key registry contains version 1. Verified historical import created 55 source records and 164 consumed matching claims. It covers 19 Stripe payments and 56 original PayPal payments across 40 agreements, including two later-refunded realized sales. Four Stripe invoices across two subscriptions have no trusted account mapping and remain excluded for ownership review; no owner or personal matching claim was invented.

All 94 legacy billing rows retain the same aggregate checksum before and after schema/history work. No trial enrollment, payer authorization, charge or refund was created by this release preparation.

Live catalog and webhook configuration is verified. PayPal uses three ACTIVE deferred-start schedules in the existing app; all 18 required/existing webhook subscriptions, including the three newly added dispute events, are present. Stripe uses the verified full-price monthly/annual prices and once-only annual coupon. Secrets remain outside Git; the canonical content manifest and exact release receipts are archived separately to avoid a self-referential fingerprint.

Application deployment and public activation are recorded in the external production receipt after execution. Catalog reads, local fixtures and successful builds do not prove actual payer authorization, future collection, first nonzero coupon application or required-notice delivery. Nick expressly chose to observe those in production, using the existing app. Year-two termination/refund automation remains explicitly deferred before the first affected renewal; tax follow-up belongs to Nick and his co-founder.

## Main integration and deployment recovery

On 14 September the direct trial deployment at `2121de82` was replaced by the automatic deployment of `main` at `9e265b1b` (catalog PR #550). Nick then explicitly authorized integration, correction of the remaining CI failure, merge and the combined production deployment. Internal decision-coverage revalidation: confirmed; original commercial and journey approvals remain unchanged, and no new product choice is introduced. Existing trials and accepted terms remain protected.

The task branch integrates `9e265b1b` without conflicts. Its 31 upstream paths are preserved; the only shared package change combines the existing trial browser commands with the new catalog scripts. All 36 trial migration versions were rechecked in production and are already applied. Fresh build, integration review, exact-head CI and production results are recorded in the external release receipt. Publishing through `main` is required so ordinary future deployments retain the trial release.
