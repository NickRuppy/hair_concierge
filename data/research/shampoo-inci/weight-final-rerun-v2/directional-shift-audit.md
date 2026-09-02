# Directional-shift and correction-rerun audit

Status: method-conformance passed; research-only activation gate remains.

The final v2 correction rerun moves 23 products upward, 2 downward and leaves 25 unchanged versus the approved baseline. It preserves every v1 candidate band. This audit checks both the original shared movement pattern and whether the reviewed ingredient-role corrections caused unintended classification or fit changes. It does not tune the distribution and does not prove consumer-perceived weight.

## Reviewed corrections

- `Quaternium-80` is now recognized as a cationic conditioning route. This resolves the evidence gap for `dejan-garz-shampoo`; its `moderate` band remains unchanged and confidence moves from low to moderate.
- `Starch Hydroxypropyltrimonium Chloride` is now recognized as a cationic conditioning polymer. This resolves the avoidable evidence gap for `ogx-biotin-collagen`; its adjudicated `moderate` band remains unchanged and confidence moves from low to moderate. The same extraction correction is visible for `ogx-rosemary`, whose `moderate` band and low confidence remain because formula identity, not ingredient recognition, is still the limiting factor.
- `Juniperus Virginiana Oil` is now excluded as an essential fragrance oil rather than counted as a nonvolatile lipid payload. This resolves the evidence gap for `neqi-volume-victory` and `neqi-moisture-mystery`; their `moderate` and `low` bands remain unchanged and confidence moves from low to moderate.

## Shared-pattern findings

- All 13 `low → moderate` calls contain at least two interacting deposition-relevant families or a repeated light-route architecture, plus explicit deposition, persistence and reset judgments. None is based on a lone polymer or lone refatter.
- `salthouse-anti-fett` remains the control case: it stays `low` despite Guar at position 6 because that is the only deposition route and reset capacity is strong. This directly rejects an automatic polymer floor.
- All 9 `moderate → high` calls and the single `low → high` call contain multiple distinct, plausibly persistent systems with explicit reset context. Both blind lanes agree on all ten.
- The v2 candidate distribution is unchanged at 13 low, 27 moderate and 10 high. The confidence distribution improves from 8 low / 42 moderate to 4 low / 46 moderate.
- No direct weight-fit, volume-fit or overall-fit label changes between v1 and v2. Confidence is a ranking tie-breaker, so rankings and output hashes are correctly refreshed rather than copied.

## Conclusion

The 23/2 movement remains explainable as correction of the earlier simplified baseline, not as evidence of a surviving one-ingredient shortcut. The three reviewed role resolutions improve evidence completeness without moving any product to a different band. The final method continues to distinguish a single-polymer low case from formulas with interacting conditioning routes and reserves `high` for converging silicone, lipid, film-forming or polymer systems.

This is a repeatability and method-conformance conclusion only. INCI does not establish exact concentration, finished-product deposition or perceived heaviness, so the report remains a candidate research artifact and the directional-shift gate must stay visible before any future approval or activation.
