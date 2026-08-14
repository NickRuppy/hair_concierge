# Bedarfsplan property-specific example images and preload

## Outcome and source context

The Bedarfsplan keeps showing clearly labelled example products, but the packshot reflects the recommendation target instead of only the broad category. The optional page's resolved images begin loading while the Basis page is visible, preventing the measured multi-second image pop-in after navigation.

Source context:

- Production browser investigation on 2026-08-14 measured both optional images at about 6.66 seconds from request start to completion.
- Current Stage 1 intentionally leaves `productPreviews` empty; exact-product selection remains owned by later stages.
- Live read-only catalog inspection confirmed image-backed variants for all current Conditioner weight/direction combinations and current role families for Leave-in, Oil, Shampoo, Mask, and Kopfhautpflege.
- A follow-up live read-only check on 2026-08-14 confirmed that every currently active recommended product in all ten categories has a non-empty image URL: Shampoo 49/49, Conditioner 43/43, Leave-in 42/42, Hitzeschutz 5/5, Oil 41/41, Mask 34/34, Kopfhautpflege 8/8, Trockenshampoo 10/10, Bondbuilder 3/3, and Tiefenreinigung 5/5. This is current coverage evidence, not a permanent fallback guarantee.

## Direction correction after repository trace

The separate curated selector proposed earlier is rejected. Bedarfsplan images should use the exact catalog product selected by the existing Stage 3 category authority for every supported category; there must not be a second matching algorithm or separately maintained product-property map.

The repository trace exposes a timing conflict that must be resolved before implementation:

1. The first Bedarfsplan is rendered from the initial Stage 1 snapshot.
2. Stage 2 then collects refinements and only on completion creates a `refinedVersionId`.
3. Stage 3 is bootstrapped only after that handoff.
4. Stage 3 recommendation candidates are evaluated from the refined snapshot and live catalog facts. For users with owned categories, that evaluation happens only after product capture establishes which roles remain uncovered.

Therefore the exact Stage 3 recommendation output does not yet exist when the user first views the Bedarfsplan. Strictly reusing that output without an earlier evaluation requires moving the property-specific image presentation until after refinement/product capture. Keeping the existing journey order requires an earlier invocation of shared authority logic against a defined source, which is additional runtime work and cannot be described as consuming an already-existing Stage 3 output.

Nick chose approach A on 2026-08-14: preserve the current journey and invoke the shared authority earlier for a clearly non-final preview. The initial and refined evaluations are allowed to differ; Stage 3 remains authoritative.

## Scope and non-goals

In scope after the timing decision:

- use the existing Stage 3 authority recommendation output for all supported Bedarfsplan categories;
- expose the selected recommendation's existing catalog image as the clearly labelled example image;
- preload only the resolved optional images while the immediately preceding page is visible;
- preserve fail-closed behavior where the authority produces no recommendation or image;
- browser verification that resolved optional images do not pop in after navigation.

Non-goals:

- a second Bedarfsplan-only product selector, score, product pool, or matching computation;
- changing the Bedarfsplan's category, need-tier, role, copy, ordering, or frequency logic;
- a database migration, production catalog mutation, or image-generation workflow;
- changing Stage 3 matching rules;
- preloading images for products the existing authority did not select.

## Candidate timing approaches

### A. Preserve the journey and invoke shared authority early

Run an explicit preview evaluation before/during Bedarfsplan, using the same Stage 3 authority adapters and catalog facts, then preload its selected images. This avoids a second algorithm but is an additional invocation and cannot use the not-yet-created refined version. Stage 3 must still reevaluate after refinement because its signed source has changed.

### B. Strictly reuse the existing Stage 3 output

Keep one evaluation only. Present the property-specific example images only after Stage 2 completion and the necessary Stage 3 product-capture state, which requires reordering or adding a later Bedarfsplan review. This is the only option that literally consumes an already-existing Stage 3 output with no earlier evaluation.

### C. Preserve both current journey and authority timing

Keep category-only examples on the first Bedarfsplan and preload them. Property-specific product images appear only in Stage 3. This fixes the ten-second pop-in but does not make the first Bedarfsplan image property-specific.

Chosen: A. The preview must call the existing category-authority adapters and shared catalog-fact normalization. It must not copy their matching rules into a Stage 1 selector.

The preview source is the persisted initial-need version and its `inputHash`. The response is presentation data, not signed Stage 3 authority and not part of the canonical initial snapshot. Stage 3 later evaluates the refined version normally.

## Designed user journey

Status: visual evidence reviewed and corrected journey explicitly approved by Nick on 2026-08-14.

1. An eligible user opens the completed Bedarfsplan on the Basis page. The plan itself is not blocked if preview catalog data is slow or unavailable.
2. In parallel, a read-only preview request evaluates the user's rendered categories through the existing Stage 3 category-authority adapters, using the persisted initial snapshot as a clearly labelled pre-refinement source.
3. Each card uses the catalog packshot returned by that shared authority path while retaining the visible `Beispiel` label and explanation that the exact product is confirmed later.
4. If the same category has a materially different target—for example light Conditioner versus rich Conditioner, or finish Oil versus pre-wash Oil—the authority can return a different example.
5. Role-sensitive categories never cross roles: Kopfhautpeeling cannot illustrate comfort serum, and rich pre-wash Oil cannot illustrate a light finish target.
6. For a category with multiple ordered roles, the card displays the recommendation for the first ordered role. The response retains that role so the UI and tests never imply that the image represents every role in the category.
7. While Basis is being read, only the resolved images for that user's upcoming optional cards preload in the background.
8. When the user opens `Optionale Empfehlungen`, card shells and images appear together without the previous multi-second image pop-in.
9. If preview evaluation fails, returns no recommendation, or the selected catalog item has no image, the card remains usable without an image; Bedarfsplan does not invent a fallback product and the user can retry by reloading.
10. After refinement, Stage 3 evaluates the refined profile and owned-product state normally. Its recommendation may differ from the earlier `Beispiel`; no Bedarfsplan preview is reused as final authority.

## Planning evidence

- `plans/mockups/2026-08-14-bedarf-property-image-variants.html`
  - Question: does a property-aware example image feel materially more specific without looking like the exact product has already been selected?
  - Cases: light + heat role; rich + pre-wash role; distinct scalp roles.
  - Visual conclusion: unchanged card layout and explicit `Beispiel` label remain suitable, but the depicted products in this artifact are illustrative only and do not approve a data source.
  - Evidence review: accepted for layout and `Beispiel` semantics; superseded for matching logic by the shared-authority decision.

## Ordered tasks

### 1. Extract a shared preview-safe authority boundary

Refactor the current Stage 3 catalog-fact loading just enough to let a read-only preview service provide the same recommendation candidates and call `evaluateStage3Authority`. The existing Stage 3 production path must continue calling the same functions with unchanged results.

- Build one preview subject per rendered category from the category decision's first ordered allowed role.
- Replace the catalog fact loader's implicit draft dependency with explicit selection inputs: category, optional captured product ID, hair thickness, role, signed Shampoo target, signed Conditioner target, heat routes, and verified heat-carrier coverage. The existing Stage 3 caller derives these from its draft; the preview caller derives category targets directly from the matching initial snapshot decision.
- Preview heat-carrier coverage is explicitly empty because Stage 1 has no exact captured product/protocol evidence. Preview portfolio coverage is the initial snapshot's existing coverage; Stage 3 continues using `effectiveStage3Coverage(draft)`.
- Use the initial need version ID and input hash as preview source identifiers; never call them refined or persist the returned evaluation as Stage 3 evidence.
- Preserve exact category authority versions, candidate ordering, hard role/target checks, ideal/supportive behavior, and fail-closed results.
- Add shared-boundary determinism tests: given identical normalized inputs, callers receive the same product ID for each of the ten categories. Initial-preview versus refined-Stage-3 divergence is expected and is not a parity failure.

Completion: no matching branch exists only for Bedarfsplan, and whole-category coverage includes Shampoo, Conditioner, Leave-in, Hitzeschutz, Oil, Mask, Kopfhautpflege, Trockenshampoo, Bondbuilder, and Tiefenreinigung.

### 2. Load previews without blocking the Bedarfsplan

Add an authenticated, access-checked, read-only Stage 1 preview endpoint/service. It loads the persisted initial snapshot, evaluates only `renderedOrder`, and returns a versioned list containing category, represented role, product ID, image URL, preview source version/hash, and selection authority version.

- `Stage3Recommendation` supplies the selected product ID and display name. The preview service maps that ID back to the same normalized `recommendationCandidates` fact and reads its `presentationImageUrl`; the authority contract itself is not expanded solely for Bedarfsplan presentation.
- Start this request as soon as a Stage 1 plan is available, while Basis is visible.
- Emit a server-rendered, source-keyed `as="fetch"` preload for the preview endpoint so authority computation begins during the initial Basis document load, before hydration. The hydrated fetch uses the identical URL and a short `private` browser cache window to consume the warmed response instead of recomputing it.
- Keep the canonical `InitialNeedPlanSnapshot.productPreviews` empty; preview results are live presentation data and do not alter deterministic Stage 1 persistence.
- Fail soft: plan text, navigation, and refinement remain available on preview timeout/catalog error.
- Ignore a response whose plan ID or initial input hash no longer matches the displayed plan.

Completion: route/service tests cover authentication, access, owner isolation, all-category mapping, stale response rejection, empty/no-image results, and catalog failure.

### 3. Bind preview output to cards and image delivery

Overlay preview image data onto the existing card view models by category; delete the ten hardcoded `CATEGORY_EXAMPLE_IMAGES` URLs. Preserve the `Beispiel` label and use product-specific alt text that still says it is an example, not the selected final product.

- Permit exactly one represented role per current card image: the first ordered role used by the authority preview.
- Keep the current direct Supabase rendering path for this fix. Image optimization is a separate possible cross-view improvement; it is not used as the first-view latency fix because a cold optimizer miss still has to fetch the same origin and may add transformation time/cost.
- Keep layout stable while preview data is pending or absent; no wrong category fallback image is shown.

Completion: card tests prove exact product ID/image binding, no hardcoded category fallback, stable missing/loading geometry, and correct non-final semantics.

### 4. Preload only the upcoming resolved images

Consumes: the already adapted optional card view models.

Produces: browser preload hints for the unique optional image paths during the Basis step.

- Emit deduplicated `<link rel="preload" as="image">` resources for the exact direct Supabase URLs later rendered by the existing `unoptimized` image. URL identity is the cache-reuse contract.
- Do not preload absent images, unrelated category candidates, later-stage catalog results, or the whole representative pool.
- Keep the rendered optional image request URL byte-for-byte identical to the preload URL so the browser reuses it. Add one scoped preconnect for the Supabase product-image origin when at least one preview exists.

Completion: component tests prove the preload set exactly equals the user's unique optional image set.

### 5. Prove the transition and regression boundary

Consumes: integrated shared-authority preview and preload behavior.

Produces: automated and browser evidence for image specificity and request timing.

- Add deterministic fixture cases proving Bedarfsplan consumes the exact product IDs returned by existing category authority across all ten categories, plus multi-role-first-role, no-recommendation, missing-image, stale-response, and preview-failure cases.
- In the Personal Plan browser fixture, assert optional image requests begin while Basis is visible, then click through and confirm every optional image is complete without a late layout/image transition.
- Compare mobile and desktop rendering against the reviewed artifact; card geometry and copy must remain unchanged.

Completion: focused unit/component/browser checks pass and an uncached local production-build run shows no optional-image request beginning only after the click.

## Verification

Automated:

- focused authority-output-to-card adapter tests;
- `tests/personal-plan-start-ui.test.tsx`;
- relevant Personal Plan start/resume suites;
- scoped TypeScript and ESLint checks;
- `git diff --check`.

Manual/browser:

- 390 px and desktop checks of the reviewed cases;
- Network timing check from an uncached Basis load through Optional navigation;
- image-error fallback check;
- confirm no product name appears and the `Beispiel` label remains visible.

Live-state/migration:

- No migration or production write.
- No app-owned product pool or category fallback is retained. Current live coverage is 250/250 active recommended products image-backed across all ten categories, but the runtime still fails closed to an image-less stable card if future authority/catalog data has no valid image.

## Review and handoff

- Worktree: `.worktrees/bedarfsplan-property-images`
- Branch: `codex/bedarfsplan-property-images`
- Evidence review: Nick accepted the real-packshot, unchanged-card direction and then corrected the data source to the shared Stage 3 authority. The earlier mockup remains valid only for layout and `Beispiel` semantics.
- User-journey sign-off: approved by Nick on 2026-08-14 after the corrected shared-authority walkthrough.
- Counterpart plan review: completed at high effort; approved with revisions. Incorporated explicit no-draft selection inputs, product-ID-to-image mapping, preload-only delivery, current all-category image coverage, and corrected determinism wording. The transient report could not be retained because the system temporary volume was full.
- Publication, merge, deployment, and production activation are outside this planning authorization.
- Artifact disposition: plan, reviewed HTML evidence, shared-authority preview integration, preload code, and regression coverage are intended for commit; transient counterpart output was discarded outside the repository.
- Stop point: implementation is authorized through a verified review-ready worktree; publication remains separately gated.

## Implementation evidence

- Journey sign-off received and `implementation-loop` started on 2026-08-14.
- Red proof: `tests/personal-plan-start-ui.test.tsx` failed because the hardcoded category image remained and no optional preload link existed.
- Green focused proof: 116 tests pass across the new preview service/route/UI guards plus all ten existing Stage 3 category authorities and catalog-fact persistence coverage.
- Full Personal Plan regression proof: 1,480 tests pass.
- Scoped ESLint passes for all changed source files.
- Live read-only benchmark against the current catalog:
  - first six-category fixture evaluation: 6.235 seconds;
  - immediately repeated per-category evaluations in parallel: 0.546–1.186 seconds, 1.187 seconds total;
  - Shampoo, Conditioner, Leave-in, and Mask returned exact image-backed recommendations; Oil and Bondbuilder correctly returned no preview for that fixture because the existing authority returned no recommendation.
- Implementation deviation: instead of refactoring the full draft-bound fact bundle, the preview exports and reuses the existing recommendation-candidate loader/normalizer directly, then calls `evaluateStage3Authority`. This is smaller and leaves Stage 3 behavior untouched while still avoiding a second matcher.
- Counterpart code review found no hard correctness, security, or structural defect. Its supported resilience finding was incorporated: one category candidate/evaluation failure now drops only that category preview, with a Shampoo-success/Conditioner-failure regression test. The remaining no-image first-paint state is an explicit product tradeoff rather than a hidden fallback.
- Final shipping follow-up moves preview discovery into server-rendered Stage 1 HTML, keys the request by plan ID and source input hash, preconnects the product-image origin immediately, and permits only a 60-second private browser cache so hydration can reuse the warm response without cross-plan binding.
- Browser build caught and fixed a client/server boundary regression by moving the response validator into a client-safe contract module. Full local interactive verification remains blocked by the nearly full disk and the root dependency installation: Turbopack rejects the space-saving external `node_modules` symlink, while webpack rejects an existing Stage 3 client-side `node:crypto` import. No production deployment was used as a workaround.
