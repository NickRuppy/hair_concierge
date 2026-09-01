# Scanner E18 oil re-entry ready-check receipt

- Branch: `codex/scanner-catalog-coverage-plan`
- Reviewed delta base: `972e8a51`
- Functional content fingerprint: `e4f767dc6d6ce433f0561da53872af4278e06600d44103db2af3c9b88c37729c`

The fingerprint covers the sorted path-and-content-hash manifest for the nine functional files in this oil-reentry delta. These receipts are excluded from their own fingerprint.

## Outcomes checked

- The two approved batches account for exactly 13 disposed products in the 14-product E18 oil wave: the historical exact-seven S5R-01 batch and the additive exact-six S5R-03 batch.
- Garnier Sleek & Stay requires no disposition reversal. Formula-ambiguous OGX and the out-of-scope Balea Pflegeöl Natural Beauty disposition are explicitly excluded.
- Both manifests are pinned to their exact canonical SHA-256 and require Nick's approval state, an exact reviewed head, the service-role-only executor and the explicit execution kill switch.
- The database path verifies exact product identity, active curated state, the expected prior disposition, complete oil facts and exact V1/V2 protocol readiness before any disposition is deleted. Receipts make exact replay read-only.
- The E18 extension migration is safely re-runnable and uses stable constraint names below PostgreSQL's 63-character limit.

## Fresh verification

- Focused Node/Postgres suites: 32/32 passed, including atomic rollback, exact replay, unrelated-disposition preservation and migration rerun.
- `npm run typecheck` — passed.
- `git diff --check` — passed.

## Release gate

This delta is ready to commit, but not ready to apply in production yet. Live readback showed the 13 products still lack V2 oil protocol pointers. The reversal therefore remains correctly fail-closed until PR #496's oil-authority reconciliation is merged and applied, followed by a fresh live preflight with zero blockers.

