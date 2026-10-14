# Historical one-time fulfillment75: layer decision

**Conditional proposal: one C, zero D; retain64 R and ten held F.** Eight files contain75 declaration sites (2,677 lines), unchanged from navigation575. C1 alone is staged:75→75→74. First-access has one template with four rows, giving a static runtime estimate78→78→77, not an executed result. No source, export, support, case table, skip or provider operation is removed or added.

Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; branch `codex/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. The inherited campaign requests removal of least useful tests with coverage within2 percentage points; that objective is not evidence of redundancy. Main owns final scope and all mutation/native/coverage execution. No renewed product choice or authorization is needed for this read-only handback.

## C1: repeated command invocation, complete receipt union

- Donor `tests/one-time-recovery-command.test.ts:471`, **redacts provider, user, lead, consent, token, session, and email values from output**.
- Keeper same file:330, **applies only when confirmation exactly matches the target**.
- Both call `fakeDeps()` without overrides, `parseOneTimeRecoveryArgs` with the identical ordered Stripe provider/session/apply/exact-confirm argv, then `runOneTimeRecoveryCommand` once. Destructuring `calls` in the keeper is observation only; the donor's fakeDeps builds the same array and callbacks. No owner branch, argument, dependency receipt or stored state differs.
- Keep keeper mode=`apply`, guard=true and exact verification→activation→receipt call list. Append the donor's original `JSON.stringify(receipt)`, all-eight-sensitive-value negative loop (including its existing diagnostic), and positive `29.99` / `EUR` assertions. No expected value comes from the owner, no new input or owner call, no fresh case or table row. No new bare assert.ok.
- The actual command does fixed-offer validation and receipt construction after actual delegated verification/activation/read ordering. The fake seams return a verified payment and receipt; they do not construct the public command receipt or enforce command order. This is the canonical command boundary for both callbacks.
- Both callbacks originated in `0d29b871` (#293, 2026-08-01). The commit describes captured real money with incomplete local fulfillment and specifically keeps the operator recovery path. Their separation is not a unique regression input.
- Full exact donor/keeper/after bodies, input equivalence and line/byte hashes: `candidates.json`. Full prospective diff: `complete.diff` (one test file, net12 lines removed). Full before/transfer/cut snapshots exist for all eight files,24 parsed files;73 retained callbacks are byte-identical and one existing keeper changes. Noncallback support/imports are identical after reconstruction. No test-only seam closure unlocked.

Six source controls in `controls.json` are static recipes, not proof: receipt email leak; wrong fixed amount; wrong currency; wrong apply mode; wrong guard receipt; receipt read moved before activation. The first three establish transferred donor sensitivities; the last three check original keeper order/fields. Every recipe is a unique replacement inside real `runOneTimeRecoveryCommand`, TS syntax parsed, source hash pinned, exact one selected callback, phase-specific intended assertion line/text and `ERR_ASSERTION` operator. No setup, SQL, import failure, process timeout or unhandled rejection qualifies as proof. Main must run one clean selected case→one fault→intended assertion→byte restoration→clean selected case serially before cutting.

## Why the historical layer stays

Positive current paths, not rollout assumptions:

- `package.json:189` registers `billing:one-time:recover`; CLI `scripts/billing/one-time-recover.ts:740–762` invokes parsers and real dependency factories. `docs/runbooks/one-time-payment-recovery.md` prescribes exact-target dry-run/apply and sanitized receipts. `main()` dispatches expired-reset separately. No operator entry is retired merely because public experiment assignment is disabled.
- Real `src/app/api/billing/one-time-activation-status/route.ts:57–151` GET injects default Stripe/admin/link/limiter/defer dependencies and handler composes provider verification/activation. Actual consumers: welcome-client status URL builder:859–868 and PayPal button fetch:437–452. Middleware/route-classification also permit that endpoint. Cohort handler tests execute Request/NextResponse mapping with provider stubs; they do not prove default GET construction or actual provider network behavior.
- `src/app/api/billing/reconcile/route.ts:117–156,371–387,444–492` has authenticated cron entry, explicit retry flag, real reconciler and lazy Stripe/PayPal processor dispatch. `vercel.json:30–31` schedules it daily02:15. Current enabled/disabled deployment state was not inspected.
- Stripe `ensureOneTimeCheckoutAccount` is called by welcome:187, set-checkout-password:291, send-magic-link:313 and status route:89. Its retry processor:649 is loaded by reconcile. Full Stripe owner, canonical activation, purchases and consent storage adapters were read; tests with missing metadata, revoked charges, wrong consent/offer identity, no-op profile linking and deferred linking exercise different operative branches. Canonical activation stubs or route outcomes cannot replace them.
- `src/lib/billing/personal-plan-one-time-activation.ts:432–465` calls actual confirmation sender for unsent evidence. Payload builder is called by sender; configured-ID helper is called by builder. Historical consent versus neutral purchase context remains versioned behavior from `56c6dfae` (#318), not a dead experiment fixture.
- `src/app/result/[leadId]/page.tsx:393–403` invokes first-access evidence writer after authenticated identity resolution, with best-effort catch. The helper's match/filter/conditional-write body remains live.
- `src/app/plan-bereit/page.tsx` default route uses its exported access resolver and recovery component; pending entitlement ownership and no-duplicate-purchase UI remain current.
- Full recovery migration and both runbooks read. SQL RLS, service-role grants, immutable payment identities, backfill exclusions, skip-locked claims, lease timestamps and evidence gates remain historical storage contracts. Static SQL assertions are not an executed migration or actual RLS proof, but lack of that stronger execution does not justify deleting them.

No production/export deletion is supported. Imports, real internal calls, file-based Next routes, cron dispatch and package CLI provide concrete consumers. No hypothetical future caller was needed to retain a seam.

## Rejected consolidations

1. Confirmation payload versus sender: builder fixture preserves a literal trailing newline in legal snapshot text; sender fixture lacks it. Changing input or adding a second call would manufacture equivalence. Core activation captures a different snapshot input before serializer, while shared transactional transport tests use different messages and payloads. Keep payload/config/legal-kind/malformed-input contracts.
2. Sentry builder versus capture callback: builder uses PayPal/retry_exhausted/attempts5; capture uses Stripe/permanent_mismatch. The existing default-capture call does not use the donor details. Do not add a new capture input for quota.
3. Stripe happy activation versus no-op/deferred/legacy retry: these alter actual dependency side effects, scheduling or stored-job entry. Some final output fields coincide; that is not an entire input/readset/side-effect union.
4. Status revoked Stripe versus PayPal: they read different real provider result properties (`state` versus `status`) and dispatch branches. Independent mappings survive.
5. Recovery route versus recovery CLI default PayPal order: common collaborators do not establish the CLI factory's actual binding/order. Its weak source guard is held F4, not silently transferred to another owner.
6. Recovery component SSR and resolver versus source page checks: neither executes the full page selection. The weak source guard should be repaired, not removed on the strength of the separate component output.
7. Migration backfill, table privileges and runbook: same source file alone is not a repeated owner operation. They protect different independently normative storage/operator policies; do not pack unrelated static checks for count.

## Ten held F repairs: zero credit, unchanged snapshots

1. Stripe replay:632 — add monotonic send-attempt count and assert zero after both existing calls. An unconditional resend enters a throwing stub, is caught by canonical activation, and stored complete evidence can still produce active. Proposed old-pass/new-red fault: in `tryCompletePersonalPlanOneTimeActivation`, force its unsent-confirmation condition true; preserve all other guards. Static reasoning only; no fault was run.
2. Reset negative rows:202 — keep existing four rows but make unrelated merchant/purchase-unit fields valid for status, capture and ID negatives. Today missing merchant and/or unit shape can independently reject. Separate source faults bypass each named status/capture/ID conjunct; old may pass, repaired should reject at intended assert.rejects. Not staged because it changes fixture validity and needs its own focused review/proof.
3. Repeated CLI apply:364 — rename to repeat delegation/receipt stability. Stub returns fixed `ok` and fixed receipt, so no claim of database or provider idempotence. Pair target remains the only positive order+capture parser branch here.
4. CLI private source order:381 — missing marker gives index−1<activationIndex and false green. Retain until repaired with nonnegative anchors at minimum or real factory-boundary observation. Do not claim status-handler capture ordering covers this implementation.
5. Reconciler limit:16 — literal5 independent of imported limit constant; existing full dispatch/stats assertions stay. Actual SQL due-job cap not exercised by the fake claim seam.
6. Reconciler captured raw error:126 — stats/details privacy is meaningful, but serializing Error does not observe its message. This injection point intentionally receives original error for downstream sanitization. Narrow claim to stats/details and rely on repaired actual capture F7 for message sanitization.
7. Actual Sentry capture:420 — inspect captured Error.message directly for original email/payment reference. Fault appending original message to safe coded message would preserve current positive code match and evade current JSON negative. No real Sentry transport claim.
8. plan-bereit source ownership:17 — current private identifier/assignment grep lacks executed read provenance. Retain contract pending owner fixture; no equivalent existing page invocation established.
9. paid-pending source switch:32 — a preceding redirect could bypass matching switch source; SSR and pure decision do not exercise that full selection. Keep existing copy/source checks pending delivered page oracle.
10. result-page evidence source:190 — private helper/catch/ResultPageClient syntax does not execute failure continuation or access propagation. Keep until meaningful boundary observation is established; no helper removal.

## Read breadth and verification limits

- Entire eight target tests including helper query implementations, all table rows and both repeated owner calls:2,677 lines/75 sites, hashes match prior navigation.
- Full owners: CLI762, Stripe1,572, canonical activation863, reconciler360, purchases, consent adapter226, first-access62, confirmation129, transactional sender, status route215, ready page338, complete SQL recovery migration and both runbooks.
- Larger adjacent files were sliced deliberately: PayPal order owner1–109/253–383/534–999; reconcile route operative entry/dispatch; welcome/auth/result/client callsites; selected complete overlapping test callbacks without rereading all their support. The proposal depends only on fully read command fixture/owner. Exact per-file depth is in49-readset manifest; hash-only configs/dependencies explicitly labeled.
- Installed NextResponse JSON constructor confirms actual Response body/headers mapping. Actual Zod4 entry and string email/trim checks inspected; an initial v3 navigation read is explicitly not the current dependency claim. Supabase/Stripe/PayPal are injected in candidate execution; no actual provider/database semantics are inferred from those mocks. No SDK transport behavior is being removed.
- `package.json:49` test:node registers top-level .test.ts/.test.tsx, so all eight stay on the same native lane; `.github/workflows/ci.yml:145–160` runs it. No CI declaration/config change.
- Read-only historical log/diffs: #279 original experiment; #293 captured-payment recovery; #303 no-recapture PayPal recovery/guarded reset; #318 neutral context with historical evidence compatibility; #376 ready-route ownership. No deployed flag/provider/history state queried.
- Static check only:24 snapshots parse, exact reconstruction,75/75/74 AST sites,73 untouched retained callbacks,49 readset hashes,6 source mutants parse. No compiler, test/native/browser/provider/DB/owner import/runtime mutation run. Parent's global gate remains its own receipt, not this review's proof.

## Main-only commands after frozen runner closes

Read-only proposal verification now:

```sh
cd /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning
node /tmp/test-audit-one-time-fulfillment75/static-check.cjs
```

Native cohort command for parent before→transfer→cut (not run here):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/stripe-one-time-confirmation.test.ts tests/one-time-recovery-command.test.ts tests/billing-one-time-fulfillment-reconcile.test.ts tests/one-time-activation-status-route.test.ts tests/personal-plan-one-time-confirmation.test.ts tests/one-time-paid-pending-ux.test.ts tests/one-time-payment-recovery-migration.test.ts tests/personal-plan-one-time-first-access.test.ts
```

Exact selected control command (one original keeper declaration):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern '^applies only when confirmation exactly matches the target$' tests/one-time-recovery-command.test.ts
```

No repository-writing editor or runtime fault driver is included/needed for read-only adoption. `prepare.py`, `ledger.py`, `controls.cjs`, `inventory.cjs` are temporary proposal-authoring files, not operator runners; do not regenerate a frozen proposal without reviewing changed hashes. Main may integrate the byte-pinned existing snapshots through its guarded single-writer tooling, transfer first, inspect controls, then cut. Held F files stay byte-identical.
