# Curated research authority — Shampoo Research Package v1.3

## Status and scope

**Curated extraction of the supplied pasted overview; not the primary standard.** The exact agent-context Markdown and lean quick reference were subsequently grounded through the supplied Drive link and now live beside this file. This overview preserves the operative rules expressed in the attachment without reconstructing the remotely grounded XLSX or duplicate DOCX/PDF/ZIP content.

The stated purpose is a two-layer model: a compact application-facing matching profile plus a detailed, linked research trace. The compact layer supports normal matching; the trace preserves formula identity, complete INCI, formula architecture, mechanism scores, claim analysis, finished-product evidence, sources, uncertainties, and formula conflicts for audit and explanation.

## Evidence model

Each conclusion is a property-level evidence record, rather than one formula-wide evidence label. The source material requires these fields:

- value and decision type;
- confidence, evidence level (`E0`–`E5`), and evidence scope;
- rationale;
- formula observations and product-property inferences;
- supporting and counter-signals;
- derived-from references, source IDs, shared mechanism IDs, and review status.

Shared mechanism IDs prevent multiple effects of a single system, such as silicone/cationic deposition, from being represented as independent technologies.

### No naked labels

The mandatory reasoning chain is:

1. Record an objective formula observation.
2. Infer direct product properties such as conditioning, weight potential, and cleansing strength.
3. Only then make a profile-specific user-fit conclusion.

An ingredient's presence alone is not proof of a person's fit. In particular, conditioning/deposition can help damaged fine hair while still risking weight on healthy very-fine hair; cleansing may partly offset, but cannot erase, that uncertainty.

Every direct property and derived suitability conclusion needs supporting evidence plus a counter-signal, derivation, and source trace. The source gives `fine_hair_fit = recommended` as an unacceptable naked conclusion unless the evidence record explains it.

## Lean profile from the source material

The source proposes these direct product properties:

| Property | Source values |
| --- | --- |
| Cleansing strength | `low`, `moderate`, `strong`, `clarifying` |
| Conditioning level | `low`, `moderate`, `high` |
| Weight potential | `low`, `moderate`, `high` |
| Primary focus | `volume`, `shine`, `repair`, `clarifying`, `scalp-active`, `gentle`, `general` |
| Usage role | `frequent`, `regular`, `alternating`, `occasional-reset`, `treatment` |

It also proposes derived hair-thickness fit (`fine`, `medium`, `coarse`) and scalp fit (`oily`, `normal`, `dry`, `sensitive`) with suitability values `recommended`, `conditional`, `neutral`, `caution`, or `unknown`.

The package describes `matching_profile_json` as the compact matching projection and `research_trace_json` as the full scientific/audit record. The workbook additions named in the source are `Lean_Matching_Model` (fields, allowed values, direct/derived status, dependencies, confidence ceilings, derivation, evidence object) and `Property_Evidence_Template` (one completeness-checked row per property with a worked fine-hair example).

## Limits preserved from the source

- The package is a research and audit system; the compact model is deliberately smaller than the complete classification.
- Formula observations and product-property inference must remain distinguishable from user fit.
- The pasted text does not itself provide a complete workbook, formula dataset, percentages, or finished-product results. The exact workbook is grounded remotely but not materialized locally; this snapshot makes no unsupported claims about its contents.

For Charlie-specific translation, including intentional departures from the source vocabulary, see [the integration contract](./charlie-integration-contract.md).
