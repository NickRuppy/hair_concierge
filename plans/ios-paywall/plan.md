# iOS App Store paywall + in-app account deletion

Worktree `.worktrees/ios-paywall`, branch `codex/ios-paywall`, base `cf7f4604` (= `origin/main`, verified 2026-09-27).

## 1. Outcome and source context

The native iOS app (`ios/Chaarlie`, today a free scanner) gets a **hard paywall after registration** sold through **Apple In-App Purchase (StoreKit 2)**, and the **in-app account deletion** that App Review requires for apps with account creation. Everything was decided with Nick in the planning conversation of 2026-09-27 (decisions D1–D11 below).

Existing context this builds on:

- Native app state machine: `ios/Chaarlie/App/AppModel.swift` (`Admission`: signedOut/loading/ready/profileRequired/unavailable), switch in `ios/Chaarlie/App/ChaarlieApp.swift` `RootView`.
- Mobile API: `src/app/api/mobile/v1/**`, auth seam `requireMobileUser` in `src/lib/mobile/auth.ts`, bootstrap `src/app/api/mobile/v1/bootstrap/route.ts` + Swift `Bootstrap` in `ios/Chaarlie/Networking/MobileClient.swift`.
- Web paid access (Stripe/PayPal/manual/moderator): `resolvePaidAppAccess` in `src/lib/entitlements/access.ts` → `hasCurrentAppAccess` in `src/lib/billing/subscriptions.ts`.
- Rendered paywall evidence: `plans/ios-paywall/evidence/` (see §7).

## 2. Chosen direction

- **StoreKit 2 directly, no RevenueCat.** Account binding on every purchase via `.inAppPurchaseOptions { _ in [.appAccountToken(userId)] }` on `SubscriptionStoreView` (API verified in the iOS 26.5 SDK, `_StoreKit_SwiftUI`), completion via `.onInAppPurchaseCompletion`. One subscription group "Chaarlie Scanner" with two auto-renewable products; the yearly product carries a 1-week free introductory offer.
- **Separate Apple entitlement store.** Apple purchases live in a new service-only table `app_store_subscriptions`; the web never grants access from it (D6). Mobile scanner access = *active App Store subscription* **OR** *existing web paid access* (`resolvePaidAppAccess`).
- **Server is the source of truth.** The app posts Apple-signed transactions (JWS) to our backend right after purchase/restore; App Store Server Notifications V2 keep the row current (renewal, expiry, billing retry/grace, refund, revoke). Verification with Apple's official `@apple/app-store-server-library`.
- **Server-side enforcement.** Scan endpoints return `402 subscription_required` without access; the paywall is not only a client screen.
- **Paywall UI = Apple's `SubscriptionStoreView`** (compact-picker tiles) with a Chaarlie photo header and our own small legal footer (D8 evidence).
- **Account deletion = one flow, two steps** (Apple best practice): active App Store subscription → notice + Apple's manage-subscriptions sheet first; then confirmation → server deletion routine (real deletion, anonymized analytics archive, legally required billing records anonymized).
- **Rollout flag** `MOBILE_PAYWALL_ENABLED` (server, default off): off → bootstrap reports access `active` for everyone and no route gating, so the current pilot is unaffected until activation.

## 3. Scope and non-goals

In scope: iOS paywall + purchase/restore + Abo row in Profil + account deletion flow; backend transaction endpoint, Apple notification webhook, access resolver, route gating, bootstrap access field, deletion endpoint + DB routine; migrations; StoreKit configuration file for local testing; docs/runbook for App Store Connect setup.

Non-goals (unchanged): web billing/entitlements and every web page; web self-service account deletion UI (the server routine is reusable later); promo/offer codes, win-back offers, family sharing; any upgrade path from the App Store subscription to web features (D6); native analytics SDK; the web cookie-consent gap; App Store submission itself, production env values, App Store Connect configuration (Nick-owned, after Apple enrollment); anonymous quiz statistics at quiz-completion time for web quiz takers (possible later project).

## 4. Authoritative values

| Item | Value |
|---|---|
| Subscription group | reference name `Chaarlie Scanner` |
| Products | `de.chaarlie.scanner.monthly` (P1M, 4,99 €) · `de.chaarlie.scanner.yearly` (P1Y, 39,99 €, intro offer free P1W) |
| Group level | yearly = level 1, monthly = level 2 |
| Bundle ID | `de.chaarlie.app` (Release; Debug `de.chaarlie.scanner.local`, HostedPilot `de.chaarlie.scanner.pilot`) — D13 |
| Storefronts | DEU, AUT, CHE, LIE (Apple auto-converts local prices) |
| Purchase binding | `Product.PurchaseOption.appAccountToken(<Supabase user UUID>)` |
| Transaction endpoint | `POST /api/mobile/v1/app-store/transactions` body `{ signedTransactions: string[] }` (1–20 JWS, each ≤ 16 KB) |
| Notification webhook | `POST /api/app-store/notifications` body `{ signedPayload }` (outside the mobile policy gate) |
| Bootstrap addition | `access: { status: "active" \| "none", source: "app_store" \| "web" \| "open" \| null, appStore: { productId, expiresAt, willRenew, inBillingRetry } \| null }` |
| Gated error | HTTP 402 `{ error: "subscription_required" }` |
| Delete endpoint | `POST /api/mobile/v1/account/delete` body `{ requestId: UUID, confirm: "delete" }` → `{ status: "deleted" }` |
| Server env | `MOBILE_PAYWALL_ENABLED`, `APP_STORE_BUNDLE_ID`, `APP_STORE_APP_APPLE_ID`, `APP_STORE_ENVIRONMENTS` (allowed: `Production`, `Sandbox`; `Xcode` only when `MOBILE_AUTH_MODE=local`), `APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`, `APP_STORE_PRIVATE_KEY` (Server API, reconciliation only) |

Bundle ID and product IDs are confirmed (D13) and are created in App Store Connect after Apple enrollment; product IDs are permanent once created there.

## 5. Decision coverage

Decision coverage: **confirmed**

Confirmed with Nick (2026-09-27; A1–A3 + journey confirmed in the same conversation: "A1–A3 okay, journey is fine, go ahead"):
- D1 Hard paywall directly after registration, before the scanner; without access the user only sees the paywall (also after lapse).
- D2 App-only, scanner-only subscription, cheaper than web.
- D3 4,99 €/Monat, 39,99 €/Jahr.
- D4 7-day (1-week) free trial on yearly only; monthly charged immediately.
- D6 App Store subscription is separate: unlocks only the app; paid web users get the app included; no path from Apple sub to web features; web may later *read* the Apple row for display, never grant from it.
- D7 Storefronts DE/AT/CH/LI with Apple price auto-conversion.
- D8 Paywall = `SubscriptionStoreView` compact tiles + scanner-funnel photo header (`regal-scan-flasche`), headline "Sofort wissen, ob es passt." + "Jedes Produkt, geprüft für dein Haar.", action-only CTA, footer "Wiederherstellen · AGB · Datenschutz"; Apple's price-disclosure line stays.
- D9 In-app account deletion is part of this project; flow per Apple best practice (subscription notice + manage sheet, then confirmation).
- D10 Deletion = real deletion; before deleting keep an anonymous quiz-answer copy (answers + month + channel only), keep scan events and product submissions with identifiers stripped, anonymize legally required billing/cancellation records (purge after retention), delete leads/funnel remnants, delete person in Customer.io and PostHog.
- D11 Seller = Haarmony LLC (US), Apple org enrollment pending.
- D12 (after counterpart review PW-06) Deletion is fully automatic for every account. Parent rows that other tables depend on (leads, funnel sessions, trial enrollments, retained billing/cancellation records) are **anonymized in place instead of deleted**, so no FK chain is rerouted. Every retained row of the deleted person is tagged with one fresh random **anonymous subject ID** (stored nowhere else; never the old user ID, which survives in Stripe/Apple/backups), so kept data stays grouped as one anonymous profile.
- D13 (2026-09-28) Follow-up rulings:
  - **Q3** hashed trial anti-abuse fingerprints are kept 3 years; the default stays `keep_hashed` behind `private.account_deletion_policy()`.
  - **Q5** the production backup tables `profiles_backup_20260822` and `billing_subscriptions_backup_20260822` are kept; Nick accepts the edge case that they still hold emails of later-deleted accounts (documented exception, not a pre-activation drop).
  - Billing Grace Period **16 days** (App Store Connect setting).
  - Final bundle ID `de.chaarlie.app` (Release configuration); product IDs `de.chaarlie.scanner.monthly` / `de.chaarlie.scanner.yearly`.
  - Paywall tiles (supersedes D8's compact picker and Apple's disclosure line): two custom tiles, yearly preselected; the billed amount ("39,99 €/Jahr", "4,99 €/Monat") is the most prominent price, the monthly equivalent ("nur 3,33 €/Monat"), the savings badge ("−33 %") and the trial line ("1 Woche kostenlos") are visibly subordinate (Guideline 3.1.2); our own renewal disclosure for the selected plan sits above the CTA ("Kostenlos testen" with an active free trial, else "Abonnieren").
  - A dedicated App Store compliance check against the App Review Guidelines is a required step before the first submission.
- D14 (2026-09-28, supersedes A1) Deleting the account in the app cancels an active **web** subscription (Stripe/PayPal) immediately **and refunds the unused, prepaid time pro rata** to the original payment method: unused = last paid amount × (period end − cancellation) / (period end − period start), rounded down to cents; trial without a paid charge, a period already over or an already refunded payment → cancel only. Idempotent per deletion request + subscription; a refund failure never blocks the deletion (recorded, retried by the reconcile cron, Sentry from the 5th failure). App Store subscriptions: unchanged, no refund from us (Apple only). Web AGB unchanged (they already promise the pro-rata refund of prepaid fees). Follow-up rulings (controller, 2026-09-28): **R-a** a web subscription that goes live only after its account was deleted (checkout in flight) is cancelled and **all its payments refunded in full** (the customer never had access); it shares the refund key (provider + subscription) with the deletion path so a subscription is never paid out twice. **R-b** refund rows are purged 10 years after settlement (A2 billing retention). Refunds never block the app response (first attempt after the response, then the hourly cron); 10 failed attempts or a permanent provider error end in manual review (one Sentry report). Copy: deletion confirmation "Dein Chaarlie-Abo endet sofort. Nicht genutzte Zeit erstatten wir anteilig."; onboarding start "10 Fragen · ca. 2 Minuten", registration button "Konto erstellen" with legal line "Mit „Konto erstellen“ erstellst du dein Konto und akzeptierst unsere AGB. …".

Inherited from evidence or contract:
- Apple Guideline 3.1.1 (digital subscriptions via IAP), 3.1.2 (price/term disclosure, restore), 5.1.1(v) (account deletion; deletion does not cancel Apple subscriptions — inform + link to manage).
- Web access semantics from `resolvePaidAppAccess` (unchanged).
- ~50 user tables cascade from `profiles`/`auth.users`; RESTRICT tables and SET NULL tables per live FK query of 2026-09-27 (§8 T6).
- German UI copy, idiomatic (memory: feedback-german-copy-idiomatic).

Implementation defaults (no product consequence):
- `@apple/app-store-server-library` for JWS verification/decoding; Apple root CA certs committed under `src/lib/app-store/certs/`.
- Entitlement is derived from **transaction-level** rows plus per-subscription renewal status: access = some non-revoked transaction with `purchaseDate <= now < expiresDate`, OR renewal status `in_billing_retry` with `gracePeriodExpiresDate > now`. No extra clock tolerance. `REFUND`/`REVOKE` revoke only the named transaction; `REFUND_REVERSED` clears it; older `signedDate` never overwrites newer state.
- Transactions without our `appAccountToken` stored unbound; bound when the owning app posts them.
- Paywall photo shipped as bundled JPEG (~1200 px) in `ios/Chaarlie/Resources/`.
- Rate limits via existing `mobileRateLimit`.

- A1 ~~A *web* subscriber who deletes the account in the app has the web subscription cancelled immediately, no prorated refund; the confirmation screen says so.~~ Superseded by D14 (pro-rata refund).
- A2 Anonymized billing records retained 10 years, cancellation evidence 3 years, then automatic purge (one constant; legal may adjust).
- A3 One App Store subscription belongs to one Chaarlie account; restore on another account → "Dieses Abo gehört zu einem anderen Chaarlie-Konto."
- Designed journey §6 signed off.

Open consequential assumptions: none.

Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: Nick's request 2026-09-27 ("add a paywall … align on plan and decisions, then implement") and rulings D1–D11 in that conversation.
Internal revalidation: plan Rev. 2 against `cf7f4604` after Codex plan review (ledger §11); D12 confirmed by Nick; live FK/column queries 2026-09-27.

## 6. Designed user journey

**New user (primary):** quiz → registration → code verify → profile publish → *(new)* paywall (full screen, no close button) → tiles: "Jährlich · 39,99 €/Jahr · 1 Woche kostenlos" (preselected) / "Monatlich · 4,99 €/Monat" → CTA "Kostenlos testen" (yearly, trial-eligible) or "Abonnieren" → Apple purchase sheet (Face ID) → app posts transaction → server confirms → scanner tab.
- Cancel in Apple sheet → back on paywall, nothing changes.
- Purchase `pending` (Ask to Buy / SCA) → paywall shows "Kauf wird bestätigt …" and unlocks on `Transaction.updates`.
- Server unreachable after successful purchase → StoreKit keeps the transaction unfinished; app retries post on next launch/foreground; paywall shows "Kauf erfolgreich – Freischaltung läuft …" with retry; never a second charge.
- Trial ineligible Apple ID → Apple renders plain price, CTA "Abonnieren" (automatic).

**Returning user:** bootstrap → `access.status` active → scanner; `none` → paywall. Lapse/refund → next bootstrap or next scan request (402) → paywall; profile and history retained and visible again after resubscribing.

**Paid web user:** bootstrap `source: "web"` → scanner, never sees paywall.

**Restore:** footer "Wiederherstellen" → `AppStore.sync()` → post current entitlements → unlocked, or message "Kein aktives Abo gefunden." / "Dieses Abo gehört zu einem anderen Chaarlie-Konto."

**Profil → Abo row:** "Chaarlie Scanner · Jährlich · verlängert sich am 27.09.2027" (or "läuft am … ab" / "Zahlungsproblem – bitte in den Apple-Einstellungen prüfen") → "Abo verwalten" opens Apple's manage-subscriptions sheet. Web users: "Über dein Chaarlie-Konto aktiv". 

**Konto löschen (Profil, bottom):**
1. If an App Store subscription is active & renewing: sheet "Dein Abo läuft über Apple und wird nicht automatisch gekündigt." → [Abo kündigen] (Apple sheet) / [Trotzdem fortfahren].
2. Confirmation "Konto endgültig löschen?" — lists: Haarprofil, Scan-Verlauf, Merkliste werden gelöscht; "Zahlungsbelege bewahren wir aus gesetzlichen Gründen anonymisiert auf."; web subscriber variant adds "Dein Chaarlie-Abo endet sofort. Nicht genutzte Zeit erstatten wir anteilig." (D14) → destructive [Konto löschen].
3. Progress → success → local session/keychain/drafts wiped → signed-out entry screen with a one-line notice "Dein Konto wurde gelöscht."
- Failure → "Löschen hat nicht geklappt. Bitte versuche es erneut." (idempotent via `requestId`).

## 7. Planning evidence

Real renders from the iPhone 17 Pro simulator (iOS 26.5) with a local StoreKit configuration, produced in a throwaway spike (scratchpad; code discarded):
- `evidence/variant-1-apple-default.jpg` … `variant-4-compact-tiles.jpg` — question: which SubscriptionStoreView style; Nick chose compact tiles (variant 4) and asked for less copy, legal links at the bottom, no restating CTA, a visual.
- `evidence/paywall-final-A-photo.jpg` — selected direction (D8). `evidence/paywall-rejected-B-reticle.jpg` — rejected (example verdict claim).
- Spike findings: `SKTestSession` from `xcodebuild test` fails (`SKInternalErrorDomain Code=3`) — StoreKit UI evidence must be produced by launching from Xcode (AppleScript `run workspace document`), then `simctl io screenshot`. In-app `drawHierarchy` snapshots mis-render iOS 26 glass; use simulator screenshots. iOS 26 scroll-edge effect blurs tiles when a bottom `safeAreaInset` is added → `scrollEdgeEffectHidden(true, for: .all)` (guarded `#available(iOS 26)`).
Evidence review status: approved by Nick in conversation (A chosen, copy corrected).

## 8. Ordered tasks

### Task 1 — App Store entitlement store + verification core (server).
Migration (CLI-generated): `app_store_transactions` (`transaction_id text pk`, `original_transaction_id text`, `user_id uuid null references profiles on delete cascade`, `app_account_token uuid null`, `product_id`, `environment check in ('Production','Sandbox','Xcode')`, `purchase_date`, `expires_date`, `offer_type`/`is_trial`, `revocation_date`, `revocation_reason`, `signed_date`) and `app_store_subscription_status` (`original_transaction_id text pk`, `user_id`, `auto_renew_status bool`, `auto_renew_product_id`, `in_billing_retry bool`, `grace_period_expires_date`, `expiration_intent int`, `signed_date`, `last_notification_type`); both RLS enabled, no policies, revoked from anon/authenticated. `src/lib/app-store/verify.ts` (SignedDataVerifier per allowed env, bundle ID + app Apple ID checks; `Xcode` env only in local mode), `src/lib/app-store/state.ts` (pure: decoded transaction/renewal → row snapshot; newer-wins merge; `hasActiveAppStoreAccess(row, now)`), `src/lib/app-store/store.ts` (upsert with newer-wins guard).
Tests: `tests/app-store-state.test.ts` (rule fixtures S1 active, S2 expired, S3 billing retry + grace active, S4 billing retry without grace → none, S5 refund of the current period → none, S6 refund of an *older* period → still active, S7 REFUND_REVERSED restores, S8 older signedDate ignored / out-of-order renewal, S9 trial flag, S10 env mismatch rejected, S11 exactly at expiresDate → none), `tests/app-store-verify.test.ts` (fixture JWS: foreign bundle, wrong env, Xcode env outside local mode rejected).
Done: tests green; migration applies locally.

### Task 2 — Mobile access resolver + bootstrap + route gating (server).
`requireMobileUser` (and the registered-session path in `registration-auth.ts`) additionally return the verified identity `email` (lower-cased, from the provider user already loaded in `verifiedIdentity`). `src/lib/mobile/access.ts` `resolveMobileAccess(client, userId, email, now)` → `{status, source, appStore}`: flag off → `open`; App Store active → `app_store`; else `resolvePaidAppAccess(userId, email, /* fieldTestGuest */ false, { client })` — mobile sessions are real accounts, never web field-test guest cookies — `allowed` → `web`, `denied` → `none`, `unavailable` → 503 (fail closed). Bootstrap adds `access` (contract + `bootstrapSchema` in `src/lib/mobile/contracts.ts`). Gate `scan/resolve`, `scan/search`, `scan/submit`, `scan/history` (+`[entryId]`), `scan/research-result/[submissionId]` with 402 `subscription_required` before any service work; profile/auth/registration/push/delete untouched.
Consumes T1. Produces bootstrap `access` DTO (§4).
Tests: `tests/mobile-access.test.ts` (flag off/app store/web/none/unavailable→503 fail-closed, email-keyed manual grant counts as web, moderator active counts, email plumbing from both session kinds), route tests asserting 402 before service calls, bootstrap wire fixture `tests/fixtures/mobile/bootstrap-v2.json` (copied byte-identical to `ios/ChaarlieTests/Fixtures/`).

### Task 3 — Transaction endpoint + notification webhook (server).
`POST /api/mobile/v1/app-store/transactions`: authenticated; verify each JWS; require `appAccountToken == userId` (else `409 owned_by_other_account` when bound to someone else, bind when token absent and row unbound); upsert; return current `access`. `POST /api/app-store/notifications`: verify `signedPayload`, decode transaction + renewal info, upsert (bind via appAccountToken when present), always 200 after durable handling, 4xx on invalid signature; test notification type acknowledged. Optional reconciliation helper using App Store Server API `getAllSubscriptionStatuses` (used by T8 runbook, not scheduled yet).
Consumes T1. Tests: `tests/app-store-transactions-route.test.ts`, `tests/app-store-notifications-route.test.ts` (SUBSCRIBED, DID_RENEW, DID_FAIL_TO_RENEW with/without grace, EXPIRED, REFUND, REVOKE, replay idempotency, out-of-order).

### Task 4 — Native purchase core + paywall screen (iOS).
`ios/Chaarlie/Paywall/StoreService.swift` (protocol-backed: products load, purchase with appAccountToken, `Transaction.updates` listener started at app launch, `currentEntitlements` post, finish only after server ack), `PaywallView.swift` (D8 layout: `SubscriptionStoreView(groupID:)` compact picker, `.subscriptionStoreButtonLabel(.action)`, Apple policies/restore hidden, custom footer, photo header, off-white background, scroll-edge fix), `AppModel.Admission.paywall`, bootstrap/registration completion route `access.status == none` → `.paywall`; `MobileClient.raw` maps HTTP 402 `subscription_required` to a new `MobileError.subscriptionRequired` (today 402 falls through to `.unavailable`, `MobileClient.swift:354–374`), and every gated call site (resolve/search/submit/history/research result) routes it to `.paywall` under the existing session-epoch/generation guard so a stale 402 cannot affect a later account. Purchase binding via `.inAppPurchaseOptions` with the current session's user UUID; purchases are blocked while no session is installed. `MobileClient` adds transactions POST + `Bootstrap.access` decoding (optional for old servers → treated as `open`). StoreKit config `ios/Chaarlie/Resources/Chaarlie.storekit` (products per §4) referenced in the Debug scheme Run action. Photo resource added to the project. German copy exactly per §6.
Consumes T2/T3 DTOs. Tests: `ChaarlieTests/PaywallRoutingTests.swift` (bootstrap none→paywall, active→ready, 402→paywall per gated call, stale 402 after account switch ignored, purchase options carry the logged-in UUID, stale response after logout ignored, purchase success but post failure keeps transaction unfinished and retries), bootstrap fixture decode. Manual: Xcode-run StoreKit purchase/cancel/restore/refund (Transaction Manager) screenshots.

### Task 5 — Profil Abo row (iOS).
Row per §6 using bootstrap `access.appStore`; `manageSubscriptionsSheet`; web source text. Tests: presentation mapping (renewing, expiring, billing retry, web). Manual screenshot.

### Task 6 — Account deletion routine (DB + server).
Inventory first (part of this task, committed as `plans/ios-paywall/deletion-inventory.md`): every table reachable from `auth.users`/`profiles`/`leads`/`funnel_sessions`/`trial_enrollments`/`billing_one_time_purchases`/`product_submissions` via FK, plus tables keyed by email without FK (e.g. `paypal_checkout_intents`, `paypal_order_intents`, `discovery_enrollments`, `partner_access_invitations`, Customer.io outbox tables), each classified **cascade-delete** / **anonymize-in-place** (list the exact PII columns: email, name, payer/address fields, free text, JSON metadata keys, photo paths, IP/device IDs) / **no PII**. Live FK + column queries of 2026-09-27 are the starting point; a test enumerates FKs from the migrated schema and fails when a new FK into these tables is not classified.
Migrations (CLI): (a) `anonymous_quiz_answer_archive` (`id`, `anonymous_subject_id uuid`, `answers jsonb` whitelisted quiz keys only, `answered_month date`, `channel text check in ('app','web')`), service-only; (b) `anonymous_subject_id uuid` + `anonymized_at` + `purge_after` columns on every anonymize-in-place table; where the user FK is `NOT NULL` + RESTRICT toward `profiles`/`auth.users` (e.g. `private.trial_cancellation_declarations`, `private.trial_cancellation_receipts`, `product_submissions`), make it nullable and `on delete set null` — no other FK behavior changes; (c) `account_deletion_operations` (`request_id uuid pk`, `user_id_hash text` (HMAC, no FK), `state` in `requested → web_billing_cancelled → data_deleted → external_cleanup_done`, `external_attempts int`, timestamps); (d) RPC `private.delete_account(p_user_id uuid, p_request_id uuid)` in one transaction: generate subject ID → archive quiz answers from the hair profile → tag + strip scan events and submissions (user link null; redact per inventory; collect photo paths) → anonymize-in-place leads/funnel sessions/trial enrollments/billing/cancellation/PayPal rows (null user link, clear PII columns, set `purge_after` per A2) → delete `auth.users` (cascade) → set operation `data_deleted`. Replay of the same `request_id` returns the recorded state. (e) Purge job: rows past `purge_after` deleted by the existing cron runner.
`src/lib/account-deletion/service.ts`: state machine over `account_deletion_operations`: cancel active web subscription immediately (Stripe/PayPal via existing billing clients — A1; failure → stay `requested`, return error, retry safe) → RPC → delete submission photos from storage → Customer.io person delete + PostHog person-and-events delete; failures leave `data_deleted` and the cron runner retries until `external_cleanup_done` (Sentry after N attempts).
Tests: `tests/account-deletion-postgres.test.ts` (disposable PostgreSQL seeded with an app-only user AND a web user with trial, cancellation, one-time purchase, PayPal intent, lead, funnel session: afterwards no row anywhere contains the user's id, email or name — checked by a full-schema text scan —, cascaded tables empty, retained rows share one subject ID, `purge_after` set, other users untouched, FK-classification guard, replay = no-op), `tests/account-deletion-service.test.ts` (web cancel failure keeps account + state `requested`; external failure keeps `data_deleted` and is retried; response loss → status lookup reports completion).

### Task 7 — Delete endpoint + native deletion flow (server + iOS).
`POST /api/mobile/v1/account/delete` (authenticated, rate-limited, idempotent `requestId`, confirm literal) → T6 service; `GET /api/mobile/v1/account/delete/{requestId}` (unauthenticated, requestId is a client-generated UUID, returns only `{state}`) so a client whose response was lost after deletion can confirm completion instead of hitting 401. iOS: Profil "Konto löschen" → steps per §6 (subscription notice only when App Store sub active & renewing, via bootstrap data), destructive confirm, then local wipe (Keychain session/attempt, installation ID rotation, drafts, scan/profile caches) → signed-out with notice. StoreKit listener detaches on logout/deletion.
Tests: route test (auth, idempotency, 503 on failure), `ChaarlieTests/AccountDeletionTests.swift` (notice shown only with renewing App Store sub, local wipe after success, failure keeps session, late response after logout ignored).

### Task 8 — Docs, runbook, activation checklist.
`docs/ios-app-store-subscriptions.md`: App Store Connect setup (group, products, prices, intro offer, storefronts, Small Business Program, Paid Apps Agreement + US tax forms for Haarmony LLC, App Store Server Notifications V2 URL for Production + Sandbox, API key for Server API), env values, sandbox tester + TestFlight test script, activation/rollback via `MOBILE_PAYWALL_ENABLED`, legal checklist (AGB/Datenschutz name Haarmony LLC; privacy policy sentence on anonymized statistics; retention periods A2; anonymous subject ID re-identification note), App Privacy labels (purchases, identifiers). Update `ios/README.md`.

## 9. Verification

Automated: `npm run ci:verify`; focused `npm run test:node` suites above (npm scripts, server-only shim); disposable-Postgres deletion test; Swift unit tests via signed-simulator `xcodebuild test` (README command); HostedPilot + Debug builds.
Manual (simulator, Xcode-launched StoreKit config): new user → paywall → yearly trial purchase → scanner; cancel sheet; monthly purchase; restore on reinstall; Transaction Manager refund → paywall on next bootstrap; expire → paywall; Ask-to-Buy pending; web-paid synthetic account skips paywall; delete account with active App Store sub (notice + sheet) and without; screenshots of paywall, Abo row, deletion steps.
Migration/live-state: migrations applied only to local stack in this project; production apply is a separate authorized step (CLI `db push` per repo rule). Deletion routine never run against production data in this project.
Sandbox/TestFlight purchase with a real Apple sandbox account: blocked on Apple enrollment (D11) — listed in runbook, not a merge gate.

## 10. Review and handoff

Worktree/branch as above. Gates: per-task review, `ready-check`, one Codex whole-branch review (read-only), then `/ship` on Nick's explicit request; merge on "merge it". Flag stays off after merge. Rollout risks: webhook reachable only after deploy; wrong App Store env config → fail-closed (no access granted, paywall shown) — mitigated by flag and runbook order (configure → deploy → sandbox test → flip flag). Artifacts: `plans/ios-paywall/plan.md` + `evidence/*.jpg` commit; scratchpad spike discard.

## 11. Counterpart review ledger (Codex plan review, 2026-09-27, Rev. 1)

| ID | Type | Evidence | Decision | Plan change | Revalidation |
|---|---|---|---|---|---|
| PW-01 | defect (claimed) | `SubscriptionStoreView` has no purchase options | rejected as blocker, accepted as clarification | `.inAppPurchaseOptions` exists (`_StoreKit_SwiftUI` iOS 26.5 SDK swiftinterface l.533); now explicit in §2/T4 + test | SDK grep |
| PW-02 | defect | one-row-per-original-transaction revocation | accepted | T1 transaction-level rows + renewal status; S5–S8 fixtures | Apple NotificationType docs (REFUND, REFUND_REVERSED) |
| PW-03 | defect | +1h tolerance extends paid access | accepted | tolerance removed; S11 fixture | — |
| PW-04 | defect | 402 falls to `.unavailable` in `MobileClient.raw` | accepted | T4 `MobileError.subscriptionRequired` + generation guard | `MobileClient.swift:354–374` |
| PW-05 | defect | `requireMobileUser` drops email; resolver needs 4 args | accepted | T2 email plumbing, `fieldTestGuest=false` | `auth.ts:179–192`, `access.ts:109–114` |
| PW-06 | defect | RESTRICT dependents on leads/funnel_sessions | accepted, larger than reported | ~40 RESTRICT dependents (web billing/trial history only) → Nick ruled D12: anonymize parents in place + anonymous subject ID; T6 inventory + FK-classification guard test | FK query 2026-09-27 |
| PW-07 | defect | retained submissions/PayPal intents still hold PII | accepted | T6 per-column redaction + PayPal intents in inventory | column query |
| PW-08 | tradeoff | no durable cross-system deletion sequence | accepted | T6/T7 durable `account_deletion_operations` + status lookup by requestId + retried external cleanup | `auth.ts:179–192` |
| PW-09 | scope | coverage "confirmed" with open A1–A3 | rejected (stale) | A1–A3 confirmed by Nick before review finished; A2 legal check stays in T8 runbook | plan §5 |
