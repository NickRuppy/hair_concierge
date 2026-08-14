# Personal Plan uncovered-product choices — ready-check receipt

## Identity

- Branch: `codex/personal-plan-uncovered-product-choices`
- Worktree: `.worktrees/personal-plan-uncovered-product-choices`
- Branch point: `6ca24b64196d1d9414aa9ea1d25e5b9cf8e1a825`; current local/origin `main` is `8f349e7cef518575d0c7148bcbf9da0e15dd61f5`, two non-overlapping CI-timeout and Routine-card commits ahead.
- Canonical content fingerprint: `66c5dfe25175d5b22e33fcc06e3a281d171f8021e9f85242945abeee8451e37a`
- Fingerprint scope: 15 task-owned implementation, test, plan, and mockup files. This receipt and its manifest are excluded from their own recursive fingerprint.
- Manifest: `plans/receipts/2026-08-14-personal-plan-uncovered-product-choices-manifest.sha256`

## Promised outcomes observed

- An uncovered Stage 3 role now retains every exact `ideal` or `supportive` candidate that the category adapter itself authorizes, capped and ordered deterministically at three.
- Variant B fixes the top recommendation and shows one browsable alternative beside it. Three total candidates read `Alternative 1 von 2` and `Alternative 2 von 2`.
- The first card is `Beste Passung` only when ideal; an all-supportive set uses `Beste verfügbare Option`, and supportive alternatives disclose `passt teilweise`.
- Category-specific headings use the correct German article, including `Wähle deinen Conditioner` and `Wähle dein Leave-in`.
- The uncovered decision has no `Produkt suchen` action. Zero authoritative candidates offer `Erneut prüfen` and preserve the quiet server-authorized continue-without action.
- `Dieses Produkt einplanen` submits the exact selected product ID and fingerprint. Persistence stores `planned_purchase`; completion revalidates the current candidate before the Routine handoff.
- The supported category/role fixture matrix exposes three exact candidates. The audit found and fixed Deep Cleansing `mineral_reset` recommendations that were previously mislabeled `residue_reset` and rejected by the exact-role boundary.

## Test-first and delegated proof

- Candidate-authority red proof: three intended failures for supportive uncovered Conditioner/Leave-in behavior; final focused comparison suite is 57/57.
- Component red proof: six intended Variant B, supportive-label, zero-state, and no-search failures; final component suite is 19/19.
- Gateway mutation proof: restoring the obsolete global uncovered `ideal` filter broke the new supportive planned-purchase regression; the corrected tree passes 45/45.
- Launch-matrix red proof: the new all-category/role audit failed only at `deep_cleansing_shampoo/mineral_reset` with zero candidates. Passing `input.role` into the recommendation role and ID makes the full matrix green.
- Worker and explorer output was inspected in the integrated diff; no worker report was used as a substitute for the final commands below.

## Verification

- `npm run test:personal-plan` — 1484/1484 passed.
- `npm run test:playwright:personal-plan-stage3` — 16/16 passed.
- Focused fit-comparison suite — 57/57 passed.
- Focused ProductFitComparison suite — 19/19 passed.
- Focused production-persistence gateway suite — 45/45 passed.
- Focused Stage 3 flow suite — 47/47 passed.
- `npm run ci:verify` — passed: typecheck, lint with zero errors and four pre-existing warnings outside this diff, and production build with 126 generated routes.
- Focused changed-source ESLint with `--max-warnings=0` — passed.
- `git diff --check` — passed.
- Post-commit hook formatting changed bytes in four already-reviewed files without changing behavior. After rebasing onto `8f349e7c`, the full Personal Plan suite, Stage 3 browser lane, and `ci:verify` all passed again on the refreshed fingerprint.

## Browser and simulated-user evidence

- The uncovered Conditioner Labs scenario opens directly from a true Stage 2 `ownedCategories: []` entry context; it does not fabricate the state through a post-hoc mutation.
- At 375 px, 400 px, and 1440 px the chooser has no document overflow and the sticky CTA remains fully inside the viewport.
- Browser coverage proves the fixed best card, both alternative positions, explicit selection of the third candidate, absence of search, and the `/auth?next=/routine` handoff expected for the unauthenticated Labs route.
- Lea review verdict: clear and trustworthy for the scoped choice. `Wähle deinen Conditioner`, the fixed best card, alternative counter, profile-linked rationale, and explicit plan action provide a coherent bridge from need to exact product without asking the user to invent one.
- No user-facing blocker or copy finding remains from the rendered desktop/mobile pass. The existing cookie dialog can initially obscure mobile content until a consent choice; it is outside this change and the automated flow handles it.

## Artifact disposition and residual risk

- Commit later if publication is explicitly authorized: implementation, tests, approved plan, HTML mockup, manifest, and readiness/review receipts.
- Discarded/transient: `/tmp` desktop/mobile screenshots, browser test output, and counterpart scratch output. The ignored mockup PNG remains transient and is not part of the fingerprint.
- No database schema, migration, query contract, catalog record, or production data changed. No live catalog write or production replay was authorized or run.
- The Labs route reaches the auth boundary rather than an authenticated Routine page. The exact `planned_purchase` state and completion revalidation are therefore proved at the production-gateway boundary, while existing Routine lifecycle tests retain `Noch kaufen`/non-executable behavior.
- Not authorized/run: staging, commit, push, PR, merge, deployment, migration, feature activation, catalog publication, or production write.

## Bottom line

The approved Variant B journey is implemented, verified, and reviewed on the fingerprint above. Publication remains separate authorization.
