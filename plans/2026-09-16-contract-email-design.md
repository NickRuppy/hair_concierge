# Short contract confirmation with PDF

## Outcome and authorization
Nick reviewed the earlier styled test and approved a shorter email with the complete contract in a PDF attachment: “good do it”. Implement and send one labeled review email to Nick. No push, merge, deployment, activation, or billing changes.

## Decision coverage
Confirmed: concise HTML and plain-text summaries with price, deadline, next charge, cancellation and management links. Full unchanged frozen receipt_text, including terms, withdrawal instructions and form, goes into a text-based PDF attached to the same message. A website link alone is insufficient. Other notice types remain unchanged. Canceled confirmations retain their existing semantics. Summary comes from the same validated snapshot as the receipt. No unresolved consequential choices for this review candidate.
Defaults: existing approved table-based purple design; small A4 PDF with readable standard fonts, wrapping, page numbers and section headings. pdf-lib runs in the existing Node sender, with no external PDF service or stored document dependency. The async builder must successfully generate the attachment before any provider send; errors fail closed through the existing dispatch path. Never silently omit or truncate legal text. No changes to legal wording or claim of legal certification.

## Journey and implementation
Recipient reads the short confirmation, can manage/cancel, and sees “Deine vollständigen Vertragsunterlagen mit AGB und Widerrufsbelehrung findest du im PDF-Anhang.” They can save the attachment independently of the website.
1. Preserve receipt_text, generate PDF from every original line; measured wrapping and pagination, explicit failure for unsupported characters.
2. Async required-notice payload builder adds filename/base64 attachment for confirmations only, and short plain text alongside short HTML. Update all callers to await it. Existing nonconfirmation content stays unchanged.
3. Shared Customer.io API request passes attachment dictionary and enforces the documented encoded-size limit below 2 MB. No fallback to an email without required attachment.
4. Regression checks cover exact receipt preservation, short bodies, attachment parsing, canceled/monthly/provider variants, literal Liquid/HTML safety, unsupported characters and oversize rejection. Independently extract PDF text and compare the full normalized receipt; render and inspect every page. Run affected delivery tests, typecheck, lint and ci:verify; read-only counterpart review.

## Delivery and evidence
Customer.io supports attachments only through the transactional API; its UI test cannot attach files. No local App API key is available. Send the rendered review via authenticated Gmail to the user, with synthetic contract data and the exact generated PDF. This verifies the review MIME and document, not the Customer.io production delivery path. Production release requires a Customer.io API delivery check. Keep the existing inactive draft inactive.
Retain HTML preview and synthetic PDF alongside this plan, and a concise verification receipt. Transient reviewer reports live under /tmp. Prior Customer.io design-only test (without PDF): Gmail 1a0a9308d7feb619. Revalidate decision coverage before handoff; no new approval needed for the authorized test.

## Target map and counterpart plan review
- `src/lib/customerio/contract-pdf.ts`: text PDF generator; `contract-confirmation-html.ts`: short HTML and plain-text renderers.
- `src/lib/customerio/trial-required-notices.ts`: async builder, `confirmation_html` and `confirmation_text` as Liquid data, full `receipt_text` preserved, mandatory attachment for confirmation. Await in `sendTrialRequiredNotice`.
- `src/lib/customerio/transactional.ts`: optional attachment dictionary on both payload/request types, encoded-size guard, request forwarding. Template-only callers remain unchanged.
- `src/lib/billing/public-contract-declaration-receipt-delivery.ts`: await the shared builder. Update builder callers in billing/design tests. Add focused provider and PDF tests; package/lock add pinned pdf-lib.
- Replace prior preview/verification receipt with PDF-design evidence; retain prior test ID only as historical context.
Claude plan review: approved with revisions; target/call-site details above resolve its implementation gaps. Production delivery through Customer.io remains a release gate. This candidate fails closed through the existing failed-notice path; it must never silently send an incomplete confirmation. No changes to automatic retry or recovery policy are introduced.

## Approved activation follow-up
Nick accepted the delivered PDF design and requested it as the active Customer.io version. The production sender owns content through per-send API overrides. Prepare the reviewed branch for release; distinguish a published PR from deployment and successful provider attachment delivery. Live database trigger is enabled for all active authorized trial enrollments, independent of funnel origin. No schema changes are needed.
