# Leave-In Research and Classification Standard v0.1 (working draft)

Status: **pre-calibration working draft — nothing is locked**
Document version: `v0.1-draft`
Engine version: `leave-in-inci-v0.1`
Scope: conventional leave-on hair-conditioning products (spray, mist, milk, lotion, cream, microemulsion, two-phase), Germany/EU
Normative source: this Markdown file
Date: 2026-09-03

**What this document is.** It converts an exact leave-in product and its exact formula into an auditable research record, and it defines the reasoning contract a human or AI researcher must follow. Prose is English; all product-facing copy examples are German (§18).

**What this document is not.** It is not locked, not calibrated, and classifies no product. No score anchor in §7 has yet been tested against a blind reviewer, so every threshold here is a *proposal* awaiting the calibration lane. It does not activate a catalog field, authorize a production write, diagnose a user, or replace a formulation test.

**Authority.** Every scientific claim traces to the leave-on science review (`plans/leave-in-inci/research/leave-on-science-review.md`, cited below as **SR §x**) or to the Leave-In Category Development Handover v1.0 (cited as **HO §x**). Where the two conflict, the handover's own hierarchy applies: new leave-in research and the handover take precedence over conditioner-specific assumptions, and the science review takes precedence over the handover on questions the review actually investigated. Nothing in this standard may introduce science absent from those two documents.

**Inherited structure.** The gate pattern (G0–G7), the evidence scale, the property-evidence object, the shared-mechanism/anti-double-counting discipline, and the identity control are reused from the Conditioner Research and Classification Standard v1.6 (`docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`). Conditioner *score rules and category science do not transfer* (HO §5, SR §N).

**Confirmed rulings encoded here.** Ontology of 13 scored dimensions with SHN/CURL/R3/LAYER demoted and R1 folded into COND (ruling 5); binary production heat protection with no `heat_protection_max_c` (ruling 6); `usage_role` reinstated and `care_direction` retained as a dedicated evidence-backed axis (ruling 7); regulatory re-review trigger 2027-06-06 (implementation default). Deviations from the handover's candidate vocabulary are marked **[divergence]** with their justification.

---

## 1. Purpose and the required reasoning chain

The standard separates four things that a careless reader merges:

1. **formula observations** — what is literally on the INCI list and in the authoritative directions;
2. **direct product properties** — what the complete formula architecture plausibly does at leave-on dose;
3. **finished-product evidence** — what was measured on this exact product;
4. **user fit** — who it is likely to suit.

**Required chain (HO §12, gate G2):** formula observation → direct leave-in product behaviour → user-fit decision. No ingredient may jump directly to "suitable for fine hair", "heat protecting" or "curl friendly".

**Category law (SR §A.2).** Everything downstream of weight, persistence and dose obeys:

```
residue load  ≈  applied dose  ×  non-volatile fraction  ×  (1 − transfer/removal)
```

An INCI list gives an ordinal read on the second term and no read at all on the first or third. That is the single sentence from which most caps in this standard follow.

**Why leave-in cannot reuse rinse-out rules (HO §5, SR §B.1, §N).** Removing the rinse removes *deposition efficiency* as a hidden variable, which raises what COND and WT can support. It introduces *dose* as a new hidden variable, which lowers what PERS, buildup and DOSE can support. The uncertainty moves; it does not shrink.

---

## 2. Category charter and the G0 product-form gate

### 2.1 Working definition (HO §4.1)

A leave-in is a cosmetic hair product intentionally left on the fibre after application, whose primary or co-primary function is conditioning, detangling, smoothing, curl support, heat-styling support or related fibre management. It may be used on damp or dry hair and may be a spray, mist, milk, lotion, cream, microemulsion or two-phase system.

The research unit is the **exact market product, pack and formula version** — never a brand line or marketing name.

### 2.2 Boundary table (HO §4.1)

| Decision | Boundary |
|---|---|
| Include | Water-based or emulsion-based leave-in sprays, mists, milks, lotions and creams |
| Include | Single-phase and two-phase products when conditioning/detangling is primary or co-primary |
| Include | Multi-benefit "10-in-1" products that are fundamentally leave-in conditioners or primers |
| Include | Curl creams when conditioning/definition is central and hold remains secondary |
| Include | Blow-dry primers and heat-protective leave-ins when conditioning is meaningful |
| Exclude | Pure oils and anhydrous silicone serums → route to the oil/serum category |
| Exclude | Styling-first gels, mousses, hairsprays, waxes, clays and strong-hold creams |
| Exclude | Rinse-out conditioners, masks, co-washes and cleansing conditioners |
| Exclude | Scalp serums, growth tonics, medicated and anti-dandruff treatments |
| Exclude | Color-depositing leave-ins and salon chemical-processing treatments |

### 2.3 G0 — product-form gate

**Classify by function + authoritative directions + formula architecture. Never by name (HO §4.2).**

G0 runs before any formula analysis and produces exactly one state:

| G0 state | Condition |
|---|---|
| `in_category` | Aqua (or an aqueous phase) leads or is materially present; directions say the product stays on the hair; conditioning/detangling/smoothing/curl/heat-styling support is primary or co-primary |
| `excluded_anhydrous` | No Aqua, or Aqua absent from the top of the list; cyclomethicone/dimethicone/oils lead → oil/serum category (SR §A.1) |
| `excluded_styling_first` | A fixative-class polymer route with thin or absent conditioning architecture behind it, and directions/positioning lead on durable hold or texture (SR §F.2, HOLD anchor in §7.7) |
| `excluded_other_form` | Rinse-out, mask, co-wash, scalp/medicated, color-depositing, salon chemistry |
| `provisional_boundary` | Genuinely ambiguous: retain as a boundary stress case, complete the record, mark every affected field uncertain |

Three named traps this gate must survive:

- **"Serum" is a marketing word, not an architecture.** A water-based product called a serum may remain in-category once the formula is verified; an anhydrous one leaves regardless of what the label says. The catalog holds ~10 boundary-suspect rows on exactly this point; per ruling 4 they are **flagged in research only** and the live DB categories stay unchanged pending a separate decision.
- **A two-phase spray is in-category** when conditioning is primary, even though it has no emulsifier at all (SR §A.1).
- **A "styling prep" or "mist" positioning does not by itself exclude.** Run the HOLD anchor; `meaningful_hold_route` with thin conditioning is what excludes, not the word.

### 2.4 G1 — identity and formula gate

Classification stops before formula analysis unless these are captured or explicitly recorded as a documented gap:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier (GTIN/EAN) or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI plus a normalized formula fingerprint;
- authoritative application directions (source hierarchy: user package → German/EU manufacturer → exact-GTIN German retailer → other German/EU retailer → secondary discovery);
- G0 product-form status;
- any source/formula conflicts, preserved rather than resolved by preference.

Allowed identity states: `verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` · `excluded_product_form`.

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that affects one property makes **that property** unknown; it blocks the whole analysis only when the dominant architecture cannot be resolved.

**Leave-in-specific addition:** directions are not optional metadata here. `usage_role` (§7.13) is read from directions at E1 and is load-bearing for dose, frequency, damp-vs-dry application and therefore accumulation (SR §K ROLE). Missing directions make `usage_role` `unknown` — they never license an INCI-based guess.

---

## 3. Evidence scale, the E3 metadata requirement, and the evidence firewall

### 3.1 Scale (SR §J, HO §12)

| Level | Meaning | Permitted use |
|---|---|---|
| E0 | Product name, marketing claim, "schützt bis 230 °C", unsupported secondary statement | Record the claim only; never a direct property |
| E1 | Verified exact-formula observation: ingredient present/absent, literal rank; declared directions and dose form | Formula/directions fact only |
| E2 | Architecture or mechanism inference from the complete formula **for leave-on exposure** | Candidate route or direct-property potential, always provisional |
| E3 | The exact product tested instrumentally, **applied as a leave-on**, protocol declared | Endpoint-specific product property |
| E4 | Controlled human-use or blinded trained-sensory evidence on the exact product | Endpoint-specific product/perception evidence |
| E5 | Replicated or consensus finished-product evidence relevant to leave-on use | Strong endpoint-specific conclusion |

INCI-only classification never exceeds E2 (G4). Reviewer agreement measures repeatability of the rules, not truth.

**EU Article 19 limit.** Ingredients above 1 % are in descending order; the sub-1 % tail may appear in any order and the boundary is not visible. Never infer exact percentages, ratios, pH, molecular weight, droplet size, viscosity grade, deposited amount, manufacturing process or active dose from a consumer list. Dimethicone at 5 cSt and at 1,000,000 cSt read identically (SR §C.2).

### 3.2 The leave-on E3 metadata requirement **[leave-in-specific]**

An E3 record that omits any of the following is **downgraded to E2**, because in leave-on use all four change the result (SR §J, §N.8):

1. **dose** — g product per g hair (laboratory convention for leave-on is ~0.2 g/g, roughly double the ~0.1 g/g rinse-off convention; this is a protocol figure, not consumer behaviour);
2. **damp vs dry** application;
3. **drying method** (air-dry, blow-dry, controlled oven, diffuser);
4. **ambient relative humidity** (and temperature, for any humidity or frizz endpoint).

E4 records additionally state substrate, damage state, sample size, comparator and endpoint.

### 3.3 The evidence firewall **[leave-in-specific, gate G8]**

Evidence generated under a **different exposure regime** may enter a leave-in record **only at E2, as mechanism** — never as product evidence, and never as an upgrade path. The regimes covered are:

- rinse-out conditioner and shampoo testing;
- pre-wash / post-wash oil treatments;
- in-salon, high-concentration, short-contact professional application;
- any protocol whose contact ends in a rinse.

The base case is FS-10: a rinse-out ingredient study does not prove leave-on performance. Three consequences worth stating because they are the ones people get wrong:

- **Amodimethicone's rinse-off selectivity argument does not transfer** (SR §C.3, FS-12).
- **Rele & Mohile's coconut-oil result was a pre-/post-wash oil treatment**, so it is E2 mechanism support for a leave-in containing coconut oil and nothing more — and it is specific to coconut oil, since the study's own mineral and sunflower comparators failed (SR §D.2, FS-19).
- **A leave-in carrying a "plex"/"bond" name inherits none of the salon bond evidence** — different concentration, contact time and often professional application (SR §H.2, FS-26).

A brand's claim being legal in the EU means a dossier exists somewhere (Reg. (EU) No 655/2013 common criteria). It does **not** mean an instrumental finished-product test exists, and it never converts an E0 claim into E3 evidence (SR §J).

---

## 4. Property-evidence record

Every direct property, flag and derived fit carries:

- `value`
- `decision_type` — `direct_product_property` | `derived_user_fit` | `flag` | `metadata`
- `confidence`
- `evidence_level` (E0–E5)
- `evidence_scope` — `formula` | `directions` | `product` | `routine`
- `rationale` (one to two sentences, English)
- `formula_observations[]` — exact INCI names with captured list positions, or a precise absence pattern
- `product_inferences[]`
- `supporting_signals[]`
- `counter_signals[]`
- `derived_from[]` — required for every derived user fit and every derived property
- `profile_fact_ids[]`
- `source_ids[]`
- `shared_mechanism_ids[]` (§6)
- `threshold_reasoning[]` — why the evidence clears this value **and** why the nearest lower/higher alternative does not
- `limitations[]`
- `review_status` — `draft` | `approved` | `provisional` | `specialist_review_required`

Formula observations state what is literally present. Product inferences state what might follow. **A derived fit without both `derived_from` and `profile_fact_ids` is invalid.** Generic "formula-derived" or value-restating `threshold_reasoning` is invalid.

---

## 5. Route dictionary (L1–L9)

A route is a *candidate* mechanism visible in the formula. A route is never a performance conclusion and never a user fit.

### L1 — Cationic conditioning route

Evidence: long-chain quats (Behentrimonium Chloride/Methosulfate, Cetrimonium Chloride, Distearyldimonium Chloride), protonatable amidoamines (Stearamidopropyl Dimethylamine + acid), cationic polymers (Polyquaternium-10/-7/-11/-55, Guar Hydroxypropyltrimonium Chloride), silicone quats (Silicone Quaternium-16/-22), cationised proteins.

Permitted E2 statement: "contains a leave-on cationic conditioning route."

Leave-on reading (SR §B.1–B.2): the whole applied dose stays, so deposition efficiency stops being the bottleneck; leave-ins typically run **lower cationic active levels** and shift toward lightweight film-forming cationic polymers. Charge density is the main lever on substantivity **and** on buildup — the same lever, read from two ends. Silicone-quat behaviour is supplier/trade-literature dominated and must be labelled as such.

Do not infer lamellar phase, deposited amount, combing force, sensory richness or user fit.

### L2 — Silicone system route

Split the silicones before reasoning (SR §C.2):

- **Volatile carriers** — Cyclopentasiloxane, Cyclohexasiloxane (both decaying under §15), Disiloxane, Hexamethyldisiloxane, Trisiloxane; and volatile hydrocarbons Isododecane, Isohexadecane. They lower apparent viscosity, aid spreading, and evaporate. **Contribution to residue and to persistence: zero.**
- **Persistent silicones** — Dimethicone, Dimethiconol (usually as a Dimethicone/Dimethiconol blend), Amodimethicone, Bis-Aminopropyl Dimethicone, silicone quats. These are the residue.
- **Easily removed** — PEG-modified silicones (e.g. PEG-x Dimethicone) and other water-dispersible variants.

Permitted E1/E2 statement: "contains a volatile carrier and/or a persistent silicone film route."

**The residue is whatever the volatile was carrying.** "Contains a volatile silicone, therefore leaves no residue" is false (FS-4). Amino silicones and silicone quats are marketed on wash resistance; wash resistance and buildup are the same property (FS-13).

### L3 — Lipid / emollient route, organised by spreading value

The predictive variable is **spreading value**, not "oil vs butter" (SR §D.1). Ordering, **moderately supported**:

| Band | Representative INCI | Leave-on read |
|---|---|---|
| Dry-feel / high spreading | Isododecane, Isohexadecane, C13-15 Alkane, Coco-Caprylate, Isoamyl Laurate, Dicaprylyl Carbonate, Isopropyl Myristate | Slip and spread, low perceived greasiness, low weight penalty; IPM carries a known negative "grating/dry" sensory note |
| Medium | Caprylic/Capric Triglyceride, Squalane, Jojoba (a wax ester), light silicones | The workhorse band for leave-in milks |
| Rich / low spreading | Coconut, Olive, Castor, Avocado oil; Shea/Mango/Cocoa Butter; petrolatum, heavy mineral oil | Occlusion, weight, transfer to skin/pillow — the greasiness risk band |

**Transfer** (to skin, collar, pillow, phone) is predicted mechanistically by low-spreading, non-volatile, non-film-forming lipid load. **No published instrumental transfer method for hair leave-ons surfaced** (SR §D.3, §M.3). It is a qualitative caution attached to WT — never a scored dimension.

Fatty alcohols consumed by the L1 lamellar pair are **not** counted again as hero emollients.

### L4 — Humectant / plasticiser route

Evidence: Glycerin, Propanediol, Butylene/Pentylene Glycol, Sodium PCA, Betaine, Panthenol.

Permitted E2 statement: "contains a humectant/plasticiser route supporting softness at ordinary indoor humidity, and supporting film pliability."

**What this route may never support (SR §E):** anti-frizz or humidity resistance, in either direction. The best-supported anti-frizz mechanism is *reducing* water uptake; a humectant's function is to *increase* water association. For HUM (§7.9) humectant presence is a **counter-signal**. The "~60 °F / 15 °C dew-point" threshold is community folklore with no peer-reviewed source and must never be encoded (FS-16).

Panthenol is treated separately in L6.

### L5 — Fixative / film-forming polymer route

Evidence: PVP; VP/VA Copolymer; VP/Acrylates/Lauryl Methacrylate Copolymer; Polyurethane-14 (and) AMP-Acrylates Copolymer; acrylates copolymers used as fixatives; PVP/DMAPA Acrylates Copolymer.

Permitted E2 statement: "contains a fixative-class film route."

Established chemistry (SR §F.1): PVP is hygroscopic and loses film stiffness as RH rises; VP/VA raises the hydrophobic fraction and improves humidity resistance at some cost in flexibility; crosslinked polyurethane/acrylate hybrids were developed for firm hold with restyleability. **Confidence high that these families differ; confidence low that a particular leave-in delivers a particular hold level**, because polymer level, plasticiser load and the competing conditioning phase are all invisible.

**L5 rheology exclusion (mirrors conditioner R5).** Carbomer, Xanthan Gum, Hydroxyethylcellulose, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, gums and starches that plausibly serve bottle viscosity are **not** a hold route by themselves (SR §F.2 boundary caution, FS-25).

**Anionic/cationic pairing check.** A high-charge polyquaternium and a carboxylated acrylate fixative both high in the same INCI is unusual; formulators normally pair cationic conditioning with nonionic or amphoteric film formers. Treat it as a **read/identity check**, not a performance conclusion (SR §B.3).

### L6 — Substantive protein / silane film route

Evidence: cationised proteins (Hydroxypropyltrimonium Hydrolyzed Wheat/Rice/Keratin Protein), silane derivatives (Hydrolyzed Wheat Protein PG-Propyl Silanetriol), peptides, silicone quats, high-charge cationic polymers — in a plausible film-forming context.

Permitted E2 statement: "contains a possible substantive surface-film route."

Limits (SR §H.1): moderately supported for film/feel/body effects; **not supported** for structural repair. The area is supplier-dominated and molecular-weight figures come from datasheets, not independent measurement. Generic gums, starches and rheology polymers are excluded.

**Panthenol is a fibre-mechanics signal, not a surface-film signal and not a heat signal.** Marsh et al. 2026 report imaging evidence of penetration into cortical protein regions and higher break stress versus control — with the caveats that it is a single industry-affiliated research group, model-system mechanics, and not a leave-in finished-product result. That justifies "low-confidence mechanistic support for fibre mechanics" and nothing above it (SR §H.1, FS-24).

### L7 — Bond-claim review route

Evidence: an exact product claim plus a named or explicitly described chemistry (e.g. Bis-Aminopropyl Diglycol Dimaleate) plus product-level substantiation.

A recognised chemistry opens a **`bond_claim_review` flag** and never sets a repair level (SR §H.2). Independent spectroscopy found **none** of the investigated α,β-unsaturated Michael-acceptor repairing agents increased disulfide content in the hair cortex; most supportive published work is manufacturer-funded. "K18"/"Plex"/"Bond" naming is E0. Salon-regime evidence is barred by G8.

### L8 — Fragrance, alcohol and scalp/skin exposure route

`Parfum`, `Fragrance`, `Aroma`, the 26 EU-labelled fragrance allergens and clearly aromatic essential oils are **exposure signals**. `Alcohol Denat.` / `Alcohol` materially present is recorded as an additional exposure note.

Leave-on raises this above its rinse-out relevance: contact is all-day fibre, skin, neck and sometimes scalp (SR §K EXPO).

Allowed values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`.

**"No listed fragrance signal" is not fragrance-free, not allergy-safe and not hypoallergenic** — labelling thresholds and incomplete formulas prevent those claims, and the EU technical document to Reg. 655/2013 addresses "free from" and "hypoallergenic" specifically. Flags are exposure statements; they never predict tolerance (SR §M.12).

### L9 — Evidenced heat-protection polymer route (closed list)

The **only** members are the polymers with published protection data (SR §G.1):

- **Zhou et al. 2011:** VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-55 · the polyelectrolyte complex of PVM/MA Copolymer with Polyquaternium-28
- **McMullen & Jachowicz 1998:** PVP/DMAPA Acrylates Copolymer · Quaternium-70 · hydrolyzed wheat protein (one specific protein at a defined concentration in a model system)

The list is **closed**. Adding a member requires new peer-reviewed evidence and a standard-version bump. Generic silicone, generic protein, panthenol and oils are **not** on it (§13).

---

## 6. Shared mechanisms and anti-double-counting (G3)

Anti-double-counting is harder in leave-on than in rinse-out: in rinse-out, M1 feeds conditioning, slip and weight; in leave-on it feeds conditioning, slip, smoothing, shine, weight **and** persistence (SR §N.6). The §7 merges exist mainly to keep G3 enforceable.

| ID | Mechanism | Fed by | Feeds |
|---|---|---|---|
| `M1_DEPOSITION_SURFACE_LUBRICATION` | Lubricating deposit on the fibre | L1, L2 persistent, L3 | COND, SLIP, SFR, WT, PERS |
| `M2_SUBSTANTIVE_FILM_SUPPORT` | Charge-substantive protein/polymer film | L6 | R2, PERS, care_direction |
| `M3_OPTICAL_ALIGNMENT_FILM` | Shine as the optical consequence of alignment | M1, M2 | SHN qualifier only |
| `M4_CLAIM_ONLY_PROPRIETARY` | A claim with no product-specific substantiation | L7, marketing | R3 flag, HEAT/HUM `claim_only` |
| `M5_FIXATIVE_FILM` | Fixative film welding fibre-to-fibre contacts | L5, L9 | HOLD, CURL derivation, HEAT when an L9 member |
| `M6_VOLATILE_CARRIER` | Spreading and dry-down, then evaporation | L2 volatile, L3 dry-feel volatiles | FORM, SLIP bias; **contributes nothing to WT or PERS** |
| `M7_HUMECTANT_PLASTICISER` | Water association, film pliability | L4 | COND softness component; **counter-signal for HUM** |

**Rules.**

1. Several ingredients may raise confidence in **one** mechanism. They do not create several independent technologies. A "10-in-1" label is not ten mechanisms (FS-11).
2. One mechanism must not independently score conditioning, slip, smoothing, shine, weight and persistence as if each were separate evidence.
3. A direct property may reach its top value at E2 only when **multiple independent, endpoint-relevant** formula observations support the route and no material counter-signal exists.
4. **The persistence/buildup rule.** PERS and the buildup caution are the *same* evidence read from two ends. Scoring PERS high while presenting buildup as low is a G3 violation in the most damaging direction (SR §C.3, §K WASH, FS-13).
5. **The shine rule.** SHN may not carry an independent value that merely restates the M3 consequence of the M1/M2 film (SR §K SHN).
6. The rationale must say "potential" and preserve the cap.

---

## 7. The 13 scored dimensions

Formula-only values describe **potential**, not measured performance. The `Ceiling` column is the formula-only confidence ceiling adopted from SR §K.

Summary table:

| # | Code | Field | Values | Formula-only ceiling |
|---|---|---|---|---|
| 1 | FORM | `product_form_architecture` | 4 in-category architectures + 1 exclusion | **High** (architecture); **low** as a weight proxy |
| 2 | COND | `conditioning_potential` | low / moderate / high / unknown | Moderately high |
| 3 | SLIP | `slip_combability_potential` (+ bias) | low / moderate / high / unknown | Moderate |
| 4 | SFR | `ambient_smoothing_alignment_potential` | low / moderate / high / unknown | Moderate |
| 5 | WT | `weight_residue_potential` | low / moderate / high / unknown | Moderate; moderately high only under §7.5 |
| 6 | PERS | `persistence_removal_class` | 4 ordinal mechanism classes / unknown | **Low–moderate** |
| 7 | HOLD | `hold_route_state` | none / incidental_film / meaningful_hold_route | Moderate for the coarse state only |
| 8 | HEAT | `heat_protection_evidence_state` | not_claimed / claim_only / formula_plausible / product_tested | **Low** |
| 9 | HUM | `humidity_resistance_evidence_state` | not_claimed / claim_only / formula_plausible / product_tested | **Low** |
| 10 | R2 | `repair_surface_film` | none_visible / candidate / tested / unknown | Low–moderate |
| 11 | DOSE | `dose_sensitivity` (derived) | low / moderate / high / unknown | Moderate |
| 12 | EXPO | `fragrance_scalp_exposure` | L8 values | Moderate for flags |
| 13 | ROLE | `usage_role[]` | 5 roles, multi-valued | Moderately high (**E1 from directions**) |

### 7.1 FORM — product form and architecture

**Definition.** The colloidal architecture of the product, read from the INCI list. Leave-ons are not a viscosity continuum; they are four distinct in-category systems plus one out-of-category one (SR §A.1).

**Values and anchors.**

| Value | INCI-visible anchor |
|---|---|
| `aqueous_or_hydroalcoholic_solution` | Water + glycol/alcohol early; cationic polymer and/or short-chain quat; **no long-chain fatty alcohol**; no emulsifier, or only solubiliser-type (PEG-40 Hydrogenated Castor Oil, Polysorbate-20, PPG-x-Buteth-x) |
| `emulsion` | A cationic-surfactant + fatty-alcohol **lamellar gel network (LGN) pair**: Behentrimonium/Cetrimonium/Distearyldimonium Chloride or Stearamidopropyl Dimethylamine **plus** Cetearyl/Cetyl/Stearyl Alcohol; often Glyceryl Stearate, Carbomer, Xanthan |
| `microemulsion` | Clear product carrying a real oil/silicone load; several PEG-esters/solubilisers plus glycols high in the list; **no LGN pair** |
| `two_phase` | Water phase plus an oil/silicone phase with **no emulsifier at all**; directions say "vor Gebrauch gut schütteln" |
| `anhydrous_serum_or_oil` | No Aqua, or Aqua absent from the top → **out of category** (G0) |
| `unknown` | Formula incomplete or the emulsifier/LGN pattern unresolvable |

**Ceiling.** High confidence that these classes are real and INCI-separable. **Moderate** on a specific borderline product; the thin-lotion-vs-thick-milk boundary is rheological, not compositional, and **carries no decision weight** — which is why the marketing form word is metadata, not a scored value **[divergence from HO §11's `spray | milk | lotion | cream | two_phase`; the presentation word is preserved as `presentation_form` metadata]**.

**Gates.** G9 — FORM may never set WT. **Confidence high as an architecture label, low as a weight proxy** (SR §K FORM).

**False signals.** FS-1, FS-2, FS-17, FS-18 (§12): water-first ≠ light; spray ≠ light and cream ≠ heavy; clear ≠ light (a microemulsion is transparent by droplet size, not by low oil load, and can out-deposit an opaque milk); no-emulsifier ≠ no lipid load (a two-phase spray carries an oil phase by design).

### 7.2 COND — conditioning potential

**Definition.** Overall leave-on lubrication and substantive conditioning delivered by the complete architecture. **R1 "repair lubrication" is folded in here (ruling 5):** friction reduction and grooming-breakage prevention are the *same* M1 mechanism; "reduces grooming breakage" is an explanation frame derived from COND, not a separate score (SR §K R1).

**Ceiling: moderately high.** Removing the rinse removes deposition efficiency, the least predictable variable in rinse-out conditioning, so conditioning architecture is *more* formula-readable here than in the rinse-out standard. It stays capped at E2 because concentration is invisible and product form modulates delivery (SR §K COND).

**Anchors.**

| Value | Anchor |
|---|---|
| `high` | An LGN pair present above the tail **plus** at least one further independent lubrication route (persistent silicone, medium/rich-band emollient, or a cationic polymer) |
| `moderate` | One coherent conditioning route: a cationic-polymer film route (PQ-10/-7/-11/-55, Guar HPTC) **or** a persistent silicone/emollient package — without a full LGN pair |
| `low` | Only a short-chain quat, or a water/glycol solution with no persistent non-volatile above the tail |
| `unknown` | Formula or product form unresolved |

**Gates.** G3 (one M1 observation may not also independently maximise SLIP, SFR, WT and PERS); G4.

**False signals.** A hero ingredient in the sub-1 % tail is not an architecture. "Moisture" language without a route (HO §9). Bottle rheology is not conditioning (FS-25).

### 7.3 SLIP — slip and combability potential *(WET + DRY merged, ruling 5)*

**Definition.** One property: expected reduction in combing force, wet and dry, produced by one deposit through one mechanism (M1). Scoring wet and dry as two independent dimensions is precisely the anti-double-counting violation G3 exists to prevent (SR §K WET/DRY).

**Value:** `low` / `moderate` / `high` / `unknown`, plus a **bias qualifier**.

| Value | Anchor |
|---|---|
| `high` | Two or more independent M1 contributors present as architecture (e.g. cationic route + persistent lubricant) |
| `moderate` | One M1 route present as architecture |
| `low` | No persistent lubricant and no cationic species above the tail |

| Bias | Requirement |
|---|---|
| `wet_biased` | A volatile- or water-dominant architecture with no persistent film |
| `dry_biased` | A persistent film (persistent silicone or substantive cationic) with few water-phase slip agents |
| `both` | Both routes materially present |
| `unknown` | Architecture ambiguous — the default |

**Ceiling: moderate**, as a *shared* property.

**Gates.** G3. G4. **Wet-combing evidence never upgrades a dry endpoint and vice versa** — at E3 the separate endpoints are kept in the research trace, because instrumented wet-combing data genuinely does not prove dry combing.

**Open question flagged on this dimension (SR §M.5):** whether wet and dry slip separate meaningfully from formula in leave-on is unresolved. A targeted look at whether volatile-dominant sprays deliver wet slip without dry slip would settle it and de-risk this merge. Until then the merge is provisional and must be re-examined at calibration.

**False signals.** Bottle thickening or perfume as a slip signal (HO §9). Quoting an instrumental combing improvement as a consumer-perceptible benefit — a 2018 study of actual consumer combing frequency and per-hair forces indicates the lab protocol does not map cleanly onto real grooming (FS-22).

### 7.4 SFR — ambient surface smoothing and alignment potential *(narrowed, ruling 5)*

**Definition.** Surface alignment and lubrication smoothing **at ambient conditions**. The word "frizz" is deliberately absent: humidity-driven frizz control is not readable from formula at all and belongs entirely to HUM (§7.9). Leaving "frizz" in this definition would make the dimension silently carry an unsupported humidity claim (SR §K SFR).

**Anchors.**

| Value | Anchor |
|---|---|
| `high` | A continuous surface-film route — persistent silicone (Dimethicone/Dimethiconol/Amodimethicone/silicone quat) or a substantive cationic-polymer film — **plus** a lubrication route |
| `moderate` | One alignment route: a medium/dry-feel emollient package or a single film former |
| `low` | No persistent film; water phase and humectants only |
| `unknown` | Architecture unresolved |

**Ceiling: moderate** — correct *once narrowed*.

**Gates.** G3 (SFR shares M1/M2 with COND and SLIP — the top value needs an endpoint-relevant *additional* observation, not a restatement). G4.

**False signals.** FS-8 (anti-frizz and curl definition are not the same property); FS-6/FS-15 (humectants do not control frizz); "'Moisture' language without a route" (HO §9).

### 7.5 WT — weight and residue potential **(anchor dimension)**

**Definition.** Net tendency to flatten, grease, stiffen or coat. **WT is the anchor dimension of the category** — it is the binding constraint in almost every user job in HO §6, and it is more formula-tractable in leave-on than rinse-out because deposition efficiency is not a hidden variable. The residual uncertainty is dose, not composition (SR §K WT).

**Anchors.**

| Value | Anchor |
|---|---|
| `low` | Aqueous/hydroalcoholic solution; volatile carrier dominant; **no** persistent non-volatile family above the tail; no LGN pair; no rich-band lipid |
| `moderate` | Exactly one persistent non-volatile family present as architecture (a light/medium-band emollient, a light silicone, or a cationic-polymer film); no LGN pair combined with rich-band lipids |
| `high` | An LGN pair present **and/or** two or more persistent non-volatile families with at least one rich/low-spreading band member (coconut/olive/castor/avocado oil, shea/mango/cocoa butter, petrolatum, heavy mineral oil); **or** a two-phase or microemulsion carrying a substantial oil/silicone phase |
| `unknown` | Form or non-volatile architecture unresolved |

**Ceiling: moderate.** It may rise to **moderately high** only when *both* (a) FORM resolves to a definite architecture and (b) the non-volatile architecture is fully readable above the 1 % tail. It never rises on FORM alone.

**Gates.** **G9 — FORM must never set WT.** "Spray ⇒ light" is a hard gate, not a note (SR §A.2, §K FORM). G3. G4.

**Attached qualitative caution — transfer.** When a low-spreading, non-volatile, non-film-forming lipid load is present, attach the transfer caution (skin, collar, pillow, phone). It is qualitative: **no published instrumental transfer method for hair leave-ons surfaced** (SR §D.3). Never a scored dimension.

**False signals.** FS-1, FS-2, FS-3, FS-4, FS-17, FS-18, FS-20 (silicone-free plus a cationic polymer is not low buildup — high-charge-density polyquaterniums are among the most substantive materials in the category).

**Known judgment call.** There is **no evidence establishing a residue load at which fine hair reads as limp** (SR §M.11). Any fine-hair threshold this standard sets is a product judgment call and must be labelled as one in `limitations[]`, not presented as a derived scientific constant.

### 7.6 PERS — persistence and removal class *(PERS + WASH merged, ruling 5)*

**Definition.** An **ordinal mechanism class only**. Wash resistance and buildup are one property viewed from opposite ends, so they are one axis plus one non-quantitative caution — never two scores that can be set in opposite directions (SR §K PERS/WASH).

**Values — ordinal, highest class present as architecture wins; record the others as supporting:**

| Class | Anchor |
|---|---|
| `permanent_cationic` | Silicone Quaternium-16/-22, high-charge-density polyquaterniums, cationised proteins |
| `ph_dependent_cationic` | Amodimethicone, Bis-Aminopropyl Dimethicone, amidoamines |
| `neutral_non_volatile` | Dimethicone, Dimethiconol, esters, oils |
| `volatile_or_water_soluble` | Volatiles and humectants only; or PEG-modified silicones as the only silicone |
| `unknown` | Architecture unresolved |

Film cohesion modifies within a class: a crosslinked or high-MW fixative film resists both water and mild surfactant more than a discontinuous emollient deposit. **Volatiles contribute nothing to persistence.**

**Ceiling: low–moderate** — lowered from the handover's "moderate" on the review's recommendation.

**Hard prohibition (gate G11).** Never emit a duration, a wash count, a "lasts 2 days", a "survives 3 washes", a number of applications to visible buildup, or a clarification frequency. Those depend on dose, frequency, cleanser strength, water hardness and hair porosity — none of which is in the INCI list and two of which are outside the product entirely. **No retrievable finished-product study measures leave-in accumulation over realistic use cycles** (SR §I, §C.4, §M.2).

**Banned numbers.** Circulating figures such as "only 0.3–0.7 % of polymer remains after five applications", "89 % of dimethicone removed in one wash" or "no silicone remains after 8 shampoos" are untraceable to any primary source and at least one misattributes lab data to a body that does not run comparative efficacy tests. **These numbers may not enter any record** (SR §C.4).

**Attached flag — buildup caution.** Emitted from the same evidence, explicitly non-quantitative, and **must not contradict PERS** (G3 rule 4).

**False signals.** FS-12 (amodimethicone selectivity is a rinse-off argument), FS-13 (high persistence + low buildup double-count), FS-20 (silicone-free + cationic polymer ≠ low buildup), FS-3.

### 7.7 HOLD — hold route state *(coarse 3-state, ruling 5)*

**Definition.** Whether a fixative-class route is present, and whether conditioning architecture stands behind it. This is a **styling-boundary signal** first and a performance signal second.

**Values.**

| Value | Anchor |
|---|---|
| `none` | No fixative-class polymer (L5), or only the L5 rheology exclusions |
| `incidental_film` | A fixative-class polymer is present but a substantive conditioning architecture dominates, **or** the polymer plausibly serves bottle rheology |
| `meaningful_hold_route` | A fixative-class polymer in a film-forming context with **thin or absent** conditioning architecture behind it → **route to G0 styling review** |

**Ceiling.** Moderate for the coarse state. **Hold *level* is not readable** — polymer level and plasticiser load are invisible — so no 0–4 grade and no low/moderate/high hold score is permitted (SR §K HOLD). **[divergence from HO §11's `hold_support: none | low | moderate | high`; the lean profile carries the 3-state instead — see §10]**

**Gates.** L5 rheology exclusion. G3 (a hold route and a conditioning route are different mechanisms; do not let one raise the other). G0 when `meaningful_hold_route`.

**Why this matters (SR §F.2).** Two mechanistically different things produce "defined, smooth, controlled" hair: the **conditioning route** (lubrication + surface film → fibres slide, align and lie together) and the **hold route** (a fixative film welds fibre-to-fibre contacts → the shape resists deformation). They feel different — hold adds stiffness, resists restyling and can flake — and they suit different users. A curl cream whose definition comes from VP/VA plus a low conditioning load is a styling product wearing a conditioning label.

**False signals.** FS-9 (hold polymer equals conditioning or repair), FS-25 (bottle rheology read as hair performance).

### 7.8 HEAT — heat-protection evidence state

Full rule in **§13**. Summary here for the dimension table.

**Research-trace values:** `not_claimed` / `claim_only` / `formula_plausible` / `product_tested`.
**Production projection (ruling 6):** binary `provides_heat_protection`. **No `heat_protection_max_c` field exists in this model.**
**Ceiling: low from formula alone** — and made stricter than the handover implies. `formula_plausible` requires a member of the **closed L9 list**. Generic silicone, generic protein, panthenol and oils reach `claim_only` and no further.

### 7.9 HUM — humidity-resistance evidence state

**Definition.** A 4-state **evidence flag**, not a score, mirroring HEAT. Humidity response is *measured*, not inferred (SR §K HUM).

| State | Requirement |
|---|---|
| `not_claimed` | No humidity, anti-frizz or "Anti-Frizz" claim and no qualifying route |
| `claim_only` | A humidity/anti-frizz claim without a qualifying route — **the default for most claiming products** |
| `formula_plausible` | A **hydrophobic, continuous film-forming route** with a plausible water-uptake-reduction mechanism (e.g. VP/VA or a more hydrophobic fixative, or a persistent hydrophobic silicone film) **and** no dominant humectant architecture. E2, **low** confidence |
| `product_tested` | The exact product tested by HHCR or DHCR (high-humidity curl retention at ~26 °C / 90 % RH over 24 h, `% retention = (Le − Lt)/(Le − Li) × 100`; ~70 % retention is the conventional "good" bar), by dynamic vapour sorption (0 % → 90 % RH weight gain), or by humidity-chamber tress imaging — with declared RH, temperature and equilibration time |

**Counter-signal (mandatory).** Humectants materially present (Glycerin, Propanediol, glycols, Sodium PCA, Betaine) **lower** this state and never raise it: the best-supported anti-frizz mechanism is reducing water uptake, while a humectant's function is to increase water association (SR §E.1).

**Gates.** G4. **Never encode a dew-point threshold** (FS-16). HUM also absorbs the humidity half of the old SFR definition — no other dimension may make a humidity statement.

**False signals.** FS-6, FS-8, FS-15, FS-16.

### 7.10 R2 — repair surface film

**Definition.** A substantive protein/polymer/silane surface film. Tightened from the handover.

| Value | Anchor |
|---|---|
| `candidate` | An identifiable **substantive** route (cationised protein, silane derivative, silicone quat, high-charge cationic polymer) in a plausible film context |
| `none_visible` | Generic gums, starches, rheology polymers; a plain hydrolyzed protein sitting in the tail; panthenol |
| `tested` | Exact-product endpoint evidence meeting §3.2 |
| `unknown` | Formula or context unresolved |

**Ceiling: low–moderate** — lowered from the handover's "moderate". The evidence base is supplier-dominated; molecular-weight and substantivity figures come from datasheets, not independent measurement (SR §K R2).

**Gates.** G3 (R2 shares M2 with PERS and with `care_direction`). G4. Never converts into structural repair, penetration, strength or a diagnosed "protein need".

**Panthenol rule.** Panthenol is a fibre-mechanics signal (L6), **not** an R2 route and **not** a heat route (FS-24).

**False signals.** FS-5 (botanical oil or butter means deep repair), FS-19 (coconut oil penetrates therefore botanical oils repair), FS-24.

### 7.11 DOSE — dose sensitivity **(derived; store-vs-derive decision recorded)**

**Definition.** The risk that a small change in applied amount materially changes the finish. This is the property that most distinguishes leave-on from rinse-out and it has a clean mechanistic basis: without a rinse to normalise application, finish moves directly with dose, and the sensitivity scales with non-volatile fraction and low-spreading lipid load (SR §B.1, §K DOSE).

**Store-vs-derive decision (required by SR §K DOSE, decided here):** DOSE is **derived and stored**, never independently assessed, and **is not projected into the lean matching profile**. Letting it be assessed separately would make it a fourth restatement of the same M1/WT observation and would violate G3. It is stored because the derived value drives a user-facing dosing caution.

**Derivation.** `derived_from = [WT, FORM, L3 spreading class]`:

| Value | Rule |
|---|---|
| `high` | WT = `high`; **or** FORM = `two_phase`; **or** a rich/low-spreading lipid band is materially present |
| `moderate` | WT = `moderate`; **or** FORM = `microemulsion` (visually light, real non-volatile load) |
| `low` | WT = `low` **and** FORM = `aqueous_or_hydroalcoholic_solution` with a volatile-dominant carrier |
| `unknown` | WT `unknown` or FORM `unknown` |

**Ceiling: moderate.**

**Gates.** G3 — because DOSE is derived from WT, it may **not** additionally modify `hair_thickness_fit`; it emits a German dosing caution string instead (§18).

**Known gap.** **No published, market-representative consumer dose figures exist for leave-in sprays, milks or creams** — only laboratory protocol conventions and patent ranges (SR §A.2, §M.1). Two-phase products are the least dose-predictable form because shake quality changes the delivered oil:water ratio per actuation, and that variability is unmeasured (SR §M.9).

### 7.12 EXPO — fragrance and scalp/skin exposure

**Definition.** Exposure statements, per route L8. Values: `fragrance_declared` · `aromatic_or_allergen_exposure` · `no_listed_fragrance_signal` · `unknown`, plus `notes[]` for materially present `Alcohol Denat.` / `Alcohol`.

**Ceiling: moderate for flags.**

**Gates.** **G6 (medical), reused verbatim from the conditioner standard.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Discomfort, rash, dermatitis, infection, hair loss and disease require abstention and professional evaluation. Cosmetic guidance stays separated from medically adjacent scalp or hair-loss guidance.

**Hard prohibition.** Flags remain exposure statements. **Sensitive-scalp tolerance is not derivable from an INCI list** (SR §M.12). "No listed fragrance signal" is not fragrance-free and not hypoallergenic.

**Root/scalp suitability** requires application directions and exposure context, never an ingredient read.

### 7.13 ROLE — usage role *(reinstated for leave-in, ruling 7)*

**Definition.** How the product is actually used, read from the product's **own authoritative directions at E1**: `post_wash` · `refresh` · `heat_styling` · `curl_styling` · `ends_only`. Multi-valued.

**Ceiling: moderately high** — and it earns that ceiling *precisely because it is an E1 directions read, not an INCI inference*. If directions are unavailable, the value is `unknown`; it is never guessed from the formula.

**Why this diverges from the conditioner standard (SR §K ROLE, §N.3).** Conditioner v1.6 deliberately dropped `usage_role` because "regular" vs "frequent" mostly reproduced directions wording. That reasoning does not transfer: for leave-ons, post-wash vs refresh vs heat-styling vs curl-styling vs ends-only changes dose, frequency, damp-vs-dry application and therefore accumulation. **This divergence is a decision, not an oversight**, and is stated here so it reads that way.

**Gates.** G2 — ROLE is an input to fit derivation, never a substitute for one. A `refresh` role plus a high PERS class raises the buildup caution; it does not raise or lower any score.

**False signal.** FS-11 — a "10-in-1" or "7-in-1" name is not a list of usage roles and not a list of mechanisms; read the directions.

---

## 8. Demoted flags and derived values (ruling 5)

These carry information but **never a score**.

### 8.1 SHN — shine, as a qualifier on the smoothing route

From formula, shine is almost entirely the optical consequence (M3) of the same alignment/deposition mechanism that drives SFR; scoring it separately double-counts. Worse, measured gloss depends on hair colour, baseline condition, and even incident-light direction and polarisation — a large share of the outcome is a **user** variable, not a product variable (SR §K SHN).

**Emit** `smoothing_shine_qualifier: present | absent` **as a qualifier on SFR only.** An independent shine value is permitted only with (a) a distinct gloss route not already counted in M1/M2, or (b) exact-product goniophotometry (fixed geometry, Reich–Robbins luster `L = S/D × Θ½`, or polarisation-imaging luster).

**False signals.** FS-23 — goniophotometric luster depends on incident-light direction and polarisation as well as on the hair, so two labs' shine figures are not comparable. "Shiny product appearance" is not shine (HO §9).

### 8.2 CURL — curl/wave definition, as a derived focus

There is **no formula → curl-definition mapping in the literature**, and a large part of the outcome is the user's curl pattern and application technique (scrunching, plopping, diffusing), which no formula encodes (SR §K CURL, §M.6).

**Derive** `curl_definition_focus` from `HOLD + COND + WT`, with curl positioning as **corroboration only, never as a route**. Confidence from formula alone: **low**. Never give it an independent score implying the formula determines definition.

**False signals.** FS-8 (anti-frizz and curl definition are the same property); FS-9 (a hold polymer equals conditioning or repair); and the HO §9 route-dictionary false signal for this outcome — "conditioning alone or heavy oil alone" is not a definition route.

### 8.3 R3 — bond-specific support, as a flag

**Values:** `claim_only` / `chemistry_candidate` / `product_tested` / `unknown`. A `chemistry_candidate` opens a **review flag** (L7) and **never sets a repair level** from formula alone. Ceiling: **flag only**.

Two independent problems justify the demotion (SR §K R3): independent spectroscopy found no increase in cortical disulfide content after treatment with α,β-unsaturated Michael-acceptor repairing agents, and most supportive work is manufacturer-funded; and even granting the chemistry, bond systems were characterised at salon concentrations and contact times, so a leave-in at consumer dose inherits none of that evidence (G8).

### 8.4 LAYER — layering risk, as a caution string only

Cationic/anionic complexation across layered products is plausible colloid chemistry and near-universal formulator belief, but **no peer-reviewed measurement of pilling or flaking as a function of layering in consumer routines exists** (SR §B.3, §K LAYER, §M.4).

**Emit at most one German caution string** (§18). **Never** compute a compatibility matrix, a numeric layering-risk score, or a product-to-product incompatibility verdict. That would be exactly the "unsupported precision" failure.

### 8.5 Buildup caution

Non-quantitative, emitted from the PERS evidence, and bound by G3 rule 4 and G11. It states a mechanism-level tendency and a routine-level consideration; it never states a count, a duration or a clarification schedule.

---

## 9. `care_direction` — protein / moisture / balanced (ruling 7)

**Status.** Retained as a dedicated, evidence-backed axis by Nick's confirmed ruling 7. **The science review recommended against reusing it** (SR §N.2: it is a conditioner-specific comparison vocabulary and the discriminating axes in leave-on are weight, persistence and hold). The ruling overrides the recommendation; the review's substantive concern is answered by the two constraints below rather than by dropping the field.

**Definition.** The formula's comparative care *emphasis*. It is **not** a diagnosis of a user's protein or moisture state and never implies a deficiency.

**Values and anchors (E2, ceiling moderate):**

| Value | Anchor |
|---|---|
| `protein` | An identifiable **substantive** protein/peptide/silane film route (L6 / R2 = `candidate` or `tested`) that is materially present, i.e. more than a tail entry, and more than ordinary conditioning |
| `moisture` | A coherent conditioning + humectant + emollient architecture (L1/L3/L4) is the material direction, with **no** dominant protein-film route |
| `balanced` | A **substantive mixed** protein-plus-moisture architecture. It is **not** an uncertainty bucket and not a label for an otherwise neutral product |
| `unknown` | Neither direction is materially readable **[divergence: the conditioner vocabulary has no `unknown`; adding it here keeps the standard conservative under mixed evidence instead of forcing a guess. Adapter consequence is a Phase-5 decision]** |

**Two mandatory constraints (answering SR §N.2):**

1. **`care_direction` may not drive weight, persistence, hold, or heat matching.** WT, PERS and HOLD are the discriminating axes of this category; `care_direction` is a comparison and explanation axis only.
2. **Panthenol alone never sets `protein`** — it is a fibre-mechanics signal, not a surface-film route (§7.10, FS-24). Neither does a humectant name alone set `moisture`; a name is not a route.

**Gates.** G3 — `care_direction` shares M2 with R2 and PERS; it may not be presented as independent corroboration of either. G4 — formula-only calls stay E2.

---

## 10. The lean matching profile

Keep the detailed ontology in the research trace. The production model exposes only what recommendation and explanation need (HO §11, charter §G).

```jsonc
{
  "model_version": "leave-in-matching-v0.1",
  "category_standard_version": "leave-in-inci-v0.1",
  "research_record_id": "<uuid>",

  "product_form": "aqueous_solution | emulsion | microemulsion | two_phase",
  "conditioning_level": "low | moderate | high",
  "weight_potential": "low | moderate | high",
  "persistence": "low | moderate | high",
  "hold_support": "none | incidental | meaningful",
  "care_direction": "protein | moisture | balanced | unknown",

  "focus": {
    "primary": "detangling | smoothing | curl_definition | heat_styling | repair | shine | volume_lightness | general",
    "secondary": ["<= 2 distinct values from the primary vocabulary, excluding general>"]
  },

  "usage_role": ["post_wash | refresh | heat_styling | curl_styling | ends_only"],

  "specialist_functions": {
    "provides_heat_protection": true,
    "humidity_resistance": "not_claimed | claim_only | formula_plausible | product_tested"
  },

  "hair_thickness_fit": {
    "fine":   "recommended | conditional | neutral | caution | unknown",
    "medium": "recommended | conditional | neutral | caution | unknown",
    "coarse": "recommended | conditional | neutral | caution | unknown"
  },
  "damage_fit": {
    "healthy":            "recommended | conditional | caution | unknown",
    "moderately_damaged": "recommended | conditional | caution | unknown",
    "highly_damaged":     "recommended | conditional | caution | unknown"
  },
  "texture_fit": {
    "straight": "recommended | conditional | caution | unknown",
    "wavy":     "recommended | conditional | caution | unknown",
    "curly":    "recommended | conditional | caution | unknown",
    "coily":    "recommended | conditional | caution | unknown"
  },
  "scalp_application_fit": "avoid | conditional | suitable_if_evidenced | unknown",

  "cautions": ["<German user-facing strings, §18>"],
  "uncertain_fields": [],
  "assumption_notes": []
}
```

Every field carries its own property-evidence object (§4). The research envelope wrapping this profile is `leave-in-research-envelope-v0.1` (five-part conditioner shape: `version, researchMethod, identity, formula, profile`; fail-closed validation), promoted to `leave-in-research-envelope-v1.0` when the standard locks.

**Fields deliberately absent.**

- **`heat_protection_max_c`** — removed (ruling 6, §13).
- **`dose_sensitivity`** — derived and stored in the trace, surfaced as a caution string, not a matching field (§7.11).
- **`climate_fit` / `layering_compatibility`** as confident labels — kept as specialist evidence states or `unknown` (HO §11 recommended simplification).
- **A separate fit label per marketing claim** — one primary focus, up to two secondary, plus specialist evidence states.

### 10.1 Projection rules

- `product_form` ← FORM architecture class. The marketing form word (Spray, Milk, Lotion, Cream, Mist) stays in `presentation_form` metadata **[divergence, §7.1]**.
- `conditioning_level` ← COND (low→low, moderate→moderate, high→high).
- `weight_potential` ← WT. When a formula-only `high` is conflict-tagged, the exact-product intended finish materially contradicts it, and no finished-product evidence resolves the conflict, project `moderate`, mark the field uncertain, and preserve the higher trace result. Do not encode unresolved uncertainty as a restrictive `high` that silently removes fine hair from the fit prior.
- `persistence` ← PERS **mechanism class**, projected ordinally: `volatile_or_water_soluble` → `low`; `neutral_non_volatile` → `moderate`; `ph_dependent_cationic` → `moderate`; `permanent_cationic` → `high`. **This is a mechanism ordering, not a duration** (G11). The buildup caution travels with a `high` value.
- `hold_support` ← HOLD 3-state, unchanged **[divergence, §7.7]**.
- `care_direction` ← §9.
- `usage_role` ← ROLE, E1 from directions; `[]` with `usage_role` listed in `uncertain_fields` when directions are unavailable.
- `provides_heat_protection` ← §13 binary rule.
- `humidity_resistance` ← HUM 4-state, unchanged.

### 10.2 Focus hierarchy and route anchors

1. **Exclude baseline conditioning from the hierarchy.** An ordinary conditioning architecture supports conditioning and slip; it does not automatically make `detangling` the distinctive purpose.
2. **Group evidence by shared mechanism (§6) before comparing endpoints.**
3. **Evaluate special-purpose routes first**, then fall back.
4. **Official positioning may corroborate but never creates a route.** Current catalog values never break a tie.
5. **Mark `primary_focus` uncertain** when two plausible purposes remain unresolved; use `general` when nothing clears its threshold.

| Focus | Route anchor |
|---|---|
| `volume_lightness` | WT `low` **and** no persistent film route. **Never from FORM alone** (G9, FS-2) |
| `detangling` | SLIP `high` with a `wet_biased` or `both` bias, and no richer special-purpose route wins |
| `smoothing` | SFR `high` — a continuous alignment/film route beyond baseline conditioning **[divergence: HO §11's `smoothing_frizz` is renamed `smoothing`; a label naming frizz would smuggle the unsupported humidity claim that §7.4 exists to prevent]** |
| `curl_definition` | HOLD ∈ {`incidental_film`, `meaningful_hold_route`} **plus** compatible COND/WT (§8.2). Curl positioning corroborates only. Never from conditioning alone or heavy oil alone |
| `heat_styling` | HEAT ≥ `claim_only` **and** ROLE includes `heat_styling`. Sets a *use context*, never a protection level (§13) |
| `repair` | R2 ∈ {`candidate`, `tested`} **or** R3 = `chemistry_candidate` with its review flag open. Generic silicone, oil, panthenol, ceramide, cationic polymer or generic repair naming cannot set it |
| `shine` | A distinct gloss route or exact-product goniophotometry. **Not added when it merely restates the smoothing film** (§8.1, G3) |
| `general` | A capable conventional leave-in where no route clears its threshold |

A secondary focus may add a distinct user endpoint even when it shares part of a mechanism, but it must add useful matching information.

### 10.3 Fit priors

These are **broad product priors**, not universal exclusions and not efficacy claims. Final recommendations still combine product behaviour with the user's damage, thickness, texture, routine, dosage, desired finish and scalp context.

**`hair_thickness_fit` — weight-led** (`derived_from: [weight_potential, product_form]`):

| `weight_potential` | fine | medium | coarse |
|---|---|---|---|
| `low` | recommended | recommended | conditional |
| `moderate` | conditional | recommended | recommended |
| `high` | caution | conditional | recommended |

DOSE does **not** additionally modify this table (G3, §7.11); a `high` DOSE emits a dosing caution instead. Every fine-hair value carries the §7.5 judgment-call limitation.

**`damage_fit` — conditioning-led, with a specialist-route upgrade** (`derived_from: [conditioning_level, repair_surface_film, bond_flag, product_evidence]`):

| Condition | healthy | moderately_damaged | highly_damaged |
|---|---|---|---|
| `conditioning_level = low` | recommended | conditional | caution |
| `moderate`, or `high` with no qualifying specialist route | recommended | recommended | conditional |
| `high` **with** a distinct L6 substantive film route, a named bond chemistry with an open review flag, or a relevant exact-product test | conditional | recommended | recommended |

Generic silicone, oil, panthenol, ceramide, cationic polymer or repair naming alone does **not** qualify for the third row.

**`texture_fit` — weight + slip + hold** (`derived_from: [weight_potential, slip_combability_potential, hold_route_state]`):

| Architecture | straight | wavy | curly | coily |
|---|---|---|---|---|
| Low weight, light dry-down | recommended | recommended | conditional | caution |
| Moderate weight, balanced | recommended | recommended | recommended | conditional |
| High weight **and** high slip | conditional | recommended | recommended | recommended |

`HOLD = meaningful_hold_route` does not by itself raise curly/coily — it first triggers the G0 styling review. Curl branding alone never determines the result.

**`scalp_application_fit`** — derived from **directions plus EXPO**, never from an ingredient read. Default `unknown` when directions are silent about placement. G6 applies.

### 10.4 Boundary with the live catalog

Current live leave-in spec values (`format`, `provides_heat_protection`, `heat_protection_max_c`, roles, ingredient flags) are **legacy heuristics, not research-engine output**. They are comparison-only historical data: they cannot determine a new classification and never break a tie.

Two known reconciliation items are **parked as Phase-5 adapter decisions**, not resolved here:

- The DB `format` enum has no `two_phase` and carries `serum`, which this standard treats as a boundary decision rather than a form.
- Removing `heat_protection_max_c` touches live code (`src/lib/recommendation-engine/selection.ts` ≥ 220 °C heat-fit bonus and its German copy) and personal-plan catalog facts. That is a scoped migration surfaced to Nick before execution — **not** authorized by this document.

---

## 11. Gates

| Gate | Rule |
|---|---|
| **G0** | **Boundary / product form.** Classify by function + directions + architecture, never by name. Anhydrous → oil/serum; fixative route with thin conditioning → styling; ambiguous → `provisional_boundary` stress case. Excluded products do not classify (§2.3) |
| **G1** | **Identity and formula.** Capture the §2.4 set, follow the canonical source hierarchy, preserve conflicts, and complete a provisional profile from the best available exact-market evidence |
| **G2** | **Evidence firewall (chain).** Formula observation → direct product property → user-fit decision. No shortcuts, no naked suitability labels |
| **G3** | **Anti-double-counting.** One shared mechanism counts once unless endpoint-specific evidence separates it. Includes the persistence/buildup rule and the shine rule (§6) |
| **G4** | **Evidence cap.** Formula-only ≤ E2; claim-only E0. No exact concentration, pH, MW, droplet size, viscosity grade or deposited amount from an INCI list |
| **G5** | **Conflict.** Preserve source conflicts and lower the **smallest** affected scope; do not blank the record |
| **G6** | **Medical.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Cosmetic guidance stays separate from medically adjacent scalp/hair-loss guidance |
| **G7** | **Review freshness.** Per-field unsalted SHA-256 fingerprints over the canonical field evidence/value payload, plus a versioned whole-profile fingerprint binding the lean profile and `category_standard_version`. Equality preserves approval; changed content reopens the field |
| **G8** | **Exposure-regime firewall [leave-in-specific].** Rinse-out, shampoo, pre-wash-oil and in-salon evidence enters **only at E2, as mechanism** — never as product evidence and never as an upgrade path (§3.3) |
| **G9** | **Form is not weight [leave-in-specific].** FORM may never set WT. "Spray ⇒ light", "cream ⇒ heavy", "clear ⇒ light" and "no emulsifier ⇒ no lipid load" are hard failures, not notes (§7.1, §7.5) |
| **G10** | **Heat strictness [leave-in-specific].** `formula_plausible` requires a member of the closed L9 list. Generic silicone/protein/panthenol/oil stops at `claim_only`. Never grade efficacy; never use a °C figure as a protection level (§13) |
| **G11** | **No quantitative persistence [leave-in-specific].** No durations, wash counts, applications-to-buildup, clarification schedules, or the circulating untraceable removal percentages (§7.6) |
| **G12** | **Regulatory durability [leave-in-specific].** Rules key on **function** ("a volatile carrier is present") with the INCI family enumerated — never on the presence of a specific cyclosiloxane (§15, FS-21) |

---

## 12. False-signal register

The handover's eleven (FS-1 to FS-11, HO §8) plus the science review's sixteen (FS-12 to FS-27, SR §L). All twenty-seven are normative: producing one is a rule violation, not a stylistic lapse.

**From the handover (HO §8):**

| ID | False signal |
|---|---|
| FS-1 | Water is first, therefore the product is lightweight |
| FS-2 | Spray means lightweight; cream means heavy |
| FS-3 | Silicone-free means no buildup or low weight |
| FS-4 | A volatile silicone means the complete formula leaves no residue |
| FS-5 | Botanical oil or butter means deep repair |
| FS-6 | Glycerin automatically improves frizz in every climate |
| FS-7 | Any silicone, protein or panthenol proves heat protection |
| FS-8 | Anti-frizz and curl definition are the same property |
| FS-9 | A hold polymer equals conditioning or repair |
| FS-10 | A rinse-out ingredient study proves leave-on performance |
| FS-11 | A "10-in-1" label represents ten independent mechanisms |

**From the science review (SR §L), in source order:**

| ID | False signal |
|---|---|
| FS-12 | "Amodimethicone deposits selectively on damaged sites, so it cannot build up." A rinse-off argument that over-reads the deposition data even there: streaming-potential work shows deposition continues *after* surface-charge reversal, i.e. it does not self-limit. In a leave-on there is no rinse to remove the non-selective fraction |
| FS-13 | Scoring persistence high and buildup risk low from the same wash-resistance evidence — they are one property viewed from two ends |
| FS-14 | Reading `heat_protection_max_c` ("bis 230 °C") as a protection *strength*. It is a use-condition statement; published effect sizes are modest (10–20 % damage reduction in the classic study, ~50 % the commonly cited ceiling) and are not expressed in °C |
| FS-15 | "Humectants control frizz." Not merely climate-dependent — mechanistically the wrong direction. The best-supported anti-frizz route is *reducing* water uptake; humectants are a softness/plasticiser route and, for a humidity claim, a counter-signal |
| FS-16 | Treating the ~60 °F / 15 °C dew-point humectant threshold as science. Ubiquitous in curly-hair education, absent from the peer-reviewed literature. Do not encode the number |
| FS-17 | "Clear product = light product." Microemulsions are transparent by droplet size, not by low oil load; a clear silicone microemulsion spray can out-deposit an opaque milk |
| FS-18 | "No emulsifier / no fatty alcohol = no meaningful lipid load." Two-phase sprays carry an oil or silicone phase with zero emulsifier by design |
| FS-19 | "Coconut oil penetrates, therefore botanical oils repair." Rele & Mohile's own mineral and sunflower comparators failed; the result is specific to coconut oil, and the protocol was a pre-/post-wash oil treatment, not a leave-in at consumer dose |
| FS-20 | "Silicone-free plus a cationic polymer = low buildup." High-charge-density polyquaterniums are among the most substantive materials in the category |
| FS-21 | Treating "Cyclopentasiloxane present" as a durable classification rule. Under Regulation (EU) 2024/1328 it is a decaying signal in EU leave-ons (0.1 % limit from 6 June 2027). Key rules on *function* — "volatile carrier present" — with the INCI family enumerated (G12) |
| FS-22 | Quoting an instrumental combing improvement as a consumer-perceptible benefit. A 2018 study of actual consumer combing frequency and per-hair forces indicates the lab protocol does not map cleanly onto real grooming |
| FS-23 | Cross-lab comparison of gloss numbers — goniophotometric luster depends on incident-light direction and polarisation as well as on the hair |
| FS-24 | "Panthenol strengthens hair, therefore it protects from heat." The 2026 mechanistic work is about fibre mechanics and protein interaction, not thermal protection |
| FS-25 | Bottle rheology read as hair performance (Carbomer, Xanthan Gum, Hydroxyethylcellulose, Acrylates/C10-30 Alkyl Acrylate Crosspolymer). A thick leave-in cream tempts this far more than a rinse-out one |
| FS-26 | A leave-in "plex/bond" product inheriting salon bond evidence — different concentration, contact time and often professional application; an exposure-regime mismatch on the same footing as the rinse-out/leave-on mismatch |
| FS-27 | Inferring pH, "pH-balanced", or acid-sealing behaviour from an INCI list. Not readable at all |

> **Overlap note.** FS-6 (handover) and FS-15 (science review) both concern humectants and frizz, and both are kept: FS-6 forbids the *climate-dependent* framing, FS-15 corrects the *mechanistic direction*. A record that avoids one while producing the other still fails.

---

## 13. Heat protection — the strict rule (ruling 6)

This is the category's **single largest overreach risk** (SR §G.3), so the rule is stated in full.

### 13.1 What is actually published (SR §G.1)

Two peer-reviewed anchors exist, and both are narrower than the category's marketing:

- **Zhou et al., *J Cosmet Sci* 2011;62(2):265–282** — flat irons above 200 °C; endpoints FTIR imaging (α-helix → β-sheet conversion), DSC keratin denaturation, dynamic vapour sorption, AFM, SEM, thermal imaging. Breakage was significantly reduced by pretreatment with **VP/Acrylates/Lauryl Methacrylate Copolymer**, **Polyquaternium-55**, and a **polyelectrolyte complex of PVM/MA Copolymer with Polyquaternium-28**.
- **McMullen & Jachowicz, *J Cosmet Sci* 1998;49(4):245–256** — curling-iron thermal degradation; 1 % solutions of **PVP/DMAPA Acrylates Copolymer**, **Quaternium-70** and **hydrolyzed wheat protein** each reduced damage on the order of **10–20 %** versus control.

Supporting but weaker: amino-silicone conditioning work across treatment conditions; and a supplier conference poster on silicones as thermal protectants — **not peer-reviewed**, and labelled as such wherever used.

Method note: DSC is the sensitive method but gives a **binary** answer — protection happened or it did not — and does not translate to consumer-perceptible damage. Automated repeated grooming after ironing supports "X % less breakage" claims but is less sensitive. Tryptophan fluorescence loss is the third common endpoint. **There is no settled formula-to-protection mapping.**

### 13.2 The state ladder (research trace)

| Formula situation | Highest defensible state |
|---|---|
| No heat claim and no L9 member | `not_claimed` |
| No relevant polymer; the product claims heat protection | `claim_only` |
| Generic silicone / generic protein / panthenol / oil only, with a claim | `claim_only` — **not** `formula_plausible` |
| A member of the **closed L9 list** present in a plausible film-forming context | `formula_plausible`, E2, **low** confidence |
| The exact finished product tested (DSC, breakage-after-ironing, or tryptophan loss) with a stated protocol meeting §3.2 | `product_tested`, E3+ |

### 13.3 The production projection (ruling 6)

The production model carries **one binary field: `provides_heat_protection`.** The four-state evidence detail lives in the research trace only.

**Claim-led with a formula sanity-check.**

1. The **claim leads**: if the exact product claims heat protection, `provides_heat_protection = true` is the normal outcome. This is a recommendation-policy decision, not an efficacy statement — the app is reporting what the product is sold as, and the claim's EU legality means a dossier exists, not that a test does (§3.3).
2. The **formula sanity-check runs anyway**: compare the claim against the closed L9 list.
   - Claim present **and** an L9 member present → `true`, trace state `formula_plausible`.
   - Claim present, **no** L9 member → `true`, trace state `claim_only`, **and route the record to human review** with a "claim looks formula-unsupported" note. Review decides; the standard does not silently drop the claim.
   - No claim, L9 member present → `false` with the L9 observation recorded in the trace. A formula does not manufacture a claim.
   - Claim present, exact-product test present → `true`, trace state `product_tested`.

**Hard prohibitions.**

- **Never grade efficacy.** No "strong/moderate/weak heat protection", no 0–4 heat score, no percentage.
- **Never use `heat_protection_max_c`.** The field is removed from this model. The 221–232 °C figures on legacy rows are marketing **use-condition** parameters, not measured protection levels, and must not be promoted (FS-14). A product promising hair is "geschützt bis 230 °C" is making a claim no published method supports in that form.
- **Never let a generic silicone, generic protein, panthenol or an oil reach `formula_plausible`** (G10, FS-7, FS-24).
- **Adding a polymer to the L9 list requires new peer-reviewed evidence and a standard-version bump.**

**Open question (SR §M.8):** whether any German-market leave-in actually holds E3+ heat evidence is a per-product exercise. Until calibration answers it, `product_tested` may be a permanently empty state — record it as reachable but unobserved.

---

## 14. Human review triggers

Route to targeted human review for:

- G0 product-form ambiguity, and every `provisional_boundary` record;
- `HOLD = meaningful_hold_route` (styling-boundary decision);
- a formula-source or identity conflict, or an absent exact-market formula/identifier;
- **a heat-protection claim with no L9 member** (§13.3);
- a proprietary bond/repair claim (R3 `chemistry_candidate`);
- root or scalp application, or any medically adjacent scalp/hair-loss framing;
- a fragrance-free or hypoallergenic implication;
- multi-product or routine-level efficacy evidence being offered for a single leave-in;
- a two-phase product (least dose-predictable form, SR §M.9);
- a `PERS = permanent_cationic` record combined with a `refresh` usage role;
- any proposed hard user-fit rule, or any attempt to replace a current production field.

---

## 15. Regulatory watch and the 2027 re-review trigger

**Commission Regulation (EU) 2024/1328** (in force 6 June 2024) amends REACH Annex XVII entry 70 and extends the cyclosiloxane restriction. The 0.1 % w/w limit for **D4/D5/D6** applies to **rinse-off** cosmetic products from **6 June 2026** and is extended to **leave-on** cosmetic products from **6 June 2027**.

Consequences for a standard authored in September 2026:

1. German/EU leave-in INCI lists **still legally contain Cyclopentasiloxane / Cyclohexasiloxane today**, but a reformulation wave to linear volatiles (Disiloxane, Hexamethyldisiloxane, Trisiloxane) and volatile hydrocarbons (Isododecane, Isohexadecane) is underway and completes within this standard's first year of life.
2. Any rule, anchor or calibration entry keyed on "Cyclopentasiloxane present" is a **short-lived rule**. **Gate G12** therefore requires rules to key on *function* — "a volatile carrier is present" — with the INCI family enumerated (§L2).

**`regulatory_re_review_trigger: 2027-06-06`** — adopted as an implementation default with no objection raised at charter review. On that date:

- re-verify every anchor and calibration entry that mentions a cyclosiloxane;
- re-verify FORM and WT anchors for products reformulated to linear volatiles or isododecane;
- record whether the substitutes change dry-down, weight or persistence enough to invalidate the anchors (**unknown today — SR §M.10; set the trigger rather than guessing**).

The second regulatory frame is **Commission Regulation (EU) No 655/2013** and its 2017 technical document: six common criteria for cosmetic claims, including evidential support, and specific guidance on "free from" and "hypoallergenic". Practical read for this standard: legality implies a dossier, never an instrumental finished-product test, and never an E-level upgrade (§3.3, §7.12).

---

## 16. Versioning and re-review rules

| Change | Consequence |
|---|---|
| **Formula change** (normalized formula fingerprint differs) | Reopen every field whose per-field fingerprint no longer matches (G7). Fields whose canonical payload is unchanged keep their approval. Re-run G0 only when the dominant architecture may have changed |
| **GTIN / identifier change** | Treated as a **new identity**. Re-run G1, re-verify the exact-market formula, and re-date the source. A GTIN may survive reformulation and a formula may survive a GTIN change — the two are related but separate |
| **Category-boundary change** | Re-run G0 across the affected cohort. A product that leaves the category retains its record as a boundary stress case rather than being deleted |
| **Directions change** | Reopen ROLE, `scalp_application_fit`, and any caution keyed on placement or frequency. Directions are E1 evidence, not metadata |
| **Standard-version bump** | Reopen only the fields whose rules changed; record which in the change log. Approvals for unchanged fields remain valid |
| **L9 list change** | Requires new peer-reviewed evidence, a standard-version bump, and re-review of every record with a heat claim (§13.3) |
| **Regulatory trigger 2027-06-06** | §15 |
| **Calibration rule change** | Systemic rule changes require a full pilot re-run. Product-specific uncertainty remains uncertainty and does not become a rule |

**Fingerprints (G7).** Each canonical profile field carries a deterministic **unsalted** SHA-256 fingerprint of its canonical field evidence/value payload. The whole-profile fingerprint is versioned and binds the lean profile plus `category_standard_version`; it is not a substitute for per-field fingerprints.

---

## 17. Open evidence gaps — must stay open in v0.1

None of these may be closed by inference. Each is recorded here so a record that touches it inherits the limitation (SR §M).

1. **Consumer dose per form.** No published, market-representative grams-per-use figures for sprays, milks or creams. Only laboratory protocol conventions (~0.2 g/g leave-on, ~0.1 g/g rinse-off) and patent ranges. This propagates into WT, DOSE, PERS and buildup — each inherits an unmeasured term.
2. **Leave-in accumulation over realistic use cycles.** No retrievable finished-product study. Circulating percentages are untraceable and banned (§7.6).
3. **Transfer** to skin, collar, pillow. A real user complaint; no published instrumental method surfaced. Qualitative caution only.
4. **Layering / pilling.** No measurement as a function of product layering. Caution string only (§8.4).
5. **Whether wet and dry slip separate meaningfully from formula in leave-on.** The WET+DRY merge is provisional pending this (§7.3).
6. **Curl definition from formula.** No mapping exists; technique is a large uncontrolled term (§8.2).
7. **Humidity response from formula.** No mapping. Only measured (§7.9).
8. **Whether any German-market leave-in holds E3+ heat evidence.** Decides whether `product_tested` is a live state (§13.3).
9. **Two-phase dose variability.** Shake quality changes the delivered oil:water ratio per actuation. Unmeasured.
10. **What replaces D5/D6 in EU leave-ons after June 2027**, and whether the substitutes change dry-down, weight or persistence enough to invalidate v0.1 anchors (§15).
11. **Fine-hair residue thresholds.** No evidence establishes a residue load at which fine hair reads as limp. Any threshold here is a **product judgment call** and must be labelled as one (§7.5).
12. **Sensitive-scalp tolerance from INCI.** Not derivable. EXPO flags describe exposure; they do not predict tolerance (§7.12).

**Three carried-open assumptions from the charter**, listed so they are not mistaken for settled: the DB `format` enum reconciliation, the projection of the four-state heat evidence onto existing production fields, and the blind-reviewer identity. All three are later-phase decisions.

---

## 18. German product-facing copy examples

All UI text is German. These are **patterns**, not approved copy — final wording goes through the normal copy review. Each example states the field that emits it and shows the conservative, uncertainty-honest register the standard requires.

| Emitted by | German string |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| WT = `low` | „Bleibt leicht im Haar und beschwert kaum." |
| DOSE = `high` | „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig." |
| FORM = `two_phase` | „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark." |
| PERS → `high` + buildup caution | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| LAYER caution (§8.4) | „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen." |
| HEAT trace `claim_only` | „Als Hitzeschutz ausgelobt. Wie stark der Schutz ist, bewerten wir nicht – dafür fehlen belastbare Produkttests." |
| HEAT trace `formula_plausible` | „Enthält ein Polymer, für das Hitzeschutz in Studien untersucht wurde. Für dieses Produkt selbst liegt uns kein Test vor." |
| HEAT claim without L9 member (review route) | „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." |
| HUM = `claim_only` | „Anti-Frizz ist ausgelobt. Aus der INCI-Liste lässt sich das Verhalten bei hoher Luftfeuchtigkeit nicht ableiten." |
| HUM humectant counter-signal | „Enthält Feuchthaltestoffe – die machen das Haar weicher, sprechen aber nicht für Frizz-Schutz bei feuchtem Wetter." |
| R3 = `claim_only` | „Bond-Technologie ist ausgelobt. Unabhängige Belege für einen Struktureffekt im Haar fehlen." |
| R2 = `candidate` | „Enthält einen Protein-Film-Baustein, der sich aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur." |
| HOLD = `meaningful_hold_route` | „Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege." |
| EXPO = `no_listed_fragrance_signal` | „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen." |
| EXPO = `fragrance_declared` | „Enthält deklarierte Duftstoffe." |
| EXPO alcohol note | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |
| Any `unknown` field | „Dazu haben wir keine belastbare Information." |
| G6 medical boundary | „Bei Juckreiz, Rötung, Schuppung oder Haarausfall bitte ärztlich abklären lassen – das ist keine kosmetische Frage." |

**Register rules.** State the mechanism, then the limit. Never promise a durability, a temperature or a wash count. Prefer „kann" over „wirkt". An explicit unknown always beats a confident guess.

---

## 19. Calibration rule (pre-calibration note)

**No calibration has run. Nothing in §7, §10 or §13 has been tested for repeatability.**

The planned lane, for the record:

- 12 archetypes per HO §13, selected for **best archetype coverage regardless of catalog presence** (ruling 3), with exact identity, GTIN and current formula verified before classification, and the final 12 presented to Nick before any product is classified (ruling 8).
- 3–5 adversarial stress products: a lightweight-branded product with persistent film formers; a heat claim resting on generic silicone/protein only; a hold-driven "curl cream"; a 10-in-1 whose claims rest on one or two shared mechanisms; a GTIN/formula-conflict case.
- **Blind lane (ruling 2):** a clean reviewer receives this standard and the locked formula/directions packets but **not** the proposed key. Disagreements are coded by cause — source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, legitimate uncertainty, exposure-regime error. Nick adjudicates. Systematic disagreement becomes an explicit gate, cap or anchor; product-specific uncertainty stays uncertainty.
- A material rule change forces a full re-run. Reviewer agreement measures repeatability of the rules, not truth.

**Stop condition for v0.1.** This document produces research artifacts only. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes on its authority.

---

## 20. Source anchors

This standard adds no science of its own. Every claim above traces to:

- `plans/leave-in-inci/research/leave-on-science-review.md` — the evidence base, including its full source register (§O: Tier 1 peer-reviewed/primary, Tier 2 regulatory, Tier 3 trade education, and the explicitly rejected sources). The named primary anchors relied on here are Zhou et al. 2011; McMullen & Jachowicz 1998; Rele & Mohile 2003; Marsh et al. 2026; the 2020 *Int J Biol Macromol* Michael-acceptor study; the 2013 *Colloids Surf A* streaming-potential study; the 2025 *Adv Colloid Interface Sci* LGN review; the 2012 *Colloids Surf B* emollient-spreading study; the 2018 consumer-combing study; Robbins 5th ed.; and the Manchester HHCR/DHCR work.
- `plans/leave-in-inci/handover/01_Leave_In_Category_Development_Handover_v1.0.txt` — category mission, boundary, user jobs, candidate ontology, lean profile, evidence requirements, calibration plan and system boundary.
- `plans/leave-in-inci/first-output-charter-draft.md` — Nick's confirmed rulings 1–8 and the decision-coverage record.
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` — structural template only (gates, evidence scale, evidence object, anti-double-counting discipline). Its score rules and rinse-out science do not transfer.

**Regulatory:** Commission Regulation (EU) 2024/1328 (REACH Annex XVII entry 70; D4/D5/D6; leave-on 0.1 % from 6 June 2027) · Commission Regulation (EU) No 655/2013 and the 2017 Commission technical document on cosmetic claims.
