# Product Name & Brand Migration — Affiliate Link Enrichment Findings

**Date opened:** 2026-05-14
**Status:** Accumulating — apply as a migration after enrichment is complete.

During the affiliate-link backfill, agents matched DB rows to canonical retailer SKUs. Several rows were renamed by manufacturers, sold under different translations in the DE market, or had typos in the source data. Rather than write these renames piecemeal, we queue them here and apply as a single migration after all 5 review buckets are processed.

## How to apply

When the queue is complete, generate a Supabase migration that issues one `UPDATE` per row below. The `id` column is authoritative — match by id, not by name. Each entry has the affiliate_link URL we ended up using as evidence.

---

## Bucket A — confirmed during manual review on 2026-05-14

### Line-correction renames (DB had line/ingredient mix-ups; ingredient is correct, line was wrong)

The original DB rows for these two products had inconsistent line attributions — likely a data-entry slip. After verification on brand-direct garnier.de pages, we kept the ingredient as the source of truth and corrected the line.

### 1. id `5516009a-eecb-42dd-87f6-07c560161136`
- **Current:** brand=`Garnier`, name=`Garnier Wahre Schätze Aloe Vera Spülung`
- **Proposed:** brand=`Garnier`, name=`Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung`
- **Why:** Wahre Schätze line has no Aloe Vera variant; the actual Aloe Vera Spülung lives in the Fructis Hair Food line.
- **Evidence:** https://www.garnier.de/haarpflege/haarpflege-marken/fructis/hair-food/feuchtigkeits-spuelung-mit-aloe-vera

### 2. id `8c3eda97-5009-40bb-959b-1a7d90f48b09`
- **Current:** brand=`Garnier`, name=`Garnier Hair Food Macadamia`
- **Proposed:** brand=`Garnier`, name=`Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung`
- **Why:** The Macadamia conditioner in DE retail is the Wahre Schätze Kokosmilch & Macadamia Spülung, not a Hair Food SKU.
- **Evidence:** https://www.garnier.de/haarpflege/haarpflege-marken/wahre-schaetze/kokosmilch-macadamia/naehrende-spuelung

### Renames to apply

### 3. id `cce6346c-1458-42bf-a44d-1b23ecfd5516` *(actual id will resolve at apply time — see notes)*
- Same id pattern: Maske Haarkur Lamination Intense Glaze
- **Current:** brand=`Haarkur`, name=`Haarkur Lamination Intense Glaze`
- **Proposed:** brand=`Syoss`, name=`Syoss Haarkur Lamination Intense Glaze`
- **Why:** "Haarkur" is German for "hair treatment", not a brand. Product is Syoss.
- **Evidence:** https://www.dm.de/syoss-haarkur-lamination-intense-glaze-p4015100867213.html

### 4. id `6fde3fe2-...` (Pantene Volume Pur)
- **Current:** brand=`Pantene`, name=`Pantene Volume Pur`
- **Proposed:** brand=`Pantene`, name=`Pantene Pro-V Volumen Pur`
- **Why:** German DE name uses "Volumen"; full line designation is Pro-V.
- **Evidence:** https://www.dm.de/pantene-pro-v-shampoo-volumen-pur-p8700216885768.html

### 5. id `a1c3dc8d-...` (Cantu Lockenshampoo)
- **Current:** brand=`Cantu`, name=`Cantu Lockenshampoo`
- **Proposed:** brand=`Cantu`, name=`Cantu Shampoo Locken Pflege`
- **Why:** DM SKU name.
- **Evidence:** https://www.dm.de/cantu-shampoo-locken-pflege-p810006943450.html

### 6. id `d01de47e-...` (Balea Professional Ultra Volume)
- **Current:** brand=`Balea`, name=`Balea Professional Ultra Volume`
- **Proposed:** brand=`Balea`, name=`Balea Professional Ultimate Volume`
- **Why:** DM never sold "Ultra Volume"; current SKU is "Ultimate Volume".
- **Evidence:** https://www.dm.de/balea-professional-shampoo-ultimate-volume-p4067796075021.html

### 7. id `e7bfd306-...` (Sebamed Everyday)
- **Current:** brand=`Sebamed`, name=`Sebamed Everyday`
- **Proposed:** brand=`Sebamed`, name=`Sebamed Every-Day Shampoo`
- **Why:** Official Sebamed name uses hyphen.
- **Evidence:** https://www.amazon.de/Sebamed-10970-Every-Day-Shampoo-200ml/dp/B000UGYCP8

### 8. id `088b1427-...` (Head & Shoulders Derma X Aloe)
- **Current:** brand=`Head & Shoulders`, name=`Head & Shoulders Derma X Aloe`
- **Proposed:** brand=`Head & Shoulders`, name=`Head & Shoulders Derma X Pro Beruhigende Pflege`
- **Why:** Aloe variant rebranded for DE market as "Beruhigende Pflege".
- **Evidence:** https://www.dm.de/p/d/1343250/head-und-shoulders-shampoo-derma-x-pro-beruhigende-pflege

### 9. id `6b01025d-...` (Elvital Öl Magique Serum)
- **Current:** brand=`Elvital`, name=`Elvital Öl Magique Serum`
- **Proposed:** brand=`Elvital`, name=`Elvital Öl Magique Midnight Serum`
- **Why:** Only one Magique Serum exists on DM, and it's the Midnight variant.
- **Evidence:** https://www.dm.de/l-oreal-paris-elvital-haarserum-oel-magique-midnight-serum-p3600524135805.html

### 10. id `0756a919-...` (Living Proof Restore Instant Repair)
- **Current:** brand=`Living Proof`, name=`Living Proof Restore Instant Repair`
- **Proposed:** brand=`Living Proof`, name=`Living Proof Restore Repair Leave-In`
- **Why:** Living Proof dropped "Instant" from the name.
- **Evidence:** https://www.douglas.de/de/p/5011050022

### 11. id `9b664b11-...` (Acina Hyaluron 2.0)
- **Current:** brand=`Acina`, name=`Acina Hyaluron 2.0`
- **Proposed:** brand=`Alcina`, name=`Alcina Hyaluron 2.0`
- **Why:** "Acina" is a typo. Brand is Alcina.
- **Evidence:** https://www.amazon.de/ALCINA-Hyaluron-2-0-Spray-125/dp/B08P7TMWGX

### 12. id `e781ca9e-...` (Pantene Hydra Glow Leave-In)
- **Current:** brand=`Pantene`, name=`Pantene Hydra Glow Leave-In`
- **Proposed:** brand=`Pantene`, name=`Pantene Miracles Milk-to-Water Leave-In Serum`
- **Why:** "Hydra Glow" is the line; the leave-in SKU is the Milk-to-Water serum.
- **Evidence:** https://www.dm.de/pantene-pro-v-leave-in-haarserum-miracles-milk-to-water-p8700216181556.html

### 13. id `4f373d4f-...` (Balea Natural Beauty Bio-Argan Haaröl)
- **Current:** brand=`Balea`, name=`Balea Natural Beauty Bio-Argan Haaröl`
- **Proposed:** brand=`Balea`, name=`Balea Natural Beauty Pflegeöl Bio`
- **Why:** DM SKU name.
- **Evidence:** https://www.dm.de/balea-natural-beauty-pflegeoel-bio-p4066447276800.html

### 14. id `5827a3b9-...` (Pantene Pro-V 7in1 Spray)
- **Current:** brand=`Pantene`, name=`Pantene Pro-V 7in1 Spray`
- **Proposed:** brand=`Pantene`, name=`Pantene Pro-V Miracles 7in1 Öl-Spray`
- **Why:** Full DE SKU name.
- **Evidence:** https://www.mueller.de/p/pantene-pro-v-miracles-oel-spray-7-in-1-IPN2992303/

### 15. id `c574ee6f-...` (Garnier Fructis Sleek & Stay Öl)
- **Current:** brand=`Garnier`, name=`Garnier Fructis Sleek & Stay Öl`
- **Proposed:** brand=`Garnier`, name=`Garnier Fructis Sleek & Stay Heat-Activated Serum`
- **Why:** DE variant is sold as serum, not oil.
- **Evidence:** https://www.rossmann.de/de/pflege-und-duft-garnier-fructis-sleek-und-stay-heat-activated-serum/p/3600542638852

---

## Bucket B — brand-direct premium, confirmed on 2026-05-26

These rows were capped at `medium` confidence by the spec rule (brand-direct hosts get `medium` by design). Manual review confirmed they are legitimate brand-direct PDPs and got promoted.

### 16. id `45f4fe15-c439-476d-8a86-3b2aac5053bd`
- **Current:** brand=`Urban Alchemy`, name=`Urban Alchemy Repair`
- **Proposed:** brand=`Urban Alchemy`, name=`Urban Alchemy Repair & Revive Leave-In Spray`
- **Why:** Official PDP name; the DB row was a truncation of the marketing name.
- **Evidence:** https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml

### 17. id `5ad6c978-fd27-469e-9f26-ff3f05b9f67a`
- **Current:** brand=`Urban Alchemy`, name=`Urban Alchemy Smooth Serum`
- **Proposed:** brand=`Urban Alchemy`, name=`Urban Alchemy Smooth Supreme Öl Serum`
- **Why:** Official PDP name; DB row truncated "Supreme Öl".
- **Evidence:** https://urban-alchemy.com/products/smooth-supreme-ol-serum-75ml

### 18. id `7f5207e6-d281-416e-922c-3135dd9a8cc8`
- **Current:** brand=`Innersense`, name=`Innersense Harmonic Healing Oil`
- **Proposed:** brand=`Innersense`, name=`Innersense Harmonic Treatment Oil`
- **Why:** Innersense rebranded the product from "Healing Oil" to "Treatment Oil" (same SKU, same formula). The old name is no longer used.
- **Evidence:** https://innersensebeauty.com/products/harmonic-treatment-oil

---

## Bucket C — confirmed on 2026-05-26

### Group 1: 16 generic-ingredient Öle promoted to canonical brand SKUs

The original DB rows had `brand == name` (e.g. "Calendulaöl") — ingredient-level placeholders. We assigned a canonical retailer SKU per ingredient. **Recommendation engine is brand-agnostic** (uses `product_oil_eligibility` join table on thickness/subtype/purpose), so brand renames here have no recommendation-side effect — pure display-layer cleanup.

For each row below: change BOTH `brand` and `name` to match the canonical SKU. Affiliate link is already written.

| id | Old brand | Old name | New brand | New name |
|---|---|---|---|---|
| `1dce2c18-...` | Calendulaöl | Calendulaöl | Primavera | Primavera Calendulaöl Bio |
| `19aea9c4-...` | Macadamiaöl | Macadamiaöl | wesentlich. | wesentlich. Macadamianussöl kaltgepresst |
| `29e36443-...` | Distelöl | Distelöl | Rapunzel | Rapunzel Bio Distelöl |
| `2ffeae68-...` | Schwarzkümmelöl | Schwarzkümmelöl | nedura | nedura Schwarzkümmelöl ungefiltert |
| `38886b62-...` | Moringaöl | Moringaöl | MoriVeda | MoriVeda Premium Moringaöl |
| `3acd3c18-...` | Rizinusöl | Rizinusöl | greenmade | greenmade Bio Rizinusöl |
| `3eb198a5-...` | MCT-Öl | MCT-Öl | KoRo | KoRo MCT Öl |
| `4a95e1de-...` | Jojoba | Jojoba | Dr. Scheller | Dr. Scheller Jojobaöl |
| `517dca50-...` | Traubenkernöl | Traubenkernöl | Ölmühle Solling | Ölmühle Solling Bio Traubenkernöl |
| `70ea52bc-...` | Arganöl | Arganöl | MARRAKESCH | MARRAKESCH Bio Arganöl |
| `78e6f1b2-...` | Cacayöl | Cacayöl | (canonical brand TBD on review of Amazon SKU) | Cacayöl kaltgepresst |
| `9bfe0a67-...` | Olivenöl | Olivenöl | dmBio | dmBio natives Olivenöl extra |
| `a11855eb-...` | Aprikosenkernöl | Aprikosenkernöl | Kräuterland | Kräuterland Bio Aprikosenkernöl |
| `acf9d5cd-...` | Kokosöl | Kokosöl | Rapunzel | Rapunzel Bio Kokosöl nativ |
| `ca4ae209-...` | Mandelöl | Mandelöl | Mynatura | Mynatura Bio Mandelöl |
| `ff13bc3a-...` | Avocadoöl | Avocadoöl | Kräuterland | Kräuterland Bio Avocadoöl |

### Group 2: 8 substitutions / DE-successor renames

### 19. id `4fd5f4c3-83b2-4893-be8c-ada29b8ca718`
- **Current:** brand=`Head & Shoulders`, name=`Head & Shoulders Derma X 0%`
- **Proposed:** brand=`Head & Shoulders`, name=`Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege`
- **Why:** "Derma X 0%" appears to be a catalog typo; the DERMAXPRO Sanfte Kopfhautpflege is the matching DE SKU on Rossmann.
- **Evidence:** https://www.rossmann.de/de/pflege-und-duft-head-und-shoulders-derma-x-pro-sanfte-kopfhautpflege/p/8700216496056

### 20. id `6dc65df2-2466-43e4-bdc2-3a05803f305c`
- **Current:** brand=`Monday`, name=`Monday Volume`
- **Proposed:** brand=`Monday Haircare`, name=`Monday Haircare Volume Kraft & Fülle Shampoo`
- **Why:** Full DE SKU name on Flaconi.
- **Evidence:** https://www.flaconi.de/haare/monday-haircare/volume/monday-haircare-volume-kraft-and-fuelle-haarshampoo.html

### 21. id `8715f0f5-9104-46ec-b450-e73f1441c1fa`
- **Current:** brand=`Curlsmith`, name=`Curlsmith Weightless Protein Leave-In Conditioner`
- **Proposed:** brand=`Curlsmith`, name=`Curlsmith Weightless Air Dry Cream`
- **Why:** Curlsmith Weightless line has no "Protein" Leave-In variant; Weightless Air Dry Cream is the closest leave-in (protein-leaning per brand page).
- **Evidence:** https://de.curlsmith.com/products/weightless-air-dry-cream

### 22. id `94cf6959-a53b-421b-9f0f-05efc239171c`
- **Current:** brand=`Wella`, name=`Wella Ultimate Repair Leave-In`
- **Proposed:** brand=`Wella Professionals`, name=`Wella Ultimate Repair Protective Leave-In`
- **Why:** Official Wella Professionals DE PDP uses the "Protective Leave-In" naming.
- **Evidence:** https://www.wella.com/professional/de-DE/products/haarpflege/ultimate-repair/ultimate-repair-protective-leave-in

### 23. id `f8f3b51d-8e64-487d-bad5-4a47c58862ed`
- **Current:** brand=`Pantene`, name=`Pantene Pro-V Keratin Protect 10-in-1 Spray`
- **Proposed:** brand=`Pantene`, name=`Pantene Pro-V Miracles 7in1 Haaröl Spray`
- **Why:** The 10-in-1 variant is US-only; the DE successor is the 7in1 Miracles Haaröl Spray.
- **Evidence:** https://www.dm.de/pantene-pro-v-haarkur-miracles-7in1-haaroel-spray-p8700216178402.html

### 24. id `c4b9eaef-dfeb-41ea-9d28-9901660406b7`
- **Current:** brand=`Bali`, name=`Bali Curls Bond Repair`
- **Proposed:** brand=`Bali Curls`, name=`Bali Curls Deep Repair Mask`
- **Why:** No exact "Bond Repair" mask exists; Deep Repair Mask is the in-line equivalent (bond-repair functionality per brand description).
- **Evidence:** https://www.dm.de/bali-curls-haarmaske-deep-repair-p4262391990001.html

### 25. id `1bfa5b02-26d9-457b-a5e6-445cc2284490`
- **Current:** brand=`OGX`, name=`OGX Keratin & Protein`
- **Proposed:** brand=`OGX`, name=`OGX Bond Protein Repair Conditioner`
- **Why:** No exact "Keratin & Protein" SKU; OGX's newer Bond Protein Repair line is the closest protein-repair conditioner.
- **Evidence:** https://www.dm.de/ogx-conditioner-bond-protein-repair-p3574661818467.html

### 26. id `663acf09-7090-40d8-9411-71154b9d60f3`
- **Current:** brand=`Shiseido`, name=`Shiseido Fino Oil`
- **Proposed:** brand=`Shiseido Fino`, name=`Shiseido Fino Premium Touch Penetrating Hair Oil Essence`
- **Why:** Full DE-import SKU name on Amazon DE.
- **Evidence:** https://www.amazon.de/Fino-Premium-Touch-Penetrating-Essence/dp/B0GVFQP34X

---

## Rows to delete (no viable SKU)

These rows had no usable product after exhaustive research. `affiliate_link` is NULL; flag for deletion or `is_active=false` in the same migration.

### id `3c769f60-283f-48c3-9549-cf84b73115d7`
- **Row:** `Maria Nila` / `Maria Nila True Soft Leave-In` (category Leave-in)
- **Why:** Maria Nila's True Soft line has no Leave-In SKU and never did. Closest in-line product is the True Soft Argan Oil, which is a different product class. User decision (2026-05-26): cut from catalog.
