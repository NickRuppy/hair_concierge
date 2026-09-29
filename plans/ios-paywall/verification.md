# iOS paywall + account deletion — verification receipt

- Branch `codex/ios-paywall`, base `cf7f4604` (= origin/main at start, re-fetched before review), verified head `cb4ed3bd`.
- Canonical content fingerprint (SHA-256 of sorted `path sha256` manifest of the 112 paths changed vs base, receipt excluded): `4c21ff0da7eb423a2c74ed6dc58adc67c7c748c55c98333f0e300925eee3aeb2`.
- Decision coverage: **confirmed**. Coverage acknowledgement: Nick 2026-09-27 (D1–D12, A1–A3, journey §6: "A1–A3 okay, journey is fine, go ahead"; D12 "I think that sounds better … unique but anonymous profile"). Internal revalidation: plan Rev. 2 + implementation rulings (SDD ledger) against `cb4ed3bd`; no new consequential choice except the two open items below.
- Open with Nick (do not block merge; block activation): **Q3** trial anti-abuse hashed fingerprints — default `keep_hashed` 3 years behind `private.account_deletion_policy()`; **Q5** production-only `profiles_backup_20260822` (+ `billing_subscriptions_backup_20260822`) hold emails — drop/scrub before activation.

## Commands and results (on `cb4ed3bd`)

| Check | Result |
|---|---|
| `npm run ci:verify` (typecheck, lint, build) | pass — 0 errors, 5 pre-existing warnings in untouched files |
| `npm run test:node` | 9424 tests, 9409 pass, 0 fail, 15 skipped |
| `ACCOUNT_DELETION_POSTGRES_TEST=1 … tests/account-deletion-postgres.test.ts` (full migration replay, Docker) | pass (Task 6 rounds 1–2; full-schema PII scan clean) |
| `APP_STORE_POSTGRES_TEST=1 … tests/app-store-store-postgres.test.ts` | pass (Task 1/3) |
| iOS Debug + HostedPilot simulator builds | pass |
| ChaarlieTests (signed simulator, iPhone 17 Pro / iOS 26.5) | 191 run, 0 failures, 2 opt-in skips |
| ChaarlieUITests branch vs main | identical on both: 60 run, 4 failures in `testAssessmentTableExplanationAlternativesAndDismiss` and `testRefinementUnsavedNoticeKeepsManualAndCompactActionsReachable` → pre-existing, not caused by this branch |

## Manual / simulator evidence

- Xcode-launched run with committed `Chaarlie.storekit` (design scenario `paywall`): products load; Apple sheet shows "1-week free trial … 39,99 € per year"; purchase succeeds (`Environment: Xcode`); without a server the app shows "Kauf erfolgreich – Freischaltung läuft …" + "Erneut versuchen". Found two layout defects (status rows squeezing Apple's controls; headline clipping at AX-XL) → fixed in the final fix wave, see `evidence/fixwave-status-state.jpg`, `evidence/fixwave-ax-xl.jpg`.
- Screens: `evidence/task4-paywall-fixture.jpg` (paywall, matches approved `paywall-final-A-photo.jpg` + account row), `evidence/task5-profil-abo.jpg`, `evidence/task7-delete-notice.jpg`, `evidence/task7-delete-confirm.jpg`.

## Reviews

- Per-task spec+quality review with scoped re-reviews for Tasks 1–8 (fix rounds: T1 1, T3 1, T4 1, T6 2).
- Codex whole-branch review (read-only) on fingerprint `ba206a7b…`: 1 Important (APP-1 product allowlist) → fixed in `84bd0eec`, re-reviewed. Lean rule: no second Codex pass (small, re-reviewed fix).

## Artifacts

- Commit: `plans/ios-paywall/{plan.md,deletion-inventory.md,verification.md}`, `plans/ios-paywall/evidence/*.jpg`, `docs/ios-app-store-subscriptions.md`.
- Discard: `ios/Chaarlie.xcodeproj/project.xcworkspace/` (untracked Xcode user state from the manual run; never committed), scratchpad spike, `.superpowers/sdd/plan/` (gitignored SDD workspace).

## Skipped / residual risk

- No real Apple sandbox/TestFlight purchase (blocked on Apple org enrollment) and no end-to-end run against a local backend with server-side verification of an Xcode-environment JWS — covered by unit/route tests with a local CA chain; runbook §6 lists the sandbox script.
- Customer.io / PostHog deletion calls never exercised against live services; PostHog anonymous distinct ids never merged to the user survive.
- Migrations not applied anywhere but disposable Postgres; production apply needs a quiet window and a Supabase-branch check of hosted GoTrue privileges (runbook §4).
- Stripe deleted-account detection relies on `lead_id`/`trial_enrollment_id` metadata.
- Deferred minors (ledger): product IDs duplicated in server allowlist and `SubscriptionRow.swift`; completion responses lack `access` (extra bootstrap); source photo 900 px; opt-in Postgres tests not in CI.

## Addendum 2026-09-28 — Nick's follow-up rulings and custom plan tiles

- **Open with Nick → resolved (D13 in plan §5):** Q3 keep hashed trial fingerprints 3 years (default `keep_hashed` unchanged); Q5 production backup tables `profiles_backup_20260822` / `billing_subscriptions_backup_20260822` kept as a documented, accepted exception. No remaining open item blocks activation from Nick's side; the activation order now includes a dedicated App Store compliance check against the App Review Guidelines before the first submission (runbook §7).
- Further D13 rulings: Billing Grace Period 16 days; bundle ID `de.chaarlie.app` (Release configuration of the app target only — Debug, HostedPilot and the test targets are unchanged); product IDs `de.chaarlie.scanner.monthly` / `.yearly`.
- **Plan tiles (D13, supersedes D8's compact picker):** custom `SubscriptionStoreControlStyle` pinned to the store's bottom bar; purchase via `Option.subscribe()` inside `SubscriptionStoreView`, so `.inAppPurchaseOptions` and the start/completion handlers are unchanged. Copy lives in `PaywallPricing` (unit-tested).
- Checks on the tiles tree: iOS Debug + HostedPilot simulator builds pass; ChaarlieTests (signed simulator, iPhone 17 Pro / iOS 26.5): 205 run, 0 failures, 2 opt-in skips (191 before + 14 `PaywallPricingTests`).
- Evidence (Xcode-launched Debug build with `Chaarlie.storekit`, real local session at the paywall): `evidence/tiles-yearly-selected.jpg` (trial eligible: "Kostenlos testen"), `evidence/tiles-monthly-selected.jpg` ("Abonnieren", monthly disclosure), `evidence/tiles-ax-xl.jpg` (accessibility-extra-large: tiles stack, the store moves the controls into the scroll view; left unscrolled, right scrolled). Tapping the CTA opens Apple's purchase sheet for the selected product (cancelled, no transaction); the selection survives the cancel.
- Not re-run: a completed purchase through the new CTA (kept Nick's Xcode StoreKit transaction store untouched); UI tests; the paywall status-row scenarios with the taller tile block.

## Addendum 2026-09-28 (2) — D14 refund, renewal-info fix, main sync, re-review

- Head verified: `416a1984` (plus this receipt and one evidence image). Branch synced with `origin/main` `f865a897` (#618); the auto-merge placed the D14 deleted-account refund check inside #618's new billing-row helper, fixed in `18b19c95` with a sale-only deletion-refund test.
- Checks on `416a1984` (CI placeholder env, as `.github/workflows/ci.yml`): `npm run ci:verify` pass (0 errors, 5 pre-existing warnings); `npm run test:node` 9479 tests, 9464 pass, 0 fail, 15 skipped. Account-deletion Postgres replay (opt-in) passed on the refund-fix round. ChaarlieTests 221 run, 0 failures on the renewal fix round.
- Reviews: per-round spec/quality reviews (refund rounds 1–2, renewal fix); Codex whole-branch re-review of everything since `84bd0eec` → 4 findings (PayPal-Request-Id length, Stripe refund settled before success / no `refund.failed`, PayPal 1-day lookback, partial foreign refund) fixed in `416a1984`; scoped Codex check → 1 residual (pending foreign Stripe refund counted) fixed and test-pinned in the same commit. Lean rule: no further pass.
- Manual (local isolated stack, Xcode-launched Debug build with `Chaarlie.storekit`): synthetic account signed in → paywall (price-first tiles, trial correctly unavailable for a used Xcode trial) → Restore claimed the deleted account's active Xcode subscription → `app_store_subscription_status` row written from the app path (`auto_renew_status = true`) → Profil shows "verlängert sich am 05.10.2026" → Konto löschen shows the Apple notice (`evidence/renewal-apple-notice.jpg`) → confirm → "Dein Konto wurde gelöscht.", auth user removed, operation `data_deleted`.
- Local-only: migration `20260928083245` applied to the isolated stack; not applied anywhere else.
- Not covered: real Stripe/PayPal refunds (sandbox after Apple enrollment; PayPal refund endpoint still inferred); Stripe webhook must subscribe to `refund.failed` at activation (runbook §3).

## Addendum 2026-09-29 — deploy-before-migrations kill switch

- Merge blocker found before merge: the live Stripe webhook's deleted-account check selected `anonymized_at` (column added by this branch's migrations) → would have broken checkout activation if merged before `db push`; the reconcile cron would fail hourly. Fixed in `e67776ae`: `ACCOUNT_DELETION_ENABLED` (default off) gates the Stripe check, cron, mobile deletion endpoints, App Store transaction route, Apple notification route and the PayPal deletion-refund RPC lookup. With the flag off, production behaves as on main.
- Checks (agent run, verified by controller diff review): typecheck clean, lint 0 errors; full `npm run test:node` 9661 tests, 9646 pass, 0 fail; new kill-switch tests plus a Stripe regression (flag off, lead-bound `checkout.session.completed` activates with no `anonymized_at`/RPC query).
- Activation order (runbook §7): deploy with both flags off → `db push` (7 migrations, `--include-all` if #619's migration is already applied) → `ACCOUNT_DELETION_ENABLED=true` → sandbox tests → compliance check → `MOBILE_PAYWALL_ENABLED=true`. Local stacks with the migrations need `ACCOUNT_DELETION_ENABLED=true` to exercise deletion.
