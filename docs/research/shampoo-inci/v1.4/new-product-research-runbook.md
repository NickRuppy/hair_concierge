# Shampoo v1.4 new-product research runbook

Use this protocol for a new current German regular shampoo after `shampoo-classification-v1.4` is frozen. It produces a provisional research record, not a catalog approval or production write.

## Required inputs

- [v1.4 classification standard](./classification-standard.md) and its SHA-256 policy hash;
- exact product identity candidate;
- access to current German manufacturer and preferred retailer sources;
- protocol namespace and pre-registered cohort/reserves when running a holdout;
- an independent second labeler for batch repeatability.

## 1. Pre-register before classification

For a holdout or scalability test, freeze the exact candidates and reserves before any formula labels are produced.

Record for every slot:

- selection order and archetype;
- exact brand/name/size;
- known GTIN/EAN aliases;
- selection source and date;
- expected manufacturer formula availability;
- why it belongs to regular Shampoo rather than deep cleansing or another category.

Reject overlap with every predecessor cohort using both normalized `brand + exact name` and any GTIN alias. A missing predecessor manifest is a validation failure, not evidence that the product is new.

Replace a blocked slot only with the first pre-registered reserve that best preserves its archetype, and do so before either lane produces labels.

## 2. Resolve exact German identity

Resolve sources in this order:

1. exact German pack for that GTIN;
2. current exact German manufacturer/brand page;
3. preferred German retailer page for the exact variant/GTIN;
4. second reputable German retailer as corroboration or fallback.

Record every checked source, including conflicts. Verify that exact name, size, GTIN and formula belong together.

Do not:

- use a foreign manufacturer formula as German authority when market formulas differ;
- merge formulas across GTINs or reformulations;
- assume two GTINs share a formula without evidence;
- use claims-only pages as formula corroboration;
- invent a catalog UUID for a research product.

Identity is ready when the formula is complete and either:

- exact German pack/manufacturer evidence is current; or
- at least two independent exact-GTIN German retailer authorities agree when no exact German manufacturer formula exists.

One exact preferred retailer can support a provisional formula, but identity confidence remains limited unless the source rule above provides corroboration. A material unresolved conflict blocks the slot.

## 3. Normalize and freeze the formula packet

Store:

- raw INCI exactly as published;
- normalized ordered ingredients;
- INCI fingerprint;
- source tier and capture time;
- completeness and identity confidence;
- conflict status;
- deterministic ingredient/exposure facts;
- policy hash.

The blind packet must not contain brand, name, claims, existing labels, fit results or another lane's decisions.

Freeze a pre-unblind receipt over:

```text
candidate ID
raw and normalized INCI
formula fingerprint/source facts
formula architecture
eight provisional properties
property rationales/confidence
formula observations/counter-signals
policy hash
```

## 4. Lane A formula-first classification

Classify all eight properties under the stable standard.

For every property record:

- selected value;
- confidence;
- supporting formula facts and positions;
- counter-signal;
- concise rationale;
- plausible neighboring alternative.

For `weightPotential`, additionally record:

- extracted v3 weight evidence;
- deposition load;
- persistence;
- reset capacity;
- unresolved facts;
- `whyThisBand`;
- `whyNotNeighborBand`.

The v3 validator checks this structure and evidence positions. It does not derive an expected weight band from ingredient or route counts.

## 5. Unblind positioning and finalize lane A

After the blind hash is frozen, reveal product identity, manufacturer claims and usage instructions.

Record a decision trace:

### Primary focus

- claim direction or `null`;
- formula compatibility;
- one compatible route;
- final decision reason.

### Secondary focus

- confirmation that empty default was considered;
- selected values;
- matching distinct claims and independent routes;
- distinction from primary;
- dual-focus exception when applicable.

### Usage role

- default `regular`;
- exact non-default trigger, if any;
- trigger evidence and rationale.

### Weight

- final structured assessment remains formula-derived;
- claims may corroborate or expose conflict but cannot assign the band.

Freeze and explain every blind-to-final delta.

## 6. Independent lane B

Lane B receives:

- the same final exact identity/formula source packet;
- the stable policy;
- post-unblind claims permitted under the method;
- no lane A values, rationales, distributions or profile results.

Lane B independently classifies the same seven judgment properties and gives rationales/confidence. `dandruffSupport` is recomputed from the complete formula.

Freeze lane B before comparison.

## 7. Validate and compare

Validation checks:

- protocol namespace and exact membership;
- predecessor non-overlap;
- source provenance, identity confidence and formula fingerprint;
- all eight property values, rationales and confidence;
- blind receipt and deltas;
- v3 structured whole-formula weight record;
- formula-derived dandruff rule;
- two-lane completeness;
- no unexpected identity/audit abstention.

The report shows:

- raw exact agreement overall and by property;
- label distributions/prevalence;
- conditional non-default agreement;
- Cohen's kappa diagnostics;
- formula-derived dandruff agreement;
- confidence distribution;
- every disagreement and final adjudication.

Pass only with:

- at least 75% raw exact agreement overall;
- at least 60% raw exact agreement for every judged property;
- 100% formula-derived dandruff agreement;
- all final direct properties moderate-or-better confidence;
- zero unresolved identity/audit failures.

Kappa is diagnostic for the small batch and has no pass threshold.

## 8. Adjudicate without tuning

Classify each disagreement:

| Outcome | Required action |
| --- | --- |
| Product correction | Correct the product record and preserve the original/rationale. |
| Source or identity failure | Resolve sources or block/replace the slot. |
| Researcher-process ambiguity | Tighten packet/instructions and rerun affected independent work. |
| Systematic rule gap | Amend the stable method and rerun the complete holdout. |

Do not change labels to hit a target distribution or agreement score.

If a final property remains low-confidence, keep it visible and mark the batch/candidate `not_finalizable`. Do not omit the product or relabel confidence.

## 9. Profile replay

After direct properties are validated, replay the provisional products against the pinned 18 de-identified profiles.

Label these outcomes `new_product_no_legacy_baseline`. Keep direct properties and fit results separate. Identity/material-formula abstentions are process failures; legitimate preference or usage-role abstentions are reported normally.

## 10. Artifact checklist

The immutable research root contains:

- pre-registration and reserve manifest;
- source/provenance records;
- formula source and normalized packet per product;
- lane A blind/final records and receipt;
- lane B records and receipt;
- agreement and adjudication;
- validation report;
- profile replay;
- Markdown/JSON summary;
- start and verification receipts.

Historical runs are never overwritten.

## 11. Stop boundary

Stop after local artifacts, validation, replay and human review. Separate authorization is required before:

- Product Intake reconciliation;
- catalog creation or update;
- Lab approval mutation;
- database import or migration execution;
- production recommendation changes;
- commit, push, deployment or activation.
