# Anwendung catalog relationship convergence

## Outcome and source context

Restore `/anwendung` for eligible Personal Plan owners and remove the catalog relationship ambiguity that caused the production route to resolve as `unavailable` after the catalog-authority schema expansion.

The confirmed production failure is a PostgREST `PGRST201`-class ambiguity: `products` now has both the legacy `product_id -> products.id` relationship and the stronger `(product_id, category_key) -> products(id, category_key)` relationship for category-specific fact tables. The Stage 5 product projection embeds those fact tables by table name alone, so PostgREST cannot choose a relationship. A read-only replay of the affected active Routine failed before compilation with `Could not embed because more than one relationship was found for 'products' and 'product_leave_in_specs'`. The same projection succeeded for all three distinct affected products when every embed explicitly named its `*_product_category_fkey` constraint.

Source surfaces:

- `supabase/migrations/20260815083332_catalog_authority_schema_foundations.sql` introduced the composite category relationships as unvalidated expansion constraints.
- `src/lib/personal-plan/routine/application-adapter.ts` owns the production Stage 4-to-Stage 5 catalog read.
- `scripts/product-intake/catalog-enrichment/stage5-protocol-client.ts` contains the other current product-to-spec embeds exposed to the same ambiguity.

## Chosen direction

Use one explicit, typed product-spec relationship contract in application code and converge the database to one canonical relationship per category-bound child table.

1. The application fix names the composite `*_product_category_fkey` relationship in every current product-spec embed. It lands before any relationship is removed, so it works against both the current dual-FK schema and the converged schema.
2. Shared relationship names and embed construction for the nine tables that are actually embedded today live in a small catalog-authority module rather than in duplicated raw PostgREST strings. Stage 5 runtime and Product Intake protocol tooling consume that contract while retaining their own field projections. The schema contraction still covers all fourteen category-bound tables so the database invariant is uniform without adding five unused code-registry entries.
3. A follow-up migration validates every category-bound composite FK and then drops the redundant single-column `*_product_id_fkey`. The composite relationship remains canonical because it proves both product identity and category agreement.
4. Production-shaped verification exercises the actual PostgREST projection; mocked query tests remain useful for adapter behavior but are not treated as relationship-resolution proof.

Rejected directions:

- **Hints only, permanent dual relationships:** repairs the incident but leaves every future embed exposed unless each caller independently remembers the constraint name.
- **Drop the composite FKs:** restores implicit embeds by weakening the category-integrity invariant introduced by the catalog-authority architecture.
- **Dedicated RPC or view:** would provide a stable read model, but adds a database API and type-maintenance surface without a query-shaping or authorization need that the typed repository cannot satisfy.

## Scope and non-goals

### In scope

- Explicit composite-relationship hints for every current `products -> product_*_specs` embed used by Stage 5 runtime and protocol tooling.
- One typed registry/helper for canonical relationship names and embed fragments.
- Privacy-safe normalization of PostgREST relationship/read failures so `failureReason()` in `src/app/anwendung/page.tsx` reports `database` instead of `unknown` without forwarding raw database messages.
- A contraction migration for the category-bound tables introduced by the schema-foundations expansion:
  - `product_shampoo_specs`
  - `product_conditioner_specs`
  - `product_conditioner_rerank_specs`
  - `product_leave_in_specs`
  - `product_leave_in_eligibility`
  - `product_heat_protectant_specs`
  - `product_oil_specs`
  - `product_oil_eligibility`
  - `product_mask_specs`
  - `product_scalp_care_specs`
  - `product_dry_shampoo_specs`
  - `product_bondbuilder_specs`
  - `product_deep_cleansing_shampoo_specs`
  - `product_application_protocols`
- Static migration contract tests plus a real Supabase/PostgREST verification path.
- An authenticated Anwendung smoke after deployment and after migration application.

### Non-goals

- No change to Stage 3 product decisions, Stage 4 Routine construction, ownership/executable semantics, Stage 5 compiler behavior, German copy, layout, retry interaction, navigation, or application guidance.
- No catalog product/spec/protocol content mutation.
- No new RPC, view, table, recommendation rule, or feature flag.
- No migration application, deployment, or production smoke as part of implementation alone; each remains a separately authorized release gate.
- No removal of composite category constraints or compatibility triggers outside the exact redundant relationship contraction.

## Authoritative relationship contract

For every category-bound child table, the canonical relationship is:

```text
(child.product_id, child.category_key)
  -> (products.id, products.category_key)
```

Code names the corresponding `<child_table>_product_category_fkey` explicitly. The migration order for each table is fixed:

1. prove there are zero child rows whose `(product_id, category_key)` lacks a matching product;
2. `VALIDATE CONSTRAINT <child_table>_product_category_fkey`;
3. drop the redundant `<child_table>_product_id_fkey` only after validation succeeds.

The migration must fail atomically on drift. It must not use `IF EXISTS` to hide an unexpected constraint state.

## Target map

- `src/lib/catalog-authority/product-spec-relationships.ts` — new pure typed registry/helper for the nine currently embedded category-spec tables, their canonical composite relationship names, PostgREST embed fragments, and a privacy-safe `CatalogDatabaseReadError`; no Supabase client or server-only dependency.
- `src/lib/personal-plan/routine/application-adapter.ts` — replace ambiguous raw product-spec embeds with the shared composite relationship contract; replace raw Supabase error-object throws with `CatalogDatabaseReadError` at this repository boundary without retaining the raw object or message.
- `scripts/product-intake/catalog-enrichment/stage5-protocol-client.ts` — use the same canonical relationship contract for all three protocol-tool projections.
- `src/app/anwendung/page.tsx` — classify `CatalogDatabaseReadError` explicitly as `database`; preserve every other failure classification and recovery state.
- `src/lib/observability/personal-plan-application.ts` — preserve the existing privacy-safe sink contract unchanged except for any type-only adjustment required by the classifier test.
- `supabase/migrations/20260815220000_catalog_spec_relationship_convergence.sql` — validate category-bound composite relationships and remove their redundant single-column relationships in explicit statements.
- `tests/personal-plan-stage5-application-adapter.test.ts` — assert exact composite relationship selection, typed read-error normalization, and unchanged adapter results.
- `tests/product-intake-stage5-protocol-client-relationships.test.ts` — new focused source/contract test because no current test owns `stage5-protocol-client.ts`; assert all operational projections use the canonical relationship registry.
- `tests/catalog-authority-relationship-convergence-migration.test.ts` — assert complete table coverage, validate-before-drop order, canonical FK retention, atomicity, and absence of permissive `IF EXISTS` behavior.
- `scripts/catalog-authority/schema-audit.sql` — extend the read-only receipt to report composite validation state and prove no redundant category-table product relationship remains after contraction.
- A focused task-owned non-production verification command — execute the production projection against an explicitly provided Supabase branch/project and fail on PostgREST ambiguity or unexpected nested shape. It is a required release receipt, not new always-on CI infrastructure.

## Designed user and operator journey

There is no intended end-user surface change.

### End user

1. An eligible Personal Plan owner completes Stage 3 and reaches the accepted Routine.
2. Opening `Anwendung` loads the same active Routine, verified catalog facts, product protocols, and canonical day definitions as before.
3. The existing Anwendung overview and day pages render normally. Planned/provisional, confirmed, unresolved, and fail-closed guidance semantics remain unchanged.
4. A genuine transient database/content failure still shows the existing `Anwendung gerade nicht verfügbar` recovery state; the fixed relationship no longer sends every non-empty Routine into that state.

### Release operator

1. Deploy the application change while the database still contains both relationships.
2. Verify the production projection and an authenticated Anwendung journey use the explicitly named composite relationships successfully.
3. Run the migration preflight and require zero category/product mismatches plus the expected constraint names and validation states.
4. Apply only `20260815220000_catalog_spec_relationship_convergence.sql` with explicit authorization.
5. Read back constraint validation/relationship state and repeat the authenticated Anwendung smoke on the exact deployed head.
6. If application verification fails before migration, roll back the deployment and do not apply the migration. If migration preflight or validation fails, leave the application fix deployed, stop before constraint drops, and investigate the mismatched rows; do not weaken or bypass the composite invariant.
7. After the legacy FKs are dropped, ordinary application rollback remains safe because both the repaired and successor code bind the surviving composite relationship. Recreating a removed single-column FK is not an automatic rollback action; it requires a new reviewed migration and is needed only if a separately identified external consumer proves dependent on that legacy constraint name.

Completion means Anwendung works before and after schema contraction, and every category-bound child table has one validated canonical relationship to `products`.

User-journey sign-off: **confirmed by Nick on 2026-08-16**.

## Planning evidence

This is backend-only. It intentionally changes no user-facing surface, copy, timing contract, or interaction, so no mockup is required.

Evidence supporting the chosen direction:

- Exact active-Routine replay reproduced the ambiguous `product_leave_in_specs` embed before Stage 5 compilation.
- The affected Routine's active catalog products and V2 protocol rows were structurally valid.
- Both the legacy single-column hint and the intended composite hint resolved the live query; the composite hint returned all three distinct candidate products without error.
- Repository search found ambiguous product-spec embeds in the Stage 5 runtime adapter and three Product Intake protocol-client projections, with no current explicit FK hints.
- The focused Stage 5 suite passed 229/229 despite the production failure, proving the mocked query boundary needs a production-shaped relationship guard.

Evidence review status: **diagnosis, designed journey, and local implementation evidence confirmed; hosted release evidence pending**.

## Ordered tasks

### Task 1 — Establish the canonical PostgREST relationship contract

**Consumes:** the authoritative table/constraint registry in this plan and the applied schema-foundations migration.

Create `product-spec-relationships.ts` with a closed union of the nine currently embedded product-spec tables (`product_shampoo_specs`, `product_leave_in_specs`, `product_bondbuilder_specs`, `product_mask_specs`, `product_oil_specs`, `product_heat_protectant_specs`, `product_scalp_care_specs`, `product_dry_shampoo_specs`, and `product_deep_cleansing_shampoo_specs`), exact composite constraint names, and a helper that produces `table!constraint(columns)`. Reject unknown table names at compile time; do not accept arbitrary constraint strings.

Update the Stage 5 application adapter and all Stage 5 protocol-client product embeds to use the helper. Preserve their current selected columns and nested result keys so downstream parsing does not change.

Normalize Supabase/PostgREST read errors at the adapter/repository boundary to `CatalogDatabaseReadError`. The typed error carries no raw Supabase object, raw message, query, or returned data. Update `failureReason()` in `src/app/anwendung/page.tsx` to map that class directly to `database`; the observability sink continues receiving only the stable classification and existing operational identifiers.

**Produces:** one code-owned relationship contract used by every currently affected embed.

**Completion criterion:** unit tests assert every runtime/tooling projection names the correct `*_product_category_fkey`; existing adapter/protocol result-shape tests remain unchanged; an injected relationship error is reported as privacy-safe `database`.

### Task 2 — Add the production-shaped regression guard

**Consumes:** Task 1's exact production projection.

Add two proportional guards:

1. Always-on static/unit tests assert that every one of the nine current embeds is built through the canonical registry and contains the exact `!<table>_product_category_fkey` hint. This is the CI regression guard that would have caught the incident cheaply.
2. A bounded, opt-in non-production PostgREST command accepts an explicit Supabase branch/project, applies or verifies current migrations through the existing guarded Supabase workflow, selects representative products, runs the same production projection, and validates the nested response shape. It must demonstrate the original table-name-only selector fails while the composite-hinted selector passes.

Keep static/fixture proof distinct from hosted branch and production proof. The opt-in command must hard-reject project `pqdkhefxsxkyeqelqegq`, require an explicit non-production project reference, and avoid product-content output. Do not add new always-on Supabase CI provisioning for this change; successful execution against a fresh non-production branch is a required release receipt.

**Produces:** a red-capable relationship-resolution test at the actual PostgREST seam.

**Completion criterion:** static/unit guards pass in normal CI; the non-production command demonstrates the original ambiguity against the old selector and passes against Task 1; its project guard and environment requirements are documented in the owning script.

### Task 3 — Converge category relationships in one guarded migration

**Consumes:** Task 1 deployed compatibility and the exact table registry above.

Create `20260815220000_catalog_spec_relationship_convergence.sql` with explicit statements for all fourteen category-bound child tables. For each table, validate the composite FK before dropping the legacy single-column FK. Keep the transaction atomic, retain composite FK names, indexes, category checks, RLS, grants, and compatibility triggers, and make unexpected/missing constraints fail visibly.

Extend the schema audit and add a static migration test covering:

- exact fourteen-table coverage with no duplicates or omissions;
- `VALIDATE CONSTRAINT` preceding `DROP CONSTRAINT` for every table;
- no drop of any `*_product_category_fkey`;
- no `IF EXISTS`, dynamic wildcard DDL, data repair, or content mutation;
- the final schema audit expects validated composite FKs and no redundant `*_product_id_fkey` on these tables.

**Produces:** a reviewable contraction migration and read-only post-apply receipt.

**Completion criterion:** static migration tests pass; a fresh Supabase branch applies the full migration chain; pre/post schema receipts show the expected transition; Task 2 still passes after contraction.

### Task 4 — Verify application behavior and prepare the guarded release handoff

**Consumes:** Tasks 1–3.

Run focused Stage 5, Product Intake protocol-client, observability, migration, typecheck, lint, build, and relevant Personal Plan suites. Exercise the exact production-shaped Routine through the read-only replay without retaining user or product content in artifacts.

Prepare a release receipt with two distinct gates:

1. application deploy and pre-migration authenticated smoke;
2. separately authorized migration apply, schema readback, and post-migration authenticated smoke.

Do not include deployment, migration apply, catalog writes, or production smoke in the implementation authorization.

**Produces:** review-ready code/plan/migration plus a guarded release sequence.

**Completion criterion:** all automated checks pass; counterpart code review has no unresolved blocker; the read-only exact-path replay resolves to a usable Anwendung state; release gates and rollback stops are explicit.

## Verification

### Automated

- Focused new relationship-registry tests.
- `npm run test:personal-plan-stage5`.
- `tests/product-intake-stage5-protocol-client-relationships.test.ts`.
- `tests/catalog-authority-schema-foundations-migration.test.ts` plus the new convergence migration test.
- Privacy-safe Stage 5 observability tests.
- `npm run test:personal-plan` when the focused implementation stabilizes.
- `npm run ci:verify`.

### Supabase branch / PostgREST

- Apply the full migration chain to a fresh non-production Supabase branch.
- Run the task-owned non-production command before the contraction migration while both FKs exist; require the old selector to reproduce `PGRST201` and the explicit composite projection to succeed.
- Apply the contraction migration.
- Query `pg_constraint`/`information_schema` to prove all fourteen composite constraints are validated and all fourteen redundant single-column constraints are absent.
- Rerun the identical production projection and compare its normalized shape.
- Confirm no category/product mismatch or content row was mutated by the migration.

### Manual/browser

- Before production migration: authenticated field-test journey reaches `/routine` and `/anwendung`; overview and one available day render; reload does not fall into the generic unavailable state.
- After production migration: repeat the same exact-head journey and confirm equivalent content/state.
- Confirm the existing genuine-error recovery screen still renders under an injected test failure.

### Production read-only evidence

- Vercel runtime logs show `application_page_resolve` with a usable state rather than deterministic `unavailable` for the smoke request.
- Supabase API logs contain no relationship-ambiguity response for the smoke window.
- Schema audit receipt matches the reviewed migration fingerprint and exact project `pqdkhefxsxkyeqelqegq`.

## Review and handoff

- Worktree: `.worktrees/anwendung-catalog-relationship-fix`.
- Branch: `codex/anwendung-catalog-relationship-fix`, based on `origin/main` at `f214e3a050098dd4b1b54cf0d7949e901fa90941`.
- Plan artifact: **commit** with the implementation PR.
- Counterpart plan review: transient output in the system temporary directory; **discard** after findings are reconciled.
- Test fixtures/scripts added for the durable PostgREST guard: **commit**.
- Local replay output and any identifiers: **discard**; never commit.
- Required implementation workflow: `implementation-loop`, including its owned `ready-check` and `request-code-review` gates.

## Implementation receipt — 2026-08-16

- Implemented the shared nine-table relationship registry, exact composite hints in both consumers, privacy-safe database error normalization, the fourteen-table validate-then-drop migration, final-state schema audit, and guarded hosted-branch replay commands.
- Red proof: the new application and Product Intake relationship assertions failed against the original unhinted selectors before the implementation.
- Green proof: Stage 5 `230/230`; full Personal Plan `1625/1625`; focused relationship, migration, catalog-audit, Product Intake, and route suites all passed; `npm run ci:verify` passed with four unrelated existing lint warnings.
- Ready-check identity before review fixes: `3ea93e14d700fc1fe6942bb0c228aa02d3075ea605e7889b148e8dce33dfa147`.
- Counterpart code review found no correctness or migration blocker. Its supported verification findings were incorporated: hosted replay now rejects an empty active-product sample, asserts singleton-versus-array embed cardinality, exercises the exact application projection plus both Product Intake cohort projections, and exposes explicit package commands for dual and converged states.
- The proposed sanitized PostgREST-code expansion was not adopted because this plan intentionally keeps the repository boundary free of raw Supabase error fields; the stable `database` reason remains the complete observability payload.
- Hosted Supabase branch replay, migration apply/readback, deployment, and authenticated Anwendung smoke remain release-gated. Local migration application was unavailable because Docker was not running; no database was mutated.
- Durable plan, source, migration, verification script, and tests: **commit with the implementation PR**. Transient Claude review and local command output: **discard**.
- Stop point: review-ready local branch. Commit/push/draft PR requires explicit `ship it`; deployment, migration apply, authenticated production smoke, and merge remain separate authorizations.
- Evidence review: diagnosis confirmed; backend implementation evidence pending.
- User-journey sign-off: pending the walkthrough after counterpart-plan reconciliation.

## Planning findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| P-001 | defect | Production replay fails on an ambiguous reverse embed while mocked Stage 5 tests pass | accepted | Added explicit composite hints and a real PostgREST guard | Task 2 branch test plus authenticated smoke |
| P-002 | tradeoff | Dual FKs preserve expansion compatibility but expose every implicit embed to ambiguity | accepted | Deploy compatible code first, then validate/drop redundant simple FKs | Pre/post-migration identical projection |
| P-003 | scope/product decision | RPC/view could isolate reads but adds a new database API without an authorization or shaping need | rejected | Use a typed repository/helper over canonical schema | Counterpart architecture review |
| P-004 | defect | Raw PostgREST objects are not `Error`, so `failureReason()` cannot classify their message | accepted | Throw privacy-safe `CatalogDatabaseReadError` and map it explicitly in `page.tsx` | Focused classifier and observability tests |
| P-005 | tradeoff | No always-on Supabase/PostgREST branch harness exists; creating one would dominate this repair | accepted | Use exact static CI assertions plus a required opt-in non-production replay | CI test plus branch receipt |
| P-006 | tradeoff | Nine tables are embedded today while fourteen participate in the category identity invariant | accepted | Keep the code registry at nine; converge all fourteen schema relationships | Source inventory plus post-migration schema audit |
| P-007 | tradeoff | Dropping legacy FKs is not automatically reversible after migration | accepted | Deploy composite-bound code first; require a new reviewed migration only if a real legacy-name consumer is later proven | Consumer inventory and pre/post projection replay |
