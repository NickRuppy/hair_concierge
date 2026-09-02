# DB Expansion Batch 1 — Candidate Selection (PROPOSAL, not final)

Generated 2026-09-02. This is a **draft ledger for Nick's review**, not an approved list. Nothing here has been applied to the database. Companion machine-readable file: `selection-batch1-draft.json`.

**Scope:** ~30 pilot products + a ranked backlog toward ~170 more, for `shampoo`, `conditioner`, `leave_in`, `oil`, `mask`, sold at dm and/or Rossmann (Germany).

---

## Pilot (30) — by category

### Shampoo (8)

| Brand | Product | Size(s) | EAN status | Retailer | Why |
|---|---|---|---|---|---|
| L'Oréal Paris Elvital | Shampoo Hydra Hyaluronic, feuchtigkeitsspendend | 1000 ml (+250/400 ml) | ✅ 3600524099299 (1000 ml) | dm | #1 by review count in dm's shampoo search (3309), missing from catalog |
| L'Oréal Paris Elvital | Shampoo Dream Length | 1000 ml (+300 ml @ Rossmann) | ✅ 3600524062637 (1000 ml, dm GTIN field, cross-confirmed by matching Rossmann URL); ✅ 3600524138530 (300 ml, Rossmann Syndigo tag) | dm, rossmann | 2221 reviews; promoted from backlog 2026-09-02 (Glycolic Gloss shampoo turned out to already exist in catalog — see Corrections) |
| Wahre Schätze | Shampoo Honig Schätze | 400 ml (+250/1000 ml) | ✅ 3600542461030 | dm | 2111 reviews; brand in catalog, this variant isn't |
| Garnier Fructis | Shampoo Locken Methode Feuchtigkeit | 200 ml | ✅ 3600542571739 | dm | 1982 reviews, curl-specific bestseller |
| Syoss | Shampoo Intense Keratin | 440 ml | ✅ 4015100860344 | dm | 1007 reviews; conditioner/mask already in catalog, shampoo missing |
| Nivea | Shampoo Power Repair | 250 ml | ✅ 4006000192543 | dm | 892 reviews, major FMCG brand |
| Being (ZURU) | Big Hair Shampoo | 354 ml | ✅ 4895248005872 (re-verified: no labeled GTIN field on Rossmann's page, but confirmed via the page's own Syndigo content-sync tag, matches URL, checksum valid) | rossmann | **rossmann_new** — brand-new 2026 Rossmann-exclusive line |
| Schwarzkopf Gliss | Sealing Shampoo Sealing Miracle | 200 ml | ✅ 4015100895025 (Rossmann Syndigo tag) | rossmann | **rossmann_new** — explicitly tagged "Neu", homepage promo banner |

### Conditioner (6)

| Brand | Product | Size(s) | EAN status | Retailer | Why |
|---|---|---|---|---|---|
| Wahre Schätze | Conditioner Honig Schätze | 250 ml | ✅ 3600542462150 | dm | 1939 reviews, pairs with pilot shampoo |
| Herbal Essences | Conditioner Blütensanft Rosenduft | 250 ml | ✅ 8700216210508 | dm | 1440 reviews; brand has zero presence in catalog |
| L'Oréal Paris Elvital | Conditioner Glycolic Gloss | 150 ml (+250 ml @ Rossmann) | ✅ 3600524144036 | dm, rossmann | 2630 reviews, completes Glycolic Gloss line |
| Wahre Schätze | Conditioner Traube Hydraboost | 250 ml | ✅ 3600542656320 | dm | 1295 reviews |
| L'Oréal Paris Elvital | Conditioner Bond Repair Anti-Haarschäden | 150 ml | ✅ 3600524074791 (dm GTIN field) | dm | 723 reviews |
| Being (ZURU) | Big Hair Conditioner | 354 ml | ✅ 4895248005926 (Rossmann Syndigo tag) | rossmann | **rossmann_new** — pairs with pilot shampoo |

### Mask (6)

| Brand | Product | Size(s) | EAN status | Retailer | Why |
|---|---|---|---|---|---|
| Schwarzkopf Gliss | Haarkur Night Elixier Ultimate Repair | 100 ml | ✅ 4015100813951 | dm | 1891 reviews, dm brand-highlight banner |
| L'Oréal Paris Elvital | Haarkur Glycolic Gloss (5-Min. Haar-Laminierung) | 200 ml | ✅ 3600524128500 | dm | 2828 reviews — most-reviewed mask found |
| Garnier Fructis | Haarkur Banana Hair Food 3in1 Maske | 400 ml | ✅ 3600542511070 | dm, rossmann | Cross-confirmed (1290 dm / 1127 rossmann) |
| Herbal Essences | Haarmaske Blütensanft | 300 ml | ✅ 8700216212724 (Rossmann Syndigo tag; cross-validated — the same search also returned the Blütensanft conditioner at an EAN matching the already dm-confirmed value exactly) | rossmann | 1211 reviews, completes Blütensanft line |
| Schwarzkopf Gliss | Haarkur 7sec Express-Repair, Ultimate Repair | 200 ml | ✅ 4015100813319 | dm | 992 reviews, fast-format |
| IDA WARG Beauty | Intense Moisture Hair Mask | 250 ml | ✅ 6412600231793 (Rossmann Syndigo tag) | rossmann | **rossmann_new** — new premium Swedish brand |

### Leave-in (5)

| Brand | Product | Size(s) | EAN status | Retailer | Why |
|---|---|---|---|---|---|
| L'Oréal Paris Elvital | Leave-In Serum Glycolic Gloss | 150 ml | ✅ 3600524135430 | dm, rossmann | Cross-confirmed (2613 dm / 2482 rossmann) |
| L'Oréal Paris Elvital | Leave-In Haarkur Hydra Hyaluron, Aufpolsterndes Feuchtigkeitsserum | 150 ml | ❌ none | rossmann | 2770 reviews, pairs with pilot shampoo |
| L'Oréal Paris Elvital | Leave-In Haarserum Bond Repair, Anti-Haarschäden | 150 ml | ✅ 3600524075576 (dm GTIN field) | dm | 800 reviews; promoted from backlog 2026-09-02 (head&shoulders Derma x Pro reclassified as scalp_care and parked — Nick's call, it's a Kopfhaut-Serum, not hair care) |
| Garnier Fructis | Leave-In Creme Aloe Air Dry | 400 ml | ✅ 3600542117593 | dm | 959 reviews (see gaps note on possible catalog overlap below; 2026-09-02 follow-up in Corrections finds this is likely a distinct sub-line from "Hair Food Aloe Vera", not the same product) |
| Being (ZURU) | Major Moisture Leave-In Conditioner | 227 ml | ✅ 4895248005988 (Rossmann Syndigo tag) | rossmann | **rossmann_new** |

### Oil (5)

| Brand | Product | Size(s) | EAN status | Retailer | Why |
|---|---|---|---|---|---|
| Wahre Schätze | Haarserum Honig reparierend | 115 ml | ✅ 3600542567329 | dm, rossmann | Cross-confirmed, by far the most-reviewed oil (2810 dm / 2682 rossmann) |
| Schwarzkopf Gliss | Haaröl Tägliches Öl Elixier | 75 ml | ✅ 4015100813791 | dm, rossmann | Cross-confirmed (153 dm / 136 rossmann); Gliss has no oil in catalog |
| L'Oréal Paris Elvital | Haaröl Öl Magique, für alle Haartypen | 100 ml | ✅ 3600523734955 | dm, rossmann | Cross-confirmed (324 dm / 282 rossmann); catalog only has the Jojoba variant |
| Isana Professional | Haaröl Arganöl & Pflege | 100 ml | ✅ 4068134024947 (Rossmann Syndigo tag) | rossmann | 406 reviews, Rossmann private label pick |
| Monday Haircare | Repair Argan Haaröl | 89 ml | ✅ 4895248009825 (Rossmann Syndigo tag) | rossmann | **rossmann_new** — explicitly tagged "Neu" |

**Pilot rossmann_new count: 6** (within the 5–8 target).

---

## Backlog (122 candidates, ranked)

Ranked roughly by popularity signal (review count on dm.de / rossmann.de, used as a bestseller proxy — see confidence notes). Full detail incl. EANs (mostly uncaptured — see gaps) and source URLs is in the JSON. Compact view below, grouped by category, in rank order.

**Shampoo (31):** L'Oréal Elvital Dream Length (1000 ml, 2221 rev — very high, only missed pilot cap) · Herbal Essences Blütensanft (1649) · schauma Repair & Pflege (763) · Garnier Fructis Coco Water (331) · Herbal Essences Fiji (257) · Gliss Liquid Silk (537) · Gliss Total Repair (425) · Pantene Repair & Care XXL (237) · head&shoulders Classic Clean (107) · Syoss Men Intense Power / Intense Color / Intense Repair (rossmann, ~133 each) · Elvital Color Glanz (185) · Jean&Len Hydration Pfirsich Chia (65) · **Isana** Sensitiv / 2in1 Volumen / Seidenglanz / Anti-Schuppen Wasserminze&Grüner Tee / Oil Repair Marulaöl / MED Jeden Tag / MED pH5.5 / Feuchtigkeit (rossmann private label, 165–507 rev each — zero Isana shampoo in catalog today) · John Frieda Violet Crush Silber (92) · Dr. Wolff Plantur DMG Clinical (73) · head&shoulders Apple Fresh (78) · Being Max Moisture / Bye Bye Anti-Frizz / Curl Power Locken / NOURISH+SHINE (new brand) · IDA WARG Moisture Shampoo (new brand) · Bali Gents Coffein Activator (rossmann "Neu" tag, 0 reviews yet — lowest confidence).

**Conditioner (30):** Elvital Hydra Hyaluronic (248) · Herbal Essences Fiji (202) · Gliss Total Repair (336) · Pantene Repair & Care (559) · Garnier Fructis Locken Methode (206) · Pantene Grow Abundant (510, cosmetic framing only) · Aussie Bouncy Curls (73) · Langhaarmädchen Intense Repair (155) · Herbal Essences Limettenduft (81) · Jean&Len Hydration Pfirsich Chia (61) · Syoss Tiefenspülung Intense Repair (117) · Nivea Hairmilk Shine (155) · Gliss Total Repair Express-Repair-Spülung spray (241) · John Frieda Go Blonder / Salon Blonde Champagnerblond / Sheer Blonde / Violet Crush Silber (85–104) · Elvital Dream Length Super Aufbau Spülung · **Isana** Seidenglanz / Feuchtigkeit / Professional Keratin&Repair / Oil Repair Marulaöl / Professional Plex / Professional Locken Traum (147–222 rev each) · Being Max Moisture / Bye Bye Frizz / Curl Power Locken / Nourish+Shine (new brand) · IDA WARG Moisture / Beauty Repair (new brand).

**Mask (26):** Elvital Haarmaske Hydra Hyaluronic (126) · John Frieda Frizz Ease Wunder-Kur (89) · Pantene Moisture Boost Keratin Protect (87) · Guhl 30sek Reparatur (101) · Pantene Hydration SOS Hair Shake (101) · Pantene 1-Min Wunder-Ampulle (154, single-use ampoule) · Garnier Fructis Keratin Sleek Anti-Frizz (392) · Wahre Schätze 1-Minute Traube (1356 — very high, only missed pilot cap) / Honig Schätze (300) · John Frieda Tägliche Wunderkur Spray (84) · Langhaarmädchen Intense Repair (70, ampoule) · Elvital Dream Length Rapid Reviver (389) · Gliss Total Repair 1-Min Express-Kur (212) · Elvital Color Glanz Purple (332) · Garnier Fructis Kakao Butter Hair Food (150) · **Isana Professional** Arganöl&Pflege / Plex / Intensiv&Pflege / Locken Traum (117–214 rev each) · Bali Curls Deep Hydration Mask (12) · Balea Haarkur Feuchtigkeit ampoule (102) · Being Mega Anti-Frizz / Mega Moisture / Mega Shine (new brand) · IDA WARG Repair Hair Mask (new brand) · Dr. Wolff Plantur DMG Clinical Haarserum (79, cosmetic framing only).

**Leave-in (21):** Elvital Bond Repair Leave-In Haarserum (800 — only missed pilot cap) · Pantene Miracles Molecular Bond Repair (257) · Garnier Fructis Locken Methode Air Dry (207) · Herbal Essences Kamille (128) / Blütensanft (98) · Balea Professional Plex Care Serum (228) · Dejan Garz Leave-In Cream / Serum The Foundation (314/399) · Balea Professional Molecular Care Haarmaske (110) · Jean&Len Peptide Intense Repair (97) · Wahre Schätze Avocado / Honig (200–221) · Afrolocke curl leave-in (141) · Aussie Oh My Gloss (62) · Pomélo+Co Molecular Repair Leave-In Mask (82) · Pantene Sunkiss Glow (66) · Plantur 39 Leave-In Sprühkur (87) · Isana Professional Plex Leave-in Serum (122) / Haarfluid Wunder Express (218) · Being Major No-Frizz / Major Shine Leave-In Spülung (new brand).

**Oil (14):** Langhaarmädchen Intense Repair (368 — high, only missed pilot cap) · Dejan Garz Violet Hair Oil The Britney (337) · Herbal Essences Arganöl Elixir (98) · Balea Professional Plex Care Oil (238) · Bali Curls Bonding Oil (69) · Weleda Rosmarin (78) · Pantene Argan Infused Oil (137) · Gliss Hitzeschutz Öl-Spray (211) · Garnier Fructis Hitzeschutzspray Anti-Spliss (383 dm / 182 rossmann) · Pantene Glatt&Seidig Argan Infused Oil (245) · Alterra Haar-und Kopfhautöl (78) · Elvital Öl-Kur Trockenes Haar (179) · Dejan Garz The Fairy Light Oil (63) · Pantene LOVE Edition (63, limited edition — lowest priority).

Full per-item detail (exact size, EAN where captured, source URL) is in `selection-batch1-draft.json`.

**Backlog rossmann_new count: 9** (total across pilot + backlog: **15**, within the 10–20 target).

---

## Corrections (Nick review, 2026-09-02)

1. **"Shampoo Glycolic Gloss" removed from pilot — it already exists in the catalog under a truncated name.** DB row `88c230c5` "L'Oréal Paris Ultimate Shampoo" carries GTIN 3600524128005 and an affiliate link to the Rossmann Glycolic-Gloss-Shampoo page: same product, bad name from the 2026-07-03 ingestion. **Action item (batch apply or intake tooling, not a hot fix): rename to "Elvital Glycolic Gloss Shampoo"**; optionally add the 300 ml Rossmann EAN later. Recorded in JSON under `existing_product_corrections`.
2. **head&shoulders "Leave-In Serum Derma x Pro Kopfhaut-Feuchtigkeitspflege" parked** — it is a scalp serum (`scalp_care`), not hair leave-in; outside the big-five pilot. Recorded under `parked` for a future scalp-care batch.
3. Slots backfilled from backlog rank order: **Elvital Dream Length Shampoo** (2221 reviews) and **Elvital Bond Repair Leave-In Haarserum** (800 reviews). Pilot remains 30 (8/6/6/5/5).
4. **Garnier Fructis "Leave-In Creme Aloe Air Dry" vs. existing catalog row "Garnier Hair Food Aloe Vera" (leave_in) — checked 2026-09-02, likely NOT the same product.** On both dm.de and rossmann.de, the "Hair Food Aloe Vera" branding is currently used only for the Haarmaske (mask), Shampoo, and Spülung/Conditioner in this Fructis sub-range; the leave-in in the same Aloe Vera range is sold under a separate "Air Dry" name at both retailers (dm's own product description calls it "Fructis Hydra Aloe Air-Dry Cream"; Rossmann lists it as "Leave-In Creme Hydra Aloe Air-Dry"). No "Hair Food"-branded leave-in product turned up in a live search at either retailer. This points to Aloe Air Dry and Hair Food Aloe Vera being two distinct sub-lines rather than the same SKU under a renamed leave-in listing — but this is current-catalog evidence only, not proof about the existing DB row's history, so the EAN (3600542117593) is still kept on the new pilot candidate rather than merged into the existing row; manual reconciliation with Nick is still recommended before either merging or dropping either row.

## existing_product_new_eans

**None found this pass.** During research I noticed several existing catalog rows with empty `gtins` (e.g. `Balea Professional Brilliant Blond Hair Sealer Leave-in Serum`, `Garnier Hair Food Aloe Vera` leave_in, several `(legacy duplicate)` rows) that plausibly correspond to products seen on dm.de/rossmann.de during this research, but I did not manage to pin down a confirmed EAN for any specific one within this pass — chasing them requires visiting individual product pages I didn't get to. This is a good target for a focused follow-up pass rather than a guess now.

One specific flag: the pilot leave-in candidate **Garnier Fructis "Leave-In Creme Aloe Air Dry" (rank 24, EAN 3600542117593)** may actually be the same physical product as the existing catalog row `Garnier Hair Food Aloe Vera` (leave_in, no GTIN, no size recorded) under an older/renamed listing — I could not confirm the name mapping with confidence, so I left it as a new pilot candidate rather than reclassifying it as an existing-product EAN fill. **This needs a human/product-page check before implementation** — if it's the same product, the EAN should go against the existing row instead of creating a duplicate.

---

## Sources & method

- **Popularity signal:** dm.de and rossmann.de category/search result pages expose a per-product review count next to the star rating. I used this as the primary bestseller proxy (default sort was "Beliebtheit"/"Relevanz", which both retailers already weight toward sales+relevance). Cross-confirmation across both retailers (same formulation appearing on both, review counts roughly consistent) was treated as a strong signal.
- **dm.de:** searched `shampoo`, `spuelung`, `haarkur`, `leave-in`, `haaroel` (each returns 100+ results sorted by relevance/popularity by default); individual product pages expose an explicit `GTIN:` field, which is where all dm-sourced EANs in this ledger came from.
- **rossmann.de:** browsed the dedicated category pages for Shampoo, Conditioner, Haarkur & Haarmaske, and Haaröl (`/de/pflege-und-duft/haarpflege/...`), plus the `Being` brand page (`/de/alle-marken/being/...`) for the new-brand quota. Rossmann's product-listing cards are not plain `<a>` links reachable by accessibility-tree search, which made bulk EAN extraction much slower than on dm; most Rossmann-only EANs were not captured in the initial pass. **2026-09-02 follow-up:** visited individual Rossmann product pages directly (via site search) for the 8 outstanding Rossmann-only pilot items and 1 dm item with a truncated capture. Rossmann's rendered product pages carry no labeled "GTIN:"/"EAN:" text field (unlike dm.de), but each page's own script embeds the same number via a Syndigo product-content-sync call, `SYNDI.push('<number>')`, which always matched the number in the product URL. This was independently cross-checked against a number already confirmed via dm's own labeled `GTIN:` field (Herbal Essences Blütensanft conditioner, 8700216210508) and matched exactly, and every Rossmann-sourced number in this batch passed the GS1 mod-10 check digit — so these are recorded as confirmed EANs, not URL-pattern guesses. Full detail per item is in the JSON's `ean_sources`.
- **"neu bei Rossmann" quota:** sourced from (a) products explicitly tagged **"Neu"** in Rossmann's own listing UI (Gliss Sealing Shampoo Sealing Miracle, Monday Haircare Repair Argan Haaröl, Bali Gents Coffein Activator Shampoo), (b) the **Being** brand (ZURU-developed, 2026 hairstylist-led launch, "Nur Online" tags, low-but-positive review counts consistent with a recent rollout), and (c) **IDA WARG Beauty** (new premium Swedish brand, sponsored/low-review listings across shampoo/conditioner/mask consistent with a recent launch). Total flagged: 15 (6 in pilot, 9 in backlog), within the 10–20 target.
- **Existing catalog dedupe:** ran the supplied SQL against Supabase project `pqdkhefxsxkyeqelqegq` (products + product_identifiers, the five target categories), then matched candidate brand+name pairs against it by hand. Where a dm/rossmann listing looked like a plausible rename or re-pack of an existing catalog row but I couldn't confirm the mapping, I erred toward listing it as a new candidate and flagging the ambiguity (see the Garnier Fructis Aloe Air Dry note above) rather than silently merging or silently dropping it.
- **Web search** (dm/Rossmann bestseller-list articles) was used only for initial orientation; it returned mostly vague TikTok/lifestyle-article hits with no hard rankings, so the real selection work is based on the retailer sites themselves.

## Confidence & gaps (be honest with Nick about this)

- **Solid — popularity:** the dm.de review counts are a real, retailer-reported signal, not a guess, and cross-retailer confirmation (same formulation, review counts in the same ballpark on both sites) was found for ~12 of the pilot 30. Treat pilot items with 4-digit review counts (Elvital Hydra Hyaluronic/Glycolic Gloss line, Wahre Schätze Honig Schätze/Traube/Haarserum, Gliss Night Elixier, Herbal Essences Blütensanft) as high-confidence bestsellers.
- **Softer — private label & new-brand picks:** Isana Professional and Being/IDA WARG picks are popular *within what's visible on Rossmann's site* but I have no independent sales-rank confirmation; they satisfy the brief's explicit ask for private-label + new-arrival coverage but should be understood as "prominent on-site" rather than "proven bestseller."
- **EAN coverage — pilot: 29/30 (97%) have at least one recorded EAN** after the 2026-09-02 follow-up pass. dm-sourced EANs come directly from a `GTIN:` field on the retailer's own product page. Rossmann-sourced EANs (Gliss Sealing Miracle, Being Big Hair Shampoo/Conditioner, Being Major Moisture Leave-In, IDA WARG mask, Herbal Essences mask, Isana Professional oil, Monday Haircare oil, Elvital Dream Length 300 ml) have no labeled GTIN field on Rossmann's rendered pages — instead, each product page embeds the same number in its own Syndigo content-sync script (`SYNDI.push('<number>')`), which matches the product URL; this was spot-checked against a known dm-confirmed EAN (Herbal Essences Blütensanft conditioner) and matched exactly, and every Rossmann-derived number in this batch passed the GS1 mod-10 check digit. Treated as confirmed, distinct from a bare URL-pattern guess. The one remaining pilot item without an EAN is **L'Oréal Paris Elvital "Leave-In Haarkur Hydra Hyaluron, Aufpolsterndes Feuchtigkeitsserum"** (150 ml, Rossmann) — out of scope for this follow-up pass, still needs a product-page visit.
- **EAN coverage — backlog: effectively 0%.** Per the task's own rules this is acceptable ("EAN research can be completed later") — the backlog's job here is ranking and coverage, not identifiers. A follow-up pass should prioritize EAN capture in backlog rank order once Nick confirms which of these to actually build.
- **Category placement is sometimes a judgment call**, not a hard fact from the retailer: a few products (e.g. Garnier Fructis heat-protectant oil sprays, the Pantene "Haarkur" that is structurally an oil, L'Oréal's "Leave-In Haarkur" serum) sit between two of the five categories in the retailers' own marketing copy. I placed them where the product's primary use-case (rinse-out vs. leave-in vs. oil finish) seemed clearest, but these are worth a second look.
- **No invented EANs anywhere** — every EAN in this file was either read directly off a retailer product page (`GTIN:` field, dm.de) or read from that page's own Syndigo content-sync script (`SYNDI.push('<number>')`, rossmann.de), with its source URL and check-digit validation noted in the JSON's `ean_sources`; empty `eans: []` means "not found yet," never "doesn't exist."
- **Not independently verified:** actual bestseller *rank* (vs. review count as a proxy), current in-stock status, whether Rossmann's "Neu" tag reflects a true 2026 launch vs. a recent restock, and whether any pilot item quietly duplicates an existing catalog row under a different name (flagged one specific case above — there are likely a few more given ~585 dm shampoo SKUs alone were not all cross-checked line-by-line).
