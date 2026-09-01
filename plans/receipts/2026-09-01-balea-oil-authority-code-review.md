# Balea and Oil authority code-review receipt

- Scope: complete committed branch against `origin/main` at functional head `aabfb89e`.
- Functional content fingerprint: `25c3bb4e1e3c091f60ebc979812d2e9ef0572ee8ada202c5f043965ddfe57628`.
- Review lanes: main integration review, bounded workers/explorer verification, and Claude Opus / high read-only whole-branch review.

## Findings and resolution

The first counterpart pass found two preflight defects and four meaningful coverage gaps. Before the final pass:

1. Amendment batches now reject duplicate product resolutions before apply, and blocked dry-run disposition preflights exit nonzero.
2. CI now regenerates and checks the Stage 5 application artifact, while the Postgres harness binds digest output to the actual batch body and exercises malformed payloads.
3. The Oil reconciliation safely no-ops on a genuinely fresh install but still fails if its authority ledger says the missing target should exist.
4. K18 carry-forward provenance is tied to the checked-in readiness document, its SHA-256 and the derived live-source fingerprint.
5. The SQL release gate now has rejection coverage for malformed V2 payloads, non-curated product state and divergent exact protocol authority.
6. The release plan now states the only successful order: applied disposition migration, Oil pointer reconciliation, Balea V1 amendment, full V2 artifact and final disposition resolution.

The final counterpart pass found no confirmed correctness defect and independently passed 5,119 Node tests, 288 Stage 5 tests, typecheck, lint and artifact regeneration. Its runbook-order finding was fixed and reverified before this receipt. The main review accepted the remaining notes as non-blocking: the RPC is service-role-only but does not embed a second SQL-side Nick-approval marker; conditioner amendments intentionally lack Shampoo-specific fact checks; and live reverse coverage remains an apply-time preflight.

## Product decision retained

The expanded Oil artifact includes the food and body oils already admitted by the approved Oil authority data. This is intentional: Nick explicitly confirmed that food oils and body oils should remain in scope, while formula-ambiguous generic OGX Argan Oil remains excluded from barcode assignment.

## Verdict

Review-ready for push and guarded merge. No production migration, protocol, artifact, disposition or GTIN write is implied by this receipt.
