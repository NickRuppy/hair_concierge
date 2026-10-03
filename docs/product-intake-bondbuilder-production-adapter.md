# Bondbuilder Production Adapter v1

Status: **implemented local projection; exact historical v0.4/current candidate v0.5 pins; live routing disabled**. This is not a locked method, catalogue approval or production write.

## Authority and location

| Layer | Owning location |
| --- | --- |
| Category index, versions and research status | [Bondbuilder engine](research/bondbuilder-inci/README.md) |
| Current candidate method | `docs/research/bondbuilder-inci/v0.5/` — frozen and replayed, coverage/owner lock pending |
| Frozen calibration/validation provenance | `data/research/bondbuilder-inci/v1.0/` |
| Canonical eight reviewed envelopes | [Owner consolidation manifest](../data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02/manifest.json) |
| Strict profile/envelope and registry authority | `src/lib/bondbuilder-research/{contracts,registry,production-adapter}.ts` |
| Submission adapter and server-owned activation gate | `src/lib/product-intake/bondbuilder-research-adapter.ts`, `bondbuilder-research-prompt-contract.ts` |
| Identity, image, commercial fields and guarded publish | [Product Intake](product-intake-research-ops.md) |

The canonical envelopes retain complete original profile objects, hashes and original artifact references. Their manifest records exact source-artifact and envelope byte digests. Original staged items and 23 raw source files remain untouched at `plans/bondbuilder-research-engine/owner-batch-2026-10-02/`. Extraction is not new research or a new blind run.

## Strict wire and integrity

The envelope is `{version: "bondbuilder-research-envelope-v1", submission_id: UUID|null, profile}`. The full profile retains method, exact identity/formula, assessment, technology reference, typed application/cadence, scientific/practical evidence, German explanations, source registry, independent fit, holds and review authority. The contracts file owns the closed schema; a short prompt summary cannot replace it.

The adapter validates whole `BOND_ACCEPTED_METHOD_PINS` tuples, complete ordered raw/list hashes, profile digest, source closure, literal markers, exact identity/source-version and the trusted owner registry. Offline history accepts v0.4; prepared future intake additionally requires `BOND_CURRENT_METHOD_PINS` v0.5 and exact submission ID. Mixed-release tuples fail in TypeScript and SQL. An unfamiliar eligible identity defaults to `low` / `owner_default`; a technology match cannot award a higher grade. Owner rulings are policy provenance, not guaranteed efficacy. Standalone replay permits null submission ID because it is offline.

Reference `formula_sha256` is the trusted reference's normalized formula digest, not its raw-text digest. `shared_markers` must copy exact lowercase literals present in both ordered normalized formula lists. Do not copy display-case INCI spellings into this field. The October 3 run preserves the original refused profiles and an explicit casing-only amendment; the adapter itself does not silently normalize or relax the reference binding.

## Full retention and projection

| Research truth | Current storage/use |
| --- | --- |
| Entire strict profile, including unsupported facts and provenance | `product_bondbuilder_specs.research_profile` |
| Family, trust tier and basis | `technology_family`, `claim_trust_level`, `trust_basis`; must agree with the profile |
| Producer-bound placement/format/timing/conditioner/sequence | Typed source-bound protocol projection; missing execution facts stay held |
| Initial/maintenance/conditional frequency | Full typed cadence; only supported unbranched producer labels become display copy, never extra wash scheduling |
| Facts unsupported by today's runtime | Exhaustive `direct` / `mapped` / `retained_only` / `held` coverage receipt, not omitted data |

No intensity, repair axis, efficacy score, thickness eligibility or recommendation is invented. Complete legacy rows remain compatible. Profile-only enrichment preserves existing product identity, commercial data, legacy facts, fit approvals and executable protocols through a guarded transactional preimage check. A valid low/default owner submission may retain research without an executable routine protocol; it remains user-submitted and not recommended. Normal approval remains strict.

## Local replay

```sh
npm run research:bondbuilder:production-adapter -- \
  --input data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02/P01.json \
  --output <new-or-empty-artifact-directory>
```

Writes `research-envelope.json` and `production-projection.json` (complete outcome, coverage, warnings and readiness). Exit 0 means projected; exit 1 means refused. It never accesses the network or database. It refuses nonempty, symlink or non-directory output, bounds input to 1 MiB, and has no overwrite flag. Never replay into a frozen historical directory.

## Live boundary and rollout

`property_projection_ready` is not protocol readiness, catalogue intake readiness, global recommendation readiness or publish approval. All eight canonical envelopes are unbound research inputs, not apply payloads.

The worker enforces its server-owned disabled gate after model output, including unsolicited envelopes and direct new fields. Ordinary Product Intake remains authoritative. Activation requires a separately locked/validated method with matching pins, exact source-market/product bindings, migration prerequisites, verified consumers and an explicit activation decision. Do not flip the flag merely because offline fixtures pass.

Prepared migration: `20261002132306_bondbuilder_research_profile_storage.sql`. Shared binding-repair prerequisite: `20260929230000_expansion_protocol_binding_repair.sql`. Both were unapplied in read-only release preflight. Do not run a blind database push. Migration, catalogue apply, promotion and deployment are separate approvals. The [implementation receipt](../plans/bondbuilder-research-engine/implementation-receipt-2026-10-02.md) records verified behaviour and remaining limits.
