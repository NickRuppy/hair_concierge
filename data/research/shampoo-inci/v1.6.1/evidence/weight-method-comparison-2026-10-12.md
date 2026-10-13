# Weight-method comparison across research engines, and a v1.6.1 proposal for "prominent" in shampoo weight (2026-10-12)

Read-only methodology review. No standard, packet or lane record was changed. Line numbers refer to the files as they are in this worktree on 2026-10-12. Shampoo rule IDs refer to `docs/research/shampoo-inci/v1.6/classification-standard.md` (below: **SH**).

Trigger: contradiction audit `plans/profi-shampoos/classification/contradiction-audit-2026-10-12.md` B1/B2. W-RICH (SH:374) builds "rich architecture" on "prominent `payload_lipid`" but gives no definition of "prominent". Lanes borrowed E3 (SH:716), which itself says it is "never a weight rule". On Parfum-last lists (Maria Nila, Vichy, OLAPLEX) E3 marks almost the whole list as prominent. The two sister formulas P01 and P02 were then read in opposite ways.

---

## 1. How each engine decides weight

### 1.1 Shampoo v1.6 (and the v1.4 method it absorbed)

| Element | Rule | Citation |
| --- | --- | --- |
| Judgment type | Whole-formula judgment with three subjudgments (`depositionLoad`, `persistence`, `resetCapacity`). "Cannot be calculated from ingredient count, route count or a position window." | SH:290, SH:346–352; v1.4 method `docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md`:24, :45–53 |
| How amount is judged | No concentration proxy. "INCI order supports formula architecture and rough prominence. It does not reveal exact concentrations." Positions are recorded as evidence only. | SH:297, SH:303; v1.4:18 |
| Payload families | `payload_lipid` (plant oils, butters, hydrogenated lipids, fatty alcohols, emollient esters/ethers), `weak_refatter`, `silicone`, `cationic_polymer`, `cationic_conditioner`, `protein_film`, `film_former`. Essential oils, PEG-hydrogenated castor oils, pearlizing waxes and acrylate thickeners are excluded. There is **no lipid banding**: sunflower oil and shea butter sit in the same family; waxy lipids get only a `persistence` nudge. | SH:307–322, SH:330–335, SH:332 |
| `high` anchor | Two routes: (1) "multiple converging and plausibly persistent depositing systems"; (2) "a clearly rich conditioning architecture (W-RICH) with limited reset". | SH:362; v1.4:61 |
| W-RICH | "prominent `payload_lipid` material converging with a silicone or cationic deposition system". **"Prominent" is not defined here.** Limited reset means `resetCapacity: weak`. | SH:374–376 |
| W1 | Silicone + guar + late amodimethicone on a buffered sulfate chassis gives `moderate`. Condition (c) excludes "a prominent `payload_lipid`", again undefined. | SH:368–372 |
| W2 / W3 | With two or more families present, `low` needs specific evidence (for example "each family is late/trace"). A balanced boundary gives `low` confidence and is never resolved lighter. | SH:378, SH:380 |
| E3 | "Prominent" = before `Parfum`/`Fragrance`, else before the first of 7 preservatives, else nothing is prominent. Used for C4/C2 and projection gates only, "never a weight rule". Fragrance allergens are explicitly **not** markers. | SH:716–718, SH:234 |
| C2 "early" | "Early means prominent (E3)." A prominent `payload_lipid` may replace the early silicone. | SH:275–276 |
| Claims | Never lower or raise weight ("ohne zu beschweren", "für feines Haar"). | SH:343 |

**Gap.** Weight has no definition of "prominent" or "late". E3 is the only position convention in the standard. Lanes fall back on it for W-RICH and W1(c) (P02 lane records, `kit/lane-*/out/PF27.json`, identity field `e3ProminenceCutoff` "positions 1–32 prominent"). Other times they refuse it (P01, `PF34.json`, lane A: "E3 is never a weight rule; the payload lipid is late in whole-formula terms").

### 1.2 Leave-in v1.0 + v1.1 overlay (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, below **LI**)

| Element | Rule | Citation |
| --- | --- | --- |
| Concentration proxy | **Tail marker**: the first concentration-capped preservative or preservative-adjacent material (Phenoxyethanol, Sodium Benzoate, Potassium Sorbate, Benzyl Alcohol, Hydroxyacetophenone, Ethylhexylglycerin, Levulinic Acid, Chlorphenesin, Dehydroacetic Acid, Caprylyl Glycol in a pair). "Above the tail" = ranked above it. Explicitly a heuristic and a bounded rank comparison, never a percentage. | LI:297, LI:299–314 |
| Fragrance allergens | **Removed as markers (T17/H2)**: declared last by convention, so they gave a near-terminal, vacuous marker. | LI:312 |
| Rank decides | "Present as architecture" is decided by the rank prong alone. Coherence is recorded but never overrides. A qualifying route below the marker routes to review. | LI:316–321 |
| Plausibility (T16) | The marker is implausible if it sits **before** the formula's own COND/WT-establishing species. It then may not disqualify anything, and the record goes to review. | LI:322 |
| Vacuity (T17/H1) | The marker is vacuous if everything at or below it is preservatives, fragrance/allergens, colourants or tail pH adjusters/chelators. It then cannot qualify anything (falls back to an ordinal read), and the record goes to review. | LI:323–336 |
| No marker | `none_visible`: ordinal read, confidence −1, review. | LI:343 |
| Early marker | A strong counter-signal, never an automatic downgrade. | LI:344 |
| Payload / banding | L3 lipids banded by spreading value: dry-feel, medium, rich (coconut/olive/castor/avocado, butters, petrolatum). | LI:497–509 |
| WT anchors | `low`: no persistent family above the tail. `moderate`: one family above the tail, or the multi-family row (≥2 families, **no rich-band member**, confidence cap `moderate`). `high`: an LGN pair above the tail, and/or ≥2 families with **at least one rich-band member**. | LI:758–766 |
| Closed rich band | Unenumerated liquid oils (sunflower, argan, apricot, soy …) are read as **medium** and never satisfy the rich-band test. | LI:768 |
| Top value | Needs multiple independent observations (G3 rule 3). | LI:606 |
| Known weakness | The marker is unvalidated (§17.14), and its variance across list lengths is the practical problem (§17.18). | LI:1842, LI:1846 |

### 1.3 Mask v1.0 (`docs/research/mask-inci/v1.0/mask-classification-standard.md`, below **MK**)

| Element | Rule | Citation |
| --- | --- | --- |
| Concentration proxy | `tail_index` = **earliest** of: fragrance (`Parfum`/`Fragrance`/`Aroma`), **any declared fragrance allergen**, a conventional preservative (incl. Benzoic Acid, Dehydroacetic Acid), a booster only when paired with a preservative, or a trace chelator (EDTA, GLDA, EDDS, phytate). Colourants never set it. Citric Acid never. | MK:232–246, MK:252 |
| Tail credit | Tail ingredients contribute **nothing** to weight, conditioning or focus ("the sub-1 % hero tail … is a false signal"). | MK:250 |
| No marker | Whole list counts as above the tail, confidence capped at `moderate`, review (`tail_marker_anomaly`). | MK:253 |
| Plausibility (E13) | Implausible when the marker outranks a species that **establishes** the field value. Extras below the marker never make it implausible. | MK:255–270 |
| Third limb (E2) | An internally inconsistent class order (e.g. an allergen far above its own `Parfum`) gives `unresolved`. **Application note:** "a `Parfum` listed at or near the end of the list, behind its own declared allergens, is a house listing convention … never a concentration position." | MK:272–278 |
| Unresolved marker | It may neither disqualify nor qualify. Confidence is capped and the record goes to review. It never auto-decides. | MK:284–290 |
| Boundary position (E1) | A species at `tail_index − 1` counts in full. Any value that hinges on it is capped at `moderate` confidence. The reasoning: "Relative order above the marker is legally reliable … only the 1 % boundary is uncertain." | MK:618–624 |
| Lexicon | "The marker is a proxy, not the 1 % line … fragrance ~0.2–1 %, preservatives ~0.3–1 %"; "Some brands print `Parfum` last by house convention". | `v1.0/02_evidence_lexicon.v0.1.md`:85–94 |
| Banding (E14) | Three lipid bands. **R4b heavy** (butters, lanolin, coconut, castor, hydrogenated fats, petrolatum/occlusive hydrocarbons) is the only band that can form the `high` core. **Mid band** (olive, argan, soy, apricot, sunflower, macadamia, avocado, almond) "blocks `low`, never grants `high`, however early it sits". **R4a light** (esters, CCT, jojoba, squalane) carries no weight signal. | MK:384–389 |
| Weight anchors | `high` needs a heavy-lipid core above the marker, completed by a dense fatty-alcohol base or an occlusive silicone stack. Cationic count is not a `high` signal. `low` is a positive leanness test (no heavy/mid lipid above the marker, no occlusive stack, a single cationic **on the full list**). Everything else is `moderate`. | MK:653–675 |
| Conflict fallback | A formula-only `high` that conflicts with the exact product's intended finish ("leichte Pflege", "ohne zu beschweren") projects `moderate`. | MK:679 |

### 1.4 Conditioner v1.6 (`docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`, below **CO**)

| Element | Rule | Citation |
| --- | --- | --- |
| Concentration proxy | None formalized. The Art. 19 caveat only ("the under-1 % boundary is not visible"). | CO:62 |
| Payload | R4 lipid route: "A hero oil in the uncertain tail is not a richness score." Silicone presence proves nothing about heaviness, and neither does silicone-free about lightness. | CO:102, CO:120 |
| Weight | `weight_deposition_potential`, "count architecture, not ingredient points". `higher` only from multiple independent observations without a material counter-signal. | CO:182, CO:192 |
| Conflict fallback | A conflict-tagged formula-only `high` against the exact product's intended finish projects `moderate` (the NEQI precedent). | CO:237; `v1.0/rule-changes.md`:115 |

---

## 2. Agreement and disagreement with shampoo v1.6, and robustness

### 2.1 Where the engines agree with shampoo

- INCI order is architecture evidence, never a concentration (all four).
- "Hero ingredient in the tail is not richness" (CO:120, MK:250, LI:345). Shampoo says the same only for the `low` anchor ("late oil can still be low", SH:360). It never says it for W-RICH.
- `high`/top values need several independent, converging observations (CO:192, LI:606, SH:362).
- A balanced or uncertain boundary routes to review instead of resolving lighter (LI §1.1, MK §1.1, SH W3/P0).

### 2.2 Where shampoo v1.6 differs

| # | Point | Leave-in / mask | Shampoo v1.6 |
| --- | --- | --- | --- |
| D1 | Concentration proxy for weight | Yes, a deterministic tail marker with plausibility, vacuity and absence states | **None**. "Prominent" in W-RICH/W1(c) is undefined, so lanes use E3, which forbids that use |
| D2 | Which markers | Earliest preservative (LI), or earliest fragrance/allergen/preservative/chelator (MK) | E3 = **Parfum first**, preservatives only if no Parfum, allergens never |
| D3 | Parfum-last lists | MK names it a house convention, never a concentration position (MK:276). LI never uses Parfum as a marker | E3 takes Parfum at face value, so the whole list counts as prominent |
| D4 | Plausibility | T16/E13: marker before the establishing architecture gives unresolved. MK third limb: inconsistent class order gives unresolved | None |
| D5 | Lipid banding | LI rich band and MK E14 heavy band are closed lists. Liquid plant oils can never make `high` alone | No banding. Any `payload_lipid` can make W-RICH |
| D6 | No marker present | LI: ordinal read, confidence −1. MK: whole list above the tail, confidence capped `moderate` | E3: nothing is prominent, so W-RICH is **impossible**, which is the lighter direction |
| D7 | Claim conflict | MK/CO: a formula-only `high` in conflict with an exact "light" finish projects `moderate` | Claims never move weight (SH:343). This is stricter and intentional. Not proposed for change |

### 2.3 Which approach is most robust against Parfum-last lists and alphabetical tails

Corpus check: 144 unique shampoo INCI lists in this repo (v1.3/holdout/weight-rerun formula sources, the v1.6 gold and unseen packets, and the 54 Profi packets) plus the 73 Track-A live packets in the rollout worktree. I recognized markers mechanically, as a rough check rather than a rule:

- In **61 of 144** lists, Parfum stands at least two positions after the first preservative or allergen. That is the D3 pathology: E3 over-reads all of them.
- Alphabetical sub-1 % runs of 7 or more entries occur in Vichy (P31, P32, Dercos), L'Oréal (P43), René Furterer (P33), Paul Mitchell (P13), evo (P16) and Garnier lists. Within such a run no entry can be read as larger than another.
- **`Panthenol` is not reliably ≤ 1 %.** It appears before the first preservative or fragrance in 37 lists. In 11 of those a cleansing surfactant follows it (e.g. Plantur 39 `Panthenol` @4 before Disodium Laureth Sulfosuccinate @5; ISANA Med `Panthenol` @8 before Sodium Laureth-8 Sulfate @9). A Panthenol marker therefore needs a plausibility test. The same holds for Tocopherol, Biotin and Sodium Hyaluronate (2–3 counter-examples each).

Robustness ranking:

1. **Earliest of several capped markers** (mask-style), with a plausibility test. This fixes D2/D3 for every Parfum-last list, because the earliest preservative or allergen wins. It does **not** fix P02 by itself: P02's first capped marker is Potassium Sorbate @21, so Sunflower @8 stays above it.
2. **Typically sub-1 % actives as additional markers** (Panthenol, peptides, Biotin, hyaluronate, tocopherol, niacinamide, caffeine). These are the only markers that reach P01/P02, where the only early material before the depositing block is Glycerin. Because Panthenol is sometimes over 1 %, such a marker is only safe when the list itself confirms it: no cleansing surfactant or bulk structurant is listed after it.
3. **Alphabetical-run detection.** None of the sister engines has it, but it is the strongest visible evidence of the sub-1 % zone. It also stops trace co-surfactants inside the run from making a marker look implausible (P32).
4. **Lipid banding** (LI/MK). Fully position-independent, so it is the most robust in principle. On its own it would **not** move P02: lane B's second route, five converging families, stays open on E3 prominence. It is also a semantic change to what "rich" means in a rinse-off, and it would remove W-RICH from P03, P29 and P30. Recommended as a later candidate (v1.7), not for v1.6.1.

The robust combination for a small step is 1 + 2 + 3, with a P0-safe fallback.

---

## 3. Proposal: v1.6.1 rule text

### 3.1 Normative text (to be added to SH 6.7, after W3)

> **W-LINE Weight materiality line (v1.6.1).** Section 6 uses *material* where v1.6 said *prominent* or *early*. An ingredient is **material** for weight when it is listed before the W-line. The W-line is a reading convention for the `high` routes only. It is not a concentration claim and never assigns a band (6.1, 6.11).
>
> 1. **Candidates** (closed lists; additions are Nick's rulings, like E4):
>    a. *Fragrance*: a declared `Parfum`/`Fragrance`/`Aroma` entry, or any separately declared fragrance allergen (`Limonene`, `Linalool`, `Citronellol`, `Geraniol`, `Citral`, `Coumarin`, `Hexyl Cinnamal`, `Benzyl Salicylate`, `Benzyl Benzoate`, `Alpha-Isomethyl Ionone`, `Butylphenyl Methylpropional`, `Eugenol`, `Amyl Cinnamal`, `Hydroxycitronellal`, `Isoeugenol`, `Farnesol`, and the other EU-declared allergens).
>    b. *Capped preservative or active*: `Phenoxyethanol`, `Sodium Benzoate`, `Benzoic Acid`, `Potassium Sorbate`, `Sorbic Acid`, `Benzyl Alcohol`, `Dehydroacetic Acid`, `Sodium Dehydroacetate`, `Chlorphenesin`, parabens, `Methylisothiazolinone`, `Methylchloroisothiazolinone`, `DMDM Hydantoin`, `Sodium Hydroxymethylglycinate`, `Iodopropynyl Butylcarbamate`, `Sodium Salicylate`, `Piroctone Olamine`, `Selenium Sulfide`. The boosters `Ethylhexylglycerin`, `Caprylyl Glycol`, `1,2-Hexanediol`, `Glyceryl Caprylate` and `Caprylhydroxamic Acid` count only when a preservative from this list is also declared.
>    c. *Typical sub-1 % active*: `Panthenol`, `Biotin`, `Niacinamide`, `Caffeine`, `Sodium Hyaluronate`/`Hyaluronic Acid`/`Hydrolyzed Hyaluronic Acid`, `Tocopherol`, `Tocopheryl Acetate`, any `…peptide-n`.
>    d. *Alphabetical tail*: the **second** entry of a run of at least seven consecutive entries in strict alphabetical order. The first entry of the run may still be material.
>
>    Never candidates: colourants, chelators, pH adjusters, salts, botanical extracts, proteins, glycols, essential oils.
> 2. **Plausibility.** A candidate is plausible only when (i) at least one cleansing surfactant (C3 classes) is listed before it, **and** (ii) no cleansing surfactant, no alkanolamide (`Cocamide MEA/DEA/MIPA`) and no pearlizing wax (`Glycol Distearate`, `Glycol Stearate`) is listed after it and before the E3 point. Entries inside an alphabetical tail (1d) are exempt from (ii). An implausible candidate is skipped and recorded as `w_line_skipped:<INCI>@<pos>`.
> 3. **The W-line** is the position of the earliest plausible candidate. It is never later than the E3 point. If no candidate is plausible, the W-line is the E3 point (the v1.6 reading) and the record notes `w_line_fallback_e3`. If the formula declares no fragrance and no listed preservative, every ingredient is material, weight confidence is at most `moderate`, and the record notes `w_line_none_visible`.
> 4. **Uses.**
>    - **W-RICH**: material `payload_lipid` converging with a silicone or cationic system that has a member listed before the W-line.
>    - **W1 (c)**: "a prominent `payload_lipid`" reads "a material `payload_lipid`".
>    - **`high` anchor, convergence route**: "multiple converging, plausibly persistent depositing systems" requires at least two distinct 6.3 deposition families, **each with a material member**.
>    - Families listed wholly after the W-line are still present. They count for W2 and may support `moderate`, but they never establish `high`.
> 5. **Not changed.** W2 and the `low`/`moderate` boundary. E3 stays the convention for C4, C2 and projection gates. C2 "early" keeps meaning prominent (E3), and the Section 5 `high` anchor's "rich architecture" is read with E3 ("prominent `payload_lipid` converging with a silicone or cationic system"). Weight never reads C2: a C2-met `conditioningLevel: high` is not weight evidence.
> 6. **Record.** The weight record names the W-line, its candidate class, every skipped candidate, and the material and non-material deposition evidence. A band that falls short of `high` only because a family lies after the W-line records `high` as the neighboring alternative (N-ALT) and the post-line families as the counter-signal. A `high` that rests on a single ingredient at W-line − 1 has confidence of at most `moderate` (mask E1 pattern).

Consequential wording edits:

- SH:290 / SH:426: add "the W-line (6.7) is the only position convention for weight, and it gates the `high` routes only".
- SH:716 (E3): "never a weight rule; Section 6 uses the W-line".
- SH:269: replace "(W-RICH, Section 6)" by the E3 wording in item 5, so conditioning does not move.

### 3.2 Why two sealed lanes would agree

Every step is a lookup or a rank comparison on the frozen list: closed candidate lists, a mechanical plausibility test and a fixed fallback. The orchestrator can pre-compute the W-line into the packet facts, next to the `e3ProminenceCutoff` the lanes already record. The lanes then only judge persistence and reset, as today.

The rule is monotone against v1.6: the W-line is never later than E3, so it can only **remove** `high` routes, never add one. The one exception is the no-marker case, which moves toward the conservative side.

### 3.3 Re-derivation of the five products (frozen packet INCI)

| Product | W-line derivation | Material deposition evidence | W-RICH | Convergence route | Expected weight (v1.6 → v1.6.1) |
| --- | --- | --- | --- | --- | --- |
| **P01** Maria Nila Head & Hair Heal (`packets/P01-…json`) | Candidates: `Biotinoyl Tripeptide-1` @7 (1c); `Piroctone Olamine` @12; `Benzoic Acid` @21 … `Parfum` @37. @7 is plausible: surfactants are at @2–5 only, `Glycol Distearate` @6 is before it, and nothing cleansing follows. **W-line = 7.** | none. `Glycol Distearate` @6 is excluded (6.4). Sunflower @15, guar @16, amodimethicone copolymer @18 and Quaternium-95 @26 are all after the line. | no | no (0 material families) | **moderate → moderate** (unchanged, now deterministic). W2 keeps it off `low`: four families plus weak reset. N-ALT `high`. |
| **P02** Maria Nila Pure Volume (`P02-…json`) | `Panthenol` @7 (1c) is plausible: surfactants @2–5, and no surfactant, alkanolamide or wax after it. Hard candidates start at `Potassium Sorbate` @21. **W-line = 7.** | none; only `Glycerin` @6, which is humectant context. Sunflower @8, the cationic wheat copolymer @9, the silicone @12, Quaternium-95 @16 and guar @18 are all after the line. | no | no | **high → moderate.** Fit: fine `not_suited` → `acceptable` (row appears), normal `acceptable` → `ideal`, coarse `ideal` (live amber, T7). The lane B focus switch to `repair` loses its basis. |
| **P03** Maria Nila True Soft (`P03-…json`) | No 1c candidate. `Dehydroacetic Acid` @19 is plausible: no surfactant, alkanolamide or wax after it before `Parfum` @31. **W-line = 19.** | Argan @7 and sunflower @9 (lipid), wheat protein @8 and protein silanetriol @12, guar @13, the hydroxypropyldimonium quat @15, amodimethicone copolymer @16 | **yes** | yes (5 families) | **high → high** (unchanged). Reset is weak (C6). |
| **P40** Moroccanoil Clarifying (`P40-…json`) | `Fragrance` @13 (1a) is plausible, and it equals E3. `Panthenol` @17 comes later. **W-line = 13.** | Argan @7 and avocado @8 only. Cinnamidopropyltrimonium @26 and Cocamidopropyl Dimethylamine @30 are after the line. | no (no material partner) | no (1 family) | **moderate → moderate** (unchanged). |
| **P25** OLAPLEX No.4 (superseding `packets-r2/P25-…json`; the audit's positions are from this packet) | `Biotin` @12, `Sodium Hyaluronate` @13, `Panthenol` @14, `Tocopherol` @15, `Caprylyl Glycol` @33 and `Ethylhexylglycerin` @43 are all **skipped**: cleansing surfactants follow at @36, @41, @42 and @44, and `Glycol Distearate` follows at @37. The list is not in descending order (lane B said so in `kit-r2/lane-b/out/PR05.json`). First plausible candidate: `Benzoic Acid` @63. **W-line = 63.** | Oils @24–26, PQ-10/PQ-11/guar @30–32, silicones @34–35 and protein @28 are all material. | yes | yes | **cautious high → high, confidence `low`, `needs_research`** (formula `not_known_complete`, ID-1). The proposal deliberately does not grant a lighter reading on a list whose order it cannot trust (P0). Lane B's `moderate` would no longer be a valid reading, so the lanes agree on the value. What remains open is formula identity, not method. |

Same rule, other Profi products checked mechanically:

- **P32 Vichy Dercos Ultra-Sensitiv moves `high` → `moderate`.** Its alphabetical tail runs from @9 to @37, and `Benzoic Acid` @10 coincides with it, so the W-line is 10. Only Amodimethicone @9, the first entry of the run, is material, which leaves a single family. Lane A's `high` rested on the convergence route with the two silicones, PQ-7, PQ-10 and Cetrimonium all inside the alphabetical tail. Fit with its `dry`/`sensitive` targets: fine stays `acceptable` (T6), normal `acceptable` → `ideal`, coarse `ideal` (live amber). The audit asked for exactly this product to be read like P02 (B1 re-check).
- **P09 Kevin.Murphy Hydrate-Me** keeps `high`: its vitamin candidates @9–16 are skipped because of Sodium Methyl Cocoyl Taurate @33, so the W-line is Phenoxyethanol @40.
- **P30 Moroccanoil Moisture Repair** keeps `high`: W-line = Fragrance @16, with Dimethicone @8, oils @9–10 and protein @15 material.
- **P29 Aveda** keeps `moderate`.

---

## 4. Risks and how to test

### 4.1 What could move

- **Direction.** Only `high` → `moderate`, which is the recommending direction. Mitigations: the cap at E3 (monotone), skip-to-later on implausible markers (always heavier), the E3 fallback, N-ALT `high` with a counter-signal, and the W3 rule unchanged.
- **Calibrated gold set: no movement possible.** The v1.6 calibration has **no `high` weight** on any gold or unseen product. Round 2: all 13 gold products are `low`/`moderate`, and both lanes match all 11 of Nick's 2026-08-26 approvals (`data/research/shampoo-inci/v1.6/calibration/round-2/round-2-report.md`:16–18, `round-2/compare-output.txt`:9–22). Unseen v2 is the same (`unseen-v2/compare-output.txt`). W-RICH has therefore **never been calibrated toward `high`** against an approval. The only Aug-26 `high` (Hair Biology Revitalize & Soothe, `approved-weight-consistency-v1/audit.json`) has W-line = E3 = `Parfum` @11, so it is unaffected. Gold records that cite W-RICH as holding (G05 Hafermilch, U2-04 Violet Crush, U4 Aktivkohle) keep it under the W-line.
- **Live Track A (73 frozen live shampoos, `../shampoo-v16-rollout/data/research/shampoo-inci/v1.6-track-a/packets`).** No product loses W-RICH. Six products have fewer than two material families after the change: Dejan Garz, OGX Rosemary Mint, Syoss Intense Fullness, Syoss Intense Curls (G09), Balea Ultimate Volume (G12) and Plantur 39. They are approved `low`/`moderate`, or are sulfate chassis where the high routes are already closed. Movement is expected only if a Track-A lane would have called one of them `high` through convergence.
- **Profi run:** P02 and P32 move. P01, P03, P09, P25, P30 and P40 keep their values.
- **Conditioning:** no movement, because C2 and the Section 5 anchor keep E3 (item 5).
  - Option B for Nick: also read C2 "early" with the W-line. That would plausibly drop P01 and P02 `conditioningLevel` to `moderate` (amodimethicone @18/@12 after the line), so coarse would become `acceptable`.
  - It does not break the C2 source case: Wella Invigo Nutri-Enrich has W-line = `Parfum` @8 and Dimethicone @6.
  - It is not recommended for v1.6.1, because no conditioning contradiction was reported.
- **Residual weaknesses:**
  - Trace co-surfactants make a sub-1 % active look implausible (P09), which errs toward conservative.
  - The 1c list is a judgment and needs Nick's ruling.
  - Lists with mis-split INCI (e.g. Track-A A45 "Aqua (Water | Eau)") need packet hygiene.
  - Like the leave-in marker (LI §17.14), the W-line is unvalidated against measured concentrations.
- **6.10 review trigger:** a one-directional lighter shift on Parfum-last brands is expected and must be shown to Nick as such, not tuned.

### 4.2 Minimal re-calibration

1. **Pre-register** expected W-lines and bands (the mask round-2.5 pattern) for: the six Profi `high` products (P02, P03, P09, P25, P30, P32), the controls P01, P40 and P29, the gold/unseen W-RICH citers (G05, U2-04, U4), the convergence-boundary golds (G09, G12, U3 Plantur), and Hair Biology. That is 16 products.
2. **Mechanical check** (orchestrator, before the lanes): compute the W-line per packet and compare it with the pre-registration. Any difference is a rule-text defect.
3. **Two fresh sealed lanes**, weight and conditioning only, on the v1.6.1 lane copy. Pass criteria:
   - lane-vs-lane agreement on weight 16/16;
   - every gold or approved value unchanged;
   - only P02 and P32 move, each with the W-line recorded and N-ALT `high`;
   - zero disagreements caused by the new text (SH:1003 lock-gate logic).
4. **Nick sign-off** on the 1c list, on P02/P32 moving lighter, and on Option B (C2) staying out of scope.
5. **Re-project** P02 and P32 only (SH 6.10: refresh only weight-derived outputs). Re-check P02 focus (A/B split).

---

Method note: the corpus statistics in 2.3 and 4.1 come from a transient recognizer script (session scratchpad, not committed). It uses approximate regex family recognition and is corroborative only. The normative derivations for the products in 3.3 were checked by hand against the packet INCI.
