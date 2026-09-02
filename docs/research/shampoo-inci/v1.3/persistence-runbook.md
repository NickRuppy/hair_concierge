# Shampoo research release and shadow runbook

## What this is

Shampoo v1 is an internal, ingredient-based research authority. It stores exact formula evidence, the full eight-property analysis, reviewer decisions, and profile-fit outputs separately from the live catalog. It does not update `products`, `product_shampoo_specs`, Personal Plan selection, or user-facing recommendations.

The frozen 2026-08-26 release contains 51 catalog identities: 50 approved formula/analysis pairs and one blocked duplicate identity.

## Safe repeatable sequence

Run from the task worktree.

1. Validate the source artifacts:

   ```bash
   npm run research:shampoo:validate
   ```

2. Freeze the exact reviewed cohort:

   ```bash
   npm run research:shampoo:freeze
   ```

   The command refuses incomplete reviews, stale formula/audit fingerprints, unresolved formula identity, invalid artifacts, or a missing blocked outcome. Re-running unchanged inputs must print the same release hash.

3. Prepare the internal database import without writing:

   ```bash
   npm run research:shampoo:import
   ```

   Dry-run verifies all approved catalog UUIDs and prints the release, payload hash, and counts. The blocked duplicate is immutable release metadata and is not required to remain in the live catalog.

4. Capture the current catalog comparison baseline read-only:

   ```bash
   npm run research:shampoo:snapshot
   ```

   This reads the guarded Supabase project and writes `catalog-spec-snapshot.json`. It retains every `product_shampoo_specs` row; multi-thickness and multi-bucket products are never collapsed.

5. Generate the deterministic shadow comparison:

   ```bash
   npm run research:shampoo:shadow
   ```

   This writes `shadow-report.json` and `shadow-report.md`. The report compares profile-level ingredient ranking with current thickness/bucket eligibility. Direct legacy-signal divergence is descriptive: the current catalog is a baseline, not ground truth.

6. Replay the migration and import transaction in disposable local PostgreSQL:

   ```bash
   npm run test:shampoo-research-db
   ```

   This requires a running Docker-compatible daemon. It verifies RLS/permissions, canonical hashes, missing approved identities, missing/duplicate review decisions, rollback, the `draft → needs_review → approved` transition, the membership-only blocked outcome, identical replay, and hash collision refusal.

## Adding another Shampoo

First use the [new-product research runbook](./new-product-research-runbook.md) to prove exact identity, source quality, formula-first classification and repeatability. That work is local and provisional: it creates neither a catalog identity nor an import-ready release.

Only after separate Product Intake/catalog authorization:

1. Reconcile the exact product to a catalog UUID. Product Intake remains the owner of creating or reconciling a missing catalog identity.
2. Create a **new catalog-linked artifact**; never mutate the historical holdout research ID.
3. Add the verified formula, audit and evidence to a later cohort; validate them and complete Lab review.
4. Freeze a new release. Never edit the old release manifest to make a later formula appear historical.
5. Capture a fresh catalog snapshot and regenerate the shadow report. If the new product has no current Shampoo spec, its ingredient fit is still evaluated and legacy comparison is explicitly `new_product_no_legacy_baseline`.
6. If the research exposes a systematic rule gap, change the normative logic and rerun the complete cohort rather than patching one product ad hoc.

For `weightPotential`, the current normative logic is [`shampoo-weight-final-v1`](../v1.4-draft/weight-potential-final-method.md). Use the frozen canonical formula and reinterpret deposition load, persistence and reset capacity; do not fetch a replacement formula unless identity is blocked. If that rerun changes weight, refresh only directly derived fit or report outputs that depend on weight. Keep [`shampoo-weight-v1`](../v1.4-draft/weight-potential-calibration.md) available for historical reproduction, but treat its route-count labels as superseded.

## Future apply gate

No database apply is authorized by this runbook. A future separately approved import requires all four values:

```bash
npm run research:shampoo:import -- \
  --apply \
  --confirm-project=pqdkhefxsxkyeqelqegq \
  --confirm-release=<exact-release-hash> \
  --reviewer-id=<reviewer-uuid>
```

The importer sends one transactional service-role RPC. The RPC verifies canonical SHA-256 inputs, binds formulas/analyses/reviews/members to the immutable manifest, performs the guarded two-hop approval, and returns either `imported` or a verified `already_imported` receipt. Any mismatch rolls back the complete transaction.

Even after an internal import, these actions remain separately prohibited until explicitly planned and authorized:

- projecting research values into `product_shampoo_specs`;
- changing recommendation or Personal Plan behavior;
- exposing research explanations to users;
- deploying the migration or activating a feature flag;
- generalizing the schema to other product categories without a category-specific research model.
