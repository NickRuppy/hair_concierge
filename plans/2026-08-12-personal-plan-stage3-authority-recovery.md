# Personal Plan Stage 3 authority-projection repair

## Outcome

Restore Stage 3 after the last product category is saved by making journey authorization validate every field required by the shared authority checker, including product-load-derived supplemental categories. A successfully saved selection must remain reachable on the immediate transition, refresh, and the Stage 2 -> Stage 3 bridge.

This is a code defect in a read projection. The Leave-in save succeeded, the current refined pointer is correct, and no customer-data repair or database migration is indicated.

## Confirmed production diagnosis

For plan `4f4fef33-bebf-4e2b-ac01-6cebf6402d84` and refined version `0e61b53d-0dba-4cee-ada3-de6d109bcfae`:

- `PATCH /api/personal-plan/stage-3` returned 200 and persisted the selected Leave-in, cadence, role assignment, revision 9, and the transition to `product_decisions`.
- The immediate GET at 09:58:24 UTC and the three bridge attempts at 10:11:07, 10:11:24, and 10:11:31 UTC all returned 409 from deployment `dpl_D9YiwuVF2b54oWasgEAg7LKspSMC`.
- Every rejected request passed entitlement and prepared-plan checks, then logged `stage3_access_refined_draft=authority_stale`.
- The saved authority snapshot is valid for the four base categories: Shampoo, Conditioner, Leave-in, and Oil.
- Completing capture derived a valid `productLoadResolution` overlay that adds `deep_cleansing_shampoo`; the canonical draft order is therefore the four base categories followed by that supplemental category.
- `loadCurrentProductDraft` already reads the full JSON payload but returns only status, refined version, order, authority versions, and authority snapshot. It drops `productLoadResolution`, `products`, and `roleAssignments`.
- `hasCurrentAuthority` passes that incomplete object to `requireCurrentAuthoritySnapshot` through `as never`. Without the overlay, the validator treats all five ordered categories as base categories. The stored base snapshot contains four, so it deterministically throws `stale_authority_snapshot`.
- A focused local replay of this exact incomplete shape returns `Stage3AuthoritySnapshotError stale_authority_snapshot`.
- The Stage 2 bridge has no automatic network retry. Its initial auto-handoff and each explicit click issue the same Stage 3 GET with the same refined version, explaining the three persistent failures.

## Root cause

```text
Final category save
  -> valid product-load overlay is derived and persisted
  -> journey loader reconstructs an incomplete authority-check shape
  -> overlay/products/role assignments are omitted
  -> validator sees 5 base categories versus a 4-category base snapshot
  -> false stale_authority_snapshot
  -> journey frontier falls back to Stage 2
  -> immediate transition and every bridge retry return 409 stage_not_ready
```

The earlier “return evaluations directly from the final PATCH” proposal is rejected. It could remove the first follow-up GET, but the same lossy read would still break refresh, direct resume, the Stage 2 bridge, and later Stage 3 requests.

## Chosen fix

Widen only the existing journey-authority projection by the three payload fields it omits:

- `productLoadResolution`
- `products`
- `roleAssignments`

Define a narrow authority-check input type as a `Pick<Stage3ProductDraft, ...>` containing exactly the seven fields the validator and overlay recomputation use:

- `refinedVersionId`
- `orderedCategories`
- `authorityVersions`
- `authoritySnapshot`
- `productLoadResolution`
- `products`
- `roleAssignments`

Change `requireCurrentAuthoritySnapshot` and the product-load validation helpers to accept this explicit subset. Then remove the `as never` call from journey access. If the validator later starts reading another draft field, TypeScript will force every caller to update.

Keep the existing persistence row mapper unchanged. Do not add strict parsing to the write path or broaden its failure surface.

## Scope and non-goals

In scope:

- the complete, compiler-enforced authority-check projection;
- exact valid and invalid product-load-overlay regression coverage;
- immediate transition, refresh/resume, and Stage 2 bridge verification;
- transition-latency measurement because a successful check now reaches overlay recomputation.

Non-goals:

- no recommendation, category, cadence, or product-fit rule changes;
- no relaxation of owner, entitlement, refined-source, authority-version, overlay, or revision-CAS checks;
- no successful Stage 3 response-envelope redesign;
- no bridge auto-reload: a genuinely stale draft currently has no safe restart operation, and automatic reload could loop;
- no new error copy or layout in this fix;
- no database migration, data repair, catalog change, feature flag, deployment, or activation;
- no diagnostic taxonomy refactor or generic retry framework.

## Target map

- `src/lib/personal-plan/products/authority/snapshot.ts` — define/use the narrow authority-check draft contract.
- `src/lib/personal-plan/products/product-load-resolution.ts` — accept the same minimal contract for overlay derivation and validation.
- `src/lib/personal-plan/journey-access-loader.ts` — include the three missing payload fields and remove the unsafe cast.
- `tests/personal-plan-journey-access-loader.test.ts` — valid supplemental-overlay regression plus a semantically stale overlay control.
- Relevant authority/product-load tests — type/runtime controls for the narrowed input contract without behavior changes.
- `tests/personal-plan-start-resume.test.tsx` — existing bridge success remains one GET; no retry semantic change is planned.

## Ordered implementation plan

### 1. Freeze the exact regression red

Add a journey-access fixture with:

- four base authority categories;
- saved Leave-in frequency and role facts;
- a valid derived `deep_cleansing_shampoo` overlay;
- five effective ordered categories.

Assert that Stage 3 should be authorized. On current `main`, it must fail because the production projection omits the overlay inputs.

Add a paired semantically stale overlay fixture—well-formed but inconsistent with the saved products/frequencies—and assert that it remains denied. This is not a schema-malformation test and should not turn the journey into a 503.

Completion: the valid fixture is red for the confirmed projection defect; the stale control is green and fail-closed.

Red proof recorded on 2026-08-12:

```text
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-journey-access-loader.test.ts
21 passed, 1 failed
valid product-load overlay: expected frontier stage3, received stage2
semantically stale overlay control: passed and remained denied
```

### 2. Make the authority input contract explicit

Introduce the seven-field `Pick` contract at the authority boundary and update product-load helpers to depend on it. Widen the journey loader's existing payload projection with `productLoadResolution`, `products`, and `roleAssignments`; remove `as never`.

Do not change database columns, Supabase queries beyond the already-selected payload object, the persistence mapper, or saved row shape.

Completion: the valid overlay is accepted, the stale overlay is rejected, and TypeScript proves the journey loader supplies every authority-check field.

Whole-branch review found a second production-valid ordering shape in the same validator: a product-load resolution can upgrade a category already present in the base authority order. The implementation therefore compares the effective order as base categories plus only overlay-only categories; overlapping base categories retain their position and still pass the ordinary base decision/version checks. A second red proof reproduced the false Stage 2 fallback before this correction (`22 passed, 1 failed`) and is retained as a regression.

### 3. Verify every affected entry path

Run focused tests and production-shaped browser coverage for:

- exact Leave-in search, cadence, and final category save;
- transition into product decisions without a GET 409;
- refresh/direct resume stays in Stage 3 with the Leave-in intact;
- completed Stage 2 bridge opens Stage 3 on its first GET;
- malformed or semantically stale authority still fails closed;
- revision-conflict and stale-refined-source controls remain unchanged.

No new UI state is expected. The intended evidence is the existing Stage 3 decision surface appearing instead of either supplied error screenshot.

### 4. Check latency and repository readiness

Run the Personal Plan transition benchmark and compare the Stage 3 authority phase with the existing budget. The old invalid path failed before overlay recomputation; the fixed path must remain within the established transition threshold.

Then run the full Personal Plan suite and repository verification, including build.

Completion: regression green, guards green, benchmark within budget, and repository verification passes.

## Verification

Fast loop:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/personal-plan-journey-access-loader.test.ts \
  tests/personal-plan-api-stage3.test.ts \
  tests/personal-plan-start-resume.test.tsx
```

Full checks:

```sh
npm run test:personal-plan
npm run bench:personal-plan-transitions
npm run ci:verify
git diff --check
```

Run the relevant Personal Plan Stage 1-5 and Stage 3 production-shaped browser specs, then inspect mobile and desktop at the final capture-to-decisions transition and after refresh.

## User journey after the fix

1. The customer selects the Leave-in, chooses its cadence, and confirms.
2. The server saves the canonical draft and derives any supplemental product-load category.
3. Journey authorization reads all seven fields required to validate that same draft.
4. Stage 3 opens the existing product-decision surface; the Leave-in remains saved.
5. Refresh/direct resume returns to that same Stage 3 draft.
6. A genuinely invalid snapshot or overlay remains fail-closed under the existing error behavior.

Evidence review and user-journey sign-off: **confirmed by Nick on 2026-08-12 with the instruction to implement this fix**. No new mockup is required because the approved slice restores the existing Stage 3 decision surface and deliberately introduces no UI, copy, timing-state, or interaction design change.

## Review and boundaries

- Worktree: `.worktrees/personal-plan-stage3-authority-recovery`
- Branch: `codex/personal-plan-stage3-authority-recovery`
- Counterpart review: diagnosis approved; lean-fix revision adopted. Strict shared-mapper parsing, automatic bridge reload, and expanded telemetry were removed based on review findings.
- Evidence review and explicit journey sign-off: confirmed on 2026-08-12.
- No implementation, commit, push, PR, deploy, migration, feature flag, or production write is authorized by this plan.
- The earlier HTML recovery mockup was superseded by the root-cause fix and discarded; a separate genuine-stale recovery design remains out of scope.
