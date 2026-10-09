# Fulfillment75 independent C1 preservation review

**C1: CONDITIONAL PASS.** The single deletion preserves the complete original assertion union on the identical existing command invocation. No new request, owner call, provider operation, fixture input, row, table case, helper or production seam is introduced. Main still needs its native before/transfer/cut proof and six intended-oracle controls; none was run by this reviewer. The other74 original sites are not independently reclassified by this review.

Proposal: `/tmp/test-audit-one-time-fulfillment75`; root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`. Exact artifact/current/snapshot hashes and checks are in `/tmp/test-audit-fulfillment75-independent-static.json`. Manifest SHA256: `d99a84f33b1df17782ecf58aded698d6409927718e962f3920ef28605878dfa7`.

## Complete assertion and input preservation

The donor is `tests/one-time-recovery-command.test.ts:471–489`, “redacts provider, user, lead, consent, token, session, and email values from output.” The existing keeper is`:330–349`, “applies only when confirmation exactly matches the target.” Both call `fakeDeps()` without overrides and make the **same entire `runOneTimeRecoveryCommand(parseOneTimeRecoveryArgs([...]), deps)` expression**, byte for byte: Stripe provider, `cs_live_secret`, apply and matching confirmation. The keeper destructures the already-produced `calls` array; this does not change fixture creation or invocation behavior.

Complete fixture reading confirms equivalence: `sensitive`:16–26; base reconciliation receipt:28–46; Stripe verification:48–63; fake dependencies:89–120. Each factory creates a new empty calls array and otherwise returns the same verification/payment facts, activation `{ok:true}`, and readReceipt result. No collaborator implementation mutates `baseReceipt`; both executions consume it once. The Stripe input has amountMinor2999, currency`eur`, valid paid timestamp, payment intent, checkout session, consent ID and email. Neither donor nor keeper invokes the PayPal verification fixture or actual SQL/provider adapters.

Actual parser `scripts/billing/one-time-recover.ts:154–193` consumes the same ordered arguments. Actual owner`:326–368` runs the same dark-experiment guard, normalization, exact-confirmation gate, verification, fixed-offer validation, activation and receipt read. `normalizeRecoveryTarget`:380–441 and `assertVerifiedFixedOffer`:643–658 do not see any difference between these two inputs. The shared ambient experiment guard is unchanged; this reviewer did not inspect environment values. The sibling test`:269–289` sets and restores its own environment override; no setup ordering is changed.

The existing keeper retains mode=`apply`, applyGuardSatisfied=true and the exact verifyStripe→activateStripe→readReceipt call array. Transfer appends the donor's exact `JSON.stringify(receipt)`, `Object.values(sensitive)` loop with its original diagnostic, and positive `29.99`/`EUR` checks. Those new observations follow the existing three assertions; there is no additional owning invocation. The owner constructs the public receipt itself at`:355–367`. Fixtures supply verification and reconciliation facts and record collaborator calls; they do not implement that public receipt projection or enforce orchestration order. Thus the retained boundary actually observes the intended owner behavior.

## Privacy precision: nine original literals, unchanged limits

The `sensitive` object has **nine**, not eight, enumerable values: Stripe session, PayPal token/order/capture, payment intent, user ID, lead ID, consent ID and email. All nine remain under the identical loop in transfer/cut. This corrects the author's prose count only; proposal bytes need no change.

Only the Stripe session, payment intent, consent ID and email are supplied on this particular command path. PayPal literals and user/lead IDs are not carried by the exercised Stripe verification/reconciliation fixture. Their absence checks already pass on absent inputs; preserving them is not proof of sanitizing corresponding populated PayPal/user/lead fields. The verification also contains `providerCustomerId:"cus_secret"`, which is not one of the original nine checked literals. The donor did not independently cover that omission, and consolidation neither repairs it nor deserves broader privacy credit. The public CLI's sanitized error and suppressed-provider-console paths also are not executed by either callback.

These are existing fixture/claim limits, not lost contracts caused by C1. The remaining donor loop is an exact literal union. No replacement test, extra privacy fixture or quota credit is proposed here.

## Six source controls: intended reachability

All six recipes target the actual complete `runOneTimeRecoveryCommand` function, source SHA256 `6b70d089d22d676fdbcd896c524402624899238d70d9689415a04f19504dfc75`. Unique scoped replacement and resulting full-owner mutant hashes match the proposal. **Mode and applyGuardSatisfied text also exists in the expired-reset sibling; main must use the named function scope, not a global first-occurrence replacement.** No fault was applied.

| Control | Actual owner change and required first assertion in transfer/cut |
|---|---|
| receipt-email-leak | Adds `verification.payment.email` to the returned reconciliation copy. Existing mode/guard/order remain valid. Nine-value loop must fail at test353 with `ERR_ASSERTION`, strictEqual and `leaked buyer@example.com`; the first eight loop values remain absent. |
| receipt-fixed-amount | Returns `0.00` in the amount projection. Privacy loop remains green; `output.includes("29.99")` must fail at355, strictEqual, false versus true. The base reconciliation has no alternate29.99 source. |
| receipt-fixed-currency | Returns USD. Amount still passes; `output.includes("EUR")` must fail at356, strictEqual, false versus true. No other EUR fixture field is included in the public receipt. |
| apply-mode | Returns dry-run while the real apply operation still executes. First keeper assertion342 must reject dry-run versus apply. |
| apply-guard-receipt | Returns guard=false while maintaining apply flow and mode. Assertion343 must reject false versus true. |
| activation-after-receipt | Moves actual receipt read ahead of actual activation. Public output otherwise coincides because the fixture receipt is fixed, but recorded calls reorder. Assertion344 must fail deepStrictEqual at the exact call-array oracle. |

The first three controls establish donor sensitivity after transfer; the last three preserve the original keeper's independent observations. A syntax/import/provider/setup failure, timeout, another test's assertion, or later unrelated assertion cannot stand in for any intended result. The original donor and transferred keeper should both detect the corresponding first-three faults. The six recipes exercise representative changed projection fields; they are not exhaustive privacy mutation coverage for every literal.

## Independent static receipt

The read-only Python checker `/tmp/test-audit-fulfillment75-independent-check.py` passes **462 checks**:

- All ten hashes named by the handoff receipt match. All49 current readset/dependency/config files match their frozen pins. All24 phase snapshots match hash and byte count; all8 current cohort files equal before.
- Replacing only the exact existing keeper declaration reconstructs transfer. Removing only the original donor plus its existing inter-test separator reconstructs cut. The entire advertised diff matches independently. All other support/import/fixture bytes are therefore conserved.
- Declaration counts are75→75→74;73 unrelated callback bodies remain byte-identical. All ten held F bodies remain byte-identical, including those in the changed command file. The other seven files are completely unchanged.
- All donor/keeper original hashes, full owning-call expression equality, literal assertion block transfer, six scoped fault hashes, and exact phase oracle lines/keeper hashes match.

Declaration counting here is textual (`test(` registrations, including the indented existing template) plus exact recorded body verification. No test module, owner, compiler, TypeScript parser, provider or DB was imported or executed by this checker. The first-access template's four runtime rows remain byte-identical; a runtime78→77 result is not claimed.

## Read scope, entrypoint and retained independent boundaries

Human read completely: command test540 lines, all fixtures/helpers/table rows/retained siblings; script762 lines including parsers, target normalization, dark guard, fixed-offer check, real factories, reset sibling, real receipt reader, console suppression, sanitized errors and main dispatch; current one-time-payment-recovery runbook. Actual non-test caller is script main`:741–762`, selected by `package.json:189` `billing:one-time:recover`; it constructs live dependencies and prints JSON. There is no retired/dead-feature argument. The runbook explicitly requires privacy-safe receipts and exact-target apply authorization; no production command was run.

History read: current log identifies `0d29b871` (#293) and `2518d54e` (#303); the original donor/helper diff at#293 confirms this existing Stripe fixture. The full command file's retained dry-run, mismatch/missing confirmation, PayPal, reset and real receipt-query tests were read. The source-only PayPal factory guard and repeated-apply fixture remain held limits; neither replaces this command receipt proof. Native registration in package.json:49 and CI quality-node:147–160 remains unchanged.

The actual provider factories were read as part of the complete CLI source, but their imported Stripe/PayPal/canonical activation implementations, remaining seven test files and full migration were **not independently reread** for this sole candidate. No preservation decision relies on equivalence to them: they remain unchanged, and candidate calls inject those seams. Consequently this report does not establish SDK transport, actual capture/activation, SQL persistence/idempotence, live provider state, deployed experiment configuration, all75 semantic judgments or repairs to ten held F contracts. The49 file hashes are preservation guards, not human-read credit for those files. Prior campaign root AGENTS and test-audit instructions remain applicable; no scoped instruction was introduced or bypassed.
