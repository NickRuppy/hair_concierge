# Scanner E18-E19 ready-check receipt

- Branch: `codex/scanner-catalog-coverage-plan`
- Reviewed delta base: `0c05e74298f743606f71a12ecb64cd87bbc6e3cc`
- Branch merge-base with `origin/main`: `4029faf0f6f23ab428f16df574d466eeed830cc3`
- Current `origin/main` at verification: `85972a91b3aedbaead0bcbc70532acdbd16bf4bb`
- Functional content fingerprint: `31dcfd28ad76d5165f5d45f925adee330f3b5b8c30a954e1f7ba6c65e8f820ac`

The functional fingerprint is the SHA-256 of the sorted path-and-content-hash manifest for the nine E18/E19 functional files: allowlist entries, two frozen manifests, enrichment receipt, TypeScript contract, two guarded migrations and two focused test files. This receipt and the review receipt are excluded from their own fingerprint.

## Outcomes checked

- E18 freezes exactly 14 existing curated oil rows and 14 checksum-valid canonical GTINs; the formula-ambiguous generic OGX row is absent by ID, brand and name.
- E19 freezes exactly the existing 300 ml Balea 2 in 1 Urea 5% row with three checksum-valid package aliases. The current German and Austrian aliases use official dm evidence; the older alias retains its lower secondary-retailer evidence tier explicitly.
- Every item-level content fingerprint and both raw-file fingerprints round-trip exactly. No product ID, item key or canonical GTIN collides across E1-E19.
- Both additive migrations preserve E1-E17 byte-for-byte, accept only their exact shapes and fingerprints, reject current dispositions and unresolved-submission overlap, preserve global single ownership and replay with zero duplicate inserts.
- Fresh read-only production readback found zero barcodes for all 14 E18 oils; 13 still had obsolete dispositions and all 14 had one or two live application protocols. Balea still had one disposition and one protocol. No production mutation is part of this receipt.

## Fresh verification

- `node --import tsx --test tests/scanner-existing-identifier-backfill.test.ts tests/scanner-existing-identifier-backfill-postgres.test.ts` — 45/45 passed after the review delta.
- `npm run typecheck` — passed.
- `npm run lint -- ...` — zero errors; five existing repository warnings plus two ignored-test-file warnings.
- `git diff --check` — passed.
- E18 raw SHA-256 — `1b59aefef8ba0a5ae217c16d49a37b2b1e2e118157855a68b7c2e2931d3d5643`.
- E19 raw SHA-256 — `5f062d6932340d504ffd796985f25e03464ada0f32c119e07572c4c8543b47b8`.

## Blockers and residual risk

- E18 cannot apply until the exact guarded oil-disposition reversal clears the 13 obsolete dispositions and the readiness oracle still passes for every selected oil.
- E19 cannot apply until Balea's protocol/disposition lane completes and verifies the exact row.
- The scanner branch is 27 commits ahead and eight behind current `origin/main`; refresh and full conflict verification are required before publication or production application.
- The Balea legacy alias `4058172738272` has one exact secondary-retailer source rather than current official dm corroboration. It is retained under Nick's explicit preference for multiple exact-package aliases; the executor still fails closed on ownership or submission conflict.

## Artifact disposition

- Commit the prepared E18/E19 manifests, migrations, contract, tests, receipt update and verification receipts locally.
- Do not push, apply migrations or write GTINs until the readiness lanes and fresh clean-head preflight are green.
