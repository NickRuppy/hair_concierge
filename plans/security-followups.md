# Security followups — BIL-2, PUB-1, RLS-3

Branch: `codex/security-followups`. Base and initial HEAD:
`d08f9a0d795ee2e364e156c112bce107c1ce9612` (`origin/main`).
Started 2026-10-12 14:59 UTC; stop by approximately 15:29 UTC.

## Contract and decision coverage

Status: confirmed. Coverage acknowledgement: Nick's explicit three-fix brief,
single thread, test-first, approximately 30 minutes, no commit, no migration
application or remote database access. PUB-3 consent is explicitly out of scope.
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
same-user retries, rejects unreadable fallback evidence, and does not change consent.
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

Review is in this thread, per Nick's single-thread constraint. No publication is
authorized. Durable plan, source, tests, docs and migration are intended for a
future commit after review; they remain uncommitted. Transient test logs are in
`/tmp/security-followups-{red,targeted,node,tsc}.log`, outside the repository.
Database runtime privilege verification and migration application remain with
the reviewer/Nick. Local static proof is not live closure evidence.
