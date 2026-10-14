# Billing display and boolean alias leaves

## Supported coupled deletion

**Three source leaves plus three AST test declarations are D candidates.** One additional assertion/import cleanup has zero AST credit.

| Mark | Source / test | Evidence and exact cleanup |
|---|---|---|
| D | `src/lib/billing/display.ts:7` `formatBillingMembershipStatus` | Exact source search finds only its definition and `tests/billing-display.test.ts`. The current profile page imports only `formatBillingDate` (`src/app/profile/page.tsx:32,1811`) and owns its distinct `membershipStatusLabel(MembershipManagementState)` at `:109-116,1788`. Delete export and all three display test declarations at `tests/billing-display.test.ts:6,20,34`. |
| D | `src/lib/billing/display.ts:41` `isFutureDate` | Private only to the dead formatter. Delete with formatter; no independent runtime caller. |
| D | `src/lib/billing/purchases.ts:21` `hasCurrentOneTimePurchaseAccess` | Exact source search finds definition plus one test import/assertion only. It is exactly `resolveOneTimePurchaseAccessState(entitlement) === "active"`; retained production callers use the enum resolver directly in one-time activation, paid-access monitor, first-access, enrollment, welcome, and operator recovery. Delete function and the test import/assertion at `tests/billing-one-time-purchases.test.ts:7,79`; **zero declaration credit** because it is inside the retained enum-state test. |

`formatBillingDate` remains R: the profile page uses it for renewal display. Historical provenance is `cf167278` / `3e80bb77`; current caller closure, rather than history, is the retirement evidence.

## Challenged earlier broad R claims

`retrieveVerifiedStripeTrialAuthorization`, `loadTrialManagementState`, and `createTrialEnrollment` have no exact-name source/script/app import in the current token search. I therefore withdraw the earlier unsupported assertion that they have a dynamic/payment-entry closure. Their existing tests are direct verifier/transaction helpers, including PGlite/Postgres storage evidence, but that alone is not proof of a production caller or a transfer target. **Hold R/D pending owner-level import/route or a deliberate decision that the uncalled storage protocol is retired; do not delete SQL/migrations from this finding.** No stronger existing runtime keeper was established for their literal authorization/management/enrollment inputs.

## Limits

Read-only current-main search and bodies only; no native focus, runner, mutation, provider, DB, or environment operation. The display candidates must be deleted as coupled source/test cleanup; no production behavior transfer is required because the closures are absent.

## Main execution

Applied three declaration removals, no additions. The complete focused files pass 20/20 before and 17/17 after. Independent preservation review found no deletion-induced gap; the pre-existing absence of a direct profile label-map renderer assertion remains explicit. Full aggregate coverage is pending for this newer layer; the completed 239 snapshot precedes it.
