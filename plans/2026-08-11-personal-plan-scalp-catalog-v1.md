# Personal Plan Scalp catalog v1 implementation plan

**Status:** approved for implementation by Nick on 2026-08-11
**Base:** fresh `origin/main` at `506bd05b`
**Outcome:** prepare the eight already-reviewed Scalp Care products as a narrow, guarded catalog batch without reintroducing the already-live Heat cohort or changing Personal Plan runtime policy.

## Scope and decisions already settled

- Exact cohort: the eight approved Drogerie-row Scalp Care manifests from `personal-plan-launch-v1`.
- Reuse the exact data and final images Nick already reviewed; refresh only live identity/commercial facts that have drifted. On 2026-08-11, The Ordinary's official German PDP replaced the Flaconi PDP as the current commercial source for `the-ordinary-multi-peptide-hair-density-serum`: exact 60 ml, EUR 26.50, available/add-to-cart, checked at `2026-08-11T08:26:31Z`.
- Every product is a new `scalp_care` catalog product and must carry its exact approved `product_scalp_care_specs` row plus application protocol rows.
- Keep this independent of the broader Stage 5 protocol work in PR #357. Its eight candidate manifests are byte-identical evidence, not a dependency or permission to import that PR's migrations/runtime changes.
- Canonical tracked evidence lives at `data/catalog-enrichment/personal-plan-launch-v1/scalp/` plus the eight referenced final WebPs under `ops/catalog-enrichment/personal-plan-launch-v1/scalp/`. Add exact `.gitignore` allowlist entries for these 16 files. PR #357's candidate copies must remain byte-identical but are not a second runtime source.
- Publication order is Scalp before the broader PR #357. If #357 merges first, rebase this branch and resolve its `.gitignore`, `package.json`, and DB-runner additions without changing the eight reviewed fingerprints.
- Product display-brand values use the live canonical brand row names. This explicitly normalizes `Schwarzkopf GLISS` to `Gliss` and `L'Oreal Paris` to `L'Oréal Paris`; Gliss remains its own existing canonical brand. These are identity canonicalizations, not new product decisions.
- Nick approved the Scalp copy-quality pass on 2026-08-11. User-visible names, application instructions, protocol source text, and review evidence use proper German umlauts and spelling in every mirrored manifest payload. Product facts, cadence, roles, availability, URLs, IDs, and images are unchanged.
- The Scalp batch owns the initial exact application-protocol rows for these eight new products. PR #357 must treat matching rows as existing authority and must not create a second conflicting protocol owner.
- No application surface, journey, timing, or feedback behavior changes. The catalog copy correction does not create a new interface, so a mockup is not applicable.
- A later authorized catalog apply would make eight recommended Scalp products eligible for Personal Plan selection. Rendered Stage 3/5 validation is therefore a named post-apply gate before broad activation; it is not evidence that this non-applied implementation changes the current surface.
- The operator journey is the reviewed Product Intake journey: read-only preflight, explicit migration gate, immutable hash-verified image upload, exact transactional apply, independent exact-state verification. Nick approved proceeding on 2026-08-11.
- Production migration, Storage upload, catalog apply, deployment, activation, merge, and cleanup remain separately authorized operations.

## Architecture

Build on the merged Heat-only catalog executor now on `main`, with a separate Scalp namespace and exact cohort contract:

- `src/lib/product-intake/catalog-enrichment/scalp.ts` owns the eight-key package, current canonical identities, manifest resolution, freshness/duplicate/Storage checks, apply guards, and exact verifier.
- `scripts/product-intake/catalog-enrichment/scalp-{client,preflight,apply,verify}.ts` expose narrow operator commands. Dry-run is the default; the write path requires exact reviewer, project, clean reviewed head, migration state, batch fingerprint, and explicit confirmation flags.
- A new Supabase migration, created with `supabase migration new`, owns only missing Scalp identity seeds and `apply_catalog_enrichment_personal_plan_scalp_v1`. It reuses the existing `catalog_enrichment_applied_items` ledger and shared identifier normalization from the merged Heat architecture.
- The Heat migration and ledger are explicit prerequisites and must already be applied. In migration-absent mode, Scalp preflight requires the ledger table to exist with zero rows for the Scalp batch while requiring only the new Scalp migration/RPC to be absent.
- The RPC is service-role-only, `SECURITY DEFINER SET search_path = ''`, transaction-atomic, advisory-locked, exact-eight enforced, same-fingerprint idempotent, and conflicting/partial-state rejecting.
- TypeScript identifier collision checks must match the database normalization function exactly, including Eucerin's `PZN:09508065` and `NART:69658-00000-26` shapes; do not copy Heat's divergent barcode punctuation rule.
- Images use immutable `product-images` paths and approved SHA-256 values. Existing matching objects are reused; mismatches fail; a DB failure reports newly uploaded unreferenced paths without automatic deletion.
- The independent verifier proves the exact eight products, identities, identifiers, images, Scalp specs, protocols, recommendation state, and ledger rows—not counts alone.
- There is deliberately no automatic rollback/delete path. After an authorized apply, the safe containment lever is a separately authorized row-state change (`is_active=false` and/or `is_chaarlie_recommended=false`); ledger and image provenance remain append-only/auditable.

## Implementation slices

1. **Guards and reviewed package.** Track/allowlist the exact eight manifests and eight final WebPs. Record the current commercial-refreshed cohort index fingerprint `8ed553db305cf715058eece4b364565b3552df2505516657c9d2cf67437aa01f` and generated package fingerprint `e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50`. The prior copy-reviewed values before the The Ordinary official-source refresh were cohort `f5e5fc5d74068647a9213467d9a914a3c683c58fafe5b8b4facf257616a079c7`, package `c324d3c818e9b1d5d8980f487eab6988b9a7ec64db40451115f7370c56c170d6`, and The Ordinary content `c4123e12b55b552b34577e7fed54c40e3e5c49cbdbf25da68b9e240bfe3b8f7b`; the refreshed The Ordinary content fingerprint is `10fbf543434519912f702856b25742c418df5782f5de06472be27a79d51fb6e7`. Add a focused Scalp test and record its missing-module red proof. Cover exact-eight enforcement, approved German copy, approved role/spec/protocol mapping, canonical identity spelling, Heat-ledger/Scalp-migration state, duplicates, DB-equivalent identifier normalization, commercial freshness, Storage mismatch/reuse/upload/orphan behavior, project/head guards, dry-run default, idempotency, and exact verification. Implement the package, preflight, and narrow CLI adapters from current Heat architecture—not the stale combined B1 gate.
2. **Migration and database contract.** Generate the migration through the Supabase CLI. Seed only identities proven missing, reuse existing canonical identities, reject collisions/mismatches, and enforce the exact eight-product/Scalp contract in SQL. Add a Scalp real-package generator, `supabase/tests/catalog_enrichment_scalp.sql`, and both required registrations in `scripts/test-personal-plan-db.sh`. After package/migration generation, compute and pin the package fingerprint and migration seed-block fingerprint in TypeScript, SQL, and tests; never invent them ahead of the bytes. Test real canonical TypeScript package input plus security, partial-state, mutation, rollback, and idempotency cases.
3. **Read-only release proof and review.** Against project `pqdkhefxsxkyeqelqegq`, require the Heat migration/ledger applied, the new Scalp migration absent, zero Scalp ledger rows, zero exact product/identifier collisions, and zero unexplained blockers. Recheck The Ordinary commercial evidence before any later apply if the official PDP freshness window expires or availability changes. Run focused/adjacent tests, disposable DB contracts, image hashes, typecheck/lint/build, the repository `ready-check` workflow, and the single whole-branch review router with Claude as counterpart. Record exact content fingerprints and retained evidence. Do not apply the migration or upload objects.

## Acceptance checks

- Exactly eight approved Scalp keys; zero Heat keys.
- All eight package-level reviews and images remain bound to Nick's reviewed content.
- No product is already live under an exact identifier or canonical identity at preflight time.
- Identity seeds are deterministic and collision-safe; existing canonical rows are reused rather than duplicated.
- Heat migration and shared ledger are already applied; only the new Scalp migration is absent during the release preflight, and the ledger has zero rows for the Scalp batch.
- Commercial evidence is no older than seven days at preflight and again at any later apply.
- Preflight is read-only and fail-closed; apply requires every explicit confirmation and both reviewed fingerprints.
- SQL enforces exact cohort/category/recommendation/spec/protocol/image/identity contracts and rejects 7/8, 9/8, partial-ledger, attacker-mutated, or changed-fingerprint packages.
- Same-fingerprint retry returns the same product IDs; conflicting state fails.
- Independent verification proves all exact rows and Storage hashes.
- The exact eight tracked manifests and eight final WebPs are present in a clean checkout/CI, and PR #357's copies remain byte-identical if that branch is still open.
- No submission, user-usage, notification, analytics, credit, feature-flag, runtime-policy, or automatic cleanup writes exist.

## Stop condition and residual risks

Stop at a locally verified, review-ready worktree. Do not commit, push, open/modify/close a PR, apply a migration, upload an image, write catalog rows, deploy, activate, merge, or clean worktrees without later authorization.

Residual risks to surface rather than infer:

- a canonical brand/line collision that cannot be resolved from current live rows and reviewed source identity;
- commercial evidence expiring after 2026-08-16;
- a reviewed image hash no longer matching its retained final asset;
- PR #357 changing one of the shared eight candidate fingerprints before this branch is published.
