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
