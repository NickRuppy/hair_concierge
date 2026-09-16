# PDF contract confirmation verification — 2026-09-16

## Current candidate
Branch `codex/contract-email-design`, base `22af7e2309c5fe7d4869e86f6019c10c5fa23b35`. Short HTML and plain-text confirmation, complete original contract text in a mandatory PDF. Existing frozen receipt wording is unchanged. Nonconfirmation notices retain their original body and no attachment. No billing, deployment, activation, commit, push or merge performed.

## Checks
- Red proof: original implementation failed the short-body/PDF expectation (2 of 4 design tests failed).
- Focused tests: 37/37 passed across contract design, billing notices, shared transactional sender and public declaration receipt delivery.
- `npm run ci:verify`: exit 0 (typecheck, lint, production build).
- After pagination adjustment: re-extracted final PDF and compared complete normalized text to original receipt; exact match. Four pages, 10,884 bytes. Inspected every page, including regenerated pages 3–4 after keeping the § 8 heading with its paragraph.
- Desktop and 375px browser previews inspected: no overflow, readable payment facts, compact attachment footer.
- No missing contract sections, all twelve AGB sections, withdrawal instructions and form included. Receipt contains no customer-authored free text. Standard fonts support current frozen German text; unsupported characters/empty document reject generation.
- Shared provider request includes attachment dictionary; encoded-size overflow is rejected before fetch. Tests retain old request shape without attachments.

## Actual review delivery
Gmail message `1a0a93e84cbcb6bd`, 2026-09-16 08:04:01 UTC, subject `[TEST] [PDF-Review] Dein Chaarlie-Test: Vertragsbestätigung`, sent from Nick's authenticated Gmail to the same account. Verified INBOX label, multipart/alternative short HTML/plain bodies, and application/pdf attachment `Deine-Chaarlie-Vertragsunterlagen.pdf` (10,884 bytes). Read the received attachment through Gmail and compared its complete extracted text to the original receipt, normalizing whitespace and generated title/page footers: exact match.

Synthetic contract identity and dates; no real contract created. Gmail review omits the provider-specific unsubscribe anchor because Gmail cannot expand Customer.io's Liquid token; main content, PDF and plain text match the candidate. Production sender remains Chaarlie.

## Boundary and disposition
Customer.io attachments require the transactional API; no local App API key is available. Gmail delivery proves this review copy, not Customer.io attachment delivery. Before production release, send and inspect a Customer.io API confirmation with the attachment. Draft 19/template 159 remains inactive and still represents the earlier inline design; it is not the PDF candidate. Previous design-only Customer.io Gmail test `1a0a9308d7feb619` is historical evidence only.

Retain this plan, short HTML preview and synthetic PDF for eventual PR review. Temporary reviewer reports and render/extraction files remain outside the repo under `/tmp`. User approved PDF direction; no further choices were introduced. Plan review approved with implementation-detail revisions resolved in the plan. Final Claude code review found no hard defects. Accepted its monthly spacing cleanup and added an automated pdf-parse extraction/equality assertion using the existing dependency. The reviewer referenced the historical design-only delivery; the current Gmail PDF delivery evidence above supersedes that stale reference. Customer.io API delivery remains unverified.

Source/test/dependency fingerprint (sorted path + NUL + contents + NUL): `c7b98a94b6213bc058f0a0020b4ef911223b828a1aa71dfe21489bf27165c537`. PDF SHA-256: `ef54023270e1ab5fe7db3fa8ce17a2fdd2b18c3b5b68031a044077972ea512f0`.
Final design suite after full PDF text equality assertion and monthly spacing cleanup: 5/5 passed. These final small changes were rechecked with typecheck and scoped lint; the earlier full build predates only those changes.

## Activation follow-up — 2026-09-16
Nick approved the review and asked to make this the Customer.io version. Production reads confirm the `enqueue_trial_contract_notice` trigger is enabled and enqueues once per active, successfully authorized trial enrollment, independent of funnel. Two active Stripe and two active PayPal enrollments correspond to four queued contract confirmations. Queue status alone does not prove inbox delivery. The app overrides Customer.io body/subject per send, so editing a dashboard template cannot activate this change.
Production Vercel lists a Customer.io App API key, but its value is unavailable in the local production environment export. That temporary export was deleted. The API attachment delivery gate remains open. Preparing a draft release PR; merge/deployment remain pending.
