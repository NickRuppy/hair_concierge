# Bondbuilder adapter grounding

2026-10-02. Local source inspection requested by Nick after approving the storage/compatibility approach. No runtime edits, research run, migration, live database call, publication or activation. Commit-intended evidence for the [implementation plan](implementation-plan-2026-10-02.md).

## Finding

Reuse the existing **complete research → deterministic usable projection** pattern. The projection may be smaller; it is never the research authority. Bondbuilder additionally must retain **all product-level researched properties in the product's database `research_profile`**, not just in an intake artifact or filesystem archive. This implements Nick's explicit clarification; it does not add comparison dimensions or revive intensity.

## Current prior art

| Owner | Verified pattern / limitation |
| --- | --- |
| `src/lib/leave-in-research/production-adapter.ts:454–466` | Research weight `low/moderate/high` → usable `light/medium/rich`; research diameter `medium` → DB `normal`. These are explicit vocabulary conversions, not new research. |
| Same file `916–933` | Conditioning + persistence derive `replacement_capable`/`booster_only` and the corresponding role; source-backed application stage or hold support adds styling preparation. Formula is not used to invent directions. |
| Same file `407–417,1239–1265` | Detailed properties are explicitly listed as omitted from the usable projection; uncertainty produces visible warnings. The reduced projection cannot reconstruct the research. |
| Same file `800–900` | Strict method/identity/formula integrity and mapped-unknown refusal. This is category policy, not a blanket rule to copy into Bondbuilder's approved nullable fact path. |
| `src/lib/product-intake/leave-in-research-adapter.ts:106–158` | Bind the envelope to the actual submission before mutating final fields; replace only adapter-owned specs/rationales; add projection/warnings/omissions to the original artifact without deleting its research. |
| `docs/product-intake-leave-in-production-adapter.md`, “Deterministic projection” | The trimmed envelope is only adapter input. Complete dimensions, Hinweise and trace must also be retained alongside it in `property_synthesis`. The guide's earlier v1.0 method wording/pin is stale against the actual v1.1 code; do not copy that pin into a new engine. |
| `src/lib/conditioner-research/production-adapter.ts:72–136,163–175,422–497`; intake bridge `36–98` | Full nine-property research, explicit five-property omission list, narrow specs plus evidence-preserving bridge. Mapped uncertainty can warn without refusal; do not silently inherit that behavior for another category. |
| `src/lib/shampoo/production-light-adapter.ts:460–525,599–615` | Strict, pure, fail-closed smaller projection with separate `property_lane_ready`. The current worker does not invoke this projector; a standalone adapter alone is not sufficient intake integration. |
| `scripts/product-intake/codex-research-worker.ts:1299–1321,1928–1944,1946–1955,2387–2418`; `packages/product-intake-core/src/repository.ts:159–180` | Complete artifact payload is retained and inserted independently from final preview; adapter output is reread before validation. Category allowlists still narrow final specs. The Bondbuilder profile must survive those boundaries deliberately. |

Scope of evidence: inspected task HEAD `fae51dbf72b68de8849190b8b15b459b86f9ecf0`; inspected leave-in adapter/bridge/worker/guide paths have no difference against fetched `origin/main`. This is not a live deployment or runtime-test claim. Historical review memory supplied retention traps; the current source confirms the identity/formula and stale-reference fixes are present.

## Bondbuilder: retain everything, adapt only where truthful

The [storage contract](storage-contract-proposal-2026-10-02.md) owns vocabularies and limits. All properties named in draft-v0.4 §3 and all §6 application facts require a typed persisted destination, including per-property confidence, rationale, source scope, limitations and explicit unknown reasons. The five compact comparison properties are not a whitelist of everything we retain.

| Researched property | Complete persisted destination | Usable projection |
| --- | --- | --- |
| Category, technology, trust/basis, classification confidence | `assessment`, `formula` marker observations, `evidence`; scalar technology/trust/basis are consistent indexed projections | No technology→legacy repair-axis coercion or automatic promotion. Unresolved boundary/identity remains an artifact, not a final spec. |
| Supported outcome, scientific/practical evidence, counterevidence, explanations | `evidence`, `sources`, `explanations_de`, with attribution and property reasoning | Only bounded approved facts cross chat claim allowlists. No stronger claim is created by projection. |
| Placement, physical format, treatment role and rinse mode | Complete `application` facts, preserving physical form versus marketing role | Existing mode/format/treatment enums only when compatible; otherwise null + named compatibility reason. K18's mask role does not establish its physical texture. |
| Contact/wait, minimum/longer wear, amount/dilution, hair state/area/distribution | Source-backed typed `application` facts and alternatives | Exact product protocol only if representable; e.g. K18 wait 240 seconds, epres minimum not fixed-only contact. Unsupported facts stay stored. |
| Conditioner before/after/optionalness, order, companions | Complete `application.conditioner`, `sequence`, `partners`, including source facts versus approved Chaarlie guidance | Preserve all semantic steps, including Première shampoo-before-rinse and K18 optional conditioner after waiting. No competitor or brand-wide fallback. |
| Initial/maintenance/conditional cadence and market variants | Complete `application.cadence` branches and source applicability | Emit truthful exact cadence only; otherwise preserve the current safe generic guidance + gap code. No guessed weekly interval. |
| Independent thickness fit, caution/weightlessness observations, limits | `fit` with evidence/confidence and `holds` | Emit only separately approved eligibility updates; unknown research cannot erase existing approved suitability. No new weight score. |
| Identity/formula provenance, candidate→final trace, uncertainty/assumptions and holds | `identity`, `formula`, `method`, per-property reasoning, `holds`, `review`; full original artifacts retained independently | Version/hash/source-bound projection with visible per-field outcomes; not a completeness or publication promise. |

Add a versioned, exhaustive **property coverage receipt** to adapter output. For every supported researched field it records its profile destination and usable status: `direct`, `mapped`, `retained_only`, or `held`, with a reason when not usable. `retained_only` means stored in the product profile, not dropped. A required field with no profile destination, unknown extra property, or oversize payload is a visible refusal; never silently strip/truncate or reconstruct research from legacy fields. Do not copy other categories' property rules, admission gates or defaults.

Implementation acceptance: prove full property preservation through envelope → adapter → worker normalization → actual transactional writer → catalogue readback, including a research-only field and a conditional cadence that the runtime cannot encode. Repeated projection must not mutate research or previous owner authority. Projection hashes/adapter version and coverage receipt stay with the immutable projection/review artifact; product/profile fingerprints bind the stored full record. The new schema's strict allowed keys must include every retained property before intake activation.

## Approval and disposition

Nick's “yess but check pls also the adapters…” approves the previously presented additive approach and clarifies that all research properties must be retained. This inspection fulfills the adapter check before implementation; no further product-policy decision is introduced. Update the execution contract with this clarification. Existing method-lock, exact package, migration/apply, promotion and activation gates remain. No counterpart rerun is needed for recording the approval and this evidence-backed completeness correction to the already-reviewed projection pattern.
