# PayPal trial schedule and release verification

## Two clocks

The customer trial end remains S: the next UTC midnight strictly after checkout freeze + 8 days. This preserves at least seven full days for approvals within the existing 24-hour intent window. Cancellation, notices, reminders and access windows use that original end.

New initial agreements request `start_time = S + 12 hours`. A restored agreement requests noon on the first UTC date boundary at or after its unchanged trial end. PayPal's echoed start does **not** prove its actual billing time: admission and management still require `next_billing_time >= original_trial_end_at` and below the existing collection-window end.

Evidence from 15 September 2026, same live annual plan/app:

| Requested start        | PayPal next billing    | Result                              |
| ---------------------- | ---------------------- | ----------------------------------- |
| 24 September 00:00 UTC | 23 September 10:00 UTC | Rejected: 14 hours before trial end |
| 24 September 12:00 UTC | 24 September 10:00 UTC | Within allowed window               |

The noon probe was approved, checked against its original ACTIVATED event and fresh API GET, then cancelled with empty transaction reads. It tested provider scheduling, not application admission. No general timezone/batch guarantee is inferred from it.

## Request ownership and compatibility

Initial v2 freeze persists `trial_end_at`, `provider_start_time` and the `:v2` request key atomically. A lost response retries the same payload/key. Historical v1 requests retain their original midnight derivation and key. The first freezer wins; a v1 winner is never upgraded in place.

Management v2 freeze persists `source_start_time` and `target_start_time`. Source authority comes from the initial attempt or committed restoration that created that agreement. A switch retains its source timestamp; a restore freezes the replacement timestamp before sending it. Previously frozen legacy restore requests retain their midnight payload.

Legacy RPC readers reject v2 snapshots. This matters during deployment overlap: an old process otherwise ignores the new fields and could send midnight with the new key. New readers understand both versions. No existing agreement is patched or granted access by the migration.

Candidate expiry still uses the earlier trial-end boundary; it must not wait until noon. Admission and management verify the exact provider start separately. Expiry retains its existing identity checks so a wrong timestamp cannot prevent protective cancellation of an owned expired agreement. Paid-continuation requests use their existing independent payment/start snapshot; their future billing behavior has not been proven by the free-trial probe.

## Release order and verification

1. Review the additive migration, service-role grants and application diff together. Apply the migration before deploying the v2 application readers/writers. Migration publication and application deployment require their normal explicit authorization.
2. Verify old endpoints still serve v1 requests and reject v2 snapshots; v2 endpoints serve both. Confirm the migration's new functions are callable by `service_role` and unavailable to `anon`/`authenticated`.
3. Run one bounded monthly and annual **application checkout** with an authorized test buyer. Capture the displayed PayPal first-payment date before approval; reject a date earlier than the promised trial end. Then verify original activation, fresh GET billing schedule, admitted enrollment, linked account/access, notices and clean activation polling. A provider-only approval is insufficient.
4. Test cancellation/restoration and a plan switch against their frozen original end and exact request timestamp. Cancel test agreements and verify no payment before closing the test.
5. Recheck previously stuck agreements individually. A new-checkout release does not repair those contracts. Do not shorten their promised trial end or grant access manually. Any cancellation/retry recovery must verify exact ownership, latest state and transactions, with separate operator authorization.

Until these live application checks pass, report **implemented and locally verified**, not **production trials restored**. Monthly scheduling and buyer-visible disclosure were not captured in the annual provider probe. Future paid-continuation collection remains separate provider evidence; local mocks cannot prove it.

## Rollback

Keep the additive schema and v2 schedule readers after any v2 request is frozen. A full application revert would strand those pending agreements behind the legacy-reader fence. If a regression requires containment, disable new creation while retaining reconciliation, cancellation and expiry support for both versions; prepare and authorize the exact containment change. Do not change payloads under existing request keys or remove immutable schedule fields.
