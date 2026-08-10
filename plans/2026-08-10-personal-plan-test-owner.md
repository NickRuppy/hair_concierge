# Personal Plan synthetic test owner

## Outcome and source context

Create one reusable, explicitly synthetic Personal Plan owner that an operator can safely prepare, reset to the post-payment Stage 1 entry state, authenticate through the real production auth boundary, and use for Stage 1–5 simulated-user review and transition measurement.

Repository evidence shows that `scripts/ux-audit-create-test-user.mjs` currently creates only an auth user with a committed password, while `scripts/ux-audit-seed.mjs` seeds legacy profile/product state rather than a paid Personal Plan source. The isolated Stage 1–5 browser fixture in `tests/personal-plan-stage1-5.spec.ts` is the current canonical example of the minimum paid source state. The existing service-role-only `public.personal_plan_erase_owner_data(uuid)` function is the canonical downstream reset primitive.

Planning contract:

- **Outcome:** a fail-closed operator command produces a short-lived authenticated browser state for a complete synthetic post-payment Personal Plan owner, and `simulated-user-review` knows how to use it.
- **Constraints:** preserve the real auth, entitlement, Stage 1–5, and persistence contracts; exclude the owner from customer analytics; never expose a reusable production password, auth token, or cookie; never target an arbitrary user; require explicit confirmation before production writes; consume production one-time links only on the canonical `https://chaarlie.de` origin.
- **Non-goals:** customer impersonation, a production login-bypass route, bypassing payment/entitlement checks, changing the end-user Personal Plan journey, creating a new outbox, changing Vercel regions, or automating destructive cleanup of real users.
- **Done when:** deterministic tests prove target classification and mutation gates; a local/isolated integration check proves prepare/reset/auth-state behavior; the production command defaults to inspection and refuses unsafe owners; documentation gives `simulated-user-review` and performance scripts an exact safe workflow.

## Chosen direction

Use one fixed synthetic email, `personal-plan-qa@hairconscierge.test`, whose identity is established by multiple independent sentinels rather than by email alone:

1. auth `app_metadata.personal_plan_test_owner === true`;
2. the exact `.test` email;
3. an internal-test funnel session with `channel = 'test'`, `package_key = 'meta_personal_plan_v1'`, and `is_internal_test = true`;
4. a paid one-time purchase and consent whose provider references carry a reserved `personal-plan-qa-` prefix;
5. an attached prepared artifact owned by that same user and lead;
6. an exact long-lived `tester` grant plus Personal Plan test enrollment, while `profiles.is_admin` remains false.

Add a repository operator CLI with four explicit modes:

- `inspect`: read-only and the default; report sentinel, paid-source, artifact, and current-stage readiness without printing secrets.
- `prepare`: create or repair only the exact synthetic owner's auth/profile/lead/funnel/consent/purchase/artifact source. Production requires `--apply`, `--confirm-project=pqdkhefxsxkyeqelqegq`, and `ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE=1`. Existing conflicting or non-synthetic state causes refusal, not takeover.
- `reset`: after revalidating every sentinel, call the existing service-role-only erasure RPC to remove only downstream Personal Plan work, preserve the paid source, and verify that `/plan-start` resolves to Stage 1. Production uses the same explicit write gates.
- `auth-state`: behind the same explicit production write gates, ask Supabase Admin for a one-time magic-link token, consume it through the application's real `/auth/confirm` route, verify the resulting user, explicitly open `/plan-start`, and write a temporary Playwright storage-state file with owner-only permissions. Do not print the link, token, cookies, or file contents.

This is preferred over disposable per-run accounts, which create cleanup and analytics noise, and over arbitrary impersonation, which creates an unnecessary customer-access capability and a much larger security boundary.

## Scope and non-goals

In scope:

- A deterministic test-owner policy module and unit tests.
- A service-role operator CLI that reads environment values without logging them and performs guarded, idempotent inspection/preparation/reset.
- One-time real-auth storage-state generation for Playwright/browser review.
- Exact integration guidance in `simulated-user-review` and the Personal Plan measurement scripts.
- Removal or correction of the misleading claim that the legacy UX-audit account already has billing and Personal Plan state.

Out of scope:

- Any application route that accepts an impersonation target.
- Reusing real customer accounts or existing non-sentinel internal-test purchases.
- Any production application of the new source-preparation migration; deployment and production mutation remain separate gates.
- Automatic progression through Stage 1–5; the reviewer should exercise the actual UI.
- Publishing, deployment, or production mutation as part of implementation verification. A later, separately authorized operator run creates the production synthetic owner.

## Target map

- `scripts/personal-plan/test-owner.mjs` — CLI, environment loading, Supabase admin access, guarded orchestration, magic-link consumption, and storage-state output.
- `scripts/personal-plan/test-owner-policy.mjs` — pure constants, state classification, sentinel validation, confirmation validation, and redacted status projection.
- `tests/personal-plan-test-owner.test.ts` — deterministic classification, refusal, redaction, and command-gate coverage.
- `supabase/migrations/20260810140000_personal_plan_test_owner.sql` and `supabase/tests/personal_plan_test_owner.sql` — atomic service-role-only source preparation and database safety contract.
- `tests/personal-plan-test-owner.spec.ts` and `scripts/test-personal-plan-stage1-5-browser.sh` — dedicated local-Supabase/Next/Playwright prepare-reset-auth integration proof, intentionally outside the Node unit-test glob but reusing the existing isolated Stage 1–5 stack.
- `.agents/skills/simulated-user-review/SKILL.md` — authenticated Personal Plan setup and teardown workflow; remove the inaccurate legacy-account statement.
- `scripts/personal-plan/measure-write-transitions.mjs` and `scripts/personal-plan/measure-read-only-transitions.mjs` — help text that consumes the generated storage-state path and preserves existing write/read-only protections.
- `scripts/ux-audit-create-test-user.mjs` and `scripts/ux-audit-seed.mjs` — retain them only as explicitly legacy/local-Supabase helpers; require a caller-supplied or generated unprinted password and refuse non-local Supabase URLs.

## Designed user journey

Actor: a repository operator running a production or preview simulated-user review. No end-user surface, copy, timing, or Personal Plan behavior changes.

1. The operator runs `inspect` against the configured Supabase project. The command prints a redacted readiness summary: exact synthetic owner found/missing, sentinel validity, paid source, prepared artifact, current Personal Plan stage, and whether safe mutations are allowed.
2. If the owner is missing or repairable, the operator runs `prepare` with all three production write gates. The command creates or repairs only the fixed synthetic identity and then rereads all rows. A conflicting email, missing app-metadata sentinel on an existing owner, non-test payment reference, cross-owner lead/artifact, or ambiguous duplicate causes a hard stop with no reset/auth continuation.
3. Before a fresh Stage 1–5 journey, the operator runs `reset` with the same write gates. The command revalidates sentinels immediately before the RPC, deletes only downstream Personal Plan aggregates through `personal_plan_erase_owner_data`, preserves the paid source, and verifies a Stage 1-ready frontier. The report names deletion counts but no personal or auth secrets.
4. The operator runs `auth-state --apply --base-url=https://chaarlie.de --confirm-project=pqdkhefxsxkyeqelqegq` with `ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE=1`. Supabase creates a one-time link without sending email; Playwright consumes it through `/auth/confirm`, verifies the authenticated user id, explicitly opens `/plan-start`, writes an owner-readable temporary storage-state file, and prints only its path and cleanup guidance.
5. `simulated-user-review` or a transition measurement command opens a new browser context from that state. The reviewer completes the real Stage 1–5 UI, including durable saves and recovery behavior, without bypassing application authorization.
6. On an auth failure, wrong redirect, stale token, or owner mismatch, the context is closed, the partial storage-state file is removed, and the command fails. The operator can rerun `inspect` and `auth-state`; no data reset is inferred.
7. At completion, the browser context is closed and the storage-state file is deleted. The synthetic paid source remains reusable and analytics-excluded. A later review starts with explicit `reset`; completing a review never silently rewinds state.

Meaningful variants:

- Local app URL with local Supabase: loopback origins remain supported for deterministic integration. Remote-project auth is restricted to the canonical production origin; preview support would require a separately reviewed allowlist change.
- Read-only Routine/Anwendung measurement: consumes auth state but continues blocking all writes.
- Stage 2/3 write measurement: still requires the measurement script's dedicated-owner confirmation in addition to any earlier owner preparation.

User-journey sign-off: **confirmed 2026-08-10**. Nick confirmed the owner has a completed quiz and post-payment source, authenticates with a one-time link, and then runs the real simulated-user review.

## Planning evidence

No user-facing mockup is required because this slice adds repository operator tooling and skill documentation only. The real end-user login, payment entitlement, `/plan-start`, and Stage 1–5 screens remain unchanged.

Evidence used:

- Current legacy UX-audit scripts inspected directly.
- Current isolated Stage 1–5 `seedBuyer` fixture inspected as the minimum paid-source reference.
- Current service-role-only erasure RPC inspected as the reset primitive.
- Current write/read-only measurement scripts inspected for storage-state handoff.
- Read-only production inspection found no complete dedicated `.test` Personal Plan owner, so implementation must not adopt an existing account.
- The operator seed is intentionally a service-role synthetic entitlement and does not depend on, invoke, or claim to validate the live Stripe/PayPal checkout path.

Evidence-review status: not applicable to end-user UI; operator journey confirmed.

## Ordered tasks

### 1. Encode the synthetic-owner safety policy

Create pure policy functions for exact identity constants, project/write confirmation, sentinel classification, state conflict detection, and redacted status output. Treat missing state as preparable, exact matching state as reusable, and any mixed/cross-owner/non-prefixed state as unsafe.

Tests must cover missing owner, exact owner, missing app metadata, wrong email, duplicate/cross-linked rows, wrong payment prefix, non-internal funnel, ambiguous prepared artifacts, production confirmation mismatch, and secret redaction.

**Produces:** one deterministic `classifyPersonalPlanTestOwner(snapshot)` result used by every mutating/auth mode.

**Complete when:** unit tests prove no command can classify a real or ambiguous owner as safe.

### 2. Implement inspect and idempotent preparation

Build the CLI around a service-role Supabase client. Default to `inspect`; validate the configured project before any query. `prepare` creates the missing synthetic auth user with a generated unprinted credential, server-owned app metadata, `profiles.is_admin = false`, an exact long-lived `tester` grant/enrollment for the current `internal` Personal Plan rollouts, and the canonical paid source copied from the isolated Stage 1–5 fixture. The browser session must not acquire admin API or all-customer RLS access.

Every synthetic row uses a checked-in deterministic UUID/reference derived for this one owner. The source rows are prepared inside one service-role-only database RPC so the lead, funnel test markers, consent, purchase, prepared artifact, and Customer.io-outbox suppression commit atomically. The RPC reuses the mainline field-test marker (`test_kind = 'field_test'`) through a permanently revoked sentinel campaign, so the reusable QA owner cannot expose a usable free-test campaign link while analytics and commercial automation still recognize it as synthetic.

Upsert ordinary rows on primary `id`. For `billing_one_time_purchases`, reconcile the actual `UNIQUE (provider, provider_transaction_id)` key using the reserved provider/reference and require the deterministic consent id; the preflight refuses any competing row caught by the partial unique paid `(user_id, product_kind)` index or unique `consent_id` index. The consent preflight likewise refuses conflicts with its unique `(lead_id, funnel_session_id, product_kind)` key. The artifact preflight requires the deterministic id, unique claim-token hash, and attached lead; it refuses a competing attached-artifact partial unique row instead of trying to overwrite it. After the RPC, the CLI rereads and classifies the complete state.

Do not broaden `/api/dev/login` or create a production app route. Do not invoke real Stripe/PayPal, email delivery, Customer.io, or analytics APIs.

**Consumes:** Task 1 classification and exact constants.

**Produces:** a fully sentinel-verified post-payment source snapshot.

**Complete when:** deterministic client tests plus the dedicated local-Supabase browser harness prove first-run creation, safe rerun, repair of recognized partial synthetic state, refusal of every named unique-key conflict, `kind: 'personal_plan_start'` reachability under the `internal` rollout, and zero calls to external payment/email systems.

### 3. Add guarded reset and postcondition verification

Immediately before reset, reread the complete snapshot and require the exact safe classification plus production confirmations. Call `personal_plan_erase_owner_data` and reread both preserved source rows and downstream counts. Fail if payment, consent, lead, funnel, or prepared artifact changed, if any Personal Plan aggregate remains, or if the real journey-access loader does not resolve the postcondition to exactly `kind: 'personal_plan_start'`.

**Consumes:** sentinel-verified owner from Tasks 1–2 and the existing erasure RPC.

**Produces:** verified paid-source-preserved, Stage 1-ready state.

**Complete when:** the dedicated local-Supabase browser harness proves completed Stage data is removed, source state survives, a second reset is idempotent, the app lands on the Stage 1 entry, and unsafe owners cannot reach the RPC.

### 4. Generate a disposable real-auth browser state

Use Supabase Admin `generateLink({ type: 'magiclink', email })`, construct a same-origin `/auth/confirm?token_hash=...&type=magiclink&next=/plan-start` URL, and let Playwright consume it. Verify the final route and authenticated user through a read-only application seam or cookie-backed Personal Plan page response before serializing storage. Write atomically with mode `0600`; redact errors and remove partial output on every failure.

The implementation must not print, persist in repository paths, or include in reports the magic link, token hash, cookies, refresh token, access token, password, or service key.

**Consumes:** exact safe classification; optional Stage 1-ready postcondition from Task 3.

**Produces:** absolute temporary storage-state path compatible with current measurement scripts and browser automation.

**Complete when:** the dedicated local-Supabase/Next/Playwright harness proves real auth success, owner/destination verification, file permissions, secret-free output, failure cleanup, and consumed-link failure behavior. Preview/production remains a separately authorized manual verification and is not a CI dependency.

### 5. Integrate the operator workflow into review and measurement guidance

Update `simulated-user-review` to prefer the new command for authenticated/post-payment Personal Plan reviews, to require explicit reset before a fresh journey, and to delete disposable auth state after use. Keep the legacy UX-audit helpers only for local Supabase/legacy-profile review, make them refuse non-local Supabase URLs, and remove the committed fixed-password behavior. Update measurement help text to show the new auth-state producer while retaining its independent write confirmation and read-only request blocking.

**Consumes:** CLI modes and storage-state contract from Tasks 2–4.

**Produces:** one documented path from synthetic owner to qualitative review and before/after timing.

**Complete when:** command help, skill instructions, and scripts agree on exact flags, stop conditions, and cleanup; repository search finds no committed reusable test password.

## Verification

Automated:

- Focused policy and CLI tests under the repository Node test harness.
- Dedicated `tests/personal-plan-test-owner.spec.ts` local-Supabase/Next/Playwright test in the existing Stage 1–5 harness, separate from `tests/personal-plan-*.test.ts` so CI unit tests never require live auth credentials.
- Personal Plan test suite: `npm run test:personal-plan`.
- Auth and Stage 1–5 contract tests affected by magic-link/entry assumptions.
- `npm run typecheck`, `npm run lint`, and `npm run build`.

Manual/browser in an isolated or preview-safe environment:

- `inspect` makes no writes and redacts all secrets.
- First `prepare`, repeated `prepare`, progressed journey, `reset`, repeated `reset`.
- `auth-state` lands on `/plan-start` as the exact synthetic owner; storage state is `0600` and works with both measurement scripts.
- Complete the Stage 1–5 journey once using the stable simulated-user persona and capture a report.
- Delete the temporary storage-state file and verify no tracked/untracked secret artifact remains in the worktree.

Live-state checks, separately authorized after merge/deployment:

- Dry `inspect` against project `pqdkhefxsxkyeqelqegq` before creation.
- Explicit production `prepare`, `reset`, and `auth-state` only after reviewing the command plan/output.
- Verify analytics exclusion markers and zero real payment/email-provider calls.
- Run Stage 2/3 write measurement only with the existing dedicated-owner confirmation.

## Review and handoff

- Worktree: `.worktrees/personal-plan-test-owner`; branch: `codex/personal-plan-test-owner`; reconciled onto live `origin/main` `887447909e38b9ee9795de7d80d3aa085062e6a8`.
- Counterpart plan review: complete; verdict `approve with revisions`; all material findings reconciled in the ledger below.
- Operator-journey sign-off: confirmed 2026-08-10.
- Implementation uses `implementation-loop`, then its `ready-check` and repository review gates.
- Stop before commit/push/PR unless separately authorized. Stop before deployment and before any production mutation even if publication is later authorized.
- Artifact disposition: plan, policy/tests, CLI, and skill/documentation changes are **commit**; counterpart output and auth storage-state files are **discard**; production measurement reports are **archive outside the repository** unless Nick explicitly selects one for durable documentation.
- Residual risk: service-role tooling can mutate production, so safety depends on redundant sentinels, exact project/production confirmations, immediate pre-mutation rereads, and no generic user-id/email arguments.

Counterpart findings ledger:

| ID  | Type                   | Evidence                                                                                    | Decision                  | Plan change                                                                                                | Revalidation                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| C1  | defect                 | `test:personal-plan` glob would include a live-auth `*.test.ts`                             | accepted                  | Dedicated local-Supabase Playwright spec/shell harness outside the Node glob                               | Run both Node suite and dedicated harness                   |
| C2  | defect                 | Purchase, consent, and artifact tables have overlapping unique/partial-unique constraints   | accepted                  | Named deterministic ids, provider/reference key, preflight conflicts, and exact reconciliation behavior    | First run, rerun, partial state, and every conflict fixture |
| C3  | defect                 | Reset preserves the attached artifact; the load-bearing postcondition is the journey result | accepted                  | Require exactly `kind: 'personal_plan_start'` and browser Stage 1 entry                                    | Loader assertion plus browser proof                         |
| C4  | defect                 | Current internal rollout requires an internal owner                                         | revised after code review | Use the narrower exact `tester` grant/enrollment with `profiles.is_admin = false`                          | Local harness uses `internal` rollouts                      |
| C5  | tradeoff               | Integration proof could live in local Supabase, preview, or manual-only                     | accepted: local Supabase  | Dedicated disposable local stack is deterministic; preview/production remains manual                       | Dedicated harness green                                     |
| C6  | scope/product decision | Optional `open` mode and package aliases add convenience but no safety                      | deferred                  | Excluded from v1                                                                                           | Revisit only after demonstrated operator friction           |
| C7  | scope/product decision | Legacy UX-audit helpers could be removed or retained locally                                | accepted: retain locally  | Refuse remote Supabase and remove committed password                                                       | Local-only/refusal tests and repository secret search       |
| C8  | tradeoff               | Auth app metadata does not itself exclude analytics                                         | accepted                  | Funnel `is_internal_test` is the analytics exclusion; app metadata is only a mutation/auth safety sentinel | Snapshot/status wording and analytics-marker assertion      |

Post-review mainline reconciliation:

- PR #350 added secure, short-lived field-test guest access after the original plan review.
- That guest flow is intentionally session-bound with no email recovery and seven-day access, so it cannot replace the reusable one-time-link QA owner.
- This slice reuses its canonical `test_kind = 'field_test'` suppression and tester-enrollment access contracts with deterministic 2099 expiry instead of inventing a second analytics/access mechanism. The public campaign remains revoked and unusable.
- Preparation moved into one atomic RPC because the Personal Plan lead trigger creates a Customer.io outbox row; separate client writes could briefly expose an incompletely classified synthetic lead.
