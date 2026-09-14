# Stripe zero-total trial activation repair

## Outcome and authority

A verified seven-day Stripe trial must reach the existing account activation flow when Stripe represents its zero-value checkout as `payment_status: paid`.

Decision coverage is confirmed by the approved free-trial contract (the canonical plan, section 3), the ongoing deployment/recovery authorization, and the reported live activation failure. The original commercial and journey acknowledgements remain unchanged. Internal revalidation on 14 September: this repairs provider-response compatibility; it adds no offer, charge, access period, page, copy, or cancellation choice. Undiscussed consequential assumptions affecting this handoff: none.

## Evidence and scope

The live `POST /api/auth/send-magic-link` failed with “Stripe trial authorization is not verified.” Read-only Stripe data showed a completed Checkout Session with a zero total and `payment_status: paid`, a trialing subscription, an exact seven-day window, a saved card, and matching enrollment, account, annual price and coupon. A redacted local replay rejected the actual response and accepted the same object with only its payment status changed to `no_payment_required`. The CSP warnings were report-only.

Accept either `paid` or `no_payment_required` alongside every existing zero-total, trial-status, identity, saved-card, accepted-terms and timestamp check. Preserve revenue classification and the first-payment ledger. Add retrieval-validator and real account-activation regression tests; unpaid, nonzero, incomplete and non-trial checkouts remain rejected.

No provider/account writes, manual emails, new authorization, trial reset or migration are part of this repair. The owner retries the existing activation after deployment. There is no visual change, so the approved activation journey remains applicable.

## Verification and release

The two new tests reproduced the failure before the patch. All 23 focused tests and 71 surrounding trial/invoice/lifecycle/analytics checks passed afterward. The redacted live response now verifies and retains its original trial end. Typecheck, lint/build and focused counterpart review precede publication; receipts are kept outside the repository.

Publish through current `main`, pass exact-head CI, merge with the reviewed-head guard, and verify the production deployment. Do not directly deploy an unmerged task branch. The owner’s subsequent retry is the final live account-activation observation; local provider replay does not claim that an email was sent or an account activated.
