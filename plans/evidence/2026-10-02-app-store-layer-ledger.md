# App Store webhook/mobile entitlement cohort — complete read-only ledger

Scope excludes the separately audited manual reconcile 4-site slice. Current AST inventory `/tmp/test-audit-final267-declarations.json` counts: transaction route 34 + notification route 22 + state 15 + verify 8 + PostgreSQL store 2 = **81/81**. Complete test bodies and fixtures, owner/route/store/migration types, current entry closures, runbook and relevant history were inspected. **R 81, F 0, C 0, D 0.** There is no redundant whole layer.

## Runtime and operator closure

- iOS posts to `src/app/api/mobile/v1/app-store/transactions/route.ts:7`, which calls `handleAppStoreTransactionsPost` (`src/lib/mobile/app-store-transactions.ts:110+`). It authenticates through the mobile policy, validates each JWS before writes, preserves per-subscription ownership, writes transaction then eligible renewal state, and calculates fresh mobile access.
- Apple calls `src/app/api/app-store/notifications/route.ts:7`, then `handleAppStoreNotificationPost` (`src/lib/app-store/notifications.ts:90+`); notification semantics differ from the app path because a webhook can arrive unbound and out of order.
- Both writers use `transactionSnapshot`, `renewalStatusSnapshot`, product allowlisting and access derivation from `src/lib/app-store/state.ts:122-250`, but the state suite is the only direct owner proof for expiry/grace/refund/merge predicate combinations. `src/lib/mobile/access.ts:40-95` is a consumer and cannot replace that oracle.
- `src/lib/app-store/verify.ts:56-232` configures bundle/environment/root verification; `src/lib/app-store/store.ts:52-202` binds each source row to RPC parameters and reloads entitlement. The backing migration’s service-only/RLS, immutable identity, owner, advisory-lock and newer-wins rules are in `supabase/migrations/202609*app*store*`.
- `docs/ios-app-store-subscriptions.md:37,44-56,76-92,148-164` documents grace behavior, deployed webhook, optional manual reconciliation, environment gates and rollback. The separate reconcile helper remains a documented operator path and was intentionally excluded.
- History is concentrated in `66b03bcc` (App Store paywall); no later removal/retirement exists. `package.json:49` includes all five top-level test files in `test:node`.

## Layer comparison

The routes deliberately share pure snapshots but do not duplicate their boundary risks: the app route binds an authenticated caller/token and returns access; webhook input is Apple push/replay/retry and may be unbound; state tests test exact temporal/refund/allowlist rules; verifier tests use trusted/untrusted chains and Xcode/local configuration; Postgres tests exercise SQL locking/owner/RLS behavior. Deleting a state or verifier row based on a route’s nominal success would lose inputs the route fixture does not cover. No same-input existing keeper absorbs one of these observations.

## Exact declaration marks

### `tests/app-store-transactions-route.test.ts` — 34 R

Actual owner: mobile authenticated receipt boundary. Each row has a distinct escaped regression: caller binding/access, policy sequencing, ownership/token case or deleted-account recovery, batch atomicity/idempotence/newer-wins, signed renewal linkage, strict body sizing, verifier/config error taxonomy, or post-transaction status failure. Local JWS and Supabase doubles implement transport/SQL test seams, while the assertions observe route responses and writes.

- **R** `107` — "the caller's own purchase binds to the caller and returns the fresh bootstrap access"
- **R** `125` — "with the paywall flag off the purchase is still recorded and access reads open"
- **R** `139` — "a purchase whose appAccountToken names another account is refused with 409 and not written"
- **R** `152` — "the token comparison ignores case (Apple may echo an upper-case UUID)"
- **R** `162` — "a purchase without a token binds to the caller while its subscription is unowned"
- **R** `173` — "a purchase without a token for a subscription owned by another account is 409 and ownership stays"
- **R** `201` — "replaying the same JWS is an idempotent success"
- **R** `215` — "an older copy posted after newer state is a stale no-op success"
- **R** `228` — "a batch binds several own periods in one call"
- **R** `242` — "every JWS is verified before anything is written: one forged entry rejects the batch"
- **R** `252` — "verified data that is not our subscription is rejected without writes"
- **R** `267` — "FW1 an unrelated auto-renewable product of the bundle is 409 invalid_transaction and grants nothing"
- **R** `283` — "a retryable verification failure (Apple OCSP unreachable) is 503 so the app retries"
- **R** `308` — "missing App Store configuration fails closed with 503 on the real route"
- **R** `317` — "an identity or environment mismatch is logged and answered 409 invalid_transaction"
- **R** `341` — "a transient store failure is 503"
- **R** `350` — "the body is strict: 1–20 JWS strings of at most 16 KB, JSON only"
- **R** `383` — "requires a mobile session and sits behind the mobile policy gate"
- **R** `406` — "is not behind the scanner gate: a caller without access can post and learns the result"
- **R** `422` — "a token of a deleted account is claimable by the verified caller (A3 protects living accounts only)"
- **R** `461` — "a mixed batch writes the caller's own row and answers 409 with the access it unlocked"
- **R** `501` — "renewal info of the caller's own purchase is stored and answers willRenew right away"
- **R** `523` — "without renewal info (older app builds) the purchase still binds and willRenew stays false"
- **R** `537` — "renewal info for a subscription not proven in the same request is ignored without a write"
- **R** `556` — "renewal info never rides along with another account's purchase"
- **R** `605` — "a forged renewal JWS rejects the whole batch before any write"
- **R** `617` — "verified renewal info that is not a scanner status is dropped; the purchase still binds"
- **R** `630` — "a retryable renewal verification failure is 503 and writes nothing"
- **R** `649` — "a newer webhook status is not overwritten by older renewal info the app posts"
- **R** `707` — "M2 a status-write failure after the transaction commits is reported but still answers success"
- **R** `734` — "M3 an expired transaction plus grace-period renewal info grants access through the grace end"
- **R** `759` — "M3 access ends once Apple's grace period has passed"
- **R** `775` — "M5 renewal info missing productId is dropped like a non-allowlisted product"
- **R** `788` — "signedRenewalInfos is bounded like signedTransactions"

### `tests/app-store-notifications-route.test.ts` — 22 R

Actual owner: Apple webhook record/retry boundary. The rows retain distinct notification types, unbound/deleted/foreign ownership, replay/out-of-order writes, verification/config/database retry status, and no-PII observability. The authenticated mobile route cannot cover Apple retry semantics.

- **R** `141` — "TEST and unrecorded notification types are acknowledged without writes"
- **R** `151` — "SUBSCRIBED binds the transaction and renewal status via appAccountToken"
- **R** `162` — "DID_RENEW without a token extends access: the new period inherits the owner"
- **R** `189` — "DID_FAIL_TO_RENEW with a grace period keeps access until the grace period ends"
- **R** `218` — "DID_FAIL_TO_RENEW without a grace period ends access at expiry"
- **R** `233` — "DID_CHANGE_RENEWAL_STATUS / _PREF update the renewal row only; EXPIRED ends access"
- **R** `269` — "REFUND and REVOKE revoke the named transaction; REFUND_REVERSED restores it"
- **R** `291` — "replaying a notification is idempotent"
- **R** `304` — "out-of-order delivery: an older notification never overwrites newer state"
- **R** `320` — "a token of a deleted account leaves the rows unbound instead of failing forever"
- **R** `331` — "a token naming a different account than the owner keeps the owner and is logged"
- **R** `348` — "unverified input is rejected with 400 and never written"
- **R** `388` — "malformed bodies are 400"
- **R** `404` — "a retryable verification failure and missing configuration are 503 (Apple retries)"
- **R** `428` — "a transient database failure is 503 and the retry then succeeds"
- **R** `441` — "a verified payload that is not a storable subscription row is acknowledged without writes"
- **R** `449` — "FW1 a verified notification for an unrelated product is acknowledged without writes or access"
- **R** `484` — "RENEWAL_EXTENDED records the extended expiry"
- **R** `503` — "OFFER_REDEEMED records the redeemed period for the owner"
- **R** `542` — "a non-verification exception during verification is reported without PII and answered 503"
- **R** `573` — "a transient store failure is reported with code, type and environment only"
- **R** `592` — "a retryable verification failure is reported with its code"

### `tests/app-store-state.test.ts` — 15 R

Actual owner: pure snapshot/entitlement oracle. The rows directly partition current/expired/grace/refund/reversal/merge/trial/environment/time-boundary/malformed/renewal/allowlist inputs. Neither route executes all temporal state combinations or proves the state function independently.

- **R** `59` — "S1 a current, unrevoked period grants access"
- **R** `69` — "S2 an expired period grants no access"
- **R** `74` — "S3 billing retry inside the grace period keeps access"
- **R** `86` — "S4 billing retry without an open grace period grants no access"
- **R** `106` — "S5 a refund of the current period removes access"
- **R** `123` — "S6 a refund of an older period leaves the current period active"
- **R** `137` — "S7 REFUND_REVERSED clears only that transaction's revocation"
- **R** `155` — "S8 an older signedDate never overwrites newer state for the same row, whatever the arrival order"
- **R** `205` — "S9 the free introductory week is flagged as a trial and grants access"
- **R** `222` — "S10 a payload whose environment differs from the verified environment is rejected"
- **R** `244` — "S11 access ends exactly at expiresDate and starts exactly at purchaseDate"
- **R** `270` — "malformed or non-subscription payloads are rejected, never defaulted"
- **R** `303` — "renewal snapshot records renewal intent and the triggering notification"
- **R** `325` — "FW1 only the scanner products are accepted; other products of the bundle are rejected"
- **R** `350` — "FW1 access derivation ignores stored rows of any other product, including their renewal status"

### `tests/app-store-verify.test.ts` — 8 R

Actual owner: certificate/JWS verifier configuration. Each uses a meaningful chain, bundle, environment, Xcode-local-mode, tamper/marker, nested notification, config or committed root-certificate condition. A fake verifier in route suites intentionally cannot substitute for cryptographic configuration proof.

- **R** `70` — "a transaction signed by a chain under a trusted root verifies and decodes"
- **R** `76` — "a foreign bundle is rejected"
- **R** `85` — "an environment outside the configured set is rejected"
- **R** `101` — "Xcode (unsigned StoreKit test) data is rejected unless the verifier runs in local mode"
- **R** `124` — "a chain under an untrusted root, a tampered payload, or a chain without marker OIDs is rejected"
- **R** `150` — "a notification verifies the outer payload and its embedded transaction and renewal info"
- **R** `203` — "configuration fails closed"
- **R** `267` — "the committed Apple root certificates load and parse"

### `tests/app-store-store-postgres.test.ts` — 2 R

Actual owner: real PostgreSQL RPC/storage implementation. The first is the only actual database proof of newer-wins, immutable identity, ownership and service-only behavior; the second binds TS row mapping and entitlement readback. Route fakes cannot establish SQL lock/RLS semantics.

- **R** `58` — "real PostgreSQL: newer-wins, immutable identity, one account per subscription, service-only"
- **R** `231` — "store maps rows to the upsert RPC and reads a user's entitlement back"

## Candidate result and limits

`/tmp/test-audit-app-store-machine-candidates.json` is `[]`; no assertion transfer, test/support deletion, or source simplification is unlocked.

No runner, provider/Apple endpoint, environment loading, credential, or database operation was performed. The supplied fixture suites use local JWS chains and faked Supabase for route behavior; their actual production-equivalence is limited to the injected interfaces. The two PGlite/PostgreSQL storage declarations are retained precisely because they are the separate real-store owner proof. A later change would need the native Node command for the five files plus its relevant database lane, but it was not run here.
