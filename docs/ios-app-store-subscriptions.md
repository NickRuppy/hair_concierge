# App Store subscriptions & account deletion runbook

Status: code for Tasks 1–7 is implemented on `codex/ios-paywall`, not merged, not deployed. `MOBILE_PAYWALL_ENABLED` defaults off everywhere. Nothing in this document has been executed — it is the checklist for activation. Plan of record: [`plans/ios-paywall/plan.md`](../plans/ios-paywall/plan.md); global constraints and decisions D1–D12/A1–A3: `.superpowers/sdd/plan/constraints.md`; deletion classification: [`plans/ios-paywall/deletion-inventory.md`](../plans/ios-paywall/deletion-inventory.md).

## 1. Prerequisites owned by Nick

None of the following exist yet; they block everything else in this document.

| Item | Notes |
|---|---|
| Paid Apple Developer Program enrollment | Org account, seller **Haarmony LLC** (US), per D11. |
| Paid Apps Agreement | Signed in App Store Connect once enrollment completes. |
| US tax forms (W-9) + bank account | Required before any paid app/IAP can go live. |
| Small Business Program application | Reduces Apple's commission from 30% to 15% below the program's revenue threshold — apply once enrollment is active. |
| App Store Connect app record | Final bundle ID set here. The Xcode project currently ships `de.chaarlie.scanner.local` (Debug) and `de.chaarlie.scanner.pilot` (HostedPilot) as placeholders; the Release configuration also still reads `de.chaarlie.scanner.local` — **replace it with the real bundle ID at setup**, and update `APP_STORE_BUNDLE_ID` (§3) to match exactly. |

## 2. App Store Connect setup

Do this after enrollment, before any code deploy.

### 2.1 Subscription group and products

| Item | Value |
|---|---|
| Subscription group reference name | `Chaarlie Scanner` |
| Yearly product ID | `de.chaarlie.scanner.yearly` — group level **1**, price **39,99 €**, duration **P1Y**, introductory offer **free, 1 week (P1W)** |
| Monthly product ID | `de.chaarlie.scanner.monthly` — group level **2**, price **4,99 €**, duration **P1M**, no intro offer |

Product IDs are **permanent once created** in App Store Connect — confirm both strings exactly before saving (they must match `APP_STORE_BUNDLE_ID`'s sibling constants baked into the app and referenced by the server; see `constraints.md` §4).

### 2.2 Storefronts and pricing

Enable storefronts **DEU, AUT, CHE, LIE** and let Apple auto-convert the base (DEU) price for the other three (D7). Do not hand-set per-storefront prices.

### 2.3 Billing Grace Period

**Product decision to confirm with Nick before enabling** — this is not covered by D1–D12. Default suggestion: enable Billing Grace Period with **6 days**. It affects `hasActiveAppStoreAccess`'s `in_billing_retry` branch (`src/lib/app-store/state.ts`) — access continues while `gracePeriodExpiresDate > now`, which only has an effect if Apple actually grants a grace period.

### 2.4 Localization and review

- German (DE) localization for both products and the subscription group (all UI copy is German per repo convention).
- One review screenshot per product showing the paywall (`plans/ios-paywall/evidence/task4-paywall-fixture.jpg` is a starting point, not final review art — retake against a real build once the group ID is real).

### 2.5 App Store Server Notifications V2

Same URL for **both** Production and Sandbox:

```
https://chaarlie.de/api/app-store/notifications
```

This route is public (outside `mobileRoute`/`mobileEnabled`, listed in `PUBLIC_API_EXACT_ROUTES`) and has no rate limit, matching the Stripe/PayPal/Calendly webhooks. It verifies Apple's JWS chain before writing anything and never returns 200 on unverified input.

### 2.6 App Store Connect API key (reconciliation)

Generate one API key (Server API access) for the optional reconcile helper (`src/lib/app-store/reconcile.ts`, not wired to any route or cron in this branch). Record:

- Issuer ID → `APP_STORE_ISSUER_ID`
- Key ID → `APP_STORE_KEY_ID`
- Private key (.p8) → `APP_STORE_PRIVATE_KEY`

### 2.7 `CHAARLIE_SUBSCRIPTION_GROUP_ID` build setting

`ios/Chaarlie.xcodeproj/project.pbxproj` carries this as a build setting, mirrored into each configuration's Info.plist as `ChaarlieSubscriptionGroupID`:

| Configuration | Current value | Action |
|---|---|---|
| Debug | `21500001` (local `.storekit` group) | Leave — local testing only. |
| HostedPilot | `SET_AT_APP_STORE_CONNECT_SETUP` | Replace with the real numeric group ID once created (§2.1). |
| Release | `SET_AT_APP_STORE_CONNECT_SETUP` | Replace with the real numeric group ID once created (§2.1). |

Until replaced, the paywall shows "Abos sind in diesem Build noch nicht verfügbar." (non-numeric group ID guard in `PaywallView.swift`) instead of crashing or showing broken tiles — safe to leave until this step, but the app is not purchasable in HostedPilot/Release until it's done.

## 3. Server env (Vercel)

All names below are read verbatim from the current code (`src/lib/app-store/verify.ts`, `src/lib/mobile/access.ts`, `src/lib/mobile/pilot.ts`, `src/lib/account-deletion/runtime.ts`, `src/app/api/account-deletion/reconcile/route.ts`).

| Variable | Meaning | Safe default before activation |
|---|---|---|
| `MOBILE_PAYWALL_ENABLED` | Master rollout flag. `!== "true"` → bootstrap reports `access: {status:"active", source:"open"}` for everyone, no DB read, no route gating. | unset (off) |
| `APP_STORE_BUNDLE_ID` | Must equal App Store Connect's app bundle ID exactly (`^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$`). | set once the real bundle ID exists (§1) |
| `APP_STORE_APP_APPLE_ID` | Numeric App Store app ID. Required whenever `Production` is in `APP_STORE_ENVIRONMENTS`. | unset until App Store Connect assigns it |
| `APP_STORE_ENVIRONMENTS` | Comma-separated allow-list read by both webhook and transaction routes. Allowed values: `Production`, `Sandbox`, `Xcode`. `Xcode` is accepted **only** when the full local-mode predicate holds (`MOBILE_API_ENABLED=true`, `MOBILE_AUTH_MODE=local`, `MOBILE_PILOT_ENABLED !== "true"`, loopback Supabase URL, `MOBILE_AUTH_CALLBACK_URL=chaarlie-local://auth`) — otherwise the verifier config fails closed. | `Sandbox` only, during sandbox testing; add `Production` at go-live |
| `APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`, `APP_STORE_PRIVATE_KEY` | App Store Connect API key for the reconcile helper (§2.6). PEM may use `\n` escapes. Not required for the paywall or webhook to function — only for manual/cron reconciliation, which is not wired up in this branch. | unset until the reconcile helper is wired to a route/cron |
| `POSTHOG_PERSONAL_API_KEY` | Personal API key with `persons/bulk_delete` scope, used only by account deletion's PostHog cleanup step. Without it, cleanup stays at `data_deleted` (deletion still succeeds) and Sentry fires from the 5th failed cleanup attempt. | set before activation — see §9 |
| `POSTHOG_PROJECT_ID` | Optional, defaults to `126788` (the existing Chaarlie PostHog project). | default is correct |
| `POSTHOG_API_HOST` | Optional, defaults to `https://eu.posthog.com`. | default is correct |
| `CUSTOMERIO_SERVER_WRITE_KEY` | Existing Pipelines write key, reused by account deletion's `User Deleted` event (two sends: user id, then email identifier). Already set in production for other features. | already set |
| `CRON_SECRET` | Bearer secret already used by other cron routes; the account-deletion reconcile cron (`/api/account-deletion/reconcile`, registered in `vercel.json` at `20 * * * *`) checks it the same way. | already set |

**Not App Store–specific but load-bearing:** `MOBILE_AUTH_MODE`, `MOBILE_API_ENABLED`, `MOBILE_PILOT_ENABLED`, `MOBILE_AUTH_CALLBACK_URL` gate the `Xcode` environment value above — these already exist for the mobile pilot and should not be changed for this rollout.

## 4. Database

### 4.1 Migrations added on this branch (apply in order, via Supabase CLI `db push` only — never MCP, never hand-numbered)

| Migration | Purpose |
|---|---|
| `supabase/migrations/20260927133426_app_store_subscriptions.sql` | `app_store_transactions`, `app_store_subscription_status`, upsert RPCs (Task 1). |
| `supabase/migrations/20260927172739_account_deletion_schema.sql` | `account_deletion_operations`, `anonymous_quiz_answer_archive`, retention/policy constants, anonymization tags on 47 tables, FK relaxations, the 17 regenerated billing/trial guard functions (Task 6). Sets `lock_timeout = '5s'`. |
| `supabase/migrations/20260927172741_account_deletion_routine.sql` | Lifecycle RPCs, `private.delete_account`, purge routine, orphan-closing (Task 6 + fix rounds). |

### 4.2 Apply procedure

1. Apply only via `npx supabase db push` (never MCP, never hand-numbered) against Supabase project `pqdkhefxsxkyeqelqegq`, in a **quiet window**. The schema migration sets `lock_timeout = '5s'`; a lock timeout aborts cleanly and can be retried.
2. **Before production**, verify on a Supabase branch (not production):
   - the `postgres` role's DELETE privilege on `auth.audit_log_entries`, `auth.refresh_tokens` and `auth.flow_state` in the hosted GoTrue schema — the deletion routine deletes rows from these directly (no FK);
   - the cost of the routine's payload scans (`auth.audit_log_entries`, `rate_limits`) at production table size, since these are scanned by user id/email without an index guarantee in the replay used for testing.
3. **Drop or scrub production-only backup tables before activation** (open with Nick — Q5, deletion-inventory §9): `public.profiles_backup_20260822`, `public.billing_subscriptions_backup_20260822`. These are manual tables invisible to the migration replay; if left in place they retain PII the deletion routine cannot reach.
4. **Cron registration**: `/api/account-deletion/reconcile` is already listed in `vercel.json` (`"schedule": "20 * * * *"`) and needs no separate registration step — it activates on the next deploy that includes this branch, independent of `MOBILE_PAYWALL_ENABLED`. It retries external cleanup (Customer.io/PostHog/storage) for in-progress deletions and then purges anonymized rows past `purge_after`.

### 4.3 Concurrency and failure notes (for the operator running step 1–2, not a gate)

- `account_deletion_begin` and `private.delete_account` share a per-account advisory lock; the cron's `account_deletion_close_orphans` sweeps operations whose account disappeared by another path (dashboard/admin deletion).
- The purge runs one table per subtransaction; an FK conflict falls back to row-by-row deletes and reports `stillReferenced` rows (never a full-table failure). Other failures raise a Postgres WARNING with table + SQLSTATE and are reported to Sentry (`account_deletion.purge_table` tag) by the cron.
- Deletion is never run against production data as part of this project — the routine has only been exercised in a disposable `postgres:17.6.1.106` container and against Supabase branches.

## 5. Local testing (Xcode + StoreKit configuration)

1. Open `ios/Chaarlie.xcodeproj`, scheme **Chaarlie** (Debug — this scheme has `Chaarlie.storekit` wired into its Run action LaunchAction). The file ships at `ios/Chaarlie/Resources/Chaarlie.storekit`: group `21500001` "Chaarlie Scanner", yearly 39.99 €/P1Y level 1 with free P1W intro, monthly 4.99 €/P1M level 2, storefront DEU/locale de_DE.
2. Run on the simulator from Xcode itself, not `xcodebuild`. Launching a StoreKit purchase sheet from a command-line `xcodebuild test` run fails with `SKTestSession`/`SKInternalErrorDomain Code=3` — this is a known StoreKit local-testing limitation, not a bug in this app. Two ways to launch from Xcode without hand-clicking Run each time:
   - Click Run in Xcode normally, or
   - AppleScript: `tell application "Xcode" to run workspace document 1` (drives the already-open Xcode project's Run action).
3. Capture screenshots via `xcrun simctl io <device> screenshot <path>.png` against the running simulator — not in-app `drawHierarchy` snapshots, which mis-render the iOS 26 glass materials used by `SubscriptionStoreView`.
4. Drive purchase/refund/expire/Ask-to-Buy scenarios from Xcode's own **Debug ▸ StoreKit ▸ Manage Transactions** (Transaction Manager) window while the app runs. The next bootstrap call or the next 402 from a gated endpoint returns the app to the paywall — there is no separate "refresh" step in the app.
5. For the full local flow (server included, not just the UI), point the app at the local backend with `MOBILE_PAYWALL_ENABLED=1`, `MOBILE_AUTH_MODE=local`, and add `Xcode` to `APP_STORE_ENVIRONMENTS` (only accepted under the full local-mode predicate — see §3) against a synthetic user with no access.
6. UI-only rendering (no server, no purchase): launch argument `--ui-design-review` with env `CHAARLIE_DESIGN_SCENARIO=paywall` (or `profile-abo`, `delete-notice`, `delete-confirm`). This shows layout only — transaction posts fail locally in this fixture (no backend), so it renders the "Kauf erfolgreich – Freischaltung läuft …" retry state by design, not as a bug.
7. Swift unit tests: use the signed-simulator command from `ios/README.md` (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`, simulator id `26C40D88-109F-4071-A7FF-D0A982963B9C`) — Keychain-backed session tests need the simulator entitlement, which an unsigned build does not have.

## 6. Sandbox + TestFlight test script

Blocked until Apple enrollment (§1) and a real sandbox tester exist — **listed here as the test plan, not a merge gate** (constraints.md §9: "Sandbox/TestFlight purchase with a real Apple sandbox account: blocked on Apple enrollment — listed in runbook, not a merge gate").

Run each of these against a TestFlight build with `APP_STORE_ENVIRONMENTS` including `Sandbox` and, once ready, `Production`:

1. **New user → paywall → yearly trial → scanner.** Fresh registration lands on the hard paywall (no close button, D1). Select the yearly tile (preselected, "Kostenlos testen"), complete the Apple purchase sheet with a sandbox Apple ID, confirm the app posts the transaction and unlocks the Scan tab.
2. **Monthly.** Same flow, select the monthly tile ("Abonnieren", charged immediately — no trial per D4).
3. **Restore on reinstall.** Delete and reinstall the app (or a fresh install signed into the same account), tap "Wiederherstellen" on the paywall — access returns without a new purchase.
4. **Refund via Sandbox → paywall.** Refund the sandbox transaction (App Store Connect sandbox tester management or Transaction Manager equivalent for TestFlight), then confirm the next bootstrap or the next scan request (402) returns the app to the paywall.
5. **Expiry.** Let a short sandbox renewal cycle lapse (Sandbox renews every few minutes per Apple's schedule) and confirm access is revoked on the next check.
6. **Deletion with an active Apple subscription.** From Profil, "Konto löschen" → subscription notice appears only because `access.appStore.willRenew == true` → "Abo kündigen" opens Apple's manage-subscriptions sheet, or "Trotzdem fortfahren" → confirmation → deletion. Confirm the account is gone and the Apple subscription is unaffected (Apple 5.1.1(v): deletion does not cancel Apple subscriptions).
7. **Deletion of a web subscriber (A1).** A test account with only a web (Stripe/PayPal) subscription and no App Store row deletes without the Apple notice; confirmation screen shows the extra line "Dein Chaarlie-Abo wird sofort beendet."; confirm the web subscription is actually cancelled (no proration) immediately.
8. **Web-paid account skips paywall.** A test account with an active web subscription and no App Store purchase bootstraps straight to the scanner (`source: "web"`), never sees the paywall.

## 7. Activation order + rollback

1. **Configure** — §2 (App Store Connect) and §3 (server env), with `MOBILE_PAYWALL_ENABLED` still unset/false.
2. **Deploy** with the flag off. Nothing changes for the current pilot population.
3. **Sandbox test** — run §6 against the deployed backend with `Sandbox` (and `Xcode` locally) in `APP_STORE_ENVIRONMENTS`.
4. **Flip** `MOBILE_PAYWALL_ENABLED=true` and redeploy (same two-step caveat as other flag flips in this repo — see `docs/freemium-flag-flip-runbook.md` for why an env-var change alone is not live on Vercel until the next deployment is built and promoted).
5. **Monitor** — Sentry (see below) and the funnel described in §6, on real traffic.

**Rollback** = set `MOBILE_PAYWALL_ENABLED` back to off (or unset) and redeploy. Bootstrap immediately reverts to `access: {status:"active", source:"open"}` for everyone and route gating stops (the 402 checks are all downstream of `resolveMobileAccess`, which short-circuits before any DB read when the flag is off). Rollback does not undo: App Store transactions/status rows already recorded (they simply stop being read for access decisions), or any account deletions already completed.

**Post-deploy Sentry check** (repo habit, `CLAUDE.local.md`): after flipping and after any deploy that touches this code, check Sentry (`haircare-fw/hair-concierge`) for new errors in the preceding hour. Watch specifically for the tagged events this feature emits: `account_deletion.error_code`, `account_deletion.purge_table`, `account_deletion.code=orphan_closed_before_billing_cancel`, `account_deletion.provider`/`account_deletion.event_type` (deleted-account subscription still billing), and `app_store.stage`/`app_store.notification_type` (webhook verify/record failures). None of these reports include ids or email — cross-reference by timestamp and tag only.

## 8. Legal checklist (confirm with legal before activation)

| Item | Detail |
|---|---|
| AGB / Datenschutz / Impressum | Must name **Haarmony LLC** as the seller/operator (D11), consistent with the App Store Connect seller name Apple will show at checkout. |
| Privacy policy — anonymized statistics | Add a sentence describing that quiz answers are retained anonymously (answers + month + channel only, no identifiers) after account deletion, per D10 / deletion-inventory §"Kept anonymous, no purge". |
| Privacy policy — anonymous subject ID re-identification note | State that other retained records (billing/cancellation evidence, anonymized leads/sessions) are tagged with a random anonymous subject ID that is never derived from or stored against the deleted account's original user ID (D12), and that this ID cannot be used to re-identify the person from Chaarlie's own data. |
| Privacy policy — trial anti-abuse fingerprints | Open with Nick (Q3): default behavior keeps hashed device/claim fingerprints for 3 years after deletion, unlinked from the account, for trial fraud prevention; the alternative (`erase`) drops them immediately via the existing rights-erasure path. Whichever is chosen needs a corresponding privacy-policy sentence. |
| Retention periods (A2) | State the two constants explicitly: anonymized billing records retained **10 years**, cancellation evidence **3 years**, then automatic purge. |
| Billing records after deletion | "Subscription mirror rows are deleted with the account; invoices remain with Stripe/PayPal/Apple as merchant of record." (`billing_subscriptions` and App Store transaction/status rows cascade-delete; the providers hold the legally relevant records independently.) |
| App Privacy nutrition labels (App Store Connect) | Declare **Purchases** (subscription status) and **Identifiers** (the account's Supabase user ID, sent as `appAccountToken`) as collected/linked. **Usage Data**: none, unless a native analytics SDK is added later (explicitly out of scope per constraints.md §3). |

## 9. Open items

- **Q3 (open with Nick):** trial anti-abuse fingerprint retention — keep hashed 3 years (default, `private.account_deletion_policy() = 'keep_hashed'`) vs. erase immediately. Needs a decision before the legal checklist (§8) can be finalized.
- **Q5 (open with Nick):** `profiles_backup_20260822` and `billing_subscriptions_backup_20260822` must be dropped or scrubbed in production before activation (§4.2 step 3) — these are manual backup tables outside the migration history and outside the deletion routine's reach.
- **Live Customer.io/PostHog deletion has never been exercised against real workspaces.** The `User Deleted` Customer.io event and the PostHog `persons/bulk_delete` call are implemented and unit-tested with fakes only. Run one real deletion against sandbox/test accounts in both systems before relying on this for GDPR-style requests. Note: PostHog anonymous distinct IDs that were **never merged into a person** (e.g. pre-login anonymous events) are not covered by `persons/bulk_delete` and will survive.
- **Stripe deleted-account detection relies on metadata.** The Stripe deleted-account guard (`src/lib/stripe/deleted-account.ts`) only fires when a `checkout.session.completed`/`async_payment_succeeded`/`customer.subscription.updated` event's `trial_enrollment_id` or `lead_id` metadata points at an already-anonymized row. A Stripe event without that metadata for a deleted account's residual checkout session would not be caught by this guard.
- **Purge retry note.** The retention purge deletes anonymized rows past `purge_after` per table in its own subtransaction; a row still referenced by another live account's data (e.g. a lead shared by email with an unrelated live user) is kept and reported as `stillReferenced`, not deleted — expected behavior, not a bug, but worth knowing when auditing purge completeness.
- **Registration/profile-completion responses lack `access`.** Every post-registration or missing-profile completion currently costs one extra bootstrap round trip (brief loading screen) because the completion response doesn't carry the new `access` field. If a future change adds `access` to those completion payloads, the client already handles it and skips the extra call — no client change required.
- **Paywall header photo is 900 px wide,** not the originally targeted ~1200 px (source asset `regal-scan-flasche.webp` is only 900 px). Acceptable for now; revisit if a higher-resolution source becomes available.

## Related documents

- Plan: [`plans/ios-paywall/plan.md`](../plans/ios-paywall/plan.md)
- Deletion classification and rulings: [`plans/ios-paywall/deletion-inventory.md`](../plans/ios-paywall/deletion-inventory.md)
- Flag-flip conventions (two-step Vercel env + redeploy): [`docs/freemium-flag-flip-runbook.md`](freemium-flag-flip-runbook.md)
- Native app build/test setup: [`ios/README.md`](../ios/README.md)
