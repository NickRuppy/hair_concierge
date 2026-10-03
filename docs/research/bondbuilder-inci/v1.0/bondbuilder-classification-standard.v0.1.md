# Bondbuilder classification standard — provisional v0.1

Semantic version: `bondbuilder-inci-v0.1`. Lexicon version: `bondbuilder-lexicon-v0.1`.

Prepared 2026-09-30 from Nick's confirmed [Phase-1 rulings](../../../../plans/bondbuilder-research-engine/phase-1-rulings.md). This draft is for the eight-product learning pilot, not production. Freeze its exact bytes before independent classification; changes after that require a new version. No calibrated efficacy ranking, confidence percentage, adapter, or logic lock is asserted.

## 1. Category boundary

Include targeted at-home cosmetic hair-shaft repair/reinforcement treatments for the DE/EU market with compatible formula evidence for one of the five recognized approaches in §4 and a confirmed specialized treatment role. Reinforcement may include non-covalent interactions and mineral management; membership is not a claim that native disulfide bonds are restored.

Exclude ordinary repair conditioning, generic protein/amino-acid treatments and bond/plex branding without specific compatible technology. A mask or leave-in presentation alone is not an exclusion. Salon mixing additives and medical/hair-loss treatments are outside this program. An unrecognized technology routes to `category_review`, not an invented low-trust grade.

The formula-bearing identity comprises manufacturer, exact product/version, market, size/identifier when supplied and dated formula evidence. Different packs/markets cannot be merged without documented same-formula evidence. The pilot covers eight named references/candidates, not every bond-branded product.

Cosmetic population: people caring for damaged hair shafts, not diagnosing scalp disease. No promised permanent restoration, treatment of hair loss, prevention of medical disease, or guaranteed personal result.

## 2. Input authority

Identity/formula hierarchy: exact supplied pack/label → current exact local manufacturer → reliable exact-product local retailer → corroborating fallback. A foreign manufacturer can support a foreign-formula research target, but cannot silently verify the supplied DE product.

Require exact identity, complete raw INCI, source URL/document reference, retrieval date, market, source tier, size/version where available and explicit conflicts. Normalize typographic separators/aliases without losing order, compound names or the raw original. Record raw-INCI and normalized-formula hashes separately. Formula codes and selector URLs are not GTINs.

Resolve conflicts by evidence, never merely selecting the most convenient or highest-tier list. A clearly mismatched shampoo block cannot become a treatment's authority. Retain displaced captures and reason for re-anchoring. Unknown version, mixed old/new copy or a material source conflict yields `identity_hold` / `formula_hold`; do not splice sources into a synthetic formula.

Scientific evidence has a separate hierarchy: inspectable primary study/test methods → inspectable manufacturer finished-product test → technology/supplier data → patent/mechanistic rationale → attributed marketing/experience. Study quality and product applicability matter more than this shorthand. Funding/author affiliation must be disclosed but are not an automatic rejection. A manufacturer's unsupported assertion is not an inspectable test.

## 3. Direct properties and evidence record

| Field | Values / rule | Evidence, judgment and counter-signals | Consumer |
| --- | --- | --- | --- |
| `boundary_status` | `in_scope`, `out_of_scope`, `category_review`, `research_hold` | Formula-compatible recognized approach plus targeted role; branding alone insufficient. Conflicts block finalization. | Category routing, not automatic admission |
| `technology_family` | `sulfur_targeting_dimaleate`, `designed_peptide`, `maleate_ester`, `acid_calcium_management`, `gluconamide_gluconate`, or null on hold/exclusion | Blind candidate marker extraction; final compatible role check. Record secondary markers without inferring multiple efficacies. | Explanation; no mechanism-based user ranking |
| `claim_trust_level` | `high`, `medium`, `low`, null while unassessable | §5 structured evidence judgment for the precisely stated repair benefit, not the broadest marketing slogan. | New curated admission and chat explanation |
| `classification_confidence` | `high`, `moderate`, `low` with limiting factor | Robustness under realistic missing information; independent of claim trust. | Review gate/provenance |
| `supported_outcome` | Source-bounded text, not a potency score | Name demonstrated/claimed endpoint, tested hair, comparator, use duration and scope. No unobserved molecular endpoint inferred from feel/combability. | Honest explanation |
| `application_facts` | Exact source-derived format, wet/dry state, order, time, rinse/layering, dilution and cadence; null where absent | Directions, not INCI. Keep optional and required partners distinct. Source claims of any-texture use do not prove empirical fit. | Existing protocol/placement after separate compatibility review |
| `evidence_profile` | Strict versioned record | Sources, scopes, access limits, affiliation, methods, contradictions, applicability bridge, neighboring-grade rationale, concise/deeper German explanation. | Database/chat later; full envelope retained |
| `fit_assessment` | Separate existing fit contract; unresolved entries stay unresolved | Formula/application and relevant fit evidence; no all-thickness default or trust-to-fit conversion. | Existing recommendation gate only |

Intensity describes intended treatment role, never measured effect size. Do not derive it from price, damage severity or trust. Existing production intensity/axis/protocol fields are compatibility concerns; this draft cannot force new technologies into legacy enums.

## 4. Versioned evidence lexicon

| Normalized input | Family clue | Supported role / exclusion |
| --- | --- | --- |
| Bis-Aminopropyl Diglycol Dimaleate | Sulfur-targeting dimaleate | Specific ingredient clue; patent or marker alone does not demonstrate native-bond restoration. |
| sh-Oligopeptide-78; typographic `sh- Oligopeptide-78` / `sh-Oligopeptide -78` | Designed peptide | Specific designed-peptide clue; not every peptide, amino acid or hydrolyzed protein. |
| Diethylhexyl Maleate | Maleate ester | Distinct from dimaleate above. No evidence transfer merely because both names contain maleate. |
| Citric Acid; supporting Sodium Citrate, Glycine, Arginine, Betaine when actually present | Acid/calcium management | Generic acid presence is only a clue. Require compatible targeted architecture/use evidence; no concentration/pH inferred from ingredient rank or branded complex percentage. |
| Hydroxypropylgluconamide AND Hydroxypropylammonium Gluconate | Gluconamide/gluconate | Pair required for this named technology clue, whether separately listed or joined by `(and)`. Not glucosamine; no supplier/concentration/efficacy inference. |

Lexicon evidence leads: report S01/S02/S15/S18/S20, retained in the [report seed](../../../../plans/bondbuilder-research-engine/report-derived-pilot-seed.md). These are sources to inspect, not preassigned product labels. Review date 2026-09-30. Raw source facts and limitations remain in research artifacts. A lexicon change requires versioning before another batch.

## 5. Deterministic versus judgment decisions

Deterministic: recognized ingredient extraction from complete normalized INCI; explicit direction facts; missing required input → hold; complete admission conditions below. Absence is conclusive only in a complete authoritative list. Marker extraction does not deterministically prove mechanism, benefit or category membership.

Bounded judgment: treatment architecture/role, technology applicability, trust, classification confidence and fit. Claim-gated: targeted intent and claimed repair outcome may be established only after unblinding and only when formula-compatible. Not inferable: exact effective dose/pH, head-to-head winner, expected personal benefit, effect magnitude, original keratin-backbone reconstruction or native-bond restoration without direct suitable evidence.

Trust assessment must name: (a) benefit being assessed, (b) best supporting evidence, (c) actual scope/product applicability, (d) methods/comparator relevance, (e) contradictory evidence, (f) missing information, (g) why the neighbor is less defensible.

- **High:** converging relevant support and a convincing current finished-product/formula/protocol applicability bridge. Inspectable evidence must distinguish the claimed supported benefit from ordinary conditioning/system confounding sufficiently to defend that benefit. No universal independent-funder rule; patents, popularity or a bare “clinically proven” assertion do not meet this anchor.
- **Medium:** relevant supporting research or inspectable testing for a recognized approach plus a defensible bridge to the exact targeted formula/protocol, but limited finished-product validation or narrower supported benefit. Molecular reconstruction claims can remain unproven while a narrower reinforcement benefit has medium support. Marker presence plus branding, without relevant empirical support/applicability reasoning, is insufficient.
- **Low:** completed, scoped research finds only insufficient/unconvincing support for the stated repair benefit, or applicable strong contrary evidence undermines it. Record search scope; absence in this search is not proof that no evidence exists.
- **Hold:** unresolved identity/formula, inaccessible pivotal evidence, incomplete search or balanced low/medium interpretations prevent a dependable judgment. Do not use low as a synonym for incomplete work or medium to satisfy a desired assortment.

Contradictory studies are weighted by test quality, endpoints and exact applicability, not counted. A different legacy formula is contextual unless bridged. Customer experiences may describe variability/usability, not molecular efficacy; mixed reviews alone do not cap high. No maturity score or public per-endpoint rating is added.

New curated admission requires `in_scope`, medium/high trust, no unresolved low/medium boundary, at least moderate classification confidence and complete product-specific review. This is **research admission candidacy**, not catalog publish/global readiness. Low submissions retain feedback without granting curated category membership.

## 6. Formula-first sequence

Source preparation is unblinded; it may know identities and assess capture authority. Independent formula lanes must start fresh with only this standard and a frozen anonymous packet: slot ID, complete normalized INCI/raw hash, input quality/conflict flags and non-marketing presentation facts. Hide brand/name, product URLs, source prose containing claims, prior labels, price and curation preference.

Before opening product evidence, each lane freezes its marker/architecture candidate record with confidence and limitations. Then supply the same frozen named identity/evidence/protocol packet to both lanes. Only boundary intent, source-based application facts, claim trust and explanations may be completed/changed at this stage; log every change. Claims cannot change observed ingredients or erase a conflict.

Blinding hides positioning, not uniquely identifying chemistry. A lane that recognizes a likely brand from a marker records the incident. This cannot be described as experimentally blinded real-world efficacy research.

## 7. Classification confidence

`high`: exact complete input, materially converging evidence and reasonable unknowns would not move the conclusion. `moderate`: best-supported value, but plausible unknowns could move it to a neighbor. `low`: incomplete/conflicting identity/input or balanced interpretations prevent a dependable call.

Confidence is per property with a record-level limiting factor. Low is visible; low confidence on boundary/trust/identity blocks finalization. Unknown application/fit facts separately block relevant readiness, not erase research findings. High-confidence low-trust is valid. Never invent percentages.

## 8. Product truth versus user fit

Authority → product properties → separate fit/protocol compatibility → guarded catalog process.

Trust informs new admission and chat wording, not the existing automatic order. Technology is explanatory, not a user-side mechanism lane. Preserve the approved mechanism-neutral Personal Plan policy, single primary treatment, saved-primary behavior and existing depth/layout. Price and format preferences stay in their existing consumers. No cheaper/weaker, premium/stronger, maintenance-only-budget or mandatory upgrade inference.

Fit remains separate. This provisional method does not claim calibrated all-thickness judgments. A protocol requiring overnight use or shampoo layering cannot silently fall back to an unrelated legacy protocol.

## 9. Calibration and holdout

First learning cohort: the approved eight in the pilot plan. Freeze policy/lexicon, source/identity manifests, anonymous and named packets before two independent lanes. Pilot holds count and are not replaced simply to improve coverage. Review results with Nick, generalize defects and replay a new method version without overwriting v0.1.

Before any unseen labels, reserve exact additional identities/packets with a deterministic ordered replacement list, excluding pilot products, same-formula size variants and predecessor overlap. Cover positive technologies where feasible and negative/boundary cases: ordinary acidic conditioner, generic protein mask, bond branding alone, incomplete/conflicting INCI, weak support, system-only attribution and legacy-to-current transfer. Protocol fixtures include overnight and no-rinse-before-shampoo cases. If positive family coverage cannot be sourced, report the gap and resolve it before lock; negative fixtures alone cannot establish positive generalization.

Provisional process acceptance target for the later holdout: 100% deterministic-fact agreement, 100% boundary/admission agreement, at least 90% exact trust agreement on jointly assessable rows and no unresolved high/low disagreement. Report actual numerator/denominator, all holds, grade prevalence, per-property/conditional agreement, confidence distribution and every disagreement. Use chance-corrected statistics only with adequate nondegenerate counts, otherwise state not informative. Freeze concrete cohort-specific denominators/metrics before labels; small samples never imply population accuracy.

Passing measures repeatability, not measured efficacy. Unsupported high-trust assignments are hard-rule defects even if both lanes agree. No threshold authorizes production.

## 10. Validation and immutable artifacts

Retain version/hash receipt, cohort/reserves, dated source records with capture/access limits, exact identity/INCI hashes, both packet hashes, blind records, final records, lane seals, disagreement/adjudication ledger, method amendments, replay deltas, separate holdout receipt and verification report. Source summaries must identify observation versus researcher interpretation. Retain obtainable raw input facts; do not pretend an abstract is an audited full-text study.

Each sealed lane reads only its explicit standard and packet files, does no web research and cannot see another lane. Source preparation/amendments happen outside lanes. Evidence gaps cause a new/amended packet and re-run, not guesses or covert lookups. Semantic changes update standard, prompt and runbook together before the next batch. Immutable history is never overwritten.

## 11. Activation gate

Nick owns product rulings, pilot review, engine-lock approval and separate catalog/production authorization. Research ends at local reviewed artifacts. After validation, a separately verified pure adapter and intake bridge must preserve nullable holds and strict versioning; no engine writes to Supabase.

Later database work must persist product-level technology/trust/explanations/sources/limits/provenance and expose approved facts through actual chat projections. Existing approved rows retain their prior state while new research is pending; no invented grades or automatic deactivation. Protocol compatibility, images/prices/links, catalog admission, global readiness and guarded publication remain separate. Production integration and rollback are specified in the controlling plan, not authorized by this draft.

## 12. Acceptance checklist

- Charter and property set confirmed: yes, Phase-1 rulings.
- Source hierarchy, uncertainty handling and closed provisional values defined: yes.
- Formula-first and evidence-scope separation specified: yes; not yet exercised.
- Eight-product pilot completed/reviewed: no.
- Neighboring trust anchors calibrated and guides synchronized after findings: no.
- Independent holdout frozen/passed: no.
- Protocol/fit compatibility and deterministic adapter validated: no.
- Product-level persistence and chat integration verified: no.
- Intake activation/publish approved: no.

This is a draft method, not a completed engine.
