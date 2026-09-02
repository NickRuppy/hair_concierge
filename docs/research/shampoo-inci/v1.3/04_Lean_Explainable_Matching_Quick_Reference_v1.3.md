# Lean Explainable Shampoo Matching — Quick Reference v1.3

## Purpose

Use the detailed shampoo classification standard as the audit layer, but expose only a compact matching profile to the application. Every stored value must be explainable through a property-specific evidence record.

## Minimum viable matching profile

### Direct product properties

- `cleansing_strength`: `low | moderate | strong | clarifying`
- `conditioning_level`: `low | moderate | high`
- `weight_potential`: `low | moderate | high`
- `focus.primary`: `volume | shine | repair | clarifying | scalp-active | gentle | general`
- `focus.secondary`: zero to two values from the same focus list
- `usage_role`: `frequent | regular | alternating | occasional-reset | treatment`

### Derived user-fit properties

- `hair_thickness_fit.fine`
- `hair_thickness_fit.medium`
- `hair_thickness_fit.coarse`
- `scalp_fit.oily`
- `scalp_fit.normal`
- `scalp_fit.dry`
- `scalp_fit.sensitive`

Each fit uses:

`recommended | conditional | neutral | caution | unknown`

## Property evidence object

```json
{
  "value": "conditional",
  "decision_type": "derived_user_fit",
  "confidence": "moderate",
  "evidence_level": "E2",
  "evidence_scope": "formula_only",
  "rationale": "Moderate deposition can help damaged fine hair but may add weight; strong cleansing partly offsets root flattening.",
  "formula_observations": [
    "Dimethicone + Amodimethicone + cationic guar",
    "SLES-led cleansing system"
  ],
  "product_inferences": [
    "conditioning_level=high",
    "weight_potential=moderate",
    "cleansing_strength=strong"
  ],
  "counter_signals": [
    "Healthy very-fine hair with low cleansing need may still feel coated"
  ],
  "derived_from": [
    "conditioning_level",
    "weight_potential",
    "cleansing_strength",
    "damage_context"
  ],
  "source_ids": ["formula_1"],
  "shared_mechanism_ids": ["silicone_cationic_deposition_1"]
}
```

## Required evidence chain

1. **Formula observation:** What is objectively present or documented?
2. **Product-property inference:** What behavior does that system plausibly create?
3. **User-fit decision:** Why is that behavior helpful or unhelpful for the profile?

Invalid:

> Amodimethicone present → suitable for coarse hair.

Valid:

> Amodimethicone plus a cationic polymer supports moderate-to-high deposition. Together with the formula's cleansing strength, this implies moderate net weight. The product is therefore conditional for fine hair: potentially useful when damaged, but possibly flattening when healthy and very fine.

## Confidence ceilings from formula analysis alone

| Conclusion | Normal maximum confidence |
|---|---|
| Primary product focus | High |
| Broad cleansing band | Moderately high |
| Conditioning level | Moderately high |
| Weight potential | Moderate |
| Hair-thickness fit | Moderate |
| Oily-scalp fit | Moderate to moderately high |
| Dry-scalp fit | Low to moderate |
| Sensitive-scalp fit | Low without product-level tolerance evidence |

## Completion rule

A property is not complete until the researcher records:

- value;
- direct property or derived fit;
- confidence;
- E0–E5 level and evidence scope;
- plain-language rationale;
- formula observations;
- product-property inference;
- counter-signals;
- `derived_from` for fit conclusions;
- exact sources.

## Recommended storage

Start with two versioned JSON fields:

```text
matching_profile_json   # compact application-facing profile
research_trace_json     # detailed formula architecture, scores, claims, evidence and sources
```

Normalize property evidence into a separate table only when review queues, analytics or partial property updates require it.
