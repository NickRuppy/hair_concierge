# Auth lane second layer plan

2026-10-02. Read-only review in `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Main owns integration, architecture, final checks and publication. This report is a bounded second-opinion lane; no repository edits, tests, mutations, providers, environment-file reads or counterpart reviewer were invoked.

**Verdict: support four declaration cuts after the transfers/repairs below, plus three retained-declaration repairs including the actual setup-link POST retarget and removal of its otherwise unused copied helper.** Reconciled the completed `/tmp/test-audit-auth-runtime-ledger.md` with actual bodies/owners and main's `plans/evidence/2026-10-02-auth-cutover-plan.md`. The ledger's conditional welcome UI cut is deferred: its exact generic payment-success caption is not established by the cited activation keeper.

The inherited root decision remains least-useful 20% of 11,892 baseline declarations with global coverage within two percentage points. This batch adds only four declaration cuts: three Node, one Playwright. It introduces no product/access/payment/storage semantics and changes no CI registration. Premium-grant routing and unpaid-payment denial remain intact. F repair and setup-link seam removal earn no extra declaration credit.

## C1 — generic allowed premium duplicated by email-grant owner keeper

Remove `tests/authenticated-app-route-access.test.ts:120`, `scan page tier: a paid-access composite of 'allowed' is premium`. Entire behavior is actual resolveScanPageTier with default user id user-1/email user@example.com, resolvePaidAccess returning allowed, then tier premium.

Retain :134 `scan page tier: an email-only manual/moderator grant is premium (C1 repro) — the nav classification's id-only lookup would have called this user free`. This uses the same actual resolver alias, same user id, a different ordinary email, and a paid-access dependency returning allowed only for that exact email. It asserts both premium and exact forwarded [userId,email,false]. No transfer is required: the sole removed assertion is literal premium and the keeper already reaches the allowed branch positively. The caller-supplied dependency returns allowed for both; the owner has no email-specific branch between its access result and entitlement derivation.

Actual source `src/lib/auth/authenticated-app-route-access.ts:124–148` calls resolvePaidAccess, rejects unavailable to premium separately, then getEntitlements with `access === "allowed"`. The alias is not dead; loadScanPageTier is used by src/app/scan/page.tsx:39, and the route-agnostic loader is used by gated-page owners. Actual getEntitlements/deriveEntitlements maps true to premium. Preserve denied→free, unavailable→premium, no-user→premium, field-test forwarding and authentication/profile boundary tests. They are different security/error/input guards.

History: both direct and grant-repro tier tests entered with f3790784 (#526). The stronger repro pins the regression that email-keyed access was omitted by id-only navigation classification. Do not replace it with a pure entitlement derivation test.

Control: in the actual resolver's hasAppAccess callback temporarily turn the allowed result into false. Select the exact email-grant keeper; expected premium versus actual free. Mutating an unrelated entitlement display flag or the fake dependency would not prove preservation. Restore source bytes and run green before/after.

## C2 — tracker no-access into explicitly flag-off keeper

Remove `tests/auth-middleware-personal-plan-routine.test.ts:279`, `tracker still redirects an authenticated user without current access to reactivate`.

Retain :301 `flag off: FREEMIUM_SCANNER_FIRST_ENABLED unset still redirects tracker to reactivate (byte-identical)`. Both call the actual createUpdateSession factory with currentAccess false, ordinary metadata {}, same authenticated user, GET /tracker and all other fixture defaults identical. Both assert 307 and exact `https://chaarlie.de/reactivate?reason=expired&next=%2Ftracker`. The keeper additionally controls and finally restores the feature flag instead of depending on ambient state.

Required transfer into that existing flag-off body:

- create observedTables = [] and frontierCalls = {count:0}; pass both to createMiddleware;
- preserve its existing status/location assertions;
- copy the precise negative assertions: profiles absent, hair_profiles absent, frontierCalls.count zero;
- retain the existing flag restore in finally. Do not strengthen observedTables to an exact empty list: the old contract prohibited the two named intake tables and the frontier read only.

Actual `src/lib/supabase/middleware.ts:418` owns route classification/auth/session setup, then subscription composition and shouldRedirectToReactivation. It returns the expired redirect before intake/frontier work. Tracker exclusion in needsAuthenticatedAppRouting also protects the paid/admitted path, whose separate `tracker skips proxy intake and Personal Plan frontier reads` declaration stays. Flag-on free admission, denied mutation/API methods, trial-history reactivation and authentication guards stay too. Public updateSession export is consumed by actual src/proxy.ts; the factory is not removable.

History: generic tracker cost/redirect test db320bd6 (#390); explicit flag-off keeper 5b15e84b (#525). This consolidates the same formerly ambient flag-off branch into a controlled branch, not paid versus free or flag-on versus flag-off.

Controls should preserve the redirect while violating read prohibition. Merely removing the tracker exclusion from needsAuthenticatedAppRouting is ineffective for this no-access keeper because its paywall returns earlier. Instead, temporarily add an actual profiles/hair_profiles query before the expired-page redirect; expected negative-table assertion failure, status/location still correct. Separately invoke the injected actual frontier dependency there; expected count 1 versus 0. These cost controls target the actual middleware, not the fixture helper. The selected no-access keeper must fail for the intended observation. Restore exactly between controls.

## C3 — ended moderator ordinary routine into stale composite keeper

Remove `tests/auth-middleware-personal-plan-routine.test.ts:596`, `an ended moderator account receives the field-test end state unless paid access is valid`.

Retain :657 `an ended moderator without paid or partner access is still routed to the ended screen`. Both use ordinary metadata {}, moderatorAccess ended, paidAccess false, partnerAccess false, oneTime none and the identical /routine request; both assert 307 and exact `/test/haarplan/beendet`. The candidate defaults paid/partner false and starts currentAccess false. Keeper explicitly sets paid/partner false and starts currentAccess true, testing stale tester access being discarded. No assertion transfer needed.

Actual ended/unavailable branch at middleware.ts:584–598 unconditionally overwrites active with independently checked paid OR partner access before later entitlement and redirect branches. Thus the initial false candidate offers no independent decision once that branch executes; the true keeper proves the more dangerous stale-access state cannot leak through. Keep paid-positive and partner-positive, unavailable→503, moderator-active, API error, field-test metadata and /chat journey cases: they reach independent guards/outputs or platform routes.

History: candidate 69f1651d (#472), stronger paid/partner-negative keeper 5a3e33f1 (#537). Control: change actual recomputation from `active = hasIndependentPaidEntitlement` to retaining previous active with OR. Exact routine keeper should fail its ended redirect assertion because stale access survives. Inspect its actual failure instead of presuming the surviving route returns 200; later intake may redirect elsewhere. Restore and green.

## C4 — unpaid card subscription default duplicates unread SEPA dependency

Remove `tests/checkout-activation.spec.ts:923`, `verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is card`.

Retain :913 `verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is SEPA`. Full helper stripeForCheckoutActivation (:38–70) returns the same complete unpaid Session shape from checkout.sessions.retrieve; only the requested opaque session ID differs between tests. Card versus SEPA lives exclusively in subscriptions.retrieve, which the real verification path never calls. The retained literal rejection `{code:"checkout_session_unpaid"}` is identical.

Actual owner :318 calls retrieveCheckoutSessionForActivation then assertCheckoutSessionActivatable. Legacy shape is checked before assertCheckoutPaymentAuthorized (:1110); that helper rejects every status except paid/no_payment_required. No default-payment-method lookup occurs anywhere in this path. Real auth password/magic-link routes, welcome page and recovery script call verification; paid account fulfillment retrieves subscription separately later. Preserve offered-SEPA :933 because payment_method_types is actually part of the retrieved Session (a distinguishable provider input), plus paid/no-payment-required, incomplete, malformed fields, one-time and preparation cases.

Recommended bounded keeper strengthening: wrap this keeper's subscriptions.retrieve with a monotonic counter delegating to its original fake return; after the unpaid rejection assert exactly zero calls. Do not replace it with a throwing stub whose error might be swallowed. This positively documents why differing defaults provide no second branch. The counter is a routine test repair, not a new payment policy. Optionally retitle this retained declaration to accurately say it rejects unpaid before subscription lookup; no declaration credit for renaming.

History: SEPA/card variants introduced together by 252fc185 (`fix(payments): sunset SEPA checkout sessions`). Both business-critical unpaid denial and offered-SEPA behavior remain covered; this is not an assumption that cards and SEPA are interchangeable elsewhere.

Controls: (1) allow unpaid in actual assertCheckoutPaymentAuthorized; the exact retained keeper must stop rejecting with checkout_session_unpaid. (2) Temporarily retrieve subscription details inside the actual verification owner before its unchanged unpaid assertion; it must still reject unpaid but fail the new zero-call assertion. The real retrieved session.subscription supplies the ID. Restore exactly between controls.

## F1 — repair the missing-profile duplicate-auth setup

Keep `tests/checkout-activation.spec.ts:602`, `ensureCheckoutAccount creates a missing profile for duplicate auth users`, and all existing userId/email/canSetInitialPassword=false and stored subscription-profile field assertions. The current duplicate createUser fixture writes profiles[id] before returning email_exists, so the owner takes its profile-recovery fast path. The actual Auth-only fallback is never reached. The fixture also lacks admin.listUsers; merely suppressing the profile write will produce checkout_user_race_unresolved, not a valid repair.

Use **local overrides in this declaration**, keeping other race fixtures unchanged:

1. Retain users[auth-only@example.com] = the actual fixture Auth user; assert no profiles[user-auth-only] exists before invocation.
2. Override this test's admin.createUser to record the attempted operation and return the same duplicate-email error WITHOUT creating a profile. Keep identity/email and empty app metadata consistent with the existing case.
3. Add local admin.listUsers returning that Auth user from users; count calls monotonically and require one. It must observe the profile still absent when invoked. Do not hardcode a profile lookup success or replace production recovery.
4. Invoke actual ensureCheckoutAccount with the same session. Preserve existing result and final profile assertions, plus positive fallback call count. The actual upsert is responsible for creating the final profile.

Source chain: ensureCheckoutAccount :327 finds no existing profile, createCheckoutUser :1384 receives duplicate, rechecks profiles, then findAuthUserIdByEmail :1555 calls listUsers and matches normalized email. It reads current Auth metadata, denies initial password capability, then writes subscription profile and billing. The test's real query-builder doubles own only local maps. Existing profile-race and matching-marker denial tests remain; do not globally change duplicateEmails behavior because those deliberately simulate a profile appearing concurrently.

History: Auth-only candidate and fallback introduced f9daad7f (#81). Required controls: (a) temporarily make actual findAuthUserIdByEmail return null → repaired test must reject checkout_user_race_unresolved; (b) omit the actual upsertSubscriptionProfile write → final profile assertion must fail, with fallback observed. This establishes both the previously missed discovery path and the storage outcome. Actual source is restored byte-for-byte, with clean controls.

## F3 — missing-body dependency-order observations

Keep `tests/auth-post-checkout-routes.spec.ts:354`, `rejects missing request body before rate limiting or Stripe work`. Its current call is actually `{}` (missing required fields), followed by status400, error containing Session, and empty Supabase calls. The original local calls array observes only stubSupabase methods: neither checkRateLimit nor verifyCheckoutSessionForActivation contributes to it. Therefore either dependency can be called too early while every old assertion passes.

Add local rateLimitCalls=0 and checkoutVerifierCalls=0. Use stubDeps overrides that increment the corresponding counter and **return valid normal results**: `{allowed:true}` for limiter and existing checkoutSession() for verifier. Invoke the same actual handler with `{}`; retain all three original assertions and require both counters exactly zero. Do not use a throwing sentinel, default rejected result or undefined Session, which could change the early error and conflate output with forbidden work. Preserve the other invalid-password/rate-limit/provider/claim cases.

Actual owner `src/app/api/auth/set-checkout-password/route.ts:95` runs parseBody and returns400 before password validation, limiter or ensureActiveCheckoutAccount. Actual POST parses request JSON and invokes this same handler with constructed dependencies; this keeper proves the handler's invalid-fields ordering, not malformed JSON at HTTP parsing. The successful verifier stub has the provider-owned checkout identity; no provider call is introduced in the test.

Required output-preserving actual-owner controls are separate: (1) await deps.checkRateLimit with an inert fixture activation ID and existing SET_CHECKOUT_PASSWORD_RATE_LIMIT before parseBody; (2) await deps.verifyCheckoutSessionForActivation with cs_test_password and deps.stripe before parseBody. Leave the subsequent invalid-body400 return intact. For each control, demonstrate original body/assertions remain green, then the repaired body fails its corresponding zero counter with1 versus0; status400/Session and old empty Supabase calls must remain valid. Freeze files during each runner, restore the repaired test and owner bytes between controls, and finish clean-green. No rate policy, secret, endpoint or provider behavior is changed permanently. This repair earns zero deletion credit.

## Setup-link seam: keep declaration, move its oracle to POST

`tests/auth-post-checkout-routes.spec.ts:1645`, `deprecated setup link route returns 410 without side effects`, currently calls handleSendSetupLink and compares a plain status/body object. `src/app/api/auth/send-setup-link/route.ts` has a separate real POST returning NextResponse.json and a copied exported helper returning an unrelated plain object. Full repository caller search found only this test using the helper; production routes classify the URL and Next dispatches POST.

Retarget the existing import to `POST as sendSetupLinkPOST`, invoke actual POST, assert response.status===410 and await response.json() equals the same literal German error object. Remove the copied handleSendSetupLink export and its now-unused RouteResult type. Retain the constant and POST, public route classification and session-lookup exemption. No new injection helper or parameter is needed because POST has no side-effect dependency. Prefer an accurate title describing the 410/German-error response; neither old nor proposed runtime assertion alone proves arbitrary side-effect absence. Actual source has no such dependency, and this narrow retarget adds entrypoint proof without promising a broader effect audit.

Temporary control changes actual POST status to 200 (or actual error body), with helper already removed. The retained test must fail its HTTP response oracle. Native Response content-type may be checked as an optional documented strengthening, but no old assertion requires it.

History: f9daad7f (#81). One retained declaration, zero deletion credit; only the dead copied export/type is removed. **Keep adjacent welcome source grep :1656 unchanged**: read-only email, activation choices, German copy and absence of deprecated/reset paths are not established by any browser proof in this pass. Also retain auth cleanup Back/Forward test and magic-link redirect template guard; different browser/security/platform contracts.

## Native execution plan and accounting

No commands below were executed by this reviewer. Current textual top-level declarations: authenticated-app-route-access 15, auth-middleware-personal-plan-routine 47, checkout-activation 32, auth-post-checkout-routes 54. Proposed 14,45,31,54 respectively; net four. Capture actual AST receipts when applying rather than relying solely on text counts. Runtime counts must come from native before/after logs, not inferred from declaration totals. Campaign should increase by four only after those exact calls are removed; F/seam edits add none.

Use Node native before, transfer/F-only, and after:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/authenticated-app-route-access.test.ts tests/auth-middleware-personal-plan-routine.test.ts
```

The isolated `/tmp/test-audit-auth-playwright.config.cjs` now exists and was read along with `/tmp/test-audit-auth-playwright.cjs` and the baseline command/log. It requires installed @playwright/test and local server-only-register, selecting only checkout-activation.spec.ts and auth-post-checkout-routes.spec.ts, with no .env.local loader or application server:

```sh
node node_modules/@playwright/test/cli.js test --config=/tmp/test-audit-auth-playwright.config.cjs --project=chromium --workers=1
```

Main's on-disk baseline evidence is **62/62 Node and 86/86 Playwright**. The latter comprises **85 pure contracts plus one real Chromium/history case**: auth-post-checkout-routes:141 requests `page`, creates an ephemeral in-process HTTP server on127.0.0.1 and navigates Back/Forward. The command does not exclude it and the log names it as run. Therefore “86 pure/no-browser/no-server cases” is inaccurate; this is preserved local browser-platform evidence, with no application server or external provider requirement. No rerun is needed to correct the description. Use the same complete subset for transfer and after; expected counts are59 Node and85 Playwright after four cuts, subject to native receipt verification.

Use the existing frozen wrappers `node /tmp/test-audit-auth-node.cjs transferred` and `node /tmp/test-audit-auth-playwright.cjs transferred`, then identical after labels for coverage. The current config reuses an invoice-named outputDir; this does not change selected tests or these separate c8 report paths, but do not mislabel its contents as invoice proof. Broader integrated verification remains main-owned. No npx, provider, live DB or environment file is required. Freeze sources/tests during every runner window.
CI distinction: Node tests are covered by test:node and CI quality-node; auth-post-checkout-routes is in generic Playwright contracts. **checkout-activation.spec.ts is not in that generic script**. Its @ci declarations run through conditional smoke selection, but this unpaid/F set is untagged. Therefore explicit native checkout-file proof is essential, and this report does not claim current default CI covers those declarations. Do not expand CI scope silently as part of pruning.

Before deletion, apply tracker transfer, unpaid counter, Auth-only F fixture repair, missing-body counters and POST retarget; establish green native transfer-only evidence. Then remove exactly four candidate declarations and the dead helper/type. Run unchanged native subsets, independently inspect every intended owner fault and byte-exact restoration, typecheck relevant changed source/test shape, and hand main the exact AST and mutation receipts for preservation/full coverage verification. No production owner policy changes belong in permanent diff.

## Read scope and reconciliation

Fully read all four candidate bodies and named stronger keepers, complete dependency builders used by them, full tier test file, affected middleware entry/classification/paywall/recomputation/intake branches, actual entitlement derivation, complete setup-link route and retained assertion, checkout retrieval/verification/payment guard, account-creation/recovery/Auth-lookup/profile-write branches, nearby race/payment guards and browser cleanup body. Read source/caller inventories, relevant Git introduction history, current package/CI registration and Playwright config. No scoped AGENTS were found under affected src/tests paths. The prior test-audit/CAMPAIGN and root agreements remain applicable.

Unrelated whole middleware/account-activation functions, every auth spec body, all provider trial/one-time internals and the whole suite were not exhaustively reread. Source histories support intent but passing/runtime claims still require main's fresh runs. Reconciliation is complete for the owned candidates and repairs: ledger D1/C1/D2/D3 map to this report C1/C2/C3/C4; ledger F1/F2/F3 remain retained repairs; ledger UI C2 is held. The ledger's generic npx command must give way to the inspected isolated native driver to avoid the repository config's environment loading. The broader148-row ledger is its author's full inventory; this second pass independently verified the bounded cuts/repairs and cited keepers, not all148 R decisions. No additional approval gate or policy change is inferred.
