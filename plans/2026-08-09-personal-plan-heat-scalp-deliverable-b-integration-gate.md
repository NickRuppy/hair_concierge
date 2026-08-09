# Personal Plan Heat and Scalp catalog follow-up — Deliverable B1

**Status:** implemented on green PR #344 head `580c3c118bc979679aee7b5782ad29c3dd0622ca`
**Outcome:** turn the reviewed B0 cohort into a dry-run-safe, exact-batch catalog integration without changing Personal Plan behavior or performing production writes during implementation.
**Accepted cohort:** 15 products: 7 Heat Protectants and 8 Scalp Care products.
**External-write boundary:** migration apply, Storage upload, catalog apply, deployment, and flag activation are all separately authorized operations and remain out of scope until explicitly approved.

## 1. Current evidence and corrected start gate

The earlier B1 stub was based on stale evidence. Fresh linked checks on 2026-08-09 establish:

- PR #344, `codex/personal-plan-launch-candidate` at `580c3c118bc979679aee7b5782ad29c3dd0622ca`, is the accepted reconciled Stage 1–5 base. Its CI, Personal Plan DB contract, Playwright, security, retrieval, live-smoke, and Vercel checks passed on 2026-08-09. The one-commit delta from the earlier accepted head was audited and transplanted without overlap, then the affected B1 gates were rerun. B1 remains in a separate worktree from the dirty launch-candidate and B0 worktrees.
- The seven Personal Plan migrations `20260808062602` through `20260808071000` and result-return migration `20260808100536` are already present once in the linked migration ledger. They must not be renamed or renumbered.
- `heat_protectant` and `scalp_care` exist and are enabled. `product_heat_protectant_specs`, `product_scalp_care_specs`, and `product_application_protocols` exist and are empty.
- The public `product-images` bucket accepts WebP/PNG/JPEG up to 2 MiB. All 15 expected immutable batch-scoped object paths are absent.
- A complete paginated live read covered 263/263 products, 42/42 identifiers, 80/80 brands, 40/40 product lines, and 100/100 aliases. None of the 15 products has an exact catalog or identifier duplicate.
- All 15 purchase pages still match the approved B0 commercial state. Five Heat products are available/recommendable, two Heat products remain unavailable and therefore active but not recommendable, and all eight Scalp products are available/recommendable.
- B0 contains 15 manually reviewed manifests, 15 approved final assets and hashes, reviewed data/image boards, and a verification receipt. B1 must consume those artifacts without silently rewriting their reviewed product/spec/protocol content.

Nick accepted this exact green base for B1 implementation on 2026-08-09. A later head change requires the base/check audit again before rebasing or transplanting further work.

## 2. Scope

B1 includes:

- transplanting only the task-owned B0 catalog artifacts onto a clean B1 worktree based on the accepted Personal Plan head;
- a read-only preflight that resolves the exact 15 manifests against current linked schema, identities, catalog, commercial pages, and Storage;
- exact identity seed operations for the reviewed missing brands/lines, with no generic get-or-create behavior;
- an additive migration that supports `manufacturer_sku`, adds an idempotency ledger, and exposes one narrowly scoped service-role batch RPC which records approved image provenance atomically with each product;
- an explicit apply command that uploads/verifies approved images, then invokes one atomic database transaction for all 15 products;
- an independent post-write verifier;
- tests and a concise operator receipt proving the intended rows and the absence of user-side effects.

B1 does not include:

- product re-research or changes to the reviewed B0 product facts, specs, protocols, images, hashes, or recommendation decisions;
- cleanup or merging of legacy duplicate Jean&Len or L’Oréal identity rows;
- generic product-intake approval, `product_submissions`, `user_product_usage`, notification, or user-credit changes;
- changes to Personal Plan selection logic, Routine/Application behavior, flags, rollout, deployment, or production activation;
- automatic deletion of Storage objects after a database failure;
- commit, push, PR creation, migration apply, upload, or catalog apply without the corresponding explicit authorization.

## 3. Chosen architecture

### Decision

Use a dedicated dry-run preflight, a content-fingerprinted resolved package, immutable hash-verified Storage uploads, and one service-role-only transactional RPC with a per-item application ledger.

### Options considered

| Option | Easier | Harder / residual risk | Decision |
|---|---|---|---|
| Dedicated preflight + guarded RPC + ledger | Exact drift checks, all-15 DB rollback, idempotent retries, auditable result | More implementation and SQL test work; Storage remains outside the DB transaction | Chosen |
| One-off data migration | Fewer moving parts for the first insert | Embeds volatile prices/URLs/images into migration history; weak preflight and retry ergonomics | Rejected |
| Sequential admin REST upserts | Fastest to script | Partial writes, weak concurrency protection, no atomic all-15 outcome | Rejected |

The existing Product Intake approval path must not be reused. It requires real submissions, can mutate user usage and notifications, forces user-submitted/non-recommended defaults, and does not represent this internal reviewed catalog batch.

## 4. Canonical identity map

The B0 brand/line strings remain reviewed display/source facts. B1 resolves their foreign keys to canonical identity rows so it does not multiply existing brands. New identity rows are exact reviewed seeds, not opportunistic get-or-create operations.

| Product key | Canonical brand | Product line | B1 action |
|---|---|---|---|
| `balea-two-phase-200ml` | Balea `58bcafd6-a884-4337-8c8d-8d8369f2117c` | none | Reuse |
| `balea-ultralight-200ml` | Balea `58bcafd6-a884-4337-8c8d-8d8369f2117c` | none | Reuse |
| `got2b-schutzengel-200ml` | got2b `a286e2c2-6b44-41f3-a37b-f57d4ed1e93c` | none | Reuse |
| `jean-len-beat-the-heat-100ml` | Jean&Len `d1a06eff-1c23-472e-908e-f5364edb1bec` | none | Reuse curated identity |
| `loreal-elvital-dream-length-defeat-the-heat-150ml` | L'Oréal Paris `525123e1-1376-4fca-91b0-4eeb99c0bc50` | Elvital Dream Length | Create exact line |
| `taft-aloe-boost-hydra-protect-150ml` | taft | Aloe Boost | Create exact brand and line |
| `taft-gliss-lovely-long-150ml` | taft | taft x Gliss Lovely Long | Reuse new taft brand; create exact line |
| `balea-professional-aha-scalp-peeling` | Balea `58bcafd6-a884-4337-8c8d-8d8369f2117c` | Professional `7acc1a31-fe34-4e3a-8ee9-634a0761943c` | Reuse |
| `balea-professional-sensitive-scalp-serum` | Balea `58bcafd6-a884-4337-8c8d-8d8369f2117c` | Professional `7acc1a31-fe34-4e3a-8ee9-634a0761943c` | Reuse |
| `eucerin-dermocapillaire-urea-intensive-tonic` | Eucerin | DermoCapillaire Urea | Create exact brand and line |
| `gliss-scalp-balance-clarifying-serum` | Gliss `1c460ddf-75b8-4db6-9a33-748dfe7a5da0` | Scalp Balance `f1d4f755-ed3c-4762-a15e-8b905e3d1a8b` | Reuse; do not create Schwarzkopf GLISS |
| `head-shoulders-derma-x-pro-scalp-leave-in` | Head & Shoulders `354b561c-5a0f-400c-8d89-39bc7231876b` | Derma X Pro | Create exact line |
| `isana-professional-aha-pha-scalp-peeling` | Isana `c3481711-82bb-436b-8ae8-654f013387c6` | Professional `e117d1fb-1398-42da-9bcb-669b9696f6b1` | Reuse |
| `loreal-elvital-fiber-booster-scalp-serum` | L'Oréal Paris `525123e1-1376-4fca-91b0-4eeb99c0bc50` | Elvital Fiber Booster | Create exact line |
| `the-ordinary-multi-peptide-hair-density-serum` | The Ordinary | none | Create exact brand |

Identity decisions:

1. **Resolved by Nick-requested current first-party research on 2026-08-09:** create `Elvital Dream Length` and `Elvital Fiber Booster` as specific one-level lines. L'Oréal presents Dream Length as a 17-entry hair-care series containing Defeat the Heat, and Fiber Booster as a three-product shampoo/conditioner/serum routine and series. `Anti-Haarverlust` remains a marketing descriptor, not part of the canonical line name. Evidence: [Dream Length series](https://www.loreal-paris.de/haarpflege/elvital/dream-length) and [Fiber Booster series](https://www.loreal-paris.de/haarpflege/elvital/fiber-booster).
2. **Approved by Nick on 2026-08-09:** model `taft` as the canonical brand, with `Schwarzkopf taft` retained as the reviewed display text and an exact brand alias. This follows the catalog's existing treatment of Schwarzkopf sub-brands such as got2b and Gliss.

The seed step must fail if any target identity now exists under a different ID or parent. It must never rewrite a canonical name. Jean&Len and L’Oréal duplicate cleanup remains a separate follow-up.

## 5. Data and security contract

### Resolved package

The preflight emits the exact UTF-8 output of the existing shared `stable()` key-sorted serializer and its lowercase hex SHA-256. It contains only:

- batch ID, accepted base SHA, and B0 content/index fingerprints;
- one exact record per approved product key;
- resolved category, brand, line, expected image URL, approved image provenance, identifiers, product fields, category specs, and protocols;
- the reviewed commercial timestamps/values that passed the bounded freshness check.

Current schema/table readiness, identity/duplicate reads, Storage observations,
and preflight time remain read-only preflight evidence rather than canonical
package fields. Including volatile observations in the package would change the
batch fingerprint on every safe retry and break idempotency. The accepted base
SHA plus required-table checks bind the expected schema contract; the RPC binds
`reviewed_by=nick` separately at apply time.

That exact `stable()` output, rather than `JSON.stringify()` or a separately reserialized object, is sent to the RPC. The RPC evaluates `encode(extensions.digest(convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex')`, compares it with the confirmed lowercase-hex fingerprint, and only then parses the same text to `jsonb`.

### Database migration

Create the migration with the repository command after entering the accepted B1 worktree; do not invent or renumber a migration filename. It must:

- replace the `product_identifiers.identifier_type` constraint so it includes the already-approved `manufacturer_sku` type alongside the existing values;
- install `pgcrypto` idempotently in the `extensions` schema and schema-qualify `extensions.digest` from the empty-search-path RPC;
- create `catalog_enrichment_applied_items`, keyed by `(batch_id, product_key)`, with batch/content fingerprint and resulting product ID;
- enable RLS and grant no anon/authenticated access to the ledger;
- create the exact reviewed brand/line/alias seeds from section 4 with collision and parent checks;
- create `catalog_enrichment_apply_batch(p_batch_json text, p_expected_batch_fingerprint text, p_reviewed_by text)` as `SECURITY DEFINER SET search_path = ''`, using only fully qualified relations;
- revoke function execution from `PUBLIC`, `anon`, and `authenticated`, and grant it only to `service_role`;
- avoid dynamic SQL/table names and allow only the six destination relations: `products`, `product_image_assets`, `product_identifiers`, the two category spec tables, and `product_application_protocols`.
- require every Heat protocol row to use `role = 'pre_heat_protection'`; require every Scalp protocol row to use a non-Heat role accepted by the existing category/role constraint.

### Transaction and idempotency

One RPC call owns one database transaction for the exact 15-item batch:

1. Acquire a batch advisory transaction lock, then deterministic per-product identity locks.
2. Validate the exact batch ID, item count, allowed categories, content fingerprint, reviewer, live identity IDs, commercial values/timestamps, identifier absence, and duplicate absence.
3. For an existing ledger row with the same fingerprints, verify the referenced rows and return the original product ID.
4. For an existing ledger row with a different fingerprint, fail.
5. Insert each product, approved `product_image_assets` provenance row, identifier, category spec, protocol, and ledger row.
6. Any invalid item or insert error rolls back every database row in the batch.

The RPC must never touch submissions, user usage, notifications, customer messaging, credits, analytics, or feature flags.

### Storage boundary

Storage cannot share the Postgres transaction. Apply therefore:

1. Recomputes every local final asset SHA-256.
2. For an absent immutable batch-scoped path, upload with `upsert: false`.
3. For an existing path, downloads it and requires byte-identical SHA-256.
4. Stops before the RPC if any object differs.
5. Calls the atomic DB RPC only after all 15 paths are verified.

If DB apply fails after uploads, the command reports the newly uploaded, unreferenced paths. It does not delete them. A same-fingerprint retry reuses them; cleanup requires separate explicit authorization.

## 6. Operator commands and confirmation contract

Exact script names may be adjusted once the accepted base is inspected, but behavior is fixed:

```text
npm run products:intake:catalog-enrichment:b1:preflight -- --batch personal-plan-launch-v1
npm run products:intake:catalog-enrichment:b1:apply -- \
  --batch personal-plan-launch-v1 \
  --apply \
  --confirm \
  --confirm-batch personal-plan-launch-v1 \
  --reviewed-by nick \
  --expected-batch-fingerprint <preflight-fingerprint> \
  --expected-content-fingerprint <b0-index-fingerprint>
npm run products:intake:catalog-enrichment:b1:verify -- --batch personal-plan-launch-v1
```

Preflight and verify are read-only. Apply defaults to dry-run and refuses to write unless every confirmation is present and current. The B1 implementation/PR verification will exercise only mocked/local apply paths; no linked apply command is authorized by plan approval.

## 7. Target surfaces

The implementation worker may refine names, but not responsibilities:

- `data/catalog-enrichment/personal-plan-launch-v1/**` and `ops/catalog-enrichment/personal-plan-launch-v1/**`: transplant the exact reviewed B0 inputs and assets.
- `src/lib/product-intake/catalog-enrichment/**`: package parsing, canonical serialization, fingerprints, live-state comparison, apply guard parsing, and result contracts.
- `scripts/product-intake/catalog-enrichment/**`: preflight, apply orchestration, Storage verification, and post-write verification.
- a new Supabase migration created by `npm exec -- supabase migration new catalog_enrichment_batch_executor`: identifier constraint, exact identity seeds, ledger, grants/RLS, and RPC.
- narrow local TypeScript contracts for the resolved RPC input/result and supported identifier behavior; this repository has no generated `Database` type surface to update.
- `package.json`: only the three bounded B1 commands.
- focused TypeScript and SQL contract tests plus a B1 verification receipt.

Routine, Application, and Stage 3 consumers change only if the accepted base proves the existing category contracts cannot read the already-reviewed tables. Any such change returns to plan hardening instead of being inferred during implementation.

## 8. Implementation sequence

1. **Accept and isolate the base.** Recheck PR #344 head/checks. Create a clean `codex/personal-plan-catalog-enrichment-b1` worktree from the explicitly accepted head or successor. Preserve the B0 worktree and transplant only task-owned B0 artifacts.
2. **Re-run B0 verification unchanged.** Confirm the 15 manifests, review boards, asset hashes, commercial values, and B0 tests are identical after transplant.
3. **Build the read-only preflight first.** Make it fail closed on item count/key drift, fingerprints, images, schema/migrations, categories, identities, duplicates/identifiers, commercial state, or target Storage conflicts. Persist the resolved package outside tracked source unless deliberately retained as a review receipt.
4. **Add the additive migration and contracts.** Implement the identifier constraint, exact identity seeds, ledger, least-privilege RPC, approved image-provenance insert, and narrow TypeScript input/result contracts. Test SQL behavior locally without applying it to the linked project.
5. **Implement the guarded apply orchestrator.** Upload/verify Storage first, call one RPC, report created/reused objects and returned product IDs, and expose no generic write primitive. The reviewed batch paths are immutable: a same-path/different-hash object fails rather than overwrites.
6. **Implement the independent verifier.** Read all 15 IDs and prove exact products, recommendation availability state, identifiers, specs, protocols, image URLs/object hashes, ledger fingerprints, and zero duplicate identities/products.
7. **Prove no unrelated side effects.** Tests and code review must show no writes to submissions, user usage, notifications, credits, analytics, or flags.
8. **Run implementation-loop readiness and review.** Execute focused tests, local Supabase migration/DB tests where available, TypeScript/ESLint, B0 regression verification, `npm run ci:verify`, ready-check, and the single repository review router.
9. **Stop at a review-ready local tree.** Commit/push/draft PR require `ship-it` authorization. Linked migration apply, upload, and exact 15-product catalog apply remain a later, separate guarded handoff.

## 9. Verification oracle

At minimum, automated coverage must prove:

- stale manifest review, B0 index, local image, commercial, migration/schema, identity, duplicate, or Storage state is rejected;
- no write path runs without every confirmation flag and both expected fingerprints;
- only the exact 15 approved keys and two categories are accepted;
- `manufacturer_sku` migrates and writes successfully for Jean&Len, Eucerin, and The Ordinary;
- all seven Heat protocols use `pre_heat_protection`; every Scalp protocol uses its approved non-Heat role;
- one invalid identifier/spec/protocol rolls back all 15 database writes;
- same-fingerprint retry returns the same product IDs; conflicting fingerprints fail;
- an existing same-hash Storage object is reused and a different-hash object blocks before DB apply;
- a DB failure after upload leaves zero catalog rows and reports any new unreferenced object paths;
- post-write verification detects any missing or changed product, `product_image_assets` provenance, identifier, spec, protocol, image, or ledger row;
- unavailable Balea 2-Phasen and taft Aloe Boost are inserted with `is_active = true` and explicit `is_chaarlie_recommended = false`; the other 13 receive explicit `true` recommendation values rather than database defaults;
- submissions, user usage, notifications, credits, analytics, and feature flags remain untouched.

The local verification receipt records exact commands, pass counts, expected environmental limitations, B0 artifact hashes, accepted base/head, migration filename, and the final B1 tree SHA.

## 10. Reviewed backend operator journey

Nick approved this journey on 2026-08-09 with implementation explicitly waiting for a green accepted PR #344 base.

1. The operator enters the clean B1 worktree on the accepted Personal Plan base; all Personal Plan flags remain off.
2. The operator runs preflight. It reads the 15 reviewed manifests/assets plus current linked DB, Storage, and commercial state and writes nothing.
3. Any ambiguity or drift stops with the exact product/field and expected versus observed values; there is no “continue anyway” switch.
4. A successful preflight displays the 15 resolved brand/line IDs, availability/recommendation state, expected image paths, and the batch/content fingerprints.
5. A later explicitly authorized apply repeats every read, verifies or uploads byte-identical images at the 15 reviewed immutable paths, then calls one atomic RPC for all 15 products.
6. Any DB failure rolls back all product-side rows. Already-uploaded objects are reported as unreferenced and retained for safe retry; nothing is automatically deleted.
7. A same-fingerprint retry is idempotent. Changed content or live state must return to review and produce a new preflight fingerprint.
8. The verifier proves all 15 products and their identifiers/specs/protocols/images/ledger rows, as well as the absence of duplicates and user-side effects.
9. Completion means catalog data is ready. It does not deploy, enable flags, change recommendations, or activate the Personal Plan journey.

## 11. Stop and authorization boundaries

- Nick's plan sign-off authorizes implementation in a clean B1 worktree only.
- “Ship it” separately authorizes commit, push, and a draft PR after readiness/review.
- Applying the migration is a production database write and requires separate explicit authorization.
- Uploading the 15 images and applying the exact catalog batch require a final Product Intake handoff naming the exact batch and explicit confirmation of the write action.
- Repeated same-fingerprint failures do not create new object paths; the 15 immutable paths are reused. Any unreferenced uploaded objects remain deliberately retained for retry, and cleanup is a separate authorized action.
- A successful but later-disputed catalog apply has no automatic destructive rollback command. Correction uses a separately reviewed forward fix or an explicitly authorized exact-batch removal plan.
- Deployment, feature activation, monitoring, merge, and cleanup are independent later decisions.
