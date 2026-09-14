# B1–B4 verification receipt

2026-09-12. **Ready for review of the approved local development milestone.** No commit, push, PR, deployment, production migration or production write was performed.

Branch: `codex/ios-connected-scanner`. Base: `469d41f5e81f44702c94829c0ed312e732b01172`. Worktree: `/Users/nick/.codex/worktrees/a475/hair_conscierge`.

Canonical content fingerprint: `811ce8962c8ed1d9f0d017b58d6aa928ecf41c5d509b3f9a0153ea9ce1897353`. This is SHA256 of the sorted manifest of231 changed/task-owned untracked paths, each represented as `content-sha256 path` plus newline. Deletions would use `DELETED`. The two administrative receipts are excluded to avoid self-reference; all implementation, tests, operator scripts, approved plans and retained screenshots are included. Staging identical bytes does not change the identity.

## Coverage acknowledgement

Decision coverage remains **confirmed** for parent implementation-plan revision9 / first-build-plan revision5. Nick's2026-09-12 connected-walkthrough acknowledgement plus the earlier purchase-only result approval cover this handoff. Confirmed choices, inherited authority/source contracts and implementation defaults are in [first-build-plan.md](first-build-plan.md). The final implementation retains existing-account admission, full native alternatives, web freemium flag-off isolation, read-only Profile and the approved recovery journey. Undiscussed consequential assumptions affecting this handoff: none. Co-founder/policy, onboarding/editing/research/deletion and public-release work remain explicitly outside this development slice.

## Observed outcomes

| Outcome | Fresh evidence |
|---|---|
| Existing-account auth without signup | Real local Auth: unknown address creates no account; expired attempts, wrong code and code/link replay reject; refresh returns a real rotated session. |
| Owner-bound free-native context | Real free account bootstrap and exact EAN resolution; forged owner field rejects; incomplete account receives `profile_required`. |
| Source authority and concurrency | Actual Postgres duplicate publication, immutable/collision guards, ABA rejection, held transaction commit/rollback, refined-answer preservation, source-error recovery, service-only writes and owner/foreign/anonymous RLS checks. |
| No paid-state side effects | Nonempty local detailed fixture; ten paid/routine/billing/owned-state table fingerprints unchanged through context tests. No production data copied. |
| Existing web restrictions | Actual SSR cookies: free403 / paid200 for Profile and composed web scan with freemium off; `platform=ios` cannot bypass; native metadata absent from web result. |
| Native connected journey | Code verification over real HTTP, persisted Keychain relaunch, saved Profile, search, assessment/alternatives, dismissal and logout passed. |
| Native result fidelity | Full main/alternative tables, row explanations, independent row severity, native max-five order and web max-three behavior tested; final real Shampoo screenshots inspected. |
| Account-safe recovery | Late auth/profile/scan/refresh rejection, shared refresh rotation, transient failure retry and owner mismatch tests; new cold persisted-account regression failed on prior behavior and passed on final code. |
| Shop and accessibility | Fixture purchase opened external Safari; app return retained result. Largest text/footer omission, row target/value labels, product-specific shop label and targeted accessibility audits passed. |

## Commands and results

Node22.12.0, Next16.2.4, Xcode26.6/Swift6.3.3, iPhone17Pro simulator `26C40D88-109F-4071-A7FF-D0A982963B9C`, iOS26.5. No third-party native package dependency.

```sh
/usr/local/bin/node --import ./tests/server-only-register.cjs --import tsx --test tests/mobile-*.test.ts tests/scan-profile-context.test.ts tests/freemium-admission*.test.ts tests/scan-resolve-verdict.test.ts tests/scan-product-presentation.test.ts tests/scan-masked-alternative.test.ts tests/personal-plan/products/stage3-fit-comparison.test.ts
```

**182 passed, zero failed/skipped.** Log: `/tmp/ios-final-all-focused.log`. Includes real migration SQL under PGlite plus behavior tests. An auth owner-binding mutation failed before restoration. The source-projection regressions were red before their fixes; the final suite is green.

```sh
/usr/local/bin/node scripts/mobile/check-migrations.mjs
/usr/local/bin/node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/auth-integration.ts
/usr/local/bin/node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/context-integration.ts
/usr/local/bin/node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/web-isolation-integration.ts
```

All passed against real isolated Auth/Postgres/REST/Next.259 unique repository migration versions; two new additions follow the inspected base. Logs: `/tmp/ios-real-auth.log`, `/tmp/ios-real-context.log`, `/tmp/ios-real-web-isolation-final.log`. Fresh local history replay plus the added legacy RLS baseline completed; catalog seed constraints and V1/V2 protocols passed in one transaction. This is reconstructed-schema proof, with the historical replay caveat below.

```sh
/usr/local/bin/node node_modules/typescript/bin/tsc --noEmit
/usr/local/bin/node node_modules/eslint/bin/eslint.js .
/usr/local/bin/node node_modules/eslint/bin/eslint.js --no-ignore scripts/mobile/*.ts scripts/mobile/*.mjs tests/mobile-*.test.ts tests/scan-profile-context.test.ts
/usr/local/bin/node scripts/mobile/local-stack.mjs build
git diff --check
```

All passed. Repository lint: zero errors and five warnings in unchanged code/original planning evidence. Explicit mobile-script/test lint: clean. A separate TypeScript compiler-API invocation included the normally excluded `scripts/mobile/*.ts`: passed. Optimized Next production build passed using only local synthetic configuration, without deployment. Logs: `/tmp/ios-final-tsc-2.log`, `/tmp/ios-repository-lint.log`, `/tmp/ios-final-extra-lint.log`, `/tmp/ios-next-production-build.log`.

```sh
xcodebuild -project ios/Chaarlie.xcodeproj -scheme Chaarlie -destination 'platform=iOS Simulator,id=26C40D88-109F-4071-A7FF-D0A982963B9C' -derivedDataPath /tmp/chaarlie-native-derived -jobs 2 -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build-for-testing
xcodebuild test-without-building -xctestrun /tmp/chaarlie-native-derived/Build/Products/Chaarlie-Connected.xctestrun -destination 'platform=iOS Simulator,id=26C40D88-109F-4071-A7FF-D0A982963B9C' -jobs 2 -parallel-testing-enabled NO -only-testing:ChaarlieTests
xcodebuild test-without-building -xctestrun /tmp/chaarlie-native-derived/Build/Products/Chaarlie-Connected.xctestrun -destination 'platform=iOS Simulator,id=26C40D88-109F-4071-A7FF-D0A982963B9C' -jobs 2 -parallel-testing-enabled NO -only-testing:ChaarlieUITests/ChaarlieUITests/testConnectedLocalAuthProfileSearchResultLogout
```

Signed build and **20 unit tests passed**; main session independently reran the final units (`/tmp/ios-parent-native-final-unit.log`). Three fixture UI tests passed, including semantic accessibility audit and Safari return. Final connected-only test: one passed, zero failures (`/tmp/chaarlie-native-connected-hydration-final.log`). `Chaarlie-Connected.xctestrun` contains the explicit runner environment override documented in [ios/README.md](../../ios/README.md); a skipped connected test is not counted. The full intermediate run hit the synthetic email rate cap; resetting only that local hashed test-email bucket enabled the final single rerun, without changing limits. The earlier unsigned simulator failed actual Keychain access; simulator-only ad-hoc entitlements fixed it. No Apple development team or distribution identity was configured.

Cold-start regression: isolated exact pre-hydration source failed with `NativeTest.RequestDidNotReach.bootstrap`; final source passed. Logs: `/tmp/chaarlie-native-cold-red.log`, `/tmp/chaarlie-native-cold-green.log`. The shared worktree was never temporarily regressed during review.

## Manual evidence and limits

[Retained native screenshots and qualitative review](implementation-evidence/README.md). Main session observed a real captured cold login link reach Scan/Profile, warm account-link decline preserve the existing profile, and confirmed switching authenticate the new synthetic account. The final additional cold-persisted-account manual repetition was stopped when the Mac locked; no unlock was attempted. Its deterministic regression and final connected warm-restore tests passed. The last privately dispatched test login is not claimed as observed completion.

The connected test's DEBUG hook transfers only the matching local captured code to the real verify method, avoiding raw OTPs in XCTest logs. Keyboard OTP entry itself was not exercised. Full VoiceOver traversal, physical barcode capture/camera denial/foreground recovery, iOS18 runtime and physical-device networking remain unverified. EAN8/EAN13 capture is implemented; compressed UPC-E expansion is deferred. Universal Links, public API configuration, distribution signing and public release are outside this handoff.

Local history lacks some original schema/data. The isolated runner reconstructs legacy leads/vector/pg_cron/profiles-policy prerequisites and omits explicit historical catalog-cohort DML/check blocks while retaining schema/function changes. Exact exceptions are in [scripts/mobile/README.md](../../scripts/mobile/README.md) and `local-stack.mjs`; repository history was not rewritten. This is not a full unmodified production-data replay. Synthetic product verdicts/prices are not claims about real products; the public packshot proves only image loading.

## Artifact and runtime disposition

Keep all231 fingerprinted files and these two receipts for authorized publication. All62 original planning files remain in the Git inventory; the CI follow-up below hardens one retained HTML prototype. Sanitized implementation screenshots have a local ignore exception so they are included as durable evidence.

Transient raw reviewer reports are discarded after their dispositions are recorded in [review-receipt.md](review-receipt.md). Sanitized test logs and Xcode results stay outside Git; generated dependencies, the synthetic database volume, local credentials and DerivedData remain ignored/outside the repository. No secret, mail body, credential URL or production user row is in retained evidence.

At the initial verification finish, Next, isolated Supabase, the designated simulator and Colima profile `chaarlie` were stopped and `.env.local` restored byte-for-byte. They were subsequently reopened at Nick’s request for the walkthrough. The corrected app is now foreground in the designated simulator with the centered Repair-Pflege explanation open; Next on3218 and the isolated stack remain running. The runner currently holds the provisioned `.env.local` at ignored `tmp/mobile-stack/held-.env.local` and restores it on graceful shutdown. The synthetic database and simulator installation/Keychain remain retained. No source/worktree cleanup, commit or publication was performed. Refresh against current main before future shared-code publication as required by the plan.

## Authorized explanation-position correction

Nick's explicit walkthrough correction supersedes the earlier above-table positioning only; scope/coverage are recorded in [info-position-correction.md](info-position-correction.md). The updated fingerprint includes the final correction and evidence. Earlier backend, integration, unit and broad build results above belong to the unchanged baseline modules; they were not rerun for this UI-only delta.

Fresh final signed Xcode build and four focused UI tests passed (zero failures): `testMainExplanationKeepsResultStationary`, `testAlternativeExplanationKeepsResultStationary`, `testLargestTextExplanationScrollPreservesResult`, `testReduceMotionExplanationKeepsResultStationary`. Run used the same project/scheme/simulator/DerivedData, ad-hoc signing, `-parallel-testing-enabled NO`, four corresponding `-only-testing:ChaarlieUITests/ChaarlieUITests/…` selectors and `test`. Log `/tmp/chaarlie-explanation-green3.log`; result `Test-Chaarlie-2026.09.12_14-52-26-+0200.xcresult`. Old behavior reproduced a119.7pt jump; final repeated open/close measurements differ by less than0.00002pt and return exactly after close. Long XXXL content reaches final values while retaining the close button; Reduce Motion uses the same zero-duration code path through a DEBUG fixture override, without changing system settings.

Main independently inspected the passing result, final production delta, all three focused screenshot states and real connected Conditioner search/result/info opening, closing and another row. The corrected app was rebuilt and relaunched with its existing synthetic account and left visible. Final `git diff --check` passed. Full VoiceOver traversal and rapid-reopen focus remain outside the demonstrated evidence.


## Approved glossary card verification

Current decision coverage is **confirmed** for Nick's explicit request to implement the updated [glossary specification](explanation-card-spec.md). Coverage acknowledgement, exact-copy/fallback resolution and the unchanged row→open→read→close journey are in [glossary-implementation.md](glossary-implementation.md). Undiscussed consequential assumptions affecting this handoff: none. Historical pending wording in the supplied spec is superseded by its current approval note.

Fresh Node22 mapping/schema/authority run: **21 passed**, zero failed/skipped (`/tmp/chaarlie-glossary-backend-final.log`). Final `tsc --noEmit` and explicit scoped ESLint with `--no-ignore` for both source and test files passed (`/tmp/chaarlie-glossary-tsc.log`, `/tmp/chaarlie-glossary-eslint.log`). Both shared JSON fixtures are byte-identical to their native resource copies. Unknown-axis suffix and inherited object keys fall back to labels; the suffix regression failed on an isolated prior adapter and passes on final code. Backend copy is additive, while native missing/null/blank meaning decoding remains compatible with older payloads.

Signed final native build: **25 unit tests and four stationary/scroll/Reduce Motion UI tests passed** (`/tmp/chaarlie-glossary-regression-final.log`, `/tmp/chaarlie-glossary-regression-final.xcresult`). The same project/scheme/destination/signing settings above were used with `test`, `-only-testing:ChaarlieTests` and the four explanation selectors. The additional per-axis glossary UI test passed separately (`/tmp/chaarlie-glossary-ax-v3.log`, `/tmp/chaarlie-glossary-ax-v3.xcresult`). It verifies all stop groups and exact meaning labels, absence of comparison-only content, full equal-height row bounds, and unchanged result position. Repair/cleansing rows66pt, scalp rows51.333pt, heat rows48pt; all within-card heights equal to floating-point precision.

The initial compiler failure was a missing wrapped default on `@ScaledMetric`, corrected before all passing native tests. The initial per-axis UI failure exposed an ancestor identifier overriding short-card row IDs. Moving that identifier to the actual scroller and defining the full row content shape fixed the semantic bounds; no layout or expected height was relaxed. The final title and close remain outside the bounded scroller.

Main inspected [retained native glossary screenshots](implementation-evidence/README.md) against the supplied reference. The coordinating session independently inspected Repair and scalp and requested no additional visual changes. The displayed six-row scalp card fits at standard text; large content uses internal scrolling. Prior broad backend/auth/database/web-isolation results above apply to unchanged baseline modules and were not repeated for this card delta. Physical device/iOS18 runtime and full VoiceOver traversal remain outside demonstrated evidence.

The final largest-text regression additionally asserts equal stacked row heights:386pt each (within floating-point precision), with title pinning, final-entry reachability and stationary result frames still passing. Log `/tmp/chaarlie-glossary-xxxl-final.log`, result `/tmp/chaarlie-glossary-xxxl-final.xcresult`. Combined unique native coverage for this delta is25 unit and5 UI tests.

Final runtime handoff: rebuilt app relaunched normally with the existing synthetic Keychain account; real local bootstrap, search and resolve all returned200. Main opened and inspected Repair-Pflege on `Leichter Conditioner`; [final connected screenshot](implementation-evidence/glossary-connected-repair.png). App is foreground on the same iPhone17Pro simulator. Next3218 and isolated Supabase remain running; existing held `.env.local` lifecycle is unchanged. Final fixture parity and `git diff --check` passed. All new spec/copy/test/screenshot artifacts are retained; no commit, push, PR, deployment or production write.


## Final native design-polish verification

**Completed the authorized bounded visual pass**, with current coverage and retained before/after evidence in [final-design-review.md](final-design-review.md). Final signed build remains on the original iPhone17Pro/iOS26.5; compact evidence used one temporary SE3/iOS26.5 sequentially. No two simulators were booted together.

Fresh checks, all zero failures:

- Compact correction run:25 native unit tests and5 UI tests (`/tmp/chaarlie-design-compact-after.xcresult`, matching `.log`). Includes44pt field/text actions, wrapped maximal-text scanner heading, manual-search action above the tab bar and successful sheet opening, glossary scroll/position, missing-link footer.
- Standard correction run:6 UI tests (`/tmp/chaarlie-design-standard-after.xcresult`, matching `.log`): auth/code/keyboard/error/loading/recovery; scan/search/Profile states plus logout→login; polish guards; four glossary axes with equal rows/clean AX labels; stationary main explanations; maximal-text long explanation.
- Final integrated compact build, after native appearance and final soft-break edits:25 native unit tests and5 UI tests (`/tmp/chaarlie-design-final-compact.xcresult`, matching `.log`): appearance transitions, compact states/keyboard, accessibility states with Profile logout reachable above the tab bar, largest-text stationary/scrolling glossary, no-shop footer. These runs cover10 unique UI methods; repeated executions are not extra unique tests.
- Earlier rendered baseline probes additionally exercised long product/alternative names at both viewports. Their layout was inspected directly. Screenshot capture is distinguished from geometric/action assertions.

All commands used `xcodebuild -project ios/Chaarlie.xcodeproj -scheme Chaarlie`, the named simulator destination, `/tmp/chaarlie-native-derived`, `-jobs 2 -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`, focused `-only-testing` selectors and `test`. Broad backend checks above were not repeated for this native-only polish. Final `git diff --check` passed.

Main directly inspected final compact scanner/search/Profile appearance, normal search cards, code keyboard, long glossary title, accessibility comparison rows and reachable Profile logout. Then installed the same final app on the original simulator and observed real local bootstrap/Profile/search/resolve200 responses, empty-search recovery, the light result sheet and centered Repair-Pflege overlay with readable white status content over the dark background. The last screen is retained as [connected glossary](implementation-evidence/final-design-review/connected-glossary-final.png). No real purchase or production data was used.

The temporary task-created compact simulator was removed after shutdown. Original simulator, existing synthetic Keychain session, Next3218, isolated Supabase/Colima and preview server remain usable. The runner still owns the ignored held `.env.local`; it was not stopped. All selected screenshots and the final review are retained; raw counterpart output was discarded after the review receipt. Physical-device/camera, iOS18 and full VoiceOver limits remain as stated above. No publication operation was performed.


## Connected Profile scroll follow-up

Nick’s report was investigated on the actual local account, fresh and after search→result→explanation→close→Profile. One targeted touch test passed, moving logout from y1120.83 to717.5 above the tab bar. Nick confirmed wheel/trackpad input was the issue and that actual clicking/dragging works. No app bug or product fix was established; no settings changed. Temporary test source was restored byte-for-byte. [Diagnosis and before/after touch evidence](profile-scroll-investigation.md) are retained; the fingerprint update adds only that note and two screenshots. No broad retest or counterpart pass was needed for this read-only diagnosis. App and local services remain available.


## Authorized draft checkpoint publication

Nick authorized commit, push and draft PR creation for the reviewed B1–B4 milestone on2026-09-12. Merge, deployment, production writes and subsequent milestone edits remain separate. Fetched `origin/main` at `4935b271f2f734e7b3150732d171c85ac67fefa8`: since the reviewed base469d41f5, only workflow/instruction/planning files changed (#532); no shared application contract or migration changed. The draft preserves the reviewed implementation base and does not claim fresh-main implementation tests.

Read-only target migration history (`pqdkhefxsxkyeqelqegq`) confirms `20260912103630_mobile_auth_attempts` and `20260912103726_mobile_scanner_context` are **unapplied**. They passed the isolated local migration/integration checks above; neither was applied during publication. Before any merge that could deploy the mobile facade, choose and verify a safe migration-first sequence and refresh target history. Existing historical replay limitations remain.

Commit all228 fingerprinted task artifacts plus these two administrative receipts. Original planning/design evidence is preserved; temporary raw review/test probes were discarded as recorded. Local credentials, held environment, dependencies, databases, Xcode output and transient logs stay ignored/outside Git. The original planning worktree is preserved.

Publication hook normalization changed only formatting in `tests/scan-profile-context.test.ts`. Main inspected the delta and compared parsed TypeScript trees (identical after excluding the inserted no-op semicolon). All six tests in that file passed again. Other228-file content remained unchanged. Both receipts now identify the hook-normalized tree; broader unchanged verification/reviews were reused.

Final publication hygiene removed trailing whitespace from the two bundled OFL text files without changing license text or font binaries. Explicit configured pre-commit checks (`lint-staged` and `tsc --noEmit`) passed; the six formatter-affected tests passed. Full base-to-tree `git diff --check` passed, including newly tracked files. These mechanical changes were reviewed locally; no runtime behavior changed.

## PR533 CI correction — 2026-09-13

Remote head `9f59daeeadbed49ea367931a96666efae26043bf` had10 Node failures, all `unexpected rpc scanner_context_read_source` in the free-registration journey and free-snapshot acceptance doubles. Main reproduced all10, inspected the composed production loader and SQL contract, and corrected only the test transport/fixture persistence: owner-filtered source reads, required input/schema/computation provenance and revision-checked immutable publication. Linked hair diagnostics are an explicit independent prerequisite. Existing attack, missing-source and paid-access refusal assertions are unchanged. Added missing-profile, corrupted-hash and concurrent-source-publication refusal cases, plus publication idempotency.

The separate CodeQL aggregate check reported one new high alert in retained `evidence/assessment-refined.html`: a DOM dataset name flowed into `innerHTML`. The prototype now assigns that name through `textContent`. Its actual click script was exercised in an ephemeral Node VM DOM harness with an ordinary name and HTML-shaped text: both reached the text property, neither entered the HTML template. This is script verification, not a browser rendering run. Native and production service code remain unchanged.

Verification on Node22.12.0:

- Focused journey/acceptance/context/SQL suites:36 passed, including28 journey/acceptance cases.
- Full `npm run test:node`:6453 passed,0 failed/skipped.
- `npm run test:personal-plan:nested`:855 passed.
- `npm run personal-plan:application-audit`:309 reviewed/composable rows,0 explicit blockers.
- `npm run test:agent`:967 passed with the CI workflow's explicit synthetic placeholder variables. The earlier env-less run failed26 Supabase client constructors (`supabaseUrl is required`); no source change or production credential was used for the successful rerun.
- `npm run typecheck`, Prettier check, explicit configured `lint-staged` and base-to-tree whitespace check passed. ESLint follows repository configuration that ignores test files; no lint coverage of those tests is claimed. Formatting did not change the reviewed fingerprint.

Fetched origin again: PR533 remains NickRuppy's open draft on the expected old head; main remains4935b271. The new canonical231-path fingerprint above includes the helper and the two preexisting journey files now changed relative to the original base. Original planning artifacts are preserved with only the recorded prototype text-sink correction. Administrative receipts are excluded. Device-QA plan/proxy work is separate and paused. No merge, migration application, production write or device activation occurred. The migration state from publication remains a dated read-only snapshot and must be refreshed before merge.
