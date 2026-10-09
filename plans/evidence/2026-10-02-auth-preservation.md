# Auth batch preservation review

2026-10-02. Read-only review of `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, base HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Scope: four declared cuts, three retained-test repairs, and the setup-link copied helper/type closure. Inputs: original auth ledger, second layer plan, selected `plans/evidence/2026-10-02-auth-cutover-plan.md`, full five-file diff, cuts receipt, native logs and all completed owner-control receipts/logs.

**Verdict: no preservation gap found.** This batch supports exactly four test declaration removals: three Node and one Playwright, taking these four suites from 148 to 144 declaration sites. Repairs/renaming/helper deletion earn no extra test credit. Main's campaign count may move 182→186 for this batch, subject to its integrated verification; this is not full-suite or 20%-target completion evidence.

## Applied cuts versus actual keepers

1. **Allowed tier:** original `authenticated-app-route-access.test.ts:120`, `scan page tier: a paid-access composite of 'allowed' is premium`, is removed. Existing email-only manual/moderator grant keeper at current:127 uses the real resolver alias and actually produces allowed from its email-aware dependency, asserts premium, and asserts exact user id/email/false guest arguments. The only old assertion is retained. Generic resolver source has no intervening email-specific behavior after receiving allowed; the actual entitlement derivation maps that value to premium. Denied/unavailable/no-user/guest and auth/profile boundaries remain. Real scan and gated-page callers remain; no public alias was removed.

2. **Tracker denied access:** original middleware:279 `tracker still redirects an authenticated user without current access to reactivate` is removed. Its exact status307, full expired/reactivate URL, no profiles, no hair_profiles, and zero frontier calls are all present in the existing explicit unset-flag keeper at current:281. The same currentAccess=false, ordinary metadata{}, authenticated fixture and GET /tracker reach actual createUpdateSession. Observers are passed into the fixture; its from(table) appends actual queries, and its frontier dependency increments count when called. The feature flag is still restored in finally. No assertion was weakened to a more permissive table set or a mock-only response. Separate admitted tracker cost test, flag-on admission, denied mutation/API methods, trial and other-route cases remain.

3. **Ended moderator:** original middleware:596 `an ended moderator account receives the field-test end state unless paid access is valid` is removed. Keeper at current:633 `an ended moderator without paid or partner access is still routed to the ended screen` retains the same ordinary metadata, ended status, /routine path, 307 and exact ended URL. It starts with stale currentAccess=true rather than false and explicitly denies independent paid/partner evidence. Actual middleware unconditionally recomputes active from those independent checks for ended/unavailable moderators before routing; the keeper therefore detects stale tester access escaping that overwrite. Paid-positive, partner-positive, unavailable, active moderator and /chat distinctions remain.

4. **Unpaid card/default:** original checkout:923 `verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is card` is removed. The SEPA-default keeper at current:932 retains the identical actual retrieved complete/unpaid Session shape apart from opaque session ID and the same checkout_session_unpaid rejection. Card/SEPA defaults live in subscriptions.retrieve, which verification does not call. The new wrapper counter delegates to that same valid fake subscription and explicitly asserts zero reads. The offered-SEPA case remains because its payment_method_types is a real retrieved Session field, unlike the unused default-method dependency. Paid, no_payment_required, incomplete, required fields, preparation and one-time assertions remain. Real verification/retrieval/assertion owners and auth/welcome callers were not changed.

The full diff contains precisely those four deleted test calls. The AST cut receipt uses post-transfer line numbers for some rows (ended603/card950), so it must not be compared to original HEAD line numbers as though another declaration were removed. The source helper/type records in the same receipt are not test declarations.

## Three repairs and seam closure

**Missing profile, checkout:602.** The duplicate-auth declaration now locally overrides createUser to return the existing duplicate error without creating a profile. The shared duplicateEmails fixture remains unchanged for the separate race scenarios. Only the Auth user is seeded. The repaired test observes profile undefined before invocation, counts listUsers, records profile still undefined at lookup, asserts exactly one production-recorded upsert, and preserves every original returned identity/email/password-capability and stored profile field assertion.

Actual createCheckoutUser rechecks profiles, then invokes findAuthUserIdByEmail; actual Auth metadata reading and profile/billing fulfillment follow. Local listUsers supplies a valid Auth result rather than a preconstructed profile. No fake calls production recovery or manufactures the result. Returning null from actual fallback now fails with checkout_user_race_unresolved. Omitting actual profile write fails the upsert-count assertion after the fallback/absence assertions pass. The existing final persisted fields also remain checked on the clean run; this review does not claim the mutated run reached those later assertions after its first failure.

**Missing-body ordering, auth-post:354.** Both counters increase monotonically and their dependencies return valid normal values: allowed limiter and paid checkoutSession. The same `{}` input returns400 with Session error and empty Supabase operations, preserving every old assertion. Limiter and verifier counts must independently be zero. Actual-owner early calls leave400/error/Supabase observations unchanged but fail the corresponding counter. This validates missing-required-fields ordering in handleSetCheckoutPassword, not malformed request JSON parsing in POST or every auth submission dependency.

**Deprecated setup POST, auth-post:1658.** The retained renamed declaration now calls imported actual POST synchronously and checks response.status410 plus awaited exact German JSON error. The former plain status/body helper was independently implemented and did not exercise POST. Permanent route diff removes only handleSendSetupLink and exclusive RouteResult type; constant, POST and its behavior are unchanged. Caller search finds no remaining helper reference in src/tests; public route classification, middleware exemption and SEO inventory still contain the URL. The test title no longer overclaims a universal side-effect assertion. Adjacent welcome source checks—including exact payment-success caption and forbidden strings—remain intact; no unproved browser keeper replaced them. Browser Back/Forward and redirect-template guards also remain.

## Every actual-owner control inspected

I read `/tmp/test-audit-auth-mutations.cjs`, all 12 full red logs and every before/after result summary, as well as the JSON receipt. Each selected command ran one named case. All 12 before and 12 after runs pass; all 12 red runs fail once. These are actual owner mutations, not changed expectations or fake dependency failures.

| Control | Actual observed failure |
|---|---|
| tier-allowed-free | Email-grant keeper: actual free versus expected premium at access test:140. |
| tracker-profiles | Transferred no-profiles assertion false at middleware test:299; status and exact redirect assertions earlier pass. |
| tracker-hair_profiles | Transferred no-hair_profiles assertion false at:300; preceding response and no-profiles assertions pass. |
| tracker-frontier | Count1 versus0 at:301; redirect/table assertions earlier pass. |
| ended-stale-access | Exact location differs: /onboarding instead of /test/haarplan/beendet at:643. Status307 alone still passes. |
| unpaid-authorized | Promise resolves to actual complete unpaid Session instead of rejecting at checkout:944. |
| unpaid-subscription-read | Rejection assertion still passes, then subscriptionReads is1 instead of0 at:947. |
| auth-fallback-null | Actual createCheckoutUser throws duplicate-email unresolved error at source:1408; stack reaches ensureCheckoutAccount and repaired fixture. |
| auth-profile-write-omitted | Auth lookup/absence assertions pass, then recorded profile upserts has length0 instead of1 at:639. |
| missing-body-rate | Original400/Session/empty-Supabase assertions pass, then rateLimitCalls1 versus0 at auth-post:373. |
| missing-body-verifier | Original assertions and zero limiter pass, then checkoutVerifierCalls1 versus0 at:374. |
| setup-route-status | Actual POST returns200 versus410 at:1661. |

The two negative-table TAP messages print misleading expression excerpts from elsewhere in the TS file. They nevertheless name the exact selected keeper, report AssertionError false versus true, and map to distinct original test stack lines299/300, which contain the respective transferred assertions. The driver independently injects the corresponding real query immediately before the expired redirect; the actual observer wiring and clean surrounding assertions establish the intended failure. I have not repeated those unrelated printed expression snippets as the oracle.

Three old-oracle controls in `/tmp/test-audit-auth-old-controls/receipt.json` also have actual green logs: auth-fallback-null, missing-body-rate and missing-body-verifier. Their driver injects the same owner changes as the corresponding repaired red controls. Main ran them before repair; old test bodies recovered from HEAD explain the false passes (precreated profile, unobserved dependencies). This is concrete old-green/new-red evidence, not a statement that every original test was mutation-tested. The old receipts record source hashes and named run output rather than a separate per-run test-file hash; this review relies on main's stated before-repair execution order plus inspected original bodies for that provenance.

## Restoration and native evidence

Frozen intended auth source originals are under `/tmp/test-audit-auth-original/`. I independently hashed all five current owner files; each matches both frozen hashes and every matching originalHash/restoredHash in mutation receipts:

- authenticated-app-route-access.ts: `0530fec429df89c60f910b05c5fb3f96df8f95f5cd6eea4bcef35a81419ae385`
- supabase/middleware.ts: `b46773cf21b880cb35d2967d4a882be1c5c59c53f2416607b60d3cb8a4c862a7`
- stripe/checkout-activation.ts: `f33ca66366ec59a915fdeba82bb397ad20891dd837495de25c6bf4e51deb8bdc`
- set-checkout-password/route.ts: `97b0718697d5c0d827e6bebc225aad46858b56ffdc99689aa9dcb4b8a42d80f1`
- send-setup-link/route.ts: `71d79d122639c8fa68c5e7f9296fd8c80d819c0403ee9cbb5b294f510446308c`

The setup-route frozen hash is correctly the post-cleanup file, not the old helper-bearing HEAD version. Other owner policies remain unchanged. Any subsequent freemium edits are outside this frozen auth proof and require main's later integrated check; this report does not attribute those to auth.

Inspected native logs: Node before 62/62, transferred 62/62, after 59/59 with zero failures. Playwright before 86/86, transferred 86/86, after 85/85. After still names the unchanged local Chromium Back/Forward test at auth-post:141. Thus before/transfer comprise 85 pure contracts plus one real local browser case, after 84 pure plus that one browser case. The browser case uses an ephemeral loopback HTTP server, not a running application server or external provider. The inspected isolated config selects exactly the two PW files, uses installed tools/local register, and has no environment-file loader.

Current relevant declaration counts are 14 access, 45 middleware, 31 checkout, 54 auth-post: 144 total versus 148 original. Native count reductions agree with the exact cuts. Setup renaming and source closure are not additional removals. Checkout's untagged cases still need explicit native invocation because generic CI contracts do not include that file; these inspected runs supply focused proof, not a CI registration change.

## Limits

Read the complete current five-file diff, full original/current candidate and keeper bodies, changed fixture wiring, relevant actual owner branches from frozen snapshots, all control drivers/receipts/red logs and native result summaries. Wider fixture/source/history/CI context is carried from the immediately preceding independent layer pass; unrelated auth/provider internals and all 148 original declaration decisions were not re-audited. All source restoration hashes above were checked at this review's read time. No test, compiler, mutation, browser, provider, DB, environment-file access, counterpart reviewer or repository write was performed by this reviewer; only this /tmp report was written. Full-suite coverage, later freemium integration, branch readiness and final campaign accounting remain main-owned. There is no outstanding assertion transfer or helper-closure gap within this auth batch.
