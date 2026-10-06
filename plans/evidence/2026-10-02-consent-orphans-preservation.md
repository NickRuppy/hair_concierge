# Consent-orphan D4 preservation review

**Verdict: no preservation gap found for the four original AST test cuts and their exclusively used query/export seam.** This is a source-cleanup deletion, not a replacement-test claim.

## Reviewed deletion surface

Current diff removes the three unused exported query wrappers from `src/lib/billing/personal-plan-one-time-consents.ts` (original lines 100, 125, 143), their only private implementation at original line 272, and four direct helper tests at original `tests/personal-plan-one-time-consents.test.ts:100,127,146,161`. It also removes only their imports, the `consent` fixture, and `consentLookupSupabase`; the diff does not alter a migration, table contract, ID lookup, write, binding, or confirmation function.

The deleted tests manufacture the selected row/error in `consentLookupSupabase` and assert only the wrapper's `.eq(column, value).maybeSingle()` sequence. They do not enter checkout, Stripe/PayPal activation, recovery, or any persistence-backed route.

## Current caller closure and preserved behavior

Exact-name searches across `src/`, `scripts/`, `apps/`, `packages/`, docs, and current tests found no non-definition reference, barrel import, namespace use, or dynamic-dispatch evidence for:
- `findPersonalPlanOneTimeConsentByStripeCheckoutSessionId`
- `findPersonalPlanOneTimeConsentByPayPalReference`
- `findPersonalPlanOneTimeConsentByLeadSession`
- `findPersonalPlanOneTimeCheckoutConsentByProviderReference`

The actual paths use the retained ID ownership boundary:
- `src/app/api/stripe/create-checkout-session/route.ts:688,1382,2157,2196,2291` creates consent then binds the Stripe reference through `createPersonalPlanOneTimeCheckoutConsent` / `bindPersonalPlanOneTimeConsentProviderReference`.
- `src/lib/stripe/checkout-activation.ts:746` loads by `candidate.consentId` and then validates the canonical consent.
- `src/lib/billing/personal-plan-one-time-activation.ts:422,463,487,645` binds the purchase user, records confirmation, records delivery evidence, and loads the canonical consent by ID.
- `src/lib/paypal/order-activation.ts:613` binds the PayPal order/capture to a known consent ID; it does not perform the removed reverse consent lookup.
- `scripts/billing/one-time-recover.ts:600`, plus first-access, paid-access monitoring, and purchase access, retain `findPersonalPlanOneTimeConsentById`.

Legal copy remains in `src/lib/billing/personal-plan-one-time-consent-copy.ts`; the untouched table/migration authority remains `supabase/migrations/20260731121000_personal_plan_one_time_checkout_consents.sql:1,47,54-57,112-125` and recovery/state authority remains `supabase/migrations/20260731125000_one_time_payment_recovery_state.sql:17-18,48-49,70-76,230-231,257-281`. The current module keeps provider binding at lines 114-131, user binding at 133-145, confirmation at 147-173, and delivery evidence at 175-208.

## History and recorded proof

`30ce958f` introduced the one-time experiment, including this module/test file; `0d29b871` subsequently added recovery-related consent behavior. Neither history fact establishes a current caller for the deleted reverse-query wrappers; present callers establish the ID-bound recovery path.

Recorded seven-file native c8/TAP evidence (not run by this review) used:
`node --enable-source-maps --import ./tests/server-only-register.cjs --import tsx --test --test-concurrency=4` over the consent, purchase, activation, monitor, recovery-command, Stripe-confirmation, and PayPal-recovery files. `/tmp/test-audit-consent-orphans-before/tests.tap` reports 117 tests, 117 pass, 0 fail; `...after/tests.tap` reports 113 tests, 113 pass, 0 fail. The four missing before-only subtests are exactly the four names in `/tmp/test-audit-consent-orphans-cuts.json`; it records four test AST cuts and zero additions.

## Limits

This was a static/diff and recorded-proof review; I did not run a test, mutation, provider, database, or external-SDK check. Literal caller closure cannot mathematically exclude runtime reflection, but no checked-in barrel, namespace, dynamic import, operator script, documentation contract, or external SDK surface supports one. No mutation is required to prove removal of a dead private query seam; the live consent protocol is instead retained through the concrete ID/bind/write/confirmation callers above.
