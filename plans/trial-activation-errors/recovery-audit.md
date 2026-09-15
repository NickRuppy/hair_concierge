# Activation recovery audit — 2026-09-15

Historical pre-implementation audit at base `b4deccd8`. Current implementation and verification are recorded in [plan.md](plan.md).

Scope: every proposed error/recovery action, both provider paths, the ordinary login destination and support. Nick approved the flow and requested shorter copy. This is code/test evidence and a revised static preview, **not proof that the new screens are implemented or live**.

## Result

The existing recovery mechanisms are usable under specific conditions. Some current error classifications and action bindings are wrong or missing. The implementation must fix those mappings; shortening strings alone does not fix the reported problem. Support is a manual resolution path. No automatic eligibility reset or paid checkout is promised.

## State-by-state evidence

Paths below are relative to this worktree.

| State | Correct user action | Code evidence and actual limitation | Implementation requirement |
| --- | --- | --- | --- |
| Previous trial or paid use | Support; optionally existing-account login | `src/lib/stripe/trial-account-admission.ts:63-77` throws a generic error on blocked/released rows. PayPal returns `duplicate` at `src/lib/paypal/trial-account-admission.ts:141-144`. Login does not change eligibility. | Read the persisted denial reason and show prior-use copy only for verified `trial_used`; no auth-form retry. |
| Competing reserved identity | Continue the original open attempt, or support | Stripe admission distinguishes `claim_reserved` at `src/lib/stripe/trial-account-admission.ts:230-242`; PayPal does so at `src/lib/paypal/trial-account-admission.ts:303-310`. The losing agreement is neutralized. | No retry of the losing attempt and no invented link to the competing attempt. Only suggest the user's already-open original page. |
| Closed or expired authorization | Login if account exists; otherwise support | PayPal expiry and failed start alignment neutralize the agreement at `src/lib/paypal/trial-account-admission.ts:215-237`. Both currently become `duplicate`. | Distinguish a closed attempt from existing access and prior use. Do not claim an exact failure cause unless retained evidence supplies it. |
| Cleanup/cancellation not confirmed | Support | Stripe cancellation, collectible invoices and release failures propagate at `src/lib/stripe/trial-account-admission.ts:143-188`; PayPal cancellation/transaction/release failures at `src/lib/paypal/trial-account-admission.ts:350-381`. | Say access/payment authorization needs review, not that cancellation or no-charge is confirmed. Do not offer new checkout. |
| Provider/account still processing | Check the same attempt again | PayPal `src/app/api/paypal/activation-status/route.ts:19-40` repeats activation; client polls up to 15 times in `src/app/welcome/welcome-client.tsx:123-211`. Stripe has no equivalent polling endpoint. | Bind manual check to canonical return reload; preserve token expiry. Map terminal API outcomes and stop polling instead of presenting endless pending. |
| Invalid activation reference | Existing login or support | Stripe typed failure currently redirects to pricing in `src/app/welcome/page.tsx:68-109`; no reference uses same-tab recovery in `src/app/welcome/return-recovery-client.tsx:6-17`. | Replace unusable-reference routing with recovery panel, while preserving valid saved-reference restoration. No email from unverified input. |
| Provider validation/proof failure | Safe retry only when transient; otherwise support | `src/lib/stripe/trial-authorization.ts:136-220` rejects many facts with the same null result, including trial ended or non-trialing agreement. | Do not relabel every failure as expired or unpaid. Keep unknown provider state distinct from verified invalid references and actual outages. |
| Existing independent access | Login | Stripe existing-access rejection preserves original membership (`tests/stripe-trial-account-activation.test.ts`); PayPal checks existing access before blocking at `src/lib/paypal/trial-account-admission.ts:249-256`. | Show existing-access copy only after that fact is verified; PayPal `duplicate` alone does not prove an active subscription. |
| Password already configured / setup claim unavailable | Ordinary login with password or a new login link | `src/app/api/auth/set-checkout-password/route.ts:154-177` refuses initial setup. A shared claim can be held or consumed (`src/lib/auth/checkout-activation-claim.ts:6-24`). | Do not infer trial denial or successful prior email delivery. Route to login without pretending every claim conflict can retry in place. |
| Email send failed, claim successfully released | Retry Login-Link senden | `src/app/api/auth/send-magic-link/route.ts:151-173` releases the claim on a returned OTP send error; test at `tests/auth-post-checkout-routes.spec.ts:1322` verifies release. | Keep email-specific inline failure and form state. Handle provider throttle separately from immediate retry. |
| Claim release failed / response outcome uncertain | Ordinary login or support | Release can throw (`src/lib/auth/checkout-activation-claim.ts:27-39`). Success or a lost response can leave a consumed claim; the next welcome POST returns 409 (`send-magic-link/route.ts:141-148`). | Do not promise the same resend will work. Ordinary `/auth` has an independent OTP route; do not assert an email was already delivered. |
| Password saved, automatic login failed | Login with the new password | Password saving finishes server-side; the client then calls `signInWithPassword` separately in `src/app/welcome/welcome-client.tsx:360-379`. | Preserve the success fact and provide a real Login link; don't send the user back to password creation. |
| Network/service failure | Retry existing operation, then support | Client preserves input state and normalizes errors in `src/app/welcome/welcome-client.tsx`; server routes distinguish rate-limit availability from policy rejection. | Do not replace the form on a recoverable error; repeated attempts must converge to a truthful terminal/login state when the first request actually completed. |
| Rate limit | Wait, then retry | Routes return app 429 or limiter-unavailable 503. OTP upstream throttle is currently tagged as 429 internally but returned as 500 (`send-magic-link/route.ts:159-173`). | Preserve wait-and-retry wording; do not invent a wait duration. Do not call throttling a trial denial. |

## Destination checks

- `/kontakt` is public for signed-in and anonymous users (`src/lib/auth/route-classification.ts:12-37`). It exposes `mailto:info@chaarlie.de` (`src/app/kontakt/page.tsx:13-26`). Reaching the page is supported; opening an email client, delivery and human resolution were not tested. No automated repair is implied.
- `/auth` password and fresh OTP paths are present (`src/components/auth/auth-form.tsx:151-240`). OTP uses `shouldCreateUser: false`; it works only for an existing account. Password reset is also available. Do not imply this creates an account or grants access.
- Active members proceed through the normal protected destination. No-access users are routed to `/reactivate` (`src/lib/supabase/middleware.ts:632-650`). Blocked/released enrollments produce its support/uncertain state (`src/lib/billing/trial-membership.ts:27-36`, `src/components/reactivation/trial-membership-recovery.tsx:47-87`). Login alone cannot resolve denied eligibility.
- `/pricing` is not a safe universal recovery link: anonymous entry returns to acquisition. Keep it out of these actions.

## Verification performed

- `npx playwright test tests/auth-post-checkout-routes.spec.ts --project=chromium --reporter=line`: **45 passed**. Provider/auth dependencies are stubbed; tests do not prove live email delivery.
- Node test runner: `stripe-trial-account-activation.test.ts`, `paypal-trial-activation.test.ts`, `welcome-return-recovery.test.ts`: **37 passed**.
- Added blocked `trial_used`, released `trial_used`, and released `claim_reserved` cases to the existing `reactivation-trial-management.test.ts` route fixture. **5 tests passed**, including that expanded test. These establish no private preview or paid checkout is rendered for those rows.
- Delegated read-only destination audit: **22 passed** across reactivation-routing, reactivation-trial-management and auth-confirm-replay. Counts overlap the final reactivation run; do not add them as independent tests.
- The shortened static preview is inspected in a real browser. Its buttons intentionally have no external side effects. New production outcome rendering still requires implementation and browser checks using the real component.

No payment, OTP send, password change, eligibility reset, or production mutation was performed.
