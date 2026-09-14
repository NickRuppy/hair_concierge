# Leave-In Research and Classification Standard v0.2 (working draft)

Status: **post-calibration-round-1 working draft — nothing is locked**
Document version: `v0.2-draft`
Engine version: `leave-in-inci-v0.2`
Supersedes: `leave-in-inci-v0.1` (`leave-in-classification-standard.v0.1.md`, retained unchanged as the frozen round-1 rule set)
Scope: conventional leave-on hair-conditioning products (spray, mist, milk, lotion, cream, microemulsion, two-phase), Germany/EU
Normative source: this Markdown file
Date: 2026-09-04

**What this document is.** It converts an exact leave-in product and its exact formula into an auditable research record, and it defines the reasoning contract a human or AI researcher must follow. Prose is English; all product-facing copy examples are German (§18).

**What this document is not.** It is not locked and it classifies no product. It has now survived one calibration round (§19), so its anchors are no longer untested — but every threshold changed in v0.2 is a *repaired proposal* awaiting the round-2 re-run, not a locked rule. It does not activate a catalog field, authorize a production write, diagnose a user, or replace a formulation test.

**What changed in v0.2.** Calibration round 1 (13-product gold set, reference key vs sealed blind lane, 86.2 % field agreement) located the disagreement mass in *standard defects*, not in erratic judgment. v0.2 repairs those defects. Every change traces to the round-1 disagreement log (`plans/leave-in-inci/research/gold-set/agreement/disagreement-log.md`, cited as **DL Cx**), to the blind lane's ambiguity register (`plans/leave-in-inci/research/gold-set/blind/blind-review-notes.md` §2, cited as **BR §2.x**), or to Nick's adjudication rulings R11–R14 (§21). **v0.2 introduces no science absent from the science review.** The full entry-by-entry ledger is §21 and `rule-changes.md`.

**Authority.** Every scientific claim traces to the leave-on science review (`plans/leave-in-inci/research/leave-on-science-review.md`, cited below as **SR §x**) or to the Leave-In Category Development Handover v1.0 (cited as **HO §x**). Where the two conflict, the handover's own hierarchy applies: new leave-in research and the handover take precedence over conditioner-specific assumptions, and the science review takes precedence over the handover on questions the review actually investigated. Nothing in this standard may introduce science absent from those two documents.

**Inherited structure.** The gate pattern (G0–G7), the evidence scale, the property-evidence object, the shared-mechanism/anti-double-counting discipline, and the identity control are reused from the Conditioner Research and Classification Standard v1.6 (`docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`). Conditioner *score rules and category science do not transfer* (HO §5, SR §N).

**Confirmed rulings encoded here.** Ontology of 13 scored dimensions with SHN/CURL/R3/LAYER demoted and R1 folded into COND (ruling 5); binary production heat protection with no `heat_protection_max_c` (ruling 6); `usage_role` reinstated and `care_direction` retained as a dedicated evidence-backed axis (ruling 7); regulatory re-review trigger 2027-06-06 (implementation default). **Added in v0.2:** formula freeze must capture and verify directions-of-use, not only INCI (R11, §2.4); claim authority is the manufacturer's German/EU page or the current German pack, never retailer copy (R12, §2.4.1); the two-persistent-families WT anchor resolves to `moderate` with a mandatory counter-signal, and counter-signals/confidence never leave the research trace (R13, §7.5, §10.1.1); a genuine repair-film route qualifies a product for the highly-damaged tier alongside the high-conditioning path, an R3 bond flag alone never does (R14, §10.3). Deviations from the handover's candidate vocabulary are marked **[divergence]** with their justification.

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

### 2.3.1 Emission contract for excluded products **[new in v0.2 — DL defect register, BR §2.17]**

v0.1 said excluded products "do not classify" (§2.3) while §16 said a product leaving the category "retains its record as a boundary stress case". The two lanes read that differently, so the contract is now explicit. An excluded record (`excluded_anhydrous`, `excluded_styling_first`, `excluded_other_form`) carries **exactly** the following and nothing else:

| Emitted | Content |
|---|---|
| Identity block (§2.4) | Complete, including the directions capture required by G1 |
| `g0_state` + `g0_rationale` | The exclusion state and the observation that triggered it |
| `out_of_category: true` | Explicit |
| Formula record | Raw INCI, normalized fingerprint, source, conflicts |
| §7 dimensions | **Optional, and if present marked `informational_and_non_authoritative: true`.** They exist only to make the boundary case reusable as a stress case; they are never inputs to matching, comparison or copy |
| Lean matching profile (§10) | **Not emitted at all.** No `focus`, no fit fields, no `specialist_functions`, no cautions |
| `review_status` | `provisional` at minimum; `provisional_boundary` records always route to human review (§14) |

A `provisional_boundary` record is *not* an exclusion: it stays in-category, completes the full record, and marks every affected field uncertain (§2.3). Downstream consumers must treat "no lean profile present" as the machine-readable signal of exclusion; the absence of fit fields is the contract, not an omission.

### 2.4 G1 — identity and formula gate

Classification stops before formula analysis unless these are captured or explicitly recorded as a documented gap:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier (GTIN/EAN) or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI plus a normalized formula fingerprint;
- **the verbatim authoritative application directions, quoted and source-stamped** (source hierarchy: user package → German/EU manufacturer → exact-GTIN German retailer → other German/EU retailer → secondary discovery) — see the mandatory directions capture below;
- G0 product-form status;
- any source/formula conflicts, preserved rather than resolved by preference.

Allowed identity states: `verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` · `excluded_product_form`.

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that affects one property makes **that property** unknown; it blocks the whole analysis only when the dominant architecture cannot be resolved.

**Leave-in-specific addition:** directions are not optional metadata here. `usage_role` (§7.13) is read from directions at E1 and is load-bearing for dose, frequency, damp-vs-dry application and therefore accumulation (SR §K ROLE). Missing directions make `usage_role` `unknown` — they never license an INCI-based guess.

**Mandatory directions capture (G1, hard requirement) [new in v0.2 — ruling R11, DL C1].** The formula freeze is not complete until directions-of-use have been *captured and verified*, not merely assumed from the product's category or name. Round 1 lost a gold-set slot to exactly this failure: a product freeze-captured as a leave-in carried the direction „Nach 9 Sekunden gründlich ausspülen" and was in fact a rinse-out (`excluded_other_form`). Both the identity lane and the blind lane missed it because only the INCI was captured. Therefore:

1. **Capture the direction text verbatim**, in the original German where the source is German, with the source tier and retrieval date. A paraphrase is not a capture.
2. **Verify it against the exclusion test first.** Any direction containing a rinse, wash-out, or contact-time-then-rinse instruction sets `excluded_other_form` at G0 **before** any formula analysis runs. Product form, list architecture and marketing name never override an explicit rinse direction.
3. **Absent directions are a documented gap, not an assumption.** Record `directions_capture: missing`, set `usage_role` `unknown` (§7.13), set `scalp_application_fit` `unknown` (§10.3.1), and route the record to human review (§14).
4. A **directions change** reopens ROLE, `scalp_application_fit` and every placement- or frequency-keyed caution (§16, unchanged) — which only works if the original capture is on file to diff against.

### 2.4.1 Claim authority **[new in v0.2 — ruling R12, DL C5, BR §2.9]**

v0.1 defined a source hierarchy for *directions* and none at all for *claims*, while making the production field `provides_heat_protection` claim-led (§13.3). Round 1 showed the cost twice: a product whose authoritative German source carries no heat claim while assorted retailer copy mentions heat-damage protection, and a retailer inventing "the heat protecting molecule" for a plain PVP the manufacturer never made a heat claim about. Two lanes, two different production binaries, from the same product.

**The rule — general, and it governs every claim-keyed field in this standard:**

> **A marketing claim exists for classification purposes if and only if the manufacturer's German/EU product page or the current German pack states it.** Retailer copy — including exact-GTIN German retailers, marketplaces and salon resellers — **never creates a claim.** It may only *corroborate* a claim that already exists at manufacturer or pack level.

| Tier | Source | Can create a claim? | Can corroborate? |
|---|---|---|---|
| C1 | Current German pack (user photo, pack scan) | **Yes** | Yes |
| C2 | Manufacturer's German/EU product page for the exact product | **Yes** | Yes |
| C3 | Exact-GTIN German retailer listing | No | Yes |
| C4 | Other German/EU retailer, marketplace, salon reseller | No | Yes |
| C5 | Secondary discovery, review sites, brand social copy on a non-EU market page | No | Weakly, and record the weakness |

**Operating rules.**

1. **No C1/C2 source found ⇒ the claim does not exist**, and the claim-keyed field takes its no-claim value (`not_claimed` for HEAT and HUM). Record the retailer copy in `counter_signals[]` with its tier, and route the record to human review with a `claim_authority_gap` note so a human can decide whether the manufacturer source was simply not found.
2. **C1 and C2 conflict** (pack says one thing, the page another) ⇒ preserve both under G5, take the **more conservative** reading for the production field, and route to review.
3. **Non-German EU or non-EU market pages** are C5, not C2: a claim made on a US page is not a claim made on the German market product.
4. **A system-level claim** ("… when used as a system of shampoo, conditioner and treatment") is a claim about a routine, not about this product alone. Authority is satisfied when the source is C1/C2, so the claim exists — but its *scope* is a separate question this standard does **not** decide. Handling: record the claim verbatim with its system conditioning, tag the field `claim_scope: system_level`, take the trace state the product's own evidence supports (usually `claim_only`), apply §13.3's claim-led binary unchanged, and **route the record to human review** (§14 already lists routine-level efficacy evidence for a single leave-in). **Whether a system-level claim should set a product-level production binary is an open adjudication item (§17.13)** — it is a product-policy question, not a claim-authority question, and v0.2 does not resolve it.
5. **Claim authority does not create evidence.** A C1/C2 claim is still E0 (§3.1). This rule decides only *whether a claim exists*, never how strong it is.

**Directions inherit the same authority for ROLE.** `usage_role` values (§7.13) may be read only from directions carried by a C1 or C2 source. Retailer application copy corroborates but never creates a role value (DL C10).

**Fields governed by this rule:** HEAT (§7.8, §13), HUM (§7.9), ROLE (§7.13, directions), the `heat_styling` focus (§10.2), and every German copy string in §18 that begins with „… ist ausgelobt".

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

### 3.1.1 "Present as architecture" and "above the tail" — the operational marker **[new in v0.2 — DL defect register, BR §2.2]**

Almost every anchor in §7 turns on whether an ingredient is *present as architecture* or *above the tail*, and v0.1 never said how to decide. Both lanes had to invent a method; silence here guarantees divergence on every dimension at once. The method is now named, bounded and mandatory.

**Definitions.**

- **Present as architecture** — the ingredient is positioned such that it plausibly constitutes part of the product's structure rather than a token addition, *and* its family is coherent with the rest of the read (e.g. a fatty alcohol paired with a cationic surfactant, an oil with other lipids).
- **Above the tail** — the ingredient's rank is above the **tail marker** defined below.

**The tail marker (a heuristic, explicitly labelled as one).** The only boundary visible on a consumer INCI list is the rank of a **concentration-capped ingredient** — chiefly the common preservatives and preservative-adjacent materials whose EU or practical use levels sit at or below ~1 %:

> Phenoxyethanol · Sodium Benzoate · Potassium Sorbate · Benzyl Alcohol (as preservative) · Hydroxyacetophenone · Ethylhexylglycerin · Levulinic Acid / Sodium Levulinate · Chlorphenesin · Dehydroacetic Acid · Caprylyl Glycol (in a preservative pair) · the declared 26 EU fragrance allergens as a block.

**The rule.** The **first** such capped ingredient in the list is the tail marker. Ingredients ranked **above** it are read as "above the tail"; ingredients at or below it are read as tail members. This is a **bounded rank observation**, which §3.1 permits — it compares two positions on the same list. It is **not** a percentage inference, which G4 forbids: no record may state or imply a percentage, a ratio or a concentration derived from this marker.

**Mandatory limits — this is a heuristic, not a measurement.**

1. **It is a heuristic and must be recorded as one.** Every anchor decision that turns on the marker records the marker ingredient and its rank in `threshold_reasoning[]`, and carries a `limitations[]` entry naming the heuristic. A reviewer who does not state the marker has not applied the rule.
2. **No marker present ⇒ no tail boundary is readable.** Do not guess one. Fall back to the ordinal read (how early and how many members of a family appear), record `tail_marker: none_visible`, and lower confidence by one step on every anchor that depended on it.
3. **An early marker is a strong counter-signal, not an automatic downgrade.** When the marker sits very high in the list — round 1 saw Phenoxyethanol at rank 3, placing an entire conditioning architecture nominally in the unordered sub-1 % tail — do **not** mechanically collapse COND and WT to `low`. Record the ordinal observation as a strong counter-signal, hold the value at the level the architecture supports, mark the field uncertain, and lower confidence. Reason: a capped preservative can legitimately be over-declared or sit adjacent to the boundary, and the tail is unordered, so a low-ranked non-volatile is *unpositioned*, not *absent*.
4. **The marker never creates presence.** An ingredient below the marker is still present; it simply cannot be read as architecture on rank alone.
5. It is a **within-list** marker only. Never compare marker positions across two different products' lists as if they were a common scale.

**Open gap.** No published method validates this heuristic against measured concentrations; it is a reading convention adopted so two reviewers reach the same answer, and it is listed as an open gap in §17.

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

**Mandatory counter-signals [new in v0.2 — ruling R13].** Some anchors in §7 are reachable *only* with a recorded counter-signal; the record is invalid without it. These are:

| Anchor | Mandatory counter-signal |
|---|---|
| WT `moderate` via the two-or-more-families row (§7.5) | The multi-family observation itself: which families, at which ranks, and why the absent rich-band member holds the value below `high` |
| HUM `formula_plausible` with any humectant materially present (§7.9) | The humectant observation, with confidence held at `low` |
| PERS when a monomeric long-chain quat is the dominant persistent species (§7.6) | The likely-under-stated-persistence note |
| Any anchor decided on the §3.1.1 tail marker | The marker ingredient, its rank, and the heuristic limitation |

**Counter-signals, confidence and uncertainty are research-trace artifacts.** They exist to make a value auditable and re-openable. They are **never projected into a user-facing field** and are dropped at projection — see §10.1.1. A counter-signal is not a hedge that shifts a value; the value is what the anchor says, and the counter-signal says why a reviewer should be able to reopen it.

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

Evidence: cationised proteins (Hydroxypropyltrimonium Hydrolyzed Wheat/Rice/Keratin Protein), silane derivatives (Hydrolyzed Wheat Protein PG-Propyl Silanetriol), peptides, silicone quats, cationic polymers — in a plausible film-forming context.

Permitted E2 statement: "contains a possible substantive surface-film route."

**Route ≠ dimension value [v0.2].** L6 is the *mechanism dictionary*; the R2 dimension (§7.10) applies a **narrower closed list** — cationised protein, silane derivative, silicone quat — and excludes non-silicone cationic polymers and peptides from `candidate`, because "high charge density" is not readable from an INCI list (G4). An L6 observation that does not clear the R2 list is recorded as L6 evidence feeding PERS and SFR, and R2 stays `none_visible`.

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

**L9 tail-member rule [new in v0.2 — DL defect register, BR §2.13].** Membership of the closed list is necessary, never sufficient. Hydrolyzed wheat protein is both an L9 member (McMullen & Jachowicz tested one specific protein at a defined concentration in a model system) and a routine tail ingredient in mass-market leave-ins, so a literal reading of §13.2 would have promoted an unclaiming naturkosmetik spray to `formula_plausible`. Therefore:

1. An L9 member that is **not above the tail** (§3.1.1) is **not** in "a plausible film-forming context" and produces **no state upgrade**. Record the observation in the trace with the tail marker and stop.
2. An L9 member present with **no C1/C2 claim** (§2.4.1) produces **no state upgrade and no binary change**: the trace state stays `not_claimed`, and the binary stays `false` per §13.3 rule 3. A formula does not manufacture a claim.
3. The two rules compose: an upgrade to `formula_plausible` requires an L9 member **above the tail** *and* a C1/C2 claim.
4. The study context is recorded, not inherited: for hydrolyzed wheat protein the published result is at a defined concentration in a model system, which the INCI list cannot confirm. That is itself a mandatory limitation on any `formula_plausible` resting on it.

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
| `aqueous_or_hydroalcoholic_solution` | Water leading, optionally with glycol and/or alcohol early; **no long-chain fatty alcohol**; **no** true emulsifier — either nothing, or only solubiliser-type material (PEG-40 Hydrogenated Castor Oil, Polysorbate-20/-80, PPG-x-Buteth-x) **without** a real oil/silicone load behind it. A cationic polymer or short-chain quat is *typical but not required* |
| `emulsion` | **Any** true O/W emulsifying system carrying a lipid or silicone phase. Two sub-types, both fully in this row: **(a) LGN emulsion** — a cationic-surfactant + fatty-alcohol lamellar gel network pair (Behentrimonium/Cetrimonium/Distearyldimonium Chloride or Stearamidopropyl Dimethylamine **plus** Cetearyl/Cetyl/Stearyl Alcohol; often Glyceryl Stearate, Carbomer, Xanthan). **(b) Non-LGN emulsion** — a nonionic, polymeric or silicone emulsifier system with **no LGN pair**: pre-neutralised polyacrylamide/isoparaffin/laureth systems, Sodium Polyacrylate/Acrylate copolymer emulsifiers, Cetyl PEG/PPG-10/1 Dimethicone and other silicone emulsifiers, Glyceryl Stearate + PEG-100 Stearate, Ceteareth-x/Steareth-x pairs, Polyglyceryl-x esters |
| `microemulsion` | **Both** of: (i) a **solubiliser package** — two or more solubiliser-type materials (PEG-esters, PEG-hydrogenated castor oils, polysorbates, Trideceth-x, Laureth-x, PPG-x-Buteth-x), or one such material plus glycols high in the list; **and** (ii) a **real oil or silicone load present as architecture** (§3.1.1). **No LGN pair, no true O/W emulsifier.** Product clarity corroborates; it is not an INCI observation and never decides the row |
| `two_phase` | An **unemulsified** architecture: a water phase plus an oil and/or silicone phase, with **no emulsifier and no solubiliser package** capable of carrying that load. Decidable from architecture alone. A "vor Gebrauch gut schütteln" direction **corroborates** and is not required |
| `anhydrous_serum_or_oil` | No Aqua, or Aqua absent from the top → **out of category** (G0) |
| `unknown` | The formula is incomplete, or the architecture matches none of the rows above after all four have been tested in order |

**Decision order [new in v0.2 — DL C2].** Test the rows in this order and take the first match: `anhydrous_serum_or_oil` → `two_phase` → `emulsion` → `microemulsion` → `aqueous_or_hydroalcoholic_solution` → `unknown`.

**The solution ↔ microemulsion threshold [new in v0.2 — DL C2].** The two rows differ on **one** test, because a solubiliser is present in both: does the formula carry a **real oil or silicone load present as architecture**?

- Solubiliser package **plus** a real oil/silicone load above the tail ⇒ `microemulsion`.
- Solubiliser present but **no** oil/silicone load above the tail (the solubiliser is carrying fragrance or a trace active) ⇒ `aqueous_or_hydroalcoholic_solution`.
- A single solubiliser plus a single tail-position silicone is the ambiguous middle: return `unknown`, record both readings, and route to review.

**Notes on the rebuilt table.**

- The **cationic-required clause is gone** from the solution row (v0.1 required "cationic polymer and/or short-chain quat"). Round 1 produced water + oil + alcohol systems and eleven-ingredient detangling sprays that the clause pushed to `unknown` for no decision-relevant reason.
- The `aqueous_or_hydroalcoholic_solution` label deliberately covers both purely aqueous and hydroalcoholic systems. Whether alcohol is present is recorded in EXPO notes (§7.12), not in FORM.
- **A long-chain fatty alcohol without a cationic partner** is not an LGN pair. Read it as an emollient/consistency factor and classify on the rest of the architecture; it does not by itself create the `emulsion` row (the sub-type (b) test is the emulsifier system, not the fatty alcohol).
- Fatty alcohols beyond the enumerated Cetearyl/Cetyl/Stearyl — e.g. Myristyl, Behenyl, Arachidyl — count for the LGN pair test when paired with a cationic surfactant. The enumeration is representative, not closed; record the reading.

**Ceiling.** High confidence that these classes are real and INCI-separable. **Moderate** on a specific borderline product; the thin-lotion-vs-thick-milk boundary is rheological, not compositional, and **carries no decision weight** — which is why the marketing form word is metadata, not a scored value **[divergence from HO §11's `spray | milk | lotion | cream | two_phase`; the presentation word is preserved as `presentation_form` metadata]**. The LGN / non-LGN distinction stays in the research trace as `emulsion_subtype: lgn | non_lgn`; it is **not** projected (§10.1).

**Gates.** G9 — FORM may never set WT. **Confidence high as an architecture label, low as a weight proxy** (SR §K FORM). **G9 also governs the reverse direction: `unknown` FORM never forces `unknown` WT** (§7.5).

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
| `low` | Volatile carrier dominant or a water/glycol-dominant architecture; **no** persistent non-volatile family above the tail; no LGN pair; no rich-band lipid |
| `moderate` | **Either** exactly one persistent non-volatile family present as architecture (a light/medium-band emollient, a light silicone, or a cationic-polymer film); **or** the multi-family row below |
| `moderate` **(multi-family row) [new in v0.2 — ruling R13, DL C3, BR §2.1]** | **Two or more** persistent non-volatile families present as architecture, **none of them a rich/low-spreading band member**, and no LGN pair. **The multi-family counter-signal is mandatory** (§4): name every family and its rank, and state that the absent rich-band member is what holds the value below `high`. Confidence caps at `moderate` |
| `high` | An LGN pair present as architecture **and/or** two or more persistent non-volatile families with **at least one rich/low-spreading band member** (coconut/olive/castor/avocado oil, shea/mango/cocoa butter, petrolatum, heavy mineral oil) |
| `unknown` | The non-volatile architecture is unresolved — the formula is incomplete, or a source conflict makes the persistent families unreadable |

**The multi-family row, and why `moderate` [ruling R13].** Round 1 hit this gap three times and both lanes flagged it independently: v0.1's `moderate` required *exactly one* persistent family and its `high` required two-or-more **and** a rich-band member, so a formula with two or three persistent families and no butter/coconut/olive/castor/avocado/petrolatum member fell between the rows. The blind lane resolved two such products in opposite directions on nothing but its own judgment about list depth. Nick's adjudication anchors this row at **`moderate` with a mandatory counter-signal**. The reasoning that must appear in `threshold_reasoning[]`: multiple persistent families raise residue above the single-family case, but the absent rich/low-spreading member is the specific thing the `high` anchor is about — occlusion, weight and transfer — and dose remains the unmeasured term (§17.1). The FS-13 double-check still runs: a `moderate` WT on this row must not be paired with a PERS reading that quietly promises high persistence and low buildup.

**Rich-band membership is a closed enumeration for anchor purposes [new in v0.2 — BR §2.1].** For the `high` anchor, "rich/low-spreading band member" means a member enumerated in the L3 rich band (§5). An **unenumerated liquid vegetable oil** — round 1 saw sunflower, high-oleic sunflower, soy, argan, apricot kernel, macadamia, safflower and canola — is read in the **medium** band and does **not** satisfy the rich-band test. It still counts as a persistent non-volatile family for the multi-family row. This is a reading convention adopted so two reviewers reach the same answer, not a spreading-value measurement; it is recorded as an open gap in §17 and the L3 band table is not extended on this basis.

**Ceiling: moderate.** It may rise to **moderately high** only when *both* (a) FORM resolves to a definite architecture and (b) the non-volatile architecture is fully readable above the tail (§3.1.1). It never rises on FORM alone, and the multi-family row never rises above `moderate`.

**Gates.** **G9 — FORM must never set WT, in either direction.** "Spray ⇒ light" is a hard gate, not a note (SR §A.2, §K FORM). G3. G4.

**G9 resolution of the v0.1 form clauses [new in v0.2 — DL C2/defect register, BR §2.3].** v0.1's `high` anchor ended "…**or** a two-phase or microemulsion carrying a substantial oil/silicone phase", and its `unknown` anchor read "**Form** or non-volatile architecture unresolved". Both clauses let FORM determine WT, which G9 forbids, and round 1 showed the contradiction was decisive on at least one product. **G9 governs. Both clauses are removed** and replaced by:

1. A two-phase or microemulsion product reaches WT `high` **only through the observed rank of its oil/silicone load**, assessed exactly as for any other architecture. When a two-phase product carries a bulk oil above the tail, the `high` value rests on that observation — not on the form label. When the oil/silicone load is not readable above the tail, the form label buys nothing.
2. `FORM = unknown` **never** forces `WT = unknown`. Assess WT from the readable non-volatile architecture alone. WT is `unknown` only when the *architecture itself* is unresolved.
3. `FORM = two_phase` still drives the DOSE derivation (§7.11) and the shake caution (§18). That is a **dose-variability** statement, not a weight statement, and it is the one place the form label legitimately carries information G9 does not bar.

**Attached qualitative caution — transfer.** When a low-spreading, non-volatile, non-film-forming lipid load is present, attach the transfer caution (skin, collar, pillow, phone). It is qualitative: **no published instrumental transfer method for hair leave-ons surfaced** (SR §D.3). Never a scored dimension.

**False signals.** FS-1, FS-2, FS-3, FS-4, FS-17, FS-18, FS-20 (silicone-free plus a cationic polymer is not low buildup — high-charge-density polyquaterniums are among the most substantive materials in the category).

**Known judgment call.** There is **no evidence establishing a residue load at which fine hair reads as limp** (SR §M.11). Any fine-hair threshold this standard sets is a product judgment call and must be labelled as one in `limitations[]`, not presented as a derived scientific constant.

### 7.6 PERS — persistence and removal class *(PERS + WASH merged, ruling 5)*

**Definition.** An **ordinal mechanism class only**. Wash resistance and buildup are one property viewed from opposite ends, so they are one axis plus one non-quantitative caution — never two scores that can be set in opposite directions (SR §K PERS/WASH).

**Values — ordinal, highest class present as architecture wins; record the others as supporting:**

| Class | Anchor |
|---|---|
| `permanent_cationic` | **Polymeric or silicone-functional quats only.** Silicone-functional: any declared `Silicone Quaternium-x` (16, 18, 22, …) and Quaternium-80. Polymeric: any declared `Polyquaternium-x` (7, 10, 11, 16, 28, 55, …), Guar Hydroxypropyltrimonium Chloride, Hydroxypropyl Guar Hydroxypropyltrimonium Chloride, Starch/Cellulose Hydroxypropyltrimonium Chloride. Cationised proteins: Hydroxypropyltrimonium Hydrolyzed *x* Protein |
| `ph_dependent_cationic` | Amodimethicone, Bis-Aminopropyl Dimethicone, amidoamines (Stearamidopropyl Dimethylamine and family) |
| `neutral_non_volatile` | Dimethicone, Dimethiconol, Phenyl Trimethicone, esters, oils, waxes, fatty alcohols — **and monomeric long-chain quats** (see the rule below) |
| `volatile_or_water_soluble` | Volatiles and humectants only; or PEG-modified silicones as the only silicone |
| `unknown` | The persistent architecture is unresolved |

**`permanent_cationic` is now enumerated by INCI name, not by charge density [new in v0.2 — DL C4, BR §2.11].** v0.1 gated the top class on "high-charge-density polyquaterniums" — a property **G4 forbids inferring from an INCI list**. Round 1's consequence was that the blind lane reached the class exactly once in thirteen products, and only on a literal family match, while materials the standard's own FS-20 singles out as among the most substantive in the category (Guar HPTC, PQ-10, PQ-16) sat outside the enumeration. The class is therefore defined by **structure that is visible on the label** — polymeric or silicone-functional quaternisation — and the charge-density language is deleted. Charge density remains the *mechanistic* explanation (SR §B.2, §I) and may be described in prose; it may never be a threshold.

**Monomeric long-chain quats [new in v0.2 — DL C4].** Behentrimonium Chloride/Methosulfate, Cetrimonium Chloride/Bromide, Distearyldimonium Chloride and comparable small-molecule quats are **permanently charged but surfactant-removable**, unlike polymeric and silicone-functional quats, and the science review's removability ordering separates them on exactly that basis (SR §I). v0.1 had **no home** for them: the blind lane had to assign `volatile_or_water_soluble`, which under-states persistence and therefore under-warns on buildup — the direction FS-20 exists to guard. The rule:

> A monomeric long-chain quat as the dominant persistent species places the record in **`neutral_non_volatile`**, with a **required note** (`counter_signals[]` + `limitations[]`): *"Persistence rests on a monomeric long-chain quat: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*

The note is mandatory; a record placing a monomeric quat in `neutral_non_volatile` without it is invalid. A monomeric quat **never** reaches `permanent_cationic` on its own, and it never drops to `volatile_or_water_soluble` when it is the dominant persistent species.

**Unresolvable quats.** A declared quat whose polymeric-vs-monomeric structure cannot be established from the INCI name alone (several `Quaternium-x` numbers are opaque) is **not** promoted. Take the `neutral_non_volatile` class with the monomeric note, record `quat_structure: unresolved` in `limitations[]`, and route the record to human review (§14). Do not infer structure from a supplier datasheet claim about substantivity — that is a charge-density inference by another route (G4).

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
**Ceiling: low from formula alone** — and made stricter than the handover implies. `formula_plausible` requires a member of the **closed L9 list**, above the tail, **with a C1/C2 claim** (§2.4.1, §5 L9 tail-member rule). Generic silicone, generic protein, panthenol and oils reach `claim_only` and no further.

**Claim authority (v0.2).** "The product claims heat protection" means a claim carried by the current German pack or the manufacturer's German/EU page. Retailer copy never creates the claim (§2.4.1). This decides the production binary, so it is not a research nicety.

### 7.9 HUM — humidity-resistance evidence state

**Definition.** A 4-state **evidence flag**, not a score, mirroring HEAT. Humidity response is *measured*, not inferred (SR §K HUM).

| State | Requirement |
|---|---|
| `not_claimed` | No C1/C2 humidity, anti-frizz or "Anti-Frizz" claim **and** no qualifying route |
| `claim_only` | A C1/C2 humidity/anti-frizz claim without a qualifying route — **the default for most claiming products** |
| `formula_plausible` | A **hydrophobic, continuous film-forming route** with a plausible water-uptake-reduction mechanism (e.g. VP/VA or a more hydrophobic fixative, or a persistent hydrophobic silicone film) present as architecture (§3.1.1) **and** no *dominant* humectant architecture. **A claim is not required** (see the decision below). E2, **low** confidence — always, with no upgrade path from formula |
| `product_tested` | The exact product tested by HHCR or DHCR (high-humidity curl retention at ~26 °C / 90 % RH over 24 h, `% retention = (Le − Lt)/(Le − Li) × 100`; ~70 % retention is the conventional "good" bar), by dynamic vapour sorption (0 % → 90 % RH weight gain), or by humidity-chamber tress imaging — with declared RH, temperature and equilibration time |

**Decision: `formula_plausible` does not require a claim [new in v0.2 — DL defect register, BR §2.4a].** Round 1 exposed the ladder's shape defect: `not_claimed` requires *both* no claim and no qualifying route, while `formula_plausible` requires only a route — so any silicone-film leave-in that makes no humidity claim landed on `formula_plausible`, asserting a plausibility the brand never claimed. It was hit three times. Two repairs were available: add a claim precondition (aligning HUM with HEAT's claim-led ladder), or keep the state claim-free and constrain what it may say. **The claim-free reading is adopted**, deliberately and for two reasons:

1. **HEAT and HUM are asymmetric by design.** HEAT projects a **production binary** whose whole job is to report what the product is sold as, so a claim precondition is structural there. HUM projects only its own **4-state evidence flag** (§10.1) — it never asserts a benefit, so a route observation without a claim is a legitimate, honest trace value.
2. Requiring a claim would make the state a claim-detector rather than an architecture read, and would discard exactly the observation a later `product_tested` record would need to be compared against.

**The constraints that make this safe, all mandatory:**

- **`formula_plausible` never rises above `low` confidence** from formula, in any combination of observations. There is no formula-only route to `moderate` here.
- **No German copy string may present a claim-free `formula_plausible` as an anti-frizz benefit.** §18 carries no such string, and none may be added: `formula_plausible` without a claim emits nothing user-facing.
- The state records what it is: *"a hydrophobic film route is present; the manufacturer makes no humidity claim; humidity response is measured, not inferred."*

**Humectant counter-signal (mandatory) — and the "dominant" vs "lowers it" conflict resolved [new in v0.2 — BR §2.4b].** v0.1 said `formula_plausible` requires "no *dominant* humectant architecture" while the counter-signal sentence said humectants materially present "**lower** this state and never raise it". Those give different answers for a materially-present-but-not-dominant humectant. Resolved in favour of a two-step rule:

1. **A dominant humectant architecture blocks `formula_plausible` outright.** Dominant means the humectant leg (Glycerin, Propanediol, Butylene/Pentylene/Dipropylene Glycol, Sodium PCA, Betaine, Panthenol) is the material direction of the water phase — several members, and/or a member above the tail and high in the list. The highest reachable state is then `claim_only` (with a claim) or `not_claimed` (without one).
2. **A humectant materially present but not dominant does not block the state**, but its observation is a **mandatory counter-signal** (§4) and **confidence is capped at `low`**. It never raises the state and it never raises confidence.

Humectants are never support for a humidity claim in either direction: the best-supported anti-frizz mechanism is reducing water uptake, while a humectant's function is to increase water association (SR §E.1).

**Glycols are not automatically humectants [new in v0.2 — BR §2.18].** A glycol high in the list may be a solvent rather than a humectant, and that reading can decide the state. Record which reading was taken and why in `threshold_reasoning[]`; where the formula does not settle it, take the **humectant** reading (the conservative one — it lowers the state) and mark the field uncertain.

**Gates.** G4. **Never encode a dew-point threshold** (FS-16). HUM also absorbs the humidity half of the old SFR definition — no other dimension may make a humidity statement. Claim authority per §2.4.1.

**False signals.** FS-6, FS-8, FS-15, FS-16.

### 7.10 R2 — repair surface film

**Definition.** A substantive protein/polymer/silane surface film. Tightened from the handover.

| Value | Anchor |
|---|---|
| `candidate` | An identifiable **substantive** route from the closed list below — **a cationised protein, a silane derivative, or a silicone quat** — present as architecture (§3.1.1) in a plausible film context |
| `none_visible` | Generic gums, starches, rheology polymers; panthenol; **a plain (non-cationised) hydrolyzed protein at any list position**; a non-silicone cationic polymer |
| `tested` | Exact-product endpoint evidence meeting §3.2 |
| `unknown` | Formula or context unresolved |

**The `candidate` route list is closed and narrower than v0.1 [new in v0.2 — DL singles, DL defect register, BR §2.5].** Two changes:

1. **"High-charge cationic polymer" is removed as a qualifying route.** It rested on a charge-density property G4 forbids inferring from an INCI list — the same defect repaired in PERS (§7.6) — and it was half of the §10.2 `repair`-row contradiction. Non-silicone cationic polymers now contribute to PERS (§7.6) and SFR (§7.4) only.
2. **A plain hydrolyzed protein is `none_visible` wherever it sits.** v0.1's `none_visible` anchor described "a plain hydrolyzed protein sitting **in the tail**", which left a hole: round 1 met a plain hydrolysate at rank 6, high in the list, with no anchor covering it. What makes a protein an R2 route is **cationisation or silane functionalisation**, not rank. A plain hydrolysate — Hydrolyzed Keratin, Hydrolyzed Wheat/Rice/Soy/Quinoa Protein, Hydrolyzed Silk, and comparable — is `none_visible` at any position, **with a mandatory trace note** recording the observation, its rank, and the reason it does not qualify. The note exists so the record does not read as if the protein was missed.

Peptides sit with the L6 evidence but are **not** an R2 `candidate` route on their own; a peptide with no cationisation or silane function is `none_visible` with the same trace note.

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
| `high` | WT = `high`; **or** FORM = `two_phase`; **or** a rich/low-spreading lipid band member is present as architecture |
| `moderate` | WT = `moderate` — **including the multi-family row (§7.5)**; **or** FORM = `microemulsion` (visually light, real non-volatile load) |
| `low` | WT = `low` **and** the carrier is volatile- or water-dominant with no persistent family above the tail |
| `unknown` | WT = `unknown` |

**DOSE follows WT [new in v0.2 — DL C3].** The multi-family WT row resolves to `moderate` (§7.5, ruling R13), so DOSE for those products is `moderate` — it is not separately re-argued upward on family count. DOSE is a restatement of the WT/M1 observation by construction (that is why it is derived, not assessed), so any DOSE value that disagrees with its WT input is a G3 violation.

**Two corrections to the v0.1 rows [BR §2.18].**

- The `low` row no longer requires FORM = `aqueous_or_hydroalcoholic_solution` **and** a "volatile-dominant carrier". Water is not a volatile carrier in the M6 sense (M6 covers volatile silicones and hydrocarbons), so a purely aqueous low-weight product satisfied no row at all in v0.1. The row now keys on the carrier being volatile- **or water**-dominant, and drops the FORM condition — which also removes a FORM→DOSE dependency that G9's reasoning disfavours even though G9 formally binds only WT.
- The `unknown` row no longer fires on `FORM = unknown`. WT is the determinant; FORM `two_phase` and `microemulsion` are additive triggers, never blockers.

**Anhydrous products emit no DOSE value.** They are out of category at G0 and carry no lean profile (§2.3.1).

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

**Sourcing and evidence rule [new in v0.2 — DL C10, ruling R12].** Round 1 assigned `refresh`, `ends_only` and `heat_styling` from differently-sourced directions across the two lanes, which is a sourcing defect, not a judgment difference. Two binding rules:

1. **Authority.** Role values may be read **only** from directions carried by a C1 (current German pack) or C2 (manufacturer's German/EU page) source — the same authority tier as claims (§2.4.1). Retailer application copy **corroborates** an existing role; it never creates one. Where only retailer copy exists, ROLE is `unknown` and the retailer text is recorded in `supporting_signals[]` with its tier.
2. **One direction sentence per role value.** Every emitted role value carries, in `formula_observations[]` (scope `directions`), the **verbatim direction sentence** that establishes it, with source tier and date. A role value without its sentence is invalid and must be dropped, not defended.

| Role | What the direction sentence must establish |
|---|---|
| `post_wash` | Application to freshly washed, towel-dried or damp hair |
| `refresh` | Application to dry hair between washes, or re-application during the day |
| `heat_styling` | Application before a named heat tool (blow-dryer, straightener, curling iron) — a temperature figure alone is a claim, not a direction |
| `curl_styling` | Application for curl forming, scrunching, diffusing or definition |
| `ends_only` | Placement restricted to lengths and/or ends („in die Längen und Spitzen") |

A **shake instruction** („vor Gebrauch gut schütteln") is a handling instruction, not a usage statement, and establishes no role. **Silence is `unknown`.** Multiple sentences may establish multiple roles; one sentence may establish more than one role if it states both.

**Ceiling: moderately high** — and it earns that ceiling *precisely because it is an E1 directions read, not an INCI inference*. If C1/C2 directions are unavailable, the value is `unknown`; it is never guessed from the formula. A role resting on a single sentence at the weaker end of C2 carries `low`–`moderate` confidence, recorded.

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
| `protein` | An identifiable **substantive** protein/silane film route (R2 = `candidate` or `tested`, §7.10) present as architecture, i.e. above the tail and more than ordinary conditioning |
| `moisture` | **Either** a coherent conditioning + humectant + emollient architecture (L1/L3/L4) is the material direction, with **no** protein-film route; **or** the humectant-led minimum below |
| `moisture` **(humectant-led minimum) [new in v0.2 — DL C9]** | A humectant leg (L4) present as architecture with **no** R2 route, even where the emollient and cationic legs are thin or absent. **Confidence `low`**, recorded, with the thin-architecture observation as a counter-signal |
| `balanced` | A **substantive mixed** protein-plus-moisture architecture: an R2 `candidate`/`tested` route **and** a material moisture leg, both above the tail. It is **not** an uncertainty bucket and not a label for an otherwise neutral product |
| `unknown` | Neither direction is materially readable — **including every silicone-led architecture** (see below) **[divergence: the conditioner vocabulary has no `unknown`; adding it here keeps the standard conservative under mixed evidence instead of forcing a guess. Adapter consequence is a Phase-5 decision]** |

**Silicone-led architectures are `unknown` [new in v0.2 — DL C9, BR §2.15].** `protein` is defined over L6/R2 and `moisture` over L1/L3/L4. **L2 — the silicone route — appears in neither**, and that is not an oversight to be interpolated away: `care_direction` is a *protein-versus-moisture* comparison vocabulary (§9's own constraint 1, and the reason SR §N.2 recommended against reusing the field at all). A product whose conditioning is led by dimethicone, dimethiconol, phenyl trimethicone or a silicone-quat film — with no R2 route and no material humectant/emollient leg — is **`unknown`**, not `moisture` and not `balanced`. Round 1 met three such products and both lanes struggled; the rule is now explicit. Record the silicone architecture in the trace so the `unknown` reads as a deliberate abstention rather than a missing analysis.

**How much moisture leg is enough.** v0.1 did not say whether `moisture` needs all three of L1/L3/L4 or any of them, and the lanes drew the line differently. **Any one leg present as architecture is sufficient**, subject to the confidence rules: L1+L3+L4 or L1+L3 ⇒ `moisture` at up to `moderate` confidence; a lone L4 humectant leg ⇒ `moisture` at `low` confidence (the humectant-led minimum row); nothing above the tail in any of the three ⇒ `unknown`.

**Three mandatory constraints (answering SR §N.2):**

1. **`care_direction` may not drive weight, persistence, hold, or heat matching.** WT, PERS and HOLD are the discriminating axes of this category; `care_direction` is a comparison and explanation axis only.
2. **Panthenol alone never sets `protein`** — it is a fibre-mechanics signal, not a surface-film route (§7.10, FS-24). Neither does a humectant name alone set `moisture`; a name is not a route, and the humectant-led minimum requires the leg **above the tail**, not a tail entry.
3. **Marketing direction never sets the value.** A product sold entirely on keratin repair whose only protein is a plain hydrolysate is `moisture` or `unknown` on its architecture, exactly as the formula reads (§7.10). Positioning is recorded as a counter-signal, never as a route.

**Gates.** G3 — `care_direction` shares M2 with R2 and PERS; it may not be presented as independent corroboration of either. G4 — formula-only calls stay E2.

---

## 10. The lean matching profile

Keep the detailed ontology in the research trace. The production model exposes only what recommendation and explanation need (HO §11, charter §G).

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "research_record_id": "<uuid>",

  "product_form": "aqueous_solution | emulsion | microemulsion | two_phase | unknown",
  "conditioning_level": "low | moderate | high | unknown",
  "weight_potential": "low | moderate | high | unknown",
  "persistence": "low | moderate | high | unknown",
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

Every field carries its own property-evidence object (§4). The research envelope wrapping this profile is `leave-in-research-envelope-v0.2` (five-part conditioner shape: `version, researchMethod, identity, formula, profile`; fail-closed validation), promoted to `leave-in-research-envelope-v1.0` when the standard locks. The envelope version tracks the standard version; the promotion-at-lock rule is unchanged from v0.1.

**`unknown` members added to four enums [new in v0.2 — DL defect register, BR §2.16].** `product_form`, `conditioning_level`, `weight_potential` and `persistence` were closed enums with no `unknown`, while FORM, COND, WT and PERS each carry an `unknown` state in §7 that the §K ceilings can genuinely produce. Round 1 had to emit `null` plus an `uncertain_fields` entry four times, which is an undeclared convention. The enums now carry `unknown` explicitly, so an honest abstention is representable rather than encoded as absence.

**`hold_support` deliberately gains no `unknown`.** The blind lane's register listed HOLD among the affected fields, but §7.7's ontology has only three states: HOLD is a *coarse presence read* — a fixative-class route is either absent, incidental, or meaningful — and `none` is the correct value for a formula in which no fixative-class polymer is visible. There is no §7 `unknown` to project, so adding one to the profile would create a state the standard cannot produce. The rule holds generally: **a profile enum gains `unknown` only where its §7 dimension can actually return `unknown`.**

Rules for the new members:

- `unknown` is emitted **only** when the §7 dimension resolved to `unknown`. It is never a rounding-down of a low-confidence value, and never a substitute for a value the anchors do reach.
- Every `unknown` also appears in `uncertain_fields` and carries its §4 evidence object explaining what was unresolvable.
- `unknown` never means "out of category". An excluded product emits **no lean profile at all** (§2.3.1).

**Adapter consequence — open, not decided here.** These five new enum members, together with `care_direction`'s existing `unknown`, must be handled by whatever adapter maps this profile onto production fields, and no production field is known to accept `unknown` today. **That is a Phase-5 adapter decision and this standard does not design it** — it is recorded as an open item in §17 alongside the `format`-enum and `heat_protection_max_c` reconciliation items. Nothing in v0.2 authorizes a production write (§19 stop condition).

**Fields deliberately absent.**

- **`heat_protection_max_c`** — removed (ruling 6, §13).
- **`dose_sensitivity`** — derived and stored in the trace, surfaced as a caution string, not a matching field (§7.11).
- **`climate_fit` / `layering_compatibility`** as confident labels — kept as specialist evidence states or `unknown` (HO §11 recommended simplification).
- **A separate fit label per marketing claim** — one primary focus, up to two secondary, plus specialist evidence states.

### 10.1 Projection rules

- `product_form` ← FORM architecture class; `unknown` → `unknown`. The marketing form word (Spray, Milk, Lotion, Cream, Mist) stays in `presentation_form` metadata **[divergence, §7.1]**. The `emulsion_subtype` (LGN / non-LGN) is **trace-only and not projected** (§7.1).
- `conditioning_level` ← COND (low→low, moderate→moderate, high→high, unknown→unknown).
- `weight_potential` ← WT; `unknown` → `unknown`. The multi-family `moderate` row projects as plain `moderate` — its mandatory counter-signal stays in the trace (§10.1.1). When a formula-only `high` is conflict-tagged, the exact-product intended finish materially contradicts it, and no finished-product evidence resolves the conflict, project `moderate`, mark the field uncertain, and preserve the higher trace result. Do not encode unresolved uncertainty as a restrictive `high` that silently removes fine hair from the fit prior.
- `persistence` ← PERS **mechanism class**, projected ordinally: `volatile_or_water_soluble` → `low`; `neutral_non_volatile` → `moderate`; `ph_dependent_cationic` → `moderate`; `permanent_cationic` → `high`; `unknown` → `unknown`. **This is a mechanism ordering, not a duration** (G11). The buildup caution travels with a `high` value. A `neutral_non_volatile` record carrying the monomeric-quat note (§7.6) still projects `moderate`; the note does not shift the projection.
- `hold_support` ← HOLD 3-state, unchanged and with **no** `unknown` member **[divergence, §7.7]**.
- `care_direction` ← §9.
- `usage_role` ← ROLE, E1 from C1/C2 directions (§7.13); `[]` with `usage_role` listed in `uncertain_fields` when authoritative directions are unavailable.
- `provides_heat_protection` ← §13 binary rule.
- `humidity_resistance` ← HUM 4-state, unchanged. A claim-free `formula_plausible` projects as the state and emits **no** user-facing string (§7.9).

### 10.1.1 What never leaves the research trace **[new in v0.2 — ruling R13]**

The trace and the profile are different objects with different jobs. The trace exists to make a value auditable and re-openable; the profile exists to be matched on. **Nothing in the following list is projected into any user-facing or matching field, in any form, including as a modified value:**

| Trace-only | Why it stops here |
|---|---|
| `counter_signals[]` — including every counter-signal made mandatory in §4 | A counter-signal explains why a value can be reopened. It is not a hedge and it must not shift, soften or annotate the projected value |
| `confidence` on any dimension | Confidence is a property of the *research read*, not of the product. The lean profile carries values, not confidence bands |
| `evidence_level`, `evidence_scope`, `threshold_reasoning[]`, `limitations[]`, `shared_mechanism_ids[]` | Audit machinery |
| `emulsion_subtype`, `tail_marker` and its rank, `quat_structure` | Reading conventions, not product properties |
| The §7 four-state HEAT detail | Projects only as the binary (§13.3); the states live in the trace |

**The two permitted exceptions, both already defined and both narrow:**

1. **`uncertain_fields[]`** carries the *fact* that a field is uncertain — a field name, never a confidence value or a rationale.
2. **The §18 caution strings** are emitted by named field values (WT `high`, DOSE `high`, PERS `high`, and so on), never by a confidence level or a counter-signal. No string may be added that says "we are unsure"; the standard's honest-uncertainty register is expressed by *field values* (`unknown`) and by the fixed string for an `unknown` field, not by leaking confidence.

**Why this rule exists (R13).** The v0.2 WT anchor deliberately pairs a value with a mandatory counter-signal. Without this rule, that pattern would tempt a downstream consumer to treat "moderate + counter-signal" as a fourth value somewhere between `moderate` and `high`, and the anchor would silently become un-calibratable. A projected value is exactly what its anchor says, or it is `unknown`.

### 10.2 Focus hierarchy and route anchors

1. **Exclude baseline conditioning from the hierarchy.** An ordinary conditioning architecture supports conditioning and slip; it does not automatically make `detangling` the distinctive purpose.
2. **Group evidence by shared mechanism (§6) before comparing endpoints.**
3. **Evaluate special-purpose routes first**, then fall back.
4. **Official positioning may corroborate but never creates a route.** Current catalog values never break a tie.
5. **Mark `primary_focus` uncertain** when two plausible purposes remain unresolved; use `general` when nothing clears its threshold.

**Selection rule [new in v0.2 — DL C6, BR §2.5/§2.6].** v0.1 stated principles and a table of anchors, and left the two to contradict each other: rule 1 said baseline conditioning does not make `detangling` distinctive while the anchor made `detangling` reachable by every capable emulsion; and nothing ranked two qualifying special-purpose routes against each other, so the same evidence produced mirror-flipped primary/secondary pairs across the lanes. The selection procedure is now explicit and runs in this order:

1. **Collect qualifying routes.** A route qualifies when it clears its anchor row below **and** rests on evidence distinct from baseline conditioning — that is, on an observation that is not simply the M1 lubrication deposit already counted in COND and SLIP.
2. **`primary` = the strongest qualifying route.** Strength is: a route with `tested`/exact-product evidence > a route with two or more independent endpoint-relevant formula observations > a route with one. Baseline conditioning is never a route.
3. **Rank order when two routes tie on strength:** `repair` > `smoothing` > `curl_definition` > `heat_styling` > `detangling` > `volume_lightness` > `shine`. **Repair outranks smoothing only when a dedicated repair route exists** — R2 ∈ {`candidate`, `tested`}, or protein/silane actives in the product's marketing position (named on pack or on the C1/C2 page as what the product is *for*). Without a dedicated repair route, `smoothing` wins and `repair` is not available at all.
4. **Positioning breaks a remaining tie, and only a remaining tie.** It never creates or upgrades a route (rule 4 above).
5. **No qualifying route ⇒ `general`.** Two qualifying routes that remain genuinely unresolved after steps 2–4 ⇒ take the rank order and **mark `primary` uncertain**.

**Secondary focus [new in v0.2 — DL C6].** At most **two**, and each requires **independent support at `moderate` or better** — i.e. its own endpoint-relevant observation, not a restatement of the primary's mechanism (G3). A route that qualified only through the primary's evidence is not a secondary focus; it is the primary focus described twice. `general` is never a secondary value.

| Focus | Route anchor |
|---|---|
| `volume_lightness` | WT `low` **and** no persistent film route. **Never from FORM alone** (G9, FS-2) |
| `detangling` | **Either** detangling-led C1/C2 positioning (the product is sold as a detangler / „Leichtkämmspray" / „Entwirrungsspray") with SLIP ≥ `moderate`; **or** a slip-dominant light architecture — SLIP ≥ `moderate` with COND ≤ `moderate` and WT `low` — i.e. slip is the product's whole point rather than a by-product of a rich conditioning load. **SLIP `high` alone never sets it**, because every capable emulsion reaches it |
| `smoothing` | SFR `high` — a continuous alignment/film route beyond baseline conditioning **[divergence: HO §11's `smoothing_frizz` is renamed `smoothing`; a label naming frizz would smuggle the unsupported humidity claim that §7.4 exists to prevent]** |
| `curl_definition` | HOLD ∈ {`incidental_film`, `meaningful_hold_route`} **present as architecture (§3.1.1)** **plus** compatible COND/WT (§8.2). A fixative polymer **at or below the tail marker** does not set it. Curl positioning corroborates only. Never from conditioning alone or heavy oil alone |
| `heat_styling` | HEAT ≥ `claim_only` under C1/C2 claim authority (§2.4.1) **and** ROLE includes `heat_styling` with its direction sentence (§7.13). Sets a *use context*, never a protection level (§13) |
| `repair` | **R2 ∈ {`candidate`, `tested`}** (§7.10), **or** protein/silane actives in the product's C1/C2 marketing position. Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or generic repair naming cannot set it |
| `shine` | A distinct gloss route or exact-product goniophotometry. **Not added when it merely restates the smoothing film** (§8.1, G3) |
| `general` | A capable conventional leave-in where no route clears its threshold |

**The `repair` row no longer contradicts §7.10 [new in v0.2 — DL defect register, BR §2.5].** v0.1's row qualified on "R2 `candidate`" while excluding "cationic polymer" in the same sentence, and §7.10 *defined* `candidate` partly as a high-charge cationic polymer — the row's condition and its own exclusion overlapped. The contradiction is removed at the source: §7.10 no longer admits non-silicone cationic polymers, so the exclusion clause and the qualifying condition are now disjoint. What remains excluded is exactly what it says: generic materials and naming.

**R3 no longer sets `repair` primary [new in v0.2 — DL C6, ruling R14].** v0.1 allowed `repair` on `R3 = chemistry_candidate` with its review flag open. That would let a product's primary user-facing purpose be set by a bond claim whose salon evidence G8 bars and whose chemistry independent spectroscopy failed to confirm (§8.3). Consistent with R14's damage-fit ruling that an R3 flag alone never qualifies a product for the highly-damaged tier: **`R3 = chemistry_candidate` alone may never set `repair` as primary**, and may support `repair` as a *secondary* focus only where the review flag is open, an independent moderate+ observation exists, and the record routes to human review (§14). R3 keeps its flag and its review route; it loses its focus-setting power.

A secondary focus may add a distinct user endpoint even when it shares part of a mechanism, but it must add useful matching information and clear the independent-moderate+ bar above.

### 10.3 Fit priors

These are **broad product priors**, not universal exclusions and not efficacy claims. Final recommendations still combine product behaviour with the user's damage, thickness, texture, routine, dosage, desired finish and scalp context.

**`hair_thickness_fit` — weight-led** (`derived_from: [weight_potential, product_form]`):

| `weight_potential` | fine | medium | coarse |
|---|---|---|---|
| `low` | recommended | recommended | conditional |
| `moderate` | conditional | recommended | recommended |
| `high` | caution | conditional | recommended |
| `unknown` | unknown | unknown | unknown |

DOSE does **not** additionally modify this table (G3, §7.11); a `high` DOSE emits a dosing caution instead. Every fine-hair value carries the §7.5 judgment-call limitation.

**The `unknown` row is a consequence of the enum change, not a new prior [v0.2].** `weight_potential` can now be `unknown` (§10), so every weight-led table needs a row for it; the same completion is made in `damage_fit` and as `texture_fit` row 5. It states only that a weight-led prior cannot be formed without a weight value.

**`damage_fit` — two independent paths to the highly-damaged tier** (`derived_from: [conditioning_level, repair_surface_film, bond_flag, product_evidence]`):

| Row | Condition | healthy | moderately_damaged | highly_damaged |
|---|---|---|---|---|
| 1 | `conditioning_level = low` **and** no qualifying repair route | recommended | conditional | caution |
| 2 | `conditioning_level ∈ {moderate, high}` with no qualifying repair route | recommended | recommended | conditional |
| 3a | **Conditioning path:** `conditioning_level = high` **plus** a qualifying specialist route (below) | conditional | recommended | recommended |
| 3b | **Repair-film path [new in v0.2 — ruling R14]:** **R2 ∈ {`candidate`, `tested`}**, at any `conditioning_level ≥ moderate` | conditional | recommended | recommended |
| — | `conditioning_level = unknown` | unknown | unknown | unknown |

**The repair-film path (R14).** v0.1 gated the third row on `conditioning_level = high`, and COND `high` was itself gated on an LGN pair — so a specialist leave-in built for highly damaged hair on a silicone/silane architecture could not reach the tier written for exactly that product. Nick's ruling opens a **second, independent path**: a genuine repair-film route — R2 `candidate` or better under the narrowed §7.10 list — qualifies a product for the highly-damaged tier **alongside** the high-conditioning path, without needing COND `high`.

**What an R3 bond flag does — and does not — do (R14).** `R3 = chemistry_candidate` **never** qualifies a product for the highly-damaged tier on its own. It opens a review flag (§8.3), it is recorded, and it is invisible to this table. A product with an R3 flag and no R2 route sits in row 1 or row 2 on its conditioning level like any other product. The same ruling governs the `repair` focus (§10.2).

**Qualifying specialist route (row 3a)** means a distinct L6 substantive film route, or a relevant exact-product test meeting §3.2. Generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer or repair naming alone does **not** qualify — for either path.

**`texture_fit` — weight-led, slip as the row-3 modifier, exhaustive** (`derived_from: [weight_potential, slip_combability_potential, hold_route_state]`):

| Row | Architecture | straight | wavy | curly | coily |
|---|---|---|---|---|---|
| 1 | `weight_potential = low` (light dry-down) | recommended | recommended | conditional | caution |
| 2 | `weight_potential = moderate`, any slip | recommended | recommended | recommended | conditional |
| 3 | `weight_potential = high` **and** SLIP `high` | conditional | recommended | recommended | recommended |
| 4 | `weight_potential = high` **and** SLIP ∈ {`moderate`, `low`} | conditional | conditional | conditional | conditional |
| 5 | **Fallback:** any combination not matched above, including `weight_potential = unknown` or SLIP `unknown` | unknown | unknown | unknown | unknown |

**The completed matrix [new in v0.2 — DL C8, BR §2.7].** v0.1's three rows had no entry for **high weight with moderate or low slip**, and left unstated whether the rows were weight-led with slip as a modifier. Round 1 produced a clean four-cell disagreement on exactly that hole. The table is now exhaustive by construction: rows are **weight-led**, slip modifies only within the high-weight band, and **row 5 is an explicit `unknown` fallback** so no combination falls through to interpolation. Row 4's uniform `conditional` reflects the honest position — a heavy product without high slip is neither recommendable nor excludable for any texture from formula alone — and every row-4 cell carries the §7.5 fine-hair judgment-call limitation and an `uncertain_fields` entry.

`HOLD = meaningful_hold_route` does not by itself raise curly/coily — it first triggers the G0 styling review. Curl branding alone never determines the result.

### 10.3.1 `scalp_application_fit` **[rewritten in v0.2 — DL C7, BR §2.18]**

Derived from **directions plus EXPO**, never from an ingredient read (`derived_from: [directions, fragrance_scalp_exposure]`). v0.1 gave only a default sentence; round 1 saw one lane invent a default and the other vary across five products. The value is now decided by an ordered test:

| Value | Condition |
|---|---|
| `unknown` | **The default.** C1/C2 directions are silent about placement, or absent entirely (§2.4), and no `avoid` trigger fires |
| `avoid` | **Either** a heavy-occlusive or oil-led architecture — WT `high` with a rich/low-spreading band member present as architecture, or an oil-led two-phase load; **or** an EXPO-flagged irritant load: `aromatic_or_allergen_exposure`, or `fragrance_declared` combined with a materially present `Alcohol Denat.`/`Alcohol` note; **or** directions that explicitly say to avoid the roots or scalp |
| `conditional` | Directions state a **placement that is not the scalp** („in die Längen und Spitzen", "mid-lengths and ends") **and** no `avoid` trigger fires. The product is not scalp-directed; nothing is asserted about tolerance |
| `suitable_if_evidenced` | Directions **explicitly direct the product at the scalp or roots** (C1/C2 source), **and** EXPO is clean — `no_listed_fragrance_signal` or `fragrance_declared` with no allergen block and no material alcohol note |

**Ordering.** Test `avoid` first: an `avoid` trigger beats a directions-based positive value. Then the explicit scalp direction (`suitable_if_evidenced`), then the non-scalp placement (`conditional`), then `unknown`.

**Hard limits.**

- **Positive values require directions, never a formula read.** `suitable_if_evidenced` means the manufacturer directs the product at the scalp and the exposure flags are clean — nothing more. It is not a tolerance prediction: **sensitive-scalp tolerance is not derivable from an INCI list** (§7.12, SR §M.12).
- **G6 applies to every value.** No diagnosis, no treatment framing, no hair-loss lifecycle, no inflammation or infection suitability. Cosmetic guidance stays separated from medically adjacent scalp or hair-loss guidance.
- A direction stating placement **without mentioning the scalp** is a `conditional`, not an `avoid` and not a positive — v0.1 had no rule for this and it was one of the divergence sources.

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
| **G1** | **Identity, formula and directions.** Capture the §2.4 set, follow the canonical source hierarchy, preserve conflicts, and complete a provisional profile from the best available exact-market evidence. **Directions-of-use must be captured verbatim and verified, not assumed (v0.2, R11):** an explicit rinse instruction sets `excluded_other_form` at G0 before any formula analysis, and absent directions are a documented gap that forces `usage_role` and `scalp_application_fit` to `unknown` (§2.4) |
| **G2** | **Evidence firewall (chain).** Formula observation → direct product property → user-fit decision. No shortcuts, no naked suitability labels |
| **G3** | **Anti-double-counting.** One shared mechanism counts once unless endpoint-specific evidence separates it. Includes the persistence/buildup rule and the shine rule (§6) |
| **G4** | **Evidence cap.** Formula-only ≤ E2; claim-only E0. No exact concentration, pH, MW, droplet size, viscosity grade or deposited amount from an INCI list |
| **G5** | **Conflict.** Preserve source conflicts and lower the **smallest** affected scope; do not blank the record |
| **G6** | **Medical.** No diagnosis, treatment, hair-loss lifecycle, inflammation, infection or structural-regeneration suitability. Cosmetic guidance stays separate from medically adjacent scalp/hair-loss guidance |
| **G7** | **Review freshness.** Per-field unsalted SHA-256 fingerprints over the canonical field evidence/value payload, plus a versioned whole-profile fingerprint binding the lean profile and `category_standard_version`. Equality preserves approval; changed content reopens the field |
| **G8** | **Exposure-regime firewall [leave-in-specific].** Rinse-out, shampoo, pre-wash-oil and in-salon evidence enters **only at E2, as mechanism** — never as product evidence and never as an upgrade path (§3.3) |
| **G9** | **Form is not weight [leave-in-specific].** FORM may never set WT, **in either direction (v0.2)**. "Spray ⇒ light", "cream ⇒ heavy", "clear ⇒ light" and "no emulsifier ⇒ no lipid load" are hard failures, not notes; and `FORM = unknown` never forces `WT = unknown`. G9 governs wherever a §7 clause reads WT off the form label — the v0.1 two-phase/microemulsion and "Form or …" clauses are removed on this basis (§7.1, §7.5) |
| **G10** | **Heat strictness [leave-in-specific].** `formula_plausible` requires a member of the closed L9 list. Generic silicone/protein/panthenol/oil stops at `claim_only`. Never grade efficacy; never use a °C figure as a protection level (§13) |
| **G11** | **No quantitative persistence [leave-in-specific].** No durations, wash counts, applications-to-buildup, clarification schedules, or the circulating untraceable removal percentages (§7.6) |
| **G12** | **Regulatory durability [leave-in-specific].** Rules key on **function** ("a volatile carrier is present") with the INCI family enumerated — never on the presence of a specific cyclosiloxane (§15, FS-21) |
| **G13** | **Claim authority [new in v0.2, ruling R12].** A marketing claim exists only if the current German pack or the manufacturer's German/EU page states it. Retailer copy never creates a claim; it may only corroborate. Applies to HEAT, HUM, the `heat_styling` focus, ROLE directions sourcing and every „… ist ausgelobt" string. No C1/C2 source ⇒ the claim does not exist and the record routes to review (§2.4.1) |
| **G14** | **Trace containment [new in v0.2, ruling R13].** Counter-signals, confidence, evidence levels and reading conventions are research-trace artifacts. They are never projected into a matching or user-facing field, and never modify a projected value. A projected value is exactly what its anchor says, or it is `unknown` (§10.1.1) |

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

Throughout this ladder, **"claims" means a C1/C2 claim under §2.4.1 (G13)**: the current German pack or the manufacturer's German/EU page. Retailer copy is recorded but never creates the claim.

| Formula situation | Highest defensible state |
|---|---|
| No C1/C2 heat claim and no L9 member | `not_claimed` |
| **No C1/C2 heat claim, L9 member present (v0.2)** | `not_claimed`, with the L9 observation recorded in the trace. **A formula does not manufacture a claim** — this closes the v0.1 hole where an unclaiming product could reach `formula_plausible` while its binary stayed `false` |
| **L9 member present only at or below the tail marker (§3.1.1) (v0.2)** | No state upgrade. A tail-position hydrolysate or polymer is not "a plausible film-forming context"; record and stop |
| No relevant polymer; the product carries a C1/C2 heat claim | `claim_only` |
| Generic silicone / generic protein / panthenol / oil only, with a claim | `claim_only` — **not** `formula_plausible` |
| A member of the **closed L9 list**, **above the tail**, in a plausible film-forming context, **with a C1/C2 claim** | `formula_plausible`, E2, **low** confidence |
| The exact finished product tested (DSC, breakage-after-ironing, or tryptophan loss) with a stated protocol meeting §3.2 | `product_tested`, E3+ |
| A **system-level** C1/C2 claim ("… as a system of shampoo, conditioner and treatment") | The state the product's own evidence supports, usually `claim_only`, tagged `claim_scope: system_level`; the binary follows §13.3 unchanged and the record routes to review. Scope handling is an open item (§2.4.1 rule 4, §17.13) |

### 13.3 The production projection (ruling 6)

The production model carries **one binary field: `provides_heat_protection`.** The four-state evidence detail lives in the research trace only.

**Claim-led with a formula sanity-check.**

1. The **claim leads**: if the exact product carries a **C1/C2** heat-protection claim (§2.4.1, G13), `provides_heat_protection = true` is the normal outcome. This is a recommendation-policy decision, not an efficacy statement — the app is reporting what the product is sold as, and the claim's EU legality means a dossier exists, not that a test does (§3.3). **Retailer-only copy is not a claim and sets `false`** — with the retailer text recorded and the record routed to review under `claim_authority_gap`, so a missed manufacturer source is caught by a human rather than by a guess.
2. The **formula sanity-check runs anyway**: compare the claim against the closed L9 list.
   - Claim present **and** an L9 member present **above the tail** → `true`, trace state `formula_plausible`.
   - Claim present, L9 member present **only at or below the tail marker** → `true`, trace state `claim_only`, and route to review. The tail-position member is recorded but earns no upgrade (§5 L9 tail-member rule).
   - Claim present, **no** L9 member → `true`, trace state `claim_only`, **and route the record to human review** with a "claim looks formula-unsupported" note. Review decides; the standard does not silently drop the claim.
   - **No claim, L9 member present → `false`, trace state `not_claimed`**, with the L9 observation recorded in the trace. A formula does not manufacture a claim, and in v0.2 the trace state and the binary can no longer point in opposite directions here.
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

**Added in v0.2:**

- **`claim_authority_gap`** — a heat or humidity claim found only in retailer copy, with no C1/C2 source located (§2.4.1). The review decides whether the manufacturer source was simply not found;
- **a system-level claim** carried into a product-level field (`claim_scope: system_level`, §2.4.1 rule 4);
- **missing directions capture** — `directions_capture: missing` after the G1 search (§2.4, R11);
- **`quat_structure: unresolved`** — a declared quat whose polymeric-vs-monomeric structure the INCI name does not settle (§7.6);
- **`tail_marker: none_visible`** on a record whose anchors depended on the tail boundary (§3.1.1);
- **an R3 `chemistry_candidate` carried as a secondary `repair` focus** (§10.2);
- **a `texture_fit` row-4 or row-5 record** (high weight without high slip, or a fallback `unknown`), because those cells state that formula alone cannot decide (§10.3);
- **`scalp_application_fit = suitable_if_evidenced`** — every positive scalp value, without exception (§10.3.1, G6).

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

## 17. Open evidence gaps — must stay open in v0.2

None of these may be closed by inference. Each is recorded here so a record that touches it inherits the limitation (SR §M). Items 13–17 are new in v0.2; they are gaps the calibration exposed, not gaps the calibration created.

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
13. **System-level claims and product-level fields.** Whether a manufacturer claim explicitly conditioned on using a product *as a system* should set that product's own production binary is a product-policy question. v0.2 records the claim, tags its scope, applies the claim-led binary unchanged and routes to review; it does not decide the policy (§2.4.1 rule 4, §13.2). **Open adjudication item.**
14. **The tail-marker heuristic is unvalidated.** §3.1.1's capped-preservative-rank convention is adopted so two reviewers reach the same answer. No published method validates it against measured concentrations, and it is decisive on several anchors. It is a reading convention, never a measurement, and every record that leans on it says so.
15. **Spreading-band membership for unenumerated liquid vegetable oils.** §7.5 reads them in the medium band by convention. No spreading-value measurement supports member-by-member placement for sunflower, soy, argan, apricot kernel, macadamia, safflower or canola; SR §D.1 supports the *organising variable*, not a per-oil table. Do not extend the L3 band table on the strength of this convention.
16. **Whether wet/dry SLIP bias is readable at all.** §7.3's bias qualifier had no matching value for a non-film persistent lipid load or for a monomeric-quat-only architecture, and round 1 returned `unknown` four times. The bias qualifier is the weaker half of the WET+DRY merge and inherits open gap 5. **Not repaired in v0.2** — it is not on the round-1 fix list, and repairing it would be an untraced rule change.
17. **Lean-profile `unknown` and the production adapter.** §10 now carries `unknown` in five enums (the four added in v0.2 plus `care_direction`), and `usage_role` can project as `[]`. No production field is known to accept either. The adapter mapping is a Phase-5 decision this standard does not design (§10, §10.4).

**Three carried-open assumptions from the charter**, listed so they are not mistaken for settled: the DB `format` enum reconciliation, the projection of the four-state heat evidence onto existing production fields, and the blind-reviewer identity. All three are later-phase decisions.

**Carried-open from round 1**, listed so the fix list and the fork list are not confused with each other: the gold-set slot vacated by the rinse-out exclusion and its proposed replacement are a Nick decision, not a standard change (DL C1).

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
| R2 = `candidate`, cationised-protein or silane route | „Enthält einen Protein-Baustein, der sich als Film aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur." |
| R2 = `candidate`, silicone-quat route | „Enthält ein Silikon-Quat, das als Film auf dem Haar bleibt. Das ist Pflege an der Oberfläche, keine Reparatur." |
| HOLD = `meaningful_hold_route` | „Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege." |
| EXPO = `no_listed_fragrance_signal` | „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen." |
| EXPO = `fragrance_declared` | „Enthält deklarierte Duftstoffe." |
| EXPO alcohol note | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |
| Any `unknown` field | „Dazu haben wir keine belastbare Information." |
| G6 medical boundary | „Bei Juckreiz, Rötung, Schuppung oder Haarausfall bitte ärztlich abklären lassen – das ist keine kosmetische Frage." |

**Register rules.** State the mechanism, then the limit. Never promise a durability, a temperature or a wash count. Prefer „kann" over „wirkt". An explicit unknown always beats a confident guess.

**Added in v0.2.**

- **The R2 string is split by route.** v0.1 emitted „Protein-Film" for every R2 `candidate`, including silicone-quat routes, where it is simply wrong — the film is a silicone quat, not a protein (DL defect register). Each route now has its own string and neither is used for the other.
- **A claim-free HUM `formula_plausible` emits nothing** (§7.9). It is a trace observation, not a benefit, and no string may be added that presents it as one.
- **„… ist ausgelobt" strings require C1/C2 claim authority** (§2.4.1, G13). The word „ausgelobt" asserts that the manufacturer makes the claim; retailer copy may never trigger it.
- **No string may express confidence or a counter-signal** (§10.1.1, G14). Uncertainty reaches the user as an `unknown` field value and its fixed string, never as a hedge appended to a value.

---

## 19. Calibration status

### 19.1 Round 1 — completed under v0.1 (2026-09-03)

Round 1 ran the planned two-lane design on a 13-product gold set: a reference key lane and a sealed blind lane, each classifying from the same locked formula/directions packets, with the blind lane holding no key. Headline result:

- **363 fields compared, 86.2 % exact agreement, 50 substantive disagreements.**
- **Both designed boundary cases produced identical G0 exclusions** — the boundary rule generalises, which was the single most important thing to establish.
- **The disagreement mass sat on standard defects, not on erratic judgment.** Ten clusters (C1–C10) plus a consolidated defect register account for nearly all of it, and both lanes independently flagged several of the same holes.

What that means for this document: round 1 measured **the repeatability of the rules**, which is the only thing a calibration lane can measure. It did not establish that any value is correct. v0.2 is the repair pass — every cluster in the disagreement log has a rule change in §21, and none of those changes is a post-hoc adjustment to make two lanes agree on a *product*.

### 19.2 Round 2 — required, not yet run

**Nothing in v0.2 has been tested for repeatability.** Round 2 must re-run **both lanes** on the fields the v0.2 changes touch, under the same seal discipline, before any v0.2 repeatability claim is made:

- FORM and every field that inherited a FORM `unknown` (§7.1);
- WT and its DOSE / `weight_potential` / fit-cell dependents (§7.5);
- PERS and both `persistence` projections (§7.6);
- HEAT and HUM under claim authority (§2.4.1, §7.9, §13);
- `focus.primary` / `focus.secondary` (§10.2);
- `care_direction`, `texture_fit`, `damage_fit`, `scalp_application_fit` (§9, §10.3, §10.3.1);
- ROLE, re-captured from C1/C2 directions (§7.13).

**A material rule change forces a full re-run** — that rule is unchanged and it binds v0.2. Round-1 values are superseded, not carried forward: a field whose rule changed must be re-derived, never re-labelled.

Nick's adjudication of the round-1 forks (§21, R11–R14) is applied in this document. The remaining round-1 outputs — the vacated gold-set slot and its replacement, and the spot-review of evidence chains — are decisions outside this standard (§17).

### 19.3 The lane design, for the record

The planned lane, retained here because round 2 reuses it:

- 12 archetypes per HO §13, selected for **best archetype coverage regardless of catalog presence** (ruling 3), with exact identity, GTIN and current formula verified before classification, and the final 12 presented to Nick before any product is classified (ruling 8).
- 3–5 adversarial stress products: a lightweight-branded product with persistent film formers; a heat claim resting on generic silicone/protein only; a hold-driven "curl cream"; a 10-in-1 whose claims rest on one or two shared mechanisms; a GTIN/formula-conflict case.
- **Blind lane (ruling 2):** a clean reviewer receives this standard and the locked formula/directions packets but **not** the proposed key. Disagreements are coded by cause — source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, legitimate uncertainty, exposure-regime error. Nick adjudicates. Systematic disagreement becomes an explicit gate, cap or anchor; product-specific uncertainty stays uncertainty.
- A material rule change forces a full re-run. Reviewer agreement measures repeatability of the rules, not truth.

**Stop condition for v0.2.** Unchanged from v0.1 and restated because v0.2 now carries production-shaped fields with new enum members: this document produces **research artifacts only**. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes on its authority. The `unknown` enum members added in §10 are a research-record shape, not an adapter contract (§17.17).

---

## 20. Source anchors

This standard adds no science of its own. Every claim above traces to:

- `plans/leave-in-inci/research/leave-on-science-review.md` — the evidence base, including its full source register (§O: Tier 1 peer-reviewed/primary, Tier 2 regulatory, Tier 3 trade education, and the explicitly rejected sources). The named primary anchors relied on here are Zhou et al. 2011; McMullen & Jachowicz 1998; Rele & Mohile 2003; Marsh et al. 2026; the 2020 *Int J Biol Macromol* Michael-acceptor study; the 2013 *Colloids Surf A* streaming-potential study; the 2025 *Adv Colloid Interface Sci* LGN review; the 2012 *Colloids Surf B* emollient-spreading study; the 2018 consumer-combing study; Robbins 5th ed.; and the Manchester HHCR/DHCR work.
- `plans/leave-in-inci/handover/01_Leave_In_Category_Development_Handover_v1.0.txt` — category mission, boundary, user jobs, candidate ontology, lean profile, evidence requirements, calibration plan and system boundary.
- `plans/leave-in-inci/first-output-charter-draft.md` — Nick's confirmed rulings 1–8 and the decision-coverage record.
- `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md` — structural template only (gates, evidence scale, evidence object, anti-double-counting discipline). Its score rules and rinse-out science do not transfer.

**Regulatory:** Commission Regulation (EU) 2024/1328 (REACH Annex XVII entry 70; D4/D5/D6; leave-on 0.1 % from 6 June 2027) · Commission Regulation (EU) No 655/2013 and the 2017 Commission technical document on cosmetic claims.

**Added in v0.2 — calibration provenance (rule sources, not science sources):**

- `plans/leave-in-inci/research/gold-set/agreement/disagreement-log.md` — the round-1 disagreement log, clusters C1–C10, the singles, and the consolidated standard-defect register (**DL**).
- `plans/leave-in-inci/research/gold-set/agreement/agreement-diff.md` — the 363-field diff behind the 86.2 % figure.
- `plans/leave-in-inci/research/gold-set/blind/blind-review-notes.md` — the sealed blind lane's per-product notes, its §2 ambiguity register and its §3 record of invented method choices (**BR**).
- `docs/research/leave-in-inci/v1.0/rule-changes.md` — the append-style rule ledger; one entry per v0.2 change with its motivating disagreement.

These are **rule provenance only.** They contain no science, and nothing in them may be cited as evidence for a product property.

---

## 21. Change log — v0.1 → v0.2

**Nick's adjudication rulings applied in this version.** These override any conflicting text elsewhere in the document.

| Ruling | Substance | Landed in |
|---|---|---|
| **R11** | Formula freeze / G1 must capture **and verify** directions-of-use, not just INCI | §2.4 mandatory directions capture, G1 |
| **R12** | A marketing claim exists only if the manufacturer's German/EU page or the current German pack states it; retailer copy never creates a claim, only corroborates. General claim-authority rule | §2.4.1, G13, §7.8, §7.9, §7.13, §13, §18 |
| **R13** | The "≥2 persistent non-volatile families, none rich-band" WT anchor is **`moderate`** with a **mandatory** counter-signal; counter-signals and confidence are research-trace only and never project | §7.5 multi-family row, §4, §10.1.1, G14 |
| **R14** | A genuine repair-film route (R2 `candidate`+) qualifies a product for the highly-damaged tier alongside the high-conditioning path; an R3 bond flag alone never does | §10.3 damage_fit row 3b, §10.2 repair focus |

**Rule changes, by motivating disagreement.**

| # | Change | Motivated by | Section |
|---|---|---|---|
| 1 | G1 directions capture made mandatory and verified; explicit rinse instruction excludes at G0 before formula analysis | DL C1 (a leave-in-freezed product was in fact rinse-out), R11 | §2.4, G1 |
| 2 | Claim-authority hierarchy C1–C5 introduced; retailer copy cannot create a claim | DL C5, BR §2.9, R12 | §2.4.1, G13 |
| 3 | FORM solution anchor: cationic-species requirement dropped | DL C2 | §7.1 |
| 4 | FORM: non-LGN emulsion sub-type added (nonionic / polymeric / silicone emulsifier systems) | DL C2, BR §2.12 | §7.1 |
| 5 | FORM: `two_phase` decidable from architecture (unemulsified oil + water); shake direction demoted to corroboration | DL C2, BR §2.12 | §7.1 |
| 6 | FORM: solution ↔ microemulsion threshold defined (solubiliser package + real oil/silicone load ⇒ microemulsion); clarity is corroboration only | DL C2, BR §2.12 | §7.1 |
| 7 | FORM decision order stated; `emulsion_subtype` kept trace-only | DL C2 | §7.1, §10.1 |
| 8 | §7.5's two-phase/microemulsion `high` clause and the "Form or …" `unknown` clause **removed**; G9 governs in both directions | DL defect register, BR §2.3 | §7.5, G9 |
| 9 | WT multi-family `moderate` row added, with mandatory counter-signal; DOSE follows it | DL C3, BR §2.1, R13 | §7.5, §7.11 |
| 10 | Rich-band membership fixed as a closed enumeration; unenumerated liquid vegetable oils read medium-band | BR §2.1 | §7.5, §17.15 |
| 11 | PERS `permanent_cationic` redefined as polymeric or silicone-functional quats, enumerated by INCI name; charge-density inference removed as G4-barred | DL C4, BR §2.11 | §7.6 |
| 12 | Monomeric long-chain quats placed in `neutral_non_volatile` with a required note; unresolvable quats routed to review | DL C4, BR §2.11 | §7.6 |
| 13 | "Present as architecture" / "above the tail" operationalised as the capped-preservative-rank heuristic, with mandatory limits and an explicit heuristic label | DL defect register, BR §2.2 | §3.1.1 |
| 14 | HUM: `formula_plausible` decided **claim-not-required**, with the decision and its two safety constraints documented; confidence capped at `low` | DL defect register, BR §2.4a | §7.9 |
| 15 | HUM: "dominant" vs "any humectant lowers it" resolved into a two-step rule; glycol-as-solvent reading recorded, conservative default | BR §2.4b, §2.18 | §7.9 |
| 16 | R2 `candidate` narrowed to cationised protein / silane / silicone quat; non-silicone cationic polymers and peptides removed | DL singles, DL defect register, BR §2.5 | §7.10, §5 L6 |
| 17 | R2 `none_visible` covers a plain hydrolysate **at any position**, with a mandatory trace note | DL singles, BR §2.18 | §7.10 |
| 18 | L9 tail-member rule: an evidenced polymer at or below the tail earns no upgrade; an L9 member without a C1/C2 claim earns no upgrade and the binary stays `false` | DL defect register, BR §2.13 | §5 L9, §13.2, §13.3 |
| 19 | Focus selection procedure defined: qualifying routes, strength ordering, rank tie-break, positioning last | DL C6, BR §2.6 | §10.2 |
| 20 | `detangling` anchor rewritten — detangling-led positioning **or** a slip-dominant light architecture; SLIP `high` alone no longer sets it | DL C6, BR §2.6 | §10.2 |
| 21 | `repair` outranks `smoothing` only with a dedicated repair route; §10.2 repair row / §7.10 contradiction removed at source; R3 alone can no longer set `repair` primary | DL C6, DL defect register, BR §2.5, R14 | §10.2 |
| 22 | Secondary focus capped at 2 and gated on independent moderate+ support | DL C6 | §10.2 |
| 23 | `curl_definition` requires the fixative route **above the tail** — a trace polymer no longer makes every conditioner a curl product | DL C6, BR (slot-level finding) | §10.2 |
| 24 | `scalp_application_fit` fully specified: default `unknown`; `avoid` for heavy-occlusive/oil-led or EXPO-flagged irritant load; positives require explicit scalp-directed C1/C2 directions **and** clean EXPO; placement-without-scalp is `conditional` | DL C7, BR §2.18 | §10.3.1 |
| 25 | `texture_fit` matrix completed: weight-led rows, high-weight/non-high-slip row added, explicit `unknown` fallback row; `hair_thickness_fit` and `damage_fit` given matching `unknown` rows as a consequence of the enum change | DL C8, BR §2.7 (+ change 30) | §10.3 |
| 26 | `damage_fit` gains the independent repair-film path to the highly-damaged tier; R3 explicitly excluded from the table | DL defect register (fork 4), BR §2.8, R14 | §10.3 |
| 27 | `care_direction`: silicone-led architectures → `unknown`; humectant-led with no protein route → `moisture` at `low` confidence; "how much moisture leg" defined; marketing direction never sets the value | DL C9, BR §2.15 | §9 |
| 28 | ROLE: values only from C1/C2 directions, one verbatim direction sentence required per value, per-role sentence table added, shake instruction explicitly establishes nothing | DL C10, R12 | §7.13 |
| 29 | Excluded-product emission contract defined — identity + G0 + optional informational dimensions, **no lean profile** | DL defect register, BR §2.17 | §2.3.1 |
| 30 | `unknown` added to `product_form`, `conditioning_level`, `weight_potential`, `persistence`; **`hold_support` deliberately excluded** (§7.7 has no `unknown` state to project); adapter consequence recorded as an open item, adapter **not** designed | DL defect register, BR §2.16 | §10, §17.17 |
| 31 | Trace containment rule: counter-signals, confidence and reading conventions never project; two narrow exceptions named | R13 | §10.1.1, G14 |
| 32 | §18 R2 German copy split by route — „Protein-Film" no longer used for a silicone-quat film | DL defect register | §18 |
| 33 | DOSE rows corrected: water counts as a dominant carrier for `low`; `FORM = unknown` no longer forces `unknown` | BR §2.18 | §7.11 |
| 34 | Mandatory-counter-signal register added to the property-evidence object | R13 | §4 |
| 35 | Gates G13 (claim authority) and G14 (trace containment) added; G1 and G9 restated | R11, R12, R13 | §11 |
| 36 | Human-review triggers extended by eight v0.2 conditions | DL C5/C7/C10, BR §2.7/§2.9 | §14 |
| 37 | §19 rewritten from "no calibration has run" to round-1 result plus the round-2 re-run requirement | DL verdict | §19 |
| 38 | Open gaps 13–17 added; version stamps and envelope bumped to v0.2 | DL defect register, BR §2.2/§2.14/§2.16 | §17, header, §10 |

**Deliberately not changed in v0.2** — flagged in the blind lane's register but **outside the round-1 fix list**, so changing them would be an untraced rule change:

| Item | Blind register | Why it stands |
|---|---|---|
| COND `high` gated on an LGN pair, capping silicone-led products at `moderate` | BR §2.10 | Not on the fix list. It is a real ontology question with a product consequence (it moves `conditioning_level` and `damage_fit`), so it belongs in a Nick fork, not in a repair pass. **R14's repair-film path removes its worst consequence** — a specialist repair product no longer needs COND `high` to reach the highly-damaged tier |
| SLIP bias qualifier unusable for non-film lipid loads and monomeric-quat architectures | BR §2.14 | Not on the fix list; the WET+DRY merge is already flagged provisional and its resolution needs the open evidence question in §17.5. Recorded as open gap §17.16 |
| The COND `low` / SLIP `moderate` contradiction on a single short-chain quat observation | BR (slot 11 finding) | Not on the fix list, and not resolvable without deciding whether a monomeric quat is "a route" — the same question C4 answers for PERS but was not asked to answer for COND. Recorded here so round 2 can measure whether it still bites |
| L3 band table extension for unenumerated oils | BR §2.1 | v0.2 adopts a **reading convention** (§7.5) rather than extending the band table, because SR §D.1 supports the organising variable, not a per-oil placement. Recorded as open gap §17.15 |
| L5 rheology-exclusion enumeration (Polyacrylamide, Polysorbate 20, PQ-16, VP/Methacrylamide/Vinyl Imidazole Copolymer) | BR §2.18 | Not on the fix list. Round 1 resolved these by analogy without producing a disagreement; if round 2 produces one, it becomes a v0.3 item |
| Transfer-caution threshold | BR §2.18 | Not on the fix list, and §7.5 already states there is no published instrumental transfer method — a threshold would be exactly the unsupported precision the standard forbids |

**Re-review consequence of this version bump (§16).** A standard-version bump reopens only the fields whose rules changed. For v0.2 that is: FORM, WT, PERS, HEAT, HUM, R2, DOSE, ROLE, `care_direction`, `focus`, `damage_fit`, `texture_fit`, `scalp_application_fit`, and every field whose value was derived through the tail-marker convention. Approvals for fields outside that list remain valid where their per-field fingerprint is unchanged.
