# Conditioner calibration and stress rule ledger

## v1.6 Production Adapter v1 — 2026-09-03

Nick approved the operational separation between complete new-product research and today's narrower database payload. `conditioner-research-envelope-v1.6` retains all nine fields and their evidence; `conditioner-production-adapter-v1` deterministically derives current weight, repair, balance, ingredient flags, and thickness/balance compatibility rows. Exact protocol content remains source-derived. This is an integration/output decision, not a semantic change to v1.6 and not publication authorization.

Status: locked Stage A research-logic ledger
Date: 2026-09-02

## v1.6 — locked care direction and repair support — 2026-09-02

Standard v1.6 adds two comparison properties to the established seven-field profile: `care_direction` (`protein` / `moisture` / `balanced`) and `repair_support_level` (`low` / `medium` / `high`). `care_direction` is a comparative product-formula direction, not a user protein/moisture deficiency. `balanced` means a substantive mixed protein-plus-moisture architecture and is neither a neutral fallback nor an uncertainty bucket. Formula-only classification remains capped at E2.

`repair_support_level=low` means ordinary conditioning/lubrication only. `medium` requires a distinct temporary protein/peptide/keratin fibre-film route. `high` requires a materially stronger named bond route visible in the reviewed formula. Finished-product positioning without that formula route, generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, and ordinary R1 conditioning do not exceed low; no formula-only route supports structural-repair language.

This is a semantic profile extension, not a rewrite of the historical v1.5 evidence. Existing seven field approvals remain valid when their field payload is unchanged. Independent Reviewer G completed the two new fields for all 11 eligible formulas with 22/22 exact agreement against the accepted key. The active composite keeps frozen Reviewer F values for the earlier seven fields and adds Reviewer G only for care direction and repair support: 94/99 pre-adjudication, 85/99 post-adjudication (85.9%), and 68/77 non-focus.

Nick locked the v1.6 logic after reviewing the three discriminating anchors: NEQI Volume Victory (`protein` / `medium`), OGX Biotin & Collagen (`balanced` / `medium`), and Guhl Bond+ (`moisture` / `high`). This approves the reusable classification rules, not every product record. Each product still requires its own local Lab decision, and production matching remains a separate policy gate. The composite is not a fresh de-novo nine-property rerun; a fresh full rerun remains required before any broad v1.6 repeatability claim.

## Historical v1.5-rc1 calibration and stress rules

## Damage Fit and fingerprint recalibration — 2026-09-01

Standard v1.5-rc1 narrows the `highly_damaged` prior. Low conditioning maps to `healthy`; moderate maps to `healthy` + `moderately_damaged`; and general high also maps to `healthy` + `moderately_damaged`. High conditioning adds `highly_damaged` only with a distinct protein/peptide/keratin fibre-film route, named bond chemistry, exceptional corroborated protection, or relevant exact-product test. Generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, and generic lubrication candidate alone do not qualify.

The accepted pilot key is now eight `healthy` + `moderately_damaged` profiles and three `moderately_damaged` + `highly_damaged` profiles: NEQI oat peptide, OGX hydrolyzed collagen, and Bond+ named bond pair. No pilot low-conditioning profile was observed. The current key versus the historical blind output is 63/77 overall and 46/55 non-focus. These are recalibrated-key metrics, not a v1.5 repeatability result: a fresh blind rerun is required before such a claim.

v1.5 also replaces salted per-field comparison hashes with deterministic unsalted SHA-256 fingerprints of the canonical field evidence/value payload. During migration, hydration recomputes the legacy salted fingerprint from current field content plus the stored review version and compares that result with the stored old hash. An unchanged field retains approval; changed content matches neither legacy nor current fingerprint and reopens. New decisions store only the unsalted hash. The whole-profile fingerprint remains versioned with the semantic standard version.

## Seven-field comparison model — 2026-08-26

Nick required every visible research property to differentiate products meaningfully within the selected category and provide a useful comparison basis. The pilot showed that `usage_role` was regular for ten of eleven eligible products and frequent for one only because its directions said “after every wash”; that wording does not establish an intrinsic product cadence because user wash frequency varies. `scalp_application_fit` split products only between explicit lengths/ends wording and unspecified whole-hair wording, with no product explicitly evidenced for scalp use. Both fields therefore measured label phrasing or category defaults rather than comparative product behavior.

Standard v1.4 removes `usage_role` and `scalp_application_fit` from the research property ontology, seven-field comparison profile, Lab review/fingerprint surface, worker prompt, and current calibration denominator. Exact application area, frequency wording, amount, contact time, and rinse instructions remain protocol metadata for routine construction. The retained-field blind projection is 72/77 before adjudication and 70/77 after the two explicit NEQI policy overrides; non-focus agreement is 53/55. Historical nine-field reviewer artifacts and the original 176-cell direct-property calibration remain provenance records, not current contracts.

## Operational evidence-rationale clarification — 2026-08-26

Nick rejected generic per-field reasoning during the 12-product Lab review. Every visible profile field now requires a product-specific signal list, derivation, and evidence limit. Formula fields name exact INCI/list positions or a precise architecture/absence pattern; fit fields expose the upstream policy derivation. This changed review evidence granularity and field fingerprints without changing the then-current v1.3 classification values or thresholds.

The follow-up review added an explicit transfer/threshold explanation. Every field now records why the exact signals clear the selected value and why the nearest lower, higher, or categorical alternative is rejected. This adopts Shampoo's useful observation-to-inference/counter-signal orientation while adding a systematic adjacent-class comparison that Shampoo did not require. The classification thresholds and accepted values remain unchanged; only the review evidence and its fingerprint become richer.

The subsequent Aqua Hyaluron versus Balea Med review exposed that the compact table still substituted a generic rationale for this comparison. The Lab now displays the full threshold reasoning in the overview and all evidence text is English. Aqua's moderate result explicitly names its single coherent base and the absent extra deposition route; Balea Med's high result explicitly names its additional cationic-polymer and emollient routes. This is a presentation and evidence-explanation refinement only: classifications and semantic thresholds are unchanged, while the affected field fingerprints change.

The final review also closed a future vocabulary gap: `shine` and `detangling` now have explicit primary-focus threshold explanations, and an unsupported focus fails closed to rework instead of silently emitting `general` reasoning. No pilot classification changed.

## Rule changes before blind calibration

The draft was tightened before the key was exposed to any reviewer:

- Formula-only `rinse_behavior` is always `unknown`; bottle richness and rinse behavior are separate.
- Formula-only `cumulative_residue_risk` is `indeterminate`; one-use deposition does not establish buildup.
- Product names, hero ingredients and current catalog labels cannot break a tie.
- A `higher` E2 property needs several coherent formula observations and no material counter-signal.
- Fragrance records exposure routes only; they do not make allergy, safety or diagnostic conclusions.
- Repair remains split into lubrication/protection, temporary surface film and bond-specific support.
- Product-form Gate G0 precedes formula classification.
- Before accepted metrics, the proposed key was schema-conformed to the standard's full shared-mechanism IDs; no direct-property value changed in that correction.

These changes formed the frozen `v1.0-rc1` rules used by all calibration attempts. They are not post-hoc calibration changes.

## Blind-calibration changes

The first Reviewer B run was rejected before accepted metrics because its inherited conversation context contained proposed key values. The classifications are preserved in `calibration-reviewer-b-invalid.json` with `usable_for_agreement_metrics=false`; they cannot support a blind-calibration claim.

Reviewer C was restarted with zero inherited turns and received only the standard, locked formula packet, and blank review packet. Its result attests `prohibited_files_accessed=false` and `inherited_key_context=false`.

Before final metrics, Reviewer C exposed three answer-key applications that were corrected and rerun without changing the blind classifications:

- all 11 eligible `usage_role` values became `unknown` because authoritative directions were absent from the reviewed packet;
- `repair_surface_film` changed from `candidate` to `none_visible` for Balea Med and Frizz Ease because R3 cationic-polymer or R4 emollient routes are not automatically R5 temporary-film routes;
- Hair Food Aloe moved from moderate/balanced to higher/likely-depositing for five coherent architecture properties because the high-list oil/emollient cluster and the amidoamine/fatty-alcohol base provide two endpoint-relevant observations.

The final standard adds matching clarifications: directions must be in the reviewed packet for an E1 usage role; R3 alone cannot populate `repair_surface_film`; generic gums, starches and bottle-rheology signals do not establish R5; and a shared mechanism cannot be counted as several endpoint observations.

Accepted clean-room agreement after that reconciliation:

- 157 of 176 direct-property cells exact (`89.2%`);
- 122 of 122 ordinal comparisons within one band (`100%` adjacent agreement);
- ordinal mean absolute difference `0.139`, maximum difference `1`;
- zero material disagreements and no evidence-ceiling or boundary-gate disagreement.

The 19 remaining non-exact cells are retained in `calibration-agreement.json` with dispositions. They are legitimate threshold uncertainty, generic-repair claim-scope ambiguity, bottle-rheology/tail-signal overextension, overconfident endpoint inference, or shared-mechanism double counting. None requires a scientific rule change.

## Stress-test changes

The five adversarial cases passed the frozen gates without a systemic rule change:

1. lightweight branding did not override a deposition-rich architecture;
2. a hero-oil multi-use product was stopped at G0;
3. a bond-branded dual-use product was stopped at G0;
4. anti-hair-loss routine claims were quarantined by G6;
5. hydrolyzed keratin remained a temporary film candidate, not structural restoration.

The calibration comparison was rerun after the answer-key and rule clarifications. The five stress cases still pass, and no systemic scientific rule change is required.

## Historical nine-field profile recalibration

The earlier checkpoint projected nine lean fields from reviewed direct properties plus authoritative directions. Standard v1.4 later superseded that comparison shape with seven fields.

- `conditioning_level` and `weight_potential` map from their corresponding direct-property bands.
- `rinseability` is removed because formula evidence cannot enrich it reliably; actual `rinse_behavior` remains trace-only and unknown without exact testing.
- Primary focus is a forced research headline after baseline conditioning is excluded. It requires a differentiating product purpose; `general` is used when none clears the threshold, while supported endpoints remain available for flat benefit mapping.
- Official positioning may corroborate a formula-supported route but cannot create one.
- At that checkpoint usage role and scalp application followed directions; v1.4 now preserves those directions only as protocol metadata. Thickness, damage, and texture fits remain broad priors rather than hard exclusions.
- Formula conflicts follow the source hierarchy and lower only affected fields. Only G0 product-form exclusions omit a profile.

Bali Curls 75 ml uses the manufacturer formula, confirmed for exact EAN `4262391991626` by HAGEL. This changes Bali from moderate/general to high conditioning and high weight. Formula authority is resolved; curl-support versus smoothing remains a focus-only hierarchy judgment under Reviewer F.

Reviewer F matched the accepted key on 94 of 99 cells and on all five named recalibration products' primary and secondary focus calls. The five remaining differences are confined to special-purpose focus hierarchy on Cantu, Colorglow, and Bali; they remain visible rather than being forced into agreement. The five adversarial cases remain 5/5 pass.

## Human checkpoint decisions after Reviewer F

Nick approved the accepted curl-support hierarchy for Cantu and Bali, retained Colorglow shine as a useful secondary, accepted the temporary-film repair boundary, and kept multi-use modelling separate. R5/R7 remain internal route names; the supported evidence principle is that ordinary conditioning improves surface/manageability without reversing structural oxidative damage, while protein/peptide routes may support temporary cosmetic film or protection.

NEQI exposed a matching-policy problem: a conflict-tagged formula-only `high` weight value would remove fine hair even though the uncertainty was unresolved and the exact product is Volume-positioned. The accepted lean profile therefore uses `weight_potential: moderate`, includes fine hair in `hair_thickness_fit`, preserves `weight_deposition_potential: higher` in the detailed trace, and keeps the field uncertain. These are two transparent differences from Reviewer F. The earlier v1.4 retained-key comparison was 70/77 overall and 53/55 non-focus; v1.5 supersedes it with the 63/77 and 46/55 recalibrated-key metrics above, pending a fresh blind rerun.
