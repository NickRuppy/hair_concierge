# Balea med 5% Urea ordinary wash protocol

## Outcome

Make the existing curated product `b000d235-1fc6-434c-9ba1-f1207d36cded`
(`Balea med Duschgel & Shampoo 5% Urea 2in1`) globally recommendation-ready
for its fact-derived `shampoo_everyday` role without treating the role name as
a fixed daily cadence.

The product must leave `awaiting_exact_analysis` only after a schema-valid V1
protocol and its composable V2 product pointer are both present. Barcode
ownership, identifiers, GTIN manifests, product facts, and recommendation flags
remain unchanged.

## Evidence and product ruling

- The current dm product page identifies the exact 300 ml product, GTIN
  `4066447965414`, as a 2-in-1 shower gel and shampoo for hair and sensitive,
  dry scalp. It describes gentle cleansing but its usage field only says
  `Dusche + Shampoo`.
- The current product image repeats that the formula provides gentle cleansing
  and care for skin and hair, but adds no product-specific wait time, repeat
  wash, amount, or cadence.
- The American Academy of Dermatology advises applying shampoo to the scalp,
  gently massaging it, and letting it rinse through the lengths. It also states
  that wash frequency should follow the person's hair/scalp needs rather than a
  universal daily schedule.
- The catalog already stores the reviewed non-dandruff bucket
  `shampoo_bucket = trocken`; under the repository's role-applicability
  contract, that bucket supports `shampoo_everyday` and does not support
  `shampoo_dandruff`. The accompanying `scalp_route = dry` and
  `cleansing_intensity = gentle` facts describe fit, but do not independently
  derive the protocol role.

Therefore the source-backed protocol is the standard wash-day method: wet hair
and scalp, apply the shampoo to the scalp, massage gently, and rinse
thoroughly. It has `cadence = null`, no wait step, no contact time, no repeat
application, and no treatment claim. `shampoo_everyday` means the ordinary
wash-day slot, not an instruction to shampoo every calendar day.

## Current state

Read-only production inspection on 2026-09-01 confirmed:

- active curated and recommended Shampoo;
- one `trocken` / `dry` / `gentle` Shampoo spec for fine hair;
- no `product_application_protocols` row;
- one `awaiting_exact_analysis` disposition with reason code
  `insufficient_executable_directions`, batch
  `S5-21-product-search-dispositions`, and fingerprint
  `dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6`.

The original Stage 5 V1 research source is frozen and fingerprinted by the V2
baseline, so it must not be edited in place.

## Implementation

1. Add one versioned post-baseline protocol-amendment manifest for the Balea
   product. Keep the manifest contract category-discriminated for Shampoo and
   rinse-out Conditioner amendments. Validate product scope,
   source-role/family compatibility, evidence, category-specific facts, and the
   exact disposition being resolved. Derive the V2 pointer once with
   `buildProductApplicationPointerV2`; use that same output in every downstream
   artifact and preflight.
2. Reuse `apply_personal_plan_stage5_protocol_batch_v1` for the V1 insert by
   teaching the existing Stage 5 batch loader to accept the versioned amendment
   manifest. Reuse its fingerprint, clean-HEAD, conflict, retry, and
   `catalog_enrichment_applied_items` ledger contracts.
3. Extend the Stage 5 V2 generator with an additive amendment delta mirroring
   the existing Leave-in use-case delta. Discover every reviewed `S5-*.json`
   amendment instead of naming Balea in generator code. Preserve every frozen
   baseline source fingerprint, include each amendment as a source file, and
   reject duplicate or baseline-conflicting protocol identities. Carry forward the approved live
   K18 protocol and approved Oil authority-repair protocols that landed after
   the frozen baseline, replacing an older pointer only when the exact
   product/role/family key matches. Reuse the existing full V2 artifact executor
   for the V2 write.
4. Add only the missing disposition-resolution capability: a read-only
   preflight, explicit apply CLI, and service-role-only SQL RPC. The TypeScript
   preflight reuses `deriveShampooProtocolRoles` only for Shampoo amendments;
   the category-discriminated contract admits the canonical
   `conditioner_rinse_out` role without inventing Shampoo facts. The RPC remains
   category-generic and verifies exact
   product/category identity, byte-equivalent V1 and V2 payloads, and the exact
   current disposition, then deletes only that disposition and records/reuses a
   `catalog_enrichment_applied_items` ledger entry.
5. Keep application ordering explicit and fail-closed:
   - confirm the already-applied disposition-resolution migration
     `20260901140744_20260901133000` is present;
   - apply the Oil V2 authority reconciliation migration `20260901160000`;
   - apply the V1 amendment batch;
   - apply the regenerated full V2 artifact;
   - resolve the disposition last, only after both payloads verify.
     Balea remains quarantined through the first two steps, so an interruption is
     safe and the sequence is replayable. Before the V1 step lands, the new full
     V2 artifact is intentionally expected to report Balea's source protocol as
     missing in a live preflight and must not be applied. Applying the V2
     artifact before the Oil reconciliation is also expected to fail closed on
     the superseded Garnier pointer.
6. Add focused tests for schema/evidence validation, the generated artifact,
   read-only preflight conflicts, apply gates, SQL privileges/atomic ordering,
   and the Balea payload semantics. Update stable artifact fingerprints/counts
   only through the generator.

## Verification

- Prove the focused tests fail before implementation and pass afterward.
- Run the amendment manifest tests, Stage 5 V2 generation check, Stage 5 V2
  preflight/activation tests, product-disposition tests, catalog-authority tests,
  and the relevant product-intake Shampoo readiness tests.
- Run the V1 amendment CLI in read-only mode against production and confirm it
  reports exactly one planned insert. Run the resolution CLI read-only and
  confirm it remains blocked specifically on the not-yet-applied V1/V2 payloads,
  while unit/integration fixtures prove that the same exact live state becomes
  releasable after those payloads are present.
- Run repository ready-check and whole-branch review on the final tree.

## Gates and non-goals

- Nick authorized commit, push, PR, merge, deployment, migration application,
  V1 protocol application, V2 artifact application, disposition resolution, and
  production verification on 2026-09-01. Execute these as separate guarded
  gates and stop if a preflight or verification fails.
- Do not change barcode ownership, product identifiers, GTIN manifests, product
  facts, suitability, price, image, or recommendation flags.
- Do not clean up the task worktree unless separately requested.
