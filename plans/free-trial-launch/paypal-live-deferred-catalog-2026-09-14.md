# Live deferred-start catalog

Owner authorized the full Stripe and PayPal production launch on 14 September. These plans were created through the existing app and retrieved successfully at 14:08 UTC. No customer agreement, authorization or charge was created.

App: `APP-2VJ86968MU803542T`. Product: `PROD-1DJ37758SY227805K`, Chaarlie Premium.

| Plan | Live ID | Retrieved status | Schedule |
| --- | --- | --- | --- |
| Monthly | `P-4Y805027TR818725DNKT773Q` | ACTIVE | EUR 9.99 monthly, unlimited cycles |
| Annual renewal / paid recovery | `P-66386833F45479158NKUAJKI` | ACTIVE | EUR 99.99 yearly, REGULAR only |
| Annual launch | `P-926549353Y177680VNKT773Y` | ACTIVE | EUR 69.99 for the first paid year; then EUR 99.99 yearly |

All three have zero setup fee and retrieved `taxes: { percentage: "0.0", inclusive: true }`. The agreed amounts are final totals; this records provider configuration, not a tax-registration determination. Owner tax follow-up is unchanged.

These schedules contain no free billing cycle. The application creates a future-start agreement and, after verified authorization, aligns its start to the immutable seven-day trial deadline before admitting access. The annual introductory paid year uses PayPal's `TRIAL` tenure type at EUR 69.99; it is not the free access week.

Creation request IDs: `trial-v1-deferred-month-20260914`, `trial-v1-deferred-year-20260914`, `trial-v1-full-annual-20260914`. Retrieve these exact plans for retries; do not duplicate them. Earlier free-cycle draft plans and the legacy EUR 69.99 recurring plan are not the new launch catalog.

This receipt proves live catalog creation and retrieval only. Production application activation, webhook agreement execution and payer authorization remain separate verification steps.
