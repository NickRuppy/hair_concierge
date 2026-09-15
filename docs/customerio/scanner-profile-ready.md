# Scanner profile result email

## Approved behavior
All visitors completing the scanner quiz receive this result email independently of marketing consent, trial history or subscription status. Persisted scan_v1 funnel identity selects it; the organic result email is unchanged. Older leads qualify when they complete the scanner flow. Existing once-only receipt protection remains; no bulk resend or receipt reset.

Both trial CTAs use the same recipient-specific result URL and preserve entry=result_email. They do not activate a trial. Checkout remains responsible for eligibility and payment.

## Provider receipt — 2026-09-15
Workspace219516, transactional message18, template158, name/trigger scanner_profile_ready_v1. State active after release QA; send_to_unsubscribed=true, queue_drafts=false, link_tracking=true. Passthrough layout2 ({{content}}), sender identity1. HTML/plaintext exactly read back against the canonical files before delivery-rule change; subsequent message-settings readback verified the consent-independent setting and active state.

Canonical files: scanner-profile-ready-template.html and scanner-profile-ready-plain-text-template.txt. The approved layout is docs/mockups/scanner-emails/variant-a-approved.html. The HTML has two escaped trigger.result_url slots and one genuine unsubscribe tag. Live shelf-image URL returned200.

## Cutover checks
- Routing and duplicate-send tests pass; organic fixtures remain unchanged.
- Set CUSTOMERIO_SCANNER_RESULT_TRANSACTIONAL_MESSAGE_ID to18 only alongside the reviewed integration release and activated provider template. Do not point to the organic template or use a default all-messages ID.
- Received desktop Gmail rendering and both personalized links passed delivery QA. Browser mobile preview remains responsive design evidence; other email clients were not visually tested.
- Verify active provider state and deployed config separately; a saved draft is not a live integration.
- Do not activate marketing automation11/v6 as part of this email change.

Release QA: one clearly labelled test was delivered to the authorized info@chaarlie.de inbox. Desktop Gmail showed the WebP photo, aligned content, both trial buttons, reviews, WhatsApp and footer without clipping. Both received CTA links matched the supplied test lead result URL; this visual test alone does not prove scanner routing.

## Provider render check
Customer.io previews/email evaluated the canonical HTML and plaintext using a synthetic example.com result URL and preview-only email_id. Body, plaintext, subject, layout and link validation returned no errors. Both trial CTA links resolved to the exact same result URL, including its query parameters. The first preview lacked the provider email_id needed for unsubscribe rendering; after supplying that preview context, all render checks passed. This operation rendered only; it sent no email and created no customer.

## Release verification
Fresh origin/main base ca176e7d. Full ci:verify passed (typecheck, lint, build); 44 focused email/route tests passed. Claude whole-tree review found no blockers and parent inspection accepted its findings. No migrations. Provider message18 activated and production CUSTOMERIO_SCANNER_RESULT_TRANSACTIONAL_MESSAGE_ID=18 added before application release; deployment and real scanner completion still require post-merge verification.
