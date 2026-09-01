# Scanner E17 ready-check receipt

- Branch: `codex/scanner-catalog-coverage-plan`
- Reviewed delta base: `4f23f128534ac88ac2cd47f91e081c59f15301ce`
- Branch merge-base with `origin/main`: `4029faf0f6f23ab428f16df574d466eeed830cc3`
- Current `origin/main` at verification: `85972a91b3aedbaead0bcbc70532acdbd16bf4bb`
- Functional content fingerprint: `7bd251ff64d063d675635f3a9fa9f19f660f236997ab8926c8af10e310d58ac3`

The fingerprint is the SHA-256 of the sorted path-and-content-hash manifest for the seven E17 functional files: the allowlist entry, frozen manifest, enrichment receipt, TypeScript contract, guarded migration, and two focused test files. This receipt is excluded from its own fingerprint.

## Outcomes checked

- Nivea Volumen & Kraft Conditioner is frozen as the exact active curated catalog row `26985fdd-1b41-46e3-9c9a-94b98f92310a`.
- EAN `4005900918031` is checksum-valid and canonicalizes to GTIN-14 `04005900918031`.
- The 200 ml package is supported by two exact EU retailer sources; the frozen raw manifest fingerprint is pinned consistently in TypeScript and SQL.
- E17 accepts exactly one product and one canonical GTIN and retains every prior migration prerequisite.
- The executor rejects the wave while any Personal Plan disposition remains, rejects unresolved submission overlap, preserves global ownership, and supports exact idempotent replay.
- No production mutation is part of this receipt.

## Fresh verification

- `node --import tsx --test tests/scanner-existing-identifier-backfill.test.ts tests/scanner-existing-identifier-backfill-postgres.test.ts` — 41/41 passed.
- `npm run typecheck` — passed.
- `npm run lint -- ...` — zero errors; existing repository warnings only.
- `git diff --check` — passed.
- `shasum -a 256 phase1-existing-identifier-backfill-e17-v1.json` — `6b259ee2ceff31116e92d04a5a2c627379eb4b88e8cde3c51ae026860243f5ce`.

## Blockers and residual risk

- Live preflight cannot be green until migration `20260901143000` is applied and the separate exact Nivea conditioner protocol resolves the current `awaiting_exact_analysis` disposition.
- The scanner branch is behind current `origin/main`; refresh and conflict verification are required before publication.
- Cross-market package evidence is accepted under Nick's explicit same-product, multiple-barcode/same-formulation rule. The sources are EU exact-product pages and the German catalog's historical dm URL embeds the same EAN.

## Artifact disposition

- Commit with the E17 delta: manifest, migration, contract, tests, receipt update, allowlist, and this verification receipt.
- No transient test artifacts retained.
