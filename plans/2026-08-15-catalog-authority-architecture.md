# Catalogue authority architecture

Status: target-state decisions and integration journey confirmed; Task 1 implemented and locally verified

## Outcome and source context

Establish one logical product catalogue authority for all ten Personal Plan categories without collapsing the normalized relational model into one wide table. Every recommendation, matching, product-comparison, routine, intake, admin, and catalogue-maintenance path must receive the same complete product facts and must write them through one transactional publication boundary.

The immediate product behavior remains unchanged: the complete-catalogue Stage 3 fix has already been shipped and activated, Stage 3 keeps the approved comparison table, and this architecture work prevents the same split-authority failure from recurring elsewhere. A "no verified alternative" result remains valid only after the complete recommendable category catalogue was evaluated and no candidate satisfies the full displayed target matrix better than the owned product.

Confirmed decisions (2026-08-15):

- authority scope: all catalogue readers and curated catalogue writers, migrated in phases;
- completeness policy: block new incomplete publication immediately, audit and repair historical rows, then validate universal constraints;
- legacy fields: retain derived compatibility projections through one monitored release, then remove them in a separate contract migration after parity proof.

Repository and live-state evidence:

- `products` currently mixes identity/lifecycle/commerce fields with legacy fit arrays and a legacy text category;
- ten Personal Plan categories use typed category tables, with one-row and multi-row cardinalities appropriate to their semantics;
- category tables currently reference only `products(id)`, so the database does not universally prevent a Shampoo product from receiving another category's spec row;
- `products.category_key` and several historical foreign keys are still `NOT VALID`;
- Shampoo specs were explicitly made canonical, while Conditioner, Leave-in, and Oil still retain historical triggers/functions that derive category rows from `products.suitable_thicknesses` and `products.suitable_concerns`;
- exact product guidance is primarily held in `product_application_protocols`, while family guidance is held in `application_guidance_protocols`; current reads sometimes accept overlapping product-scoped guidance from either table;
- application code and database functions contain multiple direct readers of `products` and category tables, and catalogue scripts/admin routes contain multiple direct multi-table writers;
- the shipped Stage 3 complete-catalogue path is paginated and batched, but its authority assembly remains local to Stage 3 and a bounded legacy direct-selection path still exists.

Live read-only confirmation on 2026-08-15:

- `products` contains 278 rows: 263 `origin = 'curated'` and 15 `origin = 'user_submitted'`;
- both origin groups currently have zero null `category_key` rows, and no third origin value exists;
- `products_origin_check` and `products_category_key_fkey` are present but `convalidated = false`;
- current category-spec, eligibility, and exact-protocol foreign keys are validated single-column `product_id -> products(id)` constraints; no composite product/category foreign key exists yet.

Primary-source design evidence:

- PostgreSQL supports composite foreign keys and requires the referenced columns to be primary-key or unique; it also recommends indexing referencing columns where workload warrants it: <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL supports adding foreign-key and check constraints as `NOT VALID`, enforcing new writes first, then validating historical rows with a less disruptive lock profile: <https://www.postgresql.org/docs/current/sql-altertable.html>
- PostgreSQL table inheritance is not a suitable subtype replacement here because uniqueness and foreign-key guarantees do not span inheritance children: <https://www.postgresql.org/docs/current/ddl-inherit.html>
- JSONB is appropriate for a fixed, versioned transport envelope, but predictable product facts should remain typed relational data rather than an EAV/property-bag store: <https://www.postgresql.org/docs/current/datatype-json.html>
- ordinary views compute current data and avoid the staleness/refresh boundary of materialized projections: <https://www.postgresql.org/docs/current/sql-createview.html>
- Supabase recommends database functions for data-intensive operations, `security invoker` by default, explicit object qualification with an empty `search_path`, and explicit execution grants: <https://supabase.com/docs/guides/database/functions>
- Supabase views need an explicit RLS/security model; internal objects should stay outside exposed API schemas or use `security_invoker`: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase supports a dedicated exposed API boundary backed by non-exposed schemas and explicit grants: <https://supabase.com/docs/guides/api/securing-your-api>
- Supabase migrations remain the reviewed, versioned change mechanism; generated schema changes must be inspected and security properties added explicitly: <https://supabase.com/docs/guides/local-development/declarative-database-schemas>

## Chosen direction

Keep a normalized joined-subtype model, but make authority explicit and enforceable:

1. `products` is the catalogue spine: identity, canonical category, lifecycle, recommendation visibility, presentation, and commerce only.
2. normalized eligibility relations own cross-category applicability facts such as supported hair thickness and catalogue concern codes;
3. typed category tables own category-specific facts and contextual eligibility tuples;
4. exact-product protocols and family guidance have separate, non-overlapping owners;
5. database constraints enforce product/category identity and publication completeness;
6. a versioned internal read model and one service-only RPC expose complete facts without exposing storage topology;
7. one TypeScript catalogue-authority repository parses the RPC into a discriminated union and is the only runtime entry point for catalogue facts;
8. deterministic fit/ranking remains in TypeScript; SQL owns facts, integrity, filtering, and transactional publication, not product-policy decisions;
9. one transactional catalogue publication RPC becomes the only curated multi-table write path;
10. rollout uses expand -> audit/repair -> shadow -> cutover -> contract, preserving an application rollback until the final legacy-field removal.

This is one logical catalogue, not one physical table. A single wide table would create many nullable, category-invalid fields. PostgreSQL inheritance would weaken integrity guarantees. A generic EAV/JSON property store would move schema errors from database constraints into runtime code. A materialized authority view would add an unnecessary freshness boundary to a small correctness-sensitive catalogue.

The selected scope is the full authority program, not an enforcement-only repair. An enforcement-only slice would reduce immediate migration work, but it would deliberately leave direct readers, database matchers, and multi-table writers with different assembly rules—the architectural defect this plan is meant to remove. The private read model and service-only RPC are justified by current consumers in both TypeScript and database functions: they give both runtimes one versioned relational contract while preventing storage tables from becoming public integration APIs.

### Canonical ownership matrix

| Semantic fact | Canonical owner | Compatibility or derived surface |
| --- | --- | --- |
| product ID, brand/line, canonical name, image, description | `products` plus existing identity relations | none |
| category | `products.category_key` | `products.category` until contract migration |
| active/discontinued/recommendable state and sort order | `products` | none |
| price, purchase-link freshness, package size | `products` | presentation only; excluded from fit fingerprints |
| supported thicknesses | new `product_thickness_eligibility(product_id, category_key, thickness)` | `products.suitable_thicknesses` derived until removal |
| broad catalogue concern codes | new `product_concern_eligibility(product_id, category_key, concern_key)` | `products.suitable_concerns` derived until removal |
| Shampoo contextual match, scalp route, cleansing intensity | `product_shampoo_specs` | no trigger may regenerate it from `products` |
| Conditioner contextual match | `product_conditioner_specs` | no trigger may regenerate it from `products` |
| Conditioner weight/repair/balance rerank facts | `product_conditioner_rerank_specs` | none |
| Leave-in format, weight, role/capability, care direction/benefits | `product_leave_in_specs` | merge verified unique facts from `product_leave_in_fit_specs`, then retire that duplicate table |
| Leave-in thickness/need/styling tuples | `product_leave_in_eligibility` | stop regenerating it from legacy product arrays |
| Heat-protectant capability/format | `product_heat_protectant_specs` | none |
| Oil weight/roles/capabilities | `product_oil_specs` | none |
| Oil thickness/subtype/purpose tuples | `product_oil_eligibility` | stop regenerating it from legacy product arrays |
| Mask facts | `product_mask_specs` | none |
| Scalp-care facts | `product_scalp_care_specs` | none |
| Dry-shampoo facts | `product_dry_shampoo_specs` | none |
| Bondbuilder facts and add-on relationship | `product_bondbuilder_specs` and `product_relationships` | none |
| Deep-cleansing facts | `product_deep_cleansing_shampoo_specs` | none |
| exact-product application/cadence/guidance | `product_application_protocols`, including the versioned exact-product payload | product-scoped `application_guidance_protocols` reconciled and retired |
| family-level application guidance | `application_guidance_protocols` with `scope_kind = 'application_family'` | never treated as exact-product evidence |
| catalogue fact evidence/fingerprints | `personal_plan_catalog_fact_evidence` and the existing apply ledger | transport projections only |

The shared eligibility tables do not replace contextual category tuples. They define the product's eligible thickness/concern set; multi-axis category rows further qualify that set. A category tuple containing a thickness that is not in the product's canonical thickness eligibility is invalid.

### Database integrity model

- Backfill and validate `products.category_key` for every row, including `origin = 'user_submitted'`, then make the column globally `NOT NULL` and add `UNIQUE (id, category_key)`. A product submission may remain pending, but a row promoted into `products` must already have a canonical category.
- Add a constant `category_key` column and category check to every category-specific table. Add composite foreign keys `(product_id, category_key) -> products(id, category_key)`.
- Add `category_key` to exact-product protocols and normalized eligibility relations, with the same composite product/category foreign key.
- Add composite foreign keys from Shampoo, Conditioner, Leave-in, and Oil contextual rows to `product_thickness_eligibility(product_id, category_key, thickness)`.
- Use `ON UPDATE RESTRICT ON DELETE CASCADE` for product/category and eligibility references. A guarded category repair must first make the product non-recommendable, delete the old category bundle, update the parent category, and insert/validate the new bundle in one transaction; it may not rely on cascading a category change through semantically different facts.
- Index every referencing composite key used by reads or cascading deletes.
- Add constraints as `NOT VALID`, audit/repair historical rows, and validate them in a later migration. Do not use a cross-table `CHECK`; PostgreSQL does not guarantee that pattern safely.
- Replace `assert_personal_plan_curated_publication` with a versioned completeness evaluator that returns stable issue codes and a publication assertion that delegates to it.
- The trigger-invoked completeness assertion and `publish_catalog_product_v1` are `SECURITY DEFINER`, owned by the migration owner, use `SET search_path = ''`, fully qualify every object, revoke execution from `PUBLIC`, `anon`, and `authenticated`, and grant only the minimum service-role operation. The read RPC remains `SECURITY INVOKER` and service-role-only.
- During expansion, the hard gate applies to transitions into active/recommended publication and all new canonical publication RPC calls. Existing active rows are audited and repaired before the stricter update-time trigger is enabled for every already-published row.

### Canonical read boundary

- Create a non-exposed `catalog_private` schema.
- Add `security_invoker` ordinary views:
  - `catalog_private.product_authority_core_v1` for spine, normalized eligibility, lifecycle, presentation, and evidence metadata;
  - `catalog_private.shampoo_authority_v1`, `conditioner_authority_v1`, `leave_in_authority_v1`, `heat_protectant_authority_v1`, `oil_authority_v1`, `mask_authority_v1`, `scalp_care_authority_v1`, `dry_shampoo_authority_v1`, `bondbuilder_authority_v1`, and `deep_cleansing_shampoo_authority_v1`, each exposing only that category's canonical owners;
  - `catalog_private.product_protocol_authority_v1`, which exposes exact-product protocols only and rejects category/scope disagreement.
- Add a service-only `public.load_catalog_authority_v1(...)` `SECURITY INVOKER` function with an empty search path and fully qualified object names. It returns a fixed `schemaVersion: 1` envelope containing product identity, category facts, eligibility, exact protocols, provenance/fingerprint inputs, and presentation metadata.
- The function accepts explicit category and optional product IDs. A recommendable-only mode filters lifecycle/publication state. It never contains an implicit top-N product limit.
- Complete-category loads page until exhaustion with stable `(sort_order, id)` ordering. Search-result presentation may remain capped, but candidate evaluation and alternative selection must call the complete-category mode.
- Add `src/lib/catalog-authority/contracts.ts` with a Zod-parsed discriminated union for all ten categories and `src/lib/catalog-authority/repository.ts` as the sole runtime reader.
- Move the existing deterministic selectors and fact fingerprinting behind this repository. Preserve current authority versions and comparisons unless a category contract intentionally changes in its own reviewed change.
- `personal_plan_search_assessment_products_v2` remains the bounded presentation-search RPC and is rewritten to select the typed private views; it may cap displayed search results but not recommendation evaluation. Uncalled legacy `match_products`, `match_shampoo_products`, `match_conditioner_products`, `match_leave_in_products`, `match_oil_products`, and `personal_plan_search_assessment_products_v1` functions are retired after a source and live dependency check. No database function continues to derive canonical facts from legacy product arrays.

### Canonical write boundary

- Add a service-only transactional `public.publish_catalog_product_v1(...)` function. Its versioned payload contains identity changes, normalized eligibility, exactly one category fact bundle, exact-product protocols, and evidence fingerprints.
- The function locks an existing product row, verifies expected identity/category/revision, validates the full payload, applies identity and canonical fact changes, verifies protocol scope and provenance, records idempotency/fingerprints, and changes active/recommended publication flags last.
- Category changes are not a normal edit. A separately named guarded repair operation must require the expected old category, remove/replace the old category bundle atomically, and pass the target category's completeness contract before publication.
- Product Intake approval, the admin product APIs, exact catalogue enrichment, seed/addition scripts that remain supported, and identity correction scripts call the canonical function or a narrowly scoped identity-only operation. They do not write category tables directly.
- During compatibility, the function derives `products.category`, `products.suitable_thicknesses`, and `products.suitable_concerns` in the same transaction. Callers cannot provide those legacy values independently.
- Once all application writers use the boundary, revoke direct category-fact table writes from application roles. Service-role maintenance scripts must also use the canonical operation unless a migration is explicitly performing an audited repair.

## Scope and non-goals

In scope:

- all ten `PERSONAL_PLAN_PRODUCT_CATEGORIES`;
- all runtime catalogue fit/recommendation/search/read consumers, including Personal Plan, legacy recommendation selection, chat product matching, routine exact-product reads, and supported database matcher/search functions;
- Product Intake, admin, enrichment, supported seed/addition, and identity-maintenance writers;
- canonical property ownership, database integrity, complete reads, transactional writes, compatibility, observability, and phased removal of legacy fields/triggers/functions;
- current exact-product protocol and provenance authority where it affects completeness.

Not in scope:

- changing the approved Stage 3 comparison-table UI or German copy;
- changing the Bedarfsplan, category policy, fit criteria, ranking weights, or what counts as a better alternative;
- adding product categories or external product research;
- converting the catalogue to PostgreSQL inheritance, EAV, a generic JSON property store, or a materialized read model;
- changing frozen Personal Plan decisions or recomputing historical routine artifacts;
- automatically publishing incomplete historical rows or hiding them before the repair audit is reviewed;
- deployment, production migration, feature-flag activation, or legacy-column deletion as an implied consequence of implementation/merge.

## Target map

New durable surfaces:

- `docs/catalog-authority.md` — ownership matrix, read/write rules, category completeness matrix, and deprecation contract;
- `src/lib/catalog-authority/contracts.ts` — versioned discriminated union and issue-code types;
- `src/lib/catalog-authority/repository.ts` — batched/paginated canonical reader;
- `src/lib/catalog-authority/shadow-compare.ts` — deterministic semantic parity comparison with aggregate telemetry;
- `scripts/catalog-authority/audit.ts` — read-only all-row integrity, completeness, ownership, and compatibility audit;
- `tests/catalog-authority-*.test.ts` — contracts, pagination, category parsing, shadow parity, and consumer-boundary tests;
- additive Supabase migrations for normalized eligibility, composite integrity, private views/read RPC, publication evaluator/write RPC, validation, and later contract removal.

Primary consumers to migrate:

- `src/lib/personal-plan/products/authority/catalog-facts.ts` — first becomes a compatibility adapter over the repository, then loses its direct table readers and 12-candidate legacy path;
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts` and `production-persistence-gateway.ts` — consume canonical complete-category and by-ID modes;
- `src/lib/recommendation-engine/selection.ts` and category helpers — receive parsed authority facts instead of querying spec tables;
- `src/lib/product-matching/matcher.ts`, product-list chunks, and the chat product-selection route — consume canonical facts/projections;
- Personal Plan routine cadence/application readers — consume the same exact-product protocol authority;
- supported matcher/search SQL functions — use private typed views or are removed after caller migration;
- admin product routes and UI payloads — call the canonical publication endpoint;
- `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`, Product Intake category validators, and catalogue-enrichment adapters — migrate verified Leave-in facts before `product_leave_in_fit_specs` is retired;
- Product Intake approval/enrichment clients and supported catalogue scripts — call the canonical write function.

Historical migrations remain immutable. New migrations remove superseded triggers/functions only after all live callers and compatibility checks prove they are unused.

## Designed integration and operator journey

This is backend-only. There is no intended end-user journey or visual change.

1. A catalogue reader requests one product, explicit product IDs, or a full category through `CatalogAuthorityRepository`.
2. The repository calls `load_catalog_authority_v1`, validates `schemaVersion`, category identity, cardinality, required facts, and protocol scope, and returns a typed category union.
3. Full-category recommendation/alternative evaluation follows stable pagination to exhaustion. It never substitutes a search-result cap or bounded preview set.
4. Deterministic TypeScript policy evaluates the complete facts. Missing/invalid authority fails closed with a stable internal issue code; it is never silently treated as a match.
5. Stage 3 displays the existing comparison table. If no alternative is returned, the saved evidence proves that the full category catalogue was evaluated and records bounded reason codes such as no strictly better complete candidate.
6. An operator reviews or edits a product through Intake/admin. The server validates the versioned bundle and calls `publish_catalog_product_v1`.
7. The database applies facts, protocols, and evidence transactionally; only a complete bundle can become active/recommended. A conflict, stale revision, category mismatch, missing fact, or protocol-scope error aborts the entire transaction and returns a stable operator-facing code.
8. During the compatibility release, the same transaction updates derived legacy projections. Shadow comparison reports only aggregate category/reason counters and operator-safe product diagnostics; it contains no user answer/profile data.
9. Repair tooling lists historical incomplete or divergent products without changing them. Each approved repair uses the same guarded write boundary and is re-audited.
10. After all ten categories have clean live audits, all consumers have used the canonical read path for at least seven consecutive production days, and semantic mismatch count remains zero for the monitored release, the separate contract change removes legacy arrays/text category, sync triggers, obsolete product-scoped guidance rows, duplicate Leave-in fit storage, and superseded matcher functions.

Recovery:

- read-path rollout is controlled by `CATALOG_AUTHORITY_READ_V1_ENABLED`; disabling it returns to the current reader while compatibility projections still exist;
- `CATALOG_AUTHORITY_SHADOW_COMPARE_ENABLED` can be disabled independently without changing behavior;
- publication failures leave the prior product bundle intact because the write is transactional;
- before the contract migration, an application rollback can still read legacy projections;
- after legacy columns are removed, rollback is forward-fix only unless a reviewed restoration migration is prepared. The contract migration therefore has its own explicit release approval.

## Planning evidence

No mockup or browser prototype is required because this plan deliberately preserves the existing user-facing comparison layout and behavior. The planning evidence is the static dependency map, live read-only schema/constraint audit, current Stage 3 loader/test inspection, historical migration authority comments, and the official PostgreSQL/Supabase guidance linked above.

Evidence review status: confirmed for the three target-state decisions; integration-journey sign-off confirmed on 2026-08-15.

## Ordered tasks

### 1. Freeze the authority contract and create a read-only audit oracle

Consumes: the confirmed ownership matrix and current ten-category contracts.

Produce `docs/catalog-authority.md`, the versioned TypeScript authority types/issue codes, and `scripts/catalog-authority/audit.ts`. The audit must inspect every product and report, by stable code:

- null/invalid canonical category;
- category-table row under the wrong product category;
- missing or duplicate one-row facts;
- empty/incomplete required multi-row matrices, retaining the deployed thickness non-applicability exemptions for Heat Protectant, Dry Shampoo, and Scalp Care;
- legacy-array/category divergence from the intended normalized source;
- exact-product protocol category/scope conflicts;
- overlapping product-scoped guidance authorities;
- missing provenance/fingerprint requirements for active recommended products;
- active/recommended products that fail the ten-category completeness matrix;
- orphan rows and missing supporting indexes/constraints.

The audit defaults to read-only, outputs a machine-readable JSON receipt plus a concise summary, and requires an explicit separately reviewed mode for any future repair tool. Add fixtures for all ten valid categories and every issue code.

Completion: the audit runs against fixtures and a read-only production snapshot; its row totals reconcile with direct table counts; no write method is reachable from the default command.

### 2. Add normalized shared eligibility and category identity constraints

Consumes: Task 1's ownership matrix and audit receipt.

Add `product_thickness_eligibility` and `product_concern_eligibility`, backfilled deterministically from current arrays and verified category tuple rows. Reconfirm the live origin domain and null/category counts at execution time, backfill a supported `category_key` for every `products` row, validate the existing two-value origin check, and add a `NOT VALID` global category non-null check for later validation. Add unique/composite keys, constant category columns, checks, indexes, and `NOT VALID` composite foreign keys with `ON UPDATE RESTRICT ON DELETE CASCADE`. Do not delete or rewrite legacy sources in this task.

For contextual category rows, assert that their thickness exists in normalized eligibility. For exact-product protocols, assert product/category identity. Add migration contract tests proving new keys, checks, indexes, grants, RLS/security, and `NOT VALID`/later-validation sequencing.

Completion: the migration applies on an ephemeral Supabase database; current production rows can be backfilled idempotently; post-backfill audit has zero orphan/category-identity/eligibility-reference mismatches. Application behavior is unchanged.

### 3. Repair historical authority and validate structural constraints

Consumes: Task 2's additive schema and Task 1 issue receipts.

Create explicit reviewed repair manifests, each with product ID, expected old fingerprint, intended canonical values, evidence, and expected new fingerprint. Execute them as category-bounded sub-slices (Shampoo/Conditioner, Leave-in/Oil, and the six remaining categories plus shared protocols), with a clean audit between sub-slices. Resolve wrong/missing category facts, merge non-conflicting Leave-in duplicates into `product_leave_in_specs`, make Leave-in/Oil eligibility explicit rather than legacy-trigger-derived, and reconcile product-scoped guidance into exact-product protocols. Conflicts must stop for human review; no last-write-wins merge is allowed.

Validate the global `products.category_key IS NOT NULL` check and new composite foreign keys only after the audit is clean, then set `category_key` globally `NOT NULL` and remove the redundant validated check. Enable universal category-identity protection. Preserve active visibility throughout unless a product is proven unsafe/incoherent and separately approved for deactivation.

Completion: every repair has a before/after receipt and evidence; the full live audit reports zero structural violations; all new constraints are validated.

### 4. Add the canonical private read model and TypeScript repository

Consumes: validated schema from Task 3 and authority contracts from Task 1.

Add `catalog_private` core/category/protocol views, explicit `USAGE`/`SELECT` grants, explicit revocation from `PUBLIC`, `anon`, and `authenticated`, the service-only `load_catalog_authority_v1` RPC, and the parsed TypeScript repository. Keep stable ordering, chunking, and complete pagination. Add query-shape tests for all categories, multi-row Shampoo/Conditioner/Oil/Leave-in cases, duplicate singleton rejection, by-ID reads, full-category reads above 500 rows, and schema-version/category/protocol mismatch failure.

Add repository performance evidence with the complete current catalogue and `EXPLAIN (ANALYZE, BUFFERS)` on representative largest-category and by-ID calls. Index only demonstrated access paths.

Completion: canonical repository facts and fingerprints match the existing Stage 3 assembler for every currently valid product; no canonical complete-category API contains the legacy limit of 12 or an implicit top-N cap.

### 5. Shadow and cut over Stage 3 without changing UX

Consumes: Task 4 repository.

Route `catalog-facts.ts` through a compatibility adapter that can execute both old and canonical reads. With shadow comparison enabled and canonical behavior disabled, compare sorted product sets, normalized facts, protocol status, fingerprints, fit verdicts, and alternative IDs for every decision review. Emit aggregate mismatch codes by category and retain a bounded operator diagnostic outside user payloads.

After zero fixture/staging mismatches and a clean all-product audit, enable canonical Stage 3 reads. Direct product capture, owned-product review, heat-carrier coverage, and alternative evaluation must all use the same repository. Delete the 12-row legacy candidate path rather than retaining it as a fallback. Search UI result caps remain presentation-only.

Completion: unit/integration/browser tests prove the existing table layout and decision flow; a >12-product fixture returns an alternative beyond position 12; every category evaluates the complete candidate set; flag rollback returns to the old reader without data loss.

### 6. Migrate every remaining read consumer

Consumes: Task 4 repository and Task 5 production evidence.

Migrate in independently reviewable groups:

1. legacy recommendation engine and category helpers;
2. chat matcher/product selection and product-list projections;
3. routine cadence/application exact-product reads;
4. admin/intake read views;
5. rewrite `personal_plan_search_assessment_products_v2` over canonical private views; prove the other legacy matcher/search functions have no source or live dependencies, then retire them.

Each group receives parity fixtures using real category shapes and a source-level guard that fails CI when production runtime code directly reads canonical storage tables outside the catalogue-authority package. Identity-only listings may read an explicitly documented safe identity projection; they may not read fit facts.

Completion: `rg` plus an automated import/query-boundary test shows no unauthorized runtime readers; chat/recommendation/routine regression suites pass, including `npm run test:chat` for slices that can alter chat product responses; obsolete SQL readers have no callers before removal.

### 7. Introduce the canonical transactional publication boundary

Consumes: Task 1 completeness contract and Tasks 2-4 schema/read contract.

Add `publish_catalog_product_v1`, stable failure codes, idempotency/fingerprint ledger behavior, optimistic concurrency, and the publication-last rule. Replace the existing publication assertion with the versioned completeness evaluator. Apply the hard gate to every new publication immediately.

Preserve the current publication gate's two intentional bypass semantics exactly: completeness is not asserted unless the product is an active curated catalogue row or is explicitly marked recommended, and a product with a `personal_plan_product_search_dispositions` row remains excluded from the assertion. Add parity fixtures for curated inactive, curated active, user-submitted non-recommended, explicitly recommended, disposition-excluded, and ordinary complete/incomplete products before replacing the old function.

Migrate Product Intake first, then admin routes, exact enrichment, supported seed/addition tools, and identity maintenance. Unsupported one-off backfill scripts are archived or changed to read-only manifests; they are not silently preserved as alternate write paths. Add a direct-write boundary test and explicit grants/revocations.

Completion: every supported writer proves atomic success, full rollback on each validation failure, idempotent retry, stale-write rejection, and exact read-after-write parity through `load_catalog_authority_v1`; no supported application path performs a direct category-table write.

### 8. Run the monitored compatibility release

Consumes: canonical reads/writes from Tasks 5-7.

Enable canonical reads for all consumers and keep legacy projections derived only by the publication boundary. Monitor for at least seven consecutive production days and cover all ten categories through real traffic or an exhaustive scheduled read-only audit. Required exit evidence:

- zero semantic shadow mismatches;
- zero category identity, orphan, and legacy-projection parity violations;
- zero unexplained partial/short catalogue reads;
- publication rejection codes reviewed and attributable to intended validation;
- every "no verified alternative" event confirms complete-catalogue evaluation and a bounded legitimate reason;
- canonical-read p95 latency no more than 20% above the measured old-reader baseline for the same load shape, and canonical-read error rate no more than 0.1 percentage points above that baseline.

Completion: a signed release receipt names counts, date range, all-category coverage, open exceptions (must be zero for contract removal), and the exact deployed commit/migration set.

### 9. Remove legacy authority surfaces in a separate contract release

Consumes: Task 8 signed zero-mismatch receipt and explicit production-migration approval.

Remove `products.category`, `products.suitable_thicknesses`, and `products.suitable_concerns`; legacy derivation/sync triggers; `product_leave_in_fit_specs`; reconciled product-scoped rows from `application_guidance_protocols`; obsolete matcher/search functions; and compatibility adapter code. Update generated database types, validators, admin forms, seed templates, and documentation.

Run a final dependency scan across source, migrations, function definitions, and API payloads before the destructive migration. Keep historical migrations immutable. Prepare a reviewed forward restoration migration before activation; do not rely on application rollback after the contract boundary.

Completion: no live object or source reference depends on removed fields/tables/functions; clean bootstrap and upgraded-database paths both pass; canonical read/write smoke tests and full catalogue audit pass after removal.

## Verification

Automated checks:

- focused Node tests for contracts, audit issue codes, repository pagination/cardinality, shadow parity, publication atomicity/idempotency, and consumer-boundary enforcement;
- `npm run test:personal-plan:nested` and the affected Personal Plan tests;
- `npm run test:node` for shared admin/catalogue/recommendation contracts;
- `npm run test:agent` and chat/retrieval checks when chat matcher or recommendation selection changes;
- `npm run typecheck`, `npm run lint`, and `npm run build` per implementation slice;
- `npm run test:playwright:personal-plan-stage3` for Stage 3 cutover slices;
- existing CI path-rule tests must continue to route migrations and Personal Plan runtime changes through the persisted journey gates.

Migration/live-state checks:

- clean bootstrap and upgrade apply on an ephemeral Supabase database;
- pre-migration read-only production audit and count reconciliation;
- idempotent backfill/repair dry runs with reviewed fingerprints;
- `NOT VALID` constraints prove new-write enforcement before historical validation;
- validation state, indexes, grants, RLS/view security, and function execution permissions verified from system catalogues;
- representative `EXPLAIN (ANALYZE, BUFFERS)` evidence for canonical reads;
- post-migration exhaustive audit of all products and all ten categories;
- production writes, feature activation, and legacy removal remain separate explicitly approved gates.

Manual/operator checks:

- inspect one valid, one intentionally incomplete, one multi-row, and one category-conflict fixture per relevant category;
- verify Intake/admin show stable actionable failure codes without partial writes;
- verify a category with more than 12 products can select a better alternative beyond the first 12;
- verify a true no-alternative case includes full-catalogue completion evidence and does not arise from missing facts or a read cap;
- confirm the Stage 3 comparison layout and German copy are unchanged on desktop and mobile.

Evidence-sensitive review:

- product-property repairs require existing catalogue provenance; this architecture change does not invent or infer missing hair-care facts;
- any unresolved semantic conflict is routed to product/domain review rather than resolved by schema migration logic;
- complete target-matrix alternative behavior remains covered for every category.

## Review and handoff

Implementation follows the ordered dependency chain above as separately reviewable, rollback-aware release checkpoints rather than one branch-wide migration. Tasks 4 through 9 are intentionally serial; they are not parallel work streams. Each slice uses a task worktree, `implementation-loop`, repository readiness checks, and whole-branch counterpart review before publication. Database migrations, deployment, production data repair, read-flag activation, write-boundary activation, and contract removal are separately receipted gates.

Artifacts:

- this plan: `commit` with the planning PR;
- `docs/catalog-authority.md`, contracts, migrations, tests, and audit tool: `commit` with their owning implementation slices;
- live read-only audit and rollout receipts: sanitize and `archive` under the owning PR/release evidence location;
- transient query output and counterpart-review reports: `discard` after verified findings are incorporated;
- repair manifests: `commit` only when they contain no secrets/user data and are required to reproduce catalogue corrections; otherwise archive in the approved private operational location.

Main rollout risks:

- hidden direct readers/writers outside the initial dependency map;
- semantic disagreement while merging duplicated Leave-in/protocol facts;
- long-running validation or poorly indexed canonical views;
- compatibility drift if any writer bypasses the publication boundary;
- premature legacy removal reducing rollback options.

These risks are addressed by the source boundary test, read-only audit oracle, explicit conflict stops, `NOT VALID` sequencing, query-plan evidence, shadow parity, grants/revocations, and a separate contract release.

Stop point: implementation may begin only after Nick confirms the integration/operator journey above. Publication, production migrations, activation, repair writes, and legacy removal require their own later authorization.
