# Oil research → Product Intake bridge v1

2026-10-12. Planning deliverable; no adapter, runtime, database or activation change in this pass.

Status: counterpart review completed, **Approve with revisions**; technical revisions incorporated and locally revalidated. Decision coverage remains confirmed. The bounded inactive-adapter plan is ready for implementation; no engine activation, publication or method lock follows from this planning verdict. See the [review reconciliation](reviews/oil-intake-bridge-v1-plan-reconciliation-2026-10-12.md).

## Outcome and chosen direction

Build a local, deterministic adapter for the settled oil research profile, following the Leave-In artifact/projection pattern. Retain the complete research record and its evidence; project only the existing oil singleton fields. Prepare an intake helper, but leave automatic oil-engine routing inactive. Current ordinary oil intake and existing catalog rows continue under their current contract. This plan does not declare the research method production-locked.

Nick approved the smaller first version: **manual matching tags for v1**. No new mapping from formula base/weight to the old subtype/purpose tags, no flattening of conditional scenario fit, and no new persistence matching penalty. This is the chosen direction, not a temporary alternative.

Done when: the plan gives implementers exact input/output contracts, field ownership, source and identity checks, manual-review boundaries, named verification, preservation rules and an explicit activation stop. The implementation is done only when its local adapter, inactive helper, tests, replay evidence, documentation and review pass are complete.

## Evidence and baseline

Research authorities are [standard v0.8](../../docs/research/oil-inci/v1.0/02_classification-standard-v0.8.md), [property set v0.2](../../docs/research/oil-inci/v1.0/01_property-set-v0.2.md), [operating guide v0.2](../../docs/research/oil-inci/v1.0/11_operating-guide-v0.2.md) and [current finalization status](oil-engine-finalization-status-2026-10-12-v0.5.md). The [37-product inventory](../../data/research/oil-inci/v1.0/corpus/holdout/targeted-coverage-v0.1/current-view-v0.2/combined-profile-inventory.json) selects 27 consolidated development profiles, six first new-formula profiles and four corrected targeted profiles. The superseded original targeted T02 is excluded.

Integration code was inspected on clean primary `main` at `91b013a5f2b594379dd310da85b2a5c67079c750`. The research worktree is `codex/oil-inci` at `21e0e41fa996ec6a725c258ab3766971f0edb94d`, zero commits ahead and 25 behind that inspected main (historical planning baseline), with task-owned uncommitted research. Planning stays here. Before implementation, refresh/recheck main and use a fresh task worktree; transfer only the owned research/plan additions with a hash manifest. Reconcile README/skill routing changes as hunks against current main; do not copy the stale entire files, rebase dirty research, or move unrelated work/stashes.

Review completion rechecked all 14 integration-file hashes on clean primary main at `dd60acc4e89c40b21d5e3fe39c5834915b74c3be`; all match the original inspection. All 12 policy hashes and 93 preserved research files also match. Refresh and recheck these dependencies again at implementation kickoff.

Current-main evidence (paths refer to the primary integration checkout `/Users/nick/AI_work/hair_conscierge`, not the stale research worktree):

- `src/lib/product-intake/category-research-router.ts`: oil is `unavailable(oilApprovalContract)`, while active engines receive `final`, `artifacts`, `expectedResearchId`.
- `src/lib/product-intake/leave-in-research-adapter.ts`: preserves the envelope under `property_synthesis`, replaces only owned projected fields/rationales, and reports projection readiness separately.
- `src/lib/product-intake/category-validators.ts`: oil requires singleton weight/role_support/heat and nonempty legacy eligibility; required protocol roles derive from role_support.
- `scripts/product-intake/codex-research-worker.ts`: source protocol stage, artifact append and final reviewed-payload readiness are separate from projection.
- `src/lib/oil/constants.ts`: legacy flags are silicones/polymers/oils/proteins/humectants, not the research five booleans.
- `src/lib/personal-plan/products/authority/catalog-facts.ts` and `categories/oil.ts`: eligibility is binary by thickness; it cannot preserve role/scenario conditions. Stage 3 uses verified roles, weight, eligibility and protocols. Legacy Chat separately uses subtype/purpose. Neither consumes canonical persistence.
- The effective approval wrapper chain saves heat separately from weight/roles. The initial hypothesis of dropped heat was rejected after tracing the complete migration lineage; no repair is planned.
- Generic enrichment omits `product_oil_specs` from its allowlist, and cockpit property-row enumeration omits that singleton. This v1 must not claim generic-enrichment or cockpit completeness. It produces an offline review summary and an inactive helper; neither omitted route is activated or repaired by this plan.

## Authoritative interface and ownership

`oil-research-envelope-v1` is a complete, versioned research carrier, not a three-field shortcut. `src/lib/oil-research/contracts.ts` owns its strict schema. Required roots:

| Root | Required content |
| --- | --- |
| version / research_id / submission_id | Literal version, stable exact-product research key, UUID or null for offline use only. Intake helper requires the exact expected submission UUID. |
| research_method | `purpose: consolidation_serialization` and the whole pinned tuple for current standard, property set, operating guide, shared/oil persistence guidance, natural weight v0.10, blend policy v0.2 and thickness/pattern/damage policies. Registry owns actual SHA-256 literals computed from frozen bytes. Never mix consolidation tuples. This pin validates the current carrier/consolidation policy; it does not certify that historical research used that standard. |
| identity | Source-bound brand/product/market declaration, nullable variant, package declarations and identifier under the exact mapping below; verified category boundary and source IDs. Missing recorded metadata is explicit; unresolved product/formula ambiguity blocks admission. |
| formula | Complete raw INCI, complete ordered raw/canonical rank records, literal normalization receipt, raw UTF-8 and ordered-normalized SHA-256 digests, source IDs, declaration status/conflicts. Preserve numeric commas such as 1,2-Hexanediol. No implicit species, plant-part, grade or cross-market alias. |
| profile | Every direct field from the current property set, complete ordered mechanism ledger and auxiliary-context record, all eight metadata keys for non-persistence properties, complete source-supported uses/scenarios and completion status/issues. Persistence is exactly one scalar low/moderate/high. |
| persistence_trace | Reason, exact rank/name evidence, all considered ranks, tipping assumption and the admitted retained-fibre context, bound to a source/direction. No alternative persistence class or computational confidence. |
| scenario_fit | Complete role/scenario-specific thickness, pattern and damage records, including conditional reasons, source/direction IDs, policy pins and weight authority. Never use historical global placeholder fit as an overall verdict. |
| sources / provenance | Source registry and product/formula/context bindings; stage/seal/run references and per-field inherited authorities retained. All referenced source/direction IDs close within the envelope's evidence. Historical original records and authority files remain immutable. |

Historical identity import is explicit across all three selected corpora. Preserve `identity.original` deeply unchanged, plus field-to-source mapping receipts. Brand/product copy literally; `market` copies the original market declaration (not an inferred ISO country). Canonical package is `{size_text: string|null, size_ml: number|null, combined_declaration: string|null}`. Variant is the explicit original variant if present, otherwise null with absence recorded; do not infer “Original”, scent or a formula variant from silence.

| Frozen identity shape | Canonical mapping |
| --- | --- |
| `size_ml`, `market`, optional `gtin_if_verified` | `package.size_ml = size_ml`; size_text/combined_declaration null. Identifier copies gtin_if_verified or null. Preserve gtin_source_id, gtin_corroborating_source_id, gtin_limit and selection_note in original identity and bind supplied source IDs. |
| `size`, `market`, optional `gtin_if_verified` or `identifier_if_verified` | `package.size_text = size` literally; size_ml/combined_declaration null. Identifier copies the supplied verified field, otherwise null; conflicting non-null identifiers block import. Applies to older development, six new-formula and four targeted profiles. |
| `market_size` only (development O25–O28) | `market` and `package.combined_declaration` both retain market_size literally; separate size_text/size_ml null. No automatic splitting, unit conversion or choice between package options. Identifier null unless the resolved exact source authority supplies one. |

Missing barcode, an unrecorded separate size or an absent separate variant does not by itself invalidate a source-bound product/formula. A conflicting or ambiguous formula/variant still yields needs_research. Missing brand/product or source binding also blocks admission. This mapping preserves recorded evidence rather than claiming package verification that did not occur. Never manufacture a market/identifier source ID to satisfy closure.

`research_id` is exactly `oil:${product_key}` using the inventory's unique product_key; preserve case_id separately as provenance. `submission_id` is null offline or the actual intake UUID. The helper compares **submission_id** to its required expectedResearchId argument; it does not compare that UUID to research_id.

Required `provenance.original_method` records `{run_id, path, sha256, declared_version}` from the original profile container; declared_version is the recorded declaration or null with an explicit unrecorded note, never the current version by default. Retain every field_authority and trace reference with its original method/version evidence separately: a container run is not one uniform historical method. The fixed research_method gate checks current consolidation/serialization policy and source completeness, not a fresh research or production-lock claim.

Keep the original full research record alongside the validated envelope in the artifact, including all original metadata and field-authority references. A historical importer may change representation only through a logged mapping receipt; verify deep preservation of every original property object and scenario. Resolve historical `field_authority.path + record_key + sha256` and trace references during local export. Do not relabel inherited mixed-version decisions as freshly performed v0.8 research. The envelope declares current consolidation/serialization policy separately from original field provenance.

The pure projector validates a self-contained envelope, hashes and source closure. It does not fetch source pages or resolve arbitrary filesystem paths, and hash integrity is not independent verification of a manufacturer's claims. Source acquisition, independent formula assessment and human review remain the existing research workflow.

Each run's function dictionary, normalization mapping, source packet and stage seals retain their own provenance digests; these variable run dependencies are distinct from the registry's fixed policy tuple. The exporter must resolve them from the frozen run instead of assigning one dictionary to all 37 products.

The input schema is an explicit union: the complete admitted `oil-research-envelope-v1` above, or `oil-scope-exclusion-v1`. The exclusion variant contains exact identity/formula, complete reviewed directions, source registry and an evidence-bound scope reason (pre_wash_only, scalp_only or outside_hair_oil_category); it contains no fabricated profile or persistence field. Unknown/missing directions do not qualify as a verified exclusion. This resolves exclusion before requiring the admitted-profile scalar.

`projectOilForProduction(input: unknown): OilProjectionOutcome` has three exhaustive outcomes: `property_projection_ready`, `needs_research`, `not_applicable`. A ready outcome includes only `category_specs.product_oil_specs`, field rationales, required protocol roles, retained-only field coverage and warnings. This three-field projection cannot satisfy oil approval alone: the strict current oil validator separately requires nonempty product_oil_eligibility and the existing approval/protocol requirements. Neither other outcome contains an applicable spec payload. All outcomes report catalog/global-recommendation/publish readiness false. Malformed exclusion evidence is needs_research, never silent ordinary-lane authorization.

| Research | v1 output |
| --- | --- |
| Known weight light/medium/rich | `product_oil_specs.weight`, unchanged value. Unknown weight → needs_research, not medium. |
| Supported fibre uses | `role_support` intersection with pre_wash_fibre_treatment / leave_on_fibre_conditioning / dry_finish, preserving order/deduplicating. Scalp stays research-only. Require at least one admitted retained fibre role for this engine. |
| Heat boolean | `provides_heat_protection`, unchanged, with source rationale. No ingredient AND requirement or extra pre-heat role. |
| Base, named-oil prominence, dispenser, penetration, UV, research flags, persistence, scenario fit | Full artifact and reviewer summary; exhaustive retained_only coverage. No invented current DB column or legacy flag mapping. |
| Exact source directions | Required role names only. No invented dose, timing, cadence, rinse action or executable protocol. Existing protocol research remains separate. |
| Legacy eligibility, subtype, purpose, ingredient-family flags, product.suitable_thicknesses | Outside adapter ownership. Leave existing candidate values untouched and identify them as requiring manual matching review. |

`applyOilResearchAdapter({final, artifacts, expectedResearchId})` locates exactly one `property_synthesis.payload.oil_research_envelope`, requires expectedResearchId, compares it to envelope.submission_id, and checks the current consolidation/serialization tuple before mutation, then copies only the singleton and its exact rationale subtree. Preserve unrelated product/commercial/identity/protocol/eligibility fields and unrelated artifacts. Attach `oil_production_projection`, retained-only coverage, warnings and required protocol roles next to the untouched original envelope. A refused result must leave `final` unchanged. This exported helper is tested but not registered as an active engine in v1.

Never manufacture compatibility tags to pass today's validator. A research profile may have permitted unknown base/penetration/dispenser/hero fields and still project if weight and source-supported retained use are established. Incomplete identity/declaration/conflicting unresolved formula/missing retained context blocks admission. A verified pre-wash-only or scalp-only product returns not_applicable with its facts preserved, without a low/null/unknown persistence answer or a catalog-exclusion claim. Ordinary intake remains its existing lane while this engine is inactive.

## Manual review and operator outcome

The local command accepts an envelope and a new/empty output directory:

`npm run research:oil:production-adapter -- --input <envelope.json> --output <new-directory>`

It writes `original-input.json`, `research-envelope.json`, `production-projection.json` and `projection-summary.md`; never overwrites frozen/nonempty output or follows an output symlink. Use lstat on the target and each existing ancestor to reject symlinks (including dangling targets), stage writes in the verified parent, and publish the completed directory atomically; do not copy the prior CLI’s --overwrite branch. Input is bounded to 1 MiB. No network, DB, upload, notification or apply action. Exit 0 means property projection only; 1 means needs_research, 3 means not_applicable and 2 means invalid invocation/I/O. The top-level main catches invocation, parsing and I/O exceptions and sets process.exitCode = 2; it sets 1 or 3 only from a successfully produced needs_research or not_applicable outcome. Uncaught-throw exit 1 must not masquerade as a research refusal. Refused outcomes retain the submitted input and diagnostic outcome but no validated envelope or applicable spec payload.

The summary shows every direct property, every persistence/context binding, every permitted gap, each scenario's conditional-fit caveat, exact emitted singleton values and the explicit manual-review list. It must visibly say that legacy matching tags are not derived or approved. The operator then reviews subtype/purpose/thickness/legacy flags separately under the existing Product Intake process; sources/images/commercial fields and executable protocols remain separately required. No ready-for-review, matching approval or publication status follows from this CLI.

This phase changes no customer surface, copy, timing, ranking or feedback and activates no operator UI flow. A rendered UX mockup is not required for the offline CLI/inactive helper. Future cockpit activation must first expose the omitted singleton and full research/caveats in the existing review surface; future generic enrichment must first fix its canonical table allowlist. Those are later activation prerequisites, not implemented or represented as completed here.

Retention is precise: v1 writes immutable local artifacts. The current worker would append property_synthesis as a durable `product_intake_research_artifacts` row when a later activated route uses this helper; that future capability is not live retention evidence for oil. Legacy prepare-research/approve-package does not append that artifact table. A copied envelope in draft is only submission-payload retention, not equivalent artifact retention. This plan does not use legacy manual approval as a workaround for inactive engine routing.

## Decision coverage

Status: confirmed for this bounded planning proposal.

- Confirmed with Nick: canonical committed persistence for oil, leave-on fibre only; rich research retained; existing oils not a cleanup target; no repair/protein-moisture/toning/growth/porosity additions; fit policies unchanged. Latest explicit answer: “Yes—manual matching tags for v1 (Recommended)”.
- Inherited from contract: full profile separate from lossy catalog projection; no source-invented application protocols; source/context admission and two isolated formula lanes; no old binary conversion; no persistence fit penalty; projection is not catalog/recommendation/publish readiness.
- Implementation defaults: reuse Leave-In artifact/projector pattern, strict versioned schema, fixed method tuples, pure functions, new empty output directories, current-schema singleton projection and inactive helper. No new DB column is needed while no production consumer reads the new properties.
- Open consequential assumptions affecting this handoff: none. Automatic matching-tag generation, database persistence columns, legacy backfill, method lock, review-UI/enrichment activation, worker rollout and recommendation/scheduling changes are outside the approved smaller first version. They require a later concrete proposal/authorization rather than hidden implementation defaults.
- Coverage acknowledgement: Nick's “lets do it” accepted defining the Product Intake bridge plan; his explicit follow-up selected the smaller manual-matching v1. This is planning authorization, not commit/push, activation or product publication.
- Internal revalidation: current-main consumers/writers/serializers traced; source-scoped 37-product inventory and v0.8 contracts checked; no assumption that the stale worktree has the current integration code. Integration gaps and prior external-review timeouts are retained as limits.
- Undiscussed consequential assumptions affecting this handoff: none.

## Ordered implementation deliverables

1. **Full envelope, exporter and strict validation.** Add `src/lib/oil-research/{contracts,registry}.ts` plus local exporter under `scripts/research/oil-inci/`. Consumes frozen profiles/fit/traces/sources and their exact authority references; produces full envelopes and representation/preservation receipts in a new `data/research/oil-inci/v1.0/adapter-replay-v0.1/` directory. Reject broken authority keys/hashes and formula/context/source closure; do not rewrite original artifacts. Method registry pins all dependencies listed above, including `reference/blend-weight-policy-v0.2.json`. Add focused `tests/oil-research-contracts.test.ts`. Done when complete valid profiles survive unchanged and malformed identity, rank, hash, scalar, source and metadata examples are refused.
2. **Pure projector and offline review.** Add `src/lib/oil-research/production-adapter.ts`, `scripts/research/oil-inci/production-adapter.ts` and package script. Consumes validated envelopes; produces the outcome contract and exact three-field singleton only. Add `tests/oil-production-adapter.test.ts` and `tests/oil-production-adapter-cli.test.ts` for output boundaries and exit codes. Replay exactly the selected 37 profiles; report actual ready/needs-research/not-applicable counts without forcing success or inventing missing values. Pin H04 (`oil-holdout-h04`, Rahua) to needs_research for unknown weight; its moderate persistence stays unchanged. Record expected per-case statuses/reasons from source admission before running the projector, compare actual results, and investigate discrepancies; do not assume the other 36 are ready before validation. Done when emitted values match each authoritative source profile, retained-only coverage is exhaustive, conditional caveats remain visible, and refused output has no applicable mutation payload.
3. **Inactive intake helper, bridge documentation and verification.** Add `src/lib/product-intake/oil-research-adapter.ts`, `tests/oil-product-intake-adapter.test.ts` and `docs/product-intake-oil-production-adapter.md`. Consumes the projector contract; produces exact owned-field mutation and adjacent artifact receipts. Test stale-field replacement, immutable envelope, complete raw research retention, exact submission binding and no mutation on refusal. Keep `CATEGORY_RESEARCH_REGISTRY.oil` unavailable; use the existing oil engine_not_available case in `tests/product-intake-category-research-router.test.ts:128` as the behavioral regression guard; update engine index/skill only to describe local inactive availability, not activation. Done when focused tests/type checks and full replay receipts pass, ordinary oil route remains unchanged, and counterpart whole-branch review is reconciled before any authorized push.

## Verification and implementation handoff

Before export, run the existing verifier read-only from the task worktree (do not invoke its main, which overwrites verification-receipt.json):

```bash
python3 - <<'PY_CHECK'
import importlib.util, json
from pathlib import Path
p = Path("plans/oil-inci/verify-oil-targeted-coverage-v0.2.py")
spec = importlib.util.spec_from_file_location("oil_read_only_check", p)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(module.validate()))
PY_CHECK
```

Expected: four current-view cases, 64 ranks, seven scenario roles and six corrected ranks, with all frozen checks passing. Retain the prior receipt unchanged. Test the adapter without regenerating historical receipts. Add a new replay verifier that resolves every original authority, compares each full property object and scenario deeply, checks selected T02 successor and unique 37-product membership, then checks only the three declared catalog fields. Test numeric commas, explicit normalization mappings, source conflict, absent/incomplete declarations, missing context, unknown weight, allowed unknown base, stale method tuple, unknown/wrapped persistence, mismatched submission, duplicate synthesis artifacts and unrelated-field preservation. Include a synthetic low-scalar serialization probe, labeled hypothetical and excluded from product accuracy/coverage counts; never claim low-band validation from it.

Use the available `test-audit` skill authoring gate when adding tests; it is a personal skill, not an npm script or a repo-local test runner. Resolve it through the current skill catalog. After implementation adds the named tests, run from the fresh implementation worktree:

```bash
node --import ./tests/server-only-register.cjs --import tsx --test tests/oil-research-contracts.test.ts tests/oil-production-adapter.test.ts tests/oil-production-adapter-cli.test.ts tests/oil-product-intake-adapter.test.ts tests/product-intake-category-research-router.test.ts
npm run typecheck
npm run lint
git diff --check
```

All commands must exit 0. Focus fixtures on schema/admission, independent preservation, exit-code/output boundaries and the helper's real mutation boundary; retain the existing router test rather than adding a source-text assertion of unavailable. Complete the repository ready-check requirements for the eventual implementation branch, including build when required. Local review must inspect all emitted field rationales and manual-review warnings. No browser/DB/migration/live-state tests apply to this inactive phase. Current live Supabase state is not queried or inferred from migrations.

Research classification is not re-run by the deterministic adapter. The 37-case replay verifies serialization and attribution, not unseen classification or sensory accuracy. Zero low examples, missing positive branches, unresolved Rahua preparation, source-scope limitations and the previous two unavailable external correctness reviews remain explicit method-lock/activation limitations. No automatic lock follows from green adapter tests.

Naming is deliberate: scripts/research/oil-inci keeps the exporter next to the existing oil research layout; the package command remains category-specific. property_projection_ready emphasizes that only properties are ready, while not_applicable denotes a verified scope exclusion rather than a catalog rejection. These local outcomes are translated by the inactive helper to the shared blockers/warnings interface, not exposed as registry statuses. The inactive helper remains approved preparation, although mask’s local adapter does not have one.

Planning counterpart: completed read-only terminal Claude (Opus alias resolved to claude-opus-5), high effort, verdict Approve with revisions. The four verified technical revisions and additional precision fixes are incorporated and locally revalidated; no product or scope decisions changed. One counterpart lane only; no nested review or implementation was dispatched. Detailed report is transient; retain a concise findings ledger/reconciliation next to this plan, detailed scratch output outside the repo. Validate findings against the repository. Do not silently accept scope/tradeoff changes. The original conditional verdict is retained verbatim in the receipt; the reconciled implementation-readiness decision is the orchestrator’s, not a claimed second unconditional Claude approval.

Artifacts: commit-intended plan, concise review reconciliation, future implementation/doc/test/exporter files and new immutable replay artifacts. Preserve all existing oil/shared research and task dirt; archive nothing in this pass. Discard transient reviewer output after reconciliation. No commit/push/PR/merge, production writes or activation authorized here.

Next action after plan review: implement deliverable 1 in a fresh current-main-based worktree, then complete deliverables 2–3 as one bounded inactive-adapter change. Stop before any production/worker activation or publication request.
