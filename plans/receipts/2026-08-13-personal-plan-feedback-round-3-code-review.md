# Personal Plan feedback round 3 — code-review receipt

## Review identity

- Scope: all 17 modified implementation/test files plus task-owned plan, findings, mockups, and rendered evidence in the uncommitted worktree.
- Branch: `codex/personal-plan-feedback-round-3`
- Base: `origin/main` at `53745c22bf2a3041959920a860677646ac929303`
- Reviewed canonical content fingerprint: `4fa4ebf2f3fb4695e03027b639502d8eb39856d3835d150ae766db54dfbf059f`
- Review lanes: normal correctness/contract review and structural maintainability review because the change spans 10 source files and more than 900 changed lines. One read-only Claude counterpart review ran at `high`; the main session verified every material finding against callers and tests. A later user-requested parallel pass used two read-only explorers and two disjoint implementation workers; the main session inspected their delta and reran the integrated gates.

## Findings and rulings

No blocking findings remain.

Resolved P2 findings:

1. A provisional product using nonstandard or missing imagery lost its accessible provisional label and status hook. The fallback now preserves `confirmed`/`provisional`, adds a separate image-treatment hook, and has a regression for a provisional owner image.
2. The missing-product recommendation browser used one index for both browsing and selection. Parent-owned selection is now separate from the presentation-only browse cursor; browsing candidates 2/3 does not change the CTA target, selecting a card is explicit, and exact ID/fingerprint persistence is covered.
3. The new missing-product behavior lacked interaction-level coverage. Tests now invoke browse, select, exact save, and zero-candidate search actions.
4. The full Stage 3 client-flow boundary did not prove that browsing to candidate 3 preserves its exact ID/fingerprint through canonical `planned_purchase`; a deterministic flow regression now covers that path.
5. The Stage 5 day-card link's explicit accessible name flattened the visual shelf's provisional/open labels. The link now includes one derived category/product/status shelf summary, while the decorative shelf is hidden from assistive technology.

Resolved P3 findings:

- Shelf SVG clip IDs include day type, preventing duplicate IDs when the same product appears at the same position on multiple days.
- Selectable recommendation cards keep headings/content outside the button and use an absolute labelled selection control.
- The Anwendung aggregate status label moved from a paragraph to a named section.
- The race-prone immediate negative Playwright assertion was removed; the awaited next Oil heading proves Conditioner skipped the role screen.

Accepted tradeoffs / non-blocking residuals:

- `xMidYMid slice` is retained because full-image fill inside the approved silhouettes was explicitly selected and visually reviewed; neutral fallbacks avoid cropping nonstandard imagery.
- The public `product-images` path is the current standardized-image presentation boundary. Assets outside it fail to the neutral contained treatment; background normalization coverage remains a catalog-pipeline rollout consideration.
- `styling` intentionally uses the neutral fallback because the approved map contains ten named Personal Plan product families, not an invented eleventh shape.
- Stage-specific category colors remain local because Routine tints and Anwendung outline colors serve different visual systems.
- The uncovered-role detector remains fail-closed for captured/pending identities and matches the current gateway construction.
- An in-flight draft that previously selected a supportive candidate for an uncovered role will become `not_ready` and require a new decision after rollout. This is an intentional fail-closed policy transition and should be watched after release.

## Verification considered

- `npm run test:personal-plan` — 1479/1479, exit 0.
- `npm run test:playwright:personal-plan-stage3` — 15/15, exit 0.
- `npm run ci:verify` — typecheck, lint (0 errors; 4 unrelated existing warnings), and production build with 126 routes passed.
- Focused review-fix regression set — 126/126, exit 0.
- Focused Stage 3 explorer/worker set — 118/118, exit 0; Stage 5 follow-up suite — 209/209, exit 0.
- `git diff --check` — passed.
- Rendered mobile/desktop evidence from ready-check remained applicable; the post-review changes affect selection semantics, accessibility metadata, and duplicate SVG IDs without changing the approved layout.

## Artifact disposition

- Commit later if publication is explicitly authorized: implementation, tests, approved plan/findings, decision-history HTML, five rendered PNGs, and both receipts.
- The five PNGs remain intentionally ignored by the repository-wide rule and require `git add -f` only at the ship gate.
- No staging, commit, push, PR, merge, deployment, migration, flag change, catalog publication, or production write occurred.

## Bottom line

Ready for a separate explicit `ship it` gate. No blocking findings.
