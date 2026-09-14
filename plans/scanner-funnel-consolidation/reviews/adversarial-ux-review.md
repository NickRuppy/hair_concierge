# Adversarial mobile UX/design review

14 September 2026 · draft revision 12 · independent judgment-worker review, verified and triaged by main session. Read-only; no design changes applied. Baseline: [content hashes](ux-review-baseline.json).

## Verdict

Keep the accepted flow. Resolve screenshot legibility and floating-contact collisions before founder lock, and clarify that the displayed scan belongs to an example profile. Accurate video captions remain a media requirement before launch. The testimonial-heading suggestion is an editorial decision, not evidence that the actual quotes are fabricated.

## Findings and main-session disposition

| ID | Priority/type | Observed evidence and user impact | Smallest proposed remedy | Disposition |
| --- | --- | --- | --- | --- |
| UX-01 | P2 · legibility | At a 320px frame the 390px source screenshot renders 216px wide; labels and explanation are miniature. The genuine product photo is visible, but fit reasoning is difficult to read. [Screenshot](ux-evidence/320-product-result.png). | Reduce nested framing/padding and let the visitor enlarge the unmodified image. | Evidence accepted. Enlargement is a proposed new interaction for founder decision; no image manipulation or replacement implied. |
| UX-02 | P2 · comprehension risk | “Dein Ergebnis auf einen Blick” precedes an example whose medium-diameter hair/balanced scalp differs from the page's fine-hair/dry-scalp fixture. The visible “Beispiel” badge mitigates this; the explicit example-profile caption comes after the tall phone. [390px context](ux-evidence/390-product-result.png). | “So sieht ein Scan-Ergebnis aus”; move the existing example-profile clarification above the image. | Main verified header, badge and caption order. Proposed copy hierarchy correction; not an allegation that the example is undisclosed. |
| UX-03 | P2 · floating control collision | WhatsApp obscures the annual card's “im ersten Jahr” and can cover quote text during scrolling. [Price collision](ux-evidence/320-timeline-prices.png), [quote collision](ux-evidence/320-testimonials.png). | Define a predictable collision/visibility rule or reserve a contact position that does not cover meaningful content. A fixed upward offset alone only moves the problem. | Evidence accepted. Founder decision needed on contact behavior; WhatsApp itself remains required. |
| UX-04 | P2 · media accessibility | No HTML caption track exists; reviewer sampled playback at 0s and approximately 15s without visible captions. A silent viewer cannot follow spoken content. [Playback](ux-evidence/320-video-playing.png). | Accurate German captions on the same video. | Main confirmed zero track elements. Media-preparation requirement, not a change in section order. Audio accuracy itself was not reviewed. |
| UX-05 | Editorial choice · attribution | Name-attached headings such as Sarah's “Nie wieder googeln vorm Regal” promise more than the underlying quote explicitly says. Quotes themselves are retained verbatim. [Cards](ux-evidence/390-testimonials.png). | Use first names alone, or clearly distinguish editorial headings from customer statements. | Plausible credibility concern, not a proven usability failure. Requires founder choice because Jonas's headings were previously selected. |
| UX-06 | P3 · touch target | Reviewer measured sticky “Angebot ansehen” at 36px high; the main CTA is 53px and WhatsApp 48px. [Header](ux-evidence/320-profile.png). | Expand clickable height to at least 44px without necessarily enlarging the visual pill. | Recommended small usability improvement. Measurement is reviewer-derived, not a WCAG compliance verdict. |

## What to retain

Single profile-to-scanner bridge; centered plum outcome cards; real qualified-match example; compact timeline immediately before pricing; clear first-year/renewal amounts and working monthly terms; restrained testimonial cards; roomy FAQ controls; wrapped legal footer. Keep the quiz, accepted section order, prices, four-card benefits carousel and absence of an additional sticky purchase bar. Page length alone is not an evidenced defect; no conversion uplift or abandonment claim is established.

## Review coverage and limits

Reviewer inspected the entire journey at nominal 390px and 320px, scrolled the benefits carousel, expanded recovery FAQs, switched the monthly plan, played the video and inspected the standalone draft. Main inspected the screenshot-legibility and pricing-overlap images directly and verified source caption-track absence, example labelling/order and unchanged baseline hashes. No production or repository design mutations occurred. This is an adversarial design review, not a full accessibility audit or measured conversion study.

Day-five reminder delivery, real cancellation/access behavior and final WhatsApp destination remain separate implementation dependencies. Prototype checkout and contact dialogs were intentionally excluded as known mockup adapters.

## Requested next review

Discuss/resolve findings with Nick, revise agreed items, and obtain founder design lock. Then run the explicitly requested Claude review via `claude-plan-review` at high effort on the locked visual evidence and corresponding plan. Claude Code 2.1.234 is available; no Claude review was run in this pass. Do not treat the reviewer as implementation authority or the existing section-order approval as final whole-journey sign-off.


## Founder response — 14 September

Nick agreed with all six recommendations (“all these sound awesome”) and asked to keep them recorded, then requested Claude's independent review immediately. Recommendations are acknowledged for refinement: improve/enlarge the screenshot, clarify the example heading and label, prevent WhatsApp collisions, add accurate German captions, simplify testimonial attribution, and enlarge the header hit area. Exact contact behavior and revised visual evidence are still to be resolved; this response does not constitute final whole-journey lock. No draft changes were made in this review turn.
