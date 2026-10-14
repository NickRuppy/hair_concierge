# Cross-boundary applied preservation review

2026-10-02. Worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; base HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Independent read-only review of the applied four-test batch. Inputs: `/tmp/test-audit-cross-cutting-layer-plan.md`, applied diff, `/tmp/test-audit-cross-boundary-edit.cjs`, `/tmp/test-audit-cross-boundary-cuts.json`, actual source owners and completed native/mutation receipts.

**Verdict: no preservation gap found in the applied batch.** Supported credit is exactly **one Playwright declaration**, **zero Node declarations**, and **19 fewer Node runtime fixture cases**. The premium change repairs an existing declaration. Campaign 181 → 182 is therefore justified for this batch; this review does not certify the full campaign or completion of the 20% target. Final integrated suite/global-coverage proof remains main-owned and pending for this batch.

## Exact scope and invoice preservation

The complete four-file diff matches the edit driver, apart from the existing `care_use.options[3]?.key === "conditioner_pre_wash"` assertion in Discovery, which belongs to the prior campaign and is not credited here. No other declarations were removed in these four files.

Removed declaration, recovered from original HEAD: `tests/stripe-webhook-handlers.spec.ts:687`, `invoice.payment_failed logs and returns (no throw)`. Its entire body made `{id:"in_1", customer:"cus_1", attempt_count:2}`, awaited the actual helper and asserted nothing else. Only its now-unused test import was removed. Actual production export `src/lib/stripe/webhook-handlers.ts:1096` remains live through webhook route import/call.

Keeper: `tests/customerio-stripe-webhook.test.ts:817`, `Stripe invoice failure reports once without exposing an invoice reference`. The current body transfers the same customer and attempt fields into its `in_failed` invoice, retains internal-test parent metadata, calls the real dispatcher, awaits it and preserves every prior assertion: one payment report, provider_payment_failed signal, reference-present flag, live flag, internal-test flag, and no invoice identifier in serialized telemetry. Its monotonic warning counter surrounds the actual awaited call and is restored in `finally`; it asserts exactly one emission at :856. It neither replaces the helper nor asserts private prefix, argument positions, payload shape or serialization.

Path verified from source: dispatcher invoice.payment_failed → actual trial helper → positively legacy/null → payment telemetry → actual invoice logger → real customer profile lookup through the local query builder → missing-profile exit. The invoice has no subscription ID and no trial_-prefixed marker, so trial handling returns before provider/billing access. The local empty profiles map produces null in maybeSingle after matching customer. No Customer.io deferred work or analytics write is reached. The logger currently executes before profile lookup, but the keeper imposes no new ordering assertion. Changing the invoice ID preserves the original presence/no-throw contract and the stronger existing privacy oracle.

The existing Node fixture previously omitted customer/attempt. Its successful missing-customer branch is no longer this keeper's route path; the now-valid customer exercises the missing-profile branch. This is a deliberate input transfer, not a claim that both route branches remain covered by this single declaration. The old keeper had no missing-customer-specific oracle. The scoped coverage branch delta below is recorded rather than hidden. HTTP signature, deduplication and POST response coverage are not claimed as replaced by this dispatcher keeper.

Counter reachability is established independently: throwing inside the actual helper reaches the keeper as the unique sentinel, while omitting the actual route call makes the counter fail 0 versus 1. The fixture therefore does not pass merely because telemetry was emitted before the logger. No concurrency option is enabled in this file; its global console replacement is narrowly awaited and finally-restored.

## Discovery: all 19 exact inputs retain literal composed-owner assertions

The applied cut deliberately retains the unique `Pre-Shampoo Öl` TYPE row and its T10 assertion at current :86. This resolves the counterpart's requested retention; it differs from the earlier 20-row proposal. TYPE_FIXTURES goes 49 → 30 rows. ADVERSARIAL remains 29 rows; both declaration loops remain.

Each removed row below originally had only `input.name`, with the literal expected productType shown. Each current keeper is an unchanged ADVERSARIAL row evaluated by the full loop at :334–348, through actual `classifyDiscoveryProduct`, with literal type and step assertions. No keeper computes its expected value from production output.

| Removed exact name | Current keeper line | Type / step |
|---|---:|---|
| Scalp Oil | 291 | oil / oil_scalp |
| Haarkur Leave-in | 295 | leave_in / leave_in |
| 2in1 Shampoo & Spülung | 293 | null / what_is_it |
| 2in1 Öl-Kur | 326 | null / what_is_it |
| Color Shampoo | 328 | null / what_is_it |
| Scalp Treatment | 320 | scalp_care / fixed |
| Kopfhaut-Kur | 321 | scalp_care / fixed |
| Kopfhaut-Serum | 322 | scalp_care / fixed |
| Öl-Kur | 311 | oil / oil_pre_wash |
| Oil Treatment | 312 | oil / oil_pre_wash |
| Haaröl-Kur | 313 | oil / oil_pre_wash |
| Scalp Oil Treatment | 318 | oil / oil_scalp |
| Pre-Wash Oil | 315 | oil / oil_pre_wash |
| Leave-in Öl | 316 | oil / oil_damp |
| Leave-in Oil | 317 | oil / oil_damp |
| Argan Oil Shampoo | 324 | null / what_is_it |
| Leave-in Conditioner mit Öl | 325 | null / what_is_it |
| Olaplex | 304 | null / what_is_it |
| empty string | 307 | null / what_is_it |

The original missing catalogCategory and keeper's explicit null both become undefined at `input.catalogCategory?.trim()` in the actual classifier. They consequently take the same exact-name branch. This normalization argument is limited to this owner, not a general null/undefined equivalence. Separate undefined-name `{}`, catalog-authoritative/null-name, unsupported category, punctuation variants and unique rule examples remain.

The intentionally lost assertions are those particular rows' diagnostic rule IDs, not productType outcomes. Remaining TYPE rows still pin each corresponding T3/T4/T5/T7/T8/T9/T11/T12 branch identity; unique T10 remains too. The historical plan intentionally requested rule-ID fixtures; this batch retires redundant examples of that diagnostic shape, not every diagnostic assertion. Actual composition unconditionally invokes the type classifier and uses its productType to calculate the step. Current add-flow consumers use productType/step. T13 is a separate runtime discriminator in composition and saved-spray detection, with B7 assertions intact. No source export, protocol, persisted field or separate debug consumer was removed. Three branch-level mutation controls provide additional evidence; they do not claim to exhaust every possible classifier fault or mutate all 19 inputs.

## Premium repair

`tests/freemium-lapsed-user-matrix.test.ts:110` now awaits the actual resolver with premium tier and a successful, counted hasKeepsakeContent dependency. It asserts state premium at :119 and exactly zero reads at :120. The default fixture supplies a non-null USER_ID. This repairs the swallowed-exception sentinel: the former body discarded the resolver result, and a keepsake exception could be swallowed by its free-path catch.

Actual source returns premium before user/keepsake lookup; real loader/gated-page consumers are unchanged. The output-preserving mutation explicitly calls getUserId and hasKeepsakeContent before still returning premium. Its red stack reaches :120, proving the state assertion passed and the read prohibition independently failed. No access-policy change or declaration credit is attached to this repair.

## Completed mutation evidence

Read only after main announced all controls complete. Source changes in `/tmp/test-audit-cross-boundary-mutations.cjs` target actual owners, not fixtures or expected values. I inspected receipt commands/statuses, all six red assertion/stack sections and all before/after TAP summaries, rather than accepting `expected:true` alone.

| Control | Selected cases before/after | Actual red reason |
|---|---:|---|
| invoice-helper-throws | 1 / 1 green | audit_invoice_failure_sentinel; stack actual helper :1097 → actual route :902 → keeper |
| invoice-helper-omitted | 1 / 1 green | warningCount 0 !== 1 at keeper :856 |
| premium-forbidden-read | 1 / 1 green | keepsakeReads 1 !== 0 at :120; premium assertion preceding it passed |
| discovery-oil | 2 / 2 green | Oil Treatment and Scalp Oil Treatment: mask !== oil at literal type assertion :340 |
| discovery-scalp | 1 / 1 green | Scalp Treatment: actual mask, expected scalp_care at :340 |
| discovery-unknown | 3 / 3 green | Olaplex oil !== null at :340; two other selected Olaplex variants still pass |

These are six controls, seven expected failing cases, and nine selected green cases on each side. The initial scalp receipt matcher expected a one-line TAP expression; the completed driver instead detects the actual field, and I independently checked the multiline expected scalp_care/actual mask evidence. Main reports that parser-only correction caused a rerun of scalp and unknown while preserving the first four receipts. It does not represent an ineffective source mutation.

All four current source hashes independently match originalHash/restoredHash in the completed receipt, and `git diff` for all four owners is empty:

- webhook-handlers.ts: `611ec5966703c23c01beb04982fff17715a801afb808ec9b80117ae0462e7041`
- webhook/route.ts: `83c74462ffda261d3a044467d68a918b034febbefca9f6aad4ae131dd84f35ab`
- authenticated-app-route-access.ts: `0530fec429df89c60f910b05c5fb3f96df8f95f5cd6eea4bcef35a81419ae385`
- discovery/classify.ts: `494058e87814dce648ff8c5c72dd13b8cb4382467730f8b9333333b0a2abf678`

## Native evidence, accounting and limits

Inspected on-disk logs: four-file Node baseline 181/181, transfer-only 181/181, after 162/162, each zero failures; isolated Playwright baseline and transferred 28/28, after 27/27. The selected Node files are customerio-stripe-webhook, discovery-classify, discovery-classify-b7 and freemium-lapsed-user-matrix. Commands use actual Node test runner, tsx/server-only registration and cached c8. Playwright uses installed CLI plus the isolated invoice config matching only stripe-webhook-handlers.spec.ts; no env loader, web server or browser fixture is required. Existing package/CI Node and Playwright registrations remain live.

The cuts receipt plus complete diff establishes one removed Playwright test call, 19 array elements, and no removed Node test declaration or new declaration. Node runtime 181−19=162 and PW 28−1=27 agree with native receipts. Counting the array rows as declarations, or treating the premium repair as deletion, would be incorrect.

Read both scoped comparison JSONs. Node scoped coverage reports lines covered 21790→21791, functions unchanged, branches 2406/5038→2404/5037 (−0.0302 pp), including route branch percentage change after fixture transfer. Isolated Playwright loses six logger lines and one covered function because ownership moved to the actual Node dispatcher keeper. This scoped loss is expected cross-runner movement, not proof of an integrated loss or an integrated pass. Global all-file denominators inside a focused run do not make it the full campaign suite. Main must perform final integrated proof and compare the campaign baseline; no new full-suite result is asserted here.

This pass fully read the removed invoice body, current invoice keeper and local stub builder, all 19 removed fixture bodies from receipt/diff, all current TYPE/ADVERSARIAL rows and assertion loops, premium body/dependency helper/truth table, actual affected classifier/composition/spray-discriminator branches, invoice/trial/profile branches and access resolver/loader. It inspected relevant current callers/CI routing, edit driver/config, all final mutation receipts and stated log summaries. Prior history and wider owner analysis are carried from the earlier layer plan; unrelated webhook implementations, the whole test suite and every full TAP line were not reread. No provider, DB, browser, environment file, runner or mutation was invoked by this preservation reviewer; only this /tmp report was written. Remaining gate is main's integrated verification, not a missing assertion transfer.
