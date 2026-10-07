# Scanner email mobile refinement — 15 September 2026

## Sources and application
- [Mailchimp: Mobile Friendliness](https://templates.mailchimp.com/design/mobile-friendliness/) — readable 16px copy, thumb-friendly targets of about 46px or larger, generous link spacing and wide primary buttons. Applied: 16px main copy/reviews, full-width 54px trial button, existing separate WhatsApp contact card.
- [Mailchimp: Images](https://templates.mailchimp.com/design/images/) — images should support the message; essential meaning remains live text. Applied: one existing 95,622-byte shelf image with descriptive alt text; headline, copy, trial CTA and terms are HTML text. No generated replacement visual.
- [Litmus: CTA best practices](https://www.litmus.com/blog/click-tap-and-touch-a-guide-to-cta-best-practices) — descriptive early primary CTA, room to tap, subordinate secondary actions, image-independent buttons, and audience testing rather than universal conversion claims. Applied: retain seven-day CTA, move before explanatory steps; WhatsApp retains secondary outline style below quotes.

These are design guidelines, not evidence of a measured Chaarlie conversion lift. An early image is our contextual recommendation because it demonstrates the scanner; there is no universal fixed fold across email apps. A very large hero could push the action too far down. This implementation uses the existing landscape photo at its natural responsive ratio.

## Preserved and adjusted
Locked baseline: variant-a-locked.html (exact copy of approved trial/review/WhatsApp version).
Mobile version: variant-a-mobile.html; draft plaintext companion: variant-a-mobile.txt.
Unchanged: core profile-to-product-match promise, shelf photo, seven-day trial, post-trial paid subscription disclosure, three-step process, exact Sarah and Kim testimonials, existing WhatsApp destination and legal footer.
Adjusted: photo immediately after compact headline; redundant eyebrow removed; shorter opening paragraph; trial CTA/terms before the three-step explanation; compact steps with no disconnected decorative timeline rules; readable review typography. Full-width HTML button remains one primary action.

## Browser evidence
Comparison: mobile-comparison.html. Both documents tested at narrow widths with no horizontal overflow; images loaded.
At 375px frame (373px inner width):
- locked: image begins at y=643px; CTA begins at y=1033px, height53px.
- mobile: image begins at y=186px and ends388px; CTA begins518px, height54px.
At 320px frame (318px inner width): image begins186px; CTA begins483px; height54px.
Wider responsive column tested at410px inner width: no overflow, image begins186px, CTA begins517px.
Coordinates refer to email document top, not entire phone display. Comparison uses a600px body window with a labelled approximate email header; it is not a Gmail emulator. No promise that every device displays the entire image/CTA without scrolling.

## Still required for delivery implementation
This is local design evidence, not a provider-delivered email. Confirm real mobile Gmail and desktop Gmail receipt, blocked images, dark mode, correct recipient-specific CTA/unsubscribe links and MIME plaintext after provider templating. The existing WebP asset has been preserved byte-for-byte for the design; production asset compatibility must be checked for supported email clients, with an approved JPEG equivalent if needed. Trial eligibility, marketing recipient consent and separation from the organic result message remain separate delivery requirements from the controlling plan.
