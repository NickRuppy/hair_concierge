# Billing trial210 second-layer proposal

Read-only proposal, not applied. Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; checked HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, branch `codex/test-audit-pruning`.

**Recommend three conditional C cuts, retaining 205 R and two F declarations.** This gives 210 → 210 after assertion transfer → 207 after cuts, across the same 31 files. No D, no source retirement, no replacement tests, no new calls, no new inputs, no new table rows and no skipped tests. Main owns all application and runtime proof. Current failures remain untouched.

## Evidence and phases

- Complete per-site ledger: `/tmp/test-audit-billing-trial210-ledger.md` and `.json` (every callback body, original line, decision and hash).
- Immutable prospective snapshots: `/tmp/test-audit-billing-trial210-proposal-pj1NC1/before`, `/transfer`, `/cut`, all 31 files in every phase.
- Exact full donor/keeper-before/keeper-after bodies and assertion/read-set unions: `/tmp/test-audit-billing-trial210-proposal-pj1NC1/candidates.json`.
- Compact complete diffs: `/tmp/test-audit-billing-trial210-proposal-pj1NC1/transfer.diff`, `/tmp/test-audit-billing-trial210-proposal-pj1NC1/cut.diff`.
- Full phase hashes, counts and repository input pins: `/tmp/test-audit-billing-trial210-proposal-pj1NC1/manifest.json`; SHA256 `741867fbc7dd285c1942d7ed0d0c23044c44f77ee7eee35bb16c43cdbb12060a`.
- Four source-only fault descriptors: `/tmp/test-audit-billing-trial210-proposal-pj1NC1/controls.json`. These are recipes, not a runner and not executed.
- Explicit read-depth inventory: `/tmp/test-audit-billing-trial210-read-scope.json`.
- Main commands as argv arrays: `/tmp/test-audit-billing-trial210-main-commands.json`.

All 93 prospective TS/TSX files parsed successfully with the installed TypeScript parser. The four uniquely anchored source faults also parse. Static assertions confirmed 210/210/207 sites and **206 unrelated callbacks byte-identical**. C1 and C3 keepers remain unchanged; C2 is the only changed keeper. No import/helper cleanup is needed. Static parsing is not compilation, test execution or semantic-red evidence. The prep script writes only /tmp artifacts and starts no children; no repository writer is supplied at this stage.

## C1 — real projection already owns the direct policy boundaries

Donor `tests/billing-trial-policy.test.ts:21`, `grants trial access from authorization inclusively until the immutable end exclusively`.
Keeper `tests/billing-trial-access-projection.test.ts:47`, `bridges the first-collection window at the seven-day boundary and locks when it closes`.

The two exact times are `2026-09-13T12:00:00.000Z` and `2026-09-20T12:00:00.000Z`. Both calls reach actual `resolveTrialAccess` with the same eight policy fields: those authorization/end instants, null first-payment/paid-through/grace, and false failure/cancellation/revocation. The projection first validates version 1, active admission, matching enrollment and trial cohort; those added fields are never read by policy. Its first deep equality contains the donor's complete start outcome; its second deep equality contains the donor's end reason plus access and phase. The keeper's existing third call also pins window closure. No transfer is needed.

Controls change actual `trial-policy.ts:159` authorization `>` to `>=`, then separately line 162 end `<` to `<=`. The retained keeper must fail its first and second exact outcome respectively. Offset parsing, invalid calendars, future authorization, cancellation, revoked access, and legacy null contracts remain separate retained inputs. SQL policy is an independent implementation, not replaced by this TS consolidation.

## C2 — exact Stripe sentence joins existing same-result contract oracle

Donor `tests/billing-trial-required-notices.test.ts:471`, `Stripe contract confirmation keeps the exact-moment first-charge statement`.
Keeper same file line 80, `contract confirms actual accepted progression, Berlin deadline, cancellation and full withdrawal instruction`.

Both builder invocations are literally `buildTrialRequiredNoticeMessage("contract_confirmation", snapshot)` against the same object binding. Transfer the donor's exact `/Die erste Zahlung ist zu diesem Zeitpunkt vorgesehen/` regex into the keeper's existing `message.receipt_text`. Preserve every keeper assertion and both existing changed-price/invalid-end calls byte-for-byte. No mock or expected-from-producer value is introduced. The source control changes only the real Stripe sentence at `trial-required-notices.ts:399` from `zu diesem Zeitpunkt` to `nach diesem Zeitpunkt`; the newly retained regex must fail.

History matters here: commit `a54ee67a` (#568) introduced the separate Stripe sentence test alongside PayPal day-after collection semantics. The public wording must remain; it is moved into a same-input oracle, not dismissed as implementation detail. Later `501769ff` (#570) froze PayPal ends; non-midnight versus frozen-midnight PayPal tests remain. Notice subject/content changes in `968d5083`, `816a77c2` and `49b28620` do not justify relaxing accepted-contract text.

## C3 — real persisted readback already rejects the same changed offer

Donor `tests/billing-trial-admission-postgres.test.ts:385`, `trial enrollment adapter rejects a successful upsert whose readback has different accepted terms`.
Keeper same file line 259, `trial admission adapter creates one immutable enrollment attempt through its real SQL shape`.

Both target actual `createTrialEnrollment` and compare stored monthly `OFFER` with a generated annual snapshot under the same `price_trial_month`, `price_trial_year`, `coupon_trial_year` catalog, id `IDS.first` and provider Stripe. The sole material fixture difference is matching null owners in the donor versus matching `IDS.profile` owners in the keeper. The actual owner only performs UUID validation when owner is non-null, then equality. Both inputs pass validation and owner/provider equality before the same annual-versus-monthly parsed-offer comparison at line 81. The keeper's **first** existing changed-input loop iteration is this annual mismatch; its other owner/provider iterations remain distinct and untouched.

The donor's table/select literals are already independently asserted by `pgliteAdmissionClient`. That adapter executes a real `INSERT ... ON CONFLICT (id) DO NOTHING` followed by a real SQL row read; it does not manufacture the mismatch error. The owner supplies the error, while real storage preserves the monthly row. Keeper also asserts exact upsert options, eq(id), idempotent creation and final row. No extra call or null-owner input is added.

Control: replace the unique actual `JSON.stringify(accepted) !== JSON.stringify(offer)` clause with `false`. The first annual mismatch `assert.rejects` must then fail with `Missing expected rejection`. Import/setup/SQL constraint failures do not qualify. All other policy/claim lifecycle callbacks remain.

`createTrialEnrollment` currently has no non-test caller in searched `src`/`scripts`; its comment and original `318cf157` version state that callers were not enabled yet. That does **not** authorize deleting it in this plan. Prior corrected orphan reports explicitly held storage/parser contracts. Current checkout uses its own attempt RPCs; no complete input union supporting retirement was established. This C removes a mocked duplicate while preserving the real adapter and its storage proof. `loadTrialManagementState` is also held, with all four actual test calls retained. No local cloned helper or RPC retarget is proposed.

## F findings — keep declarations, separate repair work, zero credit

1. `required-notices.test.ts:271`, `missing verified recipient and malformed snapshot send nothing`: both existing iterations use a null recipient and observe the same aggregate result. Actual delivery prepares the message first, then assigns either `notice_preparation_failed` or `recipient_owner_unavailable` before persisting settlement. A faulty early recipient check can keep this test green while losing the preparation diagnostic. Proposed strengthening: capture the already-existing settle call and assert the appropriate exact error code for each existing input. No new cases or production behavior change. This is a diagnostic-oracle gap, not proof that malformed payloads currently send email.
2. `history-backfill.test.ts:137`, `PayPal proof uses complete bounded actual transactions and rejects payer/app/window/duplicate/payment errors`: the wrong-payer retrieve stub also omits `create_time`. Actual verifier line 53 combines payer mismatch and missing creation timestamp in the same OR guard; removing the payer comparison still rejects for the missing timestamp. Repair needs the same wrong-payer case to include a valid creation timestamp from its existing fixture. No cut, no runtime proof, and no input correction applied here. Other app/window/duplicate/payment assertions remain useful.

## Rejected larger consolidations

- Policy, projection, SQL access and subscription/membership HTTP layers are not wholesale duplicates. SQL functions/triggers and projection linkage can fail while TS policy remains correct. Stored marker/null/owner/privilege defaults and legacy grace differ from direct facts. Only C1 has a complete same-operative-input union.
- Identity HMAC tuple bytes, retained-key rotation, rights erasure/suppression, shared-card correction, role grants and registry rollback are independently meaningful. Source-spelling assertions in the registry callback may merit zero-credit cleanup, but the callback also executes real role/storage behavior; no whole cut.
- Management, recovery and cancellation share fixture structure but assert different version CAS, provider ownership, selected offer, cancellation fence, immutable original contract, paid-debt and delayed webhook states. Mocked HTTP dependencies test routing/authorization, not persisted outcomes; SQL suites separately own persistence. No exact full replacement established.
- Analytics delivery mocks provider transport, while actual serializers generate requests and actual SQL tests produce/fence immutable events. Consent, provider and event identities are not inert differences. No fixture-only receipt declaration established.
- Original and selected offer decoders are frozen historical contract readers. No current-catalog substitution or unsupported legacy retirement.
- Research/ops-style commands are not dead because non-public: the launch runbook and notices/claims operations document explicitly retain backfill, rights, cancellation/reconciliation and rollback duties.

## Read scope, caller and CI limits

Every one of the 31 assigned test files was read completely, including all table rows and helper implementations. The directly imported production files were read fully except `result-offer-pricing.tsx`, for which only 1–114, 358–465 and 1620–1721 were inspected; no UI candidate is proposed. See JSON for precise file/hash list. Candidate C3's foundation and recovery-reason SQL files were read completely. The other 35 referenced SQL migrations were inventoried through replayed test chains and test assertions; their entire source bodies were **not** reread. Thus the 205 R judgments retain unmatched contracts; they are not a completed transitive source audit of every SQL owner. Installed PGlite/Supabase/React/provider packages were not reviewed internally or executed.

Current caller searches show policy used by Stripe webhooks and projection; projection used by subscriptions/membership, legacy portal and trial payment boundaries; management/recovery/cancellation and notice reconciliation have actual API route adapters; provider historical claims run from scripts/webhooks. Those broader caller files not in the complete-source list were navigation, not whole-file reads. Full launch runbook preserves disabled-new-enrollment rollback without dropping accepted-agreement reconciliation or retained identity keys. Notices/claims operations lines 167–218 explicitly support historical payment verification and rights registry commands.

`package.json:49` includes all assigned `.test.ts` and `.test.tsx` files in the native Node runner. `.github/workflows/ci.yml:146–168` runs `npm run test:node` on Node from `.nvmrc` (22). This is CI wiring evidence, not a CI result. Relevant candidate history was checked with current git logs and focused historical owner/test hunks; no exhaustive history claim. Hash-pinned files are not automatically claimed fully read.

## Main-only validation and stop conditions

Use the repository native runner with `--import ./tests/server-only-register.cjs --import tsx --test`, exact 31 filenames in the commands JSON. Run before, then transfer, then each selected fault serially, then cut/full cohort. Controls must each select exactly one keeper, obtain clean pass, intended assertion red, byte-exact owned restoration, clean pass. C3's selected keeper runs local PGlite only; no production DB or provider operation is required. Existing environment mutation knobs (`TRIAL_ADMISSION_MUTANT`, access mutant) must not be active. No attempt to turn existing failures green by pruning is authorized.

Main must recheck all current hashes before any write, inspect complete diffs, and preserve every non-target callback. Stop on drift or unintended red (import, setup, timeout, provider, DB constraint). After a coherent integrated batch, main owns CI/full native coverage and the unchanged <=2pp gate. This report makes no pass/coverage claim and no current removal credit.
