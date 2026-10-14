# Stage3 private source/plan greps — independent judgment

Read-only review; no test, edit, mutation, or provider action.

## Verdict

- R — tests/personal-plan-stage3-release.test.ts:95, complete Stage 3 catalogue authority has no retired environment or persistence branch.
- R — tests/personal-plan-stage3-release.test.ts:110, current Stage 3 plans contain no obsolete complete-catalogue activation instructions.
- No deletion or assertion transfer is supported in this two-test scope.

## Why the source grep is an independent contract

The test examines the three former control points: release.ts, production-persistence-gateway.ts, and stage3-persistence-supabase.ts. It fails if either the retired environment key or the former completeCatalogEnabled option returns anywhere in the actual release/persistence path.

Current executable keeper observations are real but narrower:

- release tests establish that isPersonalPlanStage3Enabled is unconditional true and that thumbnail delivery and inventory-authority-v2 remain separate strict default-off gates;
- production-persistence-gateway tests exercise the real gateway, and Stage3 routes create that gateway (for example src/app/api/personal-plan/stage-3/route.ts:571 and complete/route.ts:214);
- stage3-persistence-supabase.ts creates its persistence with only the thumbnail option and canonical authority fact loaders.

Those tests do not fail if a future change reintroduces PERSONAL_PLAN_STAGE3_COMPLETE_CATALOG or completeCatalogEnabled as a dormant/default-true branch. Such a branch violates the settled one-canonical-catalogue architecture while preserving present default behavior. The grep therefore protects a distinct architectural exclusion, not a public launch boolean. It does not cover the still-supported thumbnail or v2 gates.

History supports that boundary: d4cd6b4d introduced complete-catalogue behavior; f17a8357 retired the flag after its authority repair. The remaining test is the least direct guard that the rollback mode does not silently return.

## Why the plan grep is an independent operational contract

The four named plans are current durable implementation records for the Stage3 authority work. The test excludes the retired key and operational instructions such as flag-off, rollback-only, rollout-gated, full-catalog activation, and flag rollback. The catalog-authority repair plan itself says the retired environment rollback is not retained as a parallel semantic mode; the shampoo-target plan says a future rollback is a code revert/redeploy, not an environment toggle.

No gateway, Supabase, route, or proposal-stager test can detect a stale human instruction that tells an operator to toggle the retired gate. A runtime test would correctly remain green while the document reintroduces an invalid deployment procedure. This is an operational safety contract at its only practical boundary. The string set is scoped to named retired instructions and named current plan files; it is not a generic prose-style assertion.

## Stage4 comparison

tests/personal-plan-stage4-release.test.ts has the analogous test initial Routine activation is canonical and has no default-off release gate. It asserts absence of the retired Stage4 environment reader and activation call in the Stage3 completion route, while positively requiring createRoutineProposalStagerRpcAdapter. That route proof does not itself catch reintroduction of a dormant release gate or an activation side call behind a default. It reinforces retaining the Stage3 source grep rather than treating route coverage as a replacement.

## Limits

These are static architecture/operational guards. They do not prove deployment state, actual Supabase contents, catalog completeness, thumbnail behavior, inventory-authority-v2 behavior, or Stage4 proposal-stager correctness. Those have separate runtime and release tests.
