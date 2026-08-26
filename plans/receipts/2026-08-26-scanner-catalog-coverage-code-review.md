# Scanner catalog coverage code-review receipt

Date: 2026-08-26  
Reviewed content fingerprint: `9659ee5e8e514244cb31ce0c08c1b86b1f3d95613efd858935a3101d63d5b2a6` across 51 task paths, excluding this receipt and the ready-check receipt.

## Verdict

Approved for local commit. No unresolved correctness, security, data-integrity, or structural blocker remains. Production apply, push, PR creation, merge, deployment, and activation are outside this verdict.

## Review lanes

- Main review traced GTIN normalization parity, global ownership including inactive products, every current Product Intake writer, migration order, batch identity/fingerprint guards, idempotent replay, and read-back verification.
- Claude Code Opus 4.8 at high effort completed the required read-only whole-branch counterpart review with no hard defect. Its operational notes were checked locally: migration-before-runtime ordering is documented; the renamed migrations were confirmed absent from production; required extensions are installed; the generated-column rewrite is low risk at the current table size; and the identifier source field was changed from full URLs to the bounded label `scanner-catalog-coverage-2026-08-26` while retaining exact URLs in the evidence ledger.
- The structural review initially identified a dead historical Product Intake wrapper layer and an overburdened preflight CLI. Both were corrected. The public RPCs are now replaced in place while deliberately delegating past the obsolete raw/active-only scan wrapper, and release/client responsibilities live in `scanner-identifier-backfill-client.ts`. The structural re-review cleared the approval bar with no remaining blocker.
- The linked-worktree preflight failure was reproduced and fixed: production migration state is read through the linked primary checkout, while the task branch retains the migration definitions under review. Tests cover both remote-only applied rows and local-only absent rows.

## Residual operational risk

- The four migrations are intentionally unapplied, so the guarded preflight must remain blocked until deployment.
- Applying the canonical generated column rewrites the small current identifier table; deployment should still observe migration duration.
- The manifests encode evidence current as of 2026-08-26. Every source and ownership check must be refreshed at the exact reviewed head immediately before apply.
- The 48 GTINs cover existing products only. Genuinely new products still require the full Product Intake research, image, INCI, property, protocol, review, and publish path.

Transient reviewer output was kept outside the repository and is not part of the commit.
