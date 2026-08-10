# Personal Plan Stage 5 catalog and protocol completion

**Status:** completion program and current cohorts implemented; catalog research/apply remains gated

## Outcome

Turn the already-deployed Stage 5 application surface from a truthful partial
experience into exact guidance wherever the category authority requires it,
without re-researching products that are safely covered by an approved
application-family fallback.

## Scope

This plan owns:

- a frozen read-only production cohort;
- category-specific catalog/protocol batches;
- preservation of the eight reviewed Scalp Care manifests from draft PR #345;
- an explicit rollout decision and reconsideration gates;
- a current-state receipt that supersedes stale status summaries without
  rewriting their historical evidence.

It does not authorize a database/catalog apply, Storage upload, migration,
deployment, feature-flag change, public rollout, or deletion of old PRs.

## Architecture decision

Stage 5 has two protocol authorities:

1. `application_guidance_protocols` owns conservative category/application-family
   fallbacks. Production currently has active families for ordinary Shampoo,
   Conditioner and Leave-in.
2. `product_application_protocols` owns exact finished-product directions and
   overrides a family fallback when timing, order, rinse behavior, cadence,
   compatibility or a specialized treatment matters.

Therefore `0 exact protocols` is not itself a blocker for ordinary Conditioner
or ordinary Shampoo. The category decision files, not a global completeness
percentage, decide whether a fallback is launch-capable.

## Implemented artifacts

- `data/catalog-enrichment/personal-plan-stage5-v1/current-cohorts.json`
- `data/catalog-enrichment/personal-plan-stage5-v1/batch-registry.json`
- `data/catalog-enrichment/personal-plan-stage5-v1/scalp-candidates/*.json`
- `tests/personal-plan-stage5-catalog-program.test.ts`
- `plans/receipts/2026-08-10-personal-plan-current-state.md`

## Execution order

### Phase 0 — already complete

- Core application families: Shampoo, Conditioner, Leave-in.
- Exact Heat coverage: five of five active recommended products.
- Reusable post-payment QA owner: merged in PR #356.

### Phase 1 — first blocking research batches

1. Mask: all 35 current products need critical contact-time and Conditioner
   sequence verification before exact recipes.
2. Targeted dandruff Shampoo: the eight current `schuppen` products need exact
   initial/maintenance and contact-time authority; everyday Shampoo remains on
   its safe family fallback.
3. Bondbuilder: exact primary protocols for Epres, K18 and No.3PLUS; No.0 stays
   companion-only.
4. Oil: select the smallest cohort covering every supported role and launch
   target, rather than researching all 41 products without a coverage reason.
5. Dry Shampoo: verify all ten canonical specs and add guidance families per
   supported format.

### Phase 2 — missing catalog cohorts

1. Deep Cleansing: research the five agreed Drogerie products and add Reset-role,
   scalp-target and exact protocol rows.
2. Scalp Care: refresh the eight reviewed manifests and assets, then construct a
   Scalp-only guarded package. Do not replay the mixed Heat/Scalp executor from
   PR #345 because Heat is already live.

### Phase 3 — guarded apply and verification

For each batch independently:

1. refresh identity, duplicate, commercial, image and protocol evidence;
2. bind Nick's review to the refreshed content fingerprint;
3. run a non-writing preflight against production;
4. request explicit apply approval for that exact batch;
5. apply only the required migration before the catalog operation, when one is
   needed;
6. verify products, specs, protocols, assets, row counts and unrelated-row
   preservation;
7. run the authenticated persisted journey and a field-test walkthrough.

### Phase 4 — rollout reconsideration

Broad Stage 5 rollout remains `no_go`. Reconsider only when:

- the externally reported walkthrough bugs have a deployed-fix retest;
- every priority-one batch passes its category gate, or the affected category is
  deliberately held out without presenting partial guidance as exact;
- a production field-test walkthrough is clean;
- Nick separately authorizes the exposure change.

## Verification contract

- Registry tests prove exact cohort counts, product-ID uniqueness, ten-category
  coverage, eight preserved Scalp manifests, and the non-activated rollout state.
- `npm run test:personal-plan` must stay green.
- Typecheck, lint and `git diff --check` must pass on the exact review tree.
- Publication uses a draft PR. Merge, deploy, catalog apply and exposure remain
  later gates.
