# Personal Plan inventory-only product search

## Outcome and source context

Stage 3 catalog identity search succeeds for every product category that is legitimately present in the signed owner draft, including categories present only because the user reported a current product. The source report is the 2026-08-13 production Conditioner 503 captured in the task thread; production replay proved Shampoo succeeded while the inventory-only Conditioner threw `stale_authority_snapshot` before the healthy search RPC ran.

## Chosen direction

Keep one shared fail-closed rule at the production gateway: a canonical requirement is always required; a refined category decision is required unless the validated authority snapshot explicitly marks the category as inventory-only. Inventory-only searches receive hair thickness but no invented roles or Shampoo/Conditioner target.

Use the existing Personal Plan rollout gate and ordinary revert path. Do not add a category-specific exception or a new feature flag.

## Scope and non-goals

In scope:

- one shared search authorization/context correction for every value in `PERSONAL_PLAN_PRODUCT_CATEGORIES`;
- table-driven red-first coverage for all categories and the fail-closed boundaries;
- privacy-safe internal failure classification at the Stage 3 search route;
- focused, full Personal Plan, CI, and rendered journey verification.

Non-goals:

- no quiz, refinement, recommendation, Routine, UI layout, or German copy redesign;
- no synthetic `not_needed` decision, role, target, recommendation, or executable use;
- no migration, catalog repair, feature activation, deployment, or production write;
- no rescue-by-inference for legacy drafts that lack the signed inventory-only marker.

## Target map

- `src/lib/personal-plan/products/production-persistence-gateway.ts`: shared search invariant and no-target context.
- `tests/personal-plan/products/production-persistence-gateway.test.ts`: red-first all-category gateway coverage.
- `src/app/api/personal-plan/stage-3/search/route.ts`: safe known-code/class logging while preserving the 503 response contract.
- `tests/personal-plan-api-stage3.test.ts`: route logging/privacy contract at the injected route seam.

## Designed user journey

Actor: an eligible Personal Plan user in Stage 3 product capture.

1. A refined-plan category behaves as today: search uses its target and required roles.
2. A category shown only because the user currently owns or uses such a product also searches normally and can identify that product using the existing result cards.
3. The inventory-only search does not imply that the category belongs in the final plan and does not create fit authority.
4. A category absent from both the plan and signed inventory remains inaccessible even if the request is manipulated.
5. Existing loading, empty, retry, and manual-add UI remains unchanged; the reported valid Conditioner path shows results instead of the generic 503.

Nick reviewed this journey in the task thread and explicitly authorized implementation on 2026-08-13. Journey sign-off: confirmed.

## Planning evidence

The production screenshot in the task thread establishes the existing mobile error state. The selected result state is the already-shipped successful Shampoo search component; no new visual hierarchy, copy, timing contract, or interaction design is introduced. Production Vercel/Supabase traces and an exact owner-draft replay established the backend authorization mismatch. Evidence review: confirmed.

## Ordered tasks

1. Add a table-driven regression guard iterating `PERSONAL_PLAN_PRODUCT_CATEGORIES`. For each signed inventory-only category, search must reach persistence with empty required roles and no Shampoo/Conditioner target. Prove the current implementation fails red with `stale_authority_snapshot`. Also assert that a non-inventory missing decision and a missing requirement remain rejected.
   - Produces: a red-capable gateway test at the real defect seam.
   - Complete when: the focused test fails for the intended missing branch, not fixture or environment setup.
2. Update the gateway to use the already-validated `inventoryOnlyCategories` marker when deciding whether a missing category decision is legitimate. Preserve the category requirement and snapshot validation gates.
   - Consumes: the red guard from task 1.
   - Produces: planned categories keep target context; signed inventory-only categories use explicit no-target context; unrelated categories fail closed.
   - Complete when: the focused guard passes and a mutation of either allow condition would fail it.
3. Add privacy-safe diagnosis at the route boundary. Log only a whitelisted Stage 3 error code or otherwise `temporarily_unavailable`; never log message, user ID, draft ID, query, or result data. Keep the client response unchanged.
   - Produces: actionable 503 classification without customer or catalog data.
   - Complete when: route tests prove known and unknown failures preserve HTTP behavior and safe fields.
4. Verify the complete tree and existing journey.
   - Complete when: focused gateway/API tests, `npm run test:personal-plan`, `npm run ci:verify`, ready-check risk checks, and an honest production-shaped/browser journey check pass on the same content fingerprint.

## Verification

Automated:

- focused gateway and Stage 3 API tests;
- `npm run test:personal-plan`;
- `npm run ci:verify`;
- ready-check canonical fingerprint and repository-specific risk checks.

Manual/browser:

- verify one refined-plan category search followed by one signed inventory-only category search at a mobile viewport when the existing Lab or field-test journey can exercise the production gateway;
- otherwise retain the exact read-only production-shaped gateway replay as seam evidence and use rendered browser coverage only for the unchanged search-result experience;
- confirm a manipulated unrelated category remains rejected through automated coverage rather than production probing.

Live-state boundary:

- the deployed search function was read-only verified to ignore `p_context` beyond its signature, and an empty-context Conditioner RPC returned the expected ready catalog candidate;
- no production write is required for implementation readiness.

## Review and handoff

- Branch/worktree: `codex/personal-plan-inventory-search` in `.worktrees/personal-plan-inventory-search`, based on `origin/main` at `7b4c53f3`.
- Required gates: `ready-check`, `request-code-review`, and one read-only Claude whole-branch review.
- Artifacts: this plan and regression coverage are commit candidates; transient reviewer/browser output is discarded unless a reusable receipt is intentionally retained.
- Stop before commit, push, PR, merge, deploy, flag change, migration, or production write without separate authorization.
