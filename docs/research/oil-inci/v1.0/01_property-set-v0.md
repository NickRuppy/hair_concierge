# Oil engine — proposed property set v0

Current weight routing (OE31–OE36, 2026-10-04): [material reference v0.10](03_weight-reference-v0.10.md) admits exact `HELIANTHUS ANNUUS OIL` and its reviewed parenthetical spelling as light/low with medium alternative, applying the existing approved sunflower tendency. All 67 v0.9 entries and Calendula guidance are unchanged. [Blend policy v0.2](04_blend-weight-policy-v0.2.md) retains the whole-system B4 clarification. B0 exact matching now resolves these shorter sunflower names through a separate admitted entry; it does not erase plant-part words or automatically match unlisted declarations to Seed Oil. Other properties retain v0.1. Frozen round 4 retains policy v0.1 and its earlier inputs/identity gaps. The [working decision log](../../../../plans/oil-inci/research/weight-uncertainty-decisions-2026-10-02.md) retains K18 light/low (OE28), Wella medium/low (OE32) and NUXE Original light/low (OE34), with their respective alternatives. No fresh application run, sensory validation or general intake readiness is claimed.

Status: **property/value set approved by Nick on 2026-10-01; requested fresh engineering review completed**. Review retained all approved properties and values; technical record clarifications are below. Research draft, not an operational standard or intake engine. The first exploratory round is completed; formal sensory calibration/holdout remain pending.

Owning decisions: `plans/oil-inci/phase1-decision-coverage.md` (OE1–OE13). Market evidence: `plans/oil-inci/research/market-coverage-audit.md`. Nick approved the property/value proposal shown in this chat; operational anchors and fit mapping still need development. Material review-driven changes to the approved meanings require a new decision.

**Subsequent OE14 clarification (2026-10-01):** Nick selected approximate rules, clearly marked as estimates, for the first exploratory round. The operational draft is `plans/oil-inci/classification-mechanism-proposal.md`. Inferred formula properties and non-absent oil prominence retain estimate metadata/counter-signals; exact ingredient, package, direction and claim facts keep their distinct evidence basis. Unknown remains allowed for genuine ambiguity, and no percent, measured performance, invented directions or changed heat/UV gates follow from this authorization. Scientific findings and estimation-policy proposals are preserved separately.

## 1. Direct product aspects

| # | Aspect / proposed field | Proposed allowed values | Input and meaning |
| --- | --- | --- | --- |
| 1 | Base / `base` | `pure_plant_oil`, `plant_oil_blend`, `silicone_led`, `ester_alkane_led`, `hybrid`, `water_based` | INCI-led formula architecture. One value, not a collection of marketing tags. Hybrid means a materially mixed backbone not fairly described by one of the other bases; thresholds/precedence still need anchors. Ester/alkane-led replaces the earlier volatile-dry-oil wording: no assumption that every ester is volatile or that this base guarantees a dry finish. |
| 2 | Named-oil prominence / `named_oils[].prominence` | `leading`, `supporting`, `trace`, `absent` | Record each advertised hero oil separately after unblinding. Prominence describes its rank/context in the frozen INCI, not percentage. With no named hero oil, emit an empty list; there is no artificial hero to score. The relevant INCI identity and rank are evidence. Exact tail/rank rules remain to be established. |
| 3 | Formula weight / `weight` | `light`, `medium`, `rich` | Structured judgment from the whole INCI architecture. Expected product load, not independently researched thickness eligibility. Marketing "weightless" does not set this value. |
| 4 | Dispenser / `dispenser` | `dropper`, `pump`, `spray`, `pour`, `metered_drop`, `other` | Exact packaging fact, never INCI-derived. Metered drop covers a controlled-drop bottle without a pipette (e.g. the Olaplex No.7 format described by the manufacturer). Other must name the observed mechanism; this prevents a forced pour/spray label for a roll-on or other form. No generic drops-to-pumps conversion. |
| 5 | Penetration potential / `penetration_potential` | `penetration_potential`, `surface_led` | Proposed simple two-value formula classification, with confidence separately. The first requires credible penetrating-oil evidence relevant to the formula; the second means the expected action is predominantly at the surface. Neither asserts that a finished product was experimentally tested or that surface-led means zero possible penetration. The earlier proven/some-evidence labels are not adopted as efficacy states. The science pass must decide whether these two values are actually supportable before calibration. |
| 6 | Heat protection / `provides_heat_protection` | `true`, `false` | True when an admissible explicit exact-product manufacturer/pack heat-protection claim is established; otherwise false. Claim-adoption exception already accepted. No independent ingredient requirement added and no temperatures. False means no accepted positive declaration, not tested zero effect. Claims/source eligibility must be documented in the standard. |
| 7 | UV protection / `provides_uv_protection` | `true`, `false` | OE12: true only when BOTH recognized UV-filter ingredient evidence in the exact-product INCI AND an explicit manufacturer claim of hair UV protection are present; otherwise false. Matched ingredients and claim source are evidence underneath this one property. No SPF, grades or third state. |
| 8 | Supported uses / `supported_uses[]` | Any supported subset of `pre_wash_fibre_treatment`, `leave_on_fibre_conditioning`, `dry_finish`, `scalp_application` | Multiple values may apply. Exact directions establish the application site, stage and rinse context; permissible formula inference is an open decision. Scalp remains research-only. Empty means no use established, not complete proof that every use is impossible. A scalp-only pre-wash instruction must not automatically establish a fibre-treatment role. |
| 9 | Build-up potential / `build_up_potential` | `low`, `elevated` | Proposed bounded formula judgment about persistent residue/accumulation potential. Low is not a promise that ordinary shampoo removes everything; elevated is not a universal negative or a conclusion from any silicone being present. Persistent and volatile species must be considered separately under scientifically reviewed anchors. |
| 10 | Ingredient flags / `ingredient_flags` | Five independent booleans: `silicones`, `mineral_oil`, `drying_alcohol`, `fragrance`, `scalp_active_botanicals` | From recognized matches in a complete exact-product INCI. Each true flag names the matching ingredients. False means no recognized match in that complete list. Drying-alcohol recognition must distinguish solvent alcohols from fatty alcohols. Fragrance evidence includes recognized fragrance ingredients/allergens, with its lexicon fixed before calibration. Scalp-active botanicals covers the agreed menthol/camphor/mint/eucalyptus/rosemary-essential-oil/tea-tree group after exact-form review; rosemary extract is not automatically rosemary essential oil. No concentration, tolerance or growth prediction. Toning is excluded. |

## 2. Missing evidence and confidence

For base, named-oil prominence, weight, dispenser, penetration potential and build-up potential, allow a research-only `unknown` when required evidence does not support one of the substantive values. This is a gap to resolve, not a default product class.

For heat and UV retain the approved strict boolean output. Missing claim/ingredient evidence does not introduce a third protection value. A broken exact identity or incomplete/unresolved formula packet is still a record-level research blocker, not a valid completed product that can acquire confident false ingredient flags.

Every assessed property retains:

- evidence/source reference and short reasoning;
- confidence `high`, `moderate` or `low` (robustness of classification, not percentage or clinical efficacy);
- an unresolved-evidence note where relevant.

These are review metadata, not additional consumer properties. No invented concentration, dosage, penetration percentage or protection grade.

### Completed-record convention (engineering review clarification)

A completed research record includes every property and every one of the five ingredient booleans. Omission or `null` must not become an alternative spelling of `unknown`, an empty collection or `false`. Named-oil row `unknown` is permitted when a known advertised hero cannot be assessed; unresolved positioning capture is a record-completeness issue, not `named_oils: []`. Empty named-oil output requires reviewed positioning with no advertised hero; empty supported uses requires completed directions/use assessment with no established role. Unreviewed input must not become a completed negative result.

Preserve which source/claim reviews were completed in metadata. Heat/UV remain booleans with their approved positive-evidence rules; incomplete identity/formula packets remain blocked at record level. All assessed `unknown` values name the missing evidence. Arrays representing sets use unique members.

## 3. Application facts attached to supported uses

Capture from exact directions, not INCI:

- site: lengths/ends versus scalp, including explicit restrictions;
- damp/dry stage;
- published dose and its actual unit;
- contact time or overnight permission when stated;
- rinse/shampoo requirement;
- shake/mixing instructions where relevant.

Do not score these as extra effect properties. Missing facts stay visibly unestablished; overnight is a timing detail, not a fifth role. A scalp instruction cannot manufacture a growth claim.

Keep each coherent application scenario together: supported role, site, damp/dry stage, dose/unit, timing, rinse requirement, restrictions and source. Multiple scenarios may exist for one supported role. Do not flatten a scalp rinse-out instruction and an overnight ends instruction into scalp overnight permission. Derived fit retains the applicable role/scenario and any condition.

Freeze exact market, variant and package identity alongside the formula. Shared INCI across sizes does not establish a shared dispenser or dose. Record dated source excerpts, frozen normalized INCI, and rule/ingredient-lexicon revision identifiers; a URL alone is insufficient reproducibility evidence.

## 4. Derived fit — separately proposed, not separately researched

Derive only after direct properties, using a separate explicit policy. Do not change formula truth to obtain preferred fit coverage.

| Fit axis | Profile values | Proposed research fit verdict per value |
| --- | --- | --- |
| Thickness | `fine`, `normal`, `coarse` | `suitable`, `conditional`, `not_suitable`, `unknown` |
| Curl pattern | `straight`, `wavy`, `curly`, `coily` | `suitable`, `conditional`, `not_suitable`, `unknown` |
| Damage level | `healthy`, `moderately_damaged`, `highly_damaged` | `suitable`, `conditional`, `not_suitable`, `unknown` |

These are proposed research values, not an approved eligibility-table emission or recommendation rule. The thickness hard-gate choice remains open. Conditional must explain the condition; unknown must not silently become suitable. Curl fit does not assert curl hold/definition, and damage fit does not create repair efficacy. Where fit differs by supported use, retain that role context rather than making a misleading universal product verdict.

## 4a. Minimal validation and production separation

- Require all five ingredient flag keys; a true flag names recognized INCI matches.
- Validate the heat claim rule and all four UV filter/claim combinations. UV is true only for present filter + accepted positive claim; all three other combinations are false. Test incomplete-formula blocking separately.
- `other` dispenser requires the observed mechanism; absent named oil has no matched rank; non-absent resolved prominence names its match; conditional fit has an explicit condition.
- Keep research records separate from today's production oil schemas. Existing intake requires known weight and at least one of three fibre roles, and its legacy ingredient-flag list has different meanings. An unknown/empty/scalp-only research record must not be forced through it.
- Later projection must explicitly report non-projectable records; the existing subtype/purpose/thickness mapping is an unresolved product decision, not a default research label.

## 5. Inherited effects and exclusions

OE4 retains one reviewed description per base (pure oil and plant blend may share one description), not a separately scored main-strength property. Exact descriptions remain to be approved; hybrid/water-based descriptions must not promise universal weight, humidity performance or equivalence to another product.

No per-product main strengths, repair property, protein/moisture direction, porosity fit, multi-use fit tag or toning flag. No added humidity, drying-speed or color-performance score from the market survey.

## 6. Sign-off and calibration sequence

Nick signed off this property/value set on 2026-10-01 and requested a quick fresh-subagent backend/database review before moving into the first exploratory product set. Formal calibration/holdout has not started; the first exploratory round is completed and its receipt is retained below.

Recommended order:

1. Complete Nick's requested engineering review of the approved property/value set; verify findings and resolve technical defects. Return material semantic changes to Nick.
2. Resolve the evidence lexicon and classification anchors: weight, base boundaries, penetration, persistence, ingredient flags/UV-filter recognition, and supported-use evidence. Run the targeted science pass before treating mechanistic assumptions as rules.
3. Agree the separate fit/eligibility policy and compatibility output. These can be discussed separately from direct-product properties; no requested layer is silently dropped.
4. Propose an initial small stress set (approximately six to eight exact products) for an exploratory calibration. Do not call it a gold set or sealed holdout, and do not choose reference labels from historical catalog values.
5. After approval of the run contract and identities, run the exploratory round, refine evidence/rules, then pre-register independent calibration/holdout gates. Exploratory products may later join development calibration but cannot become a genuinely unseen holdout.

This property proposal is not the later complete charter, classification standard or implementation plan. Those will be hardened and receive the applicable counterpart review before execution.

## First-round execution update — OE15

The proposed first independent eight-product round was explicitly authorized by Nick on 2026-10-01. Use the standalone operating standard `02_classification-standard-v0.1.md` and frozen round files for this run; earlier readiness statements above describe proposal history. This does not settle fit/eligibility or create a usable production engine.

## Current weight reference — OE16/OE17/OE18/OE19 (2026-10-02)

The approved weight values remain unchanged. Use `03_weight-reference-v0.10.md` and its 68 exact-declaration entries plus separate Calendula guidance for the material estimates, alongside blend policy v0.2 when interpreting the whole formula. OE36 resolves the shorter sunflower Oil declarations using the existing light/low tendency, with OE33/OE35 additions retained; no new product round follows from this reference update. Light natural oils are permitted; no residual-material family automatically imposes medium. Presence alone cannot impose rich or light. New run outputs remain estimated, with alternatives/confidence and no thickness/fit eligibility. Eight material benchmarks plus six hypothetical mixed probes are a separate limited research run, not complete product profiles or scientific calibration.

Historical hair-weight guidance (OE23, 2026-10-02): v0.7 contains 65 exact-material entries and separate Calendula carrier guidance. Approved changes are medium/low argan, moringa and black seed, and provisional rich/low Cacay. Other candidate priors retain their status; full-list sign-off precedes new product calibration. Professional practice is labeled separately from physical/family estimates, with counterevidence retained. Other approved properties and frozen run inputs are unchanged.

Historical research-round authorization (OE24, 2026-10-02): Nick’s “do it” authorizes reviewing the complete v0.7 list and proceeding with a small pure-oil/blend application round using the current rough priors. This supersedes the earlier pending-round wording for that limited trial; it does not validate every prior, establish a general intake engine or activate fit/production behavior. Frozen reference versions and prior rounds remain unchanged.
