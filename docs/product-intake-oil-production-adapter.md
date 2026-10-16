# Current Oil intake integration (2026-10-16)

New intake jobs use the registered `oil-standard` method `v0.10/oil-production-adapter-v1` and `oil-research-envelope-v2`. The category prompt includes the producer draft JSON schema, pinned normative rules and evidence/source instructions. The server binds exact submission, job, run, resolved identity and authoritative formula, derives hashes, projects only weight, supported fibre uses and heat protection, and saves the binding through the atomic completion RPC.

Current required values: base, weight, persistence, supported uses, heat, UV and five ingredient flags. Optional `supplementary_research` survives in the artifact without becoming required Lab rows, matching or selection. Thickness guidance remains separately derived from weight/scenario; removed properties are not requested from new research. Missing/stale evidence fails admission rather than filling a default. Matching suggestions require explicit manual review in the Lab; the adapter never approves them.

Legacy v1 consolidation/v0.8 and local v0.9 records keep their exact schema/pins and remain readable. They cannot be relabeled as current worker research. The historical bridge notes below retain their original meaning.

## Deployment prerequisites — not performed here

- Review and publish the exact integration branch; require green CI and final code review.
- Apply, with separate authorization, the ordered migrations `20261016055747_oil_intake_review_binding_v1_baseline` and `20261016055758_oil_intake_review_binding_v2_successor`. The baseline preserves the original unapplied SQL bytes; names were moved after the verified live ledger maximum to avoid history drift.
- Deploy the exact reviewed release using the normal Hetzner intake procedure, then verify the registered current method, server runtime, concurrency and a supervised fresh job. Merely merging code does not deploy it.
- Research can run automatically after that deployment. Matching approval, images/brand/protocol readiness and final catalog publication remain separate human gates.

The 2026-10-16 read-only host check found release `20261015-201339-7c00ca4a76c6`, without Oil engine files, and the production migration ledger had no Oil review migration. This implementation changes neither live state.

---

# Oil Production Adapter v1

Status: local deterministic projection and an exported, inactive Product Intake helper. This does not activate oil research routing, change ordinary oil intake, populate matching tags, approve a product, or publish anything.

The full `oil-research-envelope-v1` is the product-truth record. The adapter only projects the three fields that today's oil singleton can represent:

| Research property | Current singleton field |
| --- | --- |
| rough hair weight | `product_oil_specs.weight` (`light`, `medium`, `rich`) |
| supported leave-on fibre uses | `product_oil_specs.role_support` |
| supported heat-protection claim | `product_oil_specs.provides_heat_protection` |

Base oil, named-oil prominence, dispenser, penetration, UV, ingredient flags, persistence and every scenario fit/caveat stay in the complete envelope. The adapter does not derive `product.suitable_thicknesses`, eligibility, subtype, purpose, legacy ingredient-family flags, matching decisions, application protocols or commercial/source fields. Those are manual review under the existing Product Intake process.

## Local replay

```bash
npm run research:oil:production-adapter -- \
  --input <oil-research-envelope.json> \
  --output <new-or-empty-artifact-directory>
```

The command accepts only `--input` and `--output`. It bounds input to 1 MiB, makes no network or database request, and refuses a non-empty target or an output symlink (including any existing ancestor). It writes the completed directory atomically:

- `original-input.json` — exact submitted input bytes;
- `research-envelope.json` — only for an admitted, property-ready envelope;
- `production-projection.json` — deterministic outcome and diagnostics;
- `projection-summary.md` — all direct properties, retained contexts/caveats, emitted singleton values and manual-review list.

Exit code `0` means `property_projection_ready`; `1` means `needs_research`; `3` means verified `not_applicable`; `2` means argument, JSON, input or output I/O failure. A semantic refusal keeps the original input and diagnostic outcome, but never writes an admitted envelope or applicable singleton specification.

## Inactive intake helper

`applyOilResearchAdapter({ final, artifacts, expectedResearchId })` is exported for the later worker integration but is intentionally not registered now. It requires one UUID `expectedResearchId`, exactly one `property_synthesis.payload.oil_research_envelope`, the current schema/method tuple, and an equal envelope `submission_id`. It checks all of these before mutating either input.

On a ready result it replaces only `category_specs.product_oil_specs` and the three flat `field_rationales["category_specs.product_oil_specs.<field>"]` entries (removing stale root, dot and bracket descendants). It appends the projection, retained-only coverage, warnings, required roles and manual-review list beside the untouched envelope. It preserves unrelated final fields, artifact records, protocols and manual matching tags. Any refusal returns shared `{ blockers, warnings }` and leaves both `final` and `artifacts` unchanged.

The helper is preparation only. `CATEGORY_RESEARCH_REGISTRY.oil` remains unavailable, so no current worker submission reaches this code. A later activation must separately provide the review-surface coverage, generic enrichment support and the normal catalog/protocol/publication gates.

## Historical verification

The [historical replay v0.2](../data/research/oil-inci/v1.0/adapter-replay-v0.2/README.md) preserves all 37 envelope byte hashes from v0.1. Its independently established reason checks admit 33 property projections and refuse four: H04 has unknown weight; O04/O18/O19 retain formula/ledger representation conflicts. O04 additionally cites E01-retailer-de, absent from its controlled source registry; O18 also retains unrepresented declaration text from a truncated ingredient. Those citations and records are preserved rather than repaired to manufacture admission.

The original v0.1 outputs remain unchanged. This replay verifies serialization and attribution, not sensory accuracy, unseen classification, a method lock or live activation.

## Four-record successor

The [current resolved replay](../data/research/oil-inci/v1.0/record-resolution-v0.1/README.md) contains 37 property-ready envelopes, with 33 copied byte for byte and four corrected current envelopes. The old replay above remains reproducible with its original refusals. Corrected envelopes retain exact predecessor bytes, source-bound decisions, current profile/trace/fit references and independent verification.

O04/O18/O19 are representation/source corrections, preserving their classifications. H04 Rahua is an exact-product owner-approved provisional medium estimate, with low confidence, rich alternative and undisclosed leading carriers. This exception adds no general fallback or material prior. Its thickness guidance follows the existing medium table; other properties and source directions are unchanged. Projection-ready means the three singleton fields can be represented locally; it does not establish sensory accuracy or activation readiness.

To reproduce into a new directory under the checkout's research data, then independently verify:

```bash
npm run research:oil:resolve-records -- --output data/research/oil-inci/v1.0/<new-run>
npm run research:oil:verify-resolved-records -- data/research/oil-inci/v1.0/<new-run>
```

Both commands are offline. They never replace a populated output. No current worker routes to this engine; matching remains manual and publication remains separately guarded.


## Local Research Lab connection (2026-10-13)

The shared development Lab now has an oil-native review adapter for all 37 resolved profiles and current exported intake packages. Matching suggestions remain a separate manual approval. The bound CLI handoff records properties review only, never publication. See [Oil Lab operations](labs/oil-research-lab.md). The fresh worker candidate and source/identity binding are preparation while the registry is unavailable; historical replay and all frozen standards remain unchanged.
