# Direct mobile landing draft — superseded

Superseded on 14 September: Nick now wants scanner ads to enter question 1 directly, with a short explanation. See [current refinement plan](refinement-plan.md) and [new mockup](preview/quiz-entry-preview.html).

14 September 2026. Historical visual decision evidence only; no production implementation or publication.

## Current user direction

Nick rejected the combined landing additions and asked to “just keep the very direct one of Jonas” and make it “full screen on mobile.” This supersedes the earlier request to add Nick’s three-step and benefit sections underneath.

Confirmed direction: keep Jonas’s pre-quiz headline, supporting copy, scanner image and passive animation, metadata and main CTA. Remove the added explanatory sections, secondary CTA and footer from this mockup. Fill the mobile viewport with the image taking remaining space and the main CTA near the bottom. Existing quiz remains unchanged; interactive example scan excluded. Result-page video/explanation work and floating WhatsApp remain separate.

## Evidence

- [Current mobile review view](preview/combined-landing-preview.html).
- [Standalone direct landing](preview/combined-landing.html).
- [Unmodified Jonas original](preview/jonas-original-quiz.html).
- Jonas source: #535 d7de91a02a5435a031b233b27a7444bcd0592f1d, docs/scanner-offer/mockups/quiz-scanner-flow.html, first landing screen.

All visitor-facing landing copy remains Jonas’s. The revision changes the composition to viewport height, allows the photo to fill the available area, keeps its scan overlay aligned with the image crop, and includes a bottom safe-area inset. Small viewports or larger text can scroll instead of clipping content. The phone chrome and explanatory notes outside the iframe are review scaffolding.

## Decision coverage

Status: visual evidence confirmed on 14 September by Nick’s “good. This way we will now review all the parts.” Nick approved the shown direct version and full-screen mobile composition. The shown crop/spacing is accepted as the visual direction; remaining responsive/legal/navigation integration details must be resolved before implementation. This artifact fulfills the requested mockup, not an implementation-ready plan or final journey sign-off. The removed combined design is superseded.

Verified in browser at the review frame’s 406 × 850 content size: original text and image render, image/animation fill the central space, one start button is visible at the bottom, and the added sections are absent. No application tests or production changes. CTA shows a local preview notice; it does not submit quiz data or trigger tracking. Artifacts remain uncommitted in the existing task worktree.


The evolving whole-funnel decision record is [refinement-plan.md](refinement-plan.md).
