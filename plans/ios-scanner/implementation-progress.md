# Connected scanner implementation

2026-09-12. Worktree `/Users/nick/.codex/worktrees/a475/hair_conscierge`, branch `codex/ios-connected-scanner`, refreshed base `469d41f5e81f44702c94829c0ed312e732b01172`.

## Contract

Outcome: approved connected native B1–B4 existing-account scanner, read-only Profile and account-safe recovery. Scope: parent revision 9 / first-build revision 5. Decision coverage confirmed; Nick's 2026-09-12 connected-walkthrough acknowledgement covers this handoff, alongside earlier existing-test-account and result/action approvals. Confirmed choices, inherited domain/source contracts and implementation defaults remain as recorded in those plans. Open consequential assumptions affecting B1–B4: none. Undiscussed consequential assumptions affecting this handoff: none. Later consent/onboarding/edit/research/deletion/release work remains parked as recorded.

Stop: review-ready worktree before commit, push, PR, merge, deployment, production write or App Store submission. Verify native build/unit/UI behavior, isolated real Auth/Postgres/REST integration, source CAS/owner/paid-state preservation, web regressions, large text and recovery. Simulator proof does not establish physical camera or Universal Links.

## Planning package preservation

Copied all 62 files from `/Users/nick/AI_work/hair_conscierge/.worktrees/ios-scanner-plan/plans/ios-scanner/`. Compared SHA-256 manifests before and after copy; every destination byte matched and source was unchanged. Original planning worktree remains untouched. Durable package including historical designs is retained in this worktree. Raw import manifest is transient `/tmp/ios-scanner-planning-import.json`.

## Execution and verification log

- Worktree dependencies installed with existing `/usr/local/bin/node`22.12.0 using `npm ci --ignore-scripts --no-audit --no-fund`; existing Next16.2.4 patch applied with local `patch-package --error-on-fail`. No shared tooling or source environment copied.
- Auth facade, disabled-by-default mobile API gate, bearer route admission, local-only configuration/scripts authored. No signup on OTP start; code/link share provider credential and one server-owned attempt; same-attempt resend, capped verification, expiry and one-use completion. Keys/session data remain in ignored mode-0600 local files.
- Auth owner-binding mutation removing the email check produced the expected assertion failure; restoring it passed. Context regression tests exposed unpublished-draft provenance and habits-completeness errors before their fixes. The native cold-start persisted-account regression failed against the prior implementation in an isolated copy and passed against the final tree.
- B1–B4 implementation complete. Final proof:182 focused Node tests;20 native unit tests, three fixture UI tests and one connected native UI test; actual local Auth/Postgres/RLS/concurrency/paid-state preservation; composed web scanner isolation; TypeScript, repository lint and optimized Next build. Read the [verification receipt](verification-receipt.md) for commands, exact scope and limitations rather than adding overlapping test totals.
- Normal and structural whole-branch review plus bounded final-delta review completed through the read-only Claude lane. Supported defects fixed; unsupported findings rejected against code. No blocking verified finding remains. [Review receipt](review-receipt.md).
- Readiness is for review of the approved local development milestone. Full VoiceOver traversal, physical camera/device and public release checks remain explicitly unverified. No publication or production writes performed.

## Setup coordination

Setup task `01a0952b-a272-7133-99f1-f9f0c17fc708` completed tooling and released its disposable smoke before connected tests. Its receipt is preserved in [technical-setup.md](technical-setup.md). Product used port3218 plus local Supabase54321/54322/54324 with dedicated config, migrations and synthetic fixtures. Never start original `supabase/config.toml` unchanged: live SMTP/production redirects are present there. Next/Supabase, the designated simulator and Colima profile are stopped after verification; the synthetic volume is retained. The provisioned `.env.local` was held without reading/loading it and restored byte-for-byte after both dev and production-build runs.

## Artifact disposition

Commit app/backend/tests/migrations/operator scripts and the complete durable plan/evidence package only after separate publication authorization. Original62 planning files remain byte-identical. Final [native screenshots](implementation-evidence/README.md) are nonpersonal. Generated DB files, synthetic credentials and DerivedData stay ignored or outside the repository; preserve the synthetic local volume for repeat testing. Discard transient raw reviewer reports after recording their findings in the review receipt. No task-owned source or planning artifact is left unclassified.

## Walkthrough correction — completed

Nick explicitly requested stationary results and centered explanation cards. The bounded [position correction](info-position-correction.md) is implemented and verified by four focused native UI tests plus the real local app walkthrough. Updated evidence and receipts cover the delta; the original 62 planning files remain unchanged. The earlier shutdown receipt describes the initial verification finish: services were reopened for Nick's walkthrough and currently remain running, with the corrected app visible in the designated simulator. The runner holds `.env.local` in its ignored task directory until graceful shutdown. No publication or production write.
