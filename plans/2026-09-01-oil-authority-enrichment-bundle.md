# Oil authority enrichment bundle

## Outcome

Prepare an exact, reviewable, replay-safe proposal for enriching the 15 existing Oil products identified by scanner catalog coverage. The proposal must contain product-level Oil facts, the sheet-authorized thickness/subtype placement, exact role protocols, product/source evidence, and deterministic fingerprints. Nick approved content fingerprint `bc2cca3c68ae4eea4dd337fcbbd5f02be5d7ac1d42635a26bd68a74255929b2b` on 2026-09-01; merge, deployment, production apply, and disposition activation remain separate gates.

This is backend/operator work. It changes no user-facing surface, copy, timing, or feedback, so no visual mockup is required.

## Scope and fixed decisions

- Treat the `Haartyp` tab of the supplied Google workbook as authority for `oil_subtype` and exact `thickness`. Assert the already-correct top-level `suitable_thicknesses` and `product_thickness_eligibility` as immutable pre-state; do not rewrite them.
- Use the previously reviewed per-product weights, roles, ingredient flags, and 18 exact protocols.
- Keep food/body Oil guidance conservative: dry shaft/ends only, no scalp, growth, treatment, or inferred Heat-protection claims.
- Propose the existing OGX row as the exact 100 ml Moroccan Argan Penetrating Oil identity, guarded by the current product name, brand, category, affiliate URL, and exact source evidence. Do not read or write GTINs.
- Propose Garnier with `oil_purpose = null`, `role_support = [pre_heat_protection]`, and no dry-finish role.
- Propose `provides_heat_protection = true` only for OGX and Garnier.
- Set `oil_purpose = pre_wash_oiling` for all 13 natural-oil rows, `styling_finish` for OGX, and `null` for Garnier. Validate the complete database enum explicitly.
- Preserve all existing recommendation dispositions. Catalog property enrichment and global activation stay separate.

The live catalogue already contains exactly one sheet-matching thickness/eligibility row and one matching top-level thickness for every product in this cohort. The proposal does not narrow or expand thickness coverage; its eligibility delta is limited to the reviewed purpose/ingredient flags. The overall repair is still a real change because specs, flags, protocols, evidence, and the two verified Heat flags are incomplete.

## Implementation

1. Extend the mandatory catalogue-authority repair manifest lane in `src/lib/catalog-authority/repair.ts` and add an Oil-specific adapter beside it.
   - Reuse `slice = leave_in_oil`, `assertCatalogAuthorityRepairReady`, its canonical review fingerprint, its null-approval gate, and its per-entry old/new fingerprints. Do not create a parallel approval system.
   - Add an optional explicit `expectedCurrentAuthority` object to repair entries and require its fingerprint to equal `expectedOldFingerprint`. Existing manifests remain valid.
   - Strictly validate the 15-product Oil cohort, exact identity snapshot, specs, one sheet-driven eligibility row per product, protocols, and sources.
   - Accept `internal_verified` only for fact provenance and map Chaarlie protocol evidence to the canonical `internal_authority` guidance source. Add a regression preventing `internal_authority` from reaching the fact-evidence table.
   - Canonicalize product/source/role arrays and calculate the manifest review SHA-256 plus per-product old/new SHA-256 fingerprints.
   - The checked-in manifest binds Nick's approval metadata to the exact reviewed content fingerprint.

2. Add the exact proposal data and an operator evidence ledger under `data/catalog-enrichment/oil-authority-enrichment-v1/` and `docs/ops/catalog-repairs/`.
   - Record the authoritative sheet, exact product/INCI sources, per-oil evidence limitations, and the proposed Chaarlie 10-minute shaft-only protocol.
   - Include expected live identity/spec/eligibility/protocol pre-state so drift blocks rather than overwrites.

3. Add a thin dry-run-by-default catalogue-authority Oil client reusing the existing catalog-enrichment CLI helpers and clean-head/fingerprint gate shape.
   - Read the checked-in manifest, validate/canonicalize it, inspect current catalog state, and print the exact fingerprints and blockers.
   - Draft preflight uses schema parsing, fingerprint recomputation, and a blocker collector; it must not call the throw-on-first-error `assertCatalogAuthorityRepairReady` until the manifest is actually approved.
   - Require `--apply`, `--confirm`, matching expected fingerprint, reviewed Git head, clean worktree, and a matching non-null approval pin before calling the RPC.
   - Do not expose a command that can remove dispositions or change identifiers.

4. Add an additive Supabase migration defining a private, atomic executor for the manifest's Oil authority shape.
   - Create the migration with the Supabase CLI.
   - Use `SECURITY DEFINER SET search_path = ''`, fully qualified relations, advisory transaction lock, row locks, exact cohort/identity/pre-state checks, and a retry ledger.
   - Rebuild the exact live authority JSON under row locks and compare it with each manifest entry's explicit `expectedCurrentAuthority`, preventing time-of-check/time-of-use overwrites.
   - Whitelist writes to `product_oil_specs`, `product_oil_eligibility`, `product_application_protocols`, and `personal_plan_catalog_fact_evidence` only.
   - Refuse any call with an explicit `IF v_approved_manifest_fingerprint IS NULL THEN RAISE` before comparing fingerprints; SQL three-valued logic must never turn the null pin into a fail-open comparison. Additionally require `p_reviewed_by = 'nick'`. Revoke `PUBLIC`, `anon`, and `authenticated`, granting only `service_role`.
   - Do not update `products`, identifiers/GTINs, recommendation dispositions, lifecycle, or recommendation flags.

5. Add focused tests.
   - Red-first tests for the exact enumerated cohort, authoritative sheet parity, Garnier/OGX policy values, 15 eligibility rows, 18 protocols, evidence types, and stable fingerprints.
   - Preflight tests for exact replay, identity/spec/eligibility/protocol drift, pending approval, and no-write dry run.
   - SQL contract tests for the exact approved pin plus explicit null safety, atomic/private executor, table whitelist, drift checks, idempotent ledger, and explicit absence of GTIN/disposition/product writes.

## Operator journey

1. Operator runs the Oil command without apply flags.
2. The command validates the checked-in package and reads current catalog rows only.
3. It reports the batch and item fingerprints, planned operations, and any live drift blockers without writing.
4. No RPC is called and no database row changes.
5. Nick reviews the exact-product decisions and bundle fingerprint.
6. A later, separately authorized change may pin that fingerprint and reviewer, after which the existing clean-head/confirm/fingerprint gates can permit apply.
7. Disposition resolution and global-recommendation activation remain a later, separate approval and audit.

The future apply is itself a user-facing recommendation change even before disposition cleanup: Garnier currently has no blocking disposition, and setting its verified Heat flag can make it eligible for Heat-aware Oil selection. Therefore approval to pin/apply this manifest must include the designed recommendation journey and activation sign-off required for user-facing changes. The current draft-preparation task is non-user-facing because it stops before any write.

## Verification

- Focused Node tests for package, preflight, CLI, and migration contract.
- Typecheck/lint relevant files.
- Dry-run command against live read-only state if credentials are available.
- `npm run ci:verify`, then `ready-check` and `request-code-review` on the complete uncommitted tree.

## Shipping boundary

Commit and push the approved task files and open a draft PR. Do not apply migrations, call the write RPC, alter Supabase, remove dispositions, merge, deploy, or clean up the worktree without separate authorization.

## Exact cohort input

The checked-in manifest must contain exactly these existing Oil product IDs; the live name, brand, affiliate URL, category, lifecycle, recommendation status, top-level thicknesses, and normalized thickness row are immutable identity/pre-state guards:

`19aea9c4-4b90-4ec4-8cb6-90cb270010f7`, `1dce2c18-6a45-4017-a748-e3a7f1cba36f`, `1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf`, `29e36443-93ff-4b62-9cf0-55ad9f89f530`, `2ffeae68-c625-4df5-be02-0c1b620aa0fc`, `38886b62-2c45-4b34-9a24-7d831e97946e`, `3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b`, `3eb198a5-9aab-4f28-9df1-c4869c6a12db`, `4a95e1de-54e9-4fcd-b227-72a5824d13c1`, `517dca50-5d55-4038-ba1d-f9b745708327`, `9bfe0a67-72ad-4951-bb99-9f2f5d5c724a`, `a11855eb-64e5-438f-8880-1d3573efa9fa`, `acf9d5cd-76e4-49c7-9c04-0af1f20506ad`, `c574ee6f-ad22-45c0-b936-57b847d93433`, and `ca4ae209-79d2-4f4d-8e44-46e586cec62d`.
