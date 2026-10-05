# Same-product maintenance — 2026-10-05

**Ruling (Nick, 2026-10-05):** a product that is still sold on the same dm article page (same DAN/name/size) under a new barcode or with a reshuffled ingredient list is treated as the same product. Update link/size, add the current barcode next to the old one, keep all properties and recommendation flags.

All five dm PDPs re-read on 2026-10-05 (price, size, GTIN, add-to-cart enabled) before applying.

| Row | Change | Price |
|---|---|---|
| Balea Professional Oil Repair Intensiv Spülung `e7cde77e` | link → dm DAN 1703916, size 200 ml, + `4070765001402` | €1.25 unchanged |
| Langhaarmädchen Beautiful Curls `1623a993` | link → dm DAN 1678985, size 300 ml, + `4070765004649` | €4.95 unchanged |
| Langhaarmädchen Lovely Long `e76e0ed4` | link → dm DAN 1559584, size 300 ml, + `4066447864694` | €4.95 unchanged |
| Herbal Essences Aloe Vera Conditioner `4e9428b9` | + `8700216210546` (commerce already current) | €3.95 unchanged |
| got2b Schutzengel `efaff579` | + `4015100894141` (commerce already current) | €4.95 unchanged |

`apply.sql` is the exact guarded block (`:DRY` = true for the dry run, which raised `DRY_RUN_OK` and rolled back; then applied with false). Expected-before guards: old link, price, empty size; every new barcode checked unowned catalog-wide. Readback confirmed old barcodes retained, `is_active`/`is_chaarlie_recommended` unchanged. No properties, protocols or suitability touched.

## Discontinued products — recommendation flag off (2026-10-05)

**Rulings (Nick, 2026-10-05):** discontinued + recommended substitute already in catalog → stop recommending (row stays active for scanner/owned-product recognition). Discontinued without substitute → look for a likely new version first; if none, leave it out.

Discontinuation verified 2026-10-05 on the dm PDP main status ("Nicht lieferbar / Keine Anzeige für die Verfügbarkeit im dm-Markt möglich" = delisted pattern; contrast "Momentan nicht lieferbar / Verfügbarkeit in einem dm-Markt prüfen" = temporary/store) plus dm.at, brand range and Rossmann/Müller/Amazon checks.

| Row | Evidence | Substitute / new version |
|---|---|---|
| Hair Biology Revitalize & Soothe `a06cfc4d` | dm delisted pattern; no DE retailer; UK-only line | existing: Guhl Kopfhaut Sensitive |
| Nivea Volumen & Kraft `26985fdd` | dm old URL → "Entschuldigung" page; not in nivea.de conditioner range | existing: Nivea Power Repair (no volume conditioner exists) |
| Balea Natural Beauty 3in1 Locken `f212a8ff` | dm + dm.at delisted pattern | existing: Balea 3 in 1 Intensivmaske; no new curl mask |
| Balea Aqua Hyaluron 3 in 1 (Maske) `55727898` | dm delisted; dm.at clearance | existing: Balea 3 in 1 Intensivmaske; Aqua Hyaluron line has no mask now |
| Balea Aqua Hyaluron 3in1 (Leave-in) `c6e80f39` | same physical product as above | none (Feuchtigkeitsfiller is a different new product) |
| Isana 3in1 Milchprotein & Mandel `47795618` | Rossmann GTIN → notAvailable; no milk/almond 3in1 in range | none |

Single guarded UPDATE (expected exactly 6 rows recommended+active); only `is_chaarlie_recommended` changed. Also added the dm-PDP barcode `4066447704709` to the Locken row, which previously had no identifier (ownership checked).

## Second round of rulings (Nick, 2026-10-05)

- **Sante Intense Hydration `869abd97`:** link → Amazon.de `B0CWS1T32Z` (sold + shipped by Amazon, in stock), €6.99 unchanged, size 150 ml. Old Rossmann link (`/p/4025089005896`, the 20 ml sachet GTIN) redirects to `notAvailable.error`. dm and Müller don't list the mask; brand shop sold out ("In Kürze wieder verfügbar"); Violey €6.29 (GTIN shown) was the cheaper fallback, ranked below Amazon. Product renamed by brand to "1 Minute Wonder Mask", same GTIN.
- **Garnier Wahre Schätze Aktivkohle mask `17c50884`:** no longer recommended. dm delisted pattern, Rossmann notAvailable, no relaunch; only Amazon leftover stock at €10 (old "Botanic Therapy" naming).
- **Alterra Intensiv Repair Feuchtigkeit `1568b623`:** unchanged on purpose. Rossmann "Nur in der Filiale verfügbar"; store-only is not a reason to switch it off.
- **Balea Professional Ultimate Volume `d01de47e`:** gone (dm delisted, dm.at removed). Nick approved adding **Balea Professional Hydra Volume** (dm DAN 3126236, `4066447990126`, €1.35 / 250 ml) through ordinary product intake with its own assessment. The old row stays recommended until Hydra Volume is ready, then switch it off. **Not started yet.**

Unchanged by design: Balea Trockenshampoo Kopfhaut Sensitive (dm "Momentan nicht lieferbar", store check possible, dm.at delivers), alverde Hydro (store-only DE, already not recommended), alverde 4in1 Wunderkur (gone, already not recommended), alverde Glanz, Balea 2-Phasen Hitzeschutz, Schaebens Argan, Innersense.

**Innersense `7f5207e6` (fixed 2026-10-05, Nick):** the weekly job's €29.99 was the Douglas *UVP* (crossed out); the page sells the **25 ml mini for €25.49** (Douglas partner, in stock). Row corrected to €25.49 / 25 ml, link unchanged. The 118 ml formula conflict (bucket 4) is still open. Root cause in the LLM fallback prompt (asks for "regular price", no stored size) was filed as a separate task.
