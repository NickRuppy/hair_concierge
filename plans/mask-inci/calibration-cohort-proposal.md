# Mask v1.0 — calibration cohort proposal

Status: **APPROVED by Nick 2026-09-04 with three modifications — freeze authorized, freeze itself still pending execution.**

## Approval record (interview rulings, 2026-09-04)

1. **Set approved:** 12 primaries + 4 reserves with the deterministic substitution rule.
2. **Named-bond coverage = gluconamide only** (archetype 4b maleate gap accepted): no maleate
   mask exists at dm/Rossmann/Müller (Olaplex sells via Douglas/Flaconi/salons), and maleate
   carriers are bondbuilder-category products with pre-shampoo protocols — outside the mask
   boundary by Nick's own F3/charter rulings. A future maleate drugstore mask lands on an
   uncalibrated enum value and triggers human review; accepted.
3. **Modification A — product #13 added: Olaplex No. 3 Hair Perfector as a refuse-test.** The
   engine's correct output is a G0 exclusion (bondbuilder category, pre-shampoo protocol, not
   post-shampoo rinse-out mask). It is included to prove the F3/boundary fence, never to classify.
4. **Modification B — Hask SKU corrected:** the 355 ml bottle (dm titles it "Conditioner",
   [dm.de/p/d/1475001](https://www.dm.de/p/d/1475001/hask-conditioner-repairing-argan-oil)) is
   replaced by the **HASK Haarkur Argan Oil Sachet, 50 ml**
   ([dm.de p71164333068](https://www.dm.de/hask-haarkur-argan-oil-sachet-p71164333068.html)):
   post-wash, ~10-minute dwell, rinse-out, 1–2×/week — the actual mask-form product. Its sachet
   INCI must be captured independently; never merged from the bottle's list (§4.2 conflict is
   thereby resolved rather than kept as a stress case — refuse-tests are covered by #12 and #13).
5. **Bali Curls kept** (both products) despite below-tier sourcing; substitution rule + flag to
   Nick applies if their exact formulas cannot be verified at freeze time.
6. **Correction:** the "new-to-system count: 2" below is wrong — Isana 3in1 Milchprotein & Mandel
   is in the existing catalog. True new-to-system count: 1 (MONDAY Smooth Anti-Frizz).

Original proposal below, retained unchanged as provenance.

---

Original status line: **PROPOSAL — nothing frozen.** No product is classified, no INCI has been analyzed in depth, no catalog value or Product Intake rule is affected. This document exists to get Nick's approval on *which 12 + reserves* to calibrate against before Phase 2 (INCI reading) begins.

Scope note per `00_category_charter.md`: research artifacts only, no production changes.

---

## 1. Proposal table — 12 primary products

Identity fields are what's needed to *find* the exact product/pack for later INCI reading — not a pre-classification. "Source tier" follows the requested order: dm > Rossmann > Müller > brand-direct > Amazon DE (anything below that, e.g. specialty retail or an ingredient-database URL number, is flagged explicitly).

| # | Brand | Exact product name | Pack size | GTIN/EAN | INCI source URL | Source tier | Archetype slot(s) |
|---|---|---|---|---|---|---|---|
| 1 | Hask | Argan Oil Repairing Deep Conditioner (dm.de lists it as "HASK Conditioner Repairing Argan Oil") | 355 ml | UPC 071164343265 (dm.de slug) — see gap below | [dm.de](https://www.dm.de/hask-conditioner-repairing-argan-oil-p71164343265.html) | dm | 1 (rich oil/butter, high anchor) — also flagged as a bonus source-conflict case, see §4 |
| 2 | Schwarzkopf Gliss Kur | 7 Sekunden Express-Repair Kur, Ultimate Repair | 200 ml | 4015100433456 | [dm.de](https://www.dm.de/schwarzkopf-gliss-kur-haarkur-express-repair-7sec-ultimate-repair-p4015100433456.html) | dm | 2 (light express Kur ≤1 min — this is 7 sec, the extreme low end) |
| 3 | Bali Curls (by Hank Ge) | Total Repair SOS Protein Treatment (mini/disposable format) | 20 ml sachet | 4262391991114 (INCI Beauty product-URL number) | [Hautschutzengel](https://www.hautschutzengel.de/en/bali-curls-total-repair-sos-protein-treatment-inhaltsstoffe/produkt/354177.html) | below Amazon DE tier — specialty curly-hair retail; see §4 | 3 (protein-forward "protein bomb") |
| 4 | Schwarzkopf Gliss | Liquid Silk Glanz 4-in-1 Bonding Haarmaske | 400 ml | 4015100813913 | [dm.de](https://www.dm.de/schwarzkopf-gliss-haarmaske-4in1-liquid-silk-p4015100813913.html) / [Rossmann](https://www.rossmann.de/de/pflege-und-duft-gliss-liquid-silk-glanz-4-in-1-bonding-haarmaske/p/4015100813913) | dm + Rossmann (both agree) | 4 (named-bond, gluconamide — INCI includes **Hydroxypropylgluconamide**) + 11 (multi-use 4in1, mode-scoped) |
| 5 | Isana (Rossmann own brand) | Haarmaske 3in1 Mandelmilch (Milchprotein & Mandel) | 250 ml | 4305615609775 | [codecheck.info](https://www.codecheck.info/kosmetik_koerperpflege/haarpflege/kuren_masken/ean_4305615609775/id_2370850630/Isana_Haarmaske_Mandelmilch_3in1.pro) | Rossmann (own brand) | 11 (second, independent multi-use case — protein-flavored rather than bond-flavored) + secondary protein depth (two named hydrolyzed proteins) |
| 6 | MONDAY Haircare | Smooth Anti-Frizz Haarmaske | 250 ml | 4895248003991 (Rossmann URL slug — see gap below) | [Rossmann](https://www.rossmann.de/de/pflege-und-duft-monday-haircare-smooth-anti-frizz-haarmaske/p/4895248003991) | Rossmann | 6 (silicone-heavy smoothing/anti-frizz — INCI includes **Dimethicone + Dimethiconol**) — **new to system** |
| 7 | Pantene Pro-V | Miracles Molecular Bond Repair Intensive Haarmaske | 300 ml | 8700216173476 | [dm.de](https://www.dm.de/pantene-pro-v-haarkur-miracles-bond-repair-intensive-haarmaske-p8700216173476.html) / [Rossmann](https://www.rossmann.de/de/pflege-und-duft-pantene-pro-v-miracles-molecular-bond-repair-intensive-haarkur/p/8700216173476) | dm + Rossmann (both agree) | 5 ("Bond"-branded without named chemistry — active ingredient is **Bis-Aminopropyl Dimethicone**, a silicone-amine, not an established named bond agent like a gluconamide or maleate) |
| 8 | Sante Naturkosmetik | Intense Hydration Maske | 150 ml | 4055297220682 | [Sante brand site](https://www.sante.de/de/produkt/intense-hydration-1-minute-wonder-maske.html) (product family page — confirm exact 150 ml SKU page separately, see §4) / [pro-biomarkt.de](https://www.pro-biomarkt.de/sante-intense-hydration-maske-150-ml) | brand-direct | 7 (silicone-free, natural-positioned — NATRUE-certified natural cosmetics brand) |
| 9 | Balea Professional (dm own brand) | Haarmaske 3in1 Aqua Hyaluron | 150 ml | 4066447668315 | [Hautschutzengel](https://www.hautschutzengel.de/balea-professional-haarmaske-3in1-aqua-hyaluron-150-ml-inhaltsstoffe/produkt/312508.html) (dm.de product page exists at [dm.de/p/d/1417521](https://www.dm.de/p/d/1417521/balea-professional-haarmaske-3in1-aqua-hyaluron) but is JS-rendered and could not be fetched directly this pass) | dm (own brand; INCI source is Hautschutzengel pending direct dm.de confirmation) | 8 (moisture/humectant Feuchtigkeitsmaske — hyaluronic acid + up to 40% aloe vera) |
| 10 | Bali Curls (by Hank Ge) | Deep Repair Mask | 200 ml | 4262391990001 (INCI Beauty product-URL number) | [Hautschutzengel](https://www.hautschutzengel.de/en/bali-curls-inhaltsstoffe/marke/14479777.html) | below Amazon DE tier — specialty curly-hair retail; see §4 | 9 (curl mask) |
| 11 | L'Oréal Paris Elvital | Glycolic Gloss, 5-Minuten Haar-Laminierung | 200 ml | 3600524128500 | [dm.de](https://www.dm.de/l-oreal-paris-elvital-haarkur-glycolic-gloss-5-minuten-haar-laminierung-p3600524128500.html) / [Rossmann](https://www.rossmann.de/de/pflege-und-duft-loreal-paris-elvital-glycolic-gloss-5-minuten-haar-laminierung/p/3600524128500) | dm + Rossmann (both agree) | 10 (gloss/lamination treatment, F4 case — glycolic acid claim, claim-gated per charter) |
| 12 | Guhl | Panthenol + Reparatur 2in1 Kur & Spülung | 200 ml | 4072600703403 | [dm.de](https://www.dm.de/haarkur-und-conditioner-2in1-panthenol-reparatur-p4072600703403.html) / [Rossmann](https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403) | dm + Rossmann (both agree) | 12 (boundary stress — this is the charter's own named example of a product whose only rinse-out mode is a short conditioner mode, ruled Conditioner-engine territory, F1-excluded from Mask) |

**New-to-system count:** 2 of 12 (MONDAY Anti-Frizz Haarmaske, Isana 3in1 Mandelmilch) are not on the existing 50-product Maske cohort list Nick gave as reference. The other 10 overlap with named catalog items, per the instruction to prefer overlap where it fits.

**No product was analyzed for INCI content beyond the single marker ingredient needed to justify its archetype slot** (e.g. "contains Hydroxypropylgluconamide" for the bond case). Full ingredient lists are intentionally not reproduced here.

---

## 2. Archetype coverage matrix

| # | Archetype | Primary product(s) | Coverage status |
|---|---|---|---|
| 1 | Rich butter/oil mask (weight high anchor) | Hask Argan Oil Deep Conditioner | Covered — flag: German retail name is "Conditioner," not "Maske/Kur" (see §4) |
| 2 | Light express Kur ≤1 min (F2) | Gliss 7 Sekunden Express-Repair | Covered — 7 sec is the most extreme low-dwell case available |
| 3 | Protein-forward "protein bomb" | Bali Curls SOS Protein Treatment (primary); Isana 3in1 Mandelmilch (secondary, two named hydrolyzed proteins) | Covered, double-sourced |
| 4a | Named-bond mask — gluconamide | Gliss Liquid Silk Glanz 4in1 Bonding | Covered — confirmed INCI marker: Hydroxypropylgluconamide |
| 4b | Named-bond mask — maleate-based | — | **NOT FOUND at dm/Rossmann/Müller.** See §4 — this is an open gap, not silently dropped. |
| 5 | "Bond"-branded without named chemistry (discrimination stress) | Pantene Pro-V Miracles Molecular Bond Repair | Covered — active is Bis-Aminopropyl Dimethicone, not an established named bond agent |
| 6 | Silicone-heavy smoothing/anti-frizz | MONDAY Smooth Anti-Frizz Haarmaske | Covered — confirmed INCI markers: Dimethicone, Dimethiconol |
| 7 | Silicone-free natural-positioned | Sante Intense Hydration Maske | Covered — NATRUE-certified brand |
| 8 | Moisture/humectant-forward Feuchtigkeitsmaske | Balea Professional Aqua Hyaluron 3in1 | Covered |
| 9 | Curl mask | Bali Curls Deep Repair Mask | Covered |
| 10 | Gloss/lamination treatment (F4) | L'Oréal Elvital Glycolic Gloss 5-Min-Laminierung | Covered |
| 11 | Multi-use 3in1 with stated rinse-out mask mode (F1, mode-scoped) | Gliss Liquid Silk 4in1 (bond-flavored); Isana 3in1 Mandelmilch (protein-flavored) | Covered, double-sourced with two independent multi-use "flavors" |
| 12 | Boundary stress: plausibly-just-a-conditioner / source-conflict | Guhl Panthenol + Reparatur 2in1 Kur & Spülung (charter's own named exclusion example) | Covered — this is the cleanest possible case since Nick's charter already ruled it excluded |

**Every archetype has ≥1 product except 4b (maleate-based bond), which is an acknowledged, explicit gap** rather than a silent substitution. See §4 for the reasoning and options.

---

## 3. Reserves (4) and substitution rule

Reserves are proposed only where identity risk is highest in the primary picks — express-dwell claims, protein/multi-use overlap, bond-naming ambiguity, and a brand-new silicone claim. The five archetypes sourced with two independent tier-1 URLs in agreement (4, 7, 10, 11, 12) are judged lower-risk and don't get a dedicated reserve in this first pass.

| Reserve | Identity | Substitutes for | Trigger |
|---|---|---|---|
| R1 — Isana 3in1 Mandelmilch (already primary #5, dual-purpose) is itself the built-in reserve for #4/#11 | 250 ml, EAN 4305615609775, Rossmann | Gliss Liquid Silk 4in1 (archetype 4 + 11) | If Gliss Liquid Silk's INCI can't be re-confirmed against the sourced page, or its gluconamide marker doesn't hold up under full-INCI reading, Isana's multi-use slot absorbs archetype 11 alone (archetype 4 gluconamide then has zero coverage — flag to Nick if this triggers) |
| R2 — Balea Professional Plex Care 2in1 Haarmaske | 250 ml, EAN 4066447378771, dm.de | Pantene Bond Repair (archetype 5) | If Pantene's exact SKU/EAN can't be pinned down (see §4 EAN conflict), or its "bond" chemistry turns out to be named after all under full reading — Plex Care's INCI (Distearoylethyl Hydroxyethylmonium Methosulfate-based, no gluconamide/maleate found) is an equally strong "unnamed bond chemistry" stand-in |
| R3 — Wahre Schätze 1-Minute Kur, Kokosmilch & Macadamia | 340 ml, EAN 3600542509350, dm.de | Gliss 7 Sekunden Express-Repair (archetype 2) | If Gliss 7sec's identity or sourcing fails, this is a second confirmed dm.de express-Kur (1 min vs 7 sec — slightly less extreme but still F2 territory) |
| R4 — John Frieda Frizz Ease Wunder-Kur (Tiefenwirksame Wunder-Kur) | 250 ml, Müller | MONDAY Smooth Anti-Frizz Haarmaske (archetype 6) | If MONDAY's EAN/pack can't be independently confirmed (it's sourced from a single Rossmann URL only), this silicone-heavy alternative (Dimethicone + Dimethiconol + Amodimethicone confirmed) covers the same archetype with a Müller-tier source |

No reserve is proposed for archetype 4b (maleate-based bond) because none was found in-market at the required tier — see §4, option set.

---

## 4. Open identity gaps / risks

These are flagged, not resolved. Freezing any of them requires either a direct-page re-check or Nick's explicit acceptance of the gap.

1. **Archetype 4b (maleate-based bond) has no German-drugstore candidate.** Maleic-acid/dimaleate bond chemistry (the Olaplex-style route) appears in salon-distribution lines (Redken Acidic Bonding Concentrate, L'Oréal Professionnel Smartbond/Metal Detox) but these are not sold through dm/Rossmann/Müller. L'Oréal's consumer-facing "Elvital Bond Repair" range (Pre-Shampoo, Shampoo) is drugstore-available but its INCI marker for the bond claim was not confirmed as maleate-based in this pass. **Decision needed:** accept gluconamide-only coverage for archetype 4, or approve widening the search to Amazon DE-tier products, or accept an Elvital Bond Repair variant pending full-INCI confirmation.

2. **Hask Argan Oil — EAN/name conflict (also useful as a bonus boundary-stress signal).** codecheck.info lists EAN 5391018041945 for "Hask Argan Oil Repairing Deep Conditioner." dm.de sells the same formula family as "HASK Conditioner Repairing Argan Oil" in two packs — 355 ml (UPC 071164343265, per dm.de URL slug) and 473 ml (dm.de internal ID 3123985, EAN not retrieved this pass). It is not confirmed whether all three are the same pack/EAN or genuinely distinct SKUs. Separately, dm.de's own product name calls it a "Conditioner," not "Maske"/"Kur" — this needs a dwell-time/authoritative-directions check against the charter's P5 sourced-contact-time rule before treating it as mask-eligible at all, rather than Conditioner-engine territory like the Guhl case.

3. **Bali Curls (both SOS Protein Treatment and Deep Repair Mask) are sourced below the requested tier.** Bali Curls is sold through specialty curly-hair retailers (Lockenbox, CurlyTools, Bali-Care's own DE site) and Amazon.de, not dm/Rossmann/Müller. EANs used here (4262391991114, 4262391990001) come from an INCI-database product-URL number, not a retailer or brand-direct EAN listing. This is consistent with Nick's own reference list naming these products, but the sourcing tier is weaker than the rest of the cohort — flagging in case Nick wants German-drugstore-only substitutes for archetypes 3 and 9 instead.

4. **MONDAY Anti-Frizz Haarmaske EAN is single-sourced.** The GTIN (4895248003991) is inferred from the Rossmann.de URL slug convention (confirmed reliable elsewhere in this cohort — Gliss, Elvital, Guhl, Pantene all cross-check between dm.de and Rossmann.de using the same convention), but this is the only entry where no second source corroborates it. Low risk, but not independently verified.

5. **Sante Intense Hydration exists in two pack formats.** A 150 ml jar (EAN 4055297220682) and a 20 ml "1 Minute Wonder Mask" sachet (EAN 4025089005896) are both in market. This proposal picks the 150 ml jar for archetype 7 (silicone-free/natural). If Nick wants an additional express-Kur data point, the 20 ml sachet could be added as a 13th product or reserve for archetype 2 — not included here to keep the count at exactly 12+4.

6. **Balea Professional Aqua Hyaluron 3in1's dm.de product page could not be rendered by this pass's fetch tooling** (JS-heavy SPA returned only header/logo markup). The EAN and INCI list are corroborated by Hautschutzengel and a second independent retailer (fresh-store.eu), but a direct dm.de confirmation is still outstanding.

7. **Pantene EAN discrepancy, resolved but noted.** One search result surfaced an alternate EAN (8700216334525) for what may be the same product family under a different name ("Pantene Miracle Rescue Bond Repair Mask" — likely a different regional/former SKU). This proposal uses 8700216173476 because it is corroborated by two independent tier-1 sources (dm.de and Rossmann.de) under the exact German product name "Miracles Molecular Bond Repair Intensive Haarmaske/Haarkur." Flagging the alternate figure so it isn't mistaken for a second product later.

---

## 5. Next step

This is a proposal only. Freezing the 12 + reserves — and moving into Phase 2 (reading full INCI, applying TPL-MASK, sourcing contact times per P5) — requires Nick's explicit sign-off, including an explicit call on the archetype-4b gap (§4.1) and however much of §4's other gaps he wants resolved before vs. after freezing.
