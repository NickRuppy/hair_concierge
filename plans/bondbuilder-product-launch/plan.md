# Bondbuilder product launch — 2026-10-05

## Outcome and approved scope

Make the five reviewed, staged internal Bondbuilders available in existing catalog search, EAN scan and owned-product selection. Preserve their approved identities, images, commerce, research and trust. OGX/Aveda remain low trust and non-recommended. Elvital/Redken/Première may become recommended **only if** independently verified fit and exact executable application requirements pass; insufficient evidence remains a reported blocker, not a reason to manufacture facts.

Nick approved this split with “yeah works your recommendaiotn - go ahead, get it live”, continuing the prior explicit ship/merge/activate authority. Prior PR #635 and runtime activation are complete, not work to repeat.

## Decision coverage — confirmed

- Confirmed with Nick: all five searchable/scannable; low two non-recommended; medium three subject to existing recommendation checks; producer fact follow-up; narrow publication-gate split; get the approved result live.
- Inherited from contract: full research retention, exact source/pack binding, unknown fit/protocol stays unknown, immutable frozen history, no intensity/axis inventions, no recommendation leakage; `docs/research/bondbuilder-inci/v0.5/standard.md`, Product Intake readiness contract.
- Implementation defaults: additive migration, restricted service-role CAS activation, existing evidence ledger, source/evidence follow-up as a separate new artifact, no new infrastructure.
- Open consequential assumptions: none. Recommendation eligibility is conditional; no waiver of unresolved evidence is approved. A policy change to waive fit/protocol is outside this launch.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: latest quoted request approves the already proposed product split and publication repair.
- Internal revalidation: fresh main `bf6c74c74fc6f2e5d15171e4852ae5e8f28220f7`; live five inactive/non-recommended with stored full profiles, empty thickness and no protocols. Search/scan need only active lifecycle; recommendation loaders additionally require recommendation flag.
- Final-base refresh: safely fast-forwarded the task to `c6696b5fe806adbde6aff546306c66e1376c3d62` after unrelated price-audit PR #639 merged. No consumer/publication-function overlap; all eight complete live bundles and both publication function hashes reverified unchanged. Its migration is already applied.

## Journey and non-goals

Existing German UI, layouts, copy, timing and feedback remain unchanged. A customer can find/scan the exact reviewed product and save it as owned. Incomplete authority must retain the existing unknown/not-evaluable assessment, with no invented executable instructions. Automatic alternatives/routine recommendation candidate pools remain flag-gated. This implements the approved availability change in existing surfaces; no new design/prototype or additional UI journey decision is needed.

No reclassification/trust promotion, new blind research run, frozen artifact rewrite, new category/schema frontend, unrelated publication relaxation, user-submitted origin fiction, or search exclusion disposition.

## Ordered implementation

1. Source follow-up is complete in `docs/research/bondbuilder-inci/catalogue-source-followup-2026-10-05.md`; validate and commit it, without duplicate research. None of the five clears current recommendation gates, so all five remain non-recommended in this launch. Stored profiles remain unchanged.
2. Existing new `tests/bondbuilder-catalogue-availability-postgres.test.ts` has a genuine RED against the current publication guard; make it GREEN and finish refusal/transition cases. Test all five activation; invalid/unbound/unsupported profiles and wrong image/ledger still refuse; false→true recommendation transition remains blocked even after a curated product is already active; unrelated category and existing anchor guard behavior remains unchanged. Existing new `tests/bondbuilder-catalogue-consumers.test.ts` is baseline GREEN (3/3), not RED: it proves scanner/authority retention and no favorable assessment/recommendation leakage. Combined consumer regression pass is 51/51.
3. Add a migration with a narrow `bondbuilder_catalogue_available_v1` predicate: valid exact product-bound in-scope profile, matching internal reviewed-admission evidence/ledger and approved hosted asset/thumbnail. It tolerates only research fit/application uncertainty, not identity/boundary uncertainty. Add an early **non-recommended curated Bondbuilder only** branch to the outer publication assertion; fail closed if predicate fails, otherwise allow catalog availability without bypassing the unchanged recommendation predicate. Pin the outer function's accepted source hash before patching. Add a narrow recommendation-transition trigger because the existing generic visibility trigger does not fire on false→true recommendation once curated/active. Preserve all other arms/functions.
4. Restricted activation RPC changes **only** `is_active` from false to true. Require explicit reviewer `nick`, fresh exact full internal-admission readback/preimage, unique request ID, locks and reviewed admission predicate. Record activation preimage/postimage and ledger in one transaction. Exact retries require unchanged postimage; any drift refuses. Revoke public/anon/authenticated execution. No promotion or data repair capability.
5. Synchronize intake/engine bridge/status docs to distinguish research-only catalog availability from global recommendation readiness. Frozen v0.5 source docs/pins remain untouched.

## Concrete target map

- New additive migration only: define `bondbuilder_catalogue_available_v1(uuid)` and restricted `bondbuilder_catalogue_activate_v1(uuid,jsonb,uuid,text,boolean)`; grant only the service-role operator access needed for complete admission readback.
- Patch outer `public.assert_personal_plan_curated_publication(uuid)` from `supabase/migrations/20260813085151_personal_plan_catalog_closure.sql`, before its call to the inner assertion. Accepted current production `prosrc` SHA-256: `f3d47d3afb5d53358ea9626b5db577d3f7e55fbe7dff014b8870bb91790ca839`.
- Leave inner `assert_personal_plan_curated_publication_v1_without_v2` and `bondbuilder_curated_facts_ready_v1` unchanged. The latter and the injected inner guard live in `20261002132306_bondbuilder_research_profile_storage.sql`.
- Add a narrow Bondbuilder recommendation-transition guard, because `validate_personal_plan_curated_publication_on_visibility_transition` in `20260811212000_personal_plan_curated_publication_gate.sql` does not cover an already-active curated row switching recommendation false→true.
- Consumers remain unchanged: scan search route, `src/lib/scan/identifier-lookup.ts`, `src/lib/personal-plan/products/inventory-search.ts`, `catalog-facts.ts`, `src/lib/product-catalog/eligibility.ts`, and `src/lib/scan/resolve-verdict.ts`. Verification is owned by the two new tests plus their existing consumer suites.

## Verification and rollout

- Record real RED→GREEN for deterministic guard and activation behavior; run focused tests with `node --import ./tests/server-only-register.cjs --import tsx --test` and repository typecheck/lint/build with `npm run ci:verify`. No Docker.
- Inspect exact current/changed search, identifier and recommendation consumer paths; test the actual identity/search result and held verdict. Browser/API verification on the existing flow where access permits; do not claim a rendered authenticated flow from SQL only.
- One read-only terminal Claude plan review before implementation; one meaningful whole-branch counterpart review after verification. Verify findings locally. Shell is not configured with `ANTHROPIC_API_KEY`.
- Publish a draft PR, attach it, wait for all required checks, verified-head guarded squash merge under existing authorization. Confirm exact migration prerequisites/production function hash and apply only the new approved migration; no blind push. Verify permissions/advisors.
- If the migration connector assigns its own timestamp, reconcile only that exact new migration-history row to the reviewed repository version: matching unique name and full statement bytes, absent canonical slot, transaction/CAS, then exact readback. Never reconcile unrelated history or rerun DDL to repair a timestamp.
- **Deploy and verify the migration before any activation CAS.** Prepare new immutable operational artifacts with five exact live preimages and approved `is_active=true`/`is_chaarlie_recommended=false` delta; dry-run each predicate and CAS readiness, preserve three anchor preimages. Guarded apply only these five, then verify flags, full profile/identity/commerce/protocol/fit preservation, actual search/EAN queries and recommendation exclusion. Confirm public app deployment; worker deployment unnecessary unless worker bytes change.

## Counterpart review disposition

Read-only Claude review: approve with revisions. Accepted its concrete handoff findings: target map/current outer hash, accurate completed-artifact/test status, explicit migration-before-CAS ordering and exact verification commands. No product-scope change. Active research-only availability was already expressly approved, including unchanged unknown/owned-product behavior. A restricted reusable CAS RPC is a routine implementation choice within that scope, not a new approval gate. Decision coverage revalidated against Nick's approval and the completed follow-up; no recommendation promotion is now proposed.
- Guarded worktree finish from clean root main after archive preservation. Final receipt separates PR/merge/deployment/schema/live catalog and conditional recommendation gaps.

## Artifact disposition and self-review

Commit plan, migration/tests and reusable docs/source follow-up. Archive transient counterpart reports and production operational preimages/receipts privately. No task-owned artifacts discarded without classification. Scope, dependency ordering, approval and recovery are explicit; no hidden fit/protocol waiver. On a failed activation transaction nothing changes; later rollback is a separately approved exact `is_active=false` CAS, never row deletion or ledger removal.
