# Conditioner v1.6 nine-property comparison quick reference

Status: revised 12-product pilot calibration

| Output | Values | Pragmatic rule | Required caution |
|---|---|---|---|
| Conditioning level | low / moderate / high | Map reviewed conditioning/deposition potential | Ingredient count is not a score |
| Weight potential | low / moderate / high | Map reviewed weight/deposition potential; use moderate when a formula-only high is conflict-tagged and unresolved by finished-product evidence | Silicone-free is not automatically light; uncertainty must not be encoded as a restrictive high fallback |
| Care direction | protein / moisture / balanced | Protein needs a material identifiable protein/peptide/keratin film route; moisture needs coherent conditioning/humectant/emollient support without a dominant protein route; balanced needs substantive mixed protein-plus-moisture architecture | Product direction is not a user deficiency; formula-only ceiling is E2; `balanced` is not uncertainty or a neutral fallback |
| Repair support level | low / medium / high | Low = ordinary conditioning; medium = distinct temporary protein/peptide/keratin film; high = materially stronger named bond route visible in the formula | Never call formula-only support structural repair; positioning, generic silicone, oil, panthenol, ceramide, cationic polymer, or repair claim remains low |
| Primary focus | lightness / detangling / smoothing / repair / shine / curl_support / color_care / general | Forced research headline after baseline conditioning is excluded; use `general` when no route is distinctive | See `04_focus-selection-decision-guide.md`; marketing only corroborates |
| Secondary focus | up to two focus values | Useful additional endpoints, not an ingredient count | Do not add shine when it only reuses smoothing; primary and secondary remain required in this research phase |
| Hair thickness fit | non-empty subset of fine / medium / coarse | Low weight → fine+medium; moderate → all; high → medium+coarse | Product prior, not universal user suitability |
| Damage fit | non-empty subset of healthy / moderately_damaged / highly_damaged | low → healthy; moderate and general high → healthy + moderately damaged; high plus a qualifying specialist route → moderately damaged + highly damaged, replacing the general set | Repair claim, generic lubrication, silicone, oil, panthenol, ceramide, or cationic polymer is not high-damage evidence; never emit all three values |
| Texture fit | non-empty subset of straight / wavy / curly / coily | Weight, slip, smoothing, and definition/layering route | Curl branding alone is insufficient |

Each eligible pilot product gets one complete nine-property comparison profile plus a concise `uncertain_fields` list and `assumption_notes`. Exact application, frequency, amount, contact time, and rinse directions remain protocol metadata rather than comparison properties. The detailed scientific properties remain the research trace, including `rinse_behavior=unknown` unless an exact finished-product protocol exists. The leave-in boundary fixture remains excluded and receives no rinse-out profile.

## Field-rationale contract

Every one of the nine visible comparison fields must carry `Formula signals`, `Derivation`, `Why this exact classification?`, and `Evidence ceiling`, all written in English:

- Formula-derived fields list exact product INCI signals with their captured list positions or name the product-specific architecture/absence pattern. Generic text such as “aus der Formel abgeleitet” is insufficient.
- Thickness, damage, and texture fit cite their upstream profile/direct-property inputs and remain broad policy priors rather than direct ingredient-fit claims.
- Focus rationales name the winning route, the competing endpoints, and why the primary/secondary hierarchy does not double-count one shared film mechanism.
- The threshold comparison makes the transfer step explicit: which exact signals clear the selected class, why the adjacent lower class is insufficient, and why the adjacent higher class is not supported. For non-ordinal fields it explains why the selected focus or fit set wins over the nearest alternative.
- The compact Lab overview displays this threshold comparison directly. A generic summary may provide context in the detailed audit, but it must never replace the selected-versus-adjacent-class explanation.
- A value restatement is invalid. “High because the value is higher” must be replaced by the product-specific pattern that exceeds `moderate`; `moderate` must separately explain both why `low` is too weak and why `high` is not justified.

For `care_direction`, explain why the selected architecture is protein, moisture, or substantive mixed-route balanced rather than the nearest direction; do not infer a user deficiency. For `repair_support_level`, distinguish ordinary conditioning (`low`) from a distinct temporary film (`medium`) and a materially stronger named bond route visible in the formula (`high`).

For `damage_fit`, a distinct protein/peptide/keratin fibre-film route, named bond chemistry, exceptional corroborated protection, or relevant exact-product test is required for the exact two-value set `moderately_damaged` + `highly_damaged`. This replaces `healthy` + `moderately_damaged`; it does not append a third value. Keep the formula-only E2 ceiling.
- Every formula rationale preserves the E2 ceiling and the hidden under-1% boundary. A richer explanation does not upgrade the evidence level.

## Current production adapter boundary

New products keep this complete nine-property record. Adapter v1 derives only current `weight`, `repair_level`, `balance_direction`, thickness/balance compatibility rows, and presence-only ingredient flags. It preserves conditioning level, focus hierarchy, damage fit, and texture fit without forcing them into unrelated live columns. Exact protocol content always comes from product directions. See `docs/product-intake-conditioner-production-adapter.md`.
