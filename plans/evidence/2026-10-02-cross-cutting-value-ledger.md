# Cross-cutting value lane — read-only handback

Workspace: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, branch `codex/test-audit-pruning`. Parent-supplied base: `21e0e41fa996ec6a725c258ab3766971f0edb94d`.

## Decision and accounting

- **C: 1 complete declaration**: consolidate the invoice-payment-failed console-only no-throw probe into the existing real webhook event keeper, with two input fields transferred.
- **D: 20 runtime rows, zero declaration credit**: duplicate Discovery TYPE_FIXTURES rows already covered by existing ADVERSARIAL owner-boundary cases. The retained loop still has its original declaration site. Do not add 20 to the campaign's declaration reduction.
- **F: 1 declaration**: premium keepsake no-read probe is genuinely vacuous because its thrown sentinel is caught by the owner. Repair the test; retain the contract.
- All other supplied candidates: **R**, with the distinctions below. No consolidation based merely on identical bodies. No test-declaration quota credit for regrouping.

Read root/task AGENTS, test-audit SKILL and CAMPAIGN. All 12 candidate bodies and their called assertion helpers were inspected, as were all seven identical-body groups including their relevant fixture rows. Related owner paths, caller references, CI/package routing and selected history were read. Large test/production files were inspected in the relevant sections; this is **not** a claim of complete reading of every sibling file or the whole repository. AST parsing was used only to compare literal fixture inputs. No test runner, compiler, provider call, browser, DB, mutation control or coverage measurement was run. No repository edits. This report is the only written file.

## The twelve no-local-assertion candidates

| Candidate | Mark | Actual value / decision |
|---|---|---|
| `tests/qa-validation.spec.ts:114` — send curated questions and capture AI responses | R | Supported operator capture, not an automated truth assertion. `test:qa` and `test:extract` remain in package.json:40,45; test persists per-question answer/error/reference JSON. Live selectors exist in chat-input.tsx:48,61 and chat-message.tsx:238. Authentication and wait failures feed the report, rather than pretending to verify answer quality. Removing this would remove an operator workflow. No retirement evidence. |
| `tests/tracker-page.spec.ts:497` — 403 autosave redirects | R | `waitForURL` is a real timeout assertion for the specific reactivation URL after a fixture 403. Actual owner `src/components/tracker/use-tracker-autosave.ts:108–134` performs fetch and location.assign; a generic HTTP or autosave-unit assertion would not prove browser navigation. |
| `tests/discovery-intake-usage-migration.test.ts:130` — legacy rows still pass | R | Real SQL INSERTs reject if migration's new constraints disallow legacy catalog, name-research or explicit-none shapes. Lack of assert syntax does not make successful SQL acceptance vacuous. Siblings mostly test new types/roles; they do not replace all three legacy null-product-type shapes. |
| `tests/agent-v2-manual-regression.spec.ts:92` — agreed ten-case fixture batch | R | `findPrompt` and `findTurns` call assert.ok. This is an operator regression-inventory contract, not runtime-agent proof. Sibling tests:113,158,185 pin expectations for seven of the ten cases, but do not prove presence of the oil, leave-in comparison, and colored/dry/frizz prompts. Removing it would silently remove that remaining breadth guard. Historical AgentV2 plans explicitly retain the manual fixture. Do not describe it as answer-quality verification. |
| `tests/discovery-cli.test.ts:182` — half-gated mutation refuses all writes | R | `refuses` uses assert.rejects with the specific authorization error, while every forbiddenGateway method throws a different error. Detects entry-point gate bypass, not merely gate predicate results. Owner is supported `scripts/discovery.ts`; keep alongside direct gate tests because CLI integration can omit the predicate. |
| `tests/personal-plan-stage3.spec.ts:236` — no empty Conditioner assignment page | R | `expectRoutineAuthHandoff` waits for `/auth?next=/routine`. Lab selects inventory-only context and mounts the real Stage3ProductsFlow (`lab-client.tsx:19–70`) with an in-memory persistence adapter. Wrong empty-role screen would prevent handoff. Native package lane exists and CI runs it. |
| `tests/oil-heat-capability-simplification-migration.test.ts:732` — retained Oil roles accepted | R | `pg.exec(migration)` must succeed with an accepted routine using dry_finish and leave_on_fibre_conditioning. The owner SQL:224–253 intentionally distinguishes those from legacy heat-role collisions; next sibling rejects pre_heat_protection. This positive control prevents overbroad rejection. |
| `tests/freemium-lapsed-user-matrix.test.ts:110` — premium never reads keepsake | F | The injected sentinel throw is caught by `resolveAuthenticatedAppAccessState` and mapped to `free`; the test discards the result. A removed premium short-circuit can remain green. Exact repair/mutation below. |
| `tests/mobile-sidebar-close.spec.ts:134` — select conversation under reduced motion | R | `expectSidebarClosed` asserts dialog hidden within 1s. Actual ChatContainer owns reduced-motion close and route-change lifecycle. Separate action from Plus/X/backdrop/Escape. External-state setup exists, so do not run casually in this frozen read-only lane. |
| `tests/mobile-sidebar-close.spec.ts:143` — X/backdrop/Escape normal motion | R | Three real UI actions each assert dialog hidden. Owner ChatContainer:427–450 transitions through closing and timer fallback. These are distinct browser event paths; helper reuse is appropriate. |
| `tests/stripe-webhook-handlers.spec.ts:687` — invoice.payment_failed logs/no throw | C | Console-only no-throw probe is subsumed by the existing real webhook-event keeper in customerio-stripe-webhook.test.ts:817. Transfer customer and attempt_count fixture fields first; see evidence below. |
| `tests/offer-payment-overlay.spec.ts:166` — mobile viewport matrix | R | Helper:34–120 checks actual document/dialog/scroll surface/row/card/CTA geometry, both available and failed Apple Pay. Four viewports cover actual responsive geometry; hidden assertions are meaningful. `@ci` and mobile WebKit matching exist. |

## Seven identical-body groups

1. **PostHog confirmation/SHA guard pair: R both** (`v3:107`, `v4:123`). Separate supported package commands call separate `runMigration` implementations. Their guard blocks can drift independently. The specific rejection assertions and zero fetch count genuinely prove each write gate.
2. **PostHog annotation-only retry pair: R both** (`v3:204`, `v4:220`). V3's pending/after logic and V4's `expectedAfterFingerprint` logic are different owners (`scripts/posthog/...v3...:424`, `...v4...:440`). Each mock starts in its own transformed revision and detects unnecessary PATCH versus one annotation POST.
3. **Four local migration ordering checks: R all**: frequency-heat:134, call-decisions-per-item:158, admin-item-usage-styling:143, call-sheets:61. Global `tests/supabase-migration-version-uniqueness.test.ts:6` duplicates only uniqueness. Each local declaration independently checks distinct prerequisites precede OWN. Their migrated helpers apply explicit CHAIN order; they do not exercise deployment lexical ordering. `scripts/mobile/check-migrations.mjs` checks additions after a pinned mobile baseline, not these exact dependency edges. Moving four checks into one table is not a valid reduction.
4. **PostHog dry-run GET-only pair: R both** (`v3:93`, `v4:109`). Independent supported command owners; future accidental write can enter one without the other. Assertions verify emitted methods, not only a declared flag.
5. **Stripe lost-session pair: R both** (`stripe-trial-management-approval.test.ts:273`, `stripe-trial-paid-recovery.test.ts:411`). Restore uses setup-mode session and `trial_management_purpose=restore_authorization`; paid recovery has separate session discovery and `trial_paid_recovery_operation_id`. Test mocks persist the created session before throwing response loss; actual owners must list/adopt it to avoid second creation. Separate real route callers exist in trial-management, trial-paid-recovery and continuation reconciliation. Identical count assertions here cover two real failure paths.
6. **Discovery type fixture-loop pair: mixed**. The base and B7 loops have different inputs; do not delete one wholesale. Twenty base rows independently overlap the existing composed ADVERSARIAL boundary and are D below; remaining base rows and the B7 loop are R. T13 is a real runtime branch discriminator, unlike T1–T12 diagnosis labels. B7 spray-step tests do not independently assert every productType result, so they are not silently substituted for all B7 type rows.
7. **Billing maxDuration pair: R both** (`payment-monitor-route.test.ts:39`, `billing-reconcile-analytics.test.ts:55`). These are separate Next route config exports consumed by the platform, not an internal identifier inventory. Payment monitor declares 60s around its 40s work budget; reconcile independently declares 60s around its bounded work. Equality of the literal doesn't make the owners interchangeable.

## C-ready complete declaration: invoice no-throw probe

Exact retirement: `tests/stripe-webhook-handlers.spec.ts:687–691`, plus its otherwise-unused `handleInvoicePaymentFailed` import at line 11. Actual owner `src/lib/stripe/webhook-handlers.ts:1096–1102` is a console.warn of invoice id/customer/attempt. It stays: real caller is `src/app/api/stripe/webhook/route.ts:902`.

**Primary existing keeper**: `tests/customerio-stripe-webhook.test.ts:817`, `Stripe invoice failure reports once without exposing an invoice reference`. Parent located this stronger keeper; I then read its complete body, stubDeps read path, route dispatch, trial handler early return, and profile lookup. It awaits the real `handleStripeWebhookEvent`, reaches the real logging helper, and asserts one classified payment signal with provider-reference privacy. Unlike the direct smoke, it cannot pass if dispatch drops the invoice-failure case.

**Transfer before retirement**: add `customer: "cus_1"` and `attempt_count: 2` to the keeper's existing `in_failed` invoice object; preserve its internal-test parent metadata and telemetry assertions. The direct probe's arbitrary `in_1` identity requires no exact-byte transfer; the keeper already supplies a real string id and independently verifies that it is not exposed in telemetry.

Call trace after transfer:
1. `handleStripeWebhookEvent` dispatches invoice.payment_failed at route:871.
2. `handleStripeTrialInvoice` (`trial-invoice.ts:73–96`) finds no subscription id and no trial marker and returns null, before provider reads.
3. Route captures one failure signal, then awaits **actual** `handleInvoicePaymentFailed` at:902.
4. `customer: cus_1` now reaches `findProfileByStripeCustomerId` at:905. Keeper's empty profiles fixture and maybeSingle implementation return null; the event breaks before analytics writes or Customer.io scheduling. No provider/network action is introduced by this fixture transfer.

Lost assertion: none after the awaited keeper reaches the same helper with id/customer/attempt fields. Logging bytes were never asserted. Do not substitute unrelated `stripe-webhook-failure.test.ts`; it guards typed retry handling, not this path.

Actual-owner mutation after the runner freeze: save bytes of webhook-handlers.ts; temporarily make handleInvoicePaymentFailed throw a unique `audit_invoice_failure_sentinel` before console.warn. Run only the keeper by exact test-name pattern and require that sentinel as the rejection/failure. Restore byte-for-byte and require keeper green. A telemetry-only mutation is insufficient because it would not prove reachability of the logging helper. No mutation was run in this lane.

Native verification after freeze:
- Node keeper/control: `node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='Stripe invoice failure reports once without exposing an invoice reference' tests/customerio-stripe-webhook.test.ts`
- Full keeper: `node --import ./tests/server-only-register.cjs --import tsx --test tests/customerio-stripe-webhook.test.ts`
- Direct old/new native lane: `npx playwright test tests/stripe-webhook-handlers.spec.ts --project=chromium`. This is the pure Playwright handler-contract file with stubDeps, not a browser journey; preserve the parent plan's own Playwright before/after coverage measurement rather than inferring coverage from Node.

First direct test-file history: `d779e0af` (Stripe subscription hard paywall / embedded checkout / portal #43). Keeper latest history: `66b03bcc` (iOS paywall #617). Unlocked deletion: import and direct test body only, zero production LOC; export remains production-used. One real declaration retired, one existing declaration extended, no regrouping credit.

## D-ready runtime rows: classifier private replay below composed owner

Owner flow: `classifyDiscoveryProduct` at `src/lib/discovery/classify.ts:544–550` always calls `classifyDiscoveryProductType`, then computes the real next step. `pickCapture` in `src/components/discovery/intake/add-flow.ts:334` and manual-name flow:376 consume `{productType, step}`. The only classifier rule-label consumers found under src/scripts are T13 comparisons in classify.ts:549,584. Full literal searches for the discarded rule IDs/types across src/scripts/docs/plans (excluding campaign evidence) found source declarations/returns and one historical B7 finding about T12→question, not durable protocol/storage/operator consumers. The runtime decision on spray uses T13 and is retained.

All entries below are in `tests/discovery-classify.test.ts`. Remove the TYPE_FIXTURES row, retain the ADVERSARIAL row and its existing loop:353. Omitted `catalogCategory` and explicit null normalize identically via the owner optional chain. This is the same function execution plus additional user-step proof, not a different owner mistaken for a duplicate.

| TYPE line | Exact name input | Keeper fixture line | Expected productType / next step |
|---:|---|---:|---|
|67|Scalp Oil|310|oil / oil_scalp|
|75|Haarkur Leave-in|314|leave_in / leave_in|
|78|2in1 Shampoo & Spülung|312|null / what_is_it|
|83|2in1 Öl-Kur|345|null / what_is_it|
|84|Color Shampoo|347|null / what_is_it|
|87|Scalp Treatment|339|scalp_care / fixed|
|88|Kopfhaut-Kur|340|scalp_care / fixed|
|89|Kopfhaut-Serum|341|scalp_care / fixed|
|92|Öl-Kur|330|oil / oil_pre_wash|
|93|Oil Treatment|331|oil / oil_pre_wash|
|94|Haaröl-Kur|332|oil / oil_pre_wash|
|96|Scalp Oil Treatment|337|oil / oil_scalp|
|98|Pre-Shampoo Öl|333|oil / oil_pre_wash|
|99|Pre-Wash Oil|334|oil / oil_pre_wash|
|101|Leave-in Öl|335|oil / oil_damp|
|102|Leave-in Oil|336|oil / oil_damp|
|106|Argan Oil Shampoo|343|null / what_is_it|
|109|Leave-in Conditioner mit Öl|344|null / what_is_it|
|110|Olaplex|323|null / what_is_it|
|111|empty string|326|null / what_is_it|

Actual lost assertions: exact T3/T4/T5/T7/T8/T9/T10/T11/T12 explanation-label spelling/which branch returned it. These may change in a behavior-preserving rule reorganization. All product types are already asserted independently as literals in the keeper. No product assertion transfer required. No exported source removal is unlocked: direct classifier remains genuinely called by the composed classifier and spray-answer classification. The loop remains for unique inputs.

History: created with `2bb16f10` (flat product checklist #608); latest touched `6458825e` (capture/frequency/heat/styling batch 7b #612). The current source and test comments describe the adversarial layer as deliberate end-to-end type+step behavior. Removing duplicate diagnosis-specific rows preserves those behavior decisions.

Native focused proof after freeze:
`node --import ./tests/server-only-register.cjs --import tsx --test tests/discovery-classify.test.ts tests/discovery-classify-b7.test.ts`

For preservation controls, mutate actual classifier branch result productType (for example T9 oil→mask, T4 scalp_care→mask, unknown→oil) and verify corresponding retained ADVERSARIAL cases fail, then restore byte-for-byte. Use one mutation at a time with no concurrent runners or edits. These controls have not been run. Production/support LOC unlocked: zero. Runtime rows removed:20; test declaration sites removed:0.

## F repair and actual-owner control: premium no-read

Keep declaration at `tests/freemium-lapsed-user-matrix.test.ts:110`. Replace throwing sentinel with a counted async read and assert **both** final tier and calls:

```ts
let keepsakeReads = 0
const state = await resolveAuthenticatedAppAccessState({
  ...accessStateDeps({ tier: "premium" }),
  hasKeepsakeContent: async () => {
    keepsakeReads += 1
    return false
  },
})
assert.equal(state, "premium")
assert.equal(keepsakeReads, 0)
```

This avoids changing accessStateDeps's narrow helper typing. Actual owner `src/lib/auth/authenticated-app-route-access.ts` loads tier then returns premium before getUserId/hasKeepsakeContent; its second try/catch intentionally absorbs keepsake errors. Actual non-test loader calls it and is used for authenticated page access. Nearby truth-table test checks premium result, but cannot detect a gratuitous caught keepsake read. That makes the zero-read contract distinct.

Control after freeze: save owner bytes, temporarily change `if (tier !== "free") return "premium"` to a braced premium branch that awaits `deps.hasKeepsakeContent((await deps.getUserId())!)` and then returns premium. This preserves output so **only the new zero-call assertion** detects the regression. Run exact named test, require failure `1 !== 0`, restore owner bytes, rerun exact test to green. A second simpler control removing the short-circuit would prove the output assertion, but is unnecessary once the zero-read mutation is caught and existing truth-table remains green.

Native command:
`node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='a premium tier never performs the keepsake read at all' tests/freemium-lapsed-user-matrix.test.ts`

No edit/control was performed while whole181 is active. File latest history: `521f8da8` (Freemium PR6 #530). Source's explicit cost-identity comments and no-second-read behavior explain retention; no invented architecture policy is needed.

## Additional bounded leads inspected

- `tests/discovery-cockpit-api.test.ts:416` computes expected sourceHash via composer. **R**: the route is the owner under test and the real composition function is a collaborator; test independently checks which current inputs reach persistence and response. This does not independently verify hash algorithm correctness, and should not claim that, but it is not a self-comparison of the route result.
- `tests/discovery-runsheet-page.test.tsx:622` derives row labels via `runsheetWeek(buildDiscoveryCockpitView(model()).steps)`. **R**: render boundary independently checks semantic table headers, one row per source step, row headers, and frequency placement. Expected-from-owner warning does not eliminate DOM wiring value. No whole-file deletion proposed.
- `tests/agent-v2-manual-regression.spec.ts:336` includes a locally defined canonical treatment set, then asserts that the same local set contains permed/chemically_straightened. That tiny loop is tautological and can be removed with **zero declaration credit**. Remaining profile completeness/enum compatibility checks are real fixture-shape guards. No whole-file deletion is supported: guidance runner consumes named profiles and embeds quality criteria in operator reports, and sibling fixture tests guard distinct subsets.

## Verification limits and remaining uncertainty

No current pass/fail, mutation, coverage or performance claim. No network/provider state was inspected. Existing package/CI commands demonstrate routing, not successful runs. Invoice C requires fixture transfer and an actual-owner throwing control before claiming replacement proof. Exact source line numbers are from the inspected dirty worktree and may shift if other lanes edit. Parent should review the full integration diff and run the native tests after the freeze before applying campaign count/coverage receipts.
