# Bucket 1 sourcing and exact commerce maintenance — 2026-10-04

Nick approved exact preferred-shop sourcing, verified additional recognition barcodes, and preparation of distinct purchasable alternatives. Historical pause dispositions are revoked. Existing category properties, protocols, recommendation flags and old identifiers were retained. Distinct candidates below were sourced, not selected or activated.

## Applied and independently verified

- **Glow & Shine:** dm, €2.75 / 200 ml; current PDP and package/check metadata; added `4070765006483`, retained registered barcode.
- **Macadamia:** both existing conditioner/leave-in rows point to the same manufacturer-linked Amazon direct €5.95 / 400 ml single jar. This is the 3in1 jar, not the separate 350 ml conditioner bottle; no duplicate barcode inserted.
- **Gliss Aqua Revive:** direct Nutritienda German/EU fallback, €4.50 / 400 ml (previous €4.75); added regional barcode `8410436457873`. Preferred shops checked before fallback. Douglas partner offer rejected.
- **Hibiskus:** recognition-only addition `4058172926181`; original barcode and all product/commercial fields unchanged. Exact dm purchase remains unavailable.

Four commerce rows, one actual price change, three identifiers added. Rollback dry run restored all 376 products and identifiers exactly. Apply readback found no outside-scope changes; all target category/protocol rows remained identical. See `verification.json`, `before.json`, `after.json` and the exact SQL pair. The first dry run failed only an expected-JSON comparison due to SQL operator precedence; it rolled back completely. Corrected comparator passed before apply.

## Remaining concrete sourcing choices

Fourteen catalog rows (thirteen physical legacy products) have alternatives prepared; the repeated Aqua Hyaluron physical product occupies mask and leave-in rows. All eleven unique candidates are at dm, with current package/whole-pack price and exact barcode evidence. Source packets include full INCI, directions and raw front-image source URLs. Candidate evidence does not constitute scientific/intake approval, and existing product properties cannot be assigned to a distinct product automatically.

| Existing row | Prepared dm candidate | Package price | Barcode |
|---|---|---|---|
| Balea Trockenshampoo Kopfhaut Sensitive (dry_shampoo) | [Batiste Trockenshampoo Sensible Kopfhaut, leichter Duft](https://www.dm.de/p/d/3048778/batiste-trockenshampoo-sensible-kopfhaut-leichter-duft) | €3.95 / 200 ml | `5010724004777` |
| Balea Professional Ultimate Volume (shampoo) | [Balea PROFESSIONAL Shampoo Hydra Volume](https://www.dm.de/p/d/3126236/balea-professional-shampoo-hydra-volume) | €1.35 / 250 ml | `4066447990126` |
| Hair Biology Revitalize & Soothe (shampoo) | [GUHL Shampoo Kopfhaut Sensitiv, 250 ml](https://www.dm.de/p/d/1446989/guhl-shampoo-kopfhaut-sensitiv) | €3.95 / 250 ml | `4072600283172` |
| Balea Natural Beauty Hibiskus (conditioner) | [Feuchtigkeitsspendende Spuelung mit Aloe Vera & Kokosmilch](https://www.dm.de/p/d/3155215/balea-conditioner-feuchtigkeitsspendend-beauty-essentials) | €1.45 / 350 ml | `4070765053326` |
| Nivea Volumen & Kraft (conditioner) | [NIVEA Conditioner Power Repair, 200 ml](https://www.dm.de/p/d/1620990/nivea-conditioner-power-repair) | €2.95 / 200 ml | `4006000192598` |
| Alterra Intensiv Repair Haarmaske Feuchtigkeit (mask) | [Garnier Fructis Haarmaske Aloe Vera Hair Food 3in1](https://www.dm.de/p/d/1676340/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar) | €5.95 / 400 ml | `3600542511049` |
| Balea Natural Beauty 3in1 Locken (mask) | [Balea Haarmaske Intensivpflege 3in1](https://www.dm.de/p/d/1671219/balea-haarmaske-intensivpflege-3in1) | €1.95 / 300 ml | `4066447982817` |
| Balea Aqua Hyaluron 3 in 1 (mask) | [Balea Haarmaske Intensivpflege 3in1](https://www.dm.de/p/d/1671219/balea-haarmaske-intensivpflege-3in1) | €1.95 / 300 ml | `4066447982817` |
| Garnier Wahre Schätze Haarmaske Aktivkohle (mask) | [Wahre Schätze Haarkur 1-Minute Traube, 340 ml](https://www.dm.de/p/d/3115711/wahre-schaetze-haarkur-1-minute-traube) | €4.95 / 340 ml | `3600542656191` |
| Isana 3in1 Milchprotein & Mandel (mask) | [Schwarzkopf GLISS Haarmaske 4in1 Total Repair](https://www.dm.de/p/d/1431891/schwarzkopf-gliss-haarmaske-4in1-total-repair) | €5.75 / 400 ml | `4015100813517` |
| Sante Intense Hydration (mask) | [GARNIER FRUCTIS Haarmaske Aloe Vera Hair Food 3in1, trockenes Haar, 400 ml](https://www.dm.de/p/d/1676340/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar) | €5.95 / 400 ml | `3600542511049` |
| alverde NATURKOSMETIK Haarkur 4in1 Repair & Care Wunderkur (mask) | [Schwarzkopf GLISS Haarmaske 4in1 Total Repair](https://www.dm.de/p/d/1431891/schwarzkopf-gliss-haarmaske-4in1-total-repair) | €5.75 / 400 ml | `4015100813517` |
| alverde NATURKOSMETIK Haarmaske Hydro Feuchtigkeit (mask) | [L'ORÉAL PARiS ELVITAL Haarmaske Hydra Hyaluronic](https://www.dm.de/p/d/3122676/l-oreal-paris-elvital-haarmaske-hydra-hyaluronic) | €4.95 / 300 ml | `3600524245849` |
| Balea Aqua Hyaluron 3in1 (leave_in) | [Balea PROFESSIONAL Feuchtigkeitsfiller Aqua Hyaluron](https://www.dm.de/p/d/3151631/balea-professional-feuchtigkeitsfiller-aqua-hyaluron) | €2.95 / 50 ml | `4070765026894` |

**Sante exact alternative:** [Taleoo 150 ml](https://taleoo.de/sante-intense-hydration-maske-hyaluron-150ml-63237), €6.64, exact registered GTIN `4055297220682`; purchase control enabled, but “In einigen Tagen wieder lieferbar.” Nick was asked whether this restock-delay offer is acceptable. It has not been applied while that reply is pending. If accepted, this avoids selecting a distinct replacement.

## Evidence limits

- Macadamia manufacturer/Amazon and dm ingredient declarations conflict. Manufacturer-to-exact-ASIN link, primary GTIN-linked front, variant, size and directions support commerce association; these sources do not prove which ingredient declaration a delivered batch will carry. No formula or performance reclassification was applied.
- Gliss association uses distinctive existing/current printed front, current retailer GTIN and full INCI corroboration. No archived full legacy formula exists; no concentration equivalence or unchanged historical formula is asserted.
- Disabled cart, blocked transport and search misses are distinguished in source records. Search misses do not establish universal discontinuation or authorize an availability/recommendation stamp.
- Nivea repair versus volume, natural-cosmetics versus conventional masks, charcoal versus grape masks and other formula/use differences are explicit replacement tradeoffs, not silent aliases.

## Other buckets: what actually changed

The preceding correction receipt restored the sixteen recommendation flags and filled package sizes/check timestamps for got2b (200 ml) and Herbal Essences (250 ml). Their existing prices and links were already correct. The other bucket agents compared identity, ingredient declarations and possible current variants; no classifications, suitability properties, application protocols or additional identifiers from those reassessments were applied. Filled properties are not an edit target merely because a fresh assessment differs. See `../2026-10-04-correction/README.md`.

No server, worker, queue, timer, schema, deployment, push, PR or merge changes were made in this pass.

Raw browser snapshots and unhydrated HTML fetches are archived byte-for-byte in `sources/raw-browser-captures.zip`; `sources/raw-captures.json` records original members and uncompressed hashes. Structured PDP findings remain in their source JSON files.
