# Ready-to-run Conditioner product research prompt v1.6

Research one exact Germany/EU conventional rinse-out Conditioner using the locked Conditioner Standard v1.6.

Required order:

1. Verify product form. Stop with `excluded_product_form` for leave-in, mask, co-wash, spray, medicated/scalp treatment, salon chemistry, or materially multi-use rinse/leave-on product.
2. Resolve exact product UUID, brand/name, market, pack size, reliable identifier or documented gap, source date, formula/version and conflicts.
3. Preserve raw INCI and normalized formula fingerprint.
4. Record literal formula observations only.
5. Evaluate routes R1-R8, counter-signals and shared mechanism IDs.
6. Produce every direct property with value, E level, confidence, scope, rationale, sources and review state.
7. Keep formula-only evidence at E2 or below. Set rinse behavior unknown and cumulative residue indeterminate without exact tests.
8. Audit marketing/claim evidence separately; do not let it change the formula analysis.
9. Resolve authoritative application directions using the source hierarchy: user package, German/EU manufacturer, exact-GTIN German retailer, other German/EU retailer, then secondary discovery only.
10. Produce the complete nine-property comparison profile defined in sections 9-10 from reviewed direct properties. Use the exact vocabulary and canonical ordering for fit arrays. For each field, include `evidence_basis`, product-specific `evidence_signals[]`, `derivation`, `threshold_reasoning[]`, and `limitations[]`.
11. Formula-derived field evidence must name exact INCI ingredients with captured list positions or a precise formula/absence pattern. Derived fit fields must cite their upstream weight/conditioning/slip/film inputs and remain broad priors. `threshold_reasoning[]` must explain why the evidence clears the selected value and why the nearest lower/higher or categorical alternative is not selected. Generic “especially fitted for,” “formula-derived,” or value-restating reasoning is invalid.
12. Write `rationale`, `evidence_signals[]`, `derivation`, `threshold_reasoning[]`, and `limitations[]` in English. Treat `threshold_reasoning[]` as the compact review headline; it must stand on its own without the reviewer opening the detailed evidence block.
13. Do not add a lean-profile rinseability value. Keep actual `rinse_behavior` in the detailed trace as `unknown` unless exact finished-product rinse testing exists; retain `weight_potential` as the ingredient-informed deposition signal.
14. In rework mode, consume the exact unresolved entry from `npm run conditioner:research:rework-queue`. Re-evaluate the named product and property against the recorded formula/profile/field fingerprints and `standardVersion`; do not broaden the correction to unrelated fields without new evidence.
15. Return a new validated product-artifact version with the reviewer comment answered explicitly. A reusable classification-rule change must update the synchronized guidance set before the next batch; a product-only correction stays in the product artifact and review history.
16. Do not encode unresolved formula-only weight uncertainty as a restrictive `high` lean fallback. If a higher detailed-trace result is conflict-tagged, exact intended finish materially contradicts it, and no finished-product evidence resolves the conflict, project `moderate`, mark the field uncertain, and preserve the higher trace result.
17. Apply `04_focus-selection-decision-guide.md`: exclude baseline conditioning, require a differentiating route for the research primary, use `general` when none clears that threshold, and retain at most two useful secondary endpoints. Marketing may corroborate or lower confidence but never creates a route.
18. Always output the primary/secondary hierarchy for an eligible product. Preserve detailed capabilities underneath it, but do not substitute a flat capability list for the canonical research comparison fields.
19. Record concise affected-field uncertainty for formula/source conflicts, choose the best available basis under the hierarchy, and continue. Stop only for an excluded product form.
20. Do not output `usage_role` or `scalp_application_fit` as research comparison properties. Preserve exact application area, frequency wording, amount, contact time, and rinse instructions as protocol metadata. Default Conditioner-after-every-wash guidance belongs to the category/routine layer, not to an individual product score.
21. Apply Damage Fit as exact output sets: low → only `healthy`; moderate and general high without a qualifying specialist route → only `healthy` + `moderately_damaged`; high conditioning with a distinct protein/peptide/keratin fibre-film route, named bond chemistry, exceptional corroborated protection, or a relevant exact-product test → only `moderately_damaged` + `highly_damaged`. The specialist result replaces the general-high set; never emit all three values. Generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, and generic lubrication candidate alone do not qualify.
22. Classify `care_direction`: `protein` requires a material identifiable protein/peptide/keratin film-support route; `moisture` requires coherent conditioning/humectant/emollient support without a dominant protein-film route; `balanced` requires a substantive mixed protein-plus-moisture direction and is neither a neutral fallback nor a substitute for uncertainty. Never describe this as a diagnosed user deficiency.
23. Classify `repair_support_level`: `low` is ordinary conditioning; `medium` requires a distinct temporary protein/peptide/keratin fibre-film route; `high` requires a materially stronger named bond route visible in the reviewed formula. Positioning alone cannot raise the level. Formula-only output remains E2 and cannot claim structural repair.
24. Write an unsalted SHA-256 fingerprint for each canonical profile field. The Lab's compatibility bridge may recompute a legacy salted fingerprint from current field content plus the stored review version solely to recognize an unchanged approval; changed content reopens, and every new decision stores only the unsalted hash. At v1.6 the two new fields must be reviewed and accepted before the product is considered approved, either individually or through the atomic nine-field whole-product approval. The whole-profile fingerprint remains versioned with `standard_version`.

Do not use current catalog labels as input. Do not claim exact concentration, pH, sensory, buildup, repair efficacy, allergy safety, or medical suitability from INCI.

## Product Intake serialization

For a previously unknown Conditioner entering Product Intake, return the complete result under `property_synthesis.payload.conditioner_research_envelope` using version `conditioner-research-envelope-v1.6` and the exact contract in `docs/product-intake-conditioner-production-adapter.md`.

Do not hand-author `suitable_thicknesses`, `product_conditioner_specs`, `product_conditioner_rerank_specs`, or their rationales. The deterministic `conditioner-production-adapter-v1` derives those current-schema values from the full reviewed profile and normalized complete INCI. Research `product_application_protocols` independently from authoritative use directions; the adapter supplies only the required role name and never invents protocol content.
