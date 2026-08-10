# Personal Plan Stage 5 catalog and protocol completion

**Status:** exact-product research and guarded existing-product protocol path implemented; unresolved product/policy gates remain explicit

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
- exact research manifests for Mask, targeted dandruff Shampoo, Bondbuilder,
  Oil and Dry Shampoo;
- five Deep Cleansing protocol templates and a Scalp commercial/asset refresh;
- an additive exact-protocol schema expansion plus a service-role-only,
  existing-product batch executor and dry-run preflight.

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
- `data/catalog-enrichment/personal-plan-stage5-v1/protocol-research/*.json`
- `data/catalog-enrichment/personal-plan-stage5-v1/deep-cleansing-candidates.json`
- `data/catalog-enrichment/personal-plan-stage5-v1/scalp-refresh.json`
- `supabase/migrations/20260810181837_personal_plan_stage5_exact_product_protocols.sql`
- `supabase/migrations/20260810185520_personal_plan_stage5_protocol_batch_executor.sql`
- `supabase/migrations/20260810192233_personal_plan_stage5_family_day_coverage.sql`
- `scripts/product-intake/catalog-enrichment/stage5-protocol-{research,preflight,apply}.ts`

## Execution order

### Phase 0 — already complete

- Core application families: Shampoo, Conditioner, Leave-in.
- Exact Heat coverage: five of five active recommended products.
- Reusable post-payment QA owner: merged in PR #356.

### Phase 1 — research result

1. Mask: 5 exact protocols verified; 30 remain blocked on silent/ambiguous
   Conditioner sequencing. The recommended shared fallback still needs Nick's
   sign-off.
2. Targeted dandruff Shampoo: 7 exact protocols verified; DERMAXPRO remains
   blocked because its exact page provides no application direction.
3. Bondbuilder: all 4 primary/companion protocols verified.
4. Oil: OLAPLEX No.7 verifies damp and dry use. The sampled fine/normal/coarse
   pre-wash rows are body/food oils without exact hair instructions; pre-wash
   coverage and a coarse leave-on/finish candidate remain blocked.
5. Dry Shampoo: 9 exact format protocols verified; got2b Liquid-to-Dry remains
   blocked on identity/commercial refresh.

### Phase 2 — missing catalog cohorts

1. Deep Cleansing: all five agreed product protocols, Reset roles and scalp
   targets are researched. None can enter the catalog until its identity,
   preferred purchase source, price and final image package is complete.
2. Scalp Care: seven commercial pages return 200 and one is anti-bot protected;
   the eight approved manifests remain intact. None of their reviewed image
   files exists in this worktree, so a Scalp-only apply is blocked.

### Phase 3 — guarded apply and verification

For each batch independently:

1. refresh identity, duplicate, commercial, image and protocol evidence;
2. bind Nick's review to the refreshed content fingerprint;
3. run a non-writing preflight against production;
4. request explicit apply approval for that exact batch;
5. apply only the required migrations before the catalog operation, when they are
   needed;
6. verify products, specs, protocols, assets, row counts and unrelated-row
   preservation;
7. run the authenticated persisted journey and a field-test walkthrough.

The current PR completes research, guarded tooling and local database proof. It
does not run a production preflight because production does not yet have the
three additive migrations. The third migration versions the immutable ordinary
Shampoo and Conditioner guidance so those products can compile inside
intensive-care, bond-repair and clarifying days. After a separately authorized migration-first step,
the non-writing preflight is the next production action. Any exact
catalog/protocol write still requires an explicit named-batch approval and
fingerprint from Nick.

Current reviewed research fingerprints (recompute after any manifest edit):

| Batch | Rows | SHA-256 |
|---|---:|---|
| `S5-02-mask-critical-protocols` | 5 | `004dbf9b6f7162dc32f18f6390b35f49846b56a0fdb968af5ee48c5447dc174e` |
| `S5-03-targeted-dandruff-shampoo` | 7 | `dde059bc1d01f053ce62abc807564c32501caafa5bb93c64b968711d5daea442` |
| `S5-04-bondbuilder-primary-protocols` | 4 | `bb7d6b9d70b51888477d89a471d0588b674f57ef2798a54ebbd263d26d1f9249` |
| `S5-05-oil-role-coverage` | 2 | `7456cdbfed1a64f0516a9ad915a52f6b4c493e9fe7af45e576c8f3b4488988bb` |
| `S5-06-dry-shampoo-format-guidance` | 9 | `fb848c132cb97c11af2cd17ee46b86a93735d7abbedc9a2654c1b69b4608cdfe` |

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
- The production-shaped disposable database harness must apply both new
  migrations and pass the executor pgTAP contract.
- Publication uses a draft PR. Merge, deploy, catalog apply and exposure remain
  later gates.

## Verification receipt

- `npm run test:personal-plan`: 1,024 passed.
- `npm run test:node`: 3,372 passed.
- `npm run test:personal-plan-db`: 257 passed across 10 files, including the
  exact-protocol executor apply/replay/security contract.
- Focused Stage 3/5 protocol tests: 43 passed; research validator reports 27
  verified and 36 explicitly blocked rows across five manifests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with four pre-existing warnings and zero errors.
- `PERSONAL_PLAN_APP_V1_ENABLED=false npm run build`: passed.
