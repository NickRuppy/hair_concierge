# Implementation preflight — 13 September 2026

Base refreshed from 469d41f5 to 5a3e33f1 by fast-forward; planning artifacts preserved. Nick explicitly authorized local implementation after the reconciled Claude plan review. Scope is the approved trial plan; no commercial choices reopened.

## Team

- Parent orchestrator: product contract, architecture, integration, live read-only checks and final verification.
- `trial_stripe_preflight`: fast_explorer, GPT-5.6 Terra medium; read-only Stripe code and documentation.
- `trial_paypal_preflight`: fast_explorer, GPT-5.6 Terra medium; read-only PayPal code and documentation.
- `trial_access_policy`: routine_worker, GPT-5.6 Terra medium; owns only new pure policy module and tests.
- Judgment-worker role available: GPT-6 Astra high. No judgment worker was dispatched in this slice.
- Independent review lane: Nick subsequently selected Claude Opus 5 high, terminal/read-only, no fallback. The prior completed plan review used Opus 4.8; that attribution is unchanged. A new foundation-slice review is recorded below separately.

## Provider audits and response to concerns

Both explorers returned DONE_WITH_CONCERNS. Core price/trial API pieces are documented; merchant execution is unproven. Parent response: keep provider adapters and data persistence gated; proceed with only the independent pure access policy. Do not silently implement PayPal candidates as verified fallbacks.

Stripe requires a distinct authorized-trial admission path: current checkout activation requires active, does not retrieve pending setup/default method, and first-invoice failure handling currently logs without strict lock. Trial switches need a narrow direct-item update rather than the existing discounted-plan rejection/schedule path. Preserve existing profile/access contracts; do not force a trialing profile status without checking downstream consumers. Current automatic_tax=true in the common builder requires actual merchant configuration verification, not an assumed rate or disabling legacy tax behavior. Existing invoice.payment_succeeded delivery versus any new invoice.paid/payment_intent.succeeded contract must be reconciled before event work.

PayPal price cycles are representable, but exact approval clock, future start_time PATCH after approval, trial-switch deadline preservation and setup-fee recovery composition require real provider evidence. ACTIVE alone is not first payment. Current legacy plan validation rejects the proposed shape and must remain separate from new-cohort validation. No second collectible agreement may be created while old payment state is unresolved.

## Live Stripe read-only evidence

The Stripe connector returned UNAUTHORIZED / oauth_token_invalid_grant (reauthentication required). Used the user's existing authenticated Chrome Stripe tab instead; no secrets were inspected or copied.

Observed in live dashboard account acct_1TH0lOGiGHTGZcKB:

- Coupon 8KSV9CZz: valid, EUR 30 fixed amount off once, applies to product prod_UMfRHJ3yh8l0bV, no promo codes, no redemptions shown.
- Annual Price price_1TNw7QGiGHTGZcKBv8jPk1MJ: EUR 99.99/year, EUR currency, Tax behaviour Inclusive.
- Monthly Price price_1TzMhZGiGHTGZcKBhtcZkGSk: EUR 9.99/month, EUR currency, Tax behaviour Inclusive.
- Product is active; the old EUR 69.99/year price remains a distinct repeating price. Do not reuse it for introductory-to-full-price progression.
- Tax settings: include tax in prices is Automatic; displayed explanation includes tax for currencies other than USD/CAD. The explicit EUR price behavior above is stronger evidence for these intended prices. No setting was changed.
- Tax overview/Locations then showed Germany as Needs attention / Threshold exceeded, and Collecting and filing 0. The displayed transaction data was last updated 12 September 2026. This is a provider warning, not an independent determination of a legal obligation; confirm registration/treatment before activation rather than assuming no tax is due.

This establishes catalogue fields and price behavior, not actual checkout invoice totals, future payment success, registration obligations, full tax jurisdiction obligations or real trial execution. PayPal current live settings are not yet verified in this slice.

## Execution boundary

The initial pure policy consumes verified facts and has no routes, provider mutations, persistence, identity list or migrations. Its tests do not prove external provider clocks. Identity storage remains subject to the plan's documented lawful-retention assessment. Live billing execution requires a concrete scoped test and actual payer authorization; no sandbox resources are created. No production enrollment flag, legal page, email, charge, refund, commit, push or deployment changed.

## First foundation slice — implemented, not integrated

`src/lib/billing/trial-policy.ts` now resolves access from verified facts with exclusive expiry boundaries, first-payment strictness, previously-paid renewal grace, cancellation and revocation. It validates malformed calendar/timestamp data and contradictory paid/grace records fail closed. No current route or entitlement caller imports it yet; T3 integration awaits the dependent work.

Worker red proof: behavior-free stub produced assertion failures; follow-up impossible-date test failed before calendar validation. Parent reviewed both files, requested malformed-date/paid/grace corrections, then reran the corrected focused suite with existing legacy grace tests: **24/24 passed** on Node 22.23.2. Focused strict TypeScript compilation of the policy module passed. This is slice verification, not the final ready-check/whole-branch receipt.

Commands:

```sh
npx --yes --package=node@22 node --import ./tests/server-only-register.cjs --import tsx --test tests/billing-trial-policy.test.ts tests/billing-subscriptions-access-grace.test.ts
npx --yes --package=node@22 node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext src/lib/billing/trial-policy.ts
```

Remaining work: T0 real provider authorization/timing/recovery proof and privacy assessment; T1 persistence/eligibility and T2–T7 integration are not complete. New code/tests and this receipt are task-owned durable artifacts to commit with the eventual PR; temporary test logs can be discarded after handoff. No review-ready, release-ready or completed-implementation claim is made.

Slice SHA-256 (not the canonical ready-check fingerprint):
- `src/lib/billing/trial-policy.ts`: `51363ff169050e3d03ab8ee4c5e8c6e58352744fa4636a6dbd2082ab2e324f73`
- `tests/billing-trial-policy.test.ts`: `be541eee4a0deb651304eaac169c8e74a9b832dba0915841404e2afc50dbee49`

## Second foundation slice — 13 September

Local implementation authorized again by Nick together with Opus 5 high review routing. Routine workers owned disjoint offer UI, Stripe request construction and pure eligibility files; the parent owned the shared offer snapshot, integration boundaries and final verification. A read-only explorer mapped access fallbacks and the retained-claim dependency.

Implemented:

- `trial-offer.ts`: frozen, validated server terms snapshot. New annual offers use 69.99 then 99.99 with the once coupon, or 99.99 without it. Accepted snapshots remain unchanged after catalog/coupon changes. Monthly remains 9.99; quarterly is rejected only by this new cohort contract. Snapshot validation is not live catalog validation or proof that client-supplied input is trusted.
- `trial-eligibility.ts`: exact strong-claim matching, existing-access denial, failed-lookup and missing-verification handling, used-trial denial with an explicit paid-signup path. No IP/device/name/unverified-email matching. Persistence, atomic admission and provider conflict cleanup remain outstanding.
- `trial-checkout-session-params.ts`: separate Stripe builder using the existing builder with required payment-method collection, seven-day flexible billing, pinned price/coupon and trial metadata. No route invokes it yet; no provider request ran.
- `TrialOffer`: approved scanner image, controlled month/year selection, public pricing projection required, dynamic annual comparison, selected terms and disabled/pending behavior. A development-only `/labs/trial-offer` harness exercises the actual component without checkout, account or database effects. Production page returns notFound.
- `docs/free-trial-launch-runbook.md`: publication, activation and rollback evidence requirements. [Trial-history implementation assessment](trial-history-implementation-assessment.md) records minimal fields and remaining controller validation, without claiming indefinite lawful retention.

Parent verification after final UI image refinement:

- Seven focused suites: **57/57 passed**, no skipped tests, Node 22.23.2; includes legacy checkout and legacy access-grace regressions.
- Complete repository TypeScript check passed. Focused ESLint on all seven new source files passed with no warning. `git diff --check` passed (untracked artifacts remain separately enumerated).
- Behavioral red proof: offer builder stub failed; Stripe builder stub failed; eligibility matching was temporarily disabled, producing shared-method/same-account regression failures, then restored and passed. The eligibility worker's initial missing-import failure was rejected as red proof and replaced with this semantic mutation check.
- Browser fallback: the browser-use IAB connection failed discovery; CUA IAB fallback successfully rendered the actual lab. Inspected 390px annual, switched to monthly and confirmed 9.99/month terms; Continue showed only local confirmation. Inspected 360px no-coupon state: 99.99, 8.33 monthly equivalent, 17% first-year savings. Subsequently verified actual emulated mobile viewports at 390 and 360px: document content width equaled viewport width in both cases, with no horizontal overflow; captured the 390px rendering using the optimized scanner image. Restored the normal viewport afterward. This is component/browser evidence, not physical-device or full checkout-flow verification.
- Preview: `http://localhost:3639/labs/trial-offer?width=390`. Server is task-local and the tab is retained for inspection.

Source/test/image slice fingerprint: `bc857cdd5b0100f7db0cdabdda851895decbb4610be791a68b0c688918a47ffa` (13 sorted paths, per-file SHA-256 manifest at `/tmp/free-trial-foundation-manifest.txt`). This is the explicitly bounded review identity, not the final whole-branch ready-check receipt. Planning archives and unrelated legacy files are context, not silently included in this code-slice fingerprint.

Independent review completed successfully through the repository router/Claude bridge with `claude-opus-5`, effort `high`, no fallback. [Findings and parent dispositions](foundation-review-resolution.md) record the full result and fixes. In particular, stale renewal-grace bookkeeping no longer rejects an independently valid paid period; the shared public pricing projection, versioned identity claims, known review-hold state, invalid-price guard and no-coupon copy were tightened. Parent rejected the inference that Stripe Elements' PayPal exclusion removes the separately rendered native PayPal flow, and did not relabel an actual successful early payment as free revenue.

After these fixes, parent reran the seven focused suites: **64/64 passed**, zero skipped. Full TypeScript and focused source ESLint passed. Parent reviewed the changed contracts and tested the updated no-coupon copy in the actual browser. Final source/test/image fingerprint: `4105cf8169221a4e9ee125f161b83b5d0e7259db1db7c35d0b58524f83323fab`; manifest `/tmp/free-trial-foundation-fixed-manifest.txt`. Unchanged counterpart conclusions were reused; this was a parent delta review, not a second Opus approval claim.

No final implementation or launch-readiness claim. No provider/resource mutation, message, database migration, commit, push or deployment performed in this slice. The next local slice can author/test empty schema under the reconciled first-real-write gate. Environment preparation found Supabase CLI 2.98.0 and installed PGlite available; Docker's default daemon is unavailable and no local native Postgres binary was found. Supabase changelog/RLS documentation was inspected; no applicable breaking change was found for the planned ordinary schema/RLS work (Node 22 already meets the current client requirement). No database was started, altered or populated by those checks.

## Admission persistence slice — 14 September

Continued in the same task worktree on base `5a3e33f1f641a8693209017ad25c4c9c69870df2`. Nick requested continuation and a separate checks task. That task (`01a09e3c-c087-7ad1-88b6-24d3b5208ddf`) completed read-only tax/privacy/provider research; parent read its handback and retained [the report](independent-launch-checks-2026-09-14.md) here. No activation or real-processing clearance resulted. The report's 14 September Stripe warning is a separate current observation; its catalog fields explicitly reuse the dated 13 September evidence.

Implemented the [admission persistence contract](admission-persistence-contract.md):

- CLI-created migration `20260914044650_trial_admission_foundation.sql`: empty additive enrollment/claim tables, private RLS/grants, invoker RPCs, ordered identity locks and unique ownership, immutable accepted offer/start/end and subscription cohort linkage, verified-evidence release, late-callback neutralization marker. No backfill or production application.
- Server-only `trial-admission.ts`: retry-safe accepted enrollment persistence and strict RPC result handling. No production callers. Provider verification, existing-access checks and actual neutralization remain caller obligations, not implied by persistence.
- Server-only `trial-identity-claims.ts`: versioned domain-separated HMAC, explicit trusted normalized input, bounded key/claim validation, all retained key versions and no raw-identifier output. No key provisioning, real identities or environment wiring.
- Real PGlite SQL tests and a narrow Supabase-shaped adapter harness; direct security/deletion/conflict assertions plus composed persistence/reservation/activation/replay. Parent added a composed HMAC-key-rotation denial case. Test files are picked up by the existing `test:node` glob.

Parent inspected both worker handbacks and implementation, tightened late blocked/released callbacks and immutable billing linkage, then ran:

```sh
npx --yes --package=node@22 node --import ./tests/server-only-register.cjs --import tsx --test --test-reporter=spec tests/billing-trial-policy.test.ts tests/billing-trial-offer.test.ts tests/billing-trial-offer.test.tsx tests/billing-trial-eligibility.test.ts tests/stripe-trial-checkout-session-params.test.ts tests/stripe-checkout-session-params.spec.ts tests/billing-subscriptions-access-grace.test.ts tests/billing-trial-admission-postgres.test.ts tests/billing-trial-identity-claims.test.ts
npx --yes --package=node@22 node node_modules/typescript/bin/tsc --noEmit --pretty false
```

**82/82 tests passed**, zero skipped; full TypeScript passed. Focused ESLint passed for both new source modules; the repository ignores test files for lint and emitted two ignored-file warnings, so no test-file lint claim is made. `git diff --check` passed; all new files remain task-owned untracked artifacts rather than silently staged work.

Semantic red evidence: HMAC worker observed six failures against a behavior-free stub before implementation. SQL worker used a test-harness-only `TRIAL_ADMISSION_MUTANT=skip-consumption`, producing three expected failures around replay, used-payment identity and retention; the real migration was not edited for the mutant. Parent's final combined run used the real implementation without mutation.

Five-file migration/source/test slice SHA-256: `4d909bbdd7b0972b3002e626abd23e35b7a2f004cc1b4d21a4c242bd9a3b2fc9`; per-file manifest `/tmp/free-trial-admission-manifest.txt`. This is a bounded implementation receipt, not the final canonical ready-check fingerprint. No new Opus review is claimed; the prior review remains scoped to the earlier foundation.

Remaining: T0 provider execution; privacy rights/retention/disclosure before any real writer; complete account/legacy-access admission and application entitlement integration; actual provider neutralization/recovery; real multiple-connection PostgreSQL race and full migration-chain/advisor checks; final ready-check/counterpart review. PGlite uses one connection and cannot establish a real concurrent race. No live schema, claim, provider, payment, email, publication or deployment changed.

## Access integration — 14 September

Task fast-forwarded to `c986b3f7` before integration, preserving all task-owned files. This includes the returning-customer checkout recovery and scanner fixes merged after the prior receipt. Nick explicitly instructed engineering and shipping to continue and owns the flagged tax follow-up; the canonical plan and runbook now reflect that ownership. No new commercial or journey approval is inferred or requested.

Implemented:

- A private canonical enrollment remains the source of truth. CLI-created `20260914051220_trial_access_projection.sql` derives sanitized facts onto owner-readable billing rows, rejects caller-supplied projections and mismatched owners, and synchronizes access changes. The canonical read locks the enrollment with `FOR SHARE` so a concurrent billing insert cannot escape a revocation update. Opposing update orders can cause a PostgreSQL deadlock rollback; callers must retry the whole failed transaction, never treat an ambiguous write as access approval.
- Application billing predicates use the trial policy, preserve independent legacy/manual/one-time access, and suppress stale profile mirrors for the trial cohort. Legacy billing writes omit new columns when no trial link is present, permitting code/schema rollout without breaking existing writes. Linked retries preserve immutable ownership.
- Middleware denies expired trial access to free-preview and keepsake routes, while recovery remains reachable. Independent current access wins; unavailable history never opens preview access. The admin subscription reader retains the projection.
- `20260914051731_trial_paid_migration_authority.sql` keeps historical paid migration separate from trial access: a free authorization never becomes paid migration authority. Independent legacy and fulfilled one-time sources retain precedence.
- Analytics payloads distinguish trial product access from paid access and prevent extra payload properties from overriding that classification. This is payload correctness only; the trial event producers, conversion delivery and checkout-return analytics remain T6 work.

Parent inspected worker handbacks, corrected the projection concurrency read and SQL/TypeScript unknown-cohort parity, and verified:

```sh
npx --yes --package=node@22 node --import ./tests/server-only-register.cjs --import tsx --test --test-reporter=spec tests/billing-trial-*.test.ts tests/billing-trial-offer.test.tsx tests/stripe-trial-checkout-session-params.test.ts tests/stripe-checkout-session-params.spec.ts tests/billing-subscriptions-access-grace.test.ts tests/billing-subscriptions*.test.ts tests/billing-analytics*.test.ts tests/auth-middleware-personal-plan-routine.test.ts tests/freemium-admission-middleware.test.ts tests/reactivation-routing.test.ts
```

**197/197 passed**, zero skipped. A subsequent focused run after making analytics fixtures realistic and preserving the optional metadata input contract passed **13/13**. Source ESLint passed for subscriptions, types, access projection, analytics payload, middleware and the admin route. Full TypeScript status is recorded separately when its current run completes; earlier worker typechecks are not a replacement for parent final verification.

Red evidence: expired-trial free-preview regression failed before the middleware gate; legacy upsert payload regression failed before conditional column emission; analytics free-trial paid classification failed before the new payload branch. The actual predecessor SQL admitted free/expired trial rows to historical paid migration before its replacement. A harness-only legacy-grace mutant makes strict-expiry SQL fail. The unknown-marker parity assertions pass against both SQL and application readers. PGlite exercises real migration SQL and RLS with a minimal platform fixture; it cannot establish multi-session concurrency or the entire production migration chain.

Outstanding integration is explicit: provider checkout/authorization and payment lifecycle, trial account provisioning, membership management and recovery UI, required communications, offer entry wiring, retirement/rollout and actual provider execution. The accepted tax follow-up does not block engineering publication; these implementation and provider correctness tasks still do. No production writes, real claims, provider authorizations, payments, customer messages, commit/push or deployment occurred in this slice. This receipt is not a final ready-check or whole-branch Opus verdict.

### Provider construction and verification boundary

Added server-only Stripe trial authorization verification plus a read-only retrieval adapter. It checks session/subscription/customer/payment-method/enrollment binding, a successful setup when present, a saved card identity, exact provider trial timestamps, flexible mode and the applied inclusive Price/once-Coupon terms. Retired-but-already-attached catalog terms remain valid; API read failures propagate for retry instead of being misclassified as authorization denial. The pure PayPal builder/validator covers the documented free-week monthly and introductory-annual plan shapes, strict monetary parsing and only explicitly configured inclusive taxes. It does not select or prove PayPal's authorization clock. Stripe request construction now explicitly selects cards/card wallets; PayPal retains its separate authorization lane.

Parent corrected Stripe provider-amount fixtures so malformed unrelated fields could not mask the intended failure, and observed a meaningful read-outage regression before removing the catch-all denial. Final affected suites: **41/41 passed**, zero skipped. Full repository TypeScript completed with **exit 0** after fixing two test-typing defects; focused source ESLint and `git diff --check` passed. The earlier two worker full-typecheck claims were withdrawn: those duplicate processes had never completed and were stopped. Only the completed parent run is a current TypeScript receipt.

Commands/results: Node 22 selected `stripe-trial-authorization`, `paypal-trial-plan-shape`, Stripe trial/legacy request, trial analytics and trial subscription access suites; `tsc --noEmit --pretty false`; ESLint on both new provider modules, the trial builder and analytics helper. The earlier 197-test run covers the wider unchanged access/routing/SQL surface. Logs under `/tmp/free-trial-*` are transient; code/tests/migrations and this receipt are durable task artifacts. This is not the final ready-check or counterpart whole-branch review.

Owner supplied an email for restricted live QA in the conversation on 14 September. The address is deliberately not committed. No payer approval or recurring-charge authorization is inferred from that address. The Stripe connector still reports reauthentication required; the existing live merchant Dashboard is accessible through the owner's Chrome profile. Local runtime has no Stripe secret key and PayPal is configured for sandbox; no sandbox request was made and no runtime configuration was changed. No checkout, subscription, charge, claim, email or production schema was created by these checks. The next dependent work remains integrated provider activation, management/recovery, required communications and the controlled live proof—not additional tax questioning.

### Live Stripe connector restored — 14 September

This supersedes the connector status above. Owner reconnection restored API access to live **Haarmony, LLC**, account `acct_1TH0lOGiGHTGZcKB`. Read-only live catalog requests confirmed active EUR monthly `price_1TzMhZGiGHTGZcKBhtcZkGSk` at 999 cents/month and annual `price_1TNw7QGiGHTGZcKBv8jPk1MJ` at 9999 cents/year, both inclusive and belonging to `prod_UMfRHJ3yh8l0bV`. Coupon `8KSV9CZz` is valid, EUR 3000 cents off once, restricted to that product, with no redemption deadline or maximum. The separate legacy 6999-cent annual price is not the introductory offer's renewal price.

The live coupon listing omitted `applies_to` unless explicitly expanded (`data.applies_to`). Corrected the authorization adapter to retrieve the coupon with `expand: ["applies_to"]`. Its test provider now reproduces the unexpanded response: the authority-retrieval regression failed before the source fix and all **10/10** authorization tests passed afterward. Parent full TypeScript completed with exit 0; focused source ESLint and `git diff --check` passed.

This proves catalog configuration and fixes retrieval correctness only. It does not prove coupon treatment on a zero invoice, first collection, renewal, authorization timing, or PayPal execution. No subscription, authorization, payment, configuration change or production write occurred. Runtime integration and controlled provider execution remain outstanding; live API connectivity is no longer a blocker.

## Stripe checkout and activation integration — 14 September

Task branch safely fast-forwarded to `0903adf0` before integration; the incoming funnel scaffolding and retained-account webhook changes did not overlap the dirty trial files. Current plan revision 1.4 and its original confirmed design/journey/execution acknowledgement remain controlling. Durable attempts, retry guards and canonical access synchronization implement that contract; no new commercial choice was introduced. This is an intermediate engineering receipt, not a release-ready or whole-branch review receipt.

Implemented in this slice:

- `ensureCheckoutAccount` now admits a trial only from retrieved Stripe account/session/subscription/card/setup/offer evidence and successful canonical identity admission. It reuses existing account and quiz attachment, persists linked billing before the profile mirror, and never invokes historical paid migration for a zero-value authorization. Partial/unknown trial markers fail closed. Deleted owners, conflicting ownership and existing independent access cannot create duplicate access. Denied authorized trials persist reconciliation debt before cancellation; lost cancellation responses retry the same agreement and do not discard positive or collectible invoices.
- `trial-runtime.ts` reads server-only, explicit configuration. Missing approval/configuration prevents new trial processing. Enrollment defaults to disabled; a configured disabled rollout still processes already accepted authorization callbacks. Restricted enrollment compares the server-authenticated confirmed email with the owner-controlled allowlist; anonymous lead email is not a verified-email claim. No runtime values or real identity keys were provisioned.
- The result checkout route accepts an explicit `trial: true` request for monthly/annual direct creation. Its server-resolved identity and immutable enrollment are separate from browser attempt IDs. The new durable service attests the live catalog for new requests, freezes price/coupon/customer/expiry/metadata, uses a stable Stripe idempotency key, validates merchant/mode/enrollment bindings, and requires durable session binding before returning a client secret. Retries reuse frozen terms after a coupon change; confirmed uncompleted expiry releases unconsumed reservations idempotently. Ambiguous expired attempts remain reconciliation cases. Acquisition context remains attached; checkout-start value is zero.
- Subscription update/delete handling quarantines all trial markers before legacy paid writers, requires a persisted matching enrollment/owner/agreement/customer, and uses canonical trial/paid boundaries. A stale provider update cannot clear an accepted local cancellation. Provider `active` is not first-payment evidence. Existing independent legacy entitlements remain separate.
- `trial_started` is produced only from canonical activation results, uses an enrollment event key and is restricted to PostHog. Both direct Customer.io and destination adapters prevent trial authorization from becoming paid lifecycle/revenue. Welcome suppresses browser purchase telemetry for trial candidates. The additive outbox constraint permits the new event without altering existing event names.
- The cancellation declaration RPC atomically records immutable owner/request/end facts, sets the local cancellation guard and queues independent receipt/provider work. Accepted declarations remain replayable after expiry, payment or revocation. The service-role-only public RPC can reach private RLS tables without exposing the private schema through PostgREST. Provider execution and receipt sending are not wired yet.

New migrations are local and unapplied: `20260914085036_trial_started_analytics.sql`, `20260914090614_trial_cancellation_declarations.sql`, and `20260914091103_trial_checkout_attempt.sql`. The still-unapplied admission foundation also gained idempotent replay of the same verified release evidence. Existing applied production migrations were not edited or applied.

Parent reviewed all worker outputs and fixed concrete integration issues: incomplete trial markers, unlinked legacy rows, provider cancellation dates overwriting canonical dates, mutable cancellation guards, runtime callback behavior during rollback, PostgREST composite row shapes, invalid `Account.livemode` assumptions, bound-session replay after consumed admission, abandoned claim release, frozen-request binding failure and the original acquisition attempt ID. Meaningful red/green regressions cover these composed behaviors; SQL fixtures use real PostgreSQL semantics through PGlite, with a single connection rather than a claim of multi-session race proof.

Final verification for these bytes:

- **286/286 Node 22 tests passed**, no skips: all `billing-trial-*` and `stripe-trial-*` tests, trial UI component test, checkout route contracts, returning checkout routes, retained-account activation, reactivation frozen context, analytics destinations/outbox, acquisition events and Customer.io lifecycle.
- **104/104 legacy Playwright contract tests passed**: `checkout-activation.spec.ts`, `stripe-webhook-handlers.spec.ts`, `auth-post-checkout-routes.spec.ts`, Chromium project. These are contract tests, not live payment authorization or complete mobile browser journeys.
- Full repository `tsc --noEmit --pretty false` passed. Focused source ESLint and `git diff --check` passed. The earlier full TypeScript failures were corrected and replaced by this completed parent run.
- Logs `/tmp/free-trial-verified-{integration,legacy,tsc,lint}.txt` are transient. Source/tests/migrations, approved artifacts and these receipts are durable task-owned PR material.

The live nonpersistent invoice previews are recorded separately in [the Stripe preview receipt](stripe-live-preview-2026-09-14.md): modeled EUR 0 trial, EUR 69.99 first paid year and EUR 99.99 recurring year. The preview subscription could not be retrieved, confirming no subscription was created. These were three independent simulations, not a collected invoice sequence; they do not close T0.

Remaining, deliberately not labeled complete: result-offer/payment UI wiring; eligible reactivation trial integration (the new trial protocol currently rejects that context while preserving existing paid reactivation); typed eligibility/paid-signup recovery UX; PayPal authorization clock and adapters; first successful collection, first-failure neutralization and paid-period recovery; renewal grace/disputes/revocation writers; plan change/restoration; cancellation route/provider reconciliation and required receipts/notices; public cancellation/withdrawal and terms/privacy implementation; one-time/waitlist retirement; migration-chain/multi-session verification; full browser journeys; final ready-check/Opus 5 high whole-branch review and release procedure. Reserved anonymous attempts with a lost provider response and no persisted reference still require provider reconciliation before replacement. Retention/erasure and historical paid-identity handling remain data gates.

No UI has begun sending the new trial request, no live enrollment switch was enabled, and no production schema/identity/configuration, customer authorization, subscription, charge, refund or email was created by this implementation. No commit, push, PR, merge or deployment occurred. There is no new product alignment question in this slice; the outstanding work is implementation and evidence.

### Connected offer, invoice ledger and cancellation backend — 14 September

This supersedes the preceding UI/lifecycle status. Continued on task HEAD `0903adf0d8d4f3ef3bc2cb63f88b152a80d32cc5`; changes remain uncommitted. Local `origin/main` has advanced three commits, so final readiness must refresh/reconcile that base before publication.

- Result entry points now pass only public trial prices to the approved scanner offer and existing checkout overlay. Restricted display requires confirmed authenticated email; public mode permits anonymous entry. Monthly/annual selection, sticky summary, explicit Stripe trial intent, independent trial/paid component state and zero-at-authorization tracking are connected. Legacy rendering remains the default without trial configuration. PayPal trial requests fail on the server before any legacy paid intent is created.
- `trial-payment-events.ts` and migration `20260914094203_trial_payment_events.sql` implement a private service-only payment ledger. Verified first success requires the accepted amount and a full UTC calendar period from actual success. Renewals preserve the provider cadence; later failures get 168 hours from paid-through. Duplicate and aliased deliveries preserve first-paid classification, reordered renewals remain reconcilable, and late failures cannot undo a successful invoice.
- `trial-invoice.ts` is invoked before both Stripe legacy invoice handlers. It retrieves merchant, subscription, invoice, line, InvoicePayment and PaymentIntent/charge evidence; checks owner/customer/mode/price/amount; distinguishes zero authorization from revenue; and refuses unverified or shorter paid periods. It performs no provider mutation. Successful first payment emits one `purchase_completed`; later payments emit `payment_completed`, through idempotent PostHog/Meta outbox delivery. No optional Customer.io trial/failure campaign is added.
- Authenticated cancellation capability/declaration endpoints preserve auth refresh and save the declaration before constructing Stripe. Reconciliation checks exact ownership/deadline, schedules without proration, re-reads provider state, and confirms through a guarded service-only RPC comparing the exact evidence. Provider/configuration failure acknowledges the saved declaration as pending. Already canceled agreements require non-collectible invoice evidence. Retry execution, receipt delivery and the profile UI are not yet wired.

Parent reviewed and corrected the worker results, including unconfirmed-email display, stale sticky paid copy, Next page exports, failure-event ordering, lost analytics retries, late-renewal handling, provider-confirmation races and lost cancellation responses. Verification on the integrated tree:

- **348/348 Node tests passed**, including actual SQL/RLS, payment-to-access projection, invoked webhook paths, offer/intent gates and legacy billing/reactivation contracts.
- **104/104 Playwright checkout/account-return contract tests passed**; these are not live provider or full mobile journey tests.
- Full repository TypeScript, scoped source ESLint and `git diff --check` passed. Initial worker-overlap/type errors were fixed; only the completed final runs above count. Logs: `/tmp/free-trial-final-slice-{tests,legacy,tsc,lint,lint-delta}.txt`.

The first-payment provider continuation remains **unimplemented and unproven**. Even ordinary invoice collection delay can make the service period shorter than the accepted promise; synthetic same-boundary tests do not establish real Stripe behavior. Mismatches remain durable reconciliation and retryable webhooks, not paid access. PayPal's live dashboard was absent from the reconnected browser inventory; Nick was asked to reopen it while independent implementation continued.

Remaining release work: provider trial/recovery proofs and adapters; eligible reactivation/explicit paid signup; first-failure collection neutralization and disputes/refunds; interval changes/restoration and profile UI; cancellation retry/mandatory receipts and public cancellation/withdrawal/terms/privacy; one-time/waitlist retirement; data-retention procedures; full migration/concurrency/mobile verification; current-base ready-check and Opus 5 high whole-branch review. No new commercial decision is requested. No production schema/configuration/data changes, provider authorization/charge/refund, customer message, publication or activation occurred.

## PayPal dashboard reconnected — 14 September

Nick reopened live PayPal and instructed continuation. Reused the existing dirty task-owned `codex/free-trial-launch` worktree at `0903adf0d8d4f3ef3bc2cb63f88b152a80d32cc5`; local `origin/main` is three commits ahead. No integration or publication was attempted. Decision coverage remains the approved monthly/annual seven-day offer; no commercial choice reopened.

Verified existing catalog and saved two separate live-account **draft** plans under the earlier provider-product preparation authorization: monthly EUR 0 for seven days then 9.99/month, annual EUR 0 for seven days then 69.99 for one year then 99.99/year. Reopened both saved IDs and verified persisted schedules. Existing full-price trial draft and all active plans retained. See [exact IDs and evidence limits](paypal-live-catalog-2026-09-14.md), including the blank webhook application field after reopening. These are catalog writes, not deployed checkout or customer subscriptions.

Aligned the pure PayPal builder/validator names with the saved drafts; ACTIVE remains mandatory, so draft plans cannot pass checkout validation. No runtime IDs or secrets configured. Focused verification on Node 22: **6/6 passed** using `tests/paypal-trial-plan-shape.test.ts` and `tests/paypal-trial-intent-route.test.ts`. No claim that these synthetic tests establish actual provider timing, API ownership, webhook delivery or recovery. Earlier whole-tree checks are historical to their recorded slice; no whole-branch review was repeated for this catalog step.

The next PayPal implementation dependency is live API retrieval/ownership and webhook verification, followed by the already scoped owner authorization clock check. No payer authorization or charge was performed. Trial enrollment and both new plans remain off.

## Cancellation, retirement and declaration integration — 14 September

Nick explicitly instructed uninterrupted implementation until a concrete owner-dependent roadblock. Work remains in the existing task-owned worktree at `0903adf0`; the current dirty tree has not been rebased, committed, pushed, deployed or activated. The confirmed product and journey decisions remain unchanged.

Implemented and parent-reviewed:

- New one-time creation returns 410 in Stripe and PayPal, before provider creation. New waitlist signup likewise returns 410, and both waitlist pages show closed registration. New experiment assignments use membership; stored one-time assignments resolve to the membership presentation without rewriting history. Existing capture/fulfillment and survey-access paths remain available.
- Legacy plan-change, Stripe portal and PayPal cancellation paths reject linked or marked trial contracts, including malformed projections, before provider mutation. These are protective integration guards, not completion of the new membership management UI.
- Stripe cancellation retries claim service-only leased operations, preserve saved declarations during outages and reject stale lease completions. Malformed claims and failed completion RPCs fail the invocation. Soft timeouts preserve the active lease. The local Vercel cron runs every five minutes; the live team's Pro plan was verified read-only. PayPal cancellation reconciliation remains pending until its adapter is implemented.
- Public `/kuendigen` and `/widerruf/erklaeren` pages submit without authentication or account disclosure. The bounded, rate-limited endpoint atomically stores the declaration, immutable receipt and independent review work item. Retry uses the same request identity; mismatched replay cannot rewrite or disclose earlier content. Users can download the submitted receipt. Exact public route exceptions avoid an auth-provider dependency.
- A service-only read CLI exposes the unmatched review queue without inventing a customer identity. No automatic matching, cancellation, refund or resolution is inferred from a public assertion. A trusted matching/action workflow and assigned deadline handling remain release work.
- Required public receipt delivery has a leased worker and protected endpoint. Missing template/key configuration blocks before claim. Queue acknowledgements retain their provider ID and are never called delivered. Ambiguous HTTP/network outcomes park for support; failed settlement does not trigger a second send or settlement. Parent review found and corrected insufficient service-role column grants, unsafe batch/lease timing, swallowed malformed claims and numeric provider timestamp conversion. Authenticated trial receipt delivery and the public delivery-confirmation lane are still incomplete; no messages were sent.

Parent verification after integration:

- **364/364 Node tests passed** across trial policy/admission/access/cancellation/payment and Stripe integration, PayPal guards, retirement and legacy preservation.
- **24/24 Node tests passed** for public declarations and receipt delivery, including the actual preceding/additive SQL under `service_role` and denied anonymous access. Worker-reported counts are not added separately.
- **7/7 browser journeys passed**: five Chromium tests covering declarations and retired waitlist paths, plus two mobile WebKit declaration journeys. Declaration requests were intercepted; no provider, database or email mutation was exercised. Checks cover lost-response replay, form validation, extraordinary grounds, downloadable receipt, focus and responsive overflow. Screenshots at 360/390px are retained in [verification evidence](verification-2026-09-14/cancellation-390.png).
- Full repository `tsc --noEmit --pretty false` completed with exit 0. Scoped source ESLint passed; the repository ignores test/script paths for lint, so those two ignored-path warnings are not claimed as lint coverage. `git diff --check` passed.
- The new browser specs are wired into the existing CI-invoked Personal Plan journey command; declarations also run in the WebKit project. They are not isolated, uninvoked test files.
- Meaningful mutation evidence: bypassing the PayPal trial guard returned 200 instead of 409 and failed its composed route test. The guard was restored. Earlier parent red checks demonstrated the plan-change and portal bypasses and the Stripe retirement path. Worker SQL mutants exposed stale-lease acceptance and missing outbox/confirmed-delivery transitions; PGlite does not establish multi-session concurrency.

Transient logs: `/tmp/trial-current-{integrated-tests,declaration-tests,browser,webkit,tsc,lint}.txt`. This is a completed intermediate slice, not a final ready-check, whole-branch Opus 5 review or release receipt.

### Current owner-dependent roadblock and next work

Read-only Vercel metadata confirms production PayPal is **live**, but the client ID and secret are sensitive, non-readable variables. The task's local credentials are sandbox-only and were not used. No PayPal connector is available. The merchant dashboard is connected and both new catalog plans are still drafts; its Developer link now requests a fresh login. Nick was asked to provide the live `Chaarlie_prod` credentials through the ignored `.env.paypal-live.local` file, never in chat. No credential was exported or printed. This blocks API ownership/webhook checks and the dependent PayPal adapter proof.

After access is available: verify the exact live app/plan/webhook ownership, finish the provider authorization and full-period continuation mechanics, then complete recovery/management, required delivery and legal/data lifecycle integration. The first-payment handler still rejects shortened source-invoice periods; even ordinary collection delay can reach this unresolved branch. A provider-supported continuation must separate verified payment fulfillment from repairing future collection without granting another free trial or permitting duplicate charges. Do not claim this implemented from schedule documentation or synthetic same-boundary fixtures. Current-base integration, migration/concurrency verification, final mobile journey review and Opus 5 high whole-branch review remain before release.

## Live access resolved and legacy PayPal activation guarded — 14 September

The owner updated the ignored live credential file. OAuth and authenticated product, plan and webhook GETs now succeed. This supersedes the access blocker above; the exact catalog and registration evidence is in [the PayPal receipt](paypal-live-catalog-2026-09-14.md#live-api-access-verified-after-owner-credential-update). Both new trial plans remain `CREATED`; no agreement, payment or catalog activation was performed in this verification slice.

Provider-test preparation exposed a legacy activation gap: a new unknown plan could inherit the interval from a valid checkout intent and enter paid provisioning. Approval, webhook and account-return activation now require a recognized legacy plan, the expected interval, and the exact stored plan ID when present. Malformed present IDs reject. Validation precedes new binding/account creation, including already-bound but unfulfilled retries; existing billing-row continuation stays unchanged. The parent review caught and fixed a dropped malformed-pin flag on the account-return path. Behavioral regressions assert no auth user, profile, billing or intent activation writes on rejection.

The two new billing cron endpoints now bypass session lookup at their exact middleware paths and reach their own bearer-secret checks. No broad billing-route exemption was added. The configured-cron regression exposed this routing omission before the fix.

Final parent verification on the integrated slice, Node 22:

- **295/295 tests passed**: all `tests/paypal-*.test.ts`, `billing-paypal-server`, `payment-method-checkout`, `billing-trial-cancellation-reconcile` and `public-contract-declaration-receipt-delivery`.
- Full repository TypeScript, scoped source ESLint and `git diff --check` passed. Two existing source-order assertions were updated for the extracted approval binding helper; its behavior is separately exercised. Logs: `/tmp/paypal-final-guard-{tests,tsc,lint}.txt`.

The [isolated live clock-check proposal](paypal-clock-check-proposal.md) is ready and pending owner approval. It uses a separate app, one zero-cost seven-day agreement and immediate cancellation; the owner performs approval personally. This is a provider timing proof, not a deployed integration check. No test app or agreement was created. The PayPal trial adapter and public enrollment remain disabled; the broader release work listed above is still incomplete. No commit, push, deployment, production schema or environment mutation occurred in this slice.

Credential handling correction: the API scripts did not print credentials or tokens, but a browser accessibility inspection captured a secret that was already revealed on the PayPal dashboard. The owner was notified. Do not repeat that value; coordinate secret rotation with the production environment update before release. No rotation was performed.

## Continued integration without isolated live test — 14 September

Nick canceled the separate PayPal experiment and asked to ship. Its Create App form was closed without submission. No test app or payer agreement was created; do not ask for that authorization again. This supersedes the pending-test language in earlier checkpoints. The [ship-path advisory disposition](ship-path-review-resolution.md) distinguishes addressed findings, unimplemented behavior and the unaccepted smaller-launch alternative.

Completed locally in this slice:

- Profile trial membership reads accepted prices and the original deadline; authenticated cancellation persists the declaration, acknowledges pending provider work and offers a download. Expired members reach the same management facts on `/reactivate`, before any private hair-profile query or legacy checkout. Legacy users without trial history retain their existing reactivation path; uncertain reads cannot initiate payment.
- PayPal cancellation now verifies the exact agreement, payer, plan, cohort and original deadline, cancels, re-reads and confirms through the guarded operation RPC. Retry processing supports both providers.
- A verified first payment now grants its owed full calendar period independently of a shorter provider invoice period. The source period is retained, and continuation mismatch is durable debt. The new service-role-only paged operator CLI reads unresolved facts without provider actions. **The provider repair consumer is not implemented.**
- Durable PayPal checkout attempts freeze accepted terms, exact app/product/plan binding and a bounded request identifier; retries re-attest the OAuth app, preserve the frozen catalog and verify returned agreement identity. Parent review corrected missing account claims, stale app attestation, amount mismatch and exclusive-tax acceptance. This service is not wired to the route and does not activate access.
- Required public declaration receipts now have a five-minute deployment cron entry. Template/delivery activation and the authenticated receipt lane remain outstanding. No optional trial emails or actual sends.
- Profile/locked-management browser coverage is included in both existing CI-invoked browser projects.

Parent verification on the integrated changes: **51/51** focused cancellation/payment/membership/receipt/OAuth tests; **12/12** reactivation and operator-read checks; **14/14** PayPal attempt/shape/identity checks; **14/14** mounted Chromium/WebKit management journeys. These sets overlap and are not a summed unique-test count. Full repository TypeScript and scoped source ESLint passed; `git diff --check` passed. Earlier intermediate TypeScript failures were fixture typing issues and were corrected. Parent inspected the actual 390px membership rendering; [membership](verification-2026-09-14/profile-membership-390.png), [confirmation](verification-2026-09-14/profile-confirmation-360.png) and [receipt](verification-2026-09-14/profile-receipt-360.png) are retained. Browser requests were intercepted; no provider, production database or email mutation was exercised.

Logs: `/tmp/free-trial-integration-latest.txt`, `/tmp/free-trial-management-integration.txt`, `/tmp/free-trial-paypal-attempt-final.txt`, `/tmp/free-trial-membership-final-browser.txt`, `/tmp/free-trial-integration-{tsc,lint}.txt`. The narrow Opus review is an intermediate advisory pass, not final whole-branch approval. This is an implementation checkpoint, **not release readiness**. Initial PayPal integration, renewal-date repair, safe paid recovery, restoration/switching, never-trial reactivation, required delivery and final release work remain. No commit, push, deployment, production migration or activation occurred.
