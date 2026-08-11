# OGX Renewing canonical merge and origin-neutral search

Status: lean one-off repair package implemented locally, not applied. Nick approved the duplicate repair, the `gentle` cleansing authority, and `normal`-thickness-only eligibility on 2026-08-11. Production data application remains a separate guarded step after a fresh read-only fingerprint capture and review.

## Outcome and source context

Stage 3 shows one active OGX Renewing shampoo identity with a complete line/product name, while every existing owner, submission, identifier, and active Stage 3 draft continues to point at that canonical identity. The duplicate remains as an inactive tombstone with an auditable, rollback-safe merge record.

The repair also makes the search presentation origin-neutral: curated and reviewed user-submitted products use the same display mapper. `origin` remains provenance only; it does not affect labels, matching, ownership, or recommendation eligibility.

Source evidence:

- production duplicate `f41badc9-16e3-41c1-ab6c-23541fffade0` and canonical `2ecd3c9d-90f6-45a3-a72c-daefed50be10` were re-read on 2026-08-11;
- the duplicate currently owns four identifiers, two `user_products`, one approved-submission pointer, and two active Stage 3 draft JSON references;
- the canonical owns the reviewed packshot and one `normal / normal / balanced / gentle` shampoo-spec row;
- updating `user_products` intentionally increments the affected Personal Plan source revision and queues source reconciliation;
- there is no existing merge ledger or tombstone relation.

## Chosen direction

Keep the curated row as canonical and preserve its reviewed recommendation authority. Set its full stored saleable name to `OGX Renewing + Argan Oil of Morocco Shampoo`. Search presents the brand separately and derives the visible title by stripping one exact leading brand prefix only, so the customer sees:

- brand: `OGX`
- title: `Renewing + Argan Oil of Morocco Shampoo`

This mapping applies identically to curated and reviewed user-submitted rows. It deliberately retains the product line in the title and never branches on `origin`.

The final shampoo authority is exactly one row:

| thickness | shampoo_bucket | scalp_route | cleansing_intensity |
| --------- | -------------- | ----------- | ------------------- |
| `normal`  | `normal`       | `balanced`  | `gentle`            |

Do not move the duplicate's `fine`, `normal`, or `coarse` `regular` rows. Delete those rows only after the ledger captures them.

The merge itself is a reviewed operator SQL artifact: serializable transaction, advisory and row locks, exact fingerprints/counts/revisions, captured before-image, guarded DML, postconditions, then commit. A paired rollback operator fails closed if any post-merge row or draft revision has since changed.

The implementation uses Option B, the smallest auditable mechanism for this one enumerated duplicate:

| Option                      | Plain meaning                                                                                                                                  | Easier                                                                                       | Harder / residual risk                                                                             | Recommendation                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A. Permanent private ledger | Add `private.product_merge_ledger` through a migration, store before/after snapshots in production, and keep a guarded rollback operator.      | Central audit and reusable rollback evidence for future merges.                              | Adds permanent schema and tests for one known merge; creates a separate migration/deployment gate. | Rejected for this single repair; reconsider only as a separate catalog capability. |
| B. One-off guarded repair   | Commit a privacy-safe before-image JSON plus exact merge and compensating-recovery hard stop under `docs/ops/catalog-repairs/`; no new schema. | Smallest repair, no permanent infrastructure, matches the fully enumerated dependency graph. | Audit evidence lives in Git rather than production; a later defect requires a fresh recovery plan. | **Chosen.**                                                                        |

Both options run as PostgreSQL/service-role operator authority, never as an authenticated browser role. Both bypass the normal Stage 3 draft RPC deliberately; `SERIALIZABLE`, row locks, exact revision assertions, and monotonic revision increments replace that RPC's optimistic-lock boundary for this one repair.

## Scope and non-goals

In scope:

- the chosen before-image/rollback evidence mechanism and its tests;
- exact guarded merge and rollback operator artifacts for these two product IDs;
- canonical OGX name and authority spec;
- identifier, `user_products`, approved submission, and active Stage 3 draft repointing;
- duplicate retirement without deletion;
- origin-neutral Stage 3 display mapping and tests;
- exact dry-run and post-apply verification queries.

Non-goals:

- deleting historical research artifacts or previous-product snapshots;
- changing recommendation eligibility to depend on `origin`;
- promoting other user-submitted products;
- generic automated fuzzy merging;
- changing unrelated OGX products or their authority;
- applying the schema migration, operator SQL, deployment, or product visibility without the required explicit gates.

## Target map

- Option A only: `supabase/migrations/<generated>_private_product_merge_ledger.sql`, with private before/after ledger, immutability/access constraints, and no Data API exposure.
- Option B: `docs/ops/catalog-repairs/2026-08-11-ogx-renewing-merge/before.json`, a privacy-safe exact before-image committed beside the operators.
- `docs/ops/catalog-repairs/2026-08-11-ogx-renewing-merge/merge.sql`: exact guarded merge transaction with a dry-run mode documented separately from apply.
- `docs/ops/catalog-repairs/2026-08-11-ogx-renewing-merge/rollback.sql`: explicit compensating-recovery hard stop; never decrements a draft revision.
- `docs/ops/catalog-repairs/2026-08-11-ogx-renewing-merge/README.md`: approved authority, exact commands/tool calls, fingerprints, pre/postconditions, recovery boundary, and artifact hashes. No personal data.
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts`: at both exact mapping sites, select/use `brand` and apply the existing conservative product-identity display cleaner: search-row mapping and `resolveOwnedCatalogProduct`; keep line/product content.
- `tests/product-identity-normalize.test.ts` and `tests/personal-plan/products/stage3-persistence-supabase.test.ts`: origin-neutral display and full line/product regression proof.
- focused migration/schema contract tests under `tests/`: ledger schema/access and operator guard assertions.

## Designed integration journey

End user:

1. The user reaches Stage 3 and searches `ogx` or words from the Renewing line.
2. One active result appears. Its packshot and brand are unchanged; the title contains the full line and product name once.
3. Search never labels the row as curated or user-submitted. A reviewed product behaves as one canonical catalog identity.
4. Selecting it creates or reuses the owner's canonical `user_products` link. Recommendation authority still depends on active lifecycle, recommendation status, and category specs—not provenance.

Operator:

1. If Option A is chosen, apply the reviewed ledger migration only after its migration gate. If Option B is chosen, verify the committed before-image hash instead.
2. Re-run the read-only preflight. Any fingerprint, count, revision, JSON path, constraint, or trigger drift aborts the repair.
3. Run the merge SQL in rollback/dry-run form and inspect all returned postconditions and the ledger preview.
4. Run the exact byte-identical transaction with commit only after the explicit data-apply gate.
5. Verify one active search identity, canonical identifiers/specs/references, source-change outbox effects, inactive tombstone, immutable ledger, and no remaining duplicate references.
6. If a verified defect requires rollback and no protected row has diverged, run the guarded rollback. It restores captured values but increments drafts/source revisions monotonically. Divergence blocks automatic rollback.

Completion: one active OGX identity is searchable and usable, existing ownership/history is preserved, and the repair is auditable and reversibly guarded.

## Planning evidence

No new standalone mockup is required for this data slice. The reviewed Personal Plan v2/v3 evidence already establishes the search card hierarchy: separate brand, complete line/product title, packshot, and no provenance badge. This plan changes the data/display contract behind that reviewed surface and introduces no other interaction.

Evidence review: confirmed for the one-result OGX search outcome and origin-neutral treatment. Operator journey authorization is confirmed for preparing and verifying the repair; schema/data application remains governed by the explicit migration/data gates above.

## Ordered tasks

1. Implement the chosen before-image mechanism.
   - Option A: create the private immutable merge ledger.
   - Generate the migration filename with `supabase migration new`.
   - Store merge key, duplicate/canonical IDs, status, before/after JSON snapshots, exact pre/post fingerprints, counts, operator metadata, and timestamps.
   - Use a non-exposed `private` schema, revoke public/anon/authenticated access, and do not create a `SECURITY DEFINER` API function.
   - Add red/green schema-contract tests and run `npm run test:personal-plan-db`.
   - Completion: the ledger is writable only by the privileged operator path, cannot be overwritten, and has no Data API exposure.
   - Option B: capture only merge-relevant, privacy-safe rows in `before.json`, hash it, and make both merge and inverse SQL assert that exact snapshot. Do not store user IDs, email, or conversations.
   - Completion: the before-image is reviewable in Git, contains every changed value, and any mismatch aborts before DML.

2. Implement the exact merge and rollback operators.
   - Consume the fresh product/dependency fingerprints and approved spec/name constants above.
   - Merge transaction: `SERIALIZABLE`, stable advisory lock, row locks, exhaustive assertions, ledger before-image, canonical normalization, explicit spec replacement, identifier/reference/draft repointing, duplicate retirement last, postconditions, ledger after-image.
   - Preserve historical JSON artifacts. Patch only the active draft product identity fields and increment every changed draft revision; never write a lower revision.
   - Rollback asserts the ledger and untouched post-merge fingerprints, restores captured values/links/specs, and increments draft/source revisions monotonically. It fails closed on divergence.
   - Add source-contract tests proving wrong IDs/fingerprints/counts/revisions/specs abort before DML and all known FK/JSON references are covered.
   - Completion: isolated dry-run produces the exact expected before/after graph and rollback round-trip.

3. Make Stage 3 search display origin-neutral and complete.
   - Reuse `cleanProductDisplayName(name, { brand })` at the catalog mapping boundary for search and selected-product resolution. Do not strip the product line.
   - No textual-matching algorithm change is needed: it already matches across brand plus mapped title. Retain existing active/lifecycle filters.
   - At `listActiveProducts`, map `displayName` with `cleanProductDisplayName(row.name, { brand: row.brand })`. At `resolveOwnedCatalogProduct`, add `brand` to the selected columns and map the returned `displayName` the same way.
   - Add tests for a full stored `OGX Renewing + Argan Oil of Morocco Shampoo` name, a legacy brand-prefixed row, a non-prefixed row, one non-OGX product whose first token resembles its brand, and identical behavior across provenance values.
   - Completion: the search result never repeats `OGX`, retains the complete line/product title, and recommendation eligibility remains origin-independent.

4. Verify and prepare the guarded live handoff.
   - Run focused tests, database migration reset/pgTAP or repo equivalent, TypeScript, lint, formatting, and diff checks.
   - Run ready-check and whole-branch code review on the exact fingerprint.
   - Re-run live read-only preflight and compare against recorded expectations.
   - Completion: emit separate receipts for schema migration readiness and product-data apply readiness. Do not combine their authorization.

## Verification

Automated:

- chosen before-image mechanism and operator source-contract tests;
- `npm run test:personal-plan-db` when Option A adds a migration;
- isolated merge dry-run, rollback round-trip, and postcondition SQL;
- Stage 3 persistence/search and product-identity tests;
- relevant product-intake and Personal Plan tests followed by `npm run ci:verify` at the final gate;
- TypeScript, scoped ESLint, Prettier, and `git diff --check`.

Manual/browser:

- responsive Stage 3 search for `ogx`: one Renewing result, one brand label, full line/product title, unchanged image;
- select the result and confirm the captured card keeps the same clean title;
- confirm no provenance badge or recommendation implication was added.

Live-state gates:

- Option A schema migration applied only after explicit migration authorization; Option B has no schema write;
- merge transaction applied only after a fresh fingerprint match and explicit data-apply authorization;
- post-write read verifies references, specs, drafts, source revisions/outbox, tombstone, and ledger;
- no unrelated product or historical artifact changes.

## Review and handoff

- Worktree: `.worktrees/ogx-catalog-merge` on `codex/ogx-catalog-merge`, based on fresh `origin/main` `91d1c6dc`.
- High-effort Claude plan review returned `Approve with revisions` on 2026-08-11. Incorporated technical findings: clean both Stage 3 mapping sites and select `brand` on resolution; name the postgres/service-role execution authority; use exact repository verification commands; state the deliberate draft-RPC bypass; add non-OGX regression coverage. Its permanent-ledger versus one-off tradeoff is correctly left for Nick rather than silently chosen. One whole-tree review remains required before publication.
- Schema migration, code publication/deployment, migration application, and live merge are distinct gates. Nick's approval covers the exact OGX repair direction, not unrelated catalog writes.
- Rollback is guarded and monotonic; if live state diverges after the merge, automatic rollback is refused and a new recovery plan is required.
- Artifact disposition: plan, migration, operator SQL, runbook, and tests are `commit`; transient live query output and reviewer output are `discard` after privacy-safe evidence is summarized.
