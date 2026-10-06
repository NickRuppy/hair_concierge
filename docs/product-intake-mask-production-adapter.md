# Mask Production Adapter v1

Status: implemented local research adapter — not a production write or matching-engine change. Not yet wired into the Product Intake worker (see "Product Intake handoff" below).

Use this workflow for a previously unknown German/EU rinse-out intensive mask (Haarkur/Maske). The researcher performs the complete Mask Standard v1.0 analysis once. The adapter then projects only the smaller set of properties supported by the current Product Intake database contract (`product_mask_specs` plus `suitable_thicknesses`).

## Authority stack

| Layer | Authority | Responsibility |
| --- | --- | --- |
| Full ingredient research | `docs/research/mask-inci/v1.0/` (Mask Standard v1.0, frozen 2026-10-06) | G0 boundary, exact formula analysis and the complete nine-field comparison profile |
| Intake serialization | `mask-research-envelope-v1.0` | Projection inputs: identity, G0 outcome, formula provenance, profile values with their reasoning |
| Current projection | `src/lib/mask-research/production-adapter.ts` | Pure one-way conversion into current Mask fields |
| Product handoff | `docs/product-intake-research-ops.md` | Identity, image, price/link, exact TPL-MASK protocol, review, and guarded publish |

The full research record is the source of truth. The production projection is deliberately lossy and must never be used to reconstruct or overwrite the research profile.

Research method pins (checked by the envelope's `researchMethod` fields):

- `policySha256`: `d105ef3fdfc0e953591a54765004f59d107f049a9ea9007cf7c579dafa726ae0` (`mask-classification-standard.md`, Standard v1.0)
- `lexiconSha256`: `3dcaf54f8a7e4844f44d2731f30ca28c4a8565f17082d8fd0b27376ca3167ada` (`02_evidence_lexicon.v0.1.md`)

The leave-in adapter pins its runbook in the second slot. The mask engine has no runbook yet (the standard names it a separate Phase-4 artifact), so the evidence lexicon — the other normative input both calibration lanes classified against — is pinned instead. An envelope whose `researchMethod` does not match these pins fails the strict schema parse and the record stays `needs_research`. `tests/mask-production-adapter.test.ts` fails if either pinned file drifts, and also re-verifies every frozen corpus hash in `data/research/mask-inci/v1.0/artifact-manifest.json`.

## What Product Intake hands the engine

One exact market product: brand, exact product name, pack size, GTIN where one exists, the complete verbatim INCI of record with its source, and the **verbatim authoritative directions** (G0 reads use, not jar: after cleansing · stated contact time · rinsed out). Multi-use (2in1/3in1) products are classified mode-scoped: only the rinse-out mask mode, with the uncovered modes named.

## What comes back

| Engine outcome | Envelope | Adapter status | Meaning |
| --- | --- | --- | --- |
| G0 `in_category`, identity and formula settled | full envelope | `projection_ready` | `product_mask_specs` + `suitable_thicknesses` + `required_protocol_roles: ["intensive_conditioning_mask"]` |
| G0 `excluded_product_form` (charter exclusion) | identity block only, `categoryBoundaryStatus: "excluded_product_form"`, `exclusionReason` | `routed_out_of_scope` | Not a mask for this engine; route to the correct category workflow. Kept as boundary evidence. |
| G0 `insufficient_information` (evidence stop) | identity block only, `identityStatus: "insufficient_information"` | `needs_research` | No profile by rule. Route to a fresh exact-pack capture, **never** to a boundary ruling. |
| Unresolved identity or formula conflict | full envelope | `needs_research` | Resolve the conflict first (fail-closed identity gate, leave-in precedent). |
| Any projected field `unknown` | full envelope | `needs_research` | No `unknown` is committed to the catalog (AD-2, leave-in precedent). |

Charter exclusions seen in calibration: pre-shampoo-only and Olaplex-style bondbuilder protocols (`excluded_pre_shampoo_bondbuilder_protocol` — #13 Olaplex N°3, u5 Olaplex N°.3PLUS) and colour-depositing masks (`excluded_color_depositing` — u6 Balea Silberglanz, CI 60730). Formula-level exclusions are mode-independent (E17): a pigment- or bond-builder-protocol formula is excluded in every mode. The G0 stop case is q3 Syoss Intense Repair: no rinse text anywhere in the exact-product source, so the engine refused to infer one from "einwirken lassen".

## Required research envelope

The `property_synthesis` artifact must carry:

```json
{
  "mask_research_envelope": {
    "version": "mask-research-envelope-v1.0",
    "researchMethod": {
      "policyId": "mask-classification-v1.0",
      "modelVersion": "mask-inci-v1.0",
      "policySha256": "<pinned by adapter>",
      "lexiconSha256": "<pinned by adapter>"
    },
    "identity": {
      "researchId": "<Product Intake submission_id>",
      "market": "DE/EU",
      "exactProductName": "<exact product>",
      "brand": "<exact brand>",
      "gtin": "<GTIN or null>",
      "identityStatus": "verified",
      "categoryBoundaryStatus": "eligible",
      "exclusionReason": null,
      "multiUse": false,
      "uncoveredModes": [],
      "confidence": "high",
      "sourceIds": ["<source id>"]
    },
    "formula": {
      "status": "verified",
      "rawInci": "<complete INCI>",
      "normalizedIngredients": ["AQUA", "..."],
      "formulaFingerprintSha256": "<normalized formula fingerprint>",
      "rawInciSha256": "<SHA-256 of exact rawInci UTF-8 bytes>",
      "sourceIds": ["<source id>"]
    },
    "profile": {
      "conditioningLevel": { "value": "high", "confidence": "moderate", "rationale": "...", "evidenceSignals": ["..."], "derivation": "...", "thresholdReasoning": ["...", "..."], "limitations": ["..."] },
      "weightPotential": { "value": "moderate", "...": "same evidence object" },
      "careDirection": { "value": "moisture", "...": "same evidence object" },
      "repairSupportLevel": { "value": "low", "...": "same evidence object" },
      "focus": { "value": { "primary": "smoothing", "secondary": [] }, "...": "same evidence object" },
      "bondRoute": { "value": "none", "...": "same evidence object" },
      "hairThicknessFit": { "value": ["fine", "normal", "coarse"], "...": "same evidence object" },
      "damageFit": { "value": ["healthy", "moderately_damaged"], "...": "same evidence object" },
      "textureFit": { "value": ["straight", "wavy", "curly"], "...": "same evidence object" },
      "uncertainFields": [],
      "assumptionNotes": []
    }
  }
}
```

Every field requires the product-specific reasoning contract from Standard v1.0; a generic enum restatement is invalid. The envelope's evidence objects carry `confidence` for review only. Evidence levels, evidence scope, counter-signals, the `balanced_reading` tag, the protein-payload counter-signal and the `hinweise` record stay in the complete research record beside the envelope, not inside it.

Formula integrity is checked exactly as in the leave-in adapter: `rawInciSha256` hashes the exact raw INCI bytes; `formulaFingerprintSha256` hashes the raw INCI after splitting on the list separator (a comma flanked by digits belongs to the ingredient name), stripping `*`/`†`, trimming, uppercasing and rejoining with `, `; `normalizedIngredients` must preserve the same complete ordered sequence.

## Deterministic projection

| Research property | Current database property | Authority |
| --- | --- | --- |
| `weightPotential` low/moderate/high | `product_mask_specs.weight` light/medium/rich | property set field 2 |
| `conditioningLevel` low/moderate/high | `concentration` low/medium/high | D1 (`concentration` is the conditioning-level twin) |
| `careDirection` protein/moisture/balanced | `balance_direction` (same value; never `null` from this adapter) | D6 |
| `repairSupportLevel` low/medium/high | `repair_support_level` (same value) | property set field 4 |
| `focus` primary + secondary | `functional_benefits`: smoothing → `smoothing_frizz_control`, detangling → `detangling_slip`, shine → `shine` | D2 |
| `conditioningLevel` moderate/high | adds `detangling_slip` | **MAD-1 baseline — implementation default mirroring the leave-in AD-3a baseline clause; pending Nick's ruling** |
| normalized complete INCI | presence-only `ingredient_flags` (rules shared with the leave-in adapter) | property set |
| `hairThicknessFit` (echo of `weight_potential`) | `suitable_thicknesses` | property set field 7 |

`moisture`, `repair`, `curl_support` and `color_care` focus values have no `functional_benefits` counterpart (fixed vocabulary); the moisture identity reaches production through `balance_direction` (D5 adapter note). `functional_benefits` is required non-empty by the intake validator; a record whose focus and baseline produce no member is refused (`needs_research`), never padded.

Retained research-only (reported in `omittedResearchProperties`): `bond_route`, `damage_fit`, `texture_fit`, the four focus values without a production column, `balanced_reading`, `hinweise`, the overload counter-signal, multi-use scope, the tail-marker trace, the direct properties and the assumption notes. No semantically unrelated current column is used to store them.

Note (production, not research): the current mask matcher consumes `concentration` as a temporary repair-need proxy (`mask_concentration_is_temporary_repair_level_proxy`). Under D1 the adapter writes the conditioning-intensity twin into that column; whether matching later reads `repair_support_level` instead is a separate production-policy decision.

## Protocol boundary

The adapter returns only the required role name, `["intensive_conditioning_mask"]` (mirrors `deriveRequiredProtocolRoles("mask")`). It does not produce cadence, placement, contact time, rinse action or source text. TPL-MASK/P5 governs those, and the exact dwell always comes from the authoritative product source — never from INCI.

## Product Intake handoff

The leave-in engine is additionally wired into the Product Intake worker (`src/lib/product-intake/leave-in-research-adapter.ts`, `leave-in-research-prompt-contract.ts`, and the `leave_in` branch of `scripts/product-intake/codex-research-worker.ts`). The mask equivalent is **not built**: wiring it would change how every mask submission is researched today (the envelope would become required), which is an activation decision outside this port. Until it is wired, use the local replay below.

## Local replay

```bash
npm run research:mask:production-adapter -- \
  --input <mask-research-envelope.json> \
  --output <artifact-directory>
```

The command writes `research-envelope.json`, `production-projection.json` and `projection-summary.md`. It refuses to replace a non-empty output directory unless `--overwrite` is supplied, records G0 exclusions and G0 evidence stops as outcomes, and performs no network request and no database write.

Calibration replay: `node scripts/mask-research/build-envelopes-from-key.mjs` rebuilds `data/research/mask-inci/v1.0/calibration-envelopes/` deterministically from reference-key-v1, the frozen cohort and the G0 refuse/stop records; `tests/mask-production-adapter-calibration.test.ts` checks them against hand-derived app values and `calibration-expected-projections.json`.

## Readiness boundary

`projection_ready` means only that the Mask property lane can populate today's schema. It is not catalog-intake readiness, global-recommendation readiness, image approval, protocol approval, publish approval or production activation.
