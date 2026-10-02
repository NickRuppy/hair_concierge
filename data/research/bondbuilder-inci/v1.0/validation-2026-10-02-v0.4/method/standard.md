> Frozen run-local copy for the authorized 2026-10-02 four-product validation. Source: `docs/research/bondbuilder-inci/draft-v0.4/standard.md`. Original draft-status statements describe the source document; this run's freeze receipt authorizes only this validation, not method lock or activation. No semantic rules changed. Referenced owner/plan links are provenance only and are not additional lane inputs.

# Bondbuilder classification standard — consolidated v0.4 draft

Semantic version reserved: `bondbuilder-inci-v0.4`; lexicon `bondbuilder-lexicon-v0.1`. **Unfrozen review draft: not logic-locked, run-authorized, or intake-active.** No v0.4 classification result exists. This self-contained draft carries the owner review and approved application direction forward; it does not replace historical v0.1/v0.3 records in place.

Decision sources: [owner review](../../../../plans/bondbuilder-research-engine/owner-review-2026-09-30.md), [approved application guidance](../../../../plans/bondbuilder-research-engine/application-review-2026-09-30.md), [bounded remaining-facts pass](../../../../plans/bondbuilder-research-engine/remaining-facts-2026-09-30.md), [final owner policy and application follow-up](../../../../plans/bondbuilder-research-engine/application-followup-2026-10-01.md), and [existing Personal Plan authority](../../../personal-plan/categories/bondbuilder/decision.md). The synchronized [runbook](runbook.md), [prompt](researcher-prompt.md) and [anonymous-stage instructions](blind-instructions.md) are part of this draft. All require a common freeze receipt before a future run. This unfrozen draft was synchronized on 2026-10-01; no frozen historical method is changed.

## 1. Category boundary

Include targeted at-home cosmetic hair-shaft repair/reinforcement treatments for DE/EU research targets with compatible evidence for one of the five families in §4 and a specialized treatment role. Reinforcement can include non-covalent interactions or mineral management; membership does not assert native-bond reconstruction.

Exclude ordinary conditioning, generic protein/amino-acid repair and bond/plex branding without compatible specific technology, salon mixing/service additives, medical/scalp-disease or hair-loss treatment. Mask/leave-in presentation alone does not exclude a specialized treatment. New unrecognized technology routes to `category_review`, not approved category membership. The low-trust submission default is not a substitute for qualifying the category. No automatic expansion beyond these five families.

Identity means exact manufacturer/product/version, market, size/identifier where supplied, dated formula evidence and source-version binding. Same-formula sizes are not independent validation products. Cosmetic advice never promises permanent restoration, measured superiority or guaranteed personal results.

## 2. Input authority and source binding

Resolve raw complete INCI before assessment: exact supplied pack/label → exact current local manufacturer → reliable exact local retailer → corroborating fallback. Retain retrieval date, authority tier, raw list, normalization, order, conflicts, raw/normalized hashes and size/version identifiers. A formula code, product selector or retailer article is not a GTIN. A listed GTIN is not proof of a scanned pack.

Do not splice lists, declare worldwide formula equality or erase displaced evidence. A clearly unrelated Shampoo block is not a competing treatment formula. Source-specific findings are distinct from actual-pack/catalog checks. Material unresolved identity conflicts hold target-product findings while preserving anonymous marker observations.

Owner-resolved Redken exception: research the selected **Douglas DE Intensive Treatment 190 ml / article 1192227** 16-ingredient source-version; preserve the displaced DE manufacturer's list without keeping this chosen research target on hold merely because the alternative exists. NL/AU ingredient-sequence corroboration is not concentration/pack equality. A materially different future supplied pack requires its own binding; the owner exception is not a general convenient-source rule.

Directions are independently transcribed, never derived from INCI. Select a dated exact applicable direction source; separately retain manufacturer/professional recommendations and conflicts. Exact local/pack instructions prevail over generic editorials or cross-market complements. Never combine incompatible cadence variants into a new course.

Scientific support and practical experience are separate lanes. Each source has original URL/reference, access level, author/affiliation/commercial context, product/technology/system/predecessor scope, observations, limitations and relevance. An abstract is not inspected full text; a video title/link is not an inspected opinion. Mixed reviews and inaccessible optional sources are not automatic negative evidence.

## 3. Product properties and output boundaries

| Field | Values / ownership | Evidence and limits |
| --- | --- | --- |
| `boundary_status` | `in_scope | out_of_scope | category_review | research_hold` | Compatible recognized technology plus specialized role; branding alone insufficient. |
| `technology_family` | The five §4 values; null on target identity hold/exclusion | Formula candidate first, compatible targeted-use bridge after unblinding; no family-to-person ranking. |
| `claim_trust_level` | `high | medium | low`; null while identity/category applicability is unresolved | Exact §5 owner ruling or low-by-default for a resolved in-scope new submission. No model-awarded promotion. Hold is internal, not a fourth public tier. |
| `trust_basis` | `owner_anchor | owner_calibration | owner_default`; null when no finalized grade | `owner_anchor`: the chosen high-trust reference set; `owner_calibration`: another exact owner-reviewed grade, including later explicit promotions; `owner_default`: the new-submission low policy, not an empirical weak-evidence finding. Historical `research_judgment` artifacts remain unchanged but are not a current output option. |
| `classification_confidence` | `high | moderate | low`, per-property and record limiting factor | Robustness of classification, not scientific certainty or predicted effect. |
| `supported_outcome`, `evidence_profile` | Bounded endpoint, sources, scope, counterevidence, applicability, owner-reviewed rationale and German explanations | No potency score, maturity score or invented molecular endpoint. Complete sources/search limits stay in the envelope. |
| `application_mode`, `product_format`, `treatment_mode` | Reuse current product vocabulary; unresolved/unsupported values remain null | Placement, format and rinse mode are distinct. A unsupported runtime enum is a compatibility gap, not a reason to mislabel the product. |
| `application_facts` | §6 source-backed sequence, state, distribution, amount, contact/wait, rinse/layer, dilution, Conditioner and cadence | Research vocabulary is not automatically a valid stored runtime pointer. |
| Applied physical format | Source-backed texture/presentation distinct from treatment role; null with reason when unstated | The compact comparison includes format. Spray delivery, serum and gel-cream facts need not fit legacy role/format enums. A concentrate label alone does not establish texture. Strict storage vocabulary belongs to the adapter contract. |
| Intended role | Descriptive targeted treatment role only | No intensity property in new research. Preserve the legacy runtime/database field until the compatibility implementation; do not invent a replacement value to pass a validator. |
| `fit_assessment` | Separate nullable existing thickness suitability plus rationale, sources and holds | No all-thickness default, volume-sensitivity penalty or trust-to-fit conversion. Preserve existing approved facts until explicit review. |
| `holds` | Separate identity, boundary, claim-trust, protocol and fit reason arrays | Only affected properties/readiness are held; never erase established unrelated facts. |

Later persisted projections must use a strict versioned schema with bounded text/arrays and validated source references, not an arbitrary blob or page instructions. No schema/adapter implementation is claimed by this document.

## 4. Evidence lexicon — unchanged v0.1

| Normalized ingredient clue | Family | Exclusion / interpretation limit |
| --- | --- | --- |
| Bis-Aminopropyl Diglycol Dimaleate | `sulfur_targeting_dimaleate` | Specific clue, not proof of native-disulfide restoration. |
| sh-Oligopeptide-78, including spacing variants | `designed_peptide` | Not generic peptides, hydrolyzed protein or individual amino acids. |
| Diethylhexyl Maleate | `maleate_ester` | Not the dimaleate family; no evidence transfer from a similar name. |
| Citric Acid; supporting Sodium Citrate/Glycine/Arginine/Betaine only when present | `acid_calcium_management` | Generic acid/pH adjustment alone does not qualify. No concentration/pH from ingredient rank or branded complex percentage. |
| Hydroxypropylgluconamide **and** Hydroxypropylammonium Gluconate, including joined `(and)` notation | `gluconamide_gluconate` | Pair required for this named clue; not glucosamine. No supplier/dose/efficacy inference from presence. |

Deterministic marker extraction requires complete authoritative input; absence in an incomplete list is not conclusive. Lexicon source history remains in immutable v0.1 and its cited report seed. No new family/marker is introduced here. New submissions are low by owner policy, not because membership in any family predicts weaker efficacy.

## 5. Owner-controlled trust and confirmed calibration

Research a precisely stated repair/reinforcement benefit, not every molecular marketing slogan. Retain best support, methods/comparator, exact applicability, contrary evidence, missing information and classification confidence independently of the owner's tier policy.

- **High:** Nick's strongest trusted/reference options, assigned by exact owner ruling. Evidence limits remain visible; no guaranteed efficacy or measured superiority is implied.
- **Medium:** Nick's reviewed credible alternatives, assigned by exact owner ruling. Preserve relevant technology, formula/use and informed-practice support without implying equal effects.
- **Low:** every resolved in-scope new submission starts here with `trust_basis=owner_default`. Existing pilot low grades retain `owner_calibration`. Default low is not proof of weak research or no effect; do not fabricate an adverse rationale.
- **Internal hold:** unresolved identity/category or a pivotal missing product fact holds the affected property/readiness. It does not change the submission policy or erase unrelated established facts. Source limitations belong to the evidence record; no extra trust tier is introduced.

New submissions also start `is_chaarlie_recommended=false` through ordinary intake. Research every remaining fact and evidence lane; neither popularity nor a model's interpretation promotes trust or recommendation status. Nick may explicitly revise the exact product's grade and separately authorize recommendation promotion. Record the owner decision and source-version applicability before projecting a changed grade. A current owner-approved row is not reset to low/false by reassessment, a new submission that matches it, or a schema default. Check exact catalog identity and link rather than duplicate.

Confirmed exact pilot rulings, only after named identity is resolved:

All eight are owner calibration in the broad sense. Within `trust_basis`, `owner_anchor` identifies Nick's explicitly chosen top-three reference set, regardless of whether he retained or changed an earlier research proposal. K18's high ruling remains owner-calibrated rather than newly demonstrated scientific certainty. The other five use `owner_calibration`. Agreement with these grades tests owner-policy compliance, not independently discovered efficacy; the distinction changes no grade, admission floor or selection priority.

| Calibration identity | Grade | Basis |
| --- | --- | --- |
| OLAPLEX No.3PLUS | High | `owner_anchor` |
| K18 Leave-In Molecular Repair Hair Mask | High | `owner_anchor` |
| epres Bond Repair Treatment | High | `owner_anchor` |
| Elvital Bond Repair Plus Pre-Shampoo 200 ml | Medium | `owner_calibration` |
| Redken Acidic Bonding Concentrate Intensive Treatment 190 ml, selected Douglas formula | Medium | `owner_calibration` |
| Kérastase Première Concentré Décalcifiant 250 ml | Medium | `owner_calibration` |
| OGX Bond Protein Repair Sealing Serum 50 ml | Low | `owner_calibration` |
| Aveda Botanical Repair Bond-Building Pre-Shampoo Treatment 150 ml | Low | `owner_calibration` |

Original OLAPLEX No.3 remains a contextual owner-high anchor; it is not a ninth pilot row, unseen holdout or automatically active primary. Lifecycle authority still wins. Exact predecessor evidence needs an applicability bridge; no brand-wide/future-reformulation inheritance.

These grades encode Nick's explicit review, not independent researched-high/low validation. Preserve supporting evidence and its limits without forcing lanes to invent scientific proof to agree with the owner. A changed incompatible identity or new materially contrary evidence requires review of that change, not silent anchor inheritance or automatic catalog demotion.

Starting practice panel: Abbey Yung, Tom Hannemann / The Beautiful People, Dejan Garz; broader relevant institutions/professionals may complement it. Record exact product, original inspected statement, repetition/duration, reasoning and commercial context. Missing takes are neutral. No endorsement quota, follower cutoff, hidden sponsored-payment inference or review-volume veto. Repeated statements by one person are not independent experiments. Softness/combability or system trials cannot establish product-alone molecular repair.

## 6. Formula-first sequence and application envelope

Source preparation is unblinded. Future Stage A lanes must be fresh and read only [anonymous-stage instructions](blind-instructions.md), the generic stage prompt, and a frozen anonymous packet. Do **not** load this full standard or owner notes into Stage A: they contain named grades. Seal Stage A before named evidence/full standard. Recognition from distinctive chemistry is logged; this is process blinding, not an efficacy experiment.

Stage B receives the same frozen named evidence/directions/owner-ruling packet in both lanes. Resolve boundary intent, technology applicability, trust basis, explanations, protocol facts and separate fit. Preserve Stage A ingredients literally; log every candidate-to-final change and its source/rule basis. A combined changed-method/changed-source replay is not a source-isolated or rule-only experiment.

Application facts must distinguish:

- exact source and market/size applicability, format, routine position, dry/unwashed/wet/damp/towel-dried state and application area;
- amount/dilution/distribution, with source-provided units or qualitative coverage; no invented numeric dose;
- contact duration versus wait before the next step; exact/range/minimum, any supported longer wear, and unknown maximum kept distinct;
- rinse-before-Shampoo, Shampoo-layer-before-rinse, or post-Shampoo leave-in; subsequent Conditioner rinsing does not become a standalone treatment-rinse instruction;
- Conditioner permitted/prohibited **before**, permitted timing **after**, and required/recommended/optional use as independent facts;
- required versus recommended brand partners, initial and maintenance cadence, source variants and personal scheduling kept separate;
- qualitative dose versus absent numerical dose, and conditional cadence versus unstated cadence. Do not fill a weekly default or derive millilitres from packaging size.

Exact protocol constraints to preserve in fixtures: No.3PLUS wet hair/three-minute rinse then Shampoo; K18 Shampoo first/no Conditioner before, towel-dry, full four-minute wait then optional Conditioner, no standalone K18 rinse or compulsory second dose; epres intended-bottle dilution/dry unwashed hair/minimum ten minutes/optional overnight then normal wash/care; Elvital five-minute rinse before Shampoo; selected Redken 5–10-minute rinse before Shampoo; Première five minutes then Shampoo on top before rinse. Low-product feedback preserves its exact directions without granting curated admission.

Approved K18 guidance retains the user's usual Conditioner after the wait, with an option to skip when unneeded; no forced extra purchase. This is a Chaarlie guidance choice, not proof Conditioner is mandatory for efficacy. Première's brand Shampoo recommendation is not established exclusive dependence or alternative-equivalence proof. Manufacturer any-type claims do not establish weightlessness. Unsupported timing/cadence remains unknown, not an inferred weekly rule; missing critical schedule facts block the precise scheduled occurrence, not technology/trust findings.

Latest low-product source facts: UK OGX serum uses a small amount, spread from ends upward on damp/dry hair at bedtime, left overnight without rinsing, 1–2/week. Preserve UK applicability and unverified DE pack status; bedtime is not a mandatory post-wash placement. DE Aveda pre-shampoo is gel-cream, applied root-to-tip on dry hair for 5–10 minutes before rinse/wash/condition. Its manufacturer states weekly for mild–moderate damage and every wash for moderate–severe damage; the overlapping moderate branch remains explicit, with no universal interval. Manufacturer-listed diameters are separate attributed evidence, not independent fit or weightlessness proof. The dated follow-up owns sources and limitations.

## 7. Confidence and missing information

High confidence: exact complete relevant inputs, materially converging evidence and reasonable unknowns would not move the value. Moderate: one value best supported but realistic unknowns might move it to a neighbor. Low: pivotal incomplete/conflicting input or balanced interpretations prevents a dependable call. No percentages.

Owner trust basis must remain explicit; high trust is not high empirical certainty. Low confidence on identity/boundary blocks affected finalization. Do not attach empirical certainty to a policy default: record confidence in applicability of the owner policy separately from confidence in researched facts. Unknown fit or protocol facts block only corresponding readiness. Existing eligibility is not revoked merely because new research has a gap.

## 8. Product truth, fit and readiness

Authority → direct properties → separate fit/protocol projection → guarded intake/catalog. No personalization of truth to fill assortment gaps.

Preserve approved mechanism-neutral single-primary selection, saved-primary stability, explicit application/format preference matching and equal ideal shortlist absent preference. No trust-, price-, intensity-, mechanism- or weight-based automatic ranking. No new UI or deeper Routine Plan. German chat can explain technology/evidence/limitations from approved stored product facts.

Fit assessment names diameter (fine/normal/coarse) separately from density, length and pattern; formula/application evidence, exact product practice and counter-signals must support the assignment. Manufacturer positioning is attributed evidence, not a blanket empirical fit result. Unknown required suitability withholds new global readiness. This new pass must not overwrite existing approved suitability or recommendation flags.

Readiness is not one Boolean: source-version direct-property finalization, curated research candidacy, adapter projection readiness, catalog intake readiness, global recommendation readiness and publish authorization are separate. Curated research candidacy requires in-scope identity, an explicit owner-reviewed medium/high grade, at least moderate relevant fact confidence, adequate source-backed protocol review and no pivotal identity hold. This is not recommendation approval. Low/default assessments remain available for non-recommended user intake and scoped feedback; do not block the user's own catalog link merely for failing the curated trust floor. Runtime protocol compatibility, fit, lifecycle, price/images/links and guarded publication remain additional gates.

## 9. Calibration and unseen validation

The eight pilot products are calibration. All eight trust rulings are prescribed owner calibration: eight-row grade agreement is **not independent trust validation**. New low defaults are also policy assignments, not measured efficacy. Preserve original v0.1/v0.3 denominators and all historical holds. No new medium/high discovery quota or neighboring-tier generalization task remains.

Before future unseen labels, reserve exact unused identities/formulas with ordered deterministic substitutions; exclude pilot, same-formula sizes and predecessor variants. Validate category/family identification, source-backed application facts, evidence scope and owner-policy compliance, not automated efficacy tiers. Preregister positive technology coverage plus negative/boundary fixtures: ordinary acidic care, generic protein, plex branding alone, incomplete/conflicting INCI, system attribution and legacy-transfer traps. New positive category examples may all be default low. Protocol fixtures include overnight, conditional cadence and Shampoo layering. Synthetic negatives cannot stand in for unseen positive products. If feasible positive family coverage is unavailable, report and resolve that limitation before lock, not relabel calibration as holdout or search indefinitely for high/medium products.

Holdout targets: 100% agreement on assessable deterministic facts, boundary/curated-candidacy and exact owner/default policy; zero fabricated directions, unsupported promotions or resolved critical protocol disagreements. Freeze actual cohort denominators and hold treatment before labels. Report prevalence, holds, property/conditional agreement, confidence distribution and adjudication. The former ≥90% independent trust-judgment target is superseded: no such output lane remains. Passing is extraction/policy repeatability, not demonstrated efficacy.

## 10. Versioning and verification

Freeze new method/lexicon/prompt/runbook/blind-guide hashes, dated source registry, owner-ruling applicability, exact identity/INCI, anonymous/named packet hashes, cohort/reserves and preregistered metrics before classification. Future v0.4 artifacts use a new create-only directory under `data/research/bondbuilder-inci/v1.0/`; none is generated here.

Two lanes independently return read receipts, recognition incidents, seals, provenance, holds, explanations and source references. No lane web lookup, peer output or inherited earlier product-review conversation. Amendments produce new packet/run receipts; never regenerate historical freeze receipts. Source and method deltas are distinguished; do not claim causal isolation unless an actually sealed source-constant control exists.

Verify structural/schema consistency, every input/seal hash, complete source references, shared lexicon, named-basis coverage, protocol invariants and separate fit/activation status. The existing v0.3 verifier checks only v0.3 history, not this draft, holdout or future adapter.

## 11. Activation boundary and later integration

Nick owns method lock, product decisions and separate catalog/production approval. Research commands never write to Supabase. No v0.4 adapter, intake bridge or activation exists.

Later work must persist validated product-level technology/trust/explanations/provenance, preserve low/null/legacy assessment semantics, and expose facts through actual chat allowlists. Application pointers/compiler must support conditional optional-after-wait care and intermediate Shampoo layering; a scalar `conditioner_optional` swap is not sufficient. Required protocol and thickness gates remain. Any unsupported Chaarlie scheduling default requires a separate decision. Expand-compatible-deploy/backfill and data-preserving rollback belong to the implementation plan, not this draft's authorization.

## 12. Acceptance status

Confirmed: charter/property direction, eight owner trust decisions, default-low/non-recommended new submissions, no intensity property, source-selected Redken target, placement/contact-time facts, K18 optional-after-wait guidance and unchanged selection/UI scope. Draft synchronization: standard/prompt/runbook/blind guide updated to the 2026-10-01 rulings. Historical calibration: completed, not unseen validation.

Not passed: v0.4 freeze/replay, unused positive fact/boundary holdout, required new-product fit/protocol projection, pure adapter/intake bridge, database/chat integration, lock or activation. Draft/preview consistency checks are not a classification run or production proof. This is the review-ready method draft, not a completed intake engine.

