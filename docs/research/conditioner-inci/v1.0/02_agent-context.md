# Conditioner v1.6 agent context

1. Resolve product form, exact identity, exact market formula, and conflicts.
2. Preserve raw INCI and compute a normalized fingerprint.
3. Record literal formula observations before reading marketing claims.
4. Identify candidate routes R1-R8 and assign shared mechanism IDs.
5. Classify direct properties conservatively; formula-only evidence cannot exceed E2.
6. Set direct rinse behavior and cumulative residue to unknown/indeterminate without exact finished-product protocols.
7. Audit claims separately. A product name never upgrades a property.
8. Derive one complete nine-property comparison profile only from reviewed direct properties; use sections 9-10 exactly. Preserve authoritative directions separately as protocol metadata.
9. Keep actual `rinse_behavior` only in the detailed research trace and leave it `unknown` without an exact finished-product rinse test; do not project it into the lean profile.
10. When a higher formula-only weight result is conflict-tagged and unresolved by finished-product evidence, do not use restrictive `high` as the lean fallback; project `moderate`, preserve the higher detailed-trace result, and mark uncertainty.
11. Apply `04_focus-selection-decision-guide.md`: exclude baseline conditioning, require a differentiating route for `primary_focus`, use `general` when none clears the threshold, and retain at most two useful secondary endpoints. Marketing may corroborate or lower confidence but never create a route.
12. Always return the primary/secondary hierarchy for eligible products. Preserve detailed capabilities, but do not replace the canonical research hierarchy with flat tags during this program.
13. Record one concise `uncertain_fields` list and assumption notes; source conflicts lower the smallest affected scope but do not stop ordinary research.
14. Stop only for G0 excluded product forms. Never convert medical claims or naked ingredient signals into user fit.
15. For every visible profile field, return product-specific `evidence_signals`, `derivation`, and `limitations`. Name exact INCI ingredients/list positions or a precise formula pattern; never use a generic “formula-derived” rationale.
16. Do not create `usage_role` or `scalp_application_fit` comparison fields. Retain exact application, frequency, amount, contact-time, and rinse directions as protocol metadata; specialist product forms stay behind their applicable boundary/module.
17. For every field, return `threshold_reasoning[]`: name the exact product signals that clear the selected threshold, then state why the closest lower and/or higher alternative is rejected. For non-ordinal fields, compare the winning focus or fit set against its nearest plausible alternative. Do not merely restate the accepted enum.
18. Apply the Damage Fit rule exactly: low → only `healthy`; moderate and general high without a qualifying specialist route → only `healthy` + `moderately_damaged`; high conditioning with a distinct protein/peptide/keratin fibre-film route, named bond chemistry, exceptional corroborated protection, or relevant exact-product test → only `moderately_damaged` + `highly_damaged`. The specialist result replaces the general-high set; never emit all three values. Generic silicone/oil/panthenol/ceramide/cationic polymer, repair naming, or generic lubrication alone is insufficient.
19. Classify `care_direction` as `protein`, `moisture`, or `balanced`: protein needs a material identifiable R5 route; moisture needs coherent conditioning/humectant/emollient support without a dominant protein-film route; balanced needs a substantive mixed protein-plus-moisture architecture and is never a neutral fallback or uncertainty bucket. Do not diagnose a user protein/moisture deficiency.
20. Classify `repair_support_level` as low ordinary conditioning, medium distinct temporary protein/peptide/keratin fibre-film support, or high materially stronger named bond route visible in the reviewed formula. Positioning alone cannot raise the level. Formula-only conclusions remain E2 and never claim structural repair.
21. Emit deterministic unsalted per-field SHA-256 fingerprints from each canonical field payload. Legacy salted hashes may only preserve an unchanged historic field approval. The two v1.6 fields open for review; existing unchanged fields retain approval. Keep the whole-profile fingerprint versioned with the semantic standard version.
22. Write all reviewer-facing evidence text in English: `rationale`, `evidence_signals`, `derivation`, `threshold_reasoning`, and `limitations`. The compact Lab overview must expose `threshold_reasoning`, not substitute a generic rationale.
23. Every allowed `primary_focus` value requires its own threshold comparison. Never let an unmapped specialist value fall through to `general`; unsupported values require rework.
24. For a new Product Intake Conditioner, emit the complete `conditioner-research-envelope-v1.6` in the `property_synthesis` artifact. Do not replace full research with current database rows.
25. Let `conditioner-production-adapter-v1` derive current compatibility/rerank fields. Research exact `conditioner_rinse_out` protocol content separately from authoritative directions; INCI never supplies application instructions.

Always use “potential,” “candidate,” or “unknown” for formula-only outcomes. Never infer exact percentages, pH, deposition amount, sensory feel, buildup, structural repair, or allergy safety from INCI.

The complete comparison fields are `conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`, `primary_focus`, `secondary_focus`, `hair_thickness_fit`, `damage_fit`, and `texture_fit`. The three fit arrays are broad product priors, not permanent universal exclusions.
