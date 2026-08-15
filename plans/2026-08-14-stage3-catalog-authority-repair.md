# Stage 3 catalogue authority repair record

## Outcome and source context

Stage 3 uses the complete recommended catalogue with the same property meanings that Product Intake publishes, surfaces truthful alternatives across every supported category/role/context, and passes a reproducible production audit as canonical behavior.

This follows `plans/2026-08-14-personal-plan-complete-candidate-selection.md` and PR #401. The activation audit exposed two symptoms of broader seams:

- Shampoo compared `ShampooTarget.scalpRoute` (oiliness: `oily | balanced | dry`) directly with `product_shampoo_specs.scalp_route` (condition/bucket route: additionally `dandruff | dry_flakes | irritated`). Dandruff, irritated, and some dry-scalp contexts can therefore be impossible despite complete rows.
- Fit comparison asks each category's uncovered-need recommendation branch to authorize an owned replacement. Mask, Oil, and Bondbuilder can truthfully evaluate owned products as `supportive`, but their uncovered recommendation branches remain stricter, so supportive replacements disappear.

## Chosen direction

Keep one normalized authority chain:

1. `products`: identity, image/commerce presentation, active lifecycle, globally recommended eligibility.
2. Category tables: exact fit properties (`product_shampoo_specs`, `product_mask_specs`, and the equivalent table set per category).
3. `product_application_protocols` plus active German product-scoped `application_guidance_protocols`: verified application authority.
4. Stage 2 signed target: the user's need; Stage 3 translates it into the catalogue property's vocabulary before selecting, comparing, or searching.

Repair the semantic boundaries rather than editing valid catalogue data:

- Add shared `SHAMPOO_SCALP_ROUTES_BY_BUCKET` and `SHAMPOO_CLEANSING_INTENSITY_BY_BUCKET` contracts in `src/lib/shampoo/constants.ts`. Product Intake and Stage 3 reuse the same target properties. The recommendation engine retains its behavior-equivalent private projection so this Personal Plan-only release does not unnecessarily enter the paid chat-evaluation path. For the currently reachable targeted dandruff role, `schuppen` uses `dandruff`; `dry_flakes` remains allowed intake data but is not treated as an oily-dandruff equivalent.
- Use the derived catalogue route and cleansing intensity consistently in complete-catalogue fact selection, Shampoo authority, visible everyday-Shampoo targets, and Stage 3 search assessment. Add confirmed hair thickness to the authority input so the table and pre-slice coverage selector use the same third target. The dandruff comparison remains compact and keeps the existing `Shampoo-Passung` row; no new dandruff display axis is added.
- Add a category-neutral owned-supportive replacement authorization seam. It delegates to the existing category-correct recommendation builders for Mask, Oil, and Bondbuilder only. Conditioner and Leave-in already authorize supportive recommendations; categories without supportive verdicts remain unchanged. Uncovered Mask/Oil/Bondbuilder retain their previously approved stricter rules.
- Enforce the confirmed hair thickness against stored `suitableThicknesses` for Mask and Bondbuilder instead of treating any non-empty thickness metadata as a match. A candidate whose verified property set excludes the user is a mismatch and cannot appear as an alternative.
- Apply every semantic repair canonically to Stage 3 complete-catalogue authority. The retired environment rollback is not retained as a parallel semantic mode.

## Scope and non-goals

In scope:

- All Shampoo target-semantic sites: intake validation, recommendation mapping, Stage 3 fact selection, authority evaluation, full three-property comparison target/evidence, and product search request context.
- Supportive owned replacements for every current strict adapter that can emit `supportive`: Mask, Oil, and Bondbuilder.
- A read-only truthfulness audit that varies Shampoo constraint contexts and explicitly exercises supportive replacement fixtures as well as all category/role targets.
- Regression coverage and the historical release evidence recorded by the owning PR. This plan grants no current publication or production authorization.

Non-goals:

- No layout, hierarchy, actions, carousel, Routine, or Anwendung change.
- No weakening of safety, active lifecycle, recommendability, exact category/role, verified protocol, known-mismatch, or zero-visible-match gates.
- No change to verdict definitions or 3/3 -> 2/3 -> 1/3 -> never 0/3 ordering.
- No new product, duplicate table, property reclassification, schema migration, or customer replay.
- No supportive uncovered recommendation for Mask, Oil, or Bondbuilder.
- No production chat-engine behavior change. The existing chat Shampoo mapping remains byte-identical; this release uses the shared mapping only inside the Personal Plan authority path.
- No weakening of paid chat evaluation scope. This branch no longer changes a chat-runtime file, so chat evaluation is correctly skipped; the independent production OpenAI credit exhaustion remains a separate operational incident.

## Target map

| Surface                                                                                                       | Responsibility                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shampoo/constants.ts`                                                                                | Single bucket-to-allowed-routes and bucket-to-cleansing-intensity contracts.                                                                        |
| `src/lib/product-intake/category-validators.ts`                                                               | Validate Shampoo rows against the shared route set.                                                                                                 |
| `src/lib/personal-plan/products/authority/categories/shampoo.ts`                                              | Derive complete-catalogue expected spec route and use it during authority evaluation.                                                               |
| `src/lib/personal-plan/products/authority/catalog-facts.ts`                                                   | Select exact complete-catalogue Shampoo facts with the derived spec route as canonical Stage 3 behavior.                                            |
| `src/lib/personal-plan/products/authority/contracts.ts` and production gateway assembly                       | Carry confirmed hair thickness into the exact authority input and fingerprints/caches where required.                                               |
| `src/lib/personal-plan/products/fit-comparison.ts`                                                            | Show/score everyday Shampoo against the derived catalogue route and authorize category-owned supportive replacements. Keep dandruff compact.        |
| `src/lib/personal-plan/products/authority/categories/{mask,oil,bondbuilder}.ts` and a narrow authority router | Export/reuse category-correct recommendation identity for owned supportive replacements.                                                            |
| `src/lib/personal-plan/products/production-persistence-gateway.ts`                                            | Send the derived Shampoo route to product search through canonical Stage 3 authority.                                                               |
| `tests/personal-plan/**`                                                                                      | Production-shaped red regressions, invalid fixture migration, fingerprint recovery, save revalidation, search, and all-category/context invariants. |
| `scripts/personal-plan/audit-stage3-production-coverage.ts` and `package.json`                                | Privacy-safe complete-catalogue truthfulness gate.                                                                                                  |

## Designed user journey

Actor: a paid Personal Plan owner reaches Stage 3 with a current signed Bedarf and an owned product.

1. Stage 3 loads every active, globally recommended product in the category and batch-loads the category properties plus verified protocols.
2. Shampoo translates the signed need into all three displayed target properties before selection: cleansing intensity from the bucket, scalp focus from the catalogue route, and hair thickness from the confirmed evaluation context. For example, `irritation_compatible` + normal thickness becomes `sanft | gereizt | mittel`; targeted dandruff uses the verified dandruff role/row rather than the user's oiliness label.
3. The current product and every candidate pass the same hard authority checks.
4. Ideal candidates and truthful supportive owned replacements are ranked by visible exact target coverage. A supportive Mask/Oil/Bondbuilder shows its existing documented restriction; it is never relabeled ideal.
5. The unchanged table/carousel presents one to three valid alternatives and binds the exact displayed ID/fingerprint on selection.
6. An uncovered need remains category-authoritative: Mask/Oil/Bondbuilder still require their stricter exact candidate rather than silently planning a compromise.
7. Search uses the same translated Shampoo route, so a user looking up an owned dandruff/irritation-compatible Shampoo sees the same catalogue identities that authority can evaluate.
8. Incomplete queries remain retryable. Only an exhaustive complete result with no truthful candidate may show the reviewed rare no-alternative state.
9. Save and completion rehydrate and revalidate the exact candidate fingerprint before portfolio/Routine creation.

The visible correction restores the fully populated target column from the previously approved comparison artifact: cleansing intensity and hair thickness no longer render as `kein Ziel`, and the scalp-focus value uses the catalogue route (for example `sanft | gereizt | mittel`). The normal state keeps `Prüfpunkt | Deins | Ziel | Alternative`; only the proven rare state omits `Alternative`. The supportive comparison layout/copy is unchanged.

Reviewed artifact: `mockups/2026-08-14-stage3-shampoo-target-semantics.html` with rendered evidence in `mockups/2026-08-14-stage3-shampoo-target-semantics.png`. Nick rejected the first version because it preserved two empty target cells. The revised artifact fills all three targets and restores the normal Alternative column.

Evidence review confirmed: 2026-08-14. User-journey sign-off confirmed: 2026-08-14.

## Planning evidence

- Live schema inspection confirmed a normalized chain, not competing product catalogues.
- Live Mask completeness: 34/34 visible recommended rows have weight, balance direction, repair support, and functional benefits; their protocols are verified in the runtime loader.
- Live targeted-dandruff distribution: every visible `schuppen` row uses `scalp_route = dandruff`; normal thickness has three verified products, fine four, coarse two; no visible `dry_flakes` row exists.
- Two drafts contain `shampoo_dandruff`, both completed; zero in-progress users require re-review. Completed drafts remain immutable, while active drafts with an older authority version resume through a server-owned current-authority continuation.
- Code proof: `selectShampooSpec` and product-search targets pair bucket with the oiliness route; `recommendationForCandidate` routes owned alternatives through uncovered recommendation; Mask/Oil/Bondbuilder emit supportive verdicts but their uncovered selectors require exact/ideal candidates.
- User feedback on the first repair artifact exposed two additional null targets: current `shampooDimensions` passes `null` for cleansing intensity and suitable thickness even though bucket and evaluation context make both authoritative. The reviewed predecessor artifact already showed all three target values, so this is implementation drift rather than a new table design.
- Counterpart finding rejected: dandruff does not use `shampooDimensions`; `comparisonDimensions` deliberately returns compact mode and `compactCriterionSchema` scores the existing `shampoo.fit` pass. No dandruff stop/copy is needed.
- Counterpart findings accepted: everyday irritated/dry constraints, product search, Oil/Bondbuilder supportive replacement, audit truthfulness, and canonical authority recovery required broader ownership.

## Ordered tasks

### Task 1 - encode the production failures and migrate invalid fixtures

Add red complete-mode regressions for:

- `schuppen + dandruff` under an oily target;
- `irritationen + irritated` under balanced/oily oiliness with `irritation_compatible`;
- `trocken + dry` under non-dry oiliness with `gentle_dry_scalp`;
- Stage 3 search targets for these same contexts;
- all three everyday Shampoo target rows populated and used by pre-slice coverage;
- owned supportive Mask (2/3), Oil (role pass plus adjacent weight), and Bondbuilder (verified add-on relationship);
- Mask and Bondbuilder candidates whose verified suitable-thickness set excludes the confirmed thickness;
- uncovered equivalents remaining strict;
- canonical complete-mode results and fingerprints.

Migrate test builders that currently encode impossible `schuppen + oily/balanced` or `irritationen + balanced` catalogue rows.

Complete when each intended complete-mode fix is red for the exact cause, the uncovered guards are green, and legacy tests describe valid catalogue values.

### Task 2 - unify Shampoo route semantics across every consumer

Consumes: Task 1 fixtures.

Create the shared bucket-to-route-set and cleansing-intensity contracts. Reuse them in intake and Stage 3 while keeping the recommendation engine's equivalent private projection unchanged. Carry confirmed hair thickness on `Stage3AuthorityInput`. Derive route/intensity from the expected bucket and thickness from evaluation context. Preserve `singleSemanticMatch` fail-closed behavior and deterministic route preference. Keep targeted dandruff compact; populate all three everyday target positions and use that same schema for ranking and rendering.

Produces: one explicit complete-mode Shampoo target projection `{ bucket, scalpRoute, cleansingIntensity, thickness }` used by facts, authority, display coverage, and search.

Complete when all standard/irritated/dry/dandruff fixtures agree across hydration, authority, all three target rows, comparison ranking, and search; impossible combinations fail closed; and canonical fingerprints are deterministic.

### Task 3 - authorize truthful supportive owned replacements by category capability

Consumes: Task 1 supportive fixtures.

Add one authority router that can mint a category-correct recommendation only after detached evaluation returns `supportive`, the original complete-mode input contains non-null owned facts, and category/role/protocol/lifecycle checks already passed. Delegate to the existing builders for Mask, Oil, and Bondbuilder. Preserve the normal adapter recommendation path for ideal candidates and uncovered subjects. Preserve the existing `targetMatchCount > 0` filter and shared render/find selector.

Produces: exact category-native recommendation IDs, reasons, rule IDs, product IDs, roles, and fingerprints for supportive owned replacements.

Complete when supportive Mask/Oil/Bondbuilder candidates display and save, their 0/N variants remain excluded, forged/stale fingerprints fail, uncovered flows remain strict, and Conditioner/Leave-in behavior does not regress.

### Task 4 - add a truthfulness-capable activation audit

Consumes: Tasks 2-3.

Add `npm run personal-plan:stage3:coverage-audit`. It uses service-role credentials server-side, real complete catalogue hydration, non-null synthetic owned facts under a non-catalogue ID, and aggregate-only output. The live matrix includes every `CATEGORY_ROLE_POLICIES` role plus reachable Shampoo standard/irritated/dry/dandruff constraints. For each target it asserts fetch completeness, at least one alternative, exact category/role, non-zero displayed coverage, no mismatch/unknown candidate, and a valid recommendation/fingerprint. Query errors or incomplete counts exit non-zero. Output contains target keys/counts only—never credentials, product names, or customer identifiers. Supportive Mask/Oil/Bondbuilder authorization remains a deterministic regression matrix rather than a live top-three requirement: ideal candidates legitimately rank ahead of supportive ones, and a category may currently have no live supportive row.

Complete when locked pre-fix fixtures fail on the diagnosed classes, live complete mode has zero failures, and the command itself has deterministic unit coverage for empty, untruthful, and query-error results.

### Task 5 - verify and obtain whole-tree review

Consumes: green Tasks 1-4.

Run focused suites, `npm run test:personal-plan`, Stage 3 Playwright, `npm run typecheck`, lint/Prettier/diff-check, the canonical production build, `npm run ci:verify`, and the production-shaped benchmark. Run `ready-check` and `request-code-review` as Codex workflow skills, including one read-only Claude whole-branch review. Refresh stale receipts after any content change.

Complete when exact-content verification/review receipts agree and no blocking finding remains.

Release-gate correction: the first exact-head run passed the production Stage 3 lab, then the same `quality-personal-plan-browser` runner returned 404 for development-only Lab routes and timed out. A production build followed by `next dev` is not an isolated environment boundary. CI now runs the production build/lab and development journeys as separate required jobs on separate runners; `quality-core` requires both and permits either to skip only through the existing path scope. The regression contract proves that neither job can silently absorb the other mode again.

### Task 6 - publish, merge, and deploy

Consumes: Task 5 exact reviewed fingerprint.

Commit, push, create/update the PR, wait for exact-head CI, perform the guarded reviewed-head squash merge, clean the task worktree through the repository workflow, and deploy the exact merge. Verify source metadata and READY aliases.

Complete when the exact merge is production READY and canonical complete-catalogue fingerprints remain covered.

### Task 7 - audit and verify

Consumes: Task 6 exact-source deployment.

Run the live audit against canonical complete mode, verify source/aliases, and inspect bounded Stage 3 runtime errors. On any gap, partial fetch, source mismatch, or material error signal, revert the reviewed code and redeploy rather than toggling a retired environment mode.

Complete when production is exact-source READY, the truthfulness matrix is green, runtime signals are acceptable, and the root worktree is clean with a release receipt.

## Verification

Automated:

- Focused Shampoo constants/intake/recommendation/catalog/authority/comparison/search tests.
- Focused Mask/Oil/Bondbuilder comparison, gateway, portfolio, Routine, and revalidation tests.
- Audit-command unit tests for empty, supportive, untruthful, and unavailable states.
- `npm run test:personal-plan`.
- `npm run test:playwright:personal-plan-stage3`.
- `npm run typecheck`, lint, Prettier, `git diff --check`, `npm run ci:verify`.
- Production build with canonical complete-catalogue authority.
- Stage 3 production-shaped benchmark.

Live state:

- `information_schema.columns` read for every audit table before field selection.
- Aggregate Shampoo route/protocol and Mask completeness evidence retained in the plan/receipt; no customer rows or identifiers retained.
- Canonical complete-catalogue coverage audits return zero failures.
- No Supabase schema/catalogue write is expected.
- Vercel source metadata matches the reviewed merge SHA in the historical release receipt.

Manual/browser:

- Reviewed Shampoo target-value artifact matches the real comparison table.
- Dandruff remains the compact `Shampoo-Passung` table.
- Corrected everyday irritation-compatible target/evidence is truthful.
- Supportive Mask/Oil/Bondbuilder shows the existing trade-off presentation and exact selection action.
- Uncovered strict and rare no-alternative states remain unchanged.

## Review and handoff

- Worktree: `.worktrees/stage3-catalog-authority-repair` on `codex/stage3-catalog-authority-repair`.
- Commit: plan, reviewed target artifact, code, tests, audit script, verification/review/release receipts.
- Discard: transient Claude reports and ad hoc production probes after reconciliation.
- Gates: contextual target artifact review/sign-off, test-first red proof, ready-check, request-code-review, exact-head CI, guarded merge, live truthfulness audit, deployment, and post-deployment verification.
- Residual risk: future Shampoo routes must update the shared bucket-route contract and audit grid together; the audit reports candidate count degradation but blocks only on truthfulness failure or zero alternatives, matching the one-to-three UI contract.
- Status refresh, 2026-08-15: this is historical repair context, not a current release instruction. The active owned-matrix task controls local verification and stops before publication or production mutation.
