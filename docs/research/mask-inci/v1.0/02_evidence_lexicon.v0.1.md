# Mask evidence lexicon — v0.2

Status: draft (created 2026-09-04; **bumped to v0.2 on 2026-09-14**, superseding v0.1). Not ruled.
No thresholds, no product classification, no calibration set — the standard owns those.
Scope: rinse-out intensive hair masks / Kuren, German-EU drugstore market.
Charter: `00_category_charter.md`. Property set: `01_property-set-v0.md`.
Standard of record: `mask-classification-standard.v0.1.md` (**now at v0.2**).
Evidence basis it builds on: `planning-evidence/2026-09-04-mask-formulation-evidence.md`
(referred to below as "the prior pass"). Template shape: `docs/research/category-classification-engine-template.md` §4.

Review date for every entry not marked otherwise: **2026-09-04**. Source keys resolve in §14.

**What changed in v0.2 (R8, 2026-09-14).** Five housekeeping patches from Nick's round-1 ruling R8,
each marked in place with `(R8, 2026-09-14)`:

1. **Lanolin / wool wax** added to family 3's **heavy** band (it had no entry at all).
2. **The chelator list is reconciled with the standard** — §0.2, §10 and the standard's §3.1 tail
   classes now carry one union list, and `Sodium Hydroxide` / `Sodium Chloride` are moved out of
   the "chelators" label they were filed under (they are pH salts and electrolytes).
3. **Three species added to the tail classes** — `Leuconostoc/Radish Root Ferment Filtrate`,
   `Tetrasodium Glutamate Diacetate`, `Ethylhexylglycerin`.
4. **Colourants lose marker status** — a CI number may no longer define `tail_marker_index`
   (§0.2, §12), with a marker-precedence note. They keep zero care credit, as before.
5. No value, band, threshold or role assignment moves. Since the standard's structural signals are
   computed on the above-tail segment, patches 3 and 4 can move a *boundary*; every affected
   record is re-derived under Standard v0.2, never patched.

---

## 0. Reading rules (apply before any entry)

These are the shared preconditions. An entry's "evidence role" is only valid inside them.

### 0.1 Evidence ceiling (hard)

Formula-only evidence is capped at **plausible architecture inference**. An INCI list can support
statements about *what kind of system this is* and *how it ranks against sibling masks*. It can
never support concentration, dose, delivered amount, penetration, or performance. `[R-1]`

### 0.2 The tail marker

EU 1223/2009 Art. 19: ingredients are listed in descending order of weight **only down to 1%**;
below 1% they may be listed in **any order**. `[R-1]` There is no printed marker for that line, so
this lexicon uses a practical proxy:

```text
tail_marker_index := index of the EARLIEST of                        # (R8, 2026-09-14)
    { Parfum / Fragrance / Aroma,
      any declared fragrance allergen (Limonene, Linalool, Geraniol, Hexyl Cinnamal, ...),
      any preservative (Phenoxyethanol, Sodium Benzoate, Potassium Sorbate, Benzyl Alcohol,
                        Benzoic Acid, Methylisothiazolinone, parabens, DMDM Hydantoin,
                        Dehydroacetic Acid / Sodium Dehydroacetate, Chlorhexidine Digluconate,
                        Leuconostoc/Radish Root Ferment Filtrate, ...),
      any preservative BOOSTER declared alongside a preservative above
                       (Ethylhexylglycerin, Caprylyl Glycol, 1,2-Hexanediol,
                        Glyceryl Caprylate, Caprylhydroxamic Acid),
      any trace chelator (Disodium EDTA, Tetrasodium EDTA, Tetrasodium Glutamate Diacetate,
                          Trisodium Ethylenediamine Disuccinate, Etidronic Acid,
                          Phytic Acid / Sodium Phytate) }

    # NOT marker-eligible: CI colourants (see the precedence note below),
    #                      Citric Acid (ubiquitous pH adjuster, position varies),
    #                      Sodium Hydroxide / Sodium Chloride (pH salt, electrolyte)

above-tail := index < tail_marker_index
tail       := index >= tail_marker_index
```

- **Marker precedence — colourants never set the boundary `(R8, 2026-09-14)`.** v0.1 listed
  `any CI colourant` as marker-eligible. Removed. Pigments are placed for shade, not for level, so
  an early CI number would drop an entire conditioning architecture into the nominal sub-1 % tail
  and collapse every judgment field to its floor — a disqualification driven by a listing
  convention rather than by evidence. Colour-*depositing* masks are excluded at G0 anyway, so a CI
  number on an eligible mask is an opacifier or a tinting trace. **Colourants keep zero care credit
  wherever they sit** (family 10 treatment, unchanged); above the tail they are recorded as a
  formula fact and earn nothing. Mirrors the standard's §3.1.
- **Preservative boosters are marker-eligible only in a pair `(R8, 2026-09-14)`.**
  `Ethylhexylglycerin`, `Caprylyl Glycol` and `1,2-Hexanediol` also appear as humectant-looking
  tokens (§13 false-positive register). They define the boundary **only** when a conventional
  preservative is declared on the same list; alone, they are neither markers nor humectants.

- **Everything in the tail gets zero structural credit** for every judgment property
  (`conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`,
  `primary_focus`/`secondary_focus`). This is the prior pass's §2 rule, operationalised.
- **Never rank within the tail.** Below 1% the printed order is legally arbitrary; a "position 13
  vs position 19" comparison inside the tail is not evidence of anything.
- **The marker is a proxy, not the 1% line.** Fragrance in a rinse-off mask is typically ~0.2–1%
  and preservatives ~0.3–1%, so the marker sits near 1% but can land slightly above or below it.
  Treat it as a boundary *band*, not a cut point; do not let a single rank either side of it flip
  an extreme value on its own.
- **Marker-failure fallback.** Some brands print `Parfum` last by house convention regardless of
  level. If Parfum is the final or penultimate entry and no preservative or allergen precedes it,
  fall back to the earliest preservative/allergen. If none exists, the boundary is **`absent`**
  — cap confidence and route to review; do not silently treat the whole list as above-tail.
- **Plausibility is a precondition `(R2/R8, 2026-09-14 — pointer, the standard owns the rule)`.**
  A marker that sits *before* the species establishing the product's own care/weight architecture,
  or that sits on a low-water / non-emulsion architecture, is **`unresolved`**: it may neither
  disqualify a route nor qualify one, confidence is capped, and the calls route to review under the
  standard's `tail_marker_unresolved` trigger. The two failure states are distinct and have
  distinct remedies — `absent` needs a fuller capture, `unresolved` needs a human to read the
  architecture. See Standard §3.1.1; this lexicon assigns families, never marker outcomes.

Worked illustration (real German-market lists, `[D-1]`, `[D-2]`, `[D-3]`):

| Product | Tail marker | Consequence |
| --- | --- | --- |
| Balea Professional Keratin Repair Haarkur | Parfum @ 18 | long above-tail section; the 4-protein cluster (7,9,10,11) is genuinely material |
| Schwarzkopf Gliss 4-in-1 Repair Bond mask | Parfum @ 11 | gluconamide pair (8,9) above tail = real; **shea butter @13 and amodimethicone @12 are in the tail = decorative** |
| L'Oréal Elsève Glycolic Gloss Mask | Parfum @ 4 | above-tail = Aqua, Cetearyl Alcohol, Behentrimonium Chloride only; **glycolic acid is the LAST listed ingredient** |

### 0.3 Rank bands (above-tail only)

- `head` = the first three non-water entries.
- `upper` = above-tail, after `head`.
- `tail` = per §0.2.

Rank bands are comparative shorthand for structured judgment. They are **not** thresholds and
carry no numeric meaning. The standard sets any cut points; this lexicon only says which
positions can carry signal at all.

### 0.4 Alias normalisation

Match on normalised INCI (case-folded, "(Water, Eau)" / "(Shea) Butter" parentheticals stripped,
Latin binomial retained). German front-of-pack marketing names (`Keratin-Kur`, `Öl-Kur`,
`Bond-Aufbau`, `Laminier-Kur`) are **never** aliases and never enter the lexicon match.

### 0.5 What the lexicon must not become

Per template §4: the lexicon extracts evidence. Only `bond_route` has a justified deterministic
rule (family 6). Every other family feeds structured judgment and must not be turned into a
single-ingredient floor or a route-count threshold. Every counter-signal and confidence note
below stays **internal** — none of it is user-facing (project rule
`feedback_research_uncertainty_not_user_facing`).

---

## 1. Cationic surfactants (quats, esterquats, amidoamines)

**Normalized name / representative aliases (German drugstore reality)**
Permanent quats: `Behentrimonium Chloride`, `Behentrimonium Methosulfate`, `Cetrimonium Chloride`,
`Cetrimonium Methosulfate`, `Steartrimonium Chloride`, `Dicetyldimonium Chloride`,
`Palmitamidopropyltrimonium Chloride`, `Quaternium-87`.
Esterquats: `Distearoylethyl Hydroxyethylmonium Methosulfate`,
`Distearoylethyl Dimonium Chloride`, `Dipalmitoylethyl Hydroxyethylmonium Methosulfate`,
`Brassicyl Valinate Esylate`.
Amidoamines (acid-activated, not pre-quaternised): `Stearamidopropyl Dimethylamine`,
`Behenamidopropyl Dimethylamine`, `Stearamidopropyl Dimethylamine Lactate`.

**Functional family** — substantive cationic conditioning agent; co-structurant of the lamellar
gel network that *is* the body of the mask.

**Directly supported functions**
- Charge neutralisation on the anionic keratin surface → antistatic, reduced fibre-fibre friction,
  easier wet and dry combing. `[P-1]` `[I-1]`
- Co-crystallisation with fatty alcohol into the lamellar gel network under controlled cooling —
  this is the structural backbone, not an additive. `[P-1]` `[I-1]`
- Amidoamines: cationic only when protonated. They require neutralisation with an organic acid
  and behave non-ionically above ~pH 6; behenamidopropyl dimethylamine (C22) shows solution and
  substantivity behaviour distinct from the C18 stearamido analogue. `[P-2]`

**Mask-specific evidence role**
- **`conditioning_level`** — primary driver. The honest signals are *count of distinct cationic
  species above the tail* combined with *rank band*. A cationic in the `head` band alongside a
  fatty alcohol in `head` is the strongest structural signal available in this category.
- **Multi-cationic stack — with a market correction (see §15, C1).** Two distinct cationics above
  the tail is **close to baseline** for German drugstore masks, not a high-conditioning marker:
  Balea Professional Keratin Repair carries Stearamidopropyl Dimethylamine + Cetrimonium Chloride,
  and Gliss 4-in-1 carries three (Behentrimonium Chloride, Distearoylethyl Hydroxyethylmonium
  Methosulfate, Behenamidopropyl Dimethylamine). `[D-1]` `[D-2]` The pattern that actually
  discriminates is ≥3 distinct species above the tail **with at least two in `head`/early `upper`**.
  Count alone does not.
- **`care_direction`** — supports the `moisture` (conditioning/emollient base) reading only as part
  of the base architecture; never on its own.
- **`detangling` / `smoothing` focus** — supporting evidence, subject to the focus-hierarchy
  distinctiveness gates (D2). Slip is the category baseline; it is not a distinguishing focus.

**Exclusions / common false positives**
- **Never** evidences repair, bond chemistry, or `repair_support_level` at any level.
- **Never** evidences `weight_potential` on its own — weight is lipid- and fatty-alcohol-driven
  (prior pass §8). A high cationic load in a lipid-free formula is intense but light.
- **Esterquat ≠ "gentler" or "lighter".** The methosulfate/esylate esterquats differ from chloride
  quats mainly in biodegradability and manufacturing origin; there is no evidenced difference in
  delivered hair outcome that an INCI list can support. Do not encode a quat-class preference.
- **Amidoamine ⇒ expect an acid.** When `Stearamidopropyl Dimethylamine` or
  `Behenamidopropyl Dimethylamine` is present, an accompanying `Lactic Acid`, `Citric Acid`, or
  `Glutamic Acid` is with high likelihood the **neutraliser**, not an active. `[P-2]` Balea
  Professional Keratin Repair is the textbook case: SAPDMA @3, Lactic Acid @4. `[D-1]`
  This is the single most common cross-family false positive in this category (see §13).
- Cationic *polymers* (Polyquaternium-N, cationic guar) are a different family — see family 9.
  They must not be counted toward the cationic-surfactant stack.

**Source and review date** — `[P-1]`, `[P-2]`, `[I-1]`, `[D-1]`, `[D-2]`; reviewed 2026-09-04.

---

## 2. Fatty alcohols

**Normalized name / representative aliases**
`Cetearyl Alcohol` (dominant), `Cetyl Alcohol`, `Stearyl Alcohol`, `Behenyl Alcohol`,
`Myristyl Alcohol`, `C14-22 Alcohols`, `Arachidyl Alcohol`, `Coconut Alcohol`.

**Functional family** — gel-network structurant + emollient/lubricant + viscosity builder.

**Directly supported functions**
- Forms the lamellar bilayer with the cationic surfactant; the cationic:fatty-alcohol mole ratio
  and cooling profile determine network formation and therefore the product's body. `[P-1]` `[I-1]`
- Surface lubrication and softening independent of the network.

**Mask-specific evidence role**
- **Structure vs richness — do not conflate.** In a mask, cetearyl alcohol serves *both* as the
  network builder (structure, feeds `conditioning_level`) and as a real emollient load (richness,
  feeds `weight_potential`). Rank position is the only handle on which is dominant: a fatty alcohol
  in `head` immediately after Aqua points at both; a broad set (cetearyl **and** cetyl **and**
  stearyl / `C14-22 Alcohols`) above the tail points at deliberate richness.
- **Rank-position significance is nearly all of the signal.** `Cetearyl Alcohol` at rank 2 is
  near-universal in this category — present in every calibration list checked `[D-1]` `[D-2]` `[D-3]`
  and in the Balea Professional range generally `[D-4]`. **Presence therefore carries no signal at
  all.** Only relative position (vs. the first cationic) and breadth do.
- Contributes to `care_direction: moisture` as part of the emollient base.

**Exclusions / common false positives**
- **Not drying alcohols.** Fatty alcohols must never be read as a dryness or harshness
  counter-signal — a persistent consumer myth. `[Pr-1]` `Alcohol Denat.` and `Isopropyl Alcohol`
  are different substances; in rinse-out masks `Isopropyl Alcohol` appears in the tail as a
  silicone/fragrance carrier (Gliss @15 `[D-2]`, Elsève @14 `[D-3]`) and carries no care meaning.
- Never evidences repair, protein direction, moisture focus, or bond chemistry.
- `Cetyl Esters` is an ester (family 3), not a fatty alcohol, despite the similar name.
- `Cetearyl Alcohol (and) Ceteareth-20` appears as one supplier blend but declares as two INCI
  entries; the Ceteareth-20 half belongs in family 10 and earns no care credit.

**Source and review date** — `[P-1]`, `[I-1]`, `[Pr-1]`, `[D-1]`–`[D-4]`; reviewed 2026-09-04.

---

## 3. Butters, triglycerides, plant oils, esters, hydrocarbons

**Normalized name / representative aliases**
*Butters / heavy:* `Butyrospermum Parkii (Shea) Butter`, `Theobroma Cacao Seed Butter`,
`Mangifera Indica Seed Butter`, `Petrolatum`, `Hydrogenated Vegetable Oil`, `Cera Alba`,
`Ricinus Communis Seed Oil`,
**`Lanolin` / wool wax and its derivatives `(R8, 2026-09-14)`** — `Lanolin`, `Lanolin Alcohol`,
`Lanolin Oil`, `Hydrogenated Lanolin`, `Cera Lanae`, `PEG-75 Lanolin`.
*Triglycerides / plant oils:* `Cocos Nucifera (Coconut) Oil`, `Argania Spinosa Kernel Oil`,
`Olea Europaea Fruit Oil`, `Persea Gratissima (Avocado) Oil`, `Glycine Soja Oil`,
`Helianthus Annuus Seed Oil`, `Prunus Armeniaca Kernel Oil`, `Macadamia Integrifolia Seed Oil`,
`Caprylic/Capric Triglyceride`.
*Light esters:* `Isopropyl Myristate`, `Isopropyl Palmitate`, `Isoamyl Laurate`,
`Isopropyl Isostearate`, `Cetyl Esters`, `Coco-Caprylate/Caprate`, `Ethylhexyl Stearate`,
`Dicaprylyl Carbonate`, `Ethylhexyl Palmitate`.
*Hydrocarbons:* `Paraffinum Liquidum / Mineral Oil`, `Squalane`, `Isohexadecane`,
`Hydrogenated Polyisobutene`, `C13-15 Alkane`.

**Functional family** — emollients / occlusives / surface lipids.

**Directly supported functions**
- Surface lubrication, softening, hydrophobicity, raised specular reflection (gloss).
- **Coconut oil specifically:** as a lauric-acid triglyceride with low MW and a straight chain it
  penetrates the fibre and reduced wash-induced protein loss in the Rele & Mohile comparison;
  mineral oil (hydrocarbon) and sunflower oil (bulky, unsaturated) did not. `[P-3]`
- Oil uptake is more damage-/porosity-dependent than warmth-dependent. `[P-4]`

**Mask-specific evidence role**
- **Primary `weight_potential` driver above the tail** — the best-supported axis in the category
  (prior pass §8). Three weight bands, by band not by threshold:
  - *heavy:* butters, `Ricinus Communis`, petrolatum, hydrogenated fats, dense triglycerides,
    **lanolin / wool wax and its derivatives `(R8, 2026-09-14)`** — an occlusive wax-ester
    complex, so it sits in the heavy band beside petrolatum and the hydrogenated fats, and counts
    as an **R4b heavy lipid** for the standard's `weight_potential` anchors (§9.2) and its
    lipid-led moisture-focus guard (§9.5.3 criterion 2). It had no entry in v0.1, so a lanolin
    reading rested on reviewer judgment; it is now lexicon-backed. **`Lanolin Alcohol` is a
    lanolin fraction, not a family-2 long-chain fatty alcohol** — it earns R4b heavy-lipid credit
    and must **not** be counted toward S2 or toward the dense/thin fatty-base tests;
  - *mid:* conventional plant triglycerides (argan, avocado, olive, soy, apricot kernel);
  - *light / weight-neutral:* light esters and light hydrocarbons. Spreading-value data places
    `Isoamyl Laurate` in the high-spreading class (~1000–1700 mm²/10 min) and
    `Isopropyl Myristate` in the medium class (~500–999 mm²/10 min). `[I-2]` These are formulation-
    tier figures for a *sensory* property; use them for band ordering only, never as a numeric input.
- Supports `care_direction: moisture` (emollient base) and, for light esters plus a smoothing
  film, `shine` focus.
- **Above-tail vs tail is decisive here.** Gliss 4-in-1 lists `Butyrospermum Parkii Butter` at 13
  and `Prunus Armeniaca Kernel Oil` at 16, both **after** Parfum @11 — despite "Öl" positioning,
  these lipids are decorative and carry **zero** weight credit. `[D-2]` Contrast
  `Isopropyl Myristate` @6 in the same list, which is above-tail and does count (as a *light* ester).

**Exclusions / common false positives**
- **Hero-oil naming is never evidence.** `Öl-Kur`, `Arganöl`, `Kokos`, `Oil Repair` on pack say
  nothing about above-tail lipid load. Check the rank.
- **Coconut-oil protein-loss evidence does not transfer.** `[P-3]` tested oil applied as a
  pre-wash/post-wash grooming step at effectively neat concentration — not a low-percentage lipid
  in a rinse-out emulsion. Never use it to give a mask a repair or protein-protection property.
- Presence ≠ penetration ≠ repair. No oil may raise `repair_support_level` or feed `bond_route`.
- **No "seals in moisture" / "locks the cuticle" reading.** Not supported and not permitted in copy.
- Trace botanical extracts in oil form (`... Seed Oil` deep in the tail) are marketing tokens.
- `Cetyl Esters` and `Glyceryl Stearate` look lipid-like but are wax/emulsifier respectively —
  `Glyceryl Stearate` belongs in family 10 and earns no weight credit.

**Source and review date** — `[P-3]`, `[P-4]`, `[I-2]`, `[D-2]`; reviewed 2026-09-04.

---

## 4. Silicones

**Normalized name / representative aliases**
*Non-functional:* `Dimethicone`, `Dimethiconol`, `Phenyl Trimethicone`, `Behenoxy Dimethicone`.
*Amino-functional:* `Amodimethicone`, `Bis-Aminopropyl Dimethicone`,
`Bis-Cetearyl Amodimethicone`, `Trimethylsilylamodimethicone`, `Aminopropyl Dimethicone`.
*Volatile carriers:* `Cyclopentasiloxane`, `Cyclomethicone`, `Cyclohexasiloxane`.
*Water-dispersible:* `PEG-12 Dimethicone`, `Dimethicone PEG-8 Meadowfoamate`,
`Bis-PEG-18 Methyl Ether Dimethyl Silane`.
Emulsion co-declarations that travel with them: `Trideceth-6`, `Trideceth-10`, `Cetrimonium Chloride`.

**Functional family** — deposited smoothing / friction-reduction / optical film formers.

**Directly supported functions**
- Friction reduction, cuticle-edge smoothing, static control, raised specular reflection (shine),
  improved wet and dry combing.
- **Amodimethicone deposits preferentially on damaged, more anionic fibre regions** and is more
  wash-resistant than non-functional dimethicone, because of its protonatable amine groups. The
  *direction* of this is well accepted; the specific percentages that circulate (a "23% more on
  damaged sections", a ">65% vs <25% retention after three washes") trace to secondary blog
  sources and **could not be verified at source** — do not use numbers. `[Pr-2]`

**Mask-specific evidence role**
- **`shine` focus** and **`smoothing` focus** — the main honest role. Subject to D2's
  anti-double-counting: shine is never a free add-on of a smoothing film; it needs its own
  distinct optical-emphasis architecture (prior pass §7).
- **`weight_potential` — secondary modifier only.** The prior pass §8 verdict stands: fatty-alcohol
  and butter load, not silicone presence, is the main weight driver. Only a heavy, occlusive,
  non-volatile stack (e.g. high-viscosity dimethicone + dimethiconol above the tail) nudges weight,
  and never on its own.
- Amino silicones may support a *comparative* smoothing-on-damaged-hair reading; they do **not**
  raise `repair_support_level`.

**Exclusions / common false positives**
- **Amino silicone is NOT bond chemistry.** `Amodimethicone` and `Bis-Aminopropyl Dimethicone`
  contain "amino" and appear in products marketed as repair/bond. They can never contribute to
  `bond_route` or gate `repair_support_level: high`. This is an explicit non-qualifier (family 6).
- **Volatile cyclosiloxanes are carriers, not payload.** `Cyclopentasiloxane` / `Cyclomethicone`
  evaporate; they deposit nothing and must earn zero weight, zero shine, zero conditioning credit.
  Note also that D5 (cyclopentasiloxane) is EU-restricted in rinse-off products — its appearance in
  a current German rinse-off mask list should prompt a **label-vintage check**, not a property call.
- **Silicone presence is not buildup evidence.** Buildup/cumulative residue is explicitly *not
  formula-inferable* (property set, "Not formula-inferable"). Silicone-free positioning is likewise
  not a care property. `[Pr-1]`
- **Silicone presence is not a fine-hair exclusion.** Prior pass §8: fine-hair flattening is a fit
  mismatch, not a hair-type law; microemulsion silicone evidence shows fine hair can benefit.
- Tail-position silicone (Gliss `Amodimethicone` @12, after Parfum @11 `[D-2]`; Elsève
  `Amodimethicone` @13, after Parfum @4 `[D-3]`) earns nothing, however prominent the pack claim.

**Source and review date** — `[Pr-1]`, `[Pr-2]`, `[R-2]`, `[D-2]`, `[D-3]`; reviewed 2026-09-04.

---

## 5. Hydrolysed proteins/peptides vs free amino acids vs vitamins

Three chemically distinct groups that share marketing language. They must never be pooled.

### 5a. Hydrolysed proteins and protein-derived film formers

**Aliases** — `Hydrolyzed Keratin`, `Hydrolyzed Wheat Protein`, `Hydrolyzed Soy Protein`,
`Hydrolyzed Corn Protein`, `Hydrolyzed Rice Protein`, `Hydrolyzed Oat Protein`,
`Hydrolyzed Silk`, `Hydrolyzed Collagen`, `Hydrolyzed Quinoa Protein`,
`Hydrolyzed Vegetable Protein`, `Sericin`, `Keratin`, `Hydrolyzed Casein`.
Cationised (higher substantivity): `Hydroxypropyltrimonium Hydrolyzed Wheat Protein`,
`Cocodimonium Hydroxypropyl Hydrolyzed Keratin`, `Hydroxypropyltrimonium Hydrolyzed Keratin`.

**Functional family** — substantive protein film formers / partially penetrating peptides.

**Directly supported functions**
- Molecular weight governs behaviour: low-MW (~221 Da) and mid-MW (~2.6 kDa) hydrolysed keratins
  penetrated into the cortex; high-MW (~75 kDa) adsorbed at the surface with at most slight
  penetration of the outer layers. Mid- and high-MW both raised Young's modulus and reduced
  breakage at 20% and 80% RH. `[P-5]`
- Cationised protein derivatives deposit more substantively than neutral hydrolysates.

**Mask-specific evidence role**
- **`care_direction: protein`** — this family is the *only* qualifying route. Qualification is a
  film-route judgment, not a token count: at least one hydrolysed protein/peptide **above the
  tail**, read together with cluster breadth and rank band. Balea Professional Keratin Repair is a
  clear positive (keratin @7, wheat @9, soy @10, corn @11, all above Parfum @18) `[D-1]`; Gliss
  4-in-1 is borderline-single (keratin @10, Parfum @11) `[D-2]`.
- **`repair` focus** — supporting, comparative only. Never `repair_support_level: high` (family 6
  owns that gate).
- **`care_direction: balanced`** — reserved for a *substantive* protein route co-existing with a
  substantive humectant/emollient route (D6). Never a "neither" bucket.

**Exclusions / common false positives**
- **INCI does not disclose molecular weight.** `[P-5]` is the strongest mechanics evidence in this
  family and it is *entirely MW-conditional* — and MW is invisible on a label. Therefore a
  hydrolysed protein on a list can never support a penetration, strength, or breakage-reduction
  claim for that product. It supports "a protein film route is present", nothing more.
- **Hydrolysed protein alone is never bond evidence** (family 6 non-qualifier; prior pass §6).
- **Never diagnose "protein overload".** Not an established condition (prior pass §5). Heavy
  protein payload is an internal counter-signal and human-review trigger (D4), never a field,
  never a verdict, never copy.
- `Hydrolyzed Hyaluronic Acid` is a humectant (family 7) despite "hydrolyzed".
- Cationic guar / `Cassia Hydroxypropyltrimonium Chloride` are polysaccharides, not proteins
  (family 9).

**Source and review date** — `[P-5]`, `[P-6]`, `[D-1]`, `[D-2]`; reviewed 2026-09-04.

### 5b. Free amino acids

**Aliases** — `Glutamic Acid`, `Arginine`, `Histidine`, `Serine`, `Glycine`, `Alanine`,
`Threonine`, `Cysteine`, `Sodium Glutamate`, `Arginine HCl`, `Sodium PCA` (also family 7).

**Functional family** — small-molecule amino acids; pH/buffer, neutraliser, weak humectant.

**Directly supported functions** — buffering; salt formation with amidoamines; hygroscopicity.

**Mask-specific evidence role** — essentially **none as a care property**. At most a very weak
contribution to the humectant cluster (family 7) when several appear above the tail with no
plausible neutraliser role.

**Exclusions / common false positives**
- **Free amino acids do NOT establish a protein film route** — no polymer, no film, no
  `care_direction: protein` contribution. Explicit rule.
- **Free amino acids do NOT establish a bond route** — `Cysteine` and `Arginine` in particular are
  frequently read as "bond" or "keratin rebuilding". They are explicit non-qualifiers (family 6).
- **`Glutamic Acid` is very often the amidoamine neutraliser**, exactly like lactic/citric acid
  `[P-2]` — see §13.
- "Aminosäuren" front-of-pack is positioning, not architecture.

**Source and review date** — `[P-2]`; reviewed 2026-09-04.

### 5c. Vitamins and vitamin-adjacent tokens

**Aliases** — `Panthenol` / `D-Panthenol` / `Panthenyl Ethyl Ether`, `Biotin`, `Niacinamide`,
`Tocopherol` / `Tocopheryl Acetate`, `Ascorbic Acid`, `Pyridoxine HCl`, `Retinol`.

**Functional family** — mixed; mostly humectant (panthenol), antioxidant (tocopherol), or
marketing token (biotin, niacinamide, retinol in a rinse-off mask).

**Mask-specific evidence role**
- `Panthenol` counts as one member of the **humectant cluster** (family 7). Nothing else.
- `Tocopherol` is normally an oil-phase antioxidant protecting the formula, not the hair.

**Exclusions / common false positives**
- **Vitamins never establish a protein route or a bond route.**
- **`Biotin` in a rinse-out mask earns zero credit on every property.** Topical biotin has no
  established fibre or growth benefit; the underlying evidence base concerns oral supplementation
  in diagnosed deficiency. Treat as a pure marketing token, and keep it away from any hair-loss-
  adjacent language (project rule: cosmetic guidance separated from medically adjacent guidance).
- `Niacinamide` and `Retinol` in a rinse-off hair mask are tokens; do not import skin-side evidence.

**Source and review date** — practitioner/consensus, no strong hair-specific source found;
reviewed 2026-09-04. Marked **low evidence** (§15, W3).

---

## 6. Named bond chemistries — the only deterministic family

**Normalized name / representative aliases**

| Route | Required INCI | Notes |
| --- | --- | --- |
| `maleate` | `Bis-Aminopropyl Diglycol Dimaleate` | Olaplex-type; also `Bis-Aminopropyl Dimaleate` variants |
| `gluconamide` | `Hydroxypropylgluconamide` **and** `Hydroxypropylammonium Gluconate` | Ashland FiberHance BM; supplied and used as a pair — a lone gluconate is not the route |
| `peptide` | `sh-Oligopeptide-78` (K18-type), `sh-Polypeptide-` series | Essentially absent from German drugstore rinse-out masks |

**Functional family** — named repair chemistries claiming intra-fibre covalent or ionic bridging.

**Directly supported functions**
- *Maleate:* maleate esters act as α,β-unsaturated Michael acceptors toward free thiol groups
  produced when disulfide bonds break, forming new covalent links; structural changes in bleached
  hair keratin after treatment have been investigated by IR/Raman + SEM. `[P-7]`
- *Gluconamide pair:* independent peer-reviewed work exists (crystallography/interaction study with
  amino acids) and it **explicitly states the mechanism by which the mixture affects hair is not
  known**, proposing strongly hydrogen-bonded salt bridges as a possible substitute for damaged
  disulfide bridges. `[P-8]`
- *Peptide:* sh-Oligopeptide-78 is a recombinant biomimetic peptide with a type-II-keratin-derived
  sequence. No independent peer-reviewed efficacy study was found; the "clinically proven" claims
  are brand-held. `[Pr-3]`

**Mask-specific evidence role**
- **Deterministic:** populates `bond_route ∈ {maleate, gluconamide, peptide, none}` by named INCI
  presence **above the tail marker**, and is the **sole gate** for `repair_support_level: high`
  (property set, trace-level additions).
- Gliss 4-in-1 is the canonical positive: `Hydroxypropylgluconamide` @8 + `Hydroxypropylammonium
  Gluconate` @9, above Parfum @11 → `bond_route: gluconamide`. `[D-2]`
- Below the tail marker → `none`. Route presence is **architecture evidence, never efficacy**;
  language stays comparative (prior pass §6).

**Exclusions / explicit NON-qualifiers (closed list — none of these may ever set `bond_route`)**
- `Citric Acid`, `Lactic Acid`, `Glycolic Acid`, `Malic Acid`, `Tartaric Acid`, `Sodium Citrate`,
  `Gluconolactone`, `Maleic Acid` on its own.
- Any hydrolysed protein, cationised protein, or `Keratin` alone.
- Any free amino acid, including `Cysteine` and `Arginine`.
- Any amino silicone: `Amodimethicone`, `Bis-Aminopropyl Dimethicone`,
  `Trimethylsilylamodimethicone`.
- Any cationic polymer or polyquaternium.
- **Front-of-pack naming**: "Bond", "Bonding", "-plex", "Bond Repair", "Bond Aufbau",
  "Molecular Repair", "Bindungsaufbau". Positioning is not chemistry (prior pass §6: "Bond"
  front-of-pack is frequently an ordinary rich mask).
- `Ceramide`, `Cholesterol`, `18-MEA` (family 11).

**Honest evidence limits (do not soften)**
- None of the three routes has strong independent product-level substantiation at drugstore
  concentrations.
- The circulating "+38% intact disulfide bonds after 8 weeks at 2%" figure comes from a supplier
  blog citing an un-locatable 2020 institute study; **unverified, do not use**. `[X-1]`
- The gluconamide mechanism is stated as unknown by its own peer-reviewed literature. `[P-8]`

**Source and review date** — `[P-7]`, `[P-8]`, `[Pr-3]`, `[D-2]`, `[X-1]`; reviewed 2026-09-04.

---

## 7. Humectants

**Normalized name / representative aliases**
`Glycerin`, `Panthenol`, `Sodium Hyaluronate` / `Hyaluronic Acid` / `Hydrolyzed Hyaluronic Acid`
/ `Sodium Acetylated Hyaluronate`, `Aloe Barbadensis Leaf Juice` (and `... Extract`,
`... Juice Powder`), `Urea`, `Betaine`, `Sodium PCA`, `Sorbitol`, `Trehalose`, `Inositol`,
`Mel` (honey), `Fructose`/`Glucose`, `Glycereth-26`, `Saccharide Isomerate`.
Glycol subgroup (dual-role, see counter-signal): `Propylene Glycol`, `Dipropylene Glycol`,
`Butylene Glycol`, `Pentylene Glycol`, `Caprylyl Glycol`, `1,2-Hexanediol`.

**Functional family** — water-binding small molecules; several double as solvents, viscosity aids,
freeze-thaw stabilisers, or preservative boosters.

**Directly supported functions** — hygroscopic water binding and plasticisation of the fibre in a
formulation sense. The hair-specific outcome evidence is **weak**: most citable material is
supplier- or blog-tier, and hair-fibre hydration endpoints are rarely measured in published work.

**Mask-specific evidence role — the moisture-focus cluster rule**
- Feeds `primary_focus`/`secondary_focus` = `moisture` under the D5 guard: **glycerin alone never
  qualifies**; `moisture` requires **at least two further distinct humectants above the tail** and
  no richer special-purpose route winning.
- The lexicon corroborates the guard from the market side: glycerin sits at rank 3–5 in Balea
  Professional Express Kur Wonderful Repair, Oil Repair Intensiv Express Kur, Glossy & Long
  Haarkur, Keratin Repair Haarkur, and Gliss 4-in-1 `[D-1]` `[D-2]` `[D-4]` — i.e. **glycerin is a
  base ingredient of the category, present regardless of positioning**. Its rank carries no
  moisture signal whatsoever.
- Feeds `care_direction: moisture` as part of the base architecture (D6).

**Counter-signals**
- **Glycols double as solvents.** `Propylene`/`Dipropylene`/`Butylene`/`Pentylene Glycol`,
  `Caprylyl Glycol` and `1,2-Hexanediol` are routinely used as extract carriers and preservative
  boosters. When a glycol appears adjacent to the preservative block, or alongside a fragrance or
  botanical extract, treat the solvent role as the more likely one and **discount it in cluster
  counting** unless it appears in `head`. `Caprylyl Glycol` and `1,2-Hexanediol` should be
  discounted by default (near-always antimicrobial boosters).
- **Aloe is usually reconstituted powder at trace level.** `Aloe Barbadensis Leaf Juice` derived
  from `... Juice Powder` is unquantifiable from the list. Count at most once, never as a strong
  member.
- `Glycerin` also functions as a viscosity/freeze-thaw aid — another reason presence alone is inert.

**Exclusions / common false positives**
- Humectant presence never proves a hydration *outcome*. E2 wording per D5: "humectant-forward
  comparative direction", never proven hydration.
- **"Hygral fatigue" is not an established condition** — a practitioner/consumer construct with no
  clinical standing. It must never appear as a rule, a warning, or copy. Same discipline as the
  prior pass's §5 handling of "protein overload".
- Hyaluronic acid's skin evidence does not transfer to the hair fibre; do not import it.
- `Urea` at cosmetic levels in a rinse-off mask is a humectant, not a keratolytic — no
  scalp/medical reading (project rule: cosmetic vs medically adjacent stay separate).
- Sub-tail hyaluronate/urea "hero" tokens earn nothing.

**Source and review date** — `[Pr-4]`, `[I-3]`, `[D-1]`, `[D-2]`, `[D-4]`; reviewed 2026-09-04.
Marked **weak/mixed evidence** (§15, W1).

---

## 8. Acids and pH adjusters

**Normalized name / representative aliases**
`Glycolic Acid`, `Lactic Acid`, `Citric Acid`, `Malic Acid`, `Tartaric Acid`, `Sodium Citrate`,
`Sodium Hydroxide`, `Gluconolactone`, `Xylose` (glycolic-gloss system co-ingredient).

**Functional family** — pH adjusters, amidoamine activators, and (glycolic) a claim-bearing
"gloss/lamination" token.

**Directly supported functions**
- pH control of the finished emulsion; salt formation that activates amidoamine conditioners. `[P-2]`
- Glycolic acid on hair: temporary plasticisation — a *decrease* in Young's modulus — and an
  optical/surface effect. It does not seal, does not bond, does not produce a lasting structural
  change. `[I-4]` (prior pass §7).

**Mask-specific evidence role**
- **Near-zero as a care property.** Two legitimate reads only:
  1. **pH adjuster / amidoamine neutraliser** — near-certain when an amidoamine is present
     (Balea Professional Keratin Repair: SAPDMA @3, Lactic Acid @4 `[D-1]`; Gliss: Behenamidopropyl
     Dimethylamine @7, Lactic Acid @14 `[D-2]`).
  2. **Glycolic "Gloss/Lamination" positioning** — routes through the `shine` focus threshold with
     claim corroboration, *provided* the formula independently carries a distinct optical-emphasis
     architecture (prior pass §7, D2). There is **no lamination property** and there will not be one.
- `care_direction` for a gloss/lamination mask is decided by the care base it actually carries,
  not by the acid (D6).

**Exclusions / common false positives**
- **Never bond evidence** (family 6 non-qualifier). Citric acid is a ubiquitous pH adjuster;
  "bonding" claims resting on it are claim-only (prior pass §6).
- **No "sealing", "closing the cuticle", "laminating", "versiegeln" language** — not supported.
- **Acid rank is usually deep-tail and meaningless.** In the L'Oréal Elsève Glycolic Gloss Mask,
  `Glycolic Acid` is the **final** listed ingredient, far below Parfum @4 `[D-3]` — the hero acid
  is a sub-1% claim carrier in a structurally minimal, single-cationic, lipid-free mask. Use this
  as the standing reminder that acid-led positioning and acid-led architecture are unrelated.
- Glycolic acid's skin-exfoliation evidence must never be imported into a hair-fibre reading.

**Source and review date** — `[P-2]`, `[I-4]`, `[D-1]`, `[D-2]`, `[D-3]`; reviewed 2026-09-04.

---

## 9. Cationic polymers and film formers

**Normalized name / representative aliases**
`Polyquaternium-4`, `-6`, `-7`, `-10`, `-11`, `-22`, `-28`, `-37`, `-47`, `-67`, `-87`;
`Guar Hydroxypropyltrimonium Chloride`; `Hydroxypropyl Guar Hydroxypropyltrimonium Chloride`;
`Cassia Hydroxypropyltrimonium Chloride`; `Starch Hydroxypropyltrimonium Chloride`;
`Polyquaternium-10 (Cellulose)`; `PVP`; `VP/VA Copolymer`.

**Functional family** — substantive cationic polymers; deposition modifiers and secondary
conditioning route.

**Directly supported functions**
- Direct substantivity to the anionic fibre surface → wet detangling, static control, smoother
  wet feel.
- **Deposition modification**: cationic polymers complex with anionic surfactant on dilution and
  phase-separate (coacervation / "Lochhead effect"), enhancing deposition of silicone and other
  actives. `[I-5]` **Caveat:** this mechanism is characterised primarily in *shampoo* dilution.
  In a rinse-out mask (no anionic surfactant system) the polymer's role is direct substantivity
  plus film formation, and the coacervate argument does **not** carry over unchanged.

**Mask-specific evidence role**
- Supports `detangling` and `smoothing` focus, subject to D2 distinctiveness gates.
- Contributes modestly to `conditioning_level` as the "broader secondary conditioning polymer set"
  the prior pass §1 identified as a mask-leaning (not mask-exclusive) shift.
- **One polyquaternium or one cationic guar is baseline** — Balea Professional Keratin Repair
  carries `Guar Hydroxypropyltrimonium Chloride` @13 `[D-1]`. Only unusual breadth above the tail
  is a signal, and a weak one.

**Exclusions / common false positives**
- **Not automatic repair.** Polymer film ≠ fibre repair. Never raises `repair_support_level`,
  never contributes to `bond_route`.
- **Not protein.** Cationic guar, cassia, and starch derivatives are polysaccharides, despite
  "conditioning protein" style marketing.
- **Not weight.** Used at fractions of a percent; do not credit `weight_potential`.
- Must not be counted toward the family-1 cationic-surfactant stack.
- Film-former presence is not buildup evidence (not formula-inferable).

**Source and review date** — `[I-5]`, `[D-1]`; reviewed 2026-09-04. Marked **moderate evidence**
for the direct-substantivity role, **transfer-limited** for coacervation (§15, W2).

---

## 10. Rheology-only and structural ingredients — FALSE-SIGNAL register

**Normalized name / representative aliases**
*Thickeners/gellants:* `Xanthan Gum`, `Hydroxyethylcellulose`, `Cellulose Gum`, `Carbomer`,
`Acrylates/C10-30 Alkyl Acrylate Crosspolymer`, `Sodium Polyacrylate`,
`Cetyl Hydroxyethylcellulose`, `Sclerotium Gum`, `Sodium Chloride`.
*Emulsifiers/solubilisers:* `Ceteareth-20`, `Ceteareth-25`, `Steareth-20`, `Steareth-21`,
`Trideceth-6`, `Trideceth-10`, `Polysorbate-20/-60`, `PEG-40 Hydrogenated Castor Oil`,
`Glyceryl Stearate`, `PEG-100 Stearate`, `Cetearyl Glucoside`, `C12-20 Alkyl Glucoside`.
*Opacifiers/fillers:* `Kaolin`, `Silica`, `Bentonite`, `Magnesium Aluminum Silicate`,
`Glycol Distearate`, `Mica`, `Titanium Dioxide`.
*Chelators `(R8, 2026-09-14 — reconciled with Standard §3.1; one union list in both files)`:*
`Disodium EDTA`, `Tetrasodium EDTA`, `Tetrasodium Glutamate Diacetate`,
`Trisodium Ethylenediamine Disuccinate`, `Etidronic Acid`, `Phytic Acid` / `Sodium Phytate`.
**All six are marker-eligible** (§0.2) and carry zero care credit.
*pH salts and electrolytes — NOT chelators and NOT marker-eligible `(R8, 2026-09-14)`:*
`Sodium Hydroxide`, `Sodium Chloride`. v0.1 filed these under the chelator label; they chelate
nothing, their position on a list is unconstrained, and treating either as a boundary marker would
set `tail_marker_index` from a viscosity or pH adjustment. They stay in family 10 with zero credit.
`Citric Acid` likewise is never a marker (family 8; Standard §3.1).

**Functional family** — formulation infrastructure. No care payload.

**Directly supported functions** — viscosity, emulsion stability, solubilisation, opacity,
chelation. That is the complete list.

**Mask-specific evidence role — explicitly ZERO**
No credit for `conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`,
`bond_route`, or any focus value. This family exists in the lexicon **so that it can be actively
subtracted**, implementing the prior pass §2 false-signal rule: *bottle texture is not care
payload*, and ingredient count is not payload either.

**Exclusions / common false positives**
- **`Glyceryl Stearate` reads as a lipid but is an emulsifier.** Frequent misclassification.
- **`Kaolin` reads as a "clay treatment mask" but is an opacifier/bulking agent** — Balea
  Professional Keratin Repair carries it at @8, above the tail, and it must earn nothing `[D-1]`.
- **`Ceteareth-20` / `Trideceth-10` in the tail are silicone and fragrance solubilisers** — normal,
  meaningless (Gliss @18/@19 `[D-2]`).
- **A thick, rich *feel* is rheology.** `Xanthan Gum` + `Carbomer` can make a thin formula feel
  like a heavy Kur. Never let it move `weight_potential`.
- **Long ingredient lists are not richer masks.** Count is not payload.
- `Cetearyl Alcohol` is *not* in this family — it is a genuine structurant and emollient (family 2).
  Keep that line sharp: the emulsifier half of a `Cetearyl Alcohol / Ceteareth-20` blend is inert,
  the fatty-alcohol half is not.

**Source and review date** — `[I-1]`, `[D-1]`, `[D-2]`; reviewed 2026-09-04.

---

## 11. Ceramides, glycosphingolipids, cholesterol, 18-MEA

**Normalized name / representative aliases**
`Ceramide NP` (Ceramide 3), `Ceramide AP`, `Ceramide EOP`, `Ceramide NG`, `Ceramide NS`,
`Ceramide 2`, `Glycosphingolipids`, `Sphingolipids`, `Phytosphingosine`, `Cholesterol`,
`Hydroxypropyl Bispalmitamide MEA` (pseudo-ceramide), `Behenoyl PG-Trimonium Chloride`,
18-MEA family: `Methyl Eicosanoate`, `Cetrimonium Methyl Eicosanoate`,
`18-Methyleicosanoic Acid`, `Hydroxypropyl Bislauramide MEA`.

**Functional family** — surface/cell-membrane-complex lipid support.

**Directly supported functions**
- 18-MEA is the principal covalently bound lipid of the hair's F-layer/epicuticle and is
  responsible for native surface hydrophobicity; it is degraded by bleaching, UV, and grooming.
  `[P-9]`
- Quaternised or cationic-surfactant-delivered 18-MEA deposits selectively on damaged hair and can
  restore hydrophobicity, reduce combing friction and tangling, and increase shine. `[I-6]`
- A ceramide-2 analogue improved combability, flattened lifted cuticles, restored hydrophobicity of
  damaged hair and increased damaged-fibre strength in supplier-published work. `[I-7]`

**Mask-specific evidence role**
- **Weak supportive lipid signal only.** May *reinforce* an already-supported `smoothing` or
  `shine` focus, or a `care_direction: moisture` emollient base. It never establishes one alone.
- Contributes nothing to `weight_potential` (used at trace).

**Exclusions / common false positives**
- **Not repair proof.** Never raises `repair_support_level`, never contributes to `bond_route`
  (explicit family-6 non-qualifier). "Ceramid" front-of-pack is not a repair route.
- **Skin evidence does not transfer.** The robust ceramide literature is skin-barrier work; the
  hair-specific material is thin and largely supplier-published (conflict of interest).
- **Almost always tail-position in German drugstore masks** — the hero-token pattern. Then it earns
  literally nothing, per §0.2.
- `Cholesterol` alone is a lipid/emulsion component, not a ceramide route.
- "Restores the F-layer" / "rebuilds the cuticle" is not supportable for a rinse-out drugstore
  mask; the covalent-anchoring work `[P-9]` concerns dedicated bioconjugation chemistry, not a
  ceramide token in a Kur.

**Source and review date** — `[P-9]`, `[I-6]`, `[I-7]`; reviewed 2026-09-04. Marked **weak
evidence**, supplier-dominated (§15, W4).

---

## 12. Fragrance and preservative tail markers

**Normalized name / representative aliases**
*Fragrance:* `Parfum`, `Fragrance`, `Aroma`, `Linalool`, `Limonene`, `Geraniol`, `Citronellol`,
`Hexyl Cinnamal`, `Alpha-Isomethyl Ionone`, `Benzyl Salicylate`, `Benzyl Benzoate`, `Coumarin`,
`Eugenol`, `Amyl Cinnamal`, `Hydroxycitronellal`, `Butylphenyl Methylpropional` (see below),
`Citral`, `Farnesol`.
*Preservatives:* `Phenoxyethanol`, `Sodium Benzoate`, `Potassium Sorbate`, `Benzyl Alcohol`,
`Benzoic Acid`, `Methylisothiazolinone`, `Methylparaben`, `Propylparaben`, `DMDM Hydantoin`,
`Sodium Hydroxymethylglycinate`, `Chlorhexidine Digluconate`, `Dehydroacetic Acid`,
`Sodium Dehydroacetate`, **`Leuconostoc/Radish Root Ferment Filtrate` `(R8, 2026-09-14)`** — the
standard "naturkosmetik" ferment preservative; without it, a naturally-preserved mask reads as
marker-absent and its whole list is treated as above-tail.
*Preservative boosters, marker-eligible only alongside a preservative above
`(R8, 2026-09-14)`:* **`Ethylhexylglycerin`**, `Caprylyl Glycol`, `1,2-Hexanediol`,
`Glyceryl Caprylate`, `Caprylhydroxamic Acid`.
*Trace chelators, marker-eligible `(R8, 2026-09-14)`:* `Disodium EDTA`, `Tetrasodium EDTA`,
`Tetrasodium Glutamate Diacetate`, `Trisodium Ethylenediamine Disuccinate`, `Etidronic Acid`,
`Phytic Acid` / `Sodium Phytate` (see family 10 for the full reconciled list).
*Colourants — **NOT marker-eligible** `(R8, 2026-09-14)`:* `CI 19140`, `CI 42090`, `CI 77891`, etc.

**Functional family** — sensory and shelf-life infrastructure.

**Mask-specific evidence role — the rank boundary, and nothing else**
- This family's entire engine role is to define `tail_marker_index` (§0.2) and thereby the
  above-tail/tail split that every other family depends on.
- **Zero care credit for every property.** No focus, no weight, no conditioning, no repair.
- **Colourants earn the zero credit but do not set the boundary `(R8, 2026-09-14)`.** A CI number
  may no longer define `tail_marker_index` — see the precedence note in §0.2. Above the tail it is
  recorded as a formula fact and earns nothing (like `Titanium Dioxide` and `Mica`, family 10);
  at or after the tail it is an ordinary tail member. **A list whose only near-boundary declaration
  is a CI number is read as marker-absent**, with the §0.2 fallback and the standard's
  `tail_marker_anomaly` trigger, never as marker-present-at-the-pigment.

**Exclusions, false positives, and label-vintage traps**
- **Do not read allergen-block length as a formulation difference.** Regulation (EU) 2023/1545
  expands individually declared fragrance allergens from 24 to 80 substances (>0.001% leave-on,
  >0.01% rinse-off), mandatory for products newly placed on the EU market from **31 July 2026**,
  with existing stock permitted until **31 July 2028**. `[R-3]` Two masks can therefore show very
  different allergen-block lengths purely from label vintage. The tail also gets *longer and
  noisier* through this transition — one more reason never to rank within it.
- **`Butylphenyl Methylpropional` (Lilial) is EU-banned since March 2022.** Its presence marks a
  **stale label** — flag the identity for re-sourcing rather than classifying the product. `[R-4]`
- **`Methylisothiazolinone` in a rinse-off mask is normal**, not a red flag: banned in leave-on,
  still permitted rinse-off at low limits. Do not build a safety warning from it. Any
  allergy/sensitivity handling is medically adjacent and stays out of the classification engine.
- **Parfum position varies enormously** — @4 in the Elsève Glycolic Gloss Mask vs @18 in Balea
  Professional Keratin Repair `[D-1]` `[D-3]`. A short above-tail section is itself informative
  (a structurally minimal formula), but it is *not* evidence of a bad or a weak product; it is
  evidence that little can be inferred.
- The marker-failure fallback in §0.2 applies; when it also fails, mark the boundary **`absent`**
  and cap confidence rather than guessing `(R8, 2026-09-14 — state name aligned with the standard;`
  `unresolved` now names the *implausible*-marker state, not the missing-marker one)`.

**Source and review date** — `[R-1]`, `[R-3]`, `[R-4]`, `[D-1]`, `[D-3]`; reviewed 2026-09-04.

---

## 13. Cross-family false-positive register (quick reference)

| Observed on the list | Naive read | Correct read |
| --- | --- | --- |
| `Lactic Acid` / `Citric Acid` / `Glutamic Acid` **with** an amidoamine present | active acid / bond chemistry | amidoamine neutraliser `[P-2]` |
| `Amodimethicone`, `Bis-Aminopropyl Dimethicone` | bond/repair chemistry ("amino") | amino silicone; smoothing/shine only |
| `Cysteine`, `Arginine` | keratin/bond rebuilding | free amino acid; no film, no bond |
| `Hydrolyzed Keratin` | proven strengthening | protein film route present; MW unknown from INCI `[P-5]` |
| `Cyclopentasiloxane` / `Cyclomethicone` | heavy silicone coating | volatile carrier; deposits nothing |
| `Glyceryl Stearate` | lipid / richness | emulsifier; zero credit |
| `Kaolin` | clay treatment payload | opacifier/bulking; zero credit |
| `Xanthan Gum` + `Carbomer` making a rich texture | rich care payload | rheology only |
| `Butyrospermum Parkii Butter` below the tail marker | rich butter mask | decorative; zero weight credit `[D-2]` |
| `Glycerin` at rank 3 | moisture focus | category base ingredient; no signal `[D-1]` `[D-2]` `[D-4]` |
| `Caprylyl Glycol`, `1,2-Hexanediol` | humectants | preservative boosters; discount |
| `Guar Hydroxypropyltrimonium Chloride` | conditioning protein | cationic polysaccharide |
| `Biotin` | hair strengthening | marketing token; zero credit, keep away from hair-loss language |
| `Glycolic Acid` last on the list | lamination/sealing route | sub-1% claim carrier; optical only `[D-3]` `[I-4]` |
| Long ingredient list | richer, more loaded mask | count is not payload |
| "Bond" / "-plex" / "Bindungsaufbau" on pack | bond route | check named INCI above tail only |
| 2 distinct cationics above tail | high conditioning | near-baseline in this market `[D-1]` `[D-2]` |

---

## 14. Source register

Tiers: `[P]` peer-reviewed / primary · `[R]` regulatory · `[I]` industry & supplier formulation
literature (**interest-conflicted — corroborate**) · `[Pr]` practitioner-tier · `[D]` product-label
data · `[X]` low-trust, cited only to mark it as unusable.

| Key | Tier | Source |
| --- | --- | --- |
| `P-1` | P | Lamellar gel networks in hair conditioners, review — Adv. Colloid Interface Sci. 2025. https://www.sciencedirect.com/science/article/pii/S0001868625000302 (inherited from the prior pass) |
| `P-2` | P | Minguet et al., *Behenamidopropyl Dimethylamine: unique behaviour in solution and in hair care formulations*, Int. J. Cosmet. Sci. 2010. https://onlinelibrary.wiley.com/doi/full/10.1111/j.1468-2494.2009.00566.x |
| `P-3` | P | Rele & Mohile, *Effect of mineral oil, sunflower oil, and coconut oil on prevention of hair damage*, J. Cosmet. Sci. 2003. https://pubmed.ncbi.nlm.nih.gov/12715094/ |
| `P-4` | P | Oil penetration vs. damage — Cosmetics 2024;11(2):64. https://www.mdpi.com/2079-9284/11/2/64 (inherited) |
| `P-5` | P | Malinauskyte et al., *Penetration of different molecular weight hydrolysed keratins into hair fibres…*, Int. J. Cosmet. Sci. 2021. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7820954/ |
| `P-6` | P | Tham et al., Int. J. Cosmet. Sci. 2026. https://onlinelibrary.wiley.com/doi/10.1111/ics.70038 (inherited) |
| `P-7` | P | *Structural investigation on damaged hair keratin treated with α,β-unsaturated Michael acceptors used as repairing agents*, Int. J. Biol. Macromol. 2021. https://pubmed.ncbi.nlm.nih.gov/33279560/ |
| `P-8` | P | *Understanding the Interaction of Gluconamides and Gluconates with Amino Acids in Hair Care*, Cryst. Growth Des. 2022. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9542698/ — **states the hair mechanism is unknown** |
| `P-9` | P | *Biomimetics through bioconjugation of 16-methylheptadecanoic acid to damaged hair for hair barrier recovery*. https://pmc.ncbi.nlm.nih.gov/articles/PMC11550837/ |
| `R-1` | R | Regulation (EC) No 1223/2009, Art. 19 (ingredient labelling; descending order down to 1%). https://www.legislation.gov.uk/eur/2009/1223/article/19 |
| `R-2` | R | EU restriction of cyclosiloxanes (D4/D5) in wash-off cosmetics — REACH Annex XVII entry 70 (0.1% limit, applicable 31 Jan 2020). *Cited from regulatory knowledge; not re-fetched in this pass — verify before it gates anything.* |
| `R-3` | R | Regulation (EU) 2023/1545 — fragrance allergen labelling, 24 → 80 substances; new products from 31 Jul 2026, stock to 31 Jul 2028. https://www.alsglobal.com/en/news-and-publications/2024/07/eu-regulation-2023-1545-fragrance-allergen-labeling |
| `R-4` | R | Butylphenyl Methylpropional (Lilial) EU ban, applicable 1 March 2022 (Reg. (EU) 2021/1902). *Cited from regulatory knowledge; not re-fetched in this pass.* |
| `I-1` | I | Cationic-surfactant / gel-network formulation references (BTMS, cationic:fatty-alcohol mole ratio). https://www.globalformulation.com/hair-conditioner-cationic-surfactants-chemistry/ ; https://www.sciencedirect.com/science/article/abs/pii/S0009250921003171 |
| `I-2` | I | Emollient spreading-value classification (high ≥1000, medium 500–999, low <500 mm²/10 min); isoamyl laurate ~1000–1700, IPM medium. Supplier/patent formulation literature. |
| `I-3` | I | Humectant overview — ScienceDirect Topics. https://www.sciencedirect.com/topics/medicine-and-dentistry/humectant |
| `I-4` | I | *Glycolic acid and hair* — Cosmetics & Toiletries. https://www.cosmeticsandtoiletries.com/formulas-products/hair-care/article/21836160/ (inherited) |
| `I-5` | I | Cationic polymer deposition / coacervation ("Lochhead effect") on hair. https://www.personalcaremagazine.com/story/11816/conditioning-by-cationic-polymers-on-asian-hair |
| `I-6` | I | *Restoring Essential Hair Fiber Lipids with Quaternized 18-MEA* — Croda, Cosmetics & Toiletries. https://www.cosmeticsandtoiletries.com/cosmetic-ingredients/actives/article/21836197/ |
| `I-7` | I | *Ceramide-2 Analog for Conditioning and Barrier Benefits* — Cosmetics & Toiletries. https://www.cosmeticsandtoiletries.com/research/literature-data/article/21837070/ |
| `Pr-1` | Pr | Lab Muffin, conditioner myths (build-up, silicones, weighing hair down). https://labmuffin.com/busting-hair-conditioner-myths-build-up-silicones-weighing-hair-down-etc/ (inherited) |
| `Pr-2` | Pr | Lab Muffin, amodimethicone. https://labmuffin.com/amodimethicone-my-new-favourite-hair-ingredient/ |
| `Pr-4` | Pr | Cosmetic-chemist commentary on hair hydration and humectants (curl-hydration explainer). https://malibuc.com/blogs/blog/the-science-behind-curl-hydration-from-a-cosmetic-chemist — used only to characterise the *state* of the evidence, not to support a claim |
| `Pr-3` | Pr | sh-Oligopeptide-78 ingredient profile. https://incidecoder.com/ingredients/sh-oligopeptide-78 — brand-held efficacy claims, no independent study located |
| `D-1` | D | Balea Professional Keratin Repair Haarkur, full INCI. https://inkeedecoder.com/products/balea-professional-keratin-repair-haarkur |
| `D-2` | D | Schwarzkopf Gliss 4-in-1 Repair Bond Building Hair Mask, full INCI. https://inkeedecoder.com/products/schwarzkopf-gliss-4-in-1-repair-bond-building-hair-mask |
| `D-3` | D | L'Oréal Elsève Glycolic Gloss Mask, full INCI. https://inkeedecoder.com/products/loreal-elseve-glycolic-gloss-mask |
| `D-4` | D | Balea Professional range partial INCI heads (Express Kur Wonderful Repair, Oil Repair Intensiv Express Kur, Glossy & Long Haarkur, Natural Beauty Reparierende Haarkur) — inkeedecoder product pages |
| `X-1` | X | "+38% intact disulfide bonds, 2% bis-aminopropyl diglycol dimaleate, 8 weeks" — supplier blog citing an un-locatable 2020 institute study. **Unverified; do not use.** |

**Operational note on `[D]` sources (corrected by orchestrator, 2026-09-04):**
`incidecoder.com` currently 301-redirects to `inkeedecoder.com`. That redirect target is an
**unverified lookalike domain and must NOT be canonicalized, cited, or trusted** until its
legitimacy is established; a server-supplied redirect is not proof of a genuine rebrand.
Consequently `[D-1]`–`[D-4]` are **quarantined**: rank/alias observations grounded only on them
must be re-verified against trusted German sources (retailer pages, hautschutzengel.de, brand
sites) before any reliance — the C1 adjudication in §15 shows why (the trusted source
contradicted `[D-1]` on the load-bearing count). Existing artifacts citing `incidecoder.com`
keep their original URLs as provenance. Product-label data remains a **secondary transcription**
of a pack — a fallback tier used only to ground *aliases and rank patterns*, never to finalise
a product.

---

## 15. Weak evidence, and conflicts with the prior pass

### Conflicts and corrections

**C1 — "≥2 distinct cationics above the fragrance line" is weaker than the prior pass assumed.**
Prior pass §2 and §8 list "≥2 distinct cationics above the fragrance/preservative line" among the
honest signals for treatment concentration, and use it in the provisional `high` weight anchor.
Every German drugstore calibration list checked here carries at least two — including the
structurally modest Balea Professional Keratin Repair `[D-1]` and the Gliss bond mask, which
carries three `[D-2]`. **This does not contradict the prior pass's direction, but it does mean the
signal must be count *plus rank band*, not count alone.** Recommendation for the Phase 3 standard:
require ≥3 distinct species above the tail with at least two in `head`/early `upper` before the
cationic axis pushes toward an extreme. This is a strengthening of the "extremes require multiple
independent structural signals" rule, not a departure from it.

> **Adjudication (orchestrator, 2026-09-04): C1's factual basis is REJECTED.** The claim rests on
> `[D-1]`–`[D-4]`, transcriptions from the unverified `inkeedecoder.com` redirect target (see the
> corrected operational note below). Re-verified on the trusted German source
> (hautschutzengel.de/produkt/256492), Balea Professional Keratin Repair Haarkur carries exactly
> **one** cationic surfactant above the tail (Stearamidopropyl Dimethylamine; Guar
> Hydroxypropyltrimonium is a family-9 cationic polymer, not a cationic surfactant). Across five
> trusted-source mask formulas the above-tail cationic-surfactant counts are 3 (Gliss Bond) /
> 1 / 1 / 1 / 1 — the ≥2-count signal discriminates as the prior pass assumed. C1's kernel
> (whether a rank-band requirement sharpens S1) is retained solely as a calibration question;
> the standard's S1 stands unchanged pending calibration. C3 is unaffected and is independently
> confirmed by the trusted list (SAPDMA rank 3 + Lactic Acid rank 4).

**C2 — "gluconamide bonding has zero independent literature" needs correcting.**
Prior pass §6 records this as an open risk. Independent peer-reviewed literature **does** exist
(`[P-8]`, ACS *Crystal Growth & Design* 2022). It does not, however, help the case: it is a
crystallography/interaction study that **explicitly states the mechanism by which the mixture
affects hair is unknown**, proposing hydrogen-bonded salt bridges as a hypothesis. So the practical
conclusion — no substantiated product-level efficacy at drugstore concentration — is unchanged and
now better sourced. The risk entry should be reworded from "zero literature" to "independent
literature exists and reports the mechanism as unknown".

**C3 — new, not in the prior pass: the amidoamine/acid coupling.**
Amidoamine conditioners require acid neutralisation `[P-2]`, so `Lactic Acid`, `Citric Acid`, and
`Glutamic Acid` in these formulas are usually neutralisers. The prior pass §6 already excludes
citric acid as bond evidence; this generalises it and adds *why*, and extends it to lactic and
glutamic acid — closing a route by which "Milchsäure"/"Aminosäure" positioning could otherwise be
misread as an active.

**C4 — nothing else contradicts the prior pass.** §1 (architecture continuum), §2 (structural
position only), §3 (dwell = protocol only), §4 (heat = protocol only), §5 (no protein-overload
diagnosis), §7 (no lamination route), §8 (lipid load, not silicone, drives weight) are all carried
forward unchanged and are reinforced by the label data gathered here.

### Families where evidence was too weak for a clean role assignment

- **W1 — Humectants (family 7).** Hair-fibre hydration outcomes are poorly evidenced; almost all
  citable humectant material is supplier- or blog-tier `[I-3]` `[Pr-4]`. The cluster rule is
  defensible as a *comparative architecture* signal (which is exactly how D5 frames it), and must
  not be strengthened into an efficacy claim. "Hygral fatigue" is explicitly unestablished.
- **W2 — Cationic polymers (family 9).** Direct substantivity is solid; the coacervation evidence
  `[I-5]` is characterised in *shampoo* systems and its transfer to a surfactant-free rinse-out
  mask is unproven. Keep the polymer contribution to `conditioning_level` deliberately small.
- **W3 — Vitamins (family 5c).** No hair-specific, product-relevant source found for biotin or
  niacinamide in rinse-off. Assigned zero credit, which is the honest call, but it is an
  absence-of-evidence assignment rather than an evidenced one.
- **W4 — Ceramides / 18-MEA (family 11).** Direction is consistent but the hair-specific evidence
  is supplier-published `[I-6]` `[I-7]` (conflict of interest) with one academic bioconjugation
  paper `[P-9]` that concerns dedicated chemistry, not a ceramide token in a mask. Weak supportive
  role only; explicitly barred from repair.
- **W5 — Peptide bond route (family 6).** No independent efficacy evidence for sh-Oligopeptide-78
  `[Pr-3]`. It stays in the `bond_route` enum for completeness and because the property set already
  defines it, but it is expected to be absent from this market and would carry the weakest
  substantiation of the three routes if it appeared.
- **W6 — Esterquat vs. chloride quat.** No evidenced hair-outcome difference retrievable from an
  INCI list; deliberately left with no differentiating role.

### Open items for the Phase 3 standard (out of scope here)

1. Whether a family-1 rank-band refinement sharpens S1 (the surviving kernel of the rejected C1;
   see the adjudication note). The standard's count-based S1 stands; calibration decides whether
   rank bands add discrimination.
2. ~~How the `unresolved` tail-boundary state (§0.2 fallback) interacts with the `uncertain_fields` /
   NEQI fallback pattern and the confidence ceiling.~~ **Closed by R2 (2026-09-14):** Standard
   §3.1.1 defines the two states (`absent`, `unresolved`), their triggers, and the rule that an
   implausible marker may neither qualify nor disqualify. What remains open is the *rate* — how
   often each state fires on a real mask shelf (Standard §18.8).
4. **New under R8 (2026-09-14):** the three added tail classes and the removal of colourants from
   marker eligibility can move `tail_marker_index` on a real list. How often, and in which
   direction, is a calibration observation — not a reason to re-tune a band.
3. Whether the ≥3-humectant cluster survives once glycols and aloe are discounted per family 7 —
   this needs the calibration set to answer and may make `moisture` rarer than D5 assumed.
