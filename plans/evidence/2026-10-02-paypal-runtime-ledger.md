# PayPal runtime lane — read-only partial ledger

Checkout: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`,
HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. No test runner, mutation,
provider, DB, environment load, or repository file write occurred.

## Read accounting and limitation

Inventory: `billing-paypal-server` 84 declarations / 3,133 lines,
`paypal-webhook-handlers` 57 / 2,389, `paypal-trial-activation` 52 / 1,674,
and `paypal-orders` 43 / 2,027: **236 declarations**. I fully read the 43
`paypal-orders` declarations and their shared fixtures, and mapped
`order-intents.ts`, `order-activation.ts`, the relevant `webhook-handlers.ts`
dispatcher, capture-order route and webhook route. The other three files were
inventoried and title/owner-mapped only in this pass; they are deliberately not
given invented per-declaration marks. This is therefore not a complete 236-row
campaign ledger and authorizes no deletion outside the 43 rows below.

CI: `package.json:49` runs root Node `*.test.ts[x]`; no browser/provider proof
was claimed. Current non-test callers include `src/app/api/paypal/capture-order/route.ts`,
`src/app/api/paypal/webhook/route.ts`, `src/app/welcome/page.tsx`,
`src/app/api/auth/{set-checkout-password,send-magic-link}/route.ts`,
`src/app/api/billing/{one-time-activation-status,reconcile}/route.ts`, and
`scripts/billing/one-time-recover.ts`.

## Complete `paypal-orders` ledger (43/43)

All 43 are **R**. No `F`, `C`, or `D` row is supported: each has a distinct
payment identity, provider truth, persistence, retry, entitlement, historical
recovery, or public-retirement contract. The last column identifies the actual
owner / retained proof class; a test with a source assertion is still retained
where no executable keeper proves the exact no-charge or provider boundary.

| line | declaration | mark and concrete protected contract |
| ---: | --- | --- |
| 51 | retired one-time PayPal order creation fails before it can reach provider or persistence work | R — public 410 tombstone for retired route; direct route invocation. |
| 65 | builds one fixed PayPal digital-goods order without a Billing Plan | R — provider purchase payload, EUR amount, no shipping/no subscription plan; `buildPayPalPersonalPlanOrder`. |
| 97 | one-time PayPal order creation fails closed without a merchant identifier | R — server config fail-closed. |
| 104 | uses separate stable idempotency keys for PayPal create and capture | R — prevents cross-operation provider replay. |
| 115 | requests the full PayPal representation for a capture | R — `order-intents.ts:274-279` outgoing provider header; no fake-fetch keeper checks it. |
| 124 | reuses consent-linked intent on uniqueness guard | R — database race recovery, not duplicate setup. |
| 178 | validates capture status, identity, amount, currency | R — payment admission validator. |
| 237 | does not mark or activate invalid provider capture | R — executes no-write/no-account/no-lookup safety path and telemetry. |
| 324 | reports 422 as one provider-confirmed failure | R — provider outcome truth classification. |
| 348 | recovers minimal successful capture via one lookup | R — incomplete response recovery. |
| 380 | recovers ORDER_ALREADY_CAPTURED without second capture | R — double-charge prevention. |
| 418 | lookup outage becomes pending recovery | R — no false activation on provider outage. |
| 440 | pending recovery cannot activate | R — no account/purchase on pending evidence. |
| 478 | declined represented capture is failed without replacement lookup | R — authoritative provider evidence / no unsafe retry. |
| 531 | auth/config failures stay out of provider-failed truth | R — incident classification boundary. |
| 573 | refund/reversal use related capture, not refund id | R — webhook payment identity mapping. |
| 595 | disputes use seller transaction IDs | R — entitlement-dispute identity mapping. |
| 612 | dispute lifecycle revokes/restores entitlement | R — actual webhook lifecycle. |
| 692 | unmatched dispute is acknowledged without retry loop | R — bounded webhook delivery behavior. |
| 721 | invalid completed capture webhook is rejected | R — amount/currency integrity. |
| 746 | webhook-first capture validates status/identity/amount/currency | R — independent webhook admission. |
| 827 | paid_at comes from provider time | R — payment ledger chronology. |
| 848 | activation delegates canonical fulfillment/analytics | R — source guard for avoiding duplicate/alternate fulfillment; no runtime keeper covers all exclusions. |
| 864 | prepared artifact has one provider ID/null locked-plan rejection | R — artifact delivery identity. |
| 897 | finalization binds via RPC even when generic linking no-ops | R — persistence owner boundary. |
| 917 | missing artifact rejects before delivery record | R — no false delivery. |
| 930 | captured intent recovers by non-charging retrieval | R — source guard; no executable no-POST keeper. |
| 941 | persistence precedes fallible activation | R — write-before-side-effect ordering. |
| 953 | consent-bind failure keeps purchase durable/no recapture | R — retry/double-charge regression. |
| 1035 | capture-id persistence failure stays pending | R — safe retry state. |
| 1121 | recovery verifies before local repair and never charges | R — operator recovery safety; source guard has no equivalent. |
| 1143 | stale capture cannot claim rebound order | R — compare-and-set identity fence. |
| 1165 | fulfillment retry delegates with no capture/create | R — job replay no-charge boundary. |
| 1183 | deterministic provider mismatch becomes permanent | R — retry classification. |
| 1230 | provider outage stays retryable | R — delivery recovery. |
| 1252 | genuinely pending capture stays retryable | R — pending recovery. |
| 1290 | active replay preserves first-password eligibility | R — auth activation eligibility. |
| 1309 | active replay rejects initialized/foreign metadata | R — account takeover fence. |
| 1342 | auth-admin lookup error fails closed | R — no unsafe account activation. |
| 1358 | operator recovery is read-only/sanitized | R — support-tool safety/privacy. |
| 1417 | recovery fails closed while capture pending | R — no premature repair. |
| 1453 | capture webhook analytics stays canonical | R — source guard against duplicate/wrong payment attribution; no behavioral keeper for all excluded payload fields. |
| 1465 | legacy activation-status stays subscription-only | R — retired one-time path exclusion; direct route source guard has no execution keeper. |

## Cross-file layer judgment

`paypal-orders` is the one-time payment producer boundary. `paypal-webhook-handlers`
is the subscription/webhook producer boundary; `paypal-trial-activation` is the
immutable-trial admission/clock boundary; `billing-paypal-server` covers broader
entitlement reconciliation and server route helpers. Repeated nouns (ACTIVE,
capture, cancellation, pending) do not prove duplicate assertions: their inputs
and side effects differ (browser capture vs webhook, one-time purchase vs
subscription, provider evidence vs persisted trial clock).

History reinforces retention: the lane was repeatedly changed by payment incident
fixes, including `2518d54e` (one-time recovery), `22af7e23` (API trial activation),
`6f17e90f` (cancellation retries), `f865a897`/`18b19c95` (refund correlation),
and `2126c78d` (deleted-account guard). No obsolete owner is proven: only the
public create-order route is retired, and its 410 is deliberately kept.

## Supported outcome

No coherent redundant layer or source/support deletion is unlocked. The proposed
cut count is **0**, preserving the campaign's 181 previously proven removals
without quota inflation. A future pass may only consolidate source assertions
after adding or identifying an existing actual-boundary keeper that demonstrates
the exact outgoing request/order/no-charge property; this audit does not create
such a test or make a transfer.

## Remaining 193: active-owner map (not a completed declaration ledger)

Indexing and owner reads found no shared helper/mock layer that can absorb a
whole file. The remaining declarations partition into these non-overlapping
actual owner contracts, all held as `R` pending the fixture-level completion
required for a formal per-declaration ledger:

| file and declaration lines | count | active owner and distinct observation |
| --- | ---: | --- |
| `billing-paypal-server.test.ts:417-1083` | 21 | billing subscription/manual access, checkout admission, PayPal intent and duplicate-guard identity |
| `billing-paypal-server.test.ts:1112-1889` | 24 | entitlement reconciliation: grace, provider response/error, bounded work, tier mirror, cancellation |
| `billing-paypal-server.test.ts:1937-2875` | 22 | cron authorization, webhook claim, Stripe/PayPal activation, email ownership, checkout conflict |
| `billing-paypal-server.test.ts:2893-3062` | 11 | provider plan/env/catalog/status/shape contracts |
| `paypal-webhook-handlers.test.ts:25-795` | 15 | catalog persistence, webhook claim/dedupe/release, subscription lifecycle |
| `paypal-webhook-handlers.test.ts:826-1454` | 16 | deleted-account, refund, plan/intent binding and quarantine handling |
| `paypal-webhook-handlers.test.ts:1489-1885` | 12 | catalog attribution, initial-vs-renewal sales, fanout retry and malformed sales |
| `paypal-webhook-handlers.test.ts:1958-2359` | 11 | Premium Sheet delivery/retry and reactivation reservation ownership |
| `paypal-trial-activation.test.ts:355-1070` | 31 | immutable trial clock/admission, provider evidence, cleanup and historical schedules |
| `paypal-trial-activation.test.ts:1122-1649` | 21 | API proof/webhook ownership, expiry, persisted denial, cancellation and error fallback |

The counts total 193. This confirms no defensible broad deletion layer, but is
explicitly less than the requested exact per-declaration body/fixture ledger.

## Completed `billing-paypal-server` ledger (84/84)

Read scope: full file (`1-3133`), including `createSupabaseStub`, its SQL-LIKE
emulation, provider/auth/profile/intent fixtures, and plan fixture. Each test
executes an imported runtime owner against that fixture; none is a source grep,
inventory, or shared-wrapper-only assertion. Every row is **R**; there are no
F/C/D marks, no keeper transfer, and no source/support deletion unlocked.

| lines | mark | precise owner contract |
| --- | --- | --- |
| 417,442 | R | `upsertBillingSubscription`: provider-scoped identity and partial-update preservation. |
| 491,515,549 | R | manual-grant validity, email lookup, and SQL wildcard injection prevention. |
| 565,595,605 | R | current/visible billing selection priority and incomplete/expired exclusion. |
| 630,684,693,710,724,831 | R | user/email checkout admission: active/past-due/paid-through/manual blocks while incomplete retry remains permitted. |
| 743,776 | R | app access versus paid access, including one-time and manual-grant separation. |
| 845,878 | R | PayPal checkout intent token, normalized identity, first-bind immutability/idempotence. |
| 923,957 | R | duplicate guard uses Chaarlie identity and cannot record duplicate before provider cancellation. |
| 1029,1053,1083 | R | profile tier mirror distinguishes future paid-through cancel, immediate cancel, incomplete. |
| 1112,1155 | R | expired entitlement downgrade skips users with a newer current subscription. |
| 1190 | R | test-marker classification deliberately diverges from SQL for real backfills. |
| 1222,1266,1304 | R | expired-active reconciliation refresh/cancel through respective Stripe/PayPal provider truth. |
| 1345,1379,1410 | R | seed skip, lag buffer, and early provider refresh before 24h access grace. |
| 1453,1495 | R | provider-call cap and deadline bound reconcile work. |
| 1537,1569 | R | provider failure no-write and resubscription no-downgrade. |
| 1620,1651,1679,1708 | R | unknown/missing/throw/abort PayPal evidence is error, never cancellation. |
| 1748,1795,1848,1889 | R | no empty-tier write; PayPal paid-through cancel, expiry, and Stripe cancellation propagation. |
| 1937,1955,2030 | R | reconcile route CRON auth plus expired/future and backfilled-row behavior. |
| 2090 | R | webhook event claim dedupe primitive. |
| 2107,2176,2227 | R | Stripe checkout activation and unpaid SEPA/non-SEPA no-access gates. |
| 2272,2321,2348,2392,2439,2490,2515,2531 | R | PayPal activation uses provider-owned email, exact email matching, duplicate-account fence, pending/terminal state and provider-aware hash. |
| 2549,2591,2635,2672,2707,2743 | R | Stripe update/delete matching, orphan fallback/no-op, and no unpaid/non-current access. |
| 2782,2800,2811,2830,2850,2875 | R | checkout conflict responses, injected client, provider-neutral email/manual checks and migration-tolerant absence. |
| 2893,2914,2946,2968 | R | PayPal interval/env/current+legacy+launch plan mapping and missing-config fail-closed. |
| 2979,2987 | R | standard and launch commercial plan prices/intervals. |
| 2995,3001 | R | provider status mapping and future paid-through cancellation representation. |
| 3026,3030,3040,3055,3062 | R | PayPal active plan shape: price/catalog and invalid amount/currency/cadence/status/finite/setup-fee/tax rejection. |

The listed lines account for all 84 declarations (2+3+3+6+2+2+2+3+2+1+3+3+2+2+4+4+3+1+3+8+6+6+4+2+2+5 = 84). Their named runtime owners are called by billing routes, Stripe and PayPal webhooks, checkout routes, profile access decisions, and payment catalog scripts. `billing-paypal-server` history includes the provider-truth/reconciliation and activation changes in `1550ae7c`, `318cf157`, `22af7e23`, and `f865a897`; each category represents a regression boundary from those active paths.

## Completed webhook and trial ledgers (109/109)

Exact declaration-site count is `57 + 52 = 109` (`rg '^test\\('`). The larger
`59 + 53` figure counts loop-expanded runtime cases in two files, rather than
additional `test()` declaration sites. Full fixture/body reads completed for
both files. Every declaration is **R**: none is a source inspection or a
fixture-produced self-receipt; each invokes the actual webhook or trial
admission owner and observes a distinct durable state, claim, provider,
entitlement, or retry outcome. No F/C/D and no support/source deletion.

| file lines | mark | concrete runtime contract |
| --- | --- | --- |
| `paypal-webhook-handlers:25,51` | R | provider plan/catalog metadata preservation for launch and unknown legacy plans. |
| `:392,412,600,633,659` | R | event claim/dedupe/release and required subscription/refund identity. |
| `:436,471,531,562,690,710,767,795` | R | provider-only clock and normal active/sale/failed/cancelled lifecycle branches. |
| `:826,870,938,1004,1054` | R | account-deletion flag, no-write/cancel and refund acknowledgement distinctions. |
| `:1091,1128,1176,1231,1268,1306` | R | intent ownership, plan binding, expired/quarantined cancellation and expiry. |
| `:1325,1354,1383,1418,1454` | R | log-only/refund sale linkage, mismatch retry and partial-refund identity. |
| `:1489,1529,1587` | R | legacy interval and provider catalog attribution/delivery flags. |
| `:1631,1657,1675,1701,1735,1760,1788,1816,1885` | R | initial-vs-renewal classification, fanout repair/no-op, malformed/quarantined sale retry. |
| `:1958,1984,2006,2026,2051,2095,2115,2136` | R | Premium Sheet provisioning eligibility, redelivery and initial-sale second chance. |
| `:2264,2285,2299,2308,2340,2359` | R | reactivation reservation exact ownership, completion retry/pending/duplicate/quarantine fences. |
| `paypal-trial-activation:355,378,390,417,435` | R | frozen clock and verified provider-evidence admission; provisional/late batches fail closed. |
| `:449,461,477,496,513,533` | R | repeated payer/race, invalid admission, replay and deleted-owner guards. |
| `:545,583,613,632,665` | R | nonzero authoritative sale, webhook account completion, restored agreement and committed paid period. |
| `:715,739,767,827,842,853` | R | typed conflict/recovery reason persistence, unrelated-error propagation, legacy-plan destination. |
| `:884,905,913,919,932,970,1015,1036,1070` | R | immutable original end and collection-window/noon schedule boundaries. |
| `:1122,1152,1169,1208,1219` | R | API proof issuance, disabled/non-active/mismatch/expiry and rollback semantics. |
| `:1252,1295,1326,1350,1381,1401,1424,1443` | R | API-proven cancellation/reservation and webhook winner/canceled-provider projection fences. |
| `:1466,1489,1506,1518,1533,1586,1623,1649` | R | persistence/integrity/short-window/first-proof/scope/race/denial/provider-error fallback. |

Counts: webhook `2+5+8+5+6+5+3+9+8+6 = 57`; trial
`5+6+5+6+9+5+8+8 = 52`. Together with the prior complete orders 43 and
server 84 ledgers, the exact lane total is **236/236 declaration sites**.

History and owner checks: `handlePayPalWebhookEvent` is invoked from
`src/app/api/paypal/webhook/route.ts:77`; trial helpers are entered by
`approve-subscription`, welcome/auth recovery and webhook paths. The suites
track incident-driven changes `6f17e90f`, `22af7e23`, `b1d0de34`, `501769ff`,
`f865a897`, `18b19c95`, and `2126c78d`. These histories explain why apparently
similar ACTIVE/cancel/refund cases remain independent: they differ in the
event source, persisted clock, account/deletion state, or retry claim.

## AST inventory correction — three nested declaration sites

The campaign AST inventory `/tmp/test-audit-final182-declarations.json` is the
count authority. My earlier anchored grep omitted indented `test()` calls in
tables. The discrepancy is **not** runtime expansion: the AST records 59
webhook-handler and 53 trial-activation declaration sites.

| AST location and title | mark | complete enclosing-table observation and owner |
| --- | --- | --- |
| `tests/paypal-trial-activation.test.ts:990` ``noon schedule admits ${interval} without moving the promised trial end`` | R | The month/year table changes accepted offer, plan ID, frozen provider start and next billing time, then calls `ensurePayPalTrialCheckoutAccount`; it asserts the immutable `trialEndAt` and stored `original_trial_end_at` remain `f.end`. Owner: trial admission/clock path. This is a two-row commercial-schedule contract, not a duplicate of the nominal morning-batch test. |
| `tests/paypal-webhook-handlers.test.ts:2324` ``PayPal reactivation ${mismatch} mismatch never closes reservation`` | R | The four-row table separately corrupts intent user, reservation user, local reference, and provider, invokes `handlePayPalWebhookEvent`, expects rejection and unchanged `provider_created`. Owner: webhook-to-reactivation reservation identity fence. |
| `tests/paypal-webhook-handlers.test.ts:2374` ``PayPal column-bound reactivation with ${binding} fails retryably`` | R | The three-row table corrupts missing metadata, wrong metadata, and wrong persisted column, then asserts rejection, unchanged reservation, and released event claim. Owner: column-bound reservation retry integrity. |

These three enclosing tables were read in full. They unlock no source/support
deletion and have no stronger keeper: the adjacent `:2340` duplicate/inactive
test does not exercise any of their identity or column failures.

Corrected exact total: **239/239 AST declaration sites** = orders 43 + server
84 + webhook handlers 59 + trial activation 53. All are **R**; no F/C/D.
