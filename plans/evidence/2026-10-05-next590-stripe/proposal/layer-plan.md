# Stripe trial128 layer plan — conditional five declaration removals

Scope: /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning, branch codex/test-audit-pruning, HEAD 21e0e41fa996ec6a725c258ab3766971f0edb94d. This is read-only evidence. No tests, owner imports, SQL/provider calls, environment-file reads, mutations or repository writes were performed. Main owns all integration and verification.

Full 13-file test/helper/table read yields **119 R, 4 F, 5 C, 0 D**. The proposed phases are **128 → 128 → 123 AST declarations**. All 13 complete files are present and syntax-parsed in each prospective phase. Five original donors remain during transfer; four existing keeper callbacks gain observations. The fifth keeper already has the full stronger union. All 118 unrelated callbacks are byte-identical, plus the unmodified C4 primary keeper makes 119 retained callbacks byte-identical. Removing every test callback from each phase produces byte-identical remaining support/import/fixture text. No tables, input mutations, owner calls, assertions in unrelated callbacks, imports or support helpers are changed.

Immutable proposal directory: /tmp/test-audit-stripe-trial128-proposal-74Xu81
Manifest SHA256: bf1a7c25fb6d176ddee7270fab6d03c27686cc778ad75a9d7678ee6403742129

- manifest.json: full hashes for 13 phase files and 51 current repository test/source/support/config inputs.
- candidates.json: exact complete original donor and keeper declarations/bodies, transferred/cut keeper bodies, all literal unions, operative-input equivalence and risks.
- ledger.json and /tmp/test-audit-stripe-trial128-ledger.md: all 128 individual classifications, hashes and concrete fault/retention reasons.
- read-scope.json: whole versus partial source reads and honest dependencies/history limits.
- control-oracles.json: nine unique actual-owner fault descriptors with phase-specific intended assertion line, exact selected test and source hashes. Syntax only was checked.
- before/, transfer/, cut/: all13 complete prospective files. transfer.diff/cut.diff are full review diffs.

## Exact five-candidate preservation contract

### C1: verifies a server-retrieved seven-day card trial and records later invoice proof obligations

Donor: tests/stripe-trial-authorization.test.ts:173. Primary keeper: tests/stripe-trial-authorization.test.ts:388 — retrieves provider authorities itself before returning verified trial facts.

verify() and retrievalClient() both construct fixtures() defaults, OFFER, NOW and false mode. Retrieval obtains the same session/subscription/payment method/discount/coupon and calls verifyStripeTrialAuthorization, returning authorization unchanged. There is no added provider call or fixture.

Complete assertion union:
- enrollment ENROLLMENT_ID
- agreement SUBSCRIPTION_ID
- authorization 2026-09-13T12:00:00.000Z
- trial end 2026-09-20T12:00:00.000Z
- customer CUSTOMER_ID
- payment method PAYMENT_METHOD_ID
- fingerprint fp_server_only
- ordered two future-invoice obligations
- existing session/subscription ids, exact resource/id order and required discounts/applies_to expansions

Actual owner: src/lib/stripe/trial-authorization.ts:115,241. 318cf157 introduced authority verifier; 90021157 preserved paid-zero branch. C1 only default no_payment_required happy DTO, not paid-zero or malformed proof.

Risk/acceptance: Transfer must assert full literal object; selected retrieval must still exercise real verifier. Keep negative and retired-attached terms cases.

### C2: a used card receives no profile/billing access and its trial agreement is canceled without invoicing

Donor: tests/stripe-trial-account-activation.test.ts:342. Primary keeper: tests/stripe-trial-account-activation.test.ts:493 — read-only Stripe return recovery exposes a released prior-use denial only after binding proof.

Both start fixture(), deny(), and the sole existing ensureCheckoutAccount(f.session,f.deps). Assertions transfer before keeper snapshots effects and performs its existing read-only recovery call; no added call/input.

Complete assertion union:
- CheckoutRecoveryError instance
- trial_unavailable code
- billing_subscriptions length0
- profiles[0].subscription_status null
- cancel sub_trial with invoice_now false and prorate false
- release_trial_enrollment occurred
- existing read-only recovery trial_unavailable, unchanged effects, exactly one cancel, one profile

Actual owner: src/lib/stripe/checkout-activation.ts:327; src/lib/stripe/trial-account-admission.ts:165,211. 8a5e42c2 added actionable typed errors and read-only recovery after the initial denial tests. Later boundary already executes the same original admission path.

Risk/acceptance: Use effects assertions before recovery. Provider/SQL stubs are observations of actual owner calls; this is not proof of real remote cancel or real SQL constraints.

### C3: provider neutralization timeout remains retryable and does not release the claim or grant access

Donor: tests/stripe-trial-account-activation.test.ts:373. Primary keeper: tests/stripe-trial-account-activation.test.ts:511 — read-only Stripe return recovery sends outstanding cleanup and unsafe replay bindings to reconciliation.

Both first paths fixture(), deny(), failCancel(), then the existing ensureCheckoutAccount call. Rename local f to cleanup only. Preserve the keeper unconfirmed and foreign-customer scenarios byte-for-byte.

Complete assertion union:
- CheckoutRecoveryError instance
- trial_reconciliation_required code
- cause matches provider timeout
- billing_subscriptions length0
- release_trial_enrollment absent
- existing read-only cleanup reconciliation and all independent unconfirmed/mismatch branches

Actual owner: src/lib/stripe/trial-account-admission.ts:265; src/lib/stripe/checkout-activation.ts:327. 8a5e42c2 added recovery caller while retaining direct timeout callback; no retirement inferred.

Risk/acceptance: Keep exact provider timeout cause rather than generic rejects. Do not claim same whole keeper fixture population; only its already-existing first call is identical.

### C4: a late failure delivery follows the retrieved successful payment

Donor: tests/stripe-trial-invoice.test.ts:380. Primary keeper: tests/stripe-trial-invoice.test.ts:546 — late failure retrieving paid truth dispatches Purchase, while absent failure facts stay a no-op.

Donor f.run(failed) and keeper paid.runWebhook(failed,true) use the same default paid invoice/subscription/payment/ledger result. evt_1 vs evt_route only flows to sourceEventId; phase/outcome readsets do not branch on it. The runtime objects are not byte-equal: direct fixture identityKeys is empty while route parsing produces one valid key. The invoice owner reads only runtime.stripeAccountId and runtime.livemode; both are identical. Its offer comes from the same canonical effective-contract fixture, not runtime catalog/key fields. No invoice or phase predicate reads identityKeys/enrollmentMode/allowedEmails. Actual route uses real recordTrialPaymentEvent adapter over same RPC fixture instead of direct recordPayment injection.

Complete assertion union:
- recorded outcome succeeded
- returned payment.result.phase first_paid observed by actual recordTrialInvoiceAnalytics exact stripe:purchase_completed:in_1 key
- existing stale unpaid case failure lookup with no delivery preserved

Actual owner: src/lib/stripe/trial-invoice.ts:295,336; src/app/api/stripe/webhook/route.ts:163,871. ca176e7d introduced atomic lifecycle outbox handling over invoice owner; 5e1f009e later added initial binding classification. Paid truth route keeper remains independent of typed missing-binding tests.

Risk/acceptance: Do not substitute a mock-derived key. Primary keeper invokes actual webhook dispatch and actual phase-to-name function. A renewal phase fault must fail the Purchase lookup. SourceEventId literal remains protected by separate first direct DTO test.

### C5: zero authorization invoice records no payment or revenue

Donor: tests/stripe-trial-invoice.test.ts:371. Primary keeper: tests/stripe-trial-invoice.test.ts:559 — missing initial binding is typed retryable and restored binding succeeds without payment.

Both assign subscription_create/amount_due0/amount_paid0 and trialing on fixture(). Keeper first sets billing absent and agreement null, then restores agreement sub_1 and billing present before its existing final f.run(). Those two restored values match default donor state. Earlier calls reject at missing-binding guard before payment-intent branch. Both deliberately leave total unchanged; no fixture correction/input added.

Complete assertion union:
- final payment null
- recorded length0
- no intent retrieval
- existing typed TrialInvoiceBillingLinkPending class/agreement/enrollment, second pending step after agreement bind, successful final restoration

Actual owner: src/lib/stripe/trial-invoice.ts:59–230. 5e1f009e added typed initial-binding recovery for EUR0 invoice arriving before activation. Retain historical sequence and transfer no-read assertion only.

Risk/acceptance: No-intent assertion is over all existing calls; earlier pending calls stop before that read. A source fault injecting an intent read solely in zero return branch must fail retained keeper.


## Four held F repairs, zero deletion credit

1. checkout:148: missing freeze_analytics yields -1 and passes the current ordering comparison. Require existence and order in the same current call; preserve full request/coupon/frozen-management assertions. This proposal does not perform the repair.
2. subscription-lifecycle:279: authorization defaults to current time minus60seconds while overridden original deadline is2020. Invalid chronology, rather than legitimate expiry, makes access false. Repair the existing enrollment and projected authorization date to a valid earlier date before testing expiry; no new case. Proposal leaves it untouched.
3. authorization:204: wrong-price row drops other required price facts; ID guard removal still fails currency/amount/tax/recurrence. Supply the original complete valid price with only its ID altered in that existing row. Proposal leaves all original rows untouched.
4. authorization:277: monthly discount refusal currently lacks unit_amount and tax_behavior, so price validation denies before no-discount policy. Complete the existing monthly price using accepted999/inclusive while retaining the same unexpected annual discount. Proposal leaves it untouched.

These are statically traced false-green prospects, not experimentally demonstrated failures. Main must validate any separately authorized repair with the intended isolated owner fault. Neither F nor table rows count toward removals.

## Current callers, history and release authority

- create-checkout-session route:951 onward selects the trial service only after server runtime/identity/funnel checks, then createDurableStripeTrialCheckout freezes terms and creates the provider session. The route tests execute this real dispatch with a service injection; they do not prove actual Stripe creation.
- ensureCheckoutAccount:327 onward calls prepareStripeTrialAccountAdmission before accounts/access and admitStripeTrialAccount before billing/profile linking. Trial-account admission retrieves actual provider authorities via retrieveStripeTrialAuthorizationEvidence→verifyStripeTrialAuthorization. Neutralization validates subscription and remaining invoices before releaseTrialAdmission.
- handleStripeWebhookEvent invoice success/failure branches call handleStripeTrialInvoice and derive atomic analytics key from actual returned payment phase. C4 uses this current boundary, not an invented serializer or mock-owned name.
- Trial continuation, cancellation, management and historical prior-paid import owners remain current server/operator dependencies. The authenticated continuation reconciliation route invokes the actual consumer. No absence-of-anonymous-route inference supports deletion.
- docs/free-trial-launch-runbook.md:47 documents authenticated workers; :51–53 identifies identity/history/reconciliation operator commands; :64 explicitly retains accepted-contract runtime/provider settings, webhooks, cancellation, receipts and recovery when new enrollment is disabled. This is current repository support intent, not a claim about live deployment or credentials.
- History inspected: 318cf157 introduced Stripe/PayPal trials; 90021157 repaired paid zero-total authorization; 8a5e42c2 added actionable checkout errors/read-only return recovery; ca176e7d added atomic trial lifecycle analytics; 5e1f009e added typed initial-binding retry classification. The C2/C3 later recovery tests already execute the earlier same denial paths. The C5 keeper preserves the exact historical missing-binding sequence from #620.
- package.json:49 routes all13 files through native Node with server-only-register and tsx; ci.yml:158 runs that suite. ci:verify independently runs typecheck/lint/build and does not replace test proof. The additional legacy .spec helper test was read but is not an approved stronger keeper in this group; retain legacy quarterly builder declaration.

## Rejected shortcuts and source limits

- Do not replace provider adapters with cloned local logic or drop real SQL replay tests. Their leases, cancellation CAS, permissions, recovery request freezes and transaction read semantics are distinct from transport mocks.
- Direct invoice event DTO remains R: route Purchase lookup does not preserve the full literal amount/time/service/event identities. Unpaid-null DTO remains R: a phase-none lookup would not prove null versus a malformed nonnull payment. Both directions of management switch and all invalid authority table rows remain.
- Already-attached retired catalog objects remain valid for authorization while new-sale catalog must be sellable. These are intentional different policies, not duplicate raw fixtures.
- No provider factory/seam/helper/export deletion is proposed. Runtime rollback/current operator support is sufficient positive evidence against retirement here.
- All callbacks, local fixtures and returning-checkout-route-fixture were read completely. Full directly relevant small owners were read; larger checkout-activation/webhook/create-checkout routes were read only for named branches. Read-scope.json enumerates exact slices. SQL migration bodies and installed SDK internals were not comprehensively re-read; no such stronger claim is made. The full ledger records retained risks but is not a statement that every provider/SQL branch has been independently re-proven.

## Main-only validation order

1. Review complete candidates, phase diffs, owner anchors, file hashes and held F scope. Run native all13 before command in main-commands.json and preserve baseline failures.
2. Apply only transfer phase with main-owned guarded editor after rechecking current hashes. Native all13 must preserve outcomes; no donor is removed yet.
3. Execute the nine serial actual-owner controls, selected exact keeper only. Require one clean selected pass, intended ERR_ASSERTION at recorded test clause/frame, owned byte-exact restoration, one clean selected pass. Reject import/setup/hook errors, timeouts and unrelated failures. Current descriptors do not execute anything and no runner exists here.
4. Apply cut only after preservation proof/review. Native all13 after; full campaign coverage/CI gates remain main-owned. Do not interpret AST counts as native table-expanded counts.

No candidate is verified or credited until main completes the preservation checks. Current known baseline failures are not cleanup targets.
