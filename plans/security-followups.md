# Security followups — BIL-2, PUB-1, RLS-3, PUB-3

Branch: `codex/security-followups`. Base and initial HEAD:
`d08f9a0d795ee2e364e156c112bce107c1ce9612` (`origin/main`).
Started 2026-10-12 14:59 UTC; stop by approximately 15:29 UTC.

## Contract and decision coverage

Status: confirmed. Coverage acknowledgement: Nick's explicit three-fix brief,
single thread, test-first, approximately 30 minutes, no commit, no migration
application or remote database access. That initial pass excluded PUB-3; Nick
authorized the minimal PUB-3 follow-up below on 2026-10-12.
The audit sources were read first in the sibling `api-security-audit` worktree:
`plans/api-security-audit/{billing,public-mobile-chat,rls-schema,README}.md`.
All three findings were re-verified against the current base before source changes.

Confirmed with Nick: delete the unused Stripe endpoint; preserve established
accounts against email-only quiz adoption while retaining explicit quiz lead
handoffs and new-account adoption; restrict every matcher and corpus SELECT to
the service role in one unapplied migration. Inherited from repository evidence:
the free-registration bind rule treats an existing hair profile or Personal Plan
as established. Implementation defaults: put that guard in the shared fallback;
enumerate actual catalog overloads instead of assuming vector schema/signatures.
Open consequential assumptions: none. No new UI/copy/journey needs design evidence.
Internal revalidation: final code preserves explicit matching ID adoption and
same-user retries and rejects unreadable fallback evidence. The initial pass did
not change consent; the separately authorized PUB-3 follow-up is recorded below.
Undiscussed consequential assumptions affecting this handoff: none.

## Deliverables and proof

1. BIL-2: route deletion, SEO/design reference cleanup, filesystem regression.
2. PUB-1: reuse `loadFreeRegistrationBindEvidence` / `resolveFreeRegistrationBind`
   in `linkQuizToProfile`'s fallback before facts or lead ownership writes.
   Behavior regressions cover no ID, invalid ID fallback, new accounts, explicit
   ID adoption, same-user retry, Personal Plan-only accounts and evidence errors.
   The writer's own-newer-quiz replacement test remains valid: it does not establish
   ownership by email or exercise the vulnerable caller, so its assertion stays.
3. RLS-3/RLS-6: CLI-created `20261012150150_security_matcher_access.sql`, newer
   than the existing latest migration `20261012125714`; static schema inventory
   checks every historical matcher name plus explicit PUBLIC/anon/authenticated
   revocation and service-role grants. Catalog iteration covers every overload,
   including any extra deployed `public.match_*` function. No application anywhere.

Red proof: `node --import ./tests/server-only-register.cjs --import tsx --test
tests/security-followups.test.ts tests/quiz-link-to-profile.test.ts` failed 5/19
for the intended missing behavior before implementation: route still present,
missing migration restrictions, planted email leads overwriting established
facts (both entry variants), and adoption into a Personal Plan-only account.

Targeted green: same invocation with `tests/user-facts-account-link.test.ts`
and `tests/seo-metadata-routes.test.ts` added: 78/78 passed. Final verification
also includes `tests/free-registration-provenance.test.ts` and
`tests/free-registration-journey.test.ts`: 104/104 passed.

`npm run test:node`: 11,694 total, 11,670 passed, 15 skipped, 9 failed
(exit 1; approximately 18m50s). Non-sandbox failures: none. Four failures in
`tests/product-intake-review-app.test.ts` are local TCP `listen EPERM`; five in
`tests/product-list-chunks.test.ts` are blocked `tsx` IPC socket startup. The two
exit-status-only ingestion failures were separately reproduced with their same
script arguments and synthetic credentials, confirming `listen EPERM` before
script execution. No out-of-scope test repairs were made.

`npx tsc --noEmit -p .`: final exit 0. The new production caller exposed the
bind-evidence helper's inaccurate structural builder type; it now accepts the
real Supabase client and describes `from().select()` and PromiseLike results
correctly. That change only affects types; the full-suite runtime result remains
applicable. The final focused run follows the correction.

Prettier checks and `git diff --check` passed. Main-thread correctness and
structural review found no blocking findings. The final content fingerprint and
sorted manifest are retained outside the repository in
`/tmp/security-followups-{receipt.md,manifest.txt}`.

## Caller inventory

- BIL-2: no callers in `src/`, `apps/`, or `ios/`. Only the SEO test and historical
  Stripe subscription design referenced the removed route. The shared Stripe
  middleware prefix still serves checkout creation, portal session and webhook.
- PUB-1: one email fallback, `src/lib/quiz/link-to-profile.ts`. Direct callers:
  `src/app/auth/confirm/route.ts`, `src/app/api/auth/callback/route.ts`,
  `src/app/onboarding/page.tsx`, `src/app/auth/actions.ts`,
  `src/app/beratung/produkte/quiz-projection.ts` (through its `link` alias),
  `src/app/api/quiz/field-test/activate/route.ts` (explicit authorized ID).
  Injected billing callers: `src/lib/stripe/checkout-activation.ts`,
  `src/lib/paypal/checkout-activation.ts`, `src/lib/paypal/order-activation.ts`,
  `src/lib/paypal/trial-account-admission.ts`, and
  `src/lib/billing/personal-plan-one-time-activation.ts`; PayPal webhook handlers
  forward the dependency. Entry points supplying the shared function include
  Stripe/PayPal webhook, welcome, auth send-magic-link/set-checkout-password,
  billing reconcile/one-time-activation-status, PayPal capture-order/activation-status,
  and freemium purchase completion. Every fallback uses the shared guard.
- RLS-3: no `src/`, `apps/`, or `ios/` callers of corpus RPCs or `content_chunks`.
  The only `src/` matcher RPC call is `match_public_contract_declaration` in
  `src/lib/billing/public-contract-declaration-resolution.ts:42`, supplied the
  service-role client by `scripts/billing/public-contract-declarations.ts:102`.
  Corpus RPCs survive in `scripts/eval-retrieval.ts:138,170,178` (service role).
  Corpus table callers are the service-role scripts `ingest-markdown`,
  `ingest-transcripts`, `ingest-product-chunks`, `backfill-context-prefixes`,
  `backfill-null-embeddings`, and `archive/ingest-book`.

## Review and disposition

Review is in this thread, per Nick's single-thread constraint. Published as draft PR #668 on 2026-10-12 by Nick's authorization.
Published head: `74329f1f`. The PUB-3 follow-up
remains uncommitted for the reviewer; no further commit or push is authorized. Transient test logs are in
`/tmp/security-followups-{red,targeted,node,tsc}.log`, outside the repository.
Database runtime privilege verification and migration application remain with
the reviewer/Nick. Local static proof is not live closure evidence.

## PUB-3 — minimal email identity and consent protection

Source: **PUB-3, security audit 2026-10-09, minimal fix ruled by Nick 2026-10-12**,
`api-security-audit/plans/api-security-audit/public-mobile-chat.md:158-176` in the
sibling worktree. Double opt-in is explicitly out of scope.

Coverage acknowledgement: Nick's explicit eight-point brief, single thread,
test-first, 25-minute time box, no commit or push. Follow-up base: `74329f1f`,
clean `codex/security-followups`, started approximately 15:31 UTC on 2026-10-12.
Settled decisions: server-side known email means any auth user, profile, or
previous lead of any quiz kind; normalized email comparison; lookup errors mean
known; only a verified matching session can change existing stored consent.
Internal revalidation: both public quiz paths derive permission server-side;
request-supplied flags cannot grant authority. Open consequential decisions: none.

Re-verified before edits (no drift from audit references): legacy dispatch
`src/app/api/quiz/lead/route.ts:419-431,492-505`, consent rewrite `383-394`,
email-keyed identity/consent traits `src/lib/customerio/quiz-traits.ts:101-108,136`,
personal-plan identify `src/lib/personal-plan-quiz/customerio.ts:238-243`, and
uncapped name `src/lib/quiz/validators.ts:121`. Personal-plan dispatch actually
uses a durable outbox; its request schema has no name field.

Implementation:

- `src/lib/quiz/lead-identity.ts`: verified matching session bypasses the known-email
  lookup; everyone else gets one admin-only RPC. Only an explicit successful false
  permits new-email identity traits; errors, exceptions, and malformed results close.
- Legacy lead route derives the policy before insertion and requires matching auth
  for dedupe consent updates. Dedupe itself proves an email known even if a row
  appeared after the lookup. Customer.io omits email/first_name/marketing_consent/
  consent_timestamp traits for restricted saves; hair/quiz traits and events remain.
  The personal-plan `commercial_automation_eligible` trait is consent-related and
  is likewise omitted for restricted saves (additional red proof: 1/8 failed).
- Personal-plan route passes server-derived permission into the save RPC. The new
  unapplied migration persists it on the outbox in the save transaction, restricts
  anonymous dedupe and artifact replay consent changes, and grants the lookup and
  revised save function only to service_role. The dispatcher requires an explicit
  stored true, so retries and historical/missing policy cannot reconstruct consent
  authority from an email. Moderator save remains on its existing private path.
- `leadSchema.name` rejects more than 80 characters with the existing 400 JSON
  validation response. The personal-plan schema has no equivalent name field.

Regression evidence: first legacy red run failed 7/9, outbox red failed 1/8,
and executable SQL red failed 6/6 for the missing lookup/persisted permission and
anonymous consent rewrites. Five personal-plan route cases separately failed
against the original `74329f1f` route loaded from `/tmp`, then passed on the final
route. Targeted final green: 84/84. Tests exercise the HTTP route, captured actual
Customer.io transport bodies, real save/lookup SQL in PGlite, and outbox dispatch.
PGlite establishes local SQL behavior; it is not a deployed PostgreSQL check.

Targeted command:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-lead-identity.test.ts tests/quiz-lead-identity-sql.test.ts tests/personal-plan-customerio-outbox.test.ts tests/personal-plan-customerio-sync.test.ts tests/personal-plan-lead-persistence.test.ts tests/quiz-lead-deliverability.test.ts tests/regular-quiz-field-test-lead-route.test.ts
```

Verification: initial `npm run test:node` finished with 11,716 total, 11,692
passed, 15 skipped, and nine sandbox failures (approximately 6m15s). Four are
review-app TCP `listen EPERM`; five are product-list ingestion `tsx` IPC startup
failures. The two exit-status-only cases were independently reproduced with the
same dry-run arguments (synthetic credentials where required), confirming IPC
`listen EPERM` before script execution. Non-sandbox failures: none. Final full
suite rerun after the final eligibility guard: **11,718 total, 11,694 passed,
15 skipped, nine sandbox failures; exit 1, approximately 4m25s. Non-sandbox
failures: none.** `npx tsc --noEmit -p .`
exit 0. Changed production files pass ESLint; tests are excluded by repository
ESLint configuration. Final Prettier check and `git diff --check` pass.

Review: main-thread correctness and structural review (shared policy, migration,
and retry-state boundaries); no blocking findings identified. No external reviewer
or sub-worker was dispatched under Nick's single-thread constraint. BIL-2/PUB-1/
RLS-3 implementation and the earlier matcher migration remain untouched.

Disposition: all follow-up source, tests, receipt, and the new migration are intended
for the reviewer's commit. No commit, push, migration application, deployment, or
production Customer.io request was performed. **Apply the new migration before
rolling out the revised personal-plan route**, which sends its two new RPC parameters.
Transient logs and baseline-route red-proof copies are under `/tmp/pub3-*` and may
be discarded after review. Final content fingerprint and the 15-file sorted
manifest are retained outside the repository in `/tmp/pub3-receipt.md` and
`/tmp/pub3-manifest.txt`. Completed approximately 15:51 UTC, within the 25-minute
time box; no requested local implementation or verification remains undone.
