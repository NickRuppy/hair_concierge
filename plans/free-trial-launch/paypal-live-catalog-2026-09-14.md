# PayPal live catalog — 14 September 2026

Verified through Nick's authenticated Chrome PayPal dashboard, merchant **Haarmony LLC**. Product: `PROD-1DJ37758SY227805K` (Chaarlie Premium). No API credentials, customer identities or payment details were copied. This receipt proves dashboard catalog state, not authorization timing or payment execution.

## Existing plans inspected

| Plan | ID | Observed schedule | Status |
| --- | --- | --- | --- |
| Launch jährlich | `P-7FW59039TR9999207NJWP4AI` | EUR 69.99 every year, unlimited; no trial listed | On |
| Annual full | `P-81C547791U432525LNJGUHOA` | EUR 99.99 every 12 months, unlimited; no trial listed | On |
| Launch monatlich | `P-3VB540420L146992JNJWP2JQ` | EUR 9.99 every month, unlimited; no trial listed | On |
| Jährlich – 7 Tage kostenlos | `P-2XJ97149EE510364NNKSAIRA` | One free 7-day cycle, then EUR 99.99 every 12 months, unlimited | Draft |

All inspected plans display zero setup fee and **Tax: No tax**. The active launch plans pause after three missed billing cycles; annual full and the existing trial draft show one. All display outstanding-payment auto billing on. Existing active plan details show `Chaarlie_prod` as webhook API credential.

The repeating EUR 69.99 plan cannot deliver the approved first-year-only discount. Existing plans and customer agreements were not edited.

## Newly saved live-account drafts

Created under Nick's prior direction to prepare provider products/plans and keep the launch offer. Used the existing product. Saved with **Save Draft**, never **Turn Plan On**.

| Purpose | Exact name | ID | Billing sequence |
| --- | --- | --- | --- |
| Monthly trial | Chaarlie monatlich – 7 Tage kostenlos | `P-5UN7083346758491UNKT4WHA` | TRIAL: EUR 0 for 7 days, once; REGULAR: EUR 9.99 every 1 month, unlimited |
| Annual launch trial | Chaarlie jährlich – 7 Tage kostenlos, Launch | `P-02T89719WR669253VNKT4VRI` | TRIAL: EUR 0 for 7 days, once; TRIAL: EUR 69.99 for 1 year, once; REGULAR: EUR 99.99 every 1 year, unlimited |

Both: EUR, no setup fee, no added tax, pause after one missed cycle, outstanding-payment auto billing on. These collection settings are recorded draft values, not proof of the application's first-failure lock/recovery behavior. Existing full-price trial draft retained separately for future no-discount offers.

Save confirmations and the catalog showed both new IDs as DRAFT, zero subscriptions, nine active plans unchanged and three drafts total. Reopened each new draft by its saved ID and verified the complete persisted price/cycle sequence.

Before saving, both reviews showed the existing product and `Chaarlie_prod`. **After reopening, PayPal's draft review shows product fields and webhook API credential as `--` / `-`, even though the catalog associates each draft with the correct product.** The older draft behaves identically. Do not treat the pre-save credential selection as proof that webhook association persisted. Verify actual API product linkage/application ownership and webhook delivery before activation; no assumption that this is merely cosmetic.

## Integration consequences and remaining proof

- The local pure plan builder/validator uses the exact new plan names. It still requires ACTIVE for checkout use, so these drafts are deliberately ineligible. No runtime ID/environment was provisioned.
- PayPal calls the discounted paid year a second TRIAL cycle. Access, first-payment tracking and revenue must use verified nonzero payment facts, not that provider tenure label.
- Dashboard configuration adds no tax to the listed totals. This is not a claim that PayPal calculates inclusive VAT or that any particular tax rate/registration is correct. Nick owns the tax review; no tax rate, exemption or global merchant setting changed.
- PayPal explicitly documents a free stage followed by a discounted stage and regular billing: [Offer a trial period](https://developer.paypal.com/subscriptions/trial-period/). The dashboard accepted that representation. Neither source proves exactly seven days from completed payer authorization, delayed approval behavior, interval switching, continuation after late first payment or cancellation race handling.
- Keep trial enrollment unavailable until provider verification and adapters are complete. No payer subscription, authorization, charge, refund, customer email, deployment or production application/database configuration was executed in this slice.

## Local verification

The existing focused PayPal plan-shape and trial-intent-route tests were rerun on Node 22 after aligning catalog names. Results are recorded in the implementation preflight. These tests are synthetic and do not replace the provider checks above.

## Live API access verified after owner credential update

The owner saved the live app credentials in the ignored task-local file. Live OAuth now succeeds at `https://api-m.paypal.com`; returned application ID is `APP-2VJ86968MU803542T`. Neither credential nor access token was printed or copied into this receipt. Earlier empty-file/401 reports are superseded by this successful read.

Authenticated GET requests returned HTTP 200 for the product, both new drafts, the older full-price trial draft and the legacy annual launch plan. Both new plans have the exact product ID and billing cycles above. The API calls their draft state `CREATED`; the older trial draft is also `CREATED`, and the legacy annual launch plan is `ACTIVE`. The new plans' setup fee is EUR `0.0`, taxes are absent, `auto_bill_outstanding=true`, and `payment_failure_threshold=1`. No catalog mutation or activation occurred during verification. Existing checkout validation correctly rejects both retrieved `CREATED` plans.

The credential's webhook list contains `2VJ19220KA048310H` targeting `https://chaarlie.de/api/paypal/webhook`. Registered events:

- `BILLING.SUBSCRIPTION.ACTIVATED`, `CANCELLED`, `CREATED`, `PAYMENT.FAILED`, `EXPIRED`, `SUSPENDED`, `UPDATED` (each with the `BILLING.SUBSCRIPTION.` prefix).
- `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REVERSED`, `PAYMENT.SALE.REFUNDED`.
- `PAYMENT.CAPTURE.DENIED`, `REFUNDED`, `REVERSED`, `PENDING`, `COMPLETED` (each with the `PAYMENT.CAPTURE.` prefix).

This resolves API access, resource visibility/product linkage and application webhook registration. It does not prove delivery, the deployed verification ID, payer-authorization timing or recovery behavior. No `CUSTOMER.DISPUTE.*` event is registered in this snapshot; verify the required dispute path before activation. Production webhook side effects for an isolated new-plan test must be checked before creating a payer agreement. No payer agreement, approval, charge, refund, application claim, customer message, deployment or production environment change occurred.
