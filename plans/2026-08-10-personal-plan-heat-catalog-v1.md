# Personal Plan Heat catalog v1

## Execution contract

Outcome: a guarded, Heat-only seven-product catalog-enrichment package.

Scope: Heat manifests, executor migration and operator tooling only; no Scalp rows, uploads, migration application, catalog apply, or runtime-policy changes.

Verification: exact-seven and 5/2 invariants, manifest/index fingerprints, preflight guards, and inherited evaluator integration coverage.

Stop: review-ready local changes only; no production or Supabase write.

## Evidence and decisions

This is the Heat-only rewrite of reviewed PR #345, transplanted without content changes from #344 head `e38df06a` onto its merged `main` squash `1261924`. Source manifests retain `personal-plan-launch-v1`; execution ledger identity is `personal-plan-heat-launch-v1`; package schema is `personal-plan-catalog-enrichment-heat-v1`. The canonical seven-manifest `cohort_index_fingerprint` is `f4edd43d54f9604b6287a86e5187a18bd44b4084260b0458ccbcde56cb6ee5f7`; the currently approved resolved package fingerprint is `b7b0148bdf59c723c15e7af0627c3acf8a8ff04fdf261d2fe6ad825cdf3ce91a`.

The combined 114-record baseline from PR #345 remains preserved in the immutable archive but is intentionally not tracked in this Heat-only slice because it describes the broader Heat+Scalp audit and carries no Heat execution input. The exact seven Heat manifests and their shared approved schema are retained.

Canonical identity reconciliation is fixed, not discovered at apply time:

| Product key                                         | Canonical brand | Brand ID                               | Canonical line           | Line ID                                |
| --------------------------------------------------- | --------------- | -------------------------------------- | ------------------------ | -------------------------------------- |
| `balea-two-phase-200ml`                             | Balea           | `58bcafd6-a884-4337-8c8d-8d8369f2117c` | none                     | none                                   |
| `balea-ultralight-200ml`                            | Balea           | `58bcafd6-a884-4337-8c8d-8d8369f2117c` | none                     | none                                   |
| `got2b-schutzengel-200ml`                           | got2b           | `a286e2c2-6b44-41f3-a37b-f57d4ed1e93c` | none                     | none                                   |
| `jean-len-beat-the-heat-100ml`                      | Jean&Len        | `d1a06eff-1c23-472e-908e-f5364edb1bec` | none                     | none                                   |
| `loreal-elvital-dream-length-defeat-the-heat-150ml` | L'Oréal Paris   | `525123e1-1376-4fca-91b0-4eeb99c0bc50` | Elvital Dream Length     | `424f3e04-4a35-4b52-a23a-a33c06b996b7` |
| `taft-aloe-boost-hydra-protect-150ml`               | taft            | `7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1` | Aloe Boost               | `4cfd54ce-fd3f-4d5a-a06d-ff4b74163480` |
| `taft-gliss-lovely-long-150ml`                      | taft            | `7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1` | taft x Gliss Lovely Long | `33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf` |

Wella remains a separate protection-first Product Intake. This slice does not use a leave-in/oil home category or widen Stage 3 into cross-category discovery.

The inherited #344 evaluator remains the authority for category-aware missing facts and deterministic selection. Heat manifests do not invent `suitable_thicknesses` or catalog-ranking fields.

Planning evidence: the existing Stage 3 mobile search surface was reviewed at `/Users/nick/.codex/visualizations/2026/08/09/019fe7dd-f3f6-7ef0-9607-a6b60d65e60d/heat-stage3-search-surface.png`. Nick explicitly signed off the unchanged user journey: qualifying Heat need enters the existing Hitzeschutz search, five available rows can be selected, and the two retained owned-but-unavailable rows show no purchase action. This slice changes catalog data only; no new user-facing surface or copy is introduced.

The reviewed source is retained at `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-catalog-enrichment-b1`; immutable evidence archive is `/Users/nick/AI_work/hair_conscierge-archives/pr345-heat-scalp-evidence-43cdf380-20260810`. Both evidence worktrees are retained and must not be cleaned; they are not currently Git-locked. Wella and Scalp are explicit exclusions.

## Test-first receipt

Red: `npx tsc --noEmit --pretty false --incremental false` initially exposed retained B1/Scalp test and executor assumptions during the Heat-only transplant.

Green target: `npm run test:catalog-enrichment:heat` after the seven-manifest fixture proves no-thickness acceptance and recommendation selection is invariant to input order and UUID values. The preflight CLI requires `--reviewed-head` and `--expect-migration=absent|applied`; apply invokes the same preflight implementation in-process immediately before any write.

Green: `npm run test:catalog-enrichment:heat` passed (30/30) after release-context, clean/exact Git-head, exact linked-project migration-state, source-provenance, adapter-routing, conditional pre-migration ledger, immutable-package, and generic manifest-rejection safeguards. The test command now includes the restored catalog-enrichment validator suite so a missing test file cannot produce the earlier false-green seven-test receipt. With lockfile-matched local dependencies installed, `npx tsc --noEmit --pretty false --incremental false` passed with no errors.

Absent-preflight red/green proof: a production-shaped fixture with the existing Balea, got2b, Jean&Len, and L'Oréal brand rows but no migration-owned Taft brand, Heat product lines, or Taft alias initially failed with three canonical-identity blockers. The corrected absent mode now accepts only missing or byte-exact migration seeds, while tests prove it still blocks normalized-name collisions, incompatible IDs/names, parentless partial identities, an unexpectedly present executor ledger, local migration-seed drift, and missing applied-mode identities. Applied mode remains exact-row-only. The same audit corrected the unapplied L'Oréal seed normalization from `l oreal paris` to production-compatible `loreal paris`; the local migration seed block and TypeScript seed contract are independently fingerprint-pinned.

Red/green evaluator proof: the real seven-manifest fixture initially failed when its expected selected display name included the brand although the inherited evaluator ranks and returns the manifest clean name. With candidate facts assembled from the manifests (five recommendable/available, two excluded; `suitableThicknesses: []`), the fixture verifies a recommendation remains available and UUID/input-order changes do not affect its price/name-selected identity.

Disposable database proof: `npm run test:personal-plan-db` passed all 209 assertions after restoring the pre-transition Heat readiness seed, asserting #344's category-readiness migration, reconciling the required L'Oréal parent identity, qualifying ledger columns shadowed by the table-return contract, and rejecting bidirectional partial-ledger retries. The generated real seven-manifest package is exercised transactionally and idempotently by that harness. Its SQL executor recomputes the raw canonical package hash and requires the immutable approved fingerprint, so an allowed-key product-body mutation with an attacker-recomputed hash is rejected atomically. No linked or production database was used.

Repository proof: `npm run test:personal-plan` passed 907/907, `npm run test:node` passed 3195/3195, and `npm run ci:verify` passed typecheck, lint (four inherited warnings, zero errors), and the production build. The live chat suite was not run with production credentials because it persists evaluation conversations and would violate this task's no-production-write boundary.

## Residual release gates

No asset upload, migration application, catalog apply, activation, merge, deployment, production write, or cleanup is authorized. Commercial observations dated 2026-08-09 expire after seven days and must be refreshed before a later release gate; any changed observation requires regenerating and re-reviewing the cohort and immutable package fingerprints.

Later operator journey only: preflight requires a clean worktree at the exact reviewed Heat PR head, the exact linked Supabase project `pqdkhefxsxkyeqelqegq`, and the expected migration state; it reports all cohort/hash/count/release fields. Before migration, it proves the migration-owned identities are absent or exactly idempotent and that the executor ledger is still absent. Following a separately authorized migration, it requires every seed and the ledger to exist exactly. Apply additionally requires `--apply --confirm`, the exact Heat execution batch, reviewer `nick`, and both exact fingerprints; it reruns the canonical preflight immediately before writes, verifies its exact release envelope, then may upload exactly seven approved assets and invoke only the Heat RPC. A later verifier confirms seven ledger rows, assets, specs and protocols. Any mismatch stops; there is no automatic correction or cleanup.

Preservation/commit gate: the seven task assets total 216,444 bytes and match both preserved evidence worktrees byte-for-byte. Before either evidence worktree or archive can ever be considered for cleanup, an authorized Heat commit must show exactly seven approved WebPs in `git ls-tree`; their paths, count, total bytes, and SHA-256 values must match the manifests and preserved sources. Later Scalp/richer-evidence disposition remains a separate explicit decision.
