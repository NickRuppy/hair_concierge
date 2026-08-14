# Personal Plan feedback round 3 — ready-check receipt

## Identity

- Branch: `codex/personal-plan-feedback-round-3`
- Worktree: `.worktrees/personal-plan-feedback-round-3`
- Base: `origin/main` at `53745c22bf2a3041959920a860677646ac929303`
- Canonical content fingerprint: `4fa4ebf2f3fb4695e03027b639502d8eb39856d3835d150ae766db54dfbf059f`
- Fingerprint scope: 29 task-owned source, test, plan, mockup, and rendered-evidence files; readiness/review receipts are excluded from their own recursive fingerprint.

## Promised outcomes observed

- Stage 3 skips the Conditioner purpose page only when the sole-role authority permits multiple captured products, while ambiguous Oil assignments remain explicit.
- Uncovered roles expose only `ideal` server-authorized candidates; supportive owned products retain their existing keep policy without becoming recommendations.
- A missing-product review uses the existing comparison matrix with `Empfehlung`/`Alternative` labels, exact selectable candidates, no absent `Deins` column, an exact selected-product CTA, and a `Produkt suchen` route. The no-candidate state is search-first and keeps explicit continue-without.
- Routine uses a compact active header and flat Bedarfsplan-style category rows with recognizable left imagery, category tint, cadence, purpose, status, and an existing detail boundary. Nested overview disclosure and fact-box towers are gone.
- Anwendung renders canonical days as one vertical full-width list. All days retain a shelf; rest days use the same composition. The aggregate pills are replaced by one truthful sentence plus local partial status.
- Standardized catalog imagery uses the matched `#f3f0e8` canvas and one of ten category-derived SVG silhouettes. Nonstandard or missing imagery stays contained in a neutral fallback. Provisional and open slots remain distinct and accessible.
- Four-slot mobile shelves shrink within 390 px without page or shelf overflow.

## Test-first proof

- Stage 3 pre-implementation focused run: three intended failures—missing recommendation comparison state, multiple Conditioner products still opened role assignment, and supportive uncovered candidates survived the candidate cap. Final focused authority/comparison set: 125/125 passed; Stage 3 flow assertions: 54/54 passed.
- Stage 4 pre-implementation focused run: the compact active Routine header assertion failed. Final Stage 4 UI/route/load-view set: 22/22 passed. Review then added a multi-role detail-boundary regression, which failed with 2 instead of 3 available detail actions and passed after restoring one compact action per role.
- Stage 5 pre-implementation focused run: three intended failures—shelf category absent for product/open slots and nonstandard imagery falsely used a category silhouette. The final accessibility follow-up added link-level mixed confirmed/provisional/open shelf semantics. Final Stage 5 suite: 209/209 passed.
- Playwright initially failed the obsolete Conditioner-purpose expectation after the intended skip was implemented. The journey assertion was corrected to require absence of that page; final Stage 3 Playwright suite: 15/15 passed.

## Verification

- `npm run test:personal-plan-stage5` — 209/209 passed.
- Focused Stage 3 authority/comparison command excluding the client harness — 125/125 passed.
- Focused Stage 3 client-flow file — 46/46 passed with a clean exit. The final exact-tree rerun also exposed and corrected two stale test journeys that still expected the removed Conditioner role screen.
- Focused Stage 4 command — 22/22 passed.
- `npm run test:personal-plan` — 1479/1479 passed with exit code 0 after review and parallel-assurance fixes.
- `npm run test:playwright:personal-plan-stage3` — 15/15 passed.
- `npm run ci:verify` — passed: typecheck, lint with zero errors and four pre-existing warnings outside this diff, and production build with 126 generated routes.
- `git diff --check` — passed.

Review-fix proof:

- Three-candidate recommendation tests prove browsing candidates 2/3 does not change the selected product, card selection is explicit, and the sticky CTA persists the selected exact product ID and fact fingerprint.
- A flow-level uncovered-role regression now proves selecting candidate 3 emits its exact ID/fingerprint and persists the canonical `planned_purchase` decision.
- Nonstandard-image coverage proves a provisional product retains its dashed state hook and accessible `vorläufig` label even when it uses the neutral image fallback.
- The Stage 5 day-card link now owns one complete accessible shelf summary with category, exact product, and confirmed/provisional/open state; the visual shelf is hidden from assistive technology to prevent duplicate or flattened announcements.
- Duplicate shelf clip IDs now include day type; selectable product-card controls no longer wrap block/heading content; Anwendung status naming sits on a section wrapper.

## Browser evidence

- Local Next development build loaded without a framework error state or browser console errors.
- Missing-product comparison at 390×844 and 1440×1000: no horizontal overflow; no `Dein Produkt`; two strict candidates and target matrix visible; choosing Alternative 2 changed `aria-pressed` and the sticky exact-product CTA.
- Routine at 390×844: compact header and first complete category row fit in the initial viewport; measured first card 191.5 px high, with document width equal to viewport width. At 1440×1000, the same flat category hierarchy and images rendered without overflow.
- Anwendung at 390×844 and 1440×1000: three day cards stacked in canonical vertical order; standardized remote product assets loaded; category silhouettes, provisional outline, open slot, and rest shelf rendered; four-slot shelf measured `scrollWidth === clientWidth === 324`; page measured `scrollWidth === clientWidth`.
- The temporary development-only preview route and transient browser screenshots were removed after inspection.

## Artifact disposition and residual risk

- Commit if publication is later authorized: approved plan, findings ledger, selected/rejected decision-history HTML, five rendered planning PNGs, implementation, tests, and readiness/review receipts. The PNGs are ignored by the global rule and will require explicit `git add -f` at the ship gate.
- Discarded: temporary development preview route, `/tmp` browser screenshots, test results, downloaded image/color-sampling files, and counterpart-review scratch output.
- Skipped: authenticated production replay because the implementation is not deployed and no production write/deployment is authorized; database/migration checks because no persisted schema, query, RPC, migration, or production data changed.
- Residual: no authenticated production replay was run because this tree is not deployed. The current Labs fixture cannot enter the no-owned recommendation state without a captured product, so the new candidate-3 persistence boundary is covered deterministically at the full client-flow level rather than in Playwright. The earlier apparent Stage 3 harness hang was resolved as two stale old-behavior test journeys, not retained as a known issue.
- Not authorized/run: commit, stage, push, PR, merge, deploy, migration, feature activation, catalog publication, or production write.

## Bottom line

The approved Stage 3–5 outcomes are locally implemented, verified, and reviewed on the fingerprint above. Publication remains a separate explicit gate.
