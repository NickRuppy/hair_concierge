# Personal Plan curated catalog completion

**Status:** review-ready offline; S5-21 approved and all production actions pending
**Branch:** `codex/personal-plan-curated-catalog-completion`
**Base:** `b88268e0994a6705f364bdca6aa6925fd0729731` (`origin/main` after PR #368)

## Outcome and source context

Every currently active Chaarlie-curated Personal Plan product is deterministically
assessable and executable from Stage 3 through Routine and Anwendung. Product-data
completeness is independent from user-specific fit: a complete product can be an
ideal fit, supportive, or a known mismatch, but it is never labelled as awaiting
analysis merely because it does not match the current owner.

The production audit on 2026-08-11 found 243 active curated products that belong
to the supported categories. Exact research completed 224 of them. The other 19
are now an explicit, prepared Personal Plan search-disposition set: ten are
wrong-category, duplicate, or non-hair records, one has ambiguous identity, and
eight lack enough exact finished-product evidence. They remain untouched in the
broader catalog and existing owner history, but cannot be newly discovered in
Stage 3 after the disposition set is approved and applied. Five existing Deep Cleansing shampoos had complete
category-specific fact rows but a null `products.category_key`; Nick explicitly
approved repairing and including them after that defect was discovered. Fifteen
Heat/Scalp products already have exact legacy
product-protocol coverage, while 34 Masks have canonical exact protocol payloads.
The remaining catalog requires exact protocol enrichment, a typed Mask/Leave-in
readiness correction, canonicalization of the legacy exact rows, or a combination
of those changes. Fourteen active user-submitted products are explicitly outside
this completion cohort.

The approved source decisions are:

- complete every launch-eligible product in the frozen 243-product source cohort,
  including the five existing miscategorized Deep Cleansing products;
- keep the 19 audited exceptions out of new Personal Plan discovery through an
  explicit scoped disposition rather than weakening exact evidence or changing
  global catalog visibility;
- use exact, product-specific, source-backed evidence only;
- do not use brand-family or generic category fallbacks for this launch gate;
- repair the category identity of the five existing Deep Cleansing products;
  do not add any net-new products;
- defer user-submitted enrichment, while preventing those products from leaking
  into global catalog search.

## Chosen direction

Use one versioned, context-free curated-product readiness contract as the source
of truth for search and publication. The contract verifies category facts plus
every exact application role required by that product. Owner-specific authority
then evaluates the complete facts as ideal, supportive, or mismatch.

Keep the existing Stage 3 `pending_analysis` experience for genuinely incomplete
or newly submitted products, but require a durable analysis/enrichment record for
that state. Curated products may not pass the global publication gate in that
state.

Extend the existing replay-safe Stage 5 protocol research/apply format instead of
creating a second catalog writer. Each category receives a frozen curated cohort,
source-backed research manifests, deterministic fingerprints, a read-only
preflight, and an explicitly authorized apply step.

## Scope and non-goals

In scope:

- context-free product readiness and separate owner-specific fit;
- exact role/protocol completeness for all 224 launch-eligible curated products;
- an auditable Personal Plan-only disposition for the 19 researched exceptions;
- typed Mask and Leave-in readiness and authority loading;
- global curated search plus owner-only user-submitted inventory;
- Product Intake and database enforcement that prevents future curated products
  from becoming globally active without a complete exact bundle;
- replay-safe category research/apply batches and production verification queries;
- Stage 3, Routine, and Anwendung regression/browser coverage.

Non-goals:

- enriching the fourteen current user-submitted products;
- adding net-new Deep Cleansing products or changing category taxonomy beyond
  correcting the five existing null category keys;
- using application-family, brand-family, or generic guidance as a substitute for
  exact product evidence;
- changing the approved Stage 3 visual design or German copy from PR #368;
- activating rollout flags, applying production data, deploying, committing,
  pushing, or opening a PR without a later explicit authorization.

## Authoritative cohort and roles

The implementation must refresh and freeze the production cohort before building
manifests. The last audited category counts were:

The reviewed sanitized cohort is frozen in
`data/catalog-enrichment/personal-plan-stage5-v1/curated-cohort-2026-08-11.json`
with SHA-256 fingerprint
`1c56268a721201a573b374269df3df6d4dce14780abd7db07eeda48e4ca95006`.

| Category | Frozen cohort | Exact-ready | Prepared dispositions |
|---|---:|---:|---:|
| Shampoo | 49 | 48 | 1 |
| Conditioner | 43 | 41 | 2 |
| Leave-in | 42 | 41 | 1 |
| Mask | 34 | 34 | 0 |
| Oil | 41 | 26 | 15 |
| Dry Shampoo | 10 | 10 | 0 |
| Bondbuilder | 4 | 4 | 0 |
| Heat Protection | 7 | 7 | 0 |
| Scalp Care | 8 | 8 | 0 |
| Deep Cleansing | 5 | 5 | 0 |
| **Total** | **243** | **224** | **19** |

Required exact roles remain owned by the canonical Personal Plan role/category
contract. A product with multiple supported roles needs one verified exact payload
per executable role; a role may not inherit another role's steps implicitly.

## Target map

- Stage 3 search/readiness:
  `supabase/migrations/*personal_plan_stage3_search*`,
  `src/lib/personal-plan/products/stage3-persistence-supabase.ts`,
  `src/lib/personal-plan/products/production-persistence-gateway.ts`,
  `src/lib/personal-plan/products/authority/**`.
- Application protocols:
  `src/lib/routines/personal-plan/application/**`,
  `src/lib/personal-plan/routine/application-adapter.ts`,
  `public.product_application_protocols` and the existing exact-protocol executor.
- Product Intake prevention:
  `src/lib/product-intake/category-validators.ts`,
  `src/lib/product-intake/spec-readiness.ts`,
  `scripts/product-intake/**`, and an additive guarded approval/publication RPC.
- Research/backfill:
  `data/catalog-enrichment/personal-plan-stage5-v1/**`,
  `src/lib/product-intake/catalog-enrichment/stage5-protocols.ts`,
  `scripts/product-intake/catalog-enrichment/stage5-protocol-*.ts`, and replay-safe
  SQL executors/tests.
- Verification:
  focused Product Intake, Stage 3, Stage 4/5, migration, pgTAP, and Playwright
  suites under `tests/` and `supabase/tests/`.

## Designed user journey

Actor: a paid Personal Plan owner entering Stage 3 with an existing curated
product.

1. The owner searches by brand, line, or product name and sees the complete
   canonical identity.
2. Every curated result is immediately assessable. Selecting it gives immediate
   selection feedback and keeps frequency editable until explicit continuation.
3. The product assessment is either a clear fit/supportive result or an explained
   mismatch compared with the ideal category profile. A profile mismatch never
   masquerades as missing catalog information.
4. If kept, the exact product and cadence transfer to Routine. If rejected or
   uncovered, the existing explicit Stage 3 actions remain available.
5. Routine compiles non-empty, exact product application steps into Anwendung.
6. New or owner-submitted products may still show the existing temporary analysis
   state, but they are owner-scoped and backed by a durable enrichment task.
7. Network, persistence, or analysis errors retain the existing retry/recovery
   behavior from PR #368; no curated product silently disappears or becomes
   executable without complete data.

Completion: the owner can move from exact product selection to a populated
Routine and Anwendung without any curated product entering a fake waiting state.

**Journey sign-off:** confirmed by Nick on 2026-08-11 with “ok lets go”.

## Planning evidence

No new layout, copy, timing pattern, or interaction is introduced by this plan.
It completes the backend/data contract behind the already reviewed PR #368 Stage
3/Routine experience. The existing rendered decision evidence is
`plans/mockups/2026-08-11-personal-plan-world-class-ux-v5.html`; the accepted
journey keeps that surface unchanged and replaces false pending states with the
fit or mismatch result the UI already renders.

Evidence review status: confirmed. No additional mockup is required for this
backend/data completion slice.

## Ordered tasks

### 1. Freeze the curated cohort and define readiness V1

Consumes: live read-only product/spec/protocol inventory and canonical role map.
Produces: a versioned curated cohort artifact and one context-free readiness
result with bounded reason codes.

- Refresh active curated products from production and assert the exact 243-row
  frozen source scope or stop on drift.
- Define completeness from category source facts and all required exact roles;
  exclude owner profile inputs from the completeness result.
- Define separate fit outcomes and reason codes so known profile mismatch cannot
  become `missing_required_spec`.
- Preserve fail-closed behavior for genuinely absent or ambiguous evidence.

Completion criterion: focused tests prove that a complete-but-nonmatching product
is assessable/mismatch, while an actually missing fact or protocol is pending.

### 2. Make search origin-safe and consume readiness

Consumes: readiness V1 and curated/user-submitted origin contract.
Produces: global curated search plus owner-scoped owned inventory.

- Restrict global Stage 3 catalog search to active curated products.
- Keep the owner's already-linked user-submitted products available through the
  owner inventory path rather than the global catalog result set.
- Return canonical identity, completeness status, and bounded reason codes from
  one set-based query without per-row spec calls.

Completion criterion: tests prove another user's submitted product cannot appear
in global search, the owner can still recover their own product, and search
latency remains within the existing p95 gate.

### 3. Complete Mask and Leave-in typed contracts

Consumes: current category tables, exact product protocols, and owner authority.
Produces: complete typed fact bundles and fit evaluation for both categories.

- Replace the deliberate hard-false search branches with category completeness
  predicates derived from the facts actually required by their evaluators.
- Resolve all valid source rows semantically; do not assume one-row tables where
  the schema permits multiple rows.
- Keep unknown facts non-executable and ensure every allowed decision is derived
  from server authority.

Completion criterion: complete Mask/Leave-in fixtures are ready and evaluable;
missing facts remain pending; mismatch, override, and uncovered actions remain
server-authoritative.

### 4. Enforce complete curated publication

Consumes: readiness V1, exact protocol payload schema, and Product Intake category
operations.
Produces: one transactionally enforced curated publication boundary.

- Extend category validators and readiness matrices to require exact protocol
  roles and canonical `guidance_payload` for every curated category.
- Update the approval/publication RPC to validate the whole category bundle,
  persist the payload, and reject partial curated activation.
- Route promotion and legacy curated import paths through the same gate or keep
  rows inactive until the gate passes.
- Permit deferred user-submitted handling only through an explicit owner-scoped
  pending state; do not weaken the curated gate.

Completion criterion: mutation tests show removal of any required spec, role, or
payload makes curated publication fail atomically with no active partial product.

### 5. Research and build exact category manifests

Consumes: frozen cohort, official/manufacturer or reputable retailer sources, and
the existing exact protocol schema.
Produces: validated source-backed manifests and fingerprints for every required
product/role.

- Reuse already reviewed Mask, targeted Shampoo, Bondbuilder, Oil, and Dry
  Shampoo evidence only after identity/source freshness validation.
- Research the remaining Shampoo, Conditioner, Leave-in, and Oil cohort product
  by product; no family fallback is permitted.
- Record exact source URL, checked date, evidence excerpt as structured facts,
  cadence, placement, application state, rinse/contact behavior, and canonical
  German steps.
- Canonicalize the fifteen already-exact Heat/Scalp rows into the same versioned
  payload shape after proving parity with their existing structured directions.
- Escalate any product whose exact directions cannot be verified; do not fabricate
  or silently substitute guidance.

Completion criterion: manifest validation covers all 224 exact-ready products
and every required role, while the remaining 19 frozen-cohort rows are bound to
the explicit Nick-approved S5-21 Personal Plan-only disposition artifact. No
exception is hidden or filled with inferred evidence.

### 6. Prepare replay-safe guarded backfill

Consumes: validated manifests and exact product IDs.
Produces: dry-run/preflight artifacts and additive replay-safe executors.

- Extend the existing Stage 5 batch executor rather than adding a second writer.
- Bind batch ID, content fingerprint, reviewed head, product identity/category,
  existing-row conflict detection, and exact unrelated-row preservation.
- Add pgTAP tests for apply, replay, conflict, partial failure rollback, privileges,
  and cohort drift.

Completion criterion: disposable database tests prove byte-stable replay and
atomic refusal on identity, cohort, fingerprint, or content mismatch.

### 7. Verify the complete offline tree and guarded production plan

Consumes: all code, manifests, migrations, and test fixtures.
Produces: a review-ready receipt and a separate production-apply checklist.

- Assert 224/224 launch-eligible curated completeness and exact membership of
  the 19 prepared dispositions from the frozen cohort.
- Assert zero curated `pending_analysis` results caused by missing catalog data
  across representative category/role/profile matrices.
- Assert complete-but-unsuitable products produce known mismatch.
- Compile non-empty exact Anwendung steps for every curated product/role.
- Run full Stage 3 → Routine → Anwendung browser tests only after the entire
  offline cohort passes.
- Measure set-based search performance against p95 <= 500 ms and no worse than
  10% over the recorded server-side baseline.

Completion criterion: ready-check and code review report no blocking findings for
the exact content fingerprint. Production apply, flags, and field testing remain
separate authorizations.

## Verification

Automated:

- focused red/green unit tests for readiness-versus-fit and origin scoping;
- Product Intake validator/approval/promotion tests;
- authority and application adapter/compiler category matrices;
- research manifest/fingerprint/preflight tests;
- Supabase migration source tests and pgTAP executor contracts;
- repository typecheck, lint, build, `git diff --check`, relevant Personal Plan
  suites, and the production-shaped Stage 1–5 Playwright journey.

Manual/browser:

- search a ready ideal product and a complete known mismatch;
- verify complete identity and immediate selection/frequency feedback;
- verify no curated result shows temporary analysis because data is missing;
- verify exact Routine transfer and non-empty Anwendung on mobile and desktop.

Migration/live-state checks (read-only until separately authorized):

- exact local/remote migration ledger and dry-run scope;
- cohort count and fingerprints;
- readiness and protocol coverage by category/role;
- executor preflight and privilege/security inspection;
- server-side search p95 and query-count proof.

## Review and handoff

- Main session owns architecture, integration, production safety, final diff,
  verification, and findings adjudication.
- Explorers may map evidence/contracts; workers receive disjoint write scopes and
  must not revert concurrent edits.
- The configured Claude counterpart lane is intentionally skipped because Nick
  explicitly requested no further Claude review for this work. The repository's
  normal code-review router still runs on the complete branch.
- Durable plan, cohort, research manifests, migrations, tests, and receipts are
  commit candidates. Transient logs, generated previews, credentials, and CLI
  link metadata are discarded.
- Stop point: verified review-ready worktree. Commit, push, PR, migrations,
  production backfill, flags, deployment, and cleanup each require explicit
  later authorization.
