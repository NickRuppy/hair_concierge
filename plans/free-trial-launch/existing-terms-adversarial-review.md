# Adversarial review of existing terms and privacy rules

13 September 2026. Scope: live `/agb`, `/datenschutz`, `/widerruf`, the current worktree’s recurring checkout/consent and cancellation/deletion seams, and trial plan revision 0.48. Read-only production review; only planning documents are changed. This is an evidence-based implementation review, not a certification of all legal compliance.

Live checks: privacy and withdrawal pages returned readable current content through web retrieval. `/agb` failed in the web reader but returned HTTP 200 through a direct read-only fetch; its text matched the inspected source clauses. No authenticated provider consent screen, customer data or external support workflow was inspected.

## Findings and dispositions

### 1. [P1] Preserve the existing withdrawal right; a seven-day trial does not replace it

**Evidence:** `src/app/agb/page.tsx:33` describes a digital service. `src/app/widerruf/page.tsx:25` gives 14 days from contract formation and `:55` promises reimbursement of received payments. `src/lib/stripe/checkout-session-params.ts:100` requires generic terms acceptance in hosted Checkout and explicitly preserves the 14-day right. The digital-content exception at `widerruf/page.tsx:68` is conditional; it is not evidence that any subscription customer waived a right. The one-time purchase-context row at `src/lib/billing/personal-plan-one-time-consents.ts:63` is neither subscription consent nor proof of an affirmative waiver.

**Adversarial case:** customer authorizes a trial, is charged 69.99 after seven days, and declares withdrawal while the initial statutory period is still open. Treating this as ordinary cancellation at year-end, or saying that opening the scanner extinguished the right, is unsupported by the current contract and consent evidence.

**Resolution from existing promises:** keep the recurring membership’s 14-day withdrawal baseline; no digital-content waiver or usage deduction is introduced in this launch. A valid withdrawal stops the contract/collection and refunds payments under the existing published promise. Ordinary cancellation remains the separately approved flow. This does not add the retired one-time product’s voluntary money-back guarantee to subscriptions.

For one clearly disclosed trial-to-paid contract, the CJEU says withdrawal is generally available once, not newly triggered merely by automatic conversion/renewal. A genuinely new paid recovery/replacement contract must be assessed separately; “no second free trial” cannot extinguish statutory rights. Store contract-formation evidence and calculate the legal deadline separately from the seven-day entitlement clock. [CJEU C-565/22, Sofatutor](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:62022CJ0565). Service expiry of withdrawal is not triggered by mere first use; the law distinguishes full service performance from the separate digital-content exception. [BGB §356](https://www.gesetze-im-internet.de/bgb/__356.html), [§357a](https://www.gesetze-im-internet.de/bgb/__357a.html).

**Acceptance:** valid withdrawal after the first trial-end charge, before any charge, and during ambiguous payment processing; separate ordinary cancellation; no duplicate refund; preserve pending receipt date; no automatic new right assumed for ordinary conversion, nor automatic denial for a genuinely new contract. Exact statutory deadline computation must follow the applicable calendar rules, not reuse `trial_end`.

### 2. [P1] Published renewal/cancellation clauses contradict the selected new-cohort policy

**Evidence:** `src/app/agb/page.tsx:87` specifies repeat fixed annual/quarterly terms; `:95` makes cancellation effective only at the billing-period end and generally excludes partial reimbursement. The new O4 policy instead retains annual billing with the selected post-initial-term termination/refund approach.

**Resolution:** add an explicit new-trial-cohort contract section before enrollment launches: authorization-required seven days, first charge and later renewal amounts, first-term commitment versus subsequent indefinite continuation, cancellation and statutory withdrawal. Year-two settlement automation remains explicitly deferred, but these promises cannot be postponed in launch copy. [BGB §309 no.9](https://www.gesetze-im-internet.de/bgb/__309.html).

Do not delete historic quarterly/one-time terms or the conditional promise at `agb/page.tsx:76` that an expressly lifetime introductory price stays until cancellation. That clause is not proof that the new 69.99 introduction must repeat forever: its condition is absent from the approved new offer. Preserve actual existing-customer terms; preservation is not an assertion that every old clause is enforceable.

**Acceptance:** new checkout, durable confirmation and AGB agree on seven days, 9.99/month or 69.99 first annual year then 99.99; no launch cutoff; no legacy price rewritten; no fixed-year re-lock after the first term. Final binding action must acknowledge the future payment obligation, not rely solely on a free-only CTA. [BGB §312j](https://www.gesetze-im-internet.de/bgb/__312j.html).

### 3. [P1] Repeat-trial prevention needs a purpose-limited retention rule, not an assumed permanent blacklist

**Evidence:** live `/datenschutz` and `src/app/datenschutz/page.tsx:261` describe general retention, invoice/support periods and erasure rights, but not historical trial/payment-identity matching after deletion. Ordinary `billing_subscriptions` cascade with profile deletion; one-time consent/payment FKs restrict it. Neither shape implements the proposed minimal durable trial-eligibility claim.

**Resolution:** preserve the chosen account/email/card/payer matching inputs, but keep only necessary server-side eligibility proof, disclose the purpose, restrict access, and document retention and erasure/objection handling. HMAC identifiers remain personal data. Fraud prevention can support legitimate interests only subject to necessity/balancing and storage limitation; the invoice retention statement does not establish an anti-abuse retention period. [GDPR Articles 5, 6, 13, 17 and Recital 47](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng); [EDPB lawful-processing guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en).

**Still unresolved:** the necessity-supported period/criteria for retaining a claim after account deletion. There is no evidence in these files of an already approved period. An arbitrary one-, three- or ten-year number is not established by this review. Prepare the legitimate-interest assessment and a concrete bounded retention recommendation before the T1 migration is approved; do not ask generically whether a lawyer exists again. Any exception to strict one-ever matching after lawful erasure must be explicit.

### 4. [P1] Required contract-management paths need real delivery and support execution

**Evidence:** the live legal footer exposes AGB/privacy/withdrawal links, not a public cancellation submission. `/widerruf` is an email/template page, not the online function. Existing PayPal cancellation and Stripe portal access do not by themselves establish the public form, durable declaration storage and immediate receipt required by the proposed plan. `src/app/datenschutz/page.tsx:291` routes erasure requests to support; no automated customer-deletion operation was found. The `auth.admin.deleteUser` in partner claim rollback is unrelated.

**Resolution:** implement the already planned public cancellation/withdrawal forms and durable receipt outbox. Preserve the approved one-confirmation cancellation flow and original trial access deadline. A provider timeout is reconciliation-pending, not invalid cancellation. Keep account erasure support-operated for this launch; document identity verification, provider collection handling, retained statutory records, trial-claim disposition and completion receipt. An automated self-service account-delete feature is not required by this finding.

**Acceptance:** cancellation received just before expiry, provider timeout, unknown/mismatched public identity with no enumeration, withdrawal while payment is pending, receipt delivery retry, support deletion with both cascade/restrict relations. No live deletion or refund was attempted. [BGB §312k](https://www.gesetze-im-internet.de/bgb/__312k.html), [§356a](https://www.gesetze-im-internet.de/bgb/__356a.html).

## Existing platform observations outside the trial contract changes

The privacy page still says the non-EU controller’s EU representative will be named later. The site’s processing is already active; verify whether a representative has actually been designated or an applicable exception documented. The page alone cannot establish either fact. Do not fabricate a name or regard this review as a full audit of all processors, transfers, cookie implementations or general liability/change-of-terms clauses.

## User evidence and current boundary

Nick’s latest message: “the flow, I checked. That looks okay if you quit it like this.” Record the reviewed flow as visually accepted, with cancellation explicitly confirmed. Do not ask for the same unchanged screen approval again. This does not authorize a new withdrawal waiver, permanent identifier retention, production changes or a new year-two UI that was not shown.

The current contract supplies a conservative withdrawal baseline without another product interview. The remaining privacy retention parameter is explicit, not hidden behind a general “legal review pending.” Provider execution remains its own technical gate. The complete implementation handoff is still not declared ready merely because the screens were approved.

## Independent check and reconciled verdict

Claude Opus 4.8 (high), read-only and terminal, reviewed the current policy/code seams against plan 0.48. It independently confirmed the terms-update ownership gap, withdrawal/refund exposure, missing post-deletion retention contract and required cancellation delivery work. Its proposed withdrawal-waiver route and absolute assertion about all checkout disclosures were not adopted. Main verification confirmed that preserving the current 14-day right resolves the launch behavior without inventing a waiver; consent evidence remains specific to the actual binding step.

**Verdict:** the pages are useful existing contracts but cannot be carried into trial launch unchanged. The required new-cohort terms, current withdrawal right, support deletion procedure and reviewed cancellation flow have concrete implementation ownership in revision 0.49. The post-deletion retention rule is still unresolved. Provider execution and existing tax/configuration checks remain separate. No new question about lawyer availability is needed.
