# u1 re-derivation notes — post-amendment

**Record:** L'Oréal Paris Elvital Dream Length No Spliss Milk, 200 ml, GTIN 3600523587841, DE
**Standard:** `leave-in-inci-v0.4` (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v0.4.md`)
**Packet:** `leave-in-unseen-test-v0.1`, lane copy, amended 2026-09-12
**Output:** `u1-record.json` (same shape as the lane-a u1 record)
**Date:** 2026-09-12

---

## 0. What the amendment changed, and how this lane treated it

The packet's u1 entry was re-anchored: the **31-ingredient list** (formerly an additional capture, codecheck.info) is now the primary, after three same-day live sources for the same GTIN converged on it in identical order — rossmann.de (GTIN-keyed URL), parfumdreams.de, codecheck.info — sharing formula prefix `1184630 C` and the `F.I.L. C240136` family. `identity_status` moved `provisional_formula_conflict` → `verified_with_minor_source_difference`, and the entry's `known_conflicts` records the three-way conflict as **RESOLVED**.

Two captures remain on file as documented residual source noise:

- **mueller.de, 38 ingredients** — re-verified live and reproducing exactly, but contradicted by three converging sources for the same GTIN. Packet verdict: *outlier*.
- **loreal-paris.de, 35 ingredients** — the manufacturer's own German-market page, structurally different (Cyclopentasiloxane/Dimethiconol backbone, `HYDROXYPROPYLTRIMONIUM HYDROLYZED WHEAT PROTEIN`, F.I.L. family C212631). Packet verdict: *most likely stale or market-mismatched*; not re-verified live on 2026-09-12.

**How this lane handled that.** §2.4 makes the freeze the evidence and forbids a lane re-researching it; §2.4 and G5 require conflicts to be *preserved*, not deleted, and the smallest affected scope lowered. The packet has already done the adjudication, so the residual is carried exactly where the standard puts trace material: in `identity_status`, in `confidence` (§4's four-value set), in `counter_signals[]`, and in the review route (§14) — **never** as a blanked field and never as a hedge on a projected value (§10.1.1, G14). Where a demoted capture would have moved a value, that is recorded as a counter-signal and confidence is held one step below the ceiling; the value itself comes from the formula of record.

**Ranks used throughout** (formula of record, 31 ingredients): Aqua 1 · Isopropyl Myristate 2 · Dimethicone 3 · Amodimethicone 4 · Triethanolamine 5 · Niacinamide 6 · Ricinus Communis Seed Oil 7 · Hydroxypropyl Guar 8 · Hydroxycitronellal 9 · Hydrolyzed Wheat Protein 10 · Hydrolyzed Corn Protein 11 · Hydrolyzed Soy Protein 12 · **Phenoxyethanol 13** · Behentrimonium Chloride 14 · Trideceth-6 15 · Polyquaternium-4 16 · Limonene 17 · Benzyl Salicylate 18 · Linalool 19 · Benzyl Alcohol 20 · Panthenol 21 · Isopropyl Alcohol 22 · Alpha-Isomethyl Ionone 23 · Carbomer 24 · Geraniol 25 · Potato Starch Modified 26 · Cetrimonium Chloride 27 · Citronellol 28 · Coumarin 29 · Hexyl Cinnamal 30 · Parfum 31.

---

## 1. G0 — product-form gate (§2.3, §2.3.2)

`in_category`.

- Aqua leads (r1); the aqueous phase is material.
- Directions capture (§2.4 rule 2): „Auf trockenem oder nassem Haar auftragen - Ohne Ausspülen." — an explicit leave-on instruction governing the product's own application step. Rinse check **PASS**. Not a hazard sentence (clause 1), not a dual-use „ODER" direction (clause 2), so `dual_use_directions` does not fire.
- Conditioning/detangling/smoothing is primary or co-primary.
- **Styling-first test (§2.3.2) never reaches its architecture half**: no fixative-class L5 polymer exists. Carbomer r24, Hydroxypropyl Guar r8 and Potato Starch Modified r26 are L5 rheology exclusions (§5, FS-25); Polyquaternium-4 r16 is a cationic polymer read with L1/PERS, never with L5 (FS-9). With `hold_route_state: none` there is no boundary question, so no `provisional_boundary`, no `excluded_styling_first`.
- Classified by function + directions + architecture, never by name (§2.3). `out_of_category: false`; the full lean profile is emitted (§2.3.1 does not apply).

---

## 2. G1 — identity, directions, claims (§2.4, §2.4.1)

`identity_status: verified_with_minor_source_difference` — taken from the packet, which is the authority on identity state; a lane does not re-adjudicate a frozen identity read.

**`application_stage: [towel_dry, dry_hair]`** (§7.13, T12). Transcribed, not judged, from the verbatim direction sentence:
- „nassem Haar" → `towel_dry`;
- „trockenem Haar" → `dry_hair` (dry-hair use as a generally permitted use — the one informative bit ROLE's `refresh` carried);
- no named heat tool and no sentence positioning the application before heat styling → **`pre_heat` is not transcribed**, which is what closes the `heat_styling` focus below;
- no finishing-step direction → no `post_style`.

**Sourcing is admissible at C3.** §7.13's sourcing note is explicit that `application_stage` is the one field that reads G1's *general* directions hierarchy with **no** C1/C2 claim-tier gate layered on top. The source is mueller.de — the retailer whose *INCI* capture was demoted. That demotion does not travel: the INCI capture and the directions capture are separately sourced facts, and the packet keeps `directions_status: captured` with this source of record. The manufacturer's own „Anwendung" accordion was not captured (packet note) and is recorded as not independently verified rather than assumed identical — a documented gap, not a contradiction. The transcription is clean and places into exactly two stages, so §7.13's ambiguity/`provisional_identity_conflict` route does not fire.

**Claims (§2.4 mandatory claim capture).** Two frozen entries: a **C2** loreal-paris.de „Produktdetails" paragraph (repair / anti-split / moisture / shine / styling ease) and a **C3** mueller.de bullet list (corroborating, `creates_claim: false`). The packet's `claims_search_note` records that both pages were **actively checked** for heat-protection, UV-protection, hold and anti-frizz claims and none was found. §2.4 rule 2's "not captured vs does not exist" distinction therefore resolves to **does not exist**, not to a gap.

---

## 3. Reading conventions

### 3.1 Tail marker (§3.1.1)

**`PHENOXYETHANOL`, rank 13 of 31.** It is the *first* capped ingredient in the list (Benzyl Alcohol r20 is also marker-eligible as a preservative, but the rule takes the first). The declared EU allergen block is **not** marker-eligible (T17 H2), so the ten allergens below play no part in marker selection.

- **Plausible** (clause 5 / T16): every ingredient establishing COND/WT — IPM r2, Dimethicone r3, Amodimethicone r4, Castor r7 — outranks r13. The marker sits *after* the architecture it bounds, so clauses 1 and 3 govern normally and no `tail_marker_implausible` note is warranted.
- **Not vacuous** (clause 6 / T17 H1): Behentrimonium Chloride r14, Trideceth-6 r15, Polyquaternium-4 r16, Panthenol r21, Carbomer r24, Potato Starch Modified r26 and Cetrimonium Chloride r27 all sit at or below the marker and are none of them capped materials, allergen declarations or colourants. `tail_marker_vacuous` does not fire.
- Ordinary mid-list marker ⇒ the `tail_marker_dependence` trigger (§14, T17 definitions), not `early_tail_marker` or `very_late_tail_marker`.
- Mandatory limit 1 satisfied: the marker and its rank are recorded, with §17.14 and §17.18 inherited.

### 3.2 Architecture read (§3.1.2, T11)

**`emulsion`, `emulsion_subtype: non_lgn`.** Decision order, first match:
1. not `anhydrous_serum_or_oil` (Aqua r1);
2. not `two_phase` — the row needs *no* emulsifier and *no* solubiliser package, and Behentrimonium Chloride r14 + Trideceth-6 r15 + the Triethanolamine r5/Carbomer r24 neutralised system supply exactly that capacity;
3. **matches `emulsion`**, sub-type (b) non-LGN: a cationic-surfactant/nonionic/polymeric emulsifier system carrying a real lipid and silicone phase, with **no LGN pair** — no long-chain fatty alcohol is declared anywhere, so the cationic surfactant has no lamellar partner.

`microemulsion` is never reached (emulsion matches first) and would fail test (i) anyway: Trideceth-6 is the *only* solubiliser-type material and no glycols sit high in the list, so there is no solubiliser *package* (v0.3 tightening). The solution row is excluded independently, because a real oil/silicone load is present as architecture.

Consumed **inline only** — G0's rationale, COND's routes, WT's G9 clauses — with no dimension, confidence band or projection of its own (§7.1). **G9 binds absolutely**: nothing in the WT value comes from this read, in either direction. Since the read is not `two_phase`, the §18 shake string and the §14 two-phase trigger do not fire.

---

## 4. The seven scored dimensions

### COND — `moderate`, confidence `moderate` (§7.2)

One coherent conditioning route present as architecture: a persistent silicone/emollient package (Dimethicone r3 + Amodimethicone r4; IPM r2; Castor r7), all above r13.

`high` is unreachable **on the formula itself**, not on a source doubt: the anchor requires an LGN pair above the tail, and the formula of record declares **no long-chain fatty alcohol at all** (no Cetearyl/Cetyl/Stearyl/Behenyl/Myristyl/Arachidyl Alcohol), so under §3.1.2 no LGN pair can be formed at any rank. `low` requires no persistent non-volatile above the tail; four are present.

**Absorbed slip observation (T1)** recorded inside COND's object: four M1 contributors present as architecture across three distinct L-route families; count ≥ 2 independent; bias `unknown` (§17.5, §17.16 inherited — the architecture does not settle wet vs dry). It may not move the COND value (G3), and it is the input `detangling` (§10.2) and `texture_fit` rows 3–4 (§10.3) read.

Confidence held one step below the moderately-high ceiling for the residual source situation and the absent C1 pack capture — not for the value, which converges on `moderate` across all three captures on file.

### WT — `high`, confidence `moderate` (§7.5) — **anchor dimension**

`high` anchor, multi-family-plus-rich-band limb: **three** persistent non-volatile families present as architecture above r13 —
- L3 dry-feel ester: Isopropyl Myristate r2;
- L2 persistent silicone: Dimethicone r3 + Amodimethicone r4;
- **L3 rich / low-spreading band: Ricinus Communis Seed Oil r7** — castor is an *enumerated* member of the L3 rich band (§5), so §7.5's closed rich-band enumeration is satisfied by name, not by the §17.15 medium-band convention.

The multi-family `moderate` row (R13) is explicitly **not** applicable: it requires that *none* of the families be a rich-band member. The LGN limb is not used (no fatty alcohol). `unknown` is not taken — the non-volatile architecture of the formula of record is fully readable above the tail.

**Weight conflict tag (§10.1.2): declined, with the failing condition named** (the determinism clause requires this). Condition 1 is met (E2 `high`), but condition 2 fails: the only C2 source asserts repair/anti-split/moisture/shine/styling ease and contains no light-finish statement — no „beschwert nicht", „leicht", „ohne zu beschweren", „federleicht". The mueller.de bullet list is C3 and can never trigger the tag (G13). Condition 4 would also fail: silence about weight is not a contradiction.

Confidence held at `moderate` (not raised to the moderately-high the ceiling permits when the architecture read is definite and the non-volatile architecture fully readable) because the demoted loreal-paris.de capture would read `moderate` rather than `high`. §17.1 (dose unmeasured) and §17.11 (no fine-hair residue threshold) inherited; the fine-hair `caution` this value produces downstream is labelled a product judgment call.

### PERS — `ph_dependent_cationic` → projects `moderate`, confidence `low` (§7.6)

Highest ordinal class **present as architecture**: Amodimethicone r4, above r13. Lower classes recorded as supporting (Dimethicone r3, IPM r2, Castor r7 = `neutral_non_volatile`). No volatile carrier exists at all on this formula, so M6 contributes nothing.

`permanent_cationic` is **not** reached: the only polymeric quat, **Polyquaternium-4 r16, sits below the r13 marker**. §3.1.1 clause 1 makes rank the single deterministic prong, so it is not present as architecture; clause 3 requires the dimension to take its rank-supported value, the below-marker note to be recorded, and the record to **route to review** — done. Behentrimonium Chloride r14 and Cetrimonium Chloride r27 are monomeric long-chain quats, also below the marker.

**§7.6's mandatory monomeric-quat note is not the governing note here** — its precondition is a monomeric quat as the *dominant persistent species*, and Amodimethicone above the marker is dominant. The monomeric quats are recorded as present-but-below-marker observations instead.

Confidence `low`: ceiling is low–moderate (capped at `moderate`), lowered one step for marker dependence plus the residual outlier (loreal-paris.de would reach `permanent_cationic` on its own cationised protein at its r12 — a two-class divergence). G11 observed throughout: no duration, wash count, applications-to-buildup or clarification schedule; none of the banned circulating removal percentages.

### HOLD — `none`, confidence `moderate` (§7.7)

No fixative-class L5 polymer anywhere. Carbomer / Hydroxypropyl Guar / Potato Starch Modified are rheology exclusions; Polyquaternium-4 is cellulose-based cationic, not a vinyl/acrylate fixative (FS-9). `manufacturer_hold_level: null` — the frozen `claims[]` carries no hold statement at any tier, so T7's capture clause has nothing to record and the §14 trigger does not fire. **All three captures agree completely here**, so this is the one dimension the amendment could not have moved.

### HEAT — `not_claimed`, binary `false`, confidence `low` (§7.8, §13)

**Claim authority (§2.4.1, G13).** The C2 manufacturer German-market page was located and read; it carries no heat statement. The C3 retailer page carries none either. The packet records the active search. No C1 pack, no `C2_cross_market_verified` claim (rule 7's exception is not invoked — there is no non-German manufacturer heat claim to admit). **The claim does not exist.**

**Formula sanity-check (§13.3 rule 2).** `HYDROLYZED WHEAT PROTEIN r10` **is** a closed-L9 member (McMullen & Jachowicz 1998) and **is above the tail**. §13.3's `false`/`not_claimed` row governs: a formula does not manufacture a claim (§5 L9 tail-member rule 2), so binary `false` and trace state `not_claimed` — and the two do not point in opposite directions. Explicitly recorded as non-members: Hydrolyzed Corn/Soy Protein (the published result names wheat specifically), **Polyquaternium-4** (the list carries PQ-55 and the PVM/MA-with-PQ-28 complex; the list is closed and may not be extended by analogy, G10), and Dimethicone/Amodimethicone/Panthenol/Castor oil (generic silicone, panthenol, oil — barred by G10, FS-7, FS-24). §5 L9 rule 4's study-context limitation recorded even though no upgrade is taken.

**`claim_authority_gap` does NOT fire; `l9_member_without_claim` does.** The gap trigger exists for the case where a claim appears only in retailer copy and no C1/C2 source could be located, so a human can judge whether the manufacturer source was missed. Here the manufacturer source *was* found and read, and there is no retailer heat copy either — nothing to reconcile on authority. T17's mirror trigger (H8) is the correct route, and this is its intended shape: an above-tail L9 member with no claim.

Confidence `low` because §7.8's summary-table ceiling for HEAT **is** `low`, and a ceiling caps the value however firmly the claim absence is established.

### R2 — `none_visible`, confidence `low` (§7.10)

The closed `candidate` list is **cationised protein · silane derivative · silicone quat**, and none is present:
- Hydrolyzed Wheat r10, Corn r11, Soy r12 are **plain, non-cationised hydrolysates**, sitting high in the list and above the marker. §7.10's v0.2 change 2 is explicit that what makes a protein an R2 route is cationisation or silane functionalisation, **not rank** — so they are `none_visible` at any position, with the **mandatory trace note** recorded so the record does not read as if they were missed.
- Polyquaternium-4 r16 is a non-silicone cationic polymer, removed as a qualifying route in v0.2 (it rested on a charge-density property G4 forbids inferring).
- Amodimethicone r4 is an amino silicone, not a declared `Silicone Quaternium-x`.
- Panthenol r21 is a fibre-mechanics signal (L6), never an R2 route (FS-24).

**`candidate_below_tail` = false**, and this is worth stating precisely: the note requires a *qualifying* route at or below the marker, and there is no qualifying route at any rank. The below-marker discipline on this record attaches to PERS, not to R2. `tail_marker_implausible` does not fire either (marker plausible).

`unknown` is **not** taken: the formula of record is complete and its protein context entirely readable. Abstaining would blank a field the adjudicated primary answers, and would move the record *away* from the conservative value rather than toward it (§1.1). Confidence `low` for the residual — the loreal-paris.de capture's `HYDROXYPROPYLTRIMONIUM HYDROLYZED WHEAT PROTEIN` would read `candidate` and is the single species that would move R2, `care_direction`, `repair_support_level`, `damage_fit` and `focus.primary`.

### EXPO — `aromatic_or_allergen_exposure`, confidence `moderate` (§7.12, L8)

Parfum r31 plus **ten** declared EU allergens (Hydroxycitronellal 9, Limonene 17, Benzyl Salicylate 18, Linalool 19, Benzyl Alcohol 20, Alpha-Isomethyl Ionone 23, Geraniol 25, Citronellol 28, Coumarin 29, Hexyl Cinnamal 30). Above `fragrance_declared` on the allergen block alone — the formula of record carries **no** essential oil (Citrus Aurantium Peel Oil appears only on the demoted mueller.de outlier), so the value is unaffected by that residual.

**Isopropyl Alcohol r22**: present, but outside §7.12's `Alcohol Denat.` / `Alcohol` enumeration — open gap **§17.21**. No alcohol note, no §18 alcohol string; the observation is recorded. G6 observed: exposure statement only, never a tolerance prediction, never a fragrance-free or hypoallergenic implication. No scalp placement is asserted (the directions state none).

---

## 5. `smoothing_route` (§7.4, T2) — typed, never graded

**`silicone_film`** — Dimethicone r3 + Amodimethicone r4, a persistent silicone film system above r13.

**Two-observation test (§7.4.1, as the `smoothing` focus test): PASS.**
- Continuous film route = the silicone pair, counted as **one** observation (clause 2: a Dimethicone/Dimethiconol pair or an amino silicone plus its carrier counted once as film and once as lubricant is one observation).
- Separate lubrication route = **IPM r2** (dry-feel band) and **Castor r7** (rich band) — ingredient observations not among those establishing the film. Both above the marker, so clause 3 (a below-marker second route is unavailable) does not bite.

**Beyond baseline conditioning (§10.2.1, permissive reading per T13b): satisfied.** COND `moderate` is independently establishable from the emollient package alone (IPM r2 + Castor r7 — the emollient half of the anchor's "persistent silicone/emollient package"), which leaves the dedicated silicone film as an observation COND did not need. T13b settles that a *single* admissible COND-establishing set suffices. The recording requirement is met: the record names both the COND-establishing observations and the additional observation the route rests on.

`smoothing_route` is trace-only and never projected (G14). It makes **no** humidity or frizz statement — the prohibition predates HUM's removal and survives it (T9). The frozen `claims[]` carries no humidity/anti-frizz entry, and one could not be smuggled in here if it did (§7.9 prohibition).

---

## 6. Hinweise (§8, T5)

Fired: **SHN** (`present`), **buildup** (`present`), **transfer** (`present`).

- **SHN** — §8.1, the M3 optical consequence of the alignment film in `smoothing_route`; a qualifier on the smoothing route only, never an independent shine value (no distinct gloss route, no goniophotometry; FS-23). The C2 „Extraportion an Glanz" corroborates and creates nothing.
- **buildup** — §8.5 as widened by **T17 (H6), limb 2**: `weight_potential` projects `high` **and** PERS resolves at or above `neutral_non_volatile` (it is `ph_dependent_cationic`). Limb 1 does not fire (PERS projects `moderate`, not `permanent_cationic`). This is exactly the inversion T17 exists to close, and it is the notable user-visible change from the amendment: on an `unknown` WT the caution would have been silent on a heavy product. No G3 rule-4 violation — the caution and PERS read the same evidence from two ends, and the widening changes which end can raise it, not what either dimension projects.
- **transfer** — §7.5's attached qualitative caution: castor oil r7, an enumerated rich/low-spreading band member, above the tail as a non-volatile, non-film-forming lipid load. Qualitative only; no published instrumental method (SR §D.3, §17.3); §18 defines no string.

Not fired: **CURL** (no curl-definition focus derived; `curl_definition_focus` still has no value vocabulary — open gap §17.20). **R3** — `r3_state: none`, the researched negative: no C1/C2 bond claim (the C2 paragraph names no bond chemistry) and no recognised bond chemistry in the formula. `none` emits no §18 string and does not enter `fired`, but is carried in `r3_state` because a machine diff needs the negative member (§8.3, §8.6 rule 3). **LAYER** — §8.4 defines the string and the prohibition on computing a compatibility matrix but **states no trigger condition anywhere in the standard**; firing it would require inventing an untraced rule, so it is recorded as a non-fire with its reason rather than guessed in either direction.

---

## 7. `care_direction` — `moisture`, confidence `low` (§9)

Leg audit against the tail marker:

| Leg | State |
|---|---|
| L1 cationic | **Not above the tail** — Behentrimonium Chloride r14, Polyquaternium-4 r16, Cetrimonium Chloride r27 all at/below r13. Hydroxypropyl Guar r8 is the *non-cationised* guar derivative, not Guar HPTC, so it is not an L1 route at all |
| L3 emollient | **Above the tail** — IPM r2, Castor r7 |
| L4 humectant | **Not above the tail** — Panthenol r21 is the only L4 member; §9 constraint 2 requires the humectant leg *above* the tail, not a tail entry, so the humectant-led minimum row is not the row taken |
| L2 silicone | Present and prominent, but appears in neither the `protein` nor the `moisture` definition and is not interpolated into either |

§9's "how much moisture leg is enough" rule: **any one leg present as architecture is sufficient**, subject to the confidence rules. The L3 leg is present ⇒ `moisture`.

**Silicone-led `unknown` check.** The v0.2 silicone-led rule requires a silicone-led conditioning architecture with no R2 route **and no material humectant/emollient leg**. The R2 half holds; the emollient half does **not** — Isopropyl Myristate at r2 (ahead of both silicones) and castor oil at r7 are a material emollient leg. So the rule as written does not catch this record. This is precisely the shape **open gap §17.22** names ("a silicone-led product with any emollient or humectant leg returns `moisture`"), and §17.22 is explicitly reserved as an ontology question for a Nick fork rather than a repair a lane may apply — so the rule is followed as written and the gap is inherited in `limitations[]`.

`protein` fails (R2 `none_visible`; Panthenol alone never sets it, FS-24). `balanced` fails (needs *both* a substantive R2 route and a material moisture leg; it is expressly not an uncertainty bucket). Confidence `low`: §9 grants up to `moderate` only for L1+L3+L4 or L1+L3, and a single-leg read is held low by analogy to the humectant-led minimum and by §1.1. §9 constraint 3 recorded as a counter-signal: the C2 positioning is protein-and-repair-led („mit pflanzlichen Proteinen … angereicherte Haarkur"), and marketing direction never sets the value. Constraint 1 observed: `care_direction` drives none of WT, PERS, HOLD or HEAT.

---

## 8. Lean matching profile (§10)

| Field | Value | Rule |
|---|---|---|
| `product_form` | `milk` | §10.1/T10 — presentation form captured at identity (E1: „No Spliss Milk", 200 ml pack), **not** a projection of the architecture read |
| `conditioning_level` | `moderate` | ← COND, identity echo (§10.1.3) |
| `weight_potential` | `high` | ← WT, no §10.1.2 tag applied |
| `persistence` | `moderate` | ← PERS `ph_dependent_cationic`, ordinal projection (a mechanism ordering, not a duration — G11) |
| `hold_support` | `none` | ← HOLD 3-state, no `unknown` member exists (§10) |
| `care_direction` | `moisture` | ← §9 |
| `repair_support_level` | `low` | ← §10.3.2 |
| `focus.primary` | `smoothing` | ← §10.2 |
| `focus.secondary` | `[]` | ← §10.2 |
| `provides_heat_protection` | `false` | ← §13.3 |
| `uncertain_fields` | `[]` | no dimension projected `unknown`; no tag; texture_fit not in row 4/5 |

### `repair_support_level: low` (§10.3.2)

`high` needs exact-product repair evidence at E3+ (none). `medium` needs R2 ∈ {`candidate`, `tested`} **with** `conditioning_level` ≥ `moderate` — the conditioning half is met, the R2 half is not. Clause 2 binds independently: the C2 repair claim never raises it, and the plain hydrolysates behind it are not a route. Clause 4 is not engaged (no `candidate_below_tail`, marker plausible). It emits no §18 string, and the §14 `medium`/`high` trigger does not fire.

### Focus (§10.2 selection procedure)

Step 1 — qualifying routes: **only `smoothing`**.

| Route | Why it does not qualify |
|---|---|
| `repair` | Requires R2 ∈ {`candidate`, `tested`}; R2 is `none_visible`. **T13a deleted the marketing-position prong**, so the C2 protein/repair copy supplies no route of its own |
| `curl_definition` | HOLD is `none`; and the v0.3 negative gate finds no C1/C2 curl/wave positioning or texture-targeted directions |
| `heat_styling` | Requires `provides_heat_protection = true` (it is `false`) **and** `application_stage` including `pre_heat` (not transcribed). Both halves fail |
| `detangling` | Prong (a) needs detangling-led **C1/C2** positioning („Leichtkämmspray"/„Entwirrungsspray"); the C2 positioning is repair-and-anti-split-led, and mueller.de's „Unterstützt die Kämmbarkeit" is C3 and cannot create the positioning half (G13). Prong (b) needs the slip observation **with COND ≤ moderate and WT `low`** — WT is `high` |
| `volume_lightness` | Requires WT `low` and no persistent film route |
| `shine` | Would merely restate the smoothing film (§8.1, G3); no distinct gloss route, no goniophotometry |
| `general` | Only where no route clears its threshold — one does |

Step 2 (exact-product evidence) empty. Step 3: the rank order binds and the single qualifying route is `primary`. Step 4: observation counting never promotes a lower-ranked route and decided nothing. Step 6: no remaining qualifying route, so `secondary` is empty (`general` is never a secondary value).

**`focus.primary` is not marked uncertain.** §10.2 principle 5's condition is two plausible purposes left unresolved; only one route qualifies on the formula of record.

### Fits

- **`hair_thickness_fit`** — §10.3 weight-led table, `high` row: fine `caution` / medium `conditional` / coarse `recommended`. `derived_from: [weight_potential]`; no second weight-derived field modifies it (G3). Every fine-hair value carries §7.5's judgment-call limitation (§17.11): no evidence establishes a residue load at which fine hair reads as limp.
- **`damage_fit`** — row 2 (`conditioning_level ∈ {moderate, high}` with no qualifying repair route): healthy `recommended` / moderately_damaged `recommended` / highly_damaged `conditional`. Row 3a needs COND `high` plus a qualifying specialist route; row 3b (R14's repair-film path) needs R2 ∈ {`candidate`, `tested`}. Neither is reached. No R3 flag exists, and an R3 flag would be invisible to this table anyway (R14).
- **`texture_fit`** — **row 3**: WT `high` **and** the absorbed slip observation names two or more independent M1 contributors present as architecture (IPM r2, the silicone film r3+r4, castor r7 — three distinct L-route families). straight `conditional` / wavy `recommended` / curly `recommended` / coily `recommended`. Rows 4 and 5 are not reached, so the §14 row-4/row-5 trigger does **not** fire.

---

## 9. Review routing (§14)

**Fired:** `formula_or_identity_conflict` · `l9_member_without_claim` · `below_marker_qualifying_route` · `tail_marker_dependence`.

- **`formula_or_identity_conflict`** — the standing §14 trigger. The conflict is *adjudicated* for classification (hence `verified_with_minor_source_difference`, not `provisional_formula_conflict`), but the residual is real and a human should see it: mueller.de live-serves a contradicted list that reproduces on re-fetch, and the manufacturer's own German page publishes a structurally different formula that was not re-verified live. That page's cationised wheat protein is the single species that would move R2, `care_direction`, `repair_support_level`, `damage_fit` and `focus.primary`. The packet's `remaining_gap` stands: a C1 back-of-pack photo is the definitive close-out, plus a live re-check of loreal-paris.de.
- **`l9_member_without_claim`** (T17 H8) — Hydrolyzed Wheat Protein r10 above the r13 marker with no C1/C2 heat claim. Binary stays `false` by design (ruling 6); a human decides whether a manufacturer heat source was simply not found.
- **`below_marker_qualifying_route`** (§3.1.1 clause 3) — Polyquaternium-4 r16 would otherwise qualify PERS `permanent_cationic`. The standard names a trigger only for the R2 case (`candidate_below_tail`) and carries the same discipline through §7.6's counter-signals, so this is recorded under a descriptive name. FS-20's under-warning risk is the reason clause 3 exists; note the buildup caution fires anyway on §8.5's WT limb, so nothing is withheld from the user.
- **`tail_marker_dependence`** — an ordinary mid-list marker whose position decided the PERS class, the R2 below-tail test and the L9 above-tail test.

**Checked and not fired:** G0 ambiguity / `provisional_boundary`; `HOLD = meaningful_hold_route`; `claim_authority_gap` (see §4 above); system-level claim; `directions_capture: missing`; `dual_use_directions`; `quat_structure: unresolved` (PQ-4 polymeric by name, Behentrimonium/Cetrimonium monomeric by name); `tail_marker: none_visible`; `tail_marker_implausible`; `tail_marker_vacuous`; `species_reading_conflict` (no species is read as substantive architecture by one rule and disqualified trace by another at the same rank); `candidate_below_tail`; R3 `chemistry_candidate`; two-phase; `manufacturer_hold_level`; `repair_support_level` medium/high; `PERS = permanent_cationic` + `dry_hair` (misses by one class — recorded because `dry_hair` *is* transcribed and the below-marker PQ-4 is exactly what strict rank excluded); §10.1.2 tag; `texture_fit` row 4/5; `claim_tier_basis: house_brand`; root/scalp application; fragrance-free/hypoallergenic implication; routine-level efficacy evidence.

---

## 10. `cautions_de` (§18)

1. „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." — emitted by `weight_potential = high`.
2. „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." — the buildup caution.
3. „Enthält deklarierte Duftstoffe." — EXPO.

**Two §18 keying notes, recorded rather than resolved by this lane.**

- The buildup row in §18 is keyed „PERS → `high` + buildup caution", written before **T17** widened §8.5's emission rule to the WT limb, and T17 explicitly added no string in v0.4. Here the caution fires under §8.5 while PERS projects `moderate`. Emitting the existing string is what §8.6 rule 5 requires (a fired flag's user-facing consequence is the §18 string it already emitted) and the direction §1.1 requires — T17's own rationale is that the widening moves the caution toward showing the user more information, never toward a recommendation.
- §18 carries rows for `fragrance_declared` and `no_listed_fragrance_signal` but **none** for `aromatic_or_allergen_exposure`. The `fragrance_declared` string is the nearest accurate one: it states only what is declared and asserts nothing about tolerance.

**Not emitted:** the two-phase shake string (architecture is `emulsion`); the EXPO alcohol string (§17.21); any HEAT string (`not_claimed` has none, and „… ist ausgelobt" requires C1/C2 authority); any R3 string (`none` emits nothing); the LAYER string (§8.4 states no trigger); a transfer string (§18 defines none); the WT `low` string; and **„Dazu haben wir keine belastbare Information."** — no field projects `unknown`, which is the change the amendment makes most visible to a user.

---

## 11. How each formerly-`unknown` field resolved, and why

| Field | Before (superseded evidence) | Now | Why it resolved |
|---|---|---|---|
| `weight_potential` | `unknown` | **`high`** | The former `unknown` rested on a three-way conflict in which one capture placed only castor oil above its marker (`moderate`) while two placed three families above it (`high`) — "a source conflict makes the persistent families unreadable" (§7.5 `unknown` row). With the primary adjudicated, the persistent families of the formula of record are fully readable above r13, and the rich-band limb of the `high` anchor is satisfied by an **enumerated** member (castor r7). The `unknown` row's own precondition is gone |
| `persistence` | `unknown` | **`moderate`** (`ph_dependent_cationic`) | The former `unknown` rested on two captures reading `ph_dependent_cationic` and one reading `permanent_cationic` — a two-class spread no source preference could settle. On the formula of record the highest class present as architecture is unambiguous: Amodimethicone r4, with every quat below the marker. The residual outlier is carried by confidence `low` + a counter-signal + the review route |
| `repair_surface_film` | `unknown` | **`none_visible`** | The former `unknown` existed because one capture carried a cationised wheat protein (`candidate`) and two carried only plain hydrolysates (`none_visible`), and choosing would have meant preferring a source. The formula of record contains **no** member of §7.10's closed candidate list at any rank, so the value is a positive read, not an abstention. The mandatory plain-hydrolysate trace note is recorded for r10/r11/r12 |
| `care_direction` | `unknown` | **`moisture`** | It was `unknown` downstream of R2 being `unknown`. With R2 `none_visible`, §9's `protein` and `balanced` rows are closed, the L3 emollient leg is present above the tail, and the silicone-led `unknown` escape is gated on an absent emollient leg this record has. Confidence `low` for the single-leg architecture; §17.22 inherited |
| `hair_thickness_fit` | all `unknown` | **caution / conditional / recommended** | Direct consequence of `weight_potential` resolving to `high` (§10.3 weight-led table) |
| `texture_fit` | all `unknown` | **row 3** | Consequence of WT `high` plus an absorbed slip observation naming ≥ 2 independent M1 contributors. Row 5's fallback no longer applies, so the row-5 review trigger stops firing |
| `damage_fit` | row 2, marked uncertain | **row 2, no longer uncertain** | The uncertainty was "on the loreal-paris.de capture R2 would be `candidate` and row 3b would apply instead". With R2 settled at `none_visible` on the formula of record, row 2 is the read and the uncertainty flag is dropped — the residual is carried by the review route |
| `focus.primary` | `smoothing`, marked uncertain | **`smoothing`, not uncertain** | The uncertainty was that `repair` would have qualified on one capture. R2 `none_visible` closes `repair` on the formula of record, leaving exactly one qualifying route; §10.2 principle 5's two-unresolved-purposes condition is not met |
| `uncertain_fields` | 7 entries | **`[]`** | §10 ties an entry to a projected `unknown`, and none remains; the §10.1.2 tag was declined and texture_fit is not in row 4/5. Residual uncertainty lives in `identity_status`, `confidence`, `counter_signals[]` and the review route, never as a hedge on a projected field (§10.1.1, G14) |
| buildup caution | did **not** fire | **fires** | §8.5 limb 2 needs WT `high` with a persistent family present as architecture; on an `unknown` WT it was silent on a heavy product — the exact inversion T17 (H6) added the limb to close |
| `identity_status` | `provisional_formula_conflict` | **`verified_with_minor_source_difference`** | Taken from the packet's amended entry; the lane does not re-adjudicate a frozen identity read |
| tail marker | Phenoxyethanol r12 / 38 | **Phenoxyethanol r13 / 31** | Different list. Still plausible (clause 5) and non-vacuous (clause 6) |

**Unchanged, and why that is a different kind of answer now:** `repair_support_level` stays `low`, but for a *positive* reason (R2 `none_visible` fails the `medium` row) rather than because R2 was `unknown`. `conditioning_level` stays `moderate`, `hold_support` stays `none`, `provides_heat_protection` stays `false`, `product_form` stays `milk`, `focus.primary` stays `smoothing`.

**Fields deliberately still not present**, per the v0.4 trim: no `slip_combability_potential` (T1), no `ambient_smoothing_alignment_potential` value (T2), no `dose_sensitivity` (T3), no `scalp_application_fit` (T4), no `humidity_resistance_evidence_state` / `specialist_functions.humidity_resistance` (T9), no `product_form_architecture` as a dimension (T11), no `usage_role` (T12), no `heat_protection_max_c` (ruling 6).

---

## SEAL CONFIRMATION

- **Files read — exactly three, all within the seal:**
  1. `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v0.4.md` (the standard, read in full across paged reads; the removal-record audit subsections §7.9.1, §7.11.1, §7.13.1, §10.3.1.1 and the §19–§21 calibration/change-log sections were skimmed or skipped as non-normative for classification, and nothing in this record depends on them);
  2. `plans/leave-in-inci/research/unseen-test/unseen-packet-lane.json` — the `slot: "u1"` entry only. The packet header (`fingerprint_method`, `amendment_log`) was read because the u1 amendment entries live there; entries u2–u6 were not used and play no part in this record;
  3. `plans/leave-in-inci/research/unseen-test/lane-a/records.json` — its u1 record, **for JSON shape only** (field names and nesting). Its values were derived from superseded evidence and were **not** anchored on: every value above is re-derived from the amended primary and its anchor is cited.
- **No web access** of any kind was used.
- **No other repo file** was read: no gold set, no reference key, no audits, no reports, no lane-b, no notes files, no `u1-formula-recency.md`, no `packet-notes.md`, no source code. Where the packet's own notes cite such a file (e.g. `u1-formula-recency.md`), only the packet's inline summary of it was used.
- One scratchpad file was written outside the repo (`.../scratchpad/u1_lane_a.json`) purely to extract lane-a's u1 record for shape inspection; it contains no new content.
- Outputs written: `u1-record.json` (verified to parse as JSON) and this file.
