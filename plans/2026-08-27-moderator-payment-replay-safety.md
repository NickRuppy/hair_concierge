# Moderator reset payment replay safety

Status: authorized implementation scope. Nick approved the payment safeguard, commit/push/merge/deployment, disposable browser login and final five-account reset with “Yes please finish it all” on 2026-08-27. This is the bounded safety addendum to the approved moderator-access plan. No billing cancellation, refund, account merge or invitation email is authorized or needed.

Base refreshed by fast-forward to e6eb60fd3c3cd1a3ad59ea1eee16906cd06536a2; existing task changes preserved. Live schema confirms newer Feinschliff state is already covered by the reset inventory.

## Outcome and operator journey

An old provider callback must not reassign a subscription to a moderator or restore pre-reset application state. No user-facing surface, copy, timing or feedback changes are introduced by this addendum: backend callback validation and an operator safety marker preserve the previously approved journey. No new mockup is required.

1. Deploy and verify the callback safeguards before real-account maintenance.
2. On each exact approved Auth identity, the supported Admin API records an admin-only moderator_reset_cutoff_at ISO timestamp atomically with the temporary ban. Preserve all existing Auth metadata; confirm the returned marker. Journal the exact cutoff.
3. Revoke sessions before the ban, sweep sessions, wait the full JWT lifetime plus a 120-second acceptance margin from the confirmed ban and the subsequent 300-second drain. Callbacks that read old metadata before the marker must finish within this drain. New callbacks read current Auth metadata, not stale JWT claims.
4. Fresh reset proof binds the journal cutoff and checks the same Auth metadata value under the locked Auth row. The application reset preserves this operational security marker. It is not an entitlement flag or a general reset-generation framework.
5. Reset and restore the exact five identities; create their restricted campaign and verify the full free plan journey. No invitation is distributed before the final verification receipt.

## Minimal implementation

PayPal: put the ownership check inside ensurePayPalCheckoutAccount, covering every caller. Always load an existing provider/subscription billing row. If present, its user_id is authoritative; load that exact owner's canonical profile/Auth identity. Never select another owner by payer email and never fall back to payer email if owner identity is missing. A different payer email is valid provider metadata and remains stored as such. If an explicit checkout-intent account email conflicts with that owner, fail before writes, lead linking, Auth capability issuance or intent activation; do not silently link a foreign lead or cancel the subscription. Existing no-intent subscription refresh preserves its actual owner. Initial checkout behavior remains unchanged.

Stripe: pin an existing provider/subscription row to its owner. Conflicting email/customer/profile identities fail before writes instead of choosing email first. For an existing account, read current server-side Auth metadata before any profile, billing or quiz-link write. If moderator_reset_cutoff_at exists, reject a checkout session or retrieved subscription created at/before that cutoff; invalid/missing timestamps or an invalid marker fail closed. Fresh post-cutoff purchases remain possible. Unmarked normal accounts retain their current legacy checkout eligibility. Do not infer external provider status from local rows.

Share the marker key and deterministic timestamp validation in a small billing module without network or framework dependencies. Maintenance writes/journals the marker; reset preparation and SQL verify it. No new database table/migration, API, background worker, global flag, provider mutation or customer-facing reset feature.

## Verification and review

- Red/green direct activator tests for PayPal owner-A/payer-B and conflicting intent, including no writes/capability/linking on conflict; legitimate differing payer/account email still works.
- Stripe tests for existing provider-owner conflict, email/customer conflict, pre-cutoff session, pre-cutoff subscription, missing/invalid timestamps, current metadata read error, normal unmarked legacy sessions and fresh post-cutoff checkout.
- Maintenance actual producer-to-consumer test includes the cutoff; production SQL refuses a missing/mismatched marker while preserving other metadata.
- A marked synthetic hosted identity proves Admin metadata merge/preservation and exact cutoff response; no provider operation or email delivery.
- Hosted Auth expiry observation must finish; all synthetic fixtures must be removed with residual proof.
- Full repository checks on the refreshed base; actual browser login -> fresh quiz -> free activation -> saved plan -> logout/login return, then whole-branch counterpart review.
- Publish/merge only the reviewed head, verify deployment, run exact guarded reset and verify all five restored accounts before handing Nick the invitation.

Alternatives rejected: relying only on provider inventory cannot fence future callbacks; a global email mismatch rule breaks legitimate PayPal payer/account differences; a new application-wide generation framework is unnecessary for five exact identities. The scoped Auth cutoff closes unknown old Stripe session replay while immutable provider ownership closes the demonstrated reassignment.

## Counterpart plan review rulings

Read-only Claude review: approve with revisions, 2026-08-27. Accepted: use one updateUserById call with both ban_duration and the single app_metadata marker; verify merge/preservation in the hosted synthetic probe. Explicit fields are Stripe Checkout Session.created and retrieved Subscription.created, both provider epoch seconds; marked subscription activation requires both strictly after the cutoff. The guard belongs in ensureCheckoutAccount before its first account/profile/billing mutation, including the duplicate-create recovery path. Marker removal is forbidden by the existing app-metadata reset allowlist; add an explicit regression naming the marker.

Rejected false-positive scope inference: assertCheckoutPreparationClaimed is the legacy SUBSCRIPTION path, not one-time checkout. ensureOneTimeCheckoutAccount first requires assertStripeOneTimeConsentReference before its ensureAccount callback, and the generic fulfillment worker requires its retained purchase/consent/job sources. PayPal one-time activation likewise requires the exact local order intent and consent before ensurePayPalOneTimePurchaseAccount; recovery requires purchase/consent/job sources. Current exact-target inventories for these sources are zero and the reset refuses newly appearing retained billing rows. Deleting old leads/drafts removes application resume sources. Consequently this batch does not need a second temporal fence inside the two one-time account helpers. Preserve and test their missing-source failure paths instead of widening payment behavior. Unknown/new target-owned intent/consent/purchase/job state blocks maintenance/reset.

PayPal asymmetry is resolved by actual call-site contracts, not assumed provider inventory: unknown subscription webhooks with neither an existing billing row nor a local intent already reject before activation; token recovery requires the local intent. Known foreign-owner rows are pinned by the central activator. The five targets have no local intent/billing source. Existing-owner explicit-intent mismatch rejects without activation/capability/link writes; no cancellation occurs. This is within Nick's approved narrow safeguard, not a new product tradeoff.

## Live verification correction

The first hosted expiry observation at exp+10 seconds correctly failed: PostgREST still accepted the old token. The fixture was cleaned and its absence independently verified. The probe now checks exp+120 seconds; maintenance includes that margin before the separate 300-second drain (67 minutes for a one-hour JWT). A second hosted observation is running; no real account is reset based on the failed observation.

Browser verification found the moderator start route omitted required live `channel` and `quiz_variant` columns. It now persists all canonical funnel-package variant fields; a direct persistence regression fails with the fields removed and passes with the fix. The fresh hosted-backed quiz now opens.
