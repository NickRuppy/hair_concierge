# Required trial notices and retained eligibility claims

14 September 2026. Implements the approved required-only trial policy. This is an engineering receipt and a concrete controller assessment draft, not legal certification. Nick owns launch execution; Haarmony LLC is the controller. Parent release work owns provider configuration, production migration, rights/replay operations and deployment. No live message was sent to verify this slice.

## Required communications

| Durable source | Notice / agreed facts |
| --- | --- |
| Trial enrollment becomes active after authorization | Contract confirmation with original authorization and exact seven-day deadline, accepted interval, first/renewal amounts, inclusive totals, automatic continuation, online cancellation, complete withdrawal instruction/form and frozen full launch AGB. No optional day-five reminder. |
| Committed switch/restoration | Required change confirmation, current committed interval/prices, original deadline, no new test/no immediate charge. Pending or abandoned provider approval sends nothing. |
| Authenticated cancellation declaration is inserted | Immediate acknowledgement of declaration/time and recorded effective end. Provider cancellation may remain pending; the acknowledgement does not assert provider completion. The declaration is never rolled back by an email failure. |
| Applied nonzero successful payment ledger event | Receipt of actual amount, occurrence time and paid-through entitlement. Both first payment and subsequent applied collections are covered. A redirect, zero invoice, failed payment or manual paid-through change cannot produce this receipt. |
| Uncanceled annual paid contract within 30 days of next renewal | Annual advance notice with renewal amount/date and indefinite continuation/cancellation/proportional prepayment terms. If fewer than seven days remain or provider-date reconciliation is unresolved, park for support. No monthly advance notice is generated. |
| Public cancellation/withdrawal declaration | Existing public declaration outbox; receipt of submitted facts, without asserting a matched contract or invented effective end. Parent connects its existing worker to the same generic inline transport. |

There is no proven provider receipt substitution in this implementation. Merchant receipts remain enabled. Suppressing a merchant receipt requires event-specific evidence of sufficient existing delivery/content; do not use a broad provider boolean to omit it. Annual notices are provider-neutral until provider-specific sufficiency is proved. Deferred year-two cancellation/refund automation remains the owning plan's delivery checkpoint before the first affected renewal.

### Transport and template payload

Existing Customer.io EU App API transport and API key are reused. Existing sender verified by the parent from live workspace `219516`, transactional message `14`: `Chaarlie <info@chaarlie.de>` ([existing template](https://fly.customer.io/workspaces/219516/journeys/transactional/14/overview)). Parent observed three sends and 100% delivery on that existing message; this is sender evidence, not proof of this new receipt's delivery.

The default trigger name is `chaarlie_required_contract_notice_v1`. Optional overrides are `CUSTOMERIO_TRIAL_REQUIRED_NOTICE_TRANSACTIONAL_MESSAGE_ID` and `CUSTOMERIO_REQUIRED_NOTICE_FROM`. Only the existing `CUSTOMERIO_APP_API_KEY` is mandatory; no new secret or manually created template is necessary. On the first required send, `auto_create: true` creates the named transactional metrics record if absent. It does not create a campaign.

```json
{
  "to": "<verified owner email resolved at send time>",
  "transactional_message_id": "chaarlie_required_contract_notice_v1",
  "identifiers": { "email": "<same recipient>" },
  "from": "Chaarlie <info@chaarlie.de>",
  "subject": "{{ trigger.subject }}",
  "body": "<div style=\"white-space:pre-wrap\">{{ trigger.receipt_text | escape }}</div>",
  "body_plain": "{{ trigger.receipt_text }}",
  "message_data": { "subject": "<German required notice subject>", "receipt_text": "<complete durable confirmation>" },
  "auto_create": true,
  "tracked": false,
  "send_to_unsubscribed": true,
  "disable_message_retention": true
}
```

The actual builder includes the German HTML document shell and font/line-height styles. Both HTML and plaintext are supplied. Untrusted public-declaration text enters `message_data`; it is not interpolated into Liquid source. HTML uses the escape filter. Open/click tracking is disabled. Existing callers without `inlineContent` retain their original transport payload unchanged. [Customer.io API contract](https://docs.customer.io/integrations/api/app/tag/send-messages/sendemail/) and [inline examples](https://docs.customer.io/messaging/send/transactional/api-examples/), and [transactional trigger-variable semantics](https://docs.customer.io/messaging/send/transactional/api/#trigger-data-and-content-variables).

### Queue and scheduler

Migrations: `20260914135527_trial_required_notices.sql` and notice-only revision integration `20260914141036_trial_required_notice_revisions.sql` (after management foundation `20260914140320_trial_management_operations.sql`), generated with the repository Supabase CLI. The private outbox and all helper/RPC functions are service-role only, with RLS, restricted grants and `SECURITY INVOKER`. Recipient emails and raw payment identifiers are absent. The worker uses Auth admin lookup by the persisted owner UUID and requires a confirmed email; provider subscriber email and client-supplied owner/email never select the recipient.

Schedule `GET /api/billing/trial-required-notices/reconcile` every minute, using `Authorization: Bearer <CRON_SECRET>`. Parent owns `vercel.json` and route/middleware classification. Each invocation selects due annual notices, then claims one pending row with a 90-second attempt lease; the provider call times out after ten seconds. The 60-second route limit remains shorter than the lease. Increase capacity through bounded invocations if backlog develops; a once-daily schedule does not satisfy prompt confirmations. Parent should kick this worker promptly after authorization/declaration commits, with cron as durable recovery. One-per-minute dispatch alone has a one-per-minute throughput limit.

HTTP 401 means no authorized work occurred; 503 means required configuration is absent and nothing was claimed; 500 means a storage/settlement failure. The successful response contains aggregate `claimed`, `queued`, `supportRequired`, `blocked` only. No recipient, receipt or provider response enters logs/API.

States: `pending → sending → queued → delivered`. `queued` means only a Customer.io queue acknowledgement. `support_required` is terminal for automatic dispatch; `superseded` cancels obsolete pending annual reminders. A timeout, malformed acknowledgement, HTTP error, unexpected post-send failure or expired lease is parked. There is no automatic resend after any ambiguous provider boundary. Competing workers use `FOR UPDATE SKIP LOCKED`; completion requires the current unexpired attempt. A successful send followed by failed settlement propagates the storage error and leaves a lease that will park, never trigger another send.

The outbox freezes the accepted snapshot, and stores the exact subject/text with settlement. Frozen `trial_required_notices_v1`/`trial_launch_v1` text must not be edited for future offers. Introduce a new version/renderer; keep the old one readable. [Legal before/after evidence](trial-notices-evidence/legal-before-after.html) contains actual server-rendered legal components in their existing layout. Changes reuse the already accepted trial journey and legacy-preservation decision.

### Support and delivery reconciliation

Use a service-only read to check counts and oldest pending age; do not put raw messages/identities into chat, analytics or ordinary logs:

```sql
SELECT kind, status, count(*), min(created_at) AS oldest
FROM private.trial_required_notices GROUP BY kind,status ORDER BY kind,status;
SELECT id, enrollment_id, kind, last_error_code, provider_delivery_id, created_at
FROM private.trial_required_notices WHERE status='support_required' ORDER BY created_at;
```

1. Missing recipient: verify the account ownership/email through the existing support process. Never substitute an unverified PayPal subscriber email.
2. Ambiguous delivery: inspect Customer.io by the known delivery ID, or exact bounded timestamp/recipient through authorized support access. If accepted, reconcile its known state; if delivery cannot be established, preserve the parked row. Do not re-arm merely because no ID reached the app.
3. Provider-confirmed delivery: call `confirm_trial_required_notice_delivery(notice_id, provider_delivery_id)` only after authenticated provider event or verified support evidence. It changes `queued` to `delivered`; for authenticated cancellation it also updates the original receipt row to sent. A queue acknowledgement cannot call this function. The new slice does not add a Customer.io delivery webhook; parent owns provider-delivery monitoring/integration.
4. Definitively unsent preparation problem: fix the problem and authorize a bounded repair after reviewing the immutable snapshot; no generic auto-retry endpoint is provided.
5. Annual window missed/provider date unresolved: escalate before collection, reconcile the actual billing date and required notice. Do not silently emit a late notice as compliant or alter billing from this worker.
6. Erasure: include notice snapshots and persisted rendered text in the controller's contract-record assessment. Nullable links do not anonymize the contract UUID inside a snapshot. When erasure applies, delete affected notice rows; do not rewrite their immutable historical content or retain a shadow copy.

## Controller necessity, balancing and retention assessment — launch engineering record

**Purpose and boundaries.** Enforce the disclosed once-only introductory test across account recreation and reliable shared payment identities. The interest is limiting repeated free provision of the same paid service. Do not label rejected people fraudulent, infer creditworthiness, market to them or combine the data with hair/scalp answers. The commercial rule is not evidence of unlimited lawful storage.

**Data and processing.** Versioned HMACs of account UUID, normalized verified email, Stripe card fingerprint in its provider/environment namespace, and PayPal payer ID; consumed timestamp and minimal opaque enrollment linkage. No raw fingerprint, card number/CVC, unverified email, name/address, IP/device block or broad behavioral profile. Treat HMACs as personal data: matching and linkage remain possible. An activated authorized trial or independently verified successful nonzero prior paid membership consumes eligibility. Abandoned reservations must be released after provider reconciliation, not promoted to a permanent denial.

**Necessity / alternatives.** Account-only or email-only enforcement lets the same person recreate accounts; reliable provider identities close that specific gap. A cookie/IP/device rule is less reliable, affects shared households and is more intrusive; do not use it. An unrestricted repeat trial fails the chosen introductory-offer purpose. A fixed arbitrary expiry is not supported by measured evidence and is not invented here. HMACs reduce disclosure risk while preserving exact-match function; they do not eliminate privacy impact. The benefit of any older group of claims still needs evidence: counts of repeat attempts prevented, elapsed time since activation, cost/abuse signals and mistaken-match/support outcomes, collected in aggregate without unnecessary identifiers.

**Impact and safeguards.** A shared card/payer identity can cause a false personal attribution. Denial blocks only the new free offer, creates no paid agreement, and leaves human correction and an expressly chosen paid route. Publish the matching criteria and limitations before use. Restrict service/support access, protect and rotate keys with versioned namespaces, audit authorized rights actions, suppress late reconstruction, and prohibit analytics/client exposure. No sensitive hair/scalp data participates. The comparison is deterministic and challengeable; a support reviewer assesses the actual activation and mistaken attribution rather than rubber-stamping a match.

**Balance recorded for the approved scope.** The narrowly disclosed one-use offer, low consequence of refusing only another free offer, HMAC minimization, exclusion of weak shared-device signals, and executable human correction/restriction/erasure controls support the legitimate-interest basis under Article 6(1)(f) for this implementation. Reasonable expectations are supported by disclosure before enrollment; shared payment methods and residual linkage remain the main adverse impacts. This is the engineering assessment for Nick’s approved scope, not a legal certification or an external-adviser gate. If actual complaints, shared-method errors or old-record utility undermine the balance, restrict the affected comparison and revise or erase that group. A valid Article 21 objection is assessed for that individual; the general commercial interest is not automatically a compelling overriding ground.

**Retention decision criteria.** No routine expiry is used to reset the commercial eligibility rule. Storage after ordinary account deletion is permitted only while the same trial program operates AND a current, evidence-based assessment supports necessity and proportionality for the affected records. Review at least annually, and sooner on purpose/program/legal changes, material erroneous matches or a rights request. The review must state affected record groups, evidence period, alternatives, benefits/harms, specific continuing justification, decision and next review date. A recurring signature, available HMAC key or permanently running offer is insufficient. Loss of necessity, permanent program closure, erroneous activation attribution or an accepted erasure outcome triggers deletion earlier. Do not borrow invoice-retention periods to justify continued identity matching.

**Account deletion.** Confirm requester proportionately without requesting full card details. Reconcile active/in-flight billing and explain that account deletion is separate from cancellation. Remove profile content through the established deletion process; classify remaining payment/contract records by their separate obligations. A justified used-trial claim can survive ordinary account removal under the disclosed criteria; notify the requester of data retained, purposes, legal basis, criteria and rights. Do not retain identifiers simply because a foreign key currently restricts deletion. Full erasure may make later recognition impossible; the system must accept that consequence.

**Correction, restriction, objection and erasure procedure.**

1. Log the received date, request scope and proportionate identity proof in the restricted rights workflow. Acknowledge and decide within the GDPR one-month response period; any legally allowed extension needs timely reasons. Do not ask for card numbers/CVC.
2. Locate every related claim/version/provider namespace using the authorized linkage. Verify whether a test really activated. Correct erroneous attribution; a shared card alone is not proof that this individual used the earlier test.
3. During an applicable restriction, stop affected matching and re-creation. Keeping data for an allowed storage/legal-claim exception does not permit continued eligibility denial. Do not substitute another hidden identity block.
4. For objections, record the individual's circumstances and whether specific compelling grounds or legal-claims necessity justify continued processing. If none do, cease it; do not treat the one-trial policy as the decision.
5. On accepted erasure or loss of necessity, erase all linked HMAC versions and unnecessary links/snapshots. Invalidate old operation/enrollment replay capability so delayed webhooks, backfills, imports or backup restores cannot rebuild the claims. Any minimal operation-level suppression must have its own necessity basis and may not be repurposed to match the person or deny future eligibility.
6. Test deletion plus late-provider-event replay, restricted matching, key rotation, mistaken shared-method correction, account recreation and backup restoration before dependent production processing. The service-only tooling below implements identity restriction/correction/erasure and old-source replay suppression; the launch test receipt covers those behaviors. Restore the rights registry before enabling workers after backup restoration. Record results and communicate the rights outcome with any separately justified contract-record retention.

**Recorded implementation scope, 14 September 2026.** Accountable launch operator: Nick. Purpose: the approved once-only Chaarlie introductory trial, including verified prior paid use. Implementation: trial-v1 with required-only notices and migration `20260914144351_trial_identity_rights_lifecycle.sql`. Expected benefit: prevent reliable repeat use after account recreation without storing raw provider identity; adverse impact: shared payment attribution and linkable pseudonyms, mitigated as above. Review by 14 September 2027, or earlier on the triggers below; this review date is not a fixed retention deadline. The release receipt must attach the actual migration/key-registry configuration and focused rights-test results. Initial launch has no observed long-term repeat-attempt distribution: explicitly retain that limitation and use subsequent aggregate evidence to reassess older claims. If the assessment cannot justify particular records, stop their processing and delete them; no adviser appointment is substituted for the actual decision or executable rights controls.

Sources: [GDPR Articles 5, 6, 12–13, 17–18 and 21](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [EDPB lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en), [EDPB individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en). Annual indefinite continuation preserves the chosen contract under [§309 no.9 BGB](https://www.gesetze-im-internet.de/bgb/__309.html). The existing plan's primary-source notices research remains the communications contract.

## Trusted public-declaration resolution

Migration `20260914141918_public_contract_declaration_resolution.sql` adds a separate immutable match, trial-application and completion history. Scope is the new enrollment-bound cohort, including its paid contracts. Unmatched and legacy contracts stay in the existing review/support workflow; do not invent an enrollment or falsely resolve them through this tool.

Use the already configured service environment and existing operator entrypoint. List/exact submitted-record reads retain their prior read-only syntax. `inspect` shows resolution metadata and references; it does not disclose submitted name/email/text. The following are explicit commands, not a scheduler:

```sh
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/public-contract-declarations.ts inspect --declaration=<UUID>
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/public-contract-declarations.ts match --declaration=<UUID> --user=<VERIFIED_USER_UUID> --enrollment=<VERIFIED_ENROLLMENT_UUID> --verification-reference=<RESTRICTED_CASE_REFERENCE>
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/public-contract-declarations.ts apply --declaration=<UUID> --interpretation-reference=<VERIFIED_REQUESTED_END_REFERENCE>
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/public-contract-declarations.ts complete --declaration=<UUID> --evidence-file=/absolute/path/to/restricted-completion.json
```

`match` is an operator attestation of independently checked identity and contract ownership. A matching submitted email is insufficient. The database also checks exact account/enrollment ownership and an activated contract. It freezes the original public submission timestamp and verification reference, and moves the review to `in_review`. Repeating the exact match is idempotent; changing owner/contract/reference is rejected. Mistaken matches require a separately reviewed correction, not silently overwriting the record.

`apply` is only for ordinary trial cancellations received after authorization and before the original deadline, with no observed successful collection. The interpretation reference must establish that the customer's requested end actually means the original trial end; if they requested another date, keep the case in review and use the verified external workflow. The command keeps the original `submitted_at`, records `effective_end_at` as the original deadline, sets the collection guard, creates one existing cancellation declaration/receipt/provider-operation and links it to the public declaration. Processing after expiry is allowed because the original submission was timely. The original unverified public receipt is never rewritten, and queued provider work is not case resolution.

Payment and cancellation serialize on the enrollment row. If a successful charge already won, `apply` returns `payment_review_required` without claiming an unpaid cancellation or queuing an incompatible provider operation. Withdrawal, extraordinary cancellation, non-timely declarations and other unsupported cases return `external_review_required`. Both remain `in_review` until the existing authorized provider/refund workflow actually completes. This CLI makes no provider calls, refunds or direct email sends.

`complete` requires a JSON evidence file with exactly these fields:

```json
{
  "completionReference": "restricted_case_completion_record",
  "providerTerminationReference": "verified_provider_cancellation_or_termination_record",
  "effectiveEndAt": "2026-09-21T10:00:00Z",
  "refundDisposition": "not_due",
  "refundReference": null,
  "refundAssessmentReference": "case_record_explaining_why_no_refund_is_due"
}
```

For a refund, use `refundDisposition: "completed"` and a nonempty `refundReference` naming verified provider refund evidence. A payment receipt, submitted refund request or queued email is not completion evidence. References identify restricted evidence records; do not embed raw payment payloads or personal data in the CLI output. Canonical cancellation/revocation must already be reconciled. When `apply` created a provider operation, it must be confirmed before resolution. A timely trial cancellation or withdrawal with any observed successful payment requires completed-refund evidence; an in-flight success that arrives after cancellation also triggers that requirement. For paid ordinary/extraordinary cancellation, the operator's refund assessment must cover applicable prepayment/termination rights and actual provider execution. The provider/refund references must also establish that earlier in-flight collection has been reconciled. The tooling records that trusted assessment; it does not calculate or verify a refund against a provider API. An unexpected later charge stays visible in the existing payment-reconciliation lane; historical completion evidence is not silently rewritten.

Resolution stores the immutable evidence and sets `resolved` once. Same-evidence replay succeeds; a different completion cannot rewrite history. Narrow service-only review-column grants are protected by database triggers requiring the corresponding match/completion records; there is no generic public status-update RPC. All new tables/functions are restricted and use invoker privileges. Original public declarations and receipt snapshots remain unwritable by the service. Include these resolution records in the controller's deletion/contract-evidence assessment; nullable links are not a blanket claim of anonymization.

For uncertain delivery, use the earlier support procedure and provider delivery identifier. Keep delivery reconciliation separate: neither `match`, `apply`, nor `complete` marks an email delivered, and no email state is accepted as resolution evidence.

## Verification

Node 22 focused behavior tests cover SQL event ordering/deduplication, no synthetic receipts, immutable snapshots, restricted permissions, claim fencing, expired leases, annual due/cancellation/late-window paths, German amounts/dates/withdrawal, verified-owner routing, ambiguous send parking, route auth and legacy transport compatibility. The public-declaration resolver suite also exercises trusted matching, delayed timely submission, charge/cancellation races and completion evidence. Mutation proof accepting zero/unapplied payments produced an extra receipt and failed the ledger test; restoring the gate passed.

The integrated rights/history/notice/legacy Stripe webhook command passed 55 tests; the final expanded rights lifecycle suite separately passed all 10 tests, including selected-revision replay and restoring a restriction after a new trial was admitted. Existing required-notice/public-declaration delivery and resolution integration previously passed all 44 focused tests. Tests run with `node --import ./tests/server-only-register.cjs --import tsx --test <test files>`. SQL execution is PGlite; it verifies transactional outcomes and role permissions, not simultaneous multi-session races or live provider state. No live send, provider-template mutation, production identity import, cancellation or refund was used as a test fixture. The release owner attaches final whole-branch TypeScript/review results to the deployment receipt.

## Prior-paid membership history: bounded backfill

`record_prior_paid_trial_claims` stores prior paid use in the same consumed HMAC claim table, with no artificial enrollment. It takes the admission function's sorted advisory locks. Prior payment that wins before authorization consumes the reservation and forces the denied agreement into neutralization; a previously consumed trial keeps its enrollment link and replay identity. Repeated imports preserve the earliest use. This changes eligibility history only, never legacy billing, terms, access, or receipt delivery.

Use the existing configured service/provider clients, with `TRIAL_IDENTITY_PROCESSING_APPROVED=true` and the reviewed identity key/runtime namespace. Both commands default to dry run. No credentials, account emails, card fingerprints, payer IDs or HMAC digests are printed. Treat opaque invoice/subscription IDs in operational output as restricted support references, not public reporting.

```sh
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=stripe --limit=20
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=stripe --limit=20 --after=in_PREVIOUS_PAGE --apply
```

Apply the **same first page** after inspecting its dry run, then continue with each returned `nextCursor` until `hasMore=false`. A dry-run cursor is not evidence that the page was applied. Keep a restricted run receipt with mode, merchant/mode namespace, page counts, starting/next cursor and review IDs. Every historical paid invoice is considered, including canceled subscriptions and prior cards; the existing `isTestMarkedBillingSubscriptionRow` predicate excludes explicit QA/seed records and reports `excludedTest` separately. A `backfilled_from_profiles` marker alone is deliberately not excluded because it can represent a real paid customer. No email/domain heuristic is used. Zero invoices and invoices without a subscription are skipped. Provider ownership/payment reads, never the analytics outbox or a `paid` flag alone, establish proof. Subscription owner and invoice/charge customer must match the canonical billing row; email must come from that owner's verified Auth record. The actual captured charge supplies the optional card fingerprint. Direct historical charges and payment intents are supported. Truncated invoice-payment lists, manual payment records, disputed captures and missing/deleted/uncertain owners need review. They are not proof of no prior paid membership. Ordinary refunds do not reset genuinely used history; disputed or incorrect ownership remains eligible for human correction.

`pageComplete=false` (exit 2) retains explicit review IDs; do not declare total coverage until these are resolved. Provider/storage failure exits 1 without a completion checkpoint; safely rerun the same page. Partial successful writes are idempotent. After reaching the historical end, rerun from the first page to catch payments arriving during traversal. Ongoing provider webhook reconciliation must cover new successful nonzero legacy membership payments after the backfill; the backfill is not a perpetual scheduler.

PayPal uses canonical subscription inventory plus explicit past windows of at most 31 days, an operator bound rather than a claim about the provider's statutory or API retention limits:

```sh
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=paypal --list --limit=20
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=paypal --list --limit=20 --after=00000000-0000-4000-8000-000000000001
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=paypal --subscription=I-VERIFIED --from=2026-08-01T00:00:00Z --to=2026-08-31T00:00:00Z
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-history-backfill.ts --provider=paypal --subscription=I-VERIFIED --from=2026-08-01T00:00:00Z --to=2026-08-31T00:00:00Z --apply
```

Replace `I-VERIFIED` with the exact `I-...` provider ID returned by inventory. Apply every contiguous window from the provider's returned `subscriptionCreatedAt` through the run's cutoff, for every inventory page; a completed empty window is not completion of the whole subscription. Adjacent windows deliberately share their boundary timestamp and imports deduplicate. `nextWindowFrom` identifies that boundary, not a new end time. The verifier checks the authenticated PayPal app and canonical payer, the complete transaction response and every nonzero completed EUR payment. Any malformed/truncated/provider-rejected historical window remains unresolved; do not infer zero payments. Missing canonical legacy records or deleted owners require trusted historical ownership reconciliation outside this automated pipeline; no email-based reconstruction or synthetic account is allowed.

The necessity, retention review and rights procedures above apply identically to imported and newly accrued consumed claims. Backfill is not an exception to an erasure, restriction or corrected shared-payment-method determination. Before replay after a rights case, inspect the controller's suppression/correction record and prevent the same erased evidence from being reimported. The service-only source registry and rights commands below supply that control; complete its migration/key setup before enabling writers. An HMAC table alone does not implement suppression or erasure rights.

Provider proof sources: [Stripe Invoice Payments](https://docs.stripe.com/api/invoice-payment) binds invoices to payment intents/direct charges; the [Charge object](https://docs.stripe.com/api/charges/object) supplies captured payment facts and the payment-method details at the time of payment. Current default payment methods, provider receipt emails and analytics events are not substitutes for that proof.

## Executable identity rights and replay control

Apply migration `20260914144351_trial_identity_rights_lifecycle.sql` **before the first historical claim import**. It refuses to invent source ownership for any pre-existing consumed claim whose enrollment is already NULL. If that precondition fails, stop and reconcile those specific records; do not disable the guard. Register the exact active HMAC key versions before any enrollment/history writer:

```sh
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts keys --versions=1
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts keys --versions=1 --apply
```

Use the configured version numbers, never copy a key secret into this command. Registry changes reject dropping a version still needed by retained used claims or a restriction. Rotation must keep that old key available while needed, register the reviewed overlapping versions and deploy the same versions to all writers. A stale writer missing a required version fails closed; source-level erasure suppression remains effective even when an old event carries only retired-version claims.

After independently verifying the request and its account/provider ownership in the restricted support case, use an exact known enrollment UUID or Stripe/PayPal agreement ID. `inspect` returns source state and aggregate kind/version counts, never hashes. Every mutating command is dry run until `--apply`; no send/refund/provider-cancellation action occurs here:

```sh
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts inspect --source-kind=stripe --source-id=sub_VERIFIED
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts restrict --source-kind=stripe --source-id=sub_VERIFIED --reference=RIGHTS_CASE --apply
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts release --source-kind=stripe --source-id=sub_VERIFIED --reference=RIGHTS_CASE --apply
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts correct --source-kind=stripe --source-id=sub_VERIFIED --kinds=stripe_card --reference=RIGHTS_CASE --apply
node --import ./tests/server-only-register.cjs --import tsx scripts/billing/trial-identity-rights.ts erase --source-kind=enrollment --source-id=00000000-0000-4000-8000-000000000001 --reference=RIGHTS_CASE --apply
```

`restrict` moves the selected matching claims into restricted storage. They no longer deny the free offer and cannot be recreated by a new event while restriction applies; all versions in the input identity group are excluded when any restricted version matches. `release` requires the same verified case reference and restores the original claim facts. A trial admitted while matching was restricted keeps its source-local exemption on later replay; restoration cannot retroactively invalidate its authorization. The exemption records identity kind/merchant namespace on that operation, never a new personal denial hash. It cannot restore an erased source. `correct --kinds=stripe_card` removes a mistaken shared-card association across its known sources while preserving unrelated account/email history; select `paypal_payer` for its equivalent. Default kinds cover account, verified email and both payment identities. Restriction/correction scope is an operator decision grounded in the verified rights case, never a guessed email match.

`erase` removes the selected hashes from matching, restricted storage and every known source association. It invalidates all associated old enrollment/provider-agreement sources. Later webhook or backfill payment IDs under the same old agreement cannot reconstruct those hashes, even if an invoice was not seen before erasure. Canonical paid access/contract state stays intact and already-authorized enrollment replay remains idempotent without rewriting identity claims. A genuinely new enrollment/agreement may qualify and later establish new use; there is no hidden personal-denial tombstone. Restore/backup procedures must preserve and apply this source registry **before** starting any writer, then replay the rights regression tests. Restoring an older database without the rights decisions is not a permitted replay procedure.

The remaining source rows and immutable action records contain operation IDs, action/kind and a restricted case reference, not the erased matching hashes. They exist solely to prevent old operation replays and demonstrate the rights action. Do not use them to match an applicant or deny eligibility. Review their necessity with the program and replay/import lifecycle; erase them when the old operations can no longer be replayed and this separate purpose no longer applies. Ordinary unused, provider-reconciled abandoned reservations purge their private matching associations, too. Contract notices, invoices and profile records remain subject to their separate rights/retention assessment; this identity command is not a blanket deletion of every customer record.

All identity admission/import writes and rights operations share a transaction lock before taking enrollment/identity locks. Source registration is mandatory and a trigger rejects unregistered direct claim writes. Existing incoming claims still use canonical per-identity advisory locks for exclusion. The operator's immutable action audit contains no raw identities or hashes. No scheduled job may blindly restore restricted claims, replay erased sources through a new fabricated agreement ID, or reconstruct identities from receipt email.

Verified in the local PostgreSQL-compatible harness: restriction stops matching and recreation; release preserves original consumption; erase removes all hashes; old enrollment and historical agreement replays stay suppressed; key rotation retains restrictions; corrected shared cards do not reset unrelated account history; a genuinely new enrollment can become eligible; unused abandoned source associations are removed; authenticated/client roles cannot execute rights functions. This is deterministic database/adapter proof, not a claim of a live production rights action.

## 15 September 2026 addendum — optional pre-charge reminder

Nick approved one day-five reminder for **all new Chaarlie trials**, both Stripe and PayPal, monthly and annual. This supersedes the earlier required-only policy for newly enrolled trials after the explicit reminder rollout cutoff. Mandatory notices and frozen historical AGB/receipt snapshots stay unchanged. The extra email does not replace any provider-required notice.

The approved draft is Customer.io workspace `219516`, transactional message `15`, trigger `chaarlie_trial_ending_reminder_v1`, from `Chaarlie <info@chaarlie.de>`. [Draft](https://fly.customer.io/workspaces/219516/journeys/composer/transactional/15/templates/155). It remains unactivated during preparation. The renderer supplies both HTML and plaintext at dispatch with `auto_create: false`, `tracked: false`, `disable_message_retention: true`; real contract values come from validated current enrollment terms. Annual first and renewal amounts can differ: never substitute the fictional preview price for accepted terms. Before activation verify the shared Customer.io layout, sender, and HTML/plaintext delivery with a controlled recipient.

Configuration (server only; no values set in production by this implementation):

| Variable | Required value / meaning |
| --- | --- |
| `TRIAL_REMINDERS_ENABLED` | Exact `true` enables scheduling and delivery; absent/false means no enqueue or claim. |
| `TRIAL_REMINDERS_ROLLOUT_AT` | Explicit immutable launch cutoff in UTC ISO format, e.g. `YYYY-MM-DDTHH:mm:ssZ`; only enrollments authorized at/after this instant qualify. No existing-trial backfill. Preserve this value across redeploys. |
| `CUSTOMERIO_TRIAL_REMINDER_TRANSACTIONAL_MESSAGE_ID` | Required saved template ID or trigger, verified against the intended workspace. Set `chaarlie_trial_ending_reminder_v1` for draft15 after activation checks. No automatic message creation. |
| `CUSTOMERIO_TRIAL_REMINDER_FROM` | Optional; defaults to verified `Chaarlie <info@chaarlie.de>`. |
| `CUSTOMERIO_APP_API_KEY`, `CRON_SECRET` | Existing transport and cron secrets, not new credentials. |

`GET /api/billing/trial-reminders/reconcile` runs every five minutes. It authenticates with `CRON_SECRET`, returns 200 disabled/no work when off, 503 without required configuration, and 500 on storage/settlement failure. Responses contain aggregate counts only. It claims at most three rows with 90-second leases; calls are sequential with a 10-second provider timeout and a 60-second route limit. Monitor oldest pending age; nominal capacity is three emails per five minutes. Do not promise minute-exact delivery or allow backlog to reach trial expiry.

Candidates are due at `original_trial_end_at − 48 hours`, equivalent to day five only under the current enforced seven-day/604800-second contract. Revalidate eligibility and the fenced attempt after resolving the verified account-owner email, immediately before the send. Cancelled, revoked, already paid, expired, unresolved provider state, missing owner or unstable contract-change state must never produce an upcoming-charge email. No send after expiry. Pending management operations are held for a later scheduler pass; irrecoverable/ambiguous states require support. A cancelled user can still receive an already accepted in-flight email; its text explicitly defers to their cancellation confirmation.

The separate `private.trial_reminders` queue preserves the difference between suppressible reminders and required receipts. Duplicate enqueue or competing workers must not resend. `queued` is only Customer.io acceptance, never proof of delivery. Network ambiguity, malformed acknowledgement, HTTP rejection, or expired send lease parks for support. If the provider accepts but DB settlement fails, keep the row parked; never retry the email blindly. Follow the existing provider-evidence support process before any manual reconciliation/replay. Do not print recipients, contract text, raw provider identifiers or provider error bodies into ordinary logs.

Launch order: apply and verify the migration; deploy tested code with reminder sending off; verify template activation, queue-as-drafts off, tracking off, retention disabled, explicit message identity and controlled delivery evidence; enable reminders with the fixed cutoff; only then expose the scanner offer's day-five promise to real new trials. Production activation is Nick's separate final step. A draft, passing local tests, or provider queue acknowledgement is not delivery proof.

Privacy and erasure: no recipient email or raw payment-provider agreement is persisted in this queue, but owner/enrollment links and contract snapshots remain personal data. Include the queue and its rendered receipt text in the same support/retention/erasure assessment as contract records. Queue deletion on applicable erasure must not change `has_ever_trialed` or otherwise regrant trial eligibility. No open/click tracking or marketing content.
