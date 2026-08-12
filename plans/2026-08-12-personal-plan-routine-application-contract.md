# Personal Plan Routine and Anwendung Contract

**Status:** Approved for local implementation; no publication or production-write authorization
**Date:** 2026-08-12
**Branch:** `codex/personal-plan-routine-application-contract`

## Outcome

Make Stage 3 completion the single authoritative handoff into an already-computed Stage 4 Routine,
then make Stage 5 Anwendung render shared, versioned application techniques plus only the structured
product differences that materially change use.

The user-visible result is:

- Slice A keeps today's authoritative per-choice Stage 3 saves while fixing the Routine handoff.
- Stage 4 opens the computed Routine without a blocking source-sync request.
- Stage 5 loads every included exact product from that accepted Routine.
- Ordinary products use one reviewed category/application-family technique. A manufacturer wording
  variant cannot override it.
- Product-specific guidance exists only for a different order, state, contact time, rinse rule,
  heat rule, conditioner relationship, safety instruction, or treatment course.
- Cross-product directions such as “danach Conditioner verwenden” are composed from the actual
  Routine and never live as free text inside a shampoo protocol.

## Current evidence

### Stage 3 to Routine

- Stage 3 currently persists each mutation synchronously and can surface a transient `503` as a
  blocking interaction.
- Routine entry unconditionally invokes source synchronization and blocks confirmation while it
  runs.
- Initial Routine activation already settles the matching portfolio and included-product source
  events but leaves the matching refined-need source event pending.
- The consumer accepts only `user_product`; the surviving `refined_need` event is requeued and the
  route returns `409`, producing the observed loop.

### Anwendung content

Read-only production inventory on 2026-08-12:

- 273 active product-protocol rows covering 224 products.
- All 273 have a V1 JSON payload, German locale, non-empty steps, and matching product/category
  scope.
- Structural validity is therefore not the content-quality guarantee we need.
- 33 regular shampoo rows contain 30 distinct step sets; 29 target `all_hair` even though the
  reviewed shared technique is scalp-focused.
- 41 conditioner rows contain 35 distinct step sets.
- Only three shared active family protocols exist. The product rows use 21 distinct application
  families across 26 category/family combinations.
- The runtime adapter cannot produce several fact keys required by published protocols. Shampoo,
  conditioner, deep-cleansing, and styling currently receive no category facts; mask, oil, heat
  protectant, and scalp care spread raw partial specs; leave-in, bondbuilder, and dry shampoo use
  explicit adapters, but leave-in still disagrees with published namespaced requirement keys. Valid
  exact protocols can therefore resolve to a placeholder.
- Confirmed semantic defects include a leave-on scalp serum marked `rinse_out`, Epres with no rinse
  mode, K18 copy fixed to three pumps instead of the official 1–3 full-size range, and OLAPLEX No.0
  linked to No.3PLUS while its verified companion workflow names the discontinued No.3 Hair
  Perfector.

The complete copy decision set is recorded in
[`plans/evidence/2026-08-12-personal-plan-application-instruction-review.md`](./evidence/2026-08-12-personal-plan-application-instruction-review.md).

The reviewed surface is shown in
[`plans/mockups/2026-08-12-personal-plan-application-contract.html`](./mockups/2026-08-12-personal-plan-application-contract.html).

## Chosen architecture

### Owner tradeoffs resolved

- Ship the existing-server-authority handoff repair in this plan. A future single-final-save Stage 3
  redesign remains outside this plan because it changes resume, conflict, and persistence behavior.
- Build the shared-template contract now. A content-only rewrite would fix today's rows but would
  allow the same arbitrary manufacturer prose to return on the next intake.
- Keep every safety-sensitive category fail-closed through required typed product facts. Full exact
  prose remains mandatory only for the five reviewed composite workflows.
- Add only one new flag: V2 resolver selection.
- Treat the 1.5-second server p95 as a release SLO, not an observation.
- Preserve safety cautions now as allow-listed canonical steps generated from typed codes. A
  dedicated visual `Wichtig` slot is a later UI slice, not a dependency of the content contract.
- Use the reviewed V2 product pointer as the family selector, including disambiguation of today's
  combined `foam_or_liquid` catalog value; do not add another catalog enum solely for rendering.
- Show a day with one unresolved product as visibly partial while keeping its valid product cards
  usable. Do not silently omit the entire day.

### 1. One Stage 3 completion boundary

Close the current production defect without rewriting the ~4,000-line Stage 3 client: keep the
existing server-authoritative per-mutation saves, repair exact revision settlement, and make Routine
entry passive. This is an independently releasable reliability slice. The final Stage 3 continue
action calls one owner-scoped transaction that:

1. reloads the current canonical refinement and product draft revisions;
2. validates all required categories, roles, identities, and exact-product readiness;
3. writes the final accepted product portfolio;
4. compiles and activates one Routine version from that exact snapshot;
5. marks the matching refined-need, portfolio, and included-product source events consumed;
6. returns the activated Routine identity and revision.

Conflicts return the fresh authoritative snapshot and a typed reason. The client repairs from that
snapshot; it never blindly replays an old mutation.

### 2. Routine is a read surface

`/routine` loads the active Routine and renders it. It does not start initial synchronization and
does not block confirmation on an outbox consumer.

Later changes to an already-active plan still use source events. The existing Routine-entry sync
call remains as a fire-and-forget reconciliation kick after meaningful content renders; it never
blocks the page or confirmation. If a proposal is pending, the kick waits until that proposal is
accepted or rejected so it cannot stage a successor concurrently with the user's decision.
Product-acquisition mutations also schedule a best-effort post-commit drain. The outbox remains
durable if either attempt fails. A post-activation Stage 2 refinement is supported: mark its source
event `terminal_refinement_pending_stage3`, leave the active Routine unchanged, and let the user's
next completed Stage 3 selection enter the existing successor-proposal flow. It is never put into a
retry loop and never silently recompiles the accepted Routine.

### 3. Shared technique, structured product facts

`application_guidance_protocols` owns the reviewed German templates by:

```text
locale + category + semantic role + application family + template version
```

`product_application_protocols` remains mandatory and product-scoped because Stage 3 search and
curated-publication gates depend on that invariant. For ordinary products the row becomes a thin,
typed pointer to a shared family template and no longer owns arbitrary visible steps. It stores:

- application state and area;
- rinse mode;
- exact contact time or manufacturer-directed wait rule;
- amount rule when materially specified;
- heat activation, supported state, maximum claimed temperature, and reapplication rule;
- conditioner placement plus whether it is forbidden, optional, or required;
- a known composite treatment workflow identifier;
- bounded safety/caution codes and source evidence.

The compiler combines the shared template with those facts. It cannot render unreviewed product
prose. Existing product-scoped readiness gates stay fail-closed and are updated to validate the
pointer plus its required typed facts rather than a standalone visible step array.

The V2 product pointer's `applicationFamily` is the authoritative resolver input for that exact
product and role. The adapter injects it into family selection before candidate matching; it does
not try to infer family from a generic product format. This also disambiguates today's catalog
value `foam_or_liquid`: the reviewed pointer selects either `foam` or `liquid_to_dry`, backed by the
stored source evidence. Missing, unknown, or category-incompatible pointers fail closed. Every
multi-family category gets a direct resolver test.

V2 family templates live in `application_guidance_protocols` with `scope_kind =
application_family` and an explicit `contract_version = 2`. V2 product pointers and the five V2
exact workflows live once in `product_application_protocols.guidance_payload_v2`; V1 remains in
`guidance_payload`. The two tables are not alternative authorities for the same exact workflow.

### 4. Exact workflows are allow-listed

Full product-specific workflows are allowed only when parameter interpolation cannot express the
sequence. The initial allow-list is:

- Swiss-O-Par Teebaumöl two-pass treatment shampoo;
- Epres Bond Repair Treatment;
- K18 Leave-In Molecular Repair Hair Mask;
- OLAPLEX No.0 plus No.3 companion workflow;
- OLAPLEX No.3PLUS Complete Repair Treatment.

Every other current product uses a shared family template with zero or more typed parameters. The
current category-level exact requirements in `requiresExactProductGuidance` are replaced by
category-specific typed completeness rules: masks require time and conditioner policy; scalp care
requires rinse/state/caution facts; heat protection requires supported state and claim facts;
dandruff shampoo requires label-time and caution facts; pre-wash oils require time and rinse facts.
Those categories remain fail-closed without requiring bespoke visible prose. Refresh-day leave-in
and oil families also require an explicit compatible application state and area; absence or
contradiction remains a typed unresolved result rather than falling back to post-wash guidance.

### 5. One fact vocabulary

Promote the existing Stage 3 catalog fact vocabulary in
`src/lib/personal-plan/products/authority/catalog-facts.ts`, its Routine-facing projection in
`src/lib/routines/personal-plan/application/catalog-facts.ts`, the current application adapter in
`src/lib/personal-plan/routine/application-adapter.ts`, and the Stage 5 publication vocabulary in
`src/lib/product-intake/catalog-enrichment/stage5-protocols.ts` into one versioned contract.

The physical database-to-runtime adapter maps every category explicitly. Raw spec objects are never
spread into runtime facts, and protocol requirements use typed keys rather than arbitrary strings.

### 6. Fail-closed publication and rendering

Publication preflight proves, for each active product/role:

- its category and application family are supported;
- every required fact is available through an explicit runtime adapter or the reviewed V2 pointer;
- the product/family combination satisfies semantic invariants;
- exact-workflow products have a reviewed current workflow and evidence;
- ordinary products cannot publish visible bespoke steps;
- the composed German output contains no missing placeholders or contradictory ordering.

Runtime remains exact-first only for the allow-listed workflows. All other products resolve through
their shared family. Missing or contradictory safety-critical facts produce a bounded unresolved
card and a typed operator error.

The current V1 `cautions.max(0)` restriction remains. V2 accepts allow-listed caution codes and
compiles them into canonical ordered steps; arbitrary caution prose is never accepted. A dedicated
visual `Wichtig` slot is explicitly deferred.

## Data transition

Use expand, backfill, verify, contract:

0. Ship a behavior-neutral read-side split first. Add `contract_version` to
   `application_guidance_protocols`, set existing family rows to `1`, and make the family repository
   query explicitly select contract generation 1 or 2. Add `guidance_payload_v2` to
   `product_application_protocols`; its adapter continues to read `guidance_payload` unless V2 is
   selected. Test both read paths and prove the page ignores the other generation. Do not insert any
   active V2 content before this release is deployed.
1. V2 product payloads use `schemaVersion: 2`, distinct guidance keys, plus an allow-listed
   parameter schema; V1's
   `copyTemplateSchema` continues to reject `{{...}}`.
2. Backfill 100% of the active product-protocol snapshot from existing researched evidence into
   family + structured facts. Record the observed row and product counts in the artifact; the
   2026-08-12 planning snapshot is 273 rows across 224 products, not a permanent hard-coded count.
3. Generate a deterministic before/after report and require 100% semantic coverage of that pinned
   snapshot.
4. Activate the new resolver behind one dedicated resolver flag. V1 repository reads
   family `contract_version = 1` plus product `guidance_payload`; V2 reads family
   `contract_version = 2` plus product `guidance_payload_v2`. They can coexist without entering one
   candidate set. The existing Stage 5 flag still controls whether Anwendung exists; resolver
   rollback must not hide the page.
5. Keep V1 readable for rollback during the verification window. Insert V2 family rows with new
   guidance keys; the existing `application_guidance_protocols_active_immutable` trigger protects
   active family rows. Product rows add the separate V2 payload rather than replacing V1. Retire old
   keys only after verified cutover.
6. Remove ordinary-product visible step authority only in a later contract migration after every
   product-scoped pointer passes both Stage 3 search-gate definitions.

Migration files and backfill tooling may be implemented locally. Applying catalog changes or
migrations to production requires separate explicit authorization.

Because V2 uses new family rows and a separate product payload column, resolver rollback simply
ignores the V2 backfill; no destructive data reversal is required during the verification window.

## Implementation slices and stops

Slice A is a standalone reliability branch and PR. It does not wait for the Stage 5 content work.
Slices B–D form a separate content-contract branch and PR after the owner signs off on the reviewed
copy and journey. Stop after each slice for its focused tests and diff review; stop after Slice C for
the deterministic full-snapshot audit before any resolver integration.

### Slice A — Existing Stage 3 finalization and passive Routine entry

- Add failing transaction tests for the stale refined source event, concurrent revisions,
  idempotent finalization, and terminal unsupported-source handling.
- Extend initial Routine activation to settle the exact matching `refined_need` event.
- First finish unsupported active-plan source kinds at the service level with a named `terminal_*`
  outcome instead of the current requeued `unsupported_routine_source`; the existing SQL considers
  the `terminal_` prefix settled for that exact revision. Map other deterministic claim errors to
  typed terminal outcomes as well. Only after those tests pass, remove `entrySyncPending`
  confirmation/navigation gating. On an active Routine with no proposal,
  keep the entry call as a non-blocking post-render kick for later `user_product` work. With a
  pending proposal, defer that kick until the user accepts or rejects it, then invoke the kick from
  the successful resolution path and clear the per-visit latch. Add a concurrency test for both
  paths.
- Schedule the same best-effort drain after post-activation product-acquisition writes; preserve the
  durable outbox for retries.
- Add privacy-safe operation names for Stage 3 finalization, post-render reconciliation, and
  conflict recovery. Extend `src/lib/observability/personal-plan-application.ts` with a typed
  terminal-source reason and emit only plan ID, source kind, revision, and terminal code; the
  database `last_error_code` remains the durable operator ledger.
- A general retry-attempt cap/DLQ for genuinely transient infrastructure errors is not part of this
  bug slice. Record it as residual operational debt; this slice eliminates perpetual retries for
  deterministic source states without turning recoverable outages into terminal data loss.
- Use the existing Stage 4 release boundary for Slice A; do not add another Stage 4 flag.

### Slice B — Parameterized application facts and shared templates

- Land and deploy the behavior-neutral read-side generation filter before creating any V2 active
  row.
- Extend the existing typed contract only for template identity, allow-listed parameters, explicit
  hair-versus-scalp placement, maximum claimed temperature, caution codes, and workflow identity.
- Put the V2 Zod contract in a separate module with `schemaVersion: 2`; the family row's
  `contract_version` selects its generation and the product payload's own `schemaVersion` validates
  `guidance_payload_v2`. Use an allow-listed interpolation schema rather than weakening the V1 copy
  schema.
- Extend `PRODUCT_SELECT` and its `ProductRow` type for every required spec table, then build explicit
  adapters for all ten Personal Plan categories.
- Feed the V2 pointer's typed `applicationFamily` into the resolver before family matching. Cover
  standard versus targeted shampoo, leave-on versus rinse-off scalp care, post-wash versus refresh
  leave-in/oil, and all dry-shampoo forms. `foam_or_liquid` must resolve through its reviewed pointer
  and evidence, never inference.
- Disable the legacy exact heat-protection synthesis from raw `source_text` when the V2 resolver is
  selected. Verified heat behavior must come through the typed V2 facts; add a regression test
  proving manufacturer prose cannot regain visible authority through that adapter.
- Add shared German templates for every approved family in the review evidence.
- Make the compiler render from template + facts and compose cross-product sequence from the actual
  Routine.
- Retain full exact steps only for the five allow-listed workflows.
- Replace `requiresExactProductGuidance` category bans with the signed-off per-category typed
  completeness rules.
- Add a direct characterization suite for every current `requiresExactProductGuidance` branch
  before replacing it.
- Explicitly exclude `styling`: it is the eleventh schema category, is not a Stage 3 catalog
  category, and has no current protocol rows. Adding it is a separate category contract.

### Slice C — Catalog backfill and publication gate

- Generate a deterministic transformation artifact for 100% of the active snapshot from the
  current reviewed protocols and record its observed counts.
- Repair the known semantic defects by writing the separate V2 payload and inserting V2 immutable
  family rows; rely on the existing active-row immutability trigger. Flag any newly discovered
  contradiction for review.
- Update Product Intake/curated-catalog preflight to reject unproducible facts, ordinary bespoke
  prose, invalid conditioner policies, and unsupported family/category pairs.
- Keep and harden the product-scoped publication/search invariant: a thin pointer row plus complete
  facts satisfies it; a family template alone never does.
- Add `npm run personal-plan:application-audit`, whose success condition is 100% of the pinned active
  snapshot structurally and semantically composable, whose compiled visible output matches the V2
  resolver, with zero old ordinary exact rows selected and zero unreviewed exact workflows.
- Store the deterministic transformation as JSON under
  `data/catalog-enrichment/personal-plan-stage5-v2/`, with a sorted product/role key, source
  fingerprint, template key, typed facts, and before/after visible-step fingerprint. Review fails on
  a missing row, duplicate key, unknown fact, changed source fingerprint, or sixth exact workflow.

### Slice D — Anwendung integration, recovery, caution steps, and performance

- Select exactly one content generation per request. V2 suppresses every V1 ordinary-product exact
  payload and accepts only V2 pointer rows or the five V2 allow-listed exact workflows.
- Render confirmed shared or exact instructions; keep unresolved products visibly bounded.
- Convert repository/adapter validation from whole-page throws to per-product results so one bad row
  produces one unresolved card and one typed operator error.
- Treat `product_guidance_conflict` as an isolated involved-product failure. Preserve
  `incomplete_day` as a legitimate, visibly labelled partial-day state and do not report it as an
  operator error by itself.
- Extend the compiler to isolate failures by involved product: conditioner dependency failures mark
  the imposing treatment unresolved; contradictory non-default conditioner policies mark the
  contributing treatments unresolved; anchor conflicts/cycles remove and report only the involved
  blocks, then deterministically recompile the remaining day. A required unresolved role makes the
  day explicitly partial, not blank. Add tests for every day-level failure currently returned by
  `compileDay`.
- Compile allow-listed caution codes into normal ordered steps. Defer a visually distinct caution
  component.
- Add tests for the real Gliss fact-key mismatch, OGX canonical shampoo, conditioner composition,
  K18 sequence, masks with contact time, heat-state selection, and scalp rinse-mode contradiction.
- Expose the application loader's internal server-compute duration as a test-only response marker
  and extend `scripts/personal-plan/measure-read-only-transitions.mjs` plus the existing
  `bench:personal-plan-transitions` entry. Record a pre-change baseline, then run 30 navigations in
  fresh contexts sharing one disposable field-test storage state against the exact preview
  deployment and production-shaped catalog fixture. Fail when internal compute p95 exceeds 1.5
  seconds or meaningful-content p95 exceeds 2 seconds, and write the sample count, deployment SHA,
  environment, baseline, p50, and p95 to
  `plans/receipts/<date>-personal-plan-application-performance.md`.

## Verification

- Deterministic unit tests for Stage 3 finalization, source settlement, fact adapters, template
  selection, parameter interpolation, conditioner composition, and semantic invariants.
- SQL tests for idempotent activation, exact revision settlement, backfill completeness, and
  fail-closed publication.
- Exhaustive catalog audit: 100% of the pinned active snapshot composed; zero ordinary bespoke
  render paths; only the five reviewed exact workflows.
- Authenticated Stage 1 → 2 → 3 → Routine → Anwendung browser flow with all products loaded.
- Desktop and mobile rendering for ordinary, parameterized, exact, and unresolved cards.
- Repeated entry allows at most one terminalizing unsupported-source response and proves there is no
  `409` retry loop or blocking interaction.
- Production-shaped latency run reports server p50/p95 and meaningful-content timing.
- The repository workflow at `.agents/skills/ready-check/SKILL.md` and the repository review router
  run before any publication handoff; this is a Codex workflow, not an npm script.
- Concrete gates are `npm run ci:verify`, `npm run test:personal-plan`,
  `npm run test:personal-plan-stage5`, `npm run test:personal-plan-db`, and
  `npm run test:playwright:personal-plan-stage1-5`.

## Rollback and boundaries

- The accepted Routine remains immutable and is not rebuilt on Stage 5 page entry.
- V1 protocol data remains readable through the rollout window.
- The new resolver stays behind the existing Stage 5 rollout boundary until the exhaustive audit
  and journey verification pass, with a dedicated resolver rollback flag so Anwendung can remain
  visible on the old resolver. Both flags are environment booleans, so rollback requires an
  environment change and redeploy rather than an instant per-user switch.
- Only one new rollout boundary is introduced: the V2 resolver flag. Slice A uses the existing Stage
  4 boundary.
- Every database change lands in a new timestamped migration; no already-applied migration is edited.
- No commit, push, PR, migration apply, catalog write, deploy, or feature activation is included in
  the current approval.

## Owner gate

Nick approved the reviewed canonical copy, five exact workflows, and designed journey on
2026-08-12 with “Works, let's do it.” This authorizes local implementation and verification only;
the publication and production-write boundaries below remain separate.

## Designed user journey for sign-off

1. **Entry:** the paid user opens Stage 3 with the current Bedarf and refinement already loaded.
2. **Product decisions:** every required product/category is visible and choices save with the
   existing authoritative revision contract.
3. **Recoverable conflict:** if authority changed, the client receives the fresh canonical snapshot,
   explains that the plan was refreshed, and preserves only still-valid choices. It never replays a
   stale mutation blindly.
4. **Finish Stage 3:** one owner-scoped finalization validates every included exact product and
   saves the final portfolio. With automatic activation enabled, it compiles and activates the
   Routine and settles the exact initial source events. With automatic activation disabled, it
   creates the existing proposal; acceptance performs the same activation and exact settlement.
   A transient failure keeps the user on Stage 3 with the saved authoritative choices and a retry
   action.
5. **Routine entry:** after either activation path, Stage 4 renders the active Routine immediately. No initial source sync
   blocks meaningful content, confirmation, or navigation. A later post-activation acquisition may
   trigger fire-and-forget reconciliation; if a proposal is pending the kick waits for that decision.
   Failure remains in the durable outbox and does not create a `409` loop.
6. **Routine review:** the user confirms product order and cadence. Missing exact identities remain
   explicit and cannot become invented application guidance.
7. **Anwendung entry:** Stage 5 loads every included exact product from that accepted Routine and
   only the shared families relevant to it.
8. **Visible guidance:** ordinary products show the reviewed canonical category technique plus
   typed facts such as time or damp/dry state. OGX uses the ordinary shampoo technique. Cross-product
   steps name only products actually present in the Routine.
9. **Real exceptions:** Swiss-O-Par and the four bond treatments show their reviewed exact workflow.
   Coded cautions appear as canonical ordered steps.
10. **Recovery:** one incomplete or contradictory product becomes one bounded unresolved card while
    the remaining day is visibly marked `Teilweise verfügbar` and stays usable; telemetry names the
    exact product/role failure without exposing private content.
11. **Later refinement:** if the user returns to Stage 2 after activation, the current Routine stays
    active. The new refinement waits for Stage 3 completion, then uses the existing successor-
    proposal flow rather than silently replacing the accepted Routine.
12. **Completion:** the user can follow a coherent ordered day, return without recomputation, and see
    the same accepted Routine and application instructions until an explicit later plan change is
    accepted.
