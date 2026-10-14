# Cross-cutting second layer plan

2026-10-02. Worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Input: `/tmp/test-audit-cross-cutting-value-next.md`. Scope: only invoice C1, the 20 Discovery fixture rows, and premium no-keepsake F1. This review performed no repository edits, runners, mutations, providers or DB actions; only this `/tmp` plan was written.

**Verdict: proceed after the invoice keeper strengthening below.** The 20 Discovery row cuts and premium F repair are supported as proposed. C1 needs a positive receipt from the real logging helper in addition to its fixture transfer. The initial unqualified Playwright command must use the now-created isolated configuration. These are bounded test-evidence corrections, not new product policy or source behavior.

## Scope and counting

The inherited campaign contract remains the least-useful 20% of 11,892 baseline declarations (2,379), with full global coverage within two percentage points. Main reports full-181 complete with exact hashes, type/lint/build/coverage gates and the same 26 baseline failures; that evidence is parent-reported, not rerun here.

- Remove **one Playwright test declaration**, after extending one existing Node keeper. Campaign declaration count can move **181 -> 182** only after that actual removal is verified.
- Remove **20 Node runtime fixture cases**, but **zero Node declaration sites**. TYPE_FIXTURES has 49 literal rows before this change; it will retain 29 rows and its same loop declaration. ADVERSARIAL retains all 29 current literal rows.
- Repair the existing premium declaration without deletion credit. No new test declarations, runtime exports or production seams are introduced or removed.
- Intended repository write scope for main: `tests/stripe-webhook-handlers.spec.ts`, `tests/customerio-stripe-webhook.test.ts`, `tests/discovery-classify.test.ts`, `tests/freemium-lapsed-user-matrix.test.ts`. Preserve prior campaign edits. No other candidates in the input report are part of this plan.

## C1: real invoice dispatch keeper, positive helper receipt

Delete `tests/stripe-webhook-handlers.spec.ts:687`, `invoice.payment_failed logs and returns (no throw)`, and its otherwise-unused handleInvoicePaymentFailed import. Keep the production export at `src/lib/stripe/webhook-handlers.ts:1096`: the real webhook route imports and awaits it at route.ts:902. The direct old test only awaited this helper with `{id:"in_1", customer:"cus_1", attempt_count:2}`. It never asserted a message prefix or byte format.

Keeper: `tests/customerio-stripe-webhook.test.ts:817`, `Stripe invoice failure reports once without exposing an invoice reference`.

1. Transfer `customer: "cus_1"` and `attempt_count: 2` into its existing in_failed invoice. Preserve parent subscription_details metadata `{is_internal_test:"true"}`, environment scopes, actual route dispatcher and all existing telemetry classification/privacy assertions. The differing invoice ID is intentional; the keeper already checks that its invoice reference is absent from telemetry.
2. Around that awaited invocation, count actual console.warn emissions with a local monotonically increasing counter, restoring the original console.warn in **finally**. Do not mock handleInvoicePaymentFailed or replace the route dispatcher. After success, require exactly one warning emission. Do not inspect the private prefix, argument positions/shape, object payload or serialized bytes. The invoice/customer/attempt fields are transferred as real input, not turned into a new private logging-body assertion.
3. Keep the empty profiles fixture. The transferred customer now reaches the real findProfileByStripeCustomerId with the stub's actual query builder, which returns null. There is consequently no billing-analytics write or Customer.io deferred work in this scenario. A diagnostic observer on the local from/profiles query is permissible to verify this path during a control, but do **not** make lookup ordering a new test invariant.

Why strengthening is needed: the current keeper emits and asserts telemetry **before** awaiting the logger. A route early return after telemetry could leave its assertions green while removing the only remaining path into the helper. The scoped emission counter makes delivery at the actual logging boundary positive; the actual-helper throw control below separately proves that this input reaches that helper. A warn-argument assertion would reintroduce private call-shape/body-restatement coupling without preserving an old assertion, so it is intentionally excluded. This is a routine behavioral test repair within the consolidation, with zero extra declaration credit; it does not impose a new production logging policy.

Actual path, source-established: `handleStripeWebhookEvent` invoice.payment_failed -> real handleStripeTrialInvoice -> legacy return null -> capturePayment -> await handleInvoicePaymentFailed -> customer profile lookup -> missing-profile break. The trial helper sees neither a subscription ID nor a trial_-prefixed marker; is_internal_test is not such a marker, so it returns before provider/billing reads. This is why customer transfer is valid without preparing a trial protocol fixture. The log-before-query order is observed in current source, not adopted as a new ordering contract. The actual HTTP POST calls the same dispatcher at route.ts:1065; signature/dedup/HTTP handling remain outside this keeper and are not claimed as replaced.

Required control: temporarily throw a unique `audit_invoice_failure_sentinel` **inside actual handleInvoicePaymentFailed**, before console.warn. The exact Node keeper must fail with that sentinel (not a profile-fixture failure). Restore source byte-for-byte and require green with one actual warning emission. A telemetry mutation, fake handler throwing, or only proving a profile read is insufficient. Main may also remove the logger invocation temporarily to prove the positive receipt catches an early return, but that is not a substitute for the actual-helper fault.

History verified: direct declaration introduced by d779e0af (#43); Node invoice signal keeper introduced by 056f5954 (#294), with later file evolution including the iOS work cited by the first report. The original no-throw probe was appropriate to the initial log-only helper; the current real-dispatch keeper can own the same contract once strengthened. Production/support LOC unlocked: zero.

## Discovery: exact behavior already owned by the composed classifier

All 20 candidates are TYPE_FIXTURES rows in `tests/discovery-classify.test.ts`. Their full inputs have a literal name and no catalogCategory property. Each listed keeper is an existing ADVERSARIAL row in the same file; its actual loop calls `classifyDiscoveryProduct({name: fixture.name, catalogCategory: fixture.catalogCategory ?? null})`, asserts literal productType, then asserts the step kind/preselection. Nothing is precomputed with the helper under test.

| Remove TYPE row line / exact name | Retained ADVERSARIAL line | Literal type / step |
|---|---:|---|
| 67 Scalp Oil | 310 | oil / oil_scalp |
| 75 Haarkur Leave-in | 314 | leave_in / leave_in |
| 78 2in1 Shampoo & Spülung | 312 | null / what_is_it |
| 83 2in1 Öl-Kur | 345 | null / what_is_it |
| 84 Color Shampoo | 347 | null / what_is_it |
| 87 Scalp Treatment | 339 | scalp_care / fixed |
| 88 Kopfhaut-Kur | 340 | scalp_care / fixed |
| 89 Kopfhaut-Serum | 341 | scalp_care / fixed |
| 92 Öl-Kur | 330 | oil / oil_pre_wash |
| 93 Oil Treatment | 331 | oil / oil_pre_wash |
| 94 Haaröl-Kur | 332 | oil / oil_pre_wash |
| 96 Scalp Oil Treatment | 337 | oil / oil_scalp |
| 98 Pre-Shampoo Öl | 333 | oil / oil_pre_wash |
| 99 Pre-Wash Oil | 334 | oil / oil_pre_wash |
| 101 Leave-in Öl | 335 | oil / oil_damp |
| 102 Leave-in Oil | 336 | oil / oil_damp |
| 106 Argan Oil Shampoo | 343 | null / what_is_it |
| 109 Leave-in Conditioner mit Öl | 344 | null / what_is_it |
| 110 Olaplex | 323 | null / what_is_it |
| 111 empty string | 326 | null / what_is_it |

Normalization distinction checked: removed inputs pass undefined catalogCategory; keepers pass null. `classifyDiscoveryProductType` at classify.ts:370 evaluates `input.catalogCategory?.trim()`, yielding undefined for both, then takes the same name path. The exact name strings above are preserved, including umlauts, punctuation and the empty string. The separate `{}` input (undefined name), authoritative catalog with null name, catalog overrides, unsupported catalogs and other unique TYPE rows remain. Do not treat every null/undefined API input as universally interchangeable; only this inspected normalization path supports these cuts.

Composed owner at classify.ts:544 calls the real classifyDiscoveryProductType unconditionally, then the real usage-step owner. Its runtime clients `pickCapture` and `submitTypedName` in add-flow.ts:334/:376 destructure productType and step and drive the add flow; they discard the type diagnosis label. The retailer name helper, normalization, oil precedence and usage-step functions were inspected, so this is the same production classification with additional user-step proof, not a mock replay.

Exact lost assertions are T3/T4/T5/T7/T8/T9/T10/T11/T12 diagnostic label identities. Searches across src, scripts, apps, packages, docs and plans found no storage, transport, runtime debug consumer or published contract for these IDs. The historical flat-checklist plan at :235 **did request rule-ID fixtures** alongside adversarial examples; this cut intentionally retires part of that historical diagnostic test shape while preserving the actual branch behavior. Do not claim the labels were never deliberately tested, and do not invent a future consumer to preserve redundant rows.

**T13 is different and stays.** classify.ts:549 selects the spray flow from T13, and :584 uses it to identify editable saved spray answers. The complete B7 type and spray-step cases remain. No rule-ID export/function is deleted: classifyDiscoveryProductType still has real composed-classifier and spray-answer callers. Remove any newly orphaned TYPE section comment if necessary, with no additional credit.

History: 2bb16f10 (#608) introduced the flat checklist and deliberate type+step adversarial layer; 6458825e (#612) introduced/extended B7 spray semantics. Those are independent reasons to retain unique base and B7 inputs, not to delete their whole loops.

Focused proof after edits: native Node tests for base and B7 classification. Useful isolated owner controls are T9 productType oil -> mask (retained adversarial Oil Treatment/Öl-Kur must fail), T4 scalp_care -> mask (Scalp Treatment must fail), and final T12 null -> oil (Olaplex must fail). Target the real return branch, not expected fixture data. Restore exactly after each. These are proposed preservation controls; none was run in this review. The existing literal keeper for every row is the primary assertion-preservation evidence.

## F1: premium must not read keepsake even when output remains premium

Keep `tests/freemium-lapsed-user-matrix.test.ts:110`, `a premium tier never performs the keepsake read at all`. Replace its swallowed throwing sentinel with a local monotonically increasing read counter and a successful false return; assert both returned state and zero calls:

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

Override the returned dependency object rather than expanding accessStateDeps's intentionally narrow throwing-function helper type. The actual resolver returns premium before user/keepsake lookup. Its later catch swallows keepsake errors, explaining the old false pass. The neighboring truth table guards returned access states but cannot detect an unnecessary successful read while preserving premium.

Required actual-owner fault: replace the premium short circuit in authenticated-app-route-access.ts:214 with a branch that awaits deps.getUserId and deps.hasKeepsakeContent, then still returns premium. Use the fixture's known non-null USER_ID. The first output assertion must pass and the zero-read assertion must fail **1 !== 0**. Restore source byte-for-byte and rerun green. This proves the cost/read contract directly; merely changing returned tier is weaker and insufficient for this repair.

Non-test ownership: loadAuthenticatedAppAccessState calls this resolver and is the default dependency of resolveGatedPageMode, used by Routine, Anwendung and both Chat routes. The real keepsake evidence function is injected by that loader; the test performs no live lookup. Source history bad594d6 (#529), matrix evolution 521f8da8 (#530). No new access semantics are proposed.

## Correct native commands and sequencing

Main reports its isolated invoice Playwright baseline 28/28 and four-file native baseline 181/181 completed. I inspected the config/driver but did not rerun those results. After fixture/receipt transfer plus F repair, run Node keepers before deleting the invoice declaration or Discovery rows. After removal, expect 27 native Playwright cases and 161 native Node cases across the same respective file sets, with Node declaration sites unchanged. Verify actual receipts, not assumed counts.

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/customerio-stripe-webhook.test.ts tests/discovery-classify.test.ts tests/discovery-classify-b7.test.ts tests/freemium-lapsed-user-matrix.test.ts
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='Stripe invoice failure reports once without exposing an invoice reference' tests/customerio-stripe-webhook.test.ts
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='a premium tier never performs the keepsake read at all' tests/freemium-lapsed-user-matrix.test.ts
node node_modules/@playwright/test/cli.js test --config=/tmp/test-audit-invoice-playwright.config.cjs --project=chromium --workers=1
```

The inspected `/tmp/test-audit-invoice-playwright.config.cjs` selects only stripe-webhook-handlers.spec.ts, uses the installed local @playwright/test and server-only register, has no webServer/global setup, no .env.local loader and no application URL. This pure handler file uses no page/browser fixture; a chromium project name does not itself launch a browser. Its deps are in-memory Stripe/Supabase substitutes. No provider or external write is part of this command.

For the parent's c8 comparison, use its inspected `/tmp/test-audit-invoice-playwright.cjs` with before/after labels and unchanged include denominator. The earlier conversation driver was navigation only: its files array was metadata, while its separate config selected conversation-state and chat-debug-trace. Running that driver unchanged would not verify this invoice file. Do not use npx or the repository's general config for this bounded local proof; the latter loads .env.local unnecessarily.

Serialize edits, runner windows and source mutations. Capture/verify source hashes around every fault; inspect the expected failure, not only exit status. Finish relevant formatting/diff checks, main's independent preservation review, and final integrated coverage measurement before updating the campaign count. No production source or CI registration changes are needed: Node files are already in test:node (CI:158), and the Stripe file remains in test:playwright:contracts (CI:180).

## Read scope / remaining gates

Fully read the exact C1 and keeper bodies, their complete local stub builders, the relevant real event/helper/profile/trial-entry branches; all 20 removed literal inputs, all ADVERSARIAL rows and the complete assertion loops; the complete affected classification/normalization/composition/usage branches plus retailer helper; relevant B7 cases; full premium candidate/helper/truth table and the actual access-state owner/loader/gated caller. Read caller inventories, relevant history entries, package/CI routing and both temporary Playwright configs/drivers. Large unrelated webhook handlers, all invoice trial reconciliation internals, every sibling test and the complete repository were not freshly reviewed; none is being retired here. Root agreements and test-audit/CAMPAIGN apply; no scoped AGENTS were found in affected src/tests trees.

No current passing result, mutation catch, provider safety state or post-change coverage was inferred from this read-only work. The pending gates are main's application, actual-owner controls, native after receipts and independent preservation/integrated proof. With those gates, the supported reduction is **one declaration plus 20 runtime rows**, not 21 declarations.
