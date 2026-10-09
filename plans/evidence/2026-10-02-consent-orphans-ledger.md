Superseded in part by the verified next359 resolved-symbol audit: the historical R rows for uncalled PayPal creation/abandonment functions and the uninstantiated decoder registry were overly broad. Live activation/recovery imports do not make separate creator/abandonment functions live, and explicit scanner snapshot admission does not instantiate the generic decoder registry. See [resolved closure and current plan](2026-10-03-next359-owner-union-plan.md). Preserve the other live symbols in those rows; no whole-family retirement is implied.

# Orphan-export challenge: billing, PayPal, routines, persistence

## Scope and result

Read-only audit of 22 substantive leads from the supplied 57-name navigation set: Stripe trial authorization; trial management/admission/purchases; all three one-time consent lookup wrappers; PayPal deferred plan/order/recovery exports; routine retrieval subqueries; and need-version decoder registry/snapshot decoder. I read definitions, tests, source/scripts/apps token callers, barrel paths, CI references and recent payment history. No runner, mutation, provider, DB, or repository edit.

**Supported D: 3 source exports and 4 test declarations (conditional coupled deletion). C: 0. R: the remaining 19 exports.**

## D — obsolete consent lookup wrapper layer

| Source candidate | Test declarations unlocked | Current closure | Dead contract / deletion condition |
|---|---|---|---|
| `findPersonalPlanOneTimeConsentByStripeCheckoutSessionId` (`src/lib/billing/personal-plan-one-time-consents.ts:100-110`) | `provider activation can find immutable consent by bound Stripe or PayPal reference`; `provider consent lookups return null for a missing row and surface database errors` in `tests/personal-plan-one-time-consents.test.ts:100-144` | No source, script, or app caller; the only non-test name occurrence is its definition. Runtime activation uses `findPersonalPlanOneTimeConsentById` (`stripe/checkout-activation.ts:746`, billing paid-access/activation callers). | Delete only with this wrapper and its provider-reference test arms; no keeper needed because no production path selects by Stripe session. |
| `findPersonalPlanOneTimeConsentByPayPalReference` (`:125-141`) | Same two provider-reference declarations above. | No non-test caller. PayPal activation/recovery resolves its order intent and consent ID in `paypal/order-activation.ts`, rather than querying consent by provider reference. | Delete wrapper and test arms together. Preserve `findPersonalPlanOneTimeConsentById` and activation/recovery tests. |
| `findPersonalPlanOneTimeConsentByLeadSession` (`:143-159`) | `checkout retries can find an existing immutable consent by lead and session`; `lead-session consent lookup returns null when missing and surfaces database errors` (`tests/...:146-180`). | No non-test caller. Current checkout retry/activation closures carry immutable consent/attempt IDs; no route or operator script imports this lookup. | Delete wrapper plus two declarations. Do not remove the underlying table or ID lookup. |

The four declarations are private query-shape replays. They do not test a retained checkout, provider, recovery, or storage boundary. The actual retained keeper family is ID-bound consent activation (`src/lib/stripe/checkout-activation.ts:746`, `src/lib/billing/personal-plan-one-time-activation.ts:136,645`, `src/lib/billing/paid-access-monitor.ts:269`) and its activation/recovery suites. The proposed removal unlocks no schema/migration cleanup.

## R — live or independently protocol-bearing exports

- `retrieveVerifiedStripeTrialAuthorization`: retained Stripe authorization verifier; test-only token scan misses its dynamic/payment entry closure and the test matrix covers verified identity/error semantics.
- `loadTrialManagementState`, `createTrialEnrollment`, `hasCurrentOneTimePurchaseAccess`: retained admission/effective-access protocol functions with Postgres/effective-payment keepers. Their distinct transaction/read semantics are not a generic helper replay.
- `buildPayPalDeferredTrialPlanRequest`, `createPayPalOrderIntent`, `createProviderPayPalOrder`, `recoverPayPalOrderActivation`, recovery abandonment exports: active checkout, webhook, auth-return, welcome, and operator recovery closure. `order-activation.ts:358+` is directly imported by welcome/auth/capture routes; deleting builder/recovery tests would remove provider request and non-charging recovery contracts.
- `buildRoutineRetrievalSubqueries`: planner contract; tests exercise message-to-query expansion used by planner retrieval rather than a source-string inventory.
- `createNeedVersionDecoderRegistry` and `decodeNeedVersionSnapshot`: retained persistence compatibility decoder surface at `personal-plan/persistence/index.ts:124-160`; versioned snapshot decoding has no stronger current-only keeper.

## Limits and history

Navigation counts tokens and can miss aliases/dynamic imports; every D above additionally has zero source/script/app reference after exact-name search. This is why no other one-reference candidate is proposed. CI routes relevant Node tests through `package.json:49` and agent/payment suites through `package.json:68`; I did not execute them. Payment history contains continuing PayPal/order recovery and trial changes, so historical API shape alone was not treated as proof; the three D wrappers are supported by present caller absence plus ID-based replacement closure.

## Main execution contract

Remove exactly the three unused lookup exports, their exclusively used private provider-reference lookup, four direct query-shape declarations, and exclusive test fixture/helper/imports. Main reread complete source/test modules and current non-test imports: checkout uses create/bind; Stripe and recovery, activation, purchase-access and monitoring use consent ID. The original experiment30ce958f introduced these exports; recovery0d29b871 subsequently uses immutable ID ownership. No table, migration, consent binding, ID lookup, write, legal copy or real activation behavior is retired. Native consent/activation/recovery/access tests must pass before and after; afterward include the changes in full coverage/check review. No replacement or fictitious mutation owner is needed for unused query code. This is a small bounded removal with no unresolved product choice; it stays local and uncommitted.
