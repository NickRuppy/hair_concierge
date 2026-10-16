# Oil direct-properties round 6 method v0.1

Authorized OE39 on 2026-10-05 under approved OE13/OE14 properties. This run reuses remaining-properties semantics of standard v0.1 with weight excluded entirely from lane records and comparison. All six cases have prior development exposure. No holdout, sensory accuracy or production readiness claim. Fit remains pending and all ten fit cells per product per lane stay unknown/policy_not_defined.

Stage1 allowed files: method.md, blind-packet.json, blind-lexicon.json only. Read actual file bytes and record sha256 in files_read. No other files, memory, browsing, prior answers, other lanes or reviewers. Save lane-{a,b}/blind-records.json and blind-notes.md and stop for root seal. Stage2 only after root explicit followup: additionally unblinded-packet.json and blind-stage-seal.json; keep every original blind record field identical. Final files_read includes all five. This is self-reported read scope, not an enforced sandbox. Disclose recognition and forbidden access in notes.

Run_id oil-direct-properties-round-6; method_revision direct-properties-v0.1. Lane outputs named blind-records.json/final-records.json and corresponding notes. Include raw_inci unchanged on each record. Ledger every rank with raw_name/canonical_name/dictionary_roles/formula_role/role_reason/ambiguity. Each record: neutral_id, raw_inci, ingredient_ledger, auxiliary_suffix, base, penetration_potential, build_up_potential, ingredient_flags, completion_status, issues. No weight anywhere in records. Metadata keys are closed eight-key PROPERTY objects; lists evidence/counter_signal/unresolved, nearest_alternative explicit scalar or null, reason string. Auxiliary suffix {start_rank: integer|null,markers:[{rank,function}],reason}; at least two independent marker functions when start_rank exists.

Final adds named_oils, dispenser, provides_heat_protection, provides_uv_protection, supported_uses, use_evidence, application_scenarios, fit, reviewed_inputs. A named_oils item uses hero_id,hero_name,matched_ranks,prominence only; qualified multi-ingredient macerate mapping retains all relevant matches and explicit gap if roles conflict. use_evidence.value equals supported_uses. reviewed_inputs={stage:controlled_unblind,blind_fields_preserved:true,claims_review_complete:true,directions_review_complete:true,positioning_review_complete:true,packaging_review_complete:true}. Source review may be complete with mechanism still unknown. Every direction in source packet must either appear as a coherent scenario or have an explicit reason it establishes no eligible use. Scenarios source_id/direction_id/supported_roles/site/stage/dose/contact_time/removal/restrictions; optional shake/frequency. Unstated facts use 'unestablished'. Stage2 sources are observations, not classifier targets: independently apply gates and supported-use mapping.

## Inputs and independence

Exact identity and one published ingredient declaration are reconciled outside each classifier. Preserve complete raw declaration, ranks and exact normalization mappings. No merging competing formulas. Published source packets are not batch-label verification. A material unknown identity or incomplete formula blocks completion; an uncertain grade/property can remain unknown.

Stage 1 is blind: read only this standard, frozen ingredient dictionary and neutral blind packet. Do not browse, inspect repository/catalog/selection files, infer brands, use another lane, or ask another reviewer. Use the dictionary's exact forms and reviewed aliases, retaining oil/extract/derivative distinctions. Generic primary ingredient evidence is allowed; sources do not serve as finished-product answers. Ingredient roles are clues rather than finished performance or concentration.

Save and seal blind-records.json and blind-notes.md before requesting Stage 2. Stage 2 reveals only exact product packaging, heroes, directions and claim reviews. Blind formula values must remain identical. A necessary correction creates a separately logged new derivation; positioning must not rewrite formula truth. Names/formulas from this exploratory set cannot later be called unseen holdout cases.

## Vocabulary and evidence metadata

Use these exact values:

- base: pure_plant_oil, plant_oil_blend, silicone_led, ester_alkane_led, hybrid, water_based, unknown.
- penetration_potential: penetration_potential, surface_led, unknown.
- build_up_potential: low, elevated, unknown.
- named_oils[].prominence: leading, supporting, trace, absent, unknown.
- dispenser: dropper, pump, spray, pour, metered_drop, other, unknown.
- provides_heat_protection and provides_uv_protection: true or false, no third state.
- ingredient_flags: all five boolean keys silicones, mineral_oil, drying_alcohol, fragrance, scalp_active_botanicals.
- supported_uses: unique subset pre_wash_fibre_treatment, leave_on_fibre_conditioning, dry_finish, scalp_application.

Each assessed property uses {value, estimate, confidence, evidence, counter_signal, nearest_alternative, reason, unresolved}. Confidence is high/moderate/low classification robustness, never efficacy. Evidence is a list of exact rank/canonical-name or source references. Inferred substantive base/penetration/build-up and non-absent prominence require estimate:true and confidence moderate/low. Factual flags/observations/claim gates use estimate:false. Unknown names the gap; do not fill nulls or omit keys. No percentages, inferred 1% boundary, measured performance, growth/repair/protein-moisture/toning/porosity or new effect property.

## Blind ordered mechanism

First create a ledger for every ingredient: rank, raw_name, canonical_name, dictionary roles, formula_role (principal, secondary, auxiliary or unresolved), role_reason, ambiguity. Formula_role is an estimated functional reading, not a mass share. Count every intact botanical oil for base inventory; prominence cannot erase an oil. Report auxiliary suffix separately, including markers/ranks or no boundary. An essential aromatic oil is distinct from an intact fixed conditioning oil.

Base: review the whole carrier/vehicle architecture. Water-leading credible aqueous architecture -> water_based. One intact plant-oil carrier and only recognized auxiliaries -> pure_plant_oil base (not literal analytical purity). Two or more intact plant oils with no competing synthetic carrier -> plant_oil_blend. Otherwise silicone_led or ester_alkane_led requires that family to explain the principal backbone. Hybrid requires affirmative joint backbone evidence. First-two differing carriers, ingredient counts or uncertainty alone never establish hybrid. Challenge the strongest rival. Unknown if genuinely balanced or decisive carrier identity remains unresolved.

Penetration: exact-formula evidence wins only within its conditions. Otherwise initial positive whole-oil anchors are coconut oil, Camellia oleifera seed oil and safflower seed oil, within the dictionary's exact-form limitations. Estimate penetration_potential when admitted oil(s) form a principal plant-conditioning backbone. Estimate surface_led when a coherent film/emollient backbone predominates and studied oils are secondary. Pure mineral oil offers an affirmative surface anchor. Secondary positive presence does not win automatically. No absent-study negative, blanket silicone nonpenetration or normal-dose efficacy inference. Plant-only systems without a relevant admitted anchor or balanced delivery interpretations can remain unknown. Compare both architectures and record blend/lab-to-retail extrapolation.

Build-up: relative persistent conditioning-film/load propensity under comparable small applications, not measured repeated accumulation or cleanser requirements. Elevated requires a coherent substantial gum/resin/wax/rich persistent coating; low requires a coherent fluid/spreading weak-film system without substantial residual-film counter-signals. Full residual conditioning system matters. Volatile carrier does not cancel prominent film; one late gum does not force elevated. Plant/silicone origin never decides it. Balanced residual-film readings permit unknown.

Flags: exact recognized form match -> true plus all matching names/ranks. Complete reviewed INCI without a recognized match -> false. Unmatched decision-relevant material requires review, not fabricated false. Mineral oil means the closed liquid mineral identity, not all hydrocarbons/petroleum waxes. Drying alcohol excludes fatty alcohols, glycols, Phenoxyethanol and Benzyl Alcohol. Fragrance includes declared fragrance/allergen exposure even preservative-use Benzyl Alcohol; it does not assert intentional perfuming. Scalp botanicals use the closed dictionary rosemary/mint/eucalyptus/tea-tree essential-oil and Menthol/Camphor set; extracts, lavender alone and every fragrant plant do not extend it. No flag infers tolerance or application permission.

Auxiliary-context suffix: earliest suffix with at least two independent recognized auxiliary functions in different ingredients, established carrier earlier, and no later competing vehicle, synthetic emollient, structurant or unresolved ingredient. Only recognized auxiliaries and intact botanical oils can occur in that suffix. Several fragrance allergens count once; one dual-function ingredient cannot supply both; colorants cannot establish the boundary. Already established principal/secondary role takes precedence. This positional/functional heuristic never detects percentage or negligible activity.

## Controlled unblind mechanism

Named oils: use each predeclared hero_id and ingredient identity mapping in the unblind packet. Reviewed no heroes -> []. Present hero: frozen principal role -> leading; affirmative secondary role -> supporting; only qualified auxiliary suffix -> low-confidence estimated trace with two markers retained. Conflicting roles -> unknown. Absent requires no exact recognized match after identity review, no matched rank. No rewriting the blind ledger to fit marketing.

Dispenser: observed exact mechanism/directions only. Pipette -> dropper; controlled release of individual drops by tapping inverted bottle -> metered_drop. Other requires observed mechanism detail (including an open-access jar). Unseen outlet/mechanism -> unknown; closed flip-top shape alone cannot establish unrestricted pour versus metered drop. Do not guess count/unit conversions.

Heat: reviewed accepted exact-product manufacturer/pack explicit heat-protection claim -> true; completed review without accepted positive -> false. No ingredient AND requirement. Temperatures remain source text, not another property. False is absence of an accepted claim, not tested zero protection.

UV: recognized exact filter in this ingredient declaration AND accepted manufacturer explicit hair-UV protection claim -> true. Other three filter/claim combinations -> false. General sun-aftercare/skin SPF/antioxidant/color language is insufficient; explicit protection of hair color from UV qualifies. No SPF/grade/effect inference.

Supported uses: exact authoritative directions only, keep coherent scenarios. Explicit fibre + wash-out/prewash -> pre_wash_fibre_treatment. Retained damp/general fibre application -> leave_on_fibre_conditioning. Explicit retained dry postwash/styling application -> dry_finish. Explicit scalp site -> scalp_application. Explicit both damp/dry retained alternatives -> both fibre roles. Dry prewash never dry_finish; scalp-only prewash never fibre prewash. Styler/finish context may establish retention when no rinse step is printed; absence of rinse alone cannot. General retained stage does not establish dry_finish. Literal words conditioning/finish unnecessary. Never invent stages, overnight, scalp, doses or rinse commands; do not combine facts from separate instructions.

Each scenario records source_id, direction_id, supported_roles, site, stage, dose, contact_time, removal, restrictions, and optional shake/frequency. Preserve unstated facts as unestablished and distinguish explicit removal from retention-by-context. Multiple coherent scenarios per role allowed. Claims cannot establish supported uses without directions.

## Record shape and completion

blind-records.json = {run_id, method_revision, lane_id, files_read, records:[{neutral_id, ingredient_ledger, auxiliary_suffix, base, penetration_potential, build_up_potential, ingredient_flags:{five property objects}, completion_status, issues}]}. True flags include matches in their evidence. Unknown uses an explicit gap. A complete blind record may have property unknowns.

final-records.json = same top-level provenance and each unchanged blind record extended with named_oils:[{hero_id, hero_name, matched_ranks, prominence:property_object}], dispenser:property_object (other names mechanism), provides_heat_protection:property_object, provides_uv_protection:property_object (evidence names filter and accepted claim when true), supported_uses:array, use_evidence:property_object, application_scenarios:array, fit:{thickness:{fine,normal,coarse}, texture:{straight,wavy,curly,coily}, damage:{healthy,moderately_damaged,highly_damaged}}. Every fit cell = {value:unknown, reason:policy_not_defined}; this preserves the layer without unapproved suitability. Add completion_status, issues and reviewed_inputs metadata. Omission/null is not false/unknown/empty.

Each lane's notes seal lists exactly files read, banned access incidents (none or explicit), input/method/dictionary digests, completed IDs and property gaps. Final notes attest blind preservation and stage separation. Do not dispatch another reviewer or read peer output.

## Interpretation and gates

Agreement measures repeatability, not accuracy. Compare exact raw agreement by field and substantive agreement where both lanes have non-unknown values, with exact denominators/unknown coverage. Report boolean positive/negative prevalence and positive-/negative-conditioned agreement. Exclude all mutually unknown fit cells from direct-property headline metrics. No grade, user-fit, production eligibility or adapter readiness is implied. New evidence/rules produce a new immutable revision and re-derivation.

