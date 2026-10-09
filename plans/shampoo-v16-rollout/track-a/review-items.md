# Track A — items for Nick's review (collected from freeze workers)

Running list; each item is evidence from a freeze packet, not a decision.

## Availability / possible delistings
- A13 Hair Biology Revitalize & Soothe — dm "Nicht lieferbar", shop-apotheke.at "nicht verfügbar", not at Rossmann. Not recommended live.
- A31 Neqi Volume Victory — Rossmann "Produkt nicht verfügbar", Notino DE sold out; only the Swiss manufacturer shop sells it. **Recommended live (fine × balanced).**
- A43 Sante Sensitive Care, A08 Dejan Garz, A51 Sebamed Urea 5% — dm online "nicht lieferbar", other retailers available (not a delisting by evidence).
- G12 Balea Professional Ultimate Volume — delisted at dm; already not recommended (replaced by Hydra Volume).

## Formula evidence that needs a physical pack
- A16 H&S Anti Schuppen Sensitive — manufacturer list (31 items, Dimethicone + Dimethiconol) contradicts its own "0% Silikone" badge; dm + Rossmann agree on 23 items without silicones. Earlier v1.3/v1.4 classifications used the silicone list.
- A51 Sebamed Urea 5% — headline claim Polidocanol absent from every INCI list.
- A36 OGX Rosemary Mint — pack shows "NEU / JETZT MIT LIPI PRO SHIELD" relaunch; Rossmann INCI may predate it.
- G02 H&S DERMAXPRO Beruhigende Pflege — newer retailer list (B) pinned; pack photo would confirm.

## Identity / barcode changes (formula unchanged)
- A01 Balea 2in1 Urea 5% — new dm GTIN 4066447965414 (catalog already holds it); dm files it under body wash ("Duschgel & Shampoo") — category question.
- A06 Balea Med Anti Schuppen — new dm GTIN 4066447972528 (catalog already holds it).
- A28 Langhaarmädchen Lovely Long — new GTIN 4066447864694 (catalog holds both); marketing now "gegen Haarausfall" (AnaGain) — hair-loss claims are ignored for targets per S-HAIRLOSS.

## Claim–INCI mismatches (noted, not blocking)
- A38 Pantene Hydra Glow — "Baobab-Essenz" claim, no baobab in INCI.

## Identity mismatches: earlier classification used a different SKU (from batch B5)
- **A15 Hask Shampoo Argan Oil — BLOCKED.** Catalog row = 355 ml GTIN 071164343166 (dm 1475016, "Nicht lieferbar"); its dm INCI differs (hydrolyzed keratin, MCI/MI, PQ-55). v1.3/v1.4 used the 473 ml "repair + argan" SKU (GTIN 071164341469, also "Nicht lieferbar"). Recommended live (coarse × dry). Options: re-point to 473 ml, delist/replace, or pack photo.
- **A25 L'Oréal "Ultimate Shampoo" (Elvital Glycolic Gloss 200 ml, GTIN 3600524128005)** — sulfate-free olefin-sulfonate formula; v1.3/v1.4 used the 300 ml SLES/dimethicone product (now GTIN 3600524230548). dm vs Rossmann differ only in fragrance tail (dm list pinned). Not recommended live.
- **A30 Neqi Moisture Mystery** — two formulas under GTIN 4063528078285: dm = olefin sulfonate + coco-glucoside + PQ-47; Rossmann + Notino + manufacturer = disodium laureth sulfosuccinate base (pinned, 2 GTIN-anchored retailers). Recommended live (fine × dry, normal × balanced). Pack photo would settle it.

## Claim–INCI notes (batch B5, not blocking)
- Salthouse Anti Juckreiz "Polidocanol" = Laureth-9 (consistent).
- Neqi "Algenextrakt" = Algin only; OGX Renewing "UV-Schutz" without a UV filter.

## Likely reformulations / multiple formulas under one GTIN (from batch B2)
- **A42 Santé Glossy Shine (recommended)** — sante.de (all sizes) + Müller: new Ammonium Lauryl Sulfate list (21 items); dm, Rossmann, codecheck still old Sodium Coco-Sulfate list (30). New list pinned provisionally; v1.3/v1.4 values describe the old formula.
- **A52 Swiss-O-Par Teebaumöl (recommended)** — three lists for GTIN 4104260076501: manufacturer (newest, + Terpineol/Pinene, pinned provisionally), dm (same without them), Rossmann/Müller (older MCI/MI-preserved). Neither freeze rule met; pack photo needed.
- **A27 Langhaarmädchen Beautiful Curls (recommended)** — catalog GTIN 4067796150735 outdated; live dm pack 4070765004649 (catalog holds both) with Aloe juice moved to position 2.
- A07 Being Big Hair — German list (Rossmann + Hagel) differs from the US brand formula; pinned German list.
- A47 GLISS Liquid Silk — Rossmann still shows older list (+ Hydrolyzed Keratin, Propylparaben); manufacturer + dm pinned.

## Availability (batch B2)
- **A17 H&S DERMAXPRO Haarshampoo Sensitive Pflege (recommended, coarse × irritated)** — manufacturer page 404, Rossmann exact-GTIN "nicht verfügbar"; only dm still lists it. Coverage-relevant (coarse × irritated has 2 recommended).

## Orchestrator consistency fix needed before the lane kit
- Own-brand retailer pages (Balea/dm, ISANA/Rossmann) were labelled `manufacturer_de` tier 2 by batches B1/B5/upgrade but `retailer` tier 3 by batch B2 (A02, A22). Normalize to one convention (calibration precedent: `manufacturer_de`, tier 2).

## Batch B4
- **A09 Garnier Wahre Schätze Honig Schätze** — two formulas live: new SLS-led (garnier.de, dm 400 ml 3600542461030, Müller 300 ml; pinned) vs old SLES + Dimethicone/Amodimethicone + beeswax (Rossmann 250 ml 3600542461511, dm 1000 ml 3600542499231). Scanning the old-formula GTINs resolves to this row. Decision: separate row for the old formula or not.
- A54 Syoss Intense Volume — manufacturer vs three retailers differ in preservative/allergen tail only; retailer list pinned (3 GTIN-anchored agree).
- **A29 Monday Volume (X1 exception, only coarse × oily)** — dm.at shows a different list (shea butter, styrene/acrylates; missing ginger, glycerin…); manufacturer page renders English with £ (tier 2 borderline).
- A34 OGX Biotin & Collagen — Rossmann says "ohne Silikone" but Amodimethicone listed; wheat-protein claim without INCI entry.
- A04 Balea Hydra Volume — single origin (dm own brand), 13 items; pack photo for tier 1.
- A19 ISANA MED Anti Schuppen — pack says "reinigt schnell fettendes Haar", web copy says "gegen trockene Kopfhaut".
