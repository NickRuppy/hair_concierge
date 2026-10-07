# Payment and required-notice email polish

## Outcome and source context

Replace the generic plain-text HTML wrapper used by the delivered `payment_receipt` notice with a branded, scan-friendly receipt that clearly confirms the successful transition from trial to paid membership. The current-state evidence is the Gmail delivery inspected on 22 September 2026: the email contains the correct facts, but renders as a small unbranded text block with awkward line wrapping and no visual hierarchy.

The concrete proposal is [payment-confirmation-email-polish.mockup.html](./payment-confirmation-email-polish.mockup.html). It uses the exact plan, amount, dates, provider, and identifiers from the inspected delivery so the review is contextual rather than abstract.

Revision 4 widens the requested outcome to the five other repository-owned notices that use the same generic wrapper: contract change, cancellation during trial, cancellation after payment, annual-renewal notice, and public contract-declaration receipt. Their concrete desktop/mobile proposal is [required-notice-email-polish.mockup.html](./required-notice-email-polish.mockup.html). It includes the eight meaningful subvariants rather than presenting one generic legal email as if all lifecycle states were equivalent.

## Chosen direction

Keep the existing subject, delivery timing, transactional sender, frozen billing snapshot, and complete receipt facts. Give `payment_receipt` its own structured presentation data and renderer, while reusing the established branded email shell already used by the trial confirmation. The first-paid variant leads with the successful transition out of the trial; the renewal variant uses the same receipt structure but says that the membership continues.

The rendered order is:

1. Chaarlie wordmark and `ZAHLUNG BESTÄTIGT` eyebrow.
2. Phase-aware confirmation headline and a factual continuity sentence.
3. A three-row fact card for amount, payment date, and paid-through date.
4. Plan, payment provider, and inclusive-tax note.
5. Primary membership-management CTA and a separate cancellation link.
6. Reply-for-help text.
7. Secondary receipt details containing contract and payment identifiers.
8. Existing company/legal footer.

The same hierarchy will be shared by the five additional families, with event-specific status copy and actions. Public declarations deliberately omit membership-management claims: they confirm only receipt of the submitter's assertion and that assignment/processing will be checked.

## Scope and non-goals

In scope:

- the HTML and plain-text presentation of `payment_receipt` notices for both `first_paid` and `renewal` phases;
- typed, snapshot-derived presentation fields for the payment receipt;
- Customer.io payload selection and local preview behavior for that notice;
- regression coverage for facts, escaping, responsive/email-safe markup, phase copy, and the absence of attachments/tracking.
- structured HTML and plain-text presentation for `contract_change`, `cancellation_receipt`, `paid_cancellation_receipt`, `annual_renewal`, and public contract-declaration receipts;
- the `switch`/`restore` contract-change variants and ordinary/extraordinary/withdrawal public-declaration variants shown in the reviewed evidence;

Non-goals:

- changing when a payment receipt is created or sent;
- changing Stripe, PayPal, entitlement, reconciliation, or retry behavior;
- changing the email subject, recipient resolution, sender, Customer.io message ID, or provider template outside the existing inline-content path;
- redesigning contract confirmation or provider-owned Customer.io templates outside this repository path;
- adding a PDF attachment to the payment receipt;
- deploying, sending a production email, or mutating Customer.io in this task without separate authorization.

## Target map

- `src/lib/billing/trial-required-notices.ts`: add typed `paymentReceipt`/`requiredNotice` summaries populated only for valid snapshots; retain the durable `receipt_text` as the complete factual source and fallback. Restore notices fail closed unless the committed enrollment snapshot already records `cancel_at_period_end=false`, matching the database transaction that applies the restore before queueing its notice.
- `src/lib/customerio/payment-receipt-html.ts` (new): render the structured HTML fragment and readable plain-text alternative with escaped values and phase-aware copy.
- `src/lib/billing/public-contract-declaration.ts`: expose a typed, receipt-only presentation summary derived from the immutable declaration snapshot without adding account or contract-state facts.
- `src/lib/customerio/required-notice-html.ts` (new): render the shared structured HTML/plain-text hierarchy for the five widened families and their subvariants.
- `src/lib/customerio/trial-required-notices.ts`: select the branded payment or required-notice renderer while preserving Liquid-as-data safety and `tracked: false`.
- `src/lib/billing/public-contract-declaration-receipt-delivery.ts`: pass the typed public-declaration presentation summary to the shared builder without changing queueing, retry, or settlement behavior.
- `tests/contract-email-design.test.ts`: add presentation/payload/provider-Liquid tests next to the existing required-notice email design contract.
- `tests/billing-trial-required-notices.test.ts`: extend message-construction coverage for first-paid and renewal presentation summaries.
- `plans/payment-confirmation-email-polish.mockup.html`: commit as the approved design evidence.
- `plans/required-notice-email-polish.mockup.html`: commit as the pending design evidence for the widened scope.
- `plans/payment-confirmation-email-polish.md`: commit as the implementation contract.

## Decision coverage

Status: **confirmed** — Nick approved the payment-receipt proposal, explicitly requested that the five identified sibling notices also be changed before shipping, and approved implementation of the eight-variant desktop/mobile proposal on 22 September 2026.

### Confirmed with Nick

- The delivered payment confirmation is not rendering acceptably and should look better.
- This is specifically the message sent after the trial finishes and the customer converts to a normal paid membership.
- Nick approved the rendered desktop/mobile proposal and asked Codex to implement it, then audit other Customer.io emails for the same class of rendering problem.
- After receiving the audit result, Nick said the five other emails should be changed before shipping.
- Nick reviewed the concrete five-family/eight-variant proposal and replied, “Okay please implement the new variants.”
- Source acknowledgement: Nick's request and attached Gmail screenshot on 22 September 2026.

### Inherited from evidence or contract

- The email is emitted only from a validated successful-payment snapshot; the renderer must not infer payment success from provider initialization.
- Amount, occurrence time, paid-through time, plan interval, provider, contract ID, payment ID, and inclusive-tax wording remain snapshot-derived.
- Provider data remains Liquid data, not template source; dynamic values must be escaped.
- Transactional tracking stays disabled.
- The full factual `receipt_text` remains available as the durable source/fallback and in Customer.io `message_data`; no payment PDF is introduced.
- Existing membership-management, cancellation, support, imprint, privacy, and unsubscribe routes remain unchanged.

### Implementation defaults

- Use email-client-safe tables and inline styles; no webfont, script, remote image, or CSS-dependent layout.
- Reuse the existing lavender canvas, white card, dark-purple typography/CTA, 600 px maximum width, and legal footer from the trial confirmation.
- Keep long UUIDs visually secondary and explicitly breakable on narrow screens.
- Show date-only values in the fact card for scanability; the exact timestamp remains in the durable receipt text/plain-text details.
- Use one full-width fact per row so the same hierarchy survives mobile clients without media-query dependence.
- First-paid headline: `Deine Mitgliedschaft ist jetzt aktiv.` Renewal headline: `Deine Mitgliedschaft läuft weiter.`
- Public-declaration HTML and plain text restate every immutable receipt fact in the approved hierarchy. The exact UTC receipt snapshot remains the download/payload source but is not appended as a visually duplicative second receipt.
- A `restore` contract-change snapshot with `cancelAtPeriodEnd=true` is rejected as contradictory. The committed database operation writes `false` before the notice trigger reads the enrollment in the same transaction.

### Open consequential assumptions

- Undiscussed consequential assumptions affecting this handoff: none.
- Parked out of scope: provider-template-owned Customer.io messages not rendered by this repository. Nick has not requested that separate provider inventory in this scope.

### Coverage acknowledgement

Nick requested the review and improvement of the payment confirmation that arrives after a trial converts successfully, then approved the rendered proposal with “Okay then please change it” on 22 September 2026. The same message authorized a read-only audit of other Customer.io emails for similar cases. After Codex named the five affected families and presented their rendered proposal, Nick explicitly requested implementation of the new variants before shipping.

### Internal revalidation

Revision 6, 22 September 2026: Nick approved implementation of all eight rendered variants. Revalidated that the implementation preserves the difference between provider processing and confirmed contract state, keeps full contract-change terms below the scan-friendly summary, prevents public declarations from implying account facts, and preserves their immutable receipt facts in the structured plain-text alternative without duplicating the raw snapshot in the approved visual layout.

## Designed user journey

Actor: a customer whose free trial has just produced a confirmed successful first payment, or whose later renewal payment has succeeded.

1. The existing billing lifecycle validates and records the successful payment, then queues the required `payment_receipt` notice exactly as today.
2. The customer sees the unchanged subject `Deine Zahlungsbestätigung von Chaarlie` and opens the email.
3. For `first_paid`, the first screen confirms that the trial is over, payment succeeded, and paid access is now active. For `renewal`, it confirms that payment succeeded and membership continues.
4. The customer can immediately scan the charged amount, payment date, and paid-through date.
5. The customer can open membership management or the direct online cancellation route without searching through receipt prose.
6. If support is needed, the customer can reply to the email. Contract and payment identifiers remain available lower in the message.
7. In a client that cannot render HTML, the plain-text alternative communicates the same phase, payment facts, management/cancellation routes, support path, and identifiers.

Recovery and meaningful variants:

- Long identifiers wrap without widening or clipping the mobile email.
- Stripe and PayPal display their respective provider label from the validated snapshot.
- Monthly and annual plans display their own plan label and paid-through date without changing layout.
- Invalid/mismatched payment snapshots are still rejected before rendering; this task does not create a visual state for failed or pending payments.

Completion state: the customer can tell that payment succeeded, how much was charged, how long access is paid, and where to manage or cancel the membership without parsing technical prose.

For the widened notices, the customer first sees the exact event status and its consequence: unchanged trial after a contract change; no paid period after a trial cancellation; paid-through access after a paid cancellation; amount/date/cancellation right before annual renewal; or receipt-only confirmation for a public declaration. Provider-processing caveats and durable identifiers remain visible below the summary. HTML failure falls back to equivalent plain text.

## Planning evidence

- [Rendered desktop/mobile proposal](./payment-confirmation-email-polish.mockup.html): answers how to improve hierarchy without dropping legally and operationally useful receipt facts. Selected direction: branded confirmation shell, fact card, visible management/cancellation actions, secondary identifiers. Evidence-review status: **approved by Nick on 22 September 2026**.
- [Five-family desktop/mobile proposal](./required-notice-email-polish.mockup.html): answers how one shared visual system can preserve eight materially different lifecycle states. Evidence-review status: **approved by Nick on 22 September 2026**.
- Live Gmail inspection on 22 September 2026: confirms the supplied screenshot matches the actual delivered MIME rendering and is not a screenshot-only or local-preview artifact. The delivered body is the generic `receipt_text` wrapper.

Artifact disposition: both this plan and the rendered mockup are `commit`. The temporary counterpart-review report is `discard`. No provider test delivery is created during planning.

## Customer.io email audit

Read-only audit performed on 22 September 2026:

- **Same source-level rendering problem confirmed and included:** `contract_change`, `cancellation_receipt`, `paid_cancellation_receipt`, `annual_renewal`, and public contract-declaration receipts previously flowed through `REQUIRED_NOTICE_HTML_PREFIX`, an unbranded white canvas with a 560 px plain-text block and no content hierarchy. Nick subsequently approved the five-family/eight-variant proposal, so these routes are implemented in task 4 while the generic fallback remains covered for legacy/unknown callers.
- **Already branded in source and recent inbox evidence:** contract confirmation, the trial-ending reminder, and mobile research delivery use purpose-built HTML. The recent trial-ending reminder visible in Gmail had the expected branded hierarchy and readable summary content.
- **Provider-template-owned and not determinable from repository markup alone:** payment-support receipt/resolution, one-time Personal Plan confirmation, Personal Plan/quiz/scanner result artifacts, and partner/access/account emails send message data to templates stored in Customer.io. Their visual quality requires provider-template or delivered-inbox inspection.
- **Live evidence limitation:** the Customer.io transactional-message inventory at workspace `219516` remained stuck on `Loading…`; the browser debugging connection then detached. The Gmail search for recent Chaarlie deliveries confirmed the current payment receipt and trial reminder, but did not contain recent samples of the other five generic required-notice variants. Therefore the source-level finding is confirmed, while a complete live-template inventory and delivered-client verdict remain pending.

Audit conclusion: the five generic required-notice routes are now included in the requested pre-ship scope. Provider-owned templates remain a separate live-inspection concern; no production template or send was mutated during this audit.

## Ordered tasks

1. **Create the structured payment-receipt presentation contract.**
   - Consumes: validated `TrialRequiredNoticeSnapshot` for kind `payment_receipt`.
   - Produces: a typed `paymentReceipt` summary with phase, plan, amount, payment time, paid-through time, provider label, contract ID, and payment ID, alongside the existing `receipt_text`.
   - Add first-paid and renewal tests proving snapshot values map exactly and invalid snapshots still fail closed.
   - Complete when both phases produce deterministic summaries without changing any other notice kind.

2. **Render the approved HTML and plain-text receipt.**
   - Consumes: `paymentReceipt` from task 1 and the approved mockup/copy.
   - Produces: escaped, email-safe HTML content plus a plain-text alternative that carries the same facts and routes.
   - Add assertions for phase-aware headline/intro, amount/date/paid-through hierarchy, provider/plan/tax context, CTA/cancellation/support links, identifiers, mobile-safe wrapping, and no dropped exact timestamp in plain text.
   - Complete when the local preview matches the approved evidence at desktop and 390 px without horizontal overflow.

3. **Route only payment receipts through the branded renderer.**
   - Consumes: renderer outputs from task 2.
   - Produces: Customer.io payload fields and inline Liquid selection for `paymentReceipt`; the approved sibling families are widened separately in task 4.
   - Test that Liquid variables are data, malicious/literal Liquid input remains escaped, `tracked` stays false, no attachment is added, and the generic fallback remains unchanged for legacy/unknown callers.
   - Complete when provider-template simulation equals the local preview for both payment phases and the existing email test suite passes.

4. **Extend the structured renderer to the five approved sibling families.**
   - Consumes: the reviewed five-family mockup plus validated billing snapshots or the immutable public-declaration receipt payload.
   - Produces: one typed required-notice presentation contract with explicit event/subvariant status, facts, actions, and identifiers; public declarations remain receipt-only and never infer account state.
   - Add tests for switch/restore, trial/paid cancellation, annual renewal, and ordinary/extraordinary/withdrawal declarations; preserve every durable fact in plain text.
   - Complete when all eight variants match the approved hierarchy at desktop and 390 px, escape dynamic values, retain `tracked: false`, and no unrelated template path changes.

5. **Verify the rendered and delivered contract before publication.**
   - Consumes: completed implementation and automated evidence.
   - Produces: browser screenshots at desktop/mobile and, only when separately authorized with an appropriate test recipient, one actual Customer.io test delivery/MIME inspection.
   - Complete for review-ready handoff when local/browser checks pass and the plan records any provider-delivery evidence still pending. A deployment or queued API response alone must not be reported as inbox-rendering proof.

## Verification

Automated:

- focused Node tests for `tests/billing-trial-required-notices.test.ts` and `tests/contract-email-design.test.ts` under the repository's Node 22 baseline;
- existing typecheck/lint and repository-ready checks selected by `ready-check` after implementation;
- assertions that unrelated provider-owned templates and the generic legacy fallback are behaviorally unchanged at their routing boundary.

Manual/browser:

- render the real preview function with the inspected first-paid fixture at desktop and 390 px;
- verify hierarchy, link labels/targets, UUID wrapping, absence of horizontal overflow, and readable behavior with images disabled (the design uses none);
- render renewal, monthly, PayPal, and long German date variants.

Live/provider:

- not required to approve the design or review the local implementation;
- before claiming provider/inbox rendering is fixed in production, inspect an authorized actual Customer.io delivery in Gmail, including HTML and plain-text/MIME facts. Provider queue acceptance is insufficient.

Evidence-sensitive review:

- confirm that all payment-success language is reachable only after the existing validated successful-payment snapshot;
- confirm exact amounts, timestamps, identifiers, paid-through date, provider, and tax wording are preserved;
- confirm no dark-pattern cancellation friction, upsell, tracking, or unsupported entitlement promise was added.

## Review and handoff

- Worktree: `.worktrees/payment-confirmation-email-polish` on `codex/payment-confirmation-email-polish`; root `main` remains clean.
- Planning gate: satisfied — Nick approved both linked rendered proposals and the complete widened scope on 22 September 2026.
- Counterpart gate: satisfied after Claude.ai re-authentication on 22 September 2026. Opus at `high` found no confirmed correctness defect; Codex accepted the supported plain-text coverage, restore-invariant documentation, durable-receipt decision record, and branding/spacing consistency findings, while rejecting the dead-code claim because the generic fallback is still exercised by legacy/unknown payload tests. A final pass over the stabilized diff found no hard defects; remaining notes are non-blocking maintainability, extra-test, and provider-rendering risks.
- Implementation gate: after approval, use `implementation-loop`, which invokes `ready-check` and `request-code-review` for the completed branch.
- Stop point: a verified, review-ready local branch. No commit/push/draft PR without explicit `ship it`; no merge, deployment, production send, or Customer.io mutation is implied.
