# Complete product application use-case coverage

## Outcome

Every active Personal Plan product has executable German guidance for every applicable context. Every genuine Leave-in is available between washes with one grouped damp-and-dry choice: damp is recommended, while dry use is a lower-dose alternative adapted to product format and the customer’s weight tolerance. Every conventional leave-on finishing Oil receives the inverse presentation: dry use is recommended, while lightly dampened use is the alternative. A missing required pointer never reaches customers as “wird noch geprüft.”

Evidence:

- [Production coverage audit](./evidence/2026-08-14-application-guidance-coverage-audit.md)
- [Rendered journey mockup](./evidence/2026-08-14-application-guidance-journey-mockup.html)
- User report: Color WOW Money Mist rendered unresolved on `/anwendung/refresh_day` despite complete post-wash guidance.

Constraints: preserve Bedarf → refinement → exact products → Routine → Anwendung; final Routine remains product/category authority; distinguish product-specific claims from independently supported category-level technique guidance; only genuine leave-on products receive the universal rule; fail closed on missing product identity or invalid protocols.

Non-goals: no recommendation changes, medical/scalp claims, tracker changes, production migration, publication, deployment, or activation in this planning phase. Inactive-but-recommended legacy rows remain a separate catalog-hygiene issue.

## Corrected diagnosis and architecture

The immediate defect is the mismatch between broad Leave-in eligibility and product-specific protocol storage. Money Mist therefore reaches a false “missing guidance” state even though conservative between-wash technique guidance can be supplied at category level.

The existing Leave-in `application_stage` array is useful audit evidence but is not exact family authority. It mixes role-level facts such as `pre_heat` with physical-use facts such as `dry_hair`, and `towel_dry` can map to several families. It must not be used to guess exact protocols.

Chosen shape:

1. Keep the reviewed product manifest for product-specific post-wash, heat, and styling claims, and add separately sourced category policies: every genuine Leave-in receives damp and dry between-wash methods; every conventional leave-on finishing Oil receives dry and lightly dampened between-wash methods. Manufacturer silence does not negate either conservative category policy.
2. Extend the existing `personal-plan:application-audit` command instead of creating a second audit surface.
3. Gate the new behavior behind an explicit Stage 5 contract/feature switch. The compiler materializes both between-wash methods for every conventional Leave-in pointer, so future products inherit the rule without bespoke catalog rows.
4. Add multi-family storage only after the research manifest proves the required rows. A product is materialized per supported family, following the existing heat-occurrence fan-out pattern. On a day where the same product has both dry and damp methods, the UI groups them under one product step with explicit “Auf trockenem Haar” / “Nach dem Anfeuchten” alternatives rather than duplicating or arbitrarily prioritizing the product.
5. Extend family/category support and German templates where research confirms a real missing use, including `post_style` Leave-ins. Do not create a family merely because a stale catalog stage claims one.

Alternatives rejected:

- Persist two generic protocol rows for every Leave-in: duplicates category-level technique across the catalog and can drift for future products.
- Derive exact families from `application_stage`: the mapping is many-to-many and cannot be total without guessing.
- Store variants in opaque JSON: weakens SQL uniqueness and publication validation.
- Render two indistinguishable copies of one product on the same day: unclear to the customer and conflicts with current instance grouping.

## User journey to approve

1. Anwendung offers an Auffrisch-Tag whenever the accepted Routine contains a genuine Leave-in.
2. Money Mist and every other current Leave-in appear there once, with “Nach dem Anfeuchten (empfohlen)” followed by “Auf trockenem Haar.”
3. A genuinely multi-use product appears on every supported day with the instructions for that context.
4. If one day supports both dry and damp between-wash methods for the same product, one product step shows the two clearly labelled methods; the customer chooses the method matching their hair state.
5. If no Routine product supports a day, the day is absent from the overview.
6. If confirmed guidance is lost through unexpected data/runtime drift, a direct link to that affected day returns the existing whole-day `day_unavailable` recovery. Complete days remain available. Publication checks should prevent this state.
7. Active products never render the partial “wird noch geprüft” card.
8. A conventional finishing Oil appears once with “Auf trockenem Haar (empfohlen)” first and “Nach leichtem Anfeuchten” second. Pre-wash-only, scalp/rinse-out, and special heat protocols do not inherit this rule.

Evidence review: **confirmed by Nick on 2026-08-14**.
User-journey sign-off: **confirmed by Nick on 2026-08-14**.

Oil extension evidence review and exact journey sign-off: **confirmed by Nick on 2026-08-14** after reviewing the 26-product coverage audit, the dry-first presentation, and the special-protocol exclusions.

## Phase A — research authority and truthful omission

### A1. Turn the current audit into executable regression evidence

Extend `npm run personal-plan:application-audit` to report the exact active executable cohort and each missing, extra, ambiguous, unsupported, or blocked product/use combination. Counts are query results in the receipt, never hard-coded acceptance criteria.

Add red fixtures for Money Mist, a verified damp-and-dry Leave-in, a same-day dry/damp product, a post-style candidate, and a declared use with no guidance.

Checks:

- `npm run personal-plan:application-audit`
- `npm run test:personal-plan-stage5`

Stop gate: do not change runtime eligibility until the Leave-in manifest in A2 is complete and reviewed.

### A2. Research product-specific claims and the category-level between-wash policy

Recheck product-specific post-wash, heat, and styling claims against manufacturer sources first and reputable retailer sources only when necessary. Independently record the professional category evidence for conservative between-wash use. Product claims and category technique authority must remain visibly distinct.

Required named dispositions include Money Mist, the eight declared-stage mismatches, and the additional source-text candidates in the audit. Correct false category stages and upgrade weak secondary sources where possible.

Stop gate: an unresolved product-specific claim cannot create heat or styling guidance. A valid conventional Leave-in pointer still receives the separately supported generic damp/dry between-wash methods.

### A3. Ship guarded capability filtering

Introduce a reversible Stage 5 capability switch/contract version. For each genuine Leave-in, materialize any missing damp/dry between-wash methods from the reviewed professional policy before day relevance and exact-guidance resolution. The switch controls only universal category synthesis; independently researched exact product variants remain available when it is off, so disabling the rule cannot discard persisted guidance.

For confirmed active products, remove the partial unresolved card. A missing confirmed pointer fails only the requested day through the existing deep-link `day_unavailable` state and emits structured product/use telemetry. If capability filtering leaves no products for a day, omit that day from the overview.

Checks:

- `npm run test:personal-plan-stage5`
- focused page/state tests for omitted days and direct-link recovery
- desktop and mobile Money Mist journey

Phase A is complete when all 41 current Leave-ins—including Money Mist—render one grouped damp/dry refresh card, all 24 current conventional leave-on Oils render one grouped dry-first/damp-alternative between-wash card, future conventional products in both categories inherit the matching behavior, and the feature can be disabled without reverting a migration.

### A4. Extend the category policy to conventional finishing Oils

Treat an Oil pointer as conventional only when it is an ordinary leave-on lengths/ends use with semantic role `finish` or `leave_in`, leave-in rinse state, and no exact workflow, companion dependency, or runtime blocker. Materialize dry and lightly dampened between-wash methods behind the same reversible switch. Dry is the recommended Oil method; quantity adapts to catalog weight plus hair thickness/density. The same product appearing in more than one Routine role still renders once.

Do not generalize pre-wash-only oils, scalp oils, rinse-out treatments, or heat-only protocols. Heat protection remains an independently verified capability. Current and future conventional Oils inherit the rule from typed pointer authority rather than product-name or UUID rules.

Checks:

- current 26-Oil cohort audit with explicit conventional/special disposition;
- compiler tests for both `finish` and `leave_in` Routine roles, duplicate-role grouping, weight-sensitive copy, exceptions, and rollback;
- rendered Oil card in the approved journey mockup.

## Phase B — complete all verified multi-use guidance

### B1. Add explicit multi-family protocol identity

From the reviewed manifest, enumerate the exact additional rows required. Add a non-null `application_family` discriminator, backfill existing rows from validated V2 pointers, validate discriminator/payload equality, and replace uniqueness with `(product_id, category, role, application_family)` using an expand/backfill/validate/contract migration sequence.

Each new row must carry its own authored V1 guidance payload and bind to one reviewed V2 pointer in the final activation artifact; the migration deliberately leaves the V2 column null so content activation remains a separate gate. No second variant may reuse a payload whose instructions describe another physical use. Verify enrichment executor set-equality behavior before changing any product covered by an existing manifest.

Update the current adapter only where necessary: it already loads all rows. Fan out routine items per family in compiler V2, following `materializeHeatOccurrences`, rather than stamping several protocols onto one single-family item.

Checks:

- migration/index/constraint tests, including partial-backfill rollback
- V1 payload → V2 pointer fingerprint checks for every inserted row
- duplicate same-family rejection

### B2. Complete family templates and deterministic day presentation

Add category support and German templates only for research-confirmed families. Explicitly resolve `post_style` Leave-ins: either add verified `leave_in` support plus its template or correct the stale product stage.

Selection rules:

- different days select the family/families compatible with that day;
- one compatible family renders one normal product step;
- multiple compatible physical methods for the same product/day render one grouped product step with labelled alternatives;
- no hidden priority rule discards a verified use;
- duplicate indistinguishable variants are a catalog error.

Checks:

- compiler/resolver tests for cross-day and same-day multi-use
- browser fixture showing wash use, dry refresh, damp refresh, and post-style when supported

### B3. Gate Product Intake and publication

Update intake and deferred publication validation so every manifest-confirmed use has exactly one valid payload/pointer, and missing, extra, blocked, mismatched, or duplicate variants fail before curated activation.

Then run the extended audit across the refreshed active executable cohort in all ten current categories. The nine categories without a detected structural gap still require zero-anomaly proof against their current declared authority. Any newly discovered category ambiguity becomes a researched manifest extension, not a generic inference.

Checks:

- Product Intake tests for supported, unsupported, missing, duplicate, stale-source, and mismatched-family cases
- `npm run personal-plan:application-audit`
- `npm run test:personal-plan-stage5`
- `npm run ci:verify`
- full Stage 3 → Routine → Anwendung browser journey

Phase B is complete when the refreshed active cohort has zero coverage blockers and every verified multi-use product has complete context-specific guidance.

## Live-state and release gates

- Refresh `information_schema`, constraints, indexes, active cohort IDs, and content fingerprints immediately before migration work.
- The reviewed baseline remains separately fingerprinted at 272 rows. The final activation artifact contains 289 exact product/application-family rows: the baseline plus 18 reviewed inserts and one correction. Preflight and both guarded executors bind by `(product, category, role, application_family)`.
- Apply order is explicit: schema/data migration first (new exact V1 rows only), then the separately authorized 289-row V2 artifact activation, then the separately authorized category-coverage switch. Disabling the switch removes universal synthesis but retains exact researched variants.
- Migration apply, catalog publication, deployment, contract activation, monitoring, and cleanup each require separate explicit approval.
- After an approved apply, re-read the exact cohort, parse/compose all pointers, run authenticated production journeys, and retain the rollback switch until the observation gate passes.

## Target map

- Research authority: `data/catalog-enrichment/personal-plan-stage5-v1/exact-bundles/` plus a versioned Leave-in use-case manifest modelled on `protocol-research.schema.json`.
- Audit: `scripts/product-intake/catalog-enrichment/stage5-v2-generate.ts` and its current package script.
- Runtime: `src/lib/routines/personal-plan/application/compiler.ts`, `compiler-v2.ts`, `guidance-resolver.ts`, catalog facts, application adapter, and Stage 5 access switch.
- Families/templates: `contracts-v2.ts`, `shared-templates-v2.ts`, and builder validation.
- Intake/publication: category validators, spec readiness, protocol operations, deferred publication trigger, generated types, and affected enrichment executors.
- Verification: focused compiler/resolver/intake/migration tests and Personal Plan browser journeys.

## Review and handoff

- Worktree: `.worktrees/application-guidance-coverage`
- Branch: `codex/application-guidance-coverage`
- Counterpart review: completed; the original single-phase, category-fact-derived design was rejected and the Phase A/B split above incorporates the verified findings.
- Implementation started through `implementation-loop` after Nick confirmed the rendered evidence and exact journey on 2026-08-14.
- Plan, audit, mockup, reviewed manifests, migrations, and tests are durable PR artifacts. Transient reviewer output and local query captures are discarded after reconciliation.
