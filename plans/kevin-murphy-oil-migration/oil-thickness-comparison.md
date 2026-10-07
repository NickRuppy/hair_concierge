# Oil thickness comparison — where does KEVIN.MURPHY YOUNG.AGAIN belong?

**Question (Nick, 2026-09-29):** Which other oils can we compare it with? If we include really heavy oils, do we exclude the finer ones? Compare YOUNG.AGAIN with the products we already carry, ingredient by ingredient.
**Status:** research for Nick's thickness ruling. Nothing has been applied to the database.
**Live data:** read-only SELECTs against production on 2026-09-29. Tables read: `products` where `category_key='oil'`, `product_oil_specs`, `product_oil_eligibility`, `product_thickness_eligibility`, `personal_plan_catalog_fact_evidence`. There are 53 oil rows: 52 active and 1 discontinued (Balea Pflegeöl Natural Beauty, excluded).

**Where the INCI data comes from:**

- DB evidence rows (`inci_basis` / source quotes), for the expansion oils and the pure oils.
- `docs/ops/catalog-repairs/2026-09-01-oil-authority-enrichment/README.md`, for Garnier Sleek & Stay, OGX Moroccan and Primavera.
- Web research on 2026-09-29, with URLs below, for the curated blended oils that had no INCI in the repo.
- Every blended oil now has a sourced INCI, except NUTREEOIL Cacay (manufacturer states 100 % cacay but publishes no INCI line) and the US-only lists for OGX Weightless and OGX Bond Protein (neither has a readable DE page).

## How the engine uses thickness (the rule this comparison is held to)

`docs/personal-plan/categories/oil/decision.md` sets up two independent checks:

- **`suitableThicknesses`** is the hard gate ("researched general hair-diameter eligibility"). If it fails, the verdict is `wechseln empfohlen`.
- **`weight`** is the formula load for leave-on use. It only _grades_ a product that has already passed the gate:

  | Thickness | Ideal weight    | Adjacent weight |
  | --------- | --------------- | --------------- |
  | fine      | light           | medium          |
  | normal    | light or medium | rich            |
  | coarse    | medium or rich  | light           |
  - For fine hair, rich is a high load risk.
  - For coarse hair, light is only "adjacent", because it "may under-serve" the job.

- The spec says `weight` "must not double-count the same thickness evidence as a second hard rejection".

**What this means for the question:**

- A light oil should **not** lose coarse eligibility just because it is light. The weight grading already demotes it for coarse hair.
- A **rich** leave-on oil that is eligible for **fine** hair is exactly the case the gate exists to catch.
- Pre-wash-only oils are shampooed out, so their weight is ignored.

**Where curated thicknesses came from:**

- Every curated recommended oil carries **exactly one** thickness, inherited from the `Haartyp` sheet. The oil-authority README says so explicitly: "Every product has exactly one thickness … inherited from the authoritative Haartyp sheet".
- Olaplex No.7 is the only exception, with two thicknesses.
- The expansion (scan) oils were researched per product and carry all three thicknesses when the manufacturer says "alle Haartypen".

## Architecture legend

- **SIL/VOL:** anhydrous, led by silicone and/or volatile (cyclomethicone, isododecane, isoalkane, undecane). Plant oils come after position 3. Light film.
- **ESTER:** light emollient esters lead (ethylhexyl stearate, coco-caprylate, isoamyl laurate).
- **PLANT:** plant oil(s) at position 1. Heavy or medium, depending on the oil.
- **AQ:** water-based emulsion or spray (Aqua at position 1–2). **Not an oil formula.**

## 1. Leave-on oils (weight matters): every row

| Product (rec = recommended)                   | Lead INCI (ranks)                                                                                                                                  | Arch.             | Weight      | Thickness now                      | Source                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------- | ---------------------------------- | ------------------------------------------------- |
| Herbal Essences Arganöl Elixir                | 1 Cyclopentasiloxane, 2 Dimethiconol, 3 Argan                                                                                                      | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Pantene Argan Infused Oil                     | 1 Cyclopentasiloxane, 2 Dimethiconol, 3 Alcohol Denat., 5 Argan                                                                                    | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Gliss Tägliches Öl-Elixier                    | 1 Dimethicone, 2 Dimethiconol, 3 Undecane, 4 Dicaprylyl Ether, 6 Sunflower                                                                         | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| L'Oréal Öl Magique (alle Haartypen)           | 1 Isododecane, 2 Dimethicone, 3 Dimethiconol, 4 Coconut                                                                                            | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Langhaarmädchen Intense Repair                | 1 Dimethicone, 2 Isododecane, 3 C12-15 Alkyl Benzoate, 4 Dimethiconol, 5 Coconut                                                                   | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Dejan Garz The Britney                        | 1 Isododecane, 2 Dimethicone, 3 Camellia, 4 Argan, 5 Jojoba                                                                                        | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Garnier Hitzeschutzspray Wunderöl             | 1 Isododecane, 2 Dimethicone, 3 Dimethiconol, 4 Olive, 5 Sunflower … Shea                                                                          | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Balea Professional Plex Care                  | 1 Isododecane, 2 C11-13 Isoalkane, 3 Dimethiconol, 4 Isohexadecane, 5 Sunflower                                                                    | SIL/VOL           | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| Isana Professional Arganöl & Pflege           | 1 Isododecane, 2 C11-13 Isoalkane, 3 Dimethiconol, 4 Isohexadecane, 5 Sunflower (same family as Plex Care)                                         | SIL/VOL           | medium      | fine, normal, coarse               | rossmann.de (DB evidence)                         |
| **Olaplex No.7** (rec)                        | 1 Dimethicone, 2 Isohexadecane, 3 C13-14 Isoalkane, 4 Coco-Caprylate, 5 Phenyl Trimethicone; Aqua 12                                               | SIL/VOL           | light       | **fine, normal**                   | olaplex.de (2026-09-29)                           |
| **HASK Argan Repairing Shine Oil** (rec)      | 1 C13-14 Isoalkane, 2 Dimethiconol, 3 C10-11 Isoalkane, 4 Argan; Aqua 10                                                                           | SIL/VOL           | medium      | **fine**                           | haskbeauty.com, haarspullen.nl (2026-09-29)       |
| **Shiseido Fino Premium Touch** (rec)         | 1 Hydrogenated Polyisobutene, 2 Dimethiconol, 3 Isopropyl Myristate, 4 Isododecane, 5 Polysilicone-13 (no EU/manufacturer page; medium confidence) | SIL/VOL           | light       | **fine**                           | nudieglow.com, ratzillacosme.com (2026-09-29)     |
| **Garnier Fructis Sleek & Stay** (rec)        | 1 Dimethicone, 2 Bis-(Morpholinomethyl …) Dimethicone, 3 **Bis-Cetearyl Amodimethicone**, 4 Parfum (pure silicone serum)                           | SIL               | light       | **coarse**                         | garnier.de, rossmann.de (2026-09-29)              |
| **OGX Moroccan Argan Penetrating Oil** (rec)  | 1 Dimethicone, 2 Isopropyl Myristate, 3 Dimethiconol, 4 C12-15 Alkyl Benzoate, 5 Argan (same top 4 as OGX Coconut Miracle)                         | SIL + ESTER       | medium      | **normal**                         | dm.de 1442285, mueller.de (2026-09-29)            |
| **Maria Nila True Soft** (rec)                | 1 **Cyclomethicone**/Cyclopentasiloxane, 2 **Dimethiconol**, 3 Argan, 4 Crambe, 5 Rapeseed (Hagel's INCI field is a wrong dry-shampoo list)        | SIL/VOL           | light       | **normal**                         | marianila.com, notino.de (2026-09-29)             |
| **Garnier Fructis Wunderöl** (rec)            | 1 Isododecane, 2 Dimethicone, 3 Dimethiconol, 4 Olive, 5 Sunflower … Shea — first 9 identical to the expansion Hitzeschutzspray Wunderöl           | SIL/VOL           | light       | **normal**                         | dm.de 1499815 (2026-09-29)                        |
| **L'Oréal Öl Magique Jojoba** (rec)           | 1 Isododecane, 2 Dimethicone, 3 Dimethiconol, 4 Coconut, 5 Hydrogenated Jojoba; maker: "Dickes, trockenes Haar?"                                   | SIL/VOL           | medium      | **normal**                         | rossmann.de (2026-09-29)                          |
| **OGX Argan Weightless Dry Oil** (rec)        | 1 Dimethicone, 2 Isododecane, 3 C12-15 Alkyl Benzoate, 4 Argan, 5 Phenyl Trimethicone (US list; dm page gone)                                      | SIL/VOL           | light       | **normal**                         | ogxbeauty.com (2026-09-29)                        |
| **Pantene Keratin Protect Öl** (rec)          | 1 **Cyclopentasiloxane**, 2 **Dimethiconol**, 3 Alcohol Denat.; Aqua 11 — identical INCI to Pantene Coconut Infused                                | SIL/VOL           | light       | **normal**                         | dm.de 1395948, rossmann.de (2026-09-29)           |
| **L'Oréal Midnight Serum** (rec)              | 1 **Aqua**, 2 Cetearyl Alcohol, 3 Coconut, 4 Cetyl Alcohol, 5 Cetyl Esters … Behentrimonium (cream emulsion)                                       | **AQ**            | light       | **normal**                         | dm.de 1333706 (2026-09-29)                        |
| **Urban Alchemy Smooth Supreme** (rec)        | 1 Isohexadecane, 2 Dimethicone, 3 Argan, then fragrance                                                                                            | SIL/VOL           | light       | **coarse**                         | urban-alchemy.com (2026-09-29)                    |
| **Pantene Coconut Infused Oil** (rec)         | 1 **Cyclopentasiloxane**, 2 **Dimethiconol**, 3 Alcohol Denat.; Aqua 11; **no coconut at all**                                                     | SIL/VOL           | light       | **coarse**                         | dm.de 1612745 (2026-09-29)                        |
| **OGX Bond Protein Repair Oil Mist** (rec)    | 1 **Water**, 2 Caprylic/Capric Triglyceride, 3 Propanediol, 4 Glycerin … (spray mist; US page only)                                                | **AQ**            | light       | **coarse**                         | ogxbeauty.com (2026-09-29)                        |
| **OGX Coconut Miracle Oil** (rec)             | 1 Dimethicone, 2 Isopropyl Myristate, 3 Dimethiconol, 4 C12-15 Alkyl Benzoate, 5 Argan, 6 Coconut                                                  | SIL + ESTER       | rich        | **coarse**                         | dm.de 2322377 (2026-09-29)                        |
| **Balea Traumlocken Öl** (rec)                | 1 Sunflower (hybrid), 2 Argan, 3 Coconut, 4 Babassu, 5 Jojoba, 6 Wheat Germ (silicone-free)                                                        | PLANT             | medium      | **coarse**                         | dm.de 1635760 (2026-09-29)                        |
| **Garnier Curl Revival Öl** (rec)             | 1 Sunflower, 2 Isopropyl Myristate, 3 Olive, 4 Octyldodecanol, 5 Jojoba, 6 Coconut … Avocado, Shea (silicone-free)                                 | PLANT + ESTER     | rich        | **coarse**                         | garnier.de (2026-09-29)                           |
| **Balea Oil Repair Intensiv** (rec)           | 1 Isododecane, 2 C11-13 Isoalkane, 3 Dimethiconol, 4 Isohexadecane, 5 Sunflower (same family as Plex Care/Isana)                                   | SIL/VOL           | rich        | **coarse**                         | dm.de 1700841 (2026-09-29)                        |
| **Nuxe Huile Prodigieuse** (rec)              | 1 Coco-Caprylate/Caprate, 2 Macadamia, 3 Dicaprylyl Ether, 4 Caprylic/Capric Triglyceride, 5 Almond (silicone-free)                                | ESTER             | light       | **normal**                         | de.nuxe.com (2026-09-29)                          |
| **Weleda Gloss Drops Alpen-Lein** (rec)       | 1 Apricot Kernel, 2 Isoamyl Laurate, 3 Sunflower, 4 Coconut, 5 Jojoba (silicone-free)                                                              | PLANT + ESTER     | light       | **coarse**                         | mueller.de, weleda.de (2026-09-29)                |
| Bali Curls Bonding Oil                        | 1 Ethylhexyl Stearate, 2 Undecane, 3 Coco-Caprylate/Caprate, 4 Hydrogenated Ethylhexyl Olivate, 7 Macadamia                                        | ESTER             | light       | fine, normal, coarse               | dm.de (DB evidence)                               |
| **Jean&Len Keratin & Mandel** (rec)           | 1 Canola Oil, 2 Isoamyl Laurate, 3 Jojoba, 8 Almond (silicone-free)                                                                                | PLANT + ESTER     | light       | **fine**                           | jeanlen.de (2026-09-29)                           |
| **Innersense Harmonic Treatment Oil** (rec)   | 1 Sunflower, 2 Safflower, 3 Camellia, 4 Jojoba, 5 Tamanu (manufacturer); older EU list is safflower-led                                            | PLANT             | medium      | **fine**                           | innersensebeauty.com, cosmeterie.com (2026-09-29) |
| **Weleda Haaröl Rosmarin**                    | 1 **Arachis Hypogaea (Peanut) Oil**, then extracts and essential oils                                                                              | PLANT             | rich        | fine, normal, coarse               | dm.de (DB evidence)                               |
| Neqi Smooth Strength Rosemary Oil (user-sub.) | 1 Sweet Almond, 2 **Ricinus (Castor)**, 3 Safflower                                                                                                | PLANT             | — (no spec) | fine, normal, coarse               | neqi-hair.com, cosmeterie.at (2026-09-29)         |
| **Primavera Calendulaöl** (rec)               | 1 Sunflower, 2 Olive, extracts                                                                                                                     | PLANT             | rich        | **coarse** (also has `dry_finish`) | DB evidence                                       |
| **Dr. Scheller Jojobaöl** (rec)               | 100 % Jojoba                                                                                                                                       | PLANT (wax ester) | light       | **fine** (also has `dry_finish`)   | DB evidence                                       |
| **Dr. Scheller Reines Arganöl** (rec)         | 100 % Argania Spinosa Kernel Oil (pipette)                                                                                                         | PLANT             | medium      | **normal**                         | mueller.de (2026-09-29)                           |
| **NUTREEOIL Cacay** (rec)                     | "100 % reines … Cacay Trockenöl" (no INCI line published)                                                                                          | PLANT             | medium      | **coarse**                         | nutreeoil.com (2026-09-29)                        |
| **Neqi Opulent Oil** (rec)                    | 1 **Aqua**, 2 Polyquaternium-10, 3 Polysorbate 20, 4 Glycerin … (no plant oil, no silicone)                                                        | **AQ**            | light       | **fine**                           | neqi-hair.com (2026-09-29)                        |
| **Pantene Miracles 7in1 Öl-Spray** (rec)      | 1 **Aqua**, 2 Propylene Glycol, 3 Amodimethicone, 4 Quaternium-80 … Castor about 24th                                                              | **AQ**            | light       | **fine**                           | mueller.de (2026-09-29)                           |

## 2. Pre-wash-only pure oils (weight ignored by the engine; listed for completeness)

| Thickness | Pure oils                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------- |
| fine      | Traubenkern (light), Aprikosenkern (light), Distel/Safflower (light), MCT (light), Mandel (medium)      |
| normal    | Macadamia (medium), Schwarzkümmel (medium), Moringa (medium), Avocado NANOIL (rich), Olive dmBio (rich) |
| coarse    | Kokos nativ (rich), Rizinus (rich)                                                                      |

These single-slot assignments are consistent with the usual heavy→coarse, light→fine ordering. Olive and Avocado sit at normal while rated rich, but for a pre-wash role that has no effect in the engine.

## 3. YOUNG.AGAIN in the same terms

| Product                  | Lead INCI (ranks)                                                                                                                                                                                            | Arch.   | Weight (proposed) | Thickness (prepared → recommended) |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------- | ---------------------------------- |
| KEVIN.MURPHY YOUNG.AGAIN | 1 **Cyclopentasiloxane**, 2 Dimethicone, 3 Dimethiconol, 4 **Bis-Cetearyl Amodimethicone**, 5–7 extracts, **8 Safflower Oil**, 9 Lemon Peel Oil … Aqua 16; trace Behentrimonium Chloride, Myristyl Myristate | SIL/VOL | light             | normal → **fine, normal, coarse**  |

**Its closest formula twins in the catalog:**

- **Herbal Essences Argan Elixir** and **Pantene Argan Infused Oil**: cyclopentasiloxane plus dimethiconol lead, with plant oil after them. They carry **all three** thicknesses.
- **Gliss Öl-Elixier**: dimethicone, dimethiconol, a volatile. It carries **all three**.
- **Olaplex No.7**: dimethicone plus volatiles. It carries **fine and normal**.
- **Garnier Sleek & Stay**: a pure silicone serum with the same Bis-Cetearyl Amodimethicone. It carries **coarse** only.
- **Pantene Coconut Infused Oil** (curated, recommended): cyclopentasiloxane, dimethiconol, alcohol — the same INCI skeleton as Pantene Argan Infused. It carries **coarse** only, while its all-but-identical sibling carries all three.

The manufacturer calls YOUNG.AGAIN "schwerelos", "lightweight … without weighing hair down" and "Für alle Haartypen geeignet" (KM DE page and KM how-to article, both checked 2026-09-29).

## Recommendation: all three (fine, normal, coarse)

YOUNG.AGAIN is a volatile-led silicone oil. Cyclopentasiloxane (D5) sits at position 1 and evaporates. It leaves a thin dimethicone, dimethiconol and amodimethicone film. The only real plant oil, safflower, sits at position 8. Water sits at position 16, and the quats and myristyl myristate are trace.

**It passes on fine hair.** Ingredient for ingredient, it is at least as light as every silicone oil the catalog already makes fine-eligible:

- Olaplex No.7 leads with the _non-volatile_ dimethicone, and it is fine-eligible.
- HASK and Fino are fine-only, and they lead with isoalkane or polyisobutene.

So excluding fine would contradict the curated Olaplex precedent. It would also contradict all nine expansion oils in this architecture: Herbal Essences, Pantene Argan and Gliss are its nearest twins, and each carries all three thicknesses.

**It passes on coarse hair.** In the catalog, the silicone architecture is not a reason to exclude coarse:

- The curated sheet puts the pure-silicone Garnier Sleek & Stay, which shares Bis-Cetearyl Amodimethicone with KM, on **coarse only**.
- It also puts the volatile/silicone oils Urban Alchemy (isohexadecane, dimethicone) and Pantene Coconut (cyclopentasiloxane, dimethiconol — YOUNG.AGAIN's own lead pair) on coarse only, and the identical-INCI Pantene Keratin Protect on normal only.

The engine's own rule treats "light oil on coarse hair" as a _weight_ question: it's `adjacent`, graded `passt mit Einschränkung`, and ranked behind medium or rich candidates. Also dropping coarse from the thickness gate would be the double-counting that decision.md forbids.

**The single-thickness curated pattern is not an ingredient signal.** The same architecture appears as fine-only (HASK, Fino), normal-only (OGX Moroccan, Maria Nila) and coarse-only (Sleek & Stay, Urban Alchemy, Pantene Coconut, Balea Oil Repair Intensiv). That is a slot distribution from the `Haartyp` sheet, not a formula judgment. Keeping YOUNG.AGAIN at `normal` preserves a slot, but it doesn't follow the ingredients.

**How all three behaves in practice:**

- Fine hair: `light` is the ideal weight.
- Normal hair: ideal.
- Coarse hair: adjacent, so it is preferred only when no medium or rich candidate fits.

**The weaker alternative is fine + normal**, which copies Olaplex. It is defensible only if Nick wants to keep light silicone oils away from coarse on purpose. But the catalog doesn't do that anywhere else: Sleek & Stay, Urban Alchemy and the others are the counter-examples.

**Caveat:** the D5/D6 reformulation deadline is 6 June 2027. A reformulated YOUNG.AGAIN has to be re-checked for weight. If the D5 lead gives way to a non-volatile silicone or an ester, it gets heavier.

## Findings: inconsistencies among existing oils (flagged only, not fixed)

1. **Heavy plant oil that is fine-eligible, the case Nick suspected.**
   - **Weleda Haaröl Rosmarin** (`6c51a883…`, expansion): the peanut oil at position 1 is rated `rich`, yet the product is eligible for **fine, normal and coarse**, with leave-on and dry-finish roles.
   - The research note already flagged this: "rich Öl für alle Stärken freigegeben … bei feinem Haar das reichhaltigste Produkt der Wave".
   - The weight matrix marks it high load risk for fine hair. It isn't recommended, so the effect today is limited to the scan verdict and owned-product fit.
2. **Castor-heavy oil that is fine-eligible with no spec.**
   - **Neqi Smooth Strength Rosemary Oil** (`010cf825…`, user_submitted): almond first, then castor at position 2. It is eligible for all three thicknesses, but it has no `product_oil_specs` and no weight.
   - It is also classed `styling-oel/pre_wash_oiling`, which is internally inconsistent for a pure plant-oil blend.
3. **Four "oils" that are water-based emulsions, all curated and recommended.**
   - **Neqi Opulent Oil** (`27a2dd61…`, fine): Aqua at position 1, Polyquaternium-10, Polysorbate 20, Glycerin. It has no plant oil and no silicone. This is a leave-in serum.
   - **Pantene Miracles 7in1 Öl-Spray** (`5827a3b9…`, fine): Aqua at 1, Propylene Glycol at 2, Amodimethicone at 3. This is a leave-in conditioning spray, and it is also a spray, which X6 parks.
   - **OGX Bond Protein Repair Oil Mist** (`c320750f…`, coarse): Water at 1, Caprylic/Capric Triglyceride at 2; a spray mist (US manufacturer INCI; not sold at dm).
   - **L'Oréal Öl Magique Midnight Serum** (`21a94166…`, normal): Aqua at 1, Cetearyl Alcohol at 2, Behentrimonium Methosulfate — a leave-in cream (dm lists it under Leave-In).
   - All four fail the same R-A identity test that moved the Wahre Schätze Honig serum to Leave-in.
   - Their thickness is not the problem; their category is.
4. **Safflower and sunflower oils have inconsistent weight and thickness.**
   - **BioGourmet Distelöl** (safflower): `light` and fine.
   - **Innersense** (sunflower then safflower): `medium` and fine.
   - **Primavera Calendulaöl** (sunflower then olive): `rich` and **coarse**, with a `dry_finish` role, so weight counts.
   - Sunflower and safflower are near-identical linoleic oils. Primavera's rich/coarse rating fits its olive share at best, and it sits at the heavy end of how the catalog treats the same oil family.
5. **Weight versus fine-only.**
   - **HASK** (`medium`, fine-only) is volatile-led like Olaplex (`light`). Its weight looks overstated relative to its INCI; the product is small and absorbs instantly.
   - **Innersense** (`medium`, fine-only) is an all-plant blend.
   - For fine hair a `medium` rating means `adjacent`, so both products are rated one step heavier than the slot the sheet gave them.
6. **Same INCI family, three different weights.**
   - Balea Professional Plex Care, Isana Professional Arganöl & Pflege and Balea Oil Repair Intensiv all open with Isododecane, C11-13 Isoalkane, Dimethiconol, Isohexadecane, Sunflower.
   - They are rated `light` (Plex Care), `medium` (Isana) and **`rich`** (Oil Repair Intensiv, curated coarse-only). dm itself calls Oil Repair Intensiv an "ultraleichte Formel … ohne zu beschweren".
   - OGX Coconut Miracle Oil (dimethicone, isopropyl myristate, dimethiconol, C12-15 alkyl benzoate) is also rated `rich`, while Langhaarmädchen with a near-identical lead (dimethicone, isododecane, C12-15 alkyl benzoate, dimethiconol) is `light`. OGX has no volatile lead, so heavier than Langhaarmädchen is fair, but `rich` puts it level with native coconut and castor oil.
7. **The same architecture is split across single slots**, as covered above:
   - fine-only: HASK, Fino
   - normal-only: OGX Moroccan, Maria Nila, Garnier Wunderöl, OGX Weightless
   - coarse-only: Sleek & Stay, Urban Alchemy, Pantene Coconut, Balea Oil Repair Intensiv

   The sharpest cases:
   - Pantene Coconut Infused (coarse only), Pantene Keratin Protect (normal only) and Pantene Argan Infused (all three) share Cyclopentasiloxane, Dimethiconol, Alcohol Denat. as their first three ingredients; Coconut and Keratin Protect have byte-identical INCI.
   - Garnier Fructis Wunderöl (curated, normal only) and the expansion Hitzeschutzspray Wunderöl (all three) share their first nine ingredients.
   - OGX Moroccan (medium, normal) and OGX Coconut Miracle (rich, coarse) share their first four ingredients.
   - Maria Nila True Soft (normal) leads with YOUNG.AGAIN's exact pair, cyclomethicone + dimethiconol.

   Meanwhile the expansion twins carry all three. This is not a data error; it's the one-thickness-per-row `Haartyp` convention. But it means curated thickness says nothing about the formula, and a user's own light silicone oil can get `wechseln empfohlen` on a thickness mismatch that its INCI doesn't justify.

## Sources fetched 2026-09-29 (web)

- KM: https://kevinmurphy.com.au/de/de/km/products-/by-benefit-/rejuvenate-/YOUNG-AGAIN.html ; https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html
- Olaplex: https://olaplex.de/products/olaplex-no-7-bonding-oil
- HASK: https://haskbeauty.com/products/repair-arganoil-hair-oil-3-3-oz ; https://haskbeauty.com/products/repair-arganoil-hair-oil-vial ; https://www.haarspullen.nl/en/products/argan-oil-repairing-shine-oil
- Shiseido Fino: https://nudieglow.com/products/shiseido-fino-premium-touch-penetrating-essence-hair-oil ; https://www.ratzillacosme.com/hair/fino-premium-touch-hair-oil/
- Jean&Len: https://www.jeanlen.de/keratin-haaroel (conflict: https://www.hautschutzengel.de/jean-len-haaroel-repair-keratin-mandel-inhaltsstoffe/produkt/344929.html lists Silica)
- Innersense: https://innersensebeauty.com/products/harmonic-treatment-oil ; older list https://www.cosmeterie.com/innersense-organic-beauty/harmonic-treatment-oil
- Neqi Opulent: https://neqi-hair.com/products/opulent-oil-hair-serum ; https://en.neqi-hair.com/products/opulent-oil-hair-serum
- Neqi Rosemary: https://neqi-hair.com/products/smooth-strength-rosemary-oil ; https://www.cosmeterie.at/neqi/smooth-strength-rosemary-oil
- Pantene 7in1: https://www.mueller.de/p/pantene-pro-v-miracles-oel-spray-7-in-1-IPN2992303/
- OGX Coconut Miracle: https://www.dm.de/p/d/2322377/ogx-haaroel-coconut-miracle-oil (US list with cyclosiloxanes on inkeedecoder differs; DE trusted)
- OGX Bond Protein Mist: https://www.ogxbeauty.com/products/bond-protein-repair-oil-mist
- Balea Traumlocken: https://www.dm.de/p/d/1635760/balea-professional-haaroel-traumlocken
- Garnier Sleek & Stay: https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum ; https://www.rossmann.de/de/pflege-und-duft-garnier-fructis-sleek-und-stay-heat-activated-serum/p/3600542638852
- Garnier Curl Revival: https://www.garnier.de/haarpflege/haarpflege-marken/wahre-schaetze/avocado/elixir (the catalog's dm URL now redirects to an unrelated Pantene product — dead affiliate link)
- Balea Oil Repair Intensiv: https://www.dm.de/p/d/1700841/balea-professional-haaroel-oil-repair-intensiv
- Pantene Coconut Infused: https://www.dm.de/p/d/1612745/pantene-pro-v-haaroel-coconut-infused-oil
- Urban Alchemy: https://urban-alchemy.com/products/smooth-supreme-ol-serum-75ml
- Weleda Gloss Drops: https://www.mueller.de/p/weleda-hydrashine-gloss-drops-haaroel-alpen-lein-PPN3138905/ ; https://www.weleda.de/produkt/hydra-shine-gloss-drops-haar-oel-alpen-lein-g05483
- Caveat: dm.de and Douglas product pages could not be read (JavaScript shells or 403), so those rows rest on manufacturer pages or other retailers.
