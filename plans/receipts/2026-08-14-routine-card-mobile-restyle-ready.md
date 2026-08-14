# Routine card mobile restyle — ready-check receipt

## Identity

- Branch: `codex/routine-card-mobile-restyle`
- Worktree: `.worktrees/routine-card-mobile-restyle`
- Base: `origin/main` at `6ca24b64196d1d9414aa9ea1d25e5b9cf8e1a825`
- Canonical content fingerprint: `2d8f75a066ae800c06f62f28e4175ccce865ca14853615b8cb8e9eb859b7da11`
- Fingerprint scope: seven task-owned source, test, plan, and mockup files; readiness/review receipts are excluded from their own recursive fingerprint.

## Promised outcomes observed

- Routine now uses the approved compact Option A hierarchy and the Bedarfsplan category palette instead of oversized horizontal cards.
- The page measure is capped at 430 px on mobile and 560 px from the small breakpoint, with a 23/28 px page title and compact section/card typography.
- Single-product categories are one coherent detail target with a 58 × 76 px product image. Multi-role categories use one static category shell and separate 46 × 60 px actionable role rows.
- Metadata stays adjacent to the product, wraps when needed, and presents exactly one consequential state instead of dispersed badges or duplicate fit labels.
- Detached `Details` actions and decorative pills are removed. The existing detail sheet remains the interaction boundary behind the full row and chevron affordance.
- Header actions sit below the introductory copy and wrap without forcing the text column or cards wider.
- The unavailable/recovery state uses the same narrow measure and restrained type scale.

## Test-first proof

- Before production edits, the focused Stage 4 UI test failed three intended expectations: no full-row detail hooks, the obsolete `✓ Passt` label, and the old accessible row names.
- After implementation, the same focused file passes 10/10 and covers single/multi-role action counts, status precedence, cadence text, and accessible names.
- Visual QA exposed a clipped `Bewusste Wahl` status at 390 px. The metadata line was changed to wrap, then re-rendered and remeasured before the final test run.

## Verification

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-ui.test.tsx` — 10/10 passed.
- `npm run test:personal-plan` — 1479/1479 passed.
- `npm run ci:verify` — passed: typecheck, lint with zero errors and four pre-existing warnings outside this diff, and production build with 126 generated routes.
- Scoped ESLint on the three changed source files and focused test — zero errors; the test file produced only the repository ignore warning.
- `git diff --check` — passed.
- Prettier — all task-owned source, test, plan, and HTML mockup files formatted.

## Browser evidence

- The actual production `RoutinePage` and card components were rendered through a temporary local Labs fixture at 320, 390, 560, and 1280 px widths.
- All four widths rendered three category cards and four detail buttons with no horizontal page overflow.
- Minimum measured actionable-row height was 82 px at every tested width, and every supporting label or metadata value inside a card computed to at least 11 px.
- Final 320 and 390 px screenshots confirmed that product names, cadence, and consequential status remain visible after the metadata-wrap and type-legibility corrections.
- The temporary preview route was removed after verification. Browser screenshots remain transient under `/tmp` and are not task artifacts.

## Artifact disposition and residual risk

- Commit later if publication is explicitly authorized: the approved plan, two HTML decision mockups, implementation, regression tests, and readiness/review receipts.
- Discarded: the temporary Labs route, generated browser screenshots, local server output, and counterpart-review scratch output.
- Skipped: authenticated production replay because this tree is not deployed and no deployment or production write is authorized.
- Residual: remote catalog images can still vary in intrinsic whitespace; the fixed image viewport and contained inset bound that variation, but catalog normalization remains a separate concern.
- Not authorized/run: staging, commit, push, PR, merge, deployment, migration, feature activation, catalog publication, or production write.

## Bottom line

The approved compact Routine design is implemented and verified on the fingerprint above. Publication remains a separate explicit gate.
