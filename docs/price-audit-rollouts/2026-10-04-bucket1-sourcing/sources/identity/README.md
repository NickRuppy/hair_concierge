# Bucket 1 identity and purchase-offer resolution

Research completed 2026-10-04, using fresh Chrome product pages. Four existing catalog rows across three physical products are covered. Full prior/current ingredient declarations, source URLs, timestamps, directions, offer fields, and differences are in `identity-offers.json`; captured DOM evidence is alongside it. No repository, database, server, cart, queue, or activation writes occurred.

| Physical product / existing rows | Chosen direction | Current whole-pack offer |
|---|---|---|
| Balea Glow & Shine — mask `1f3920fe-c91e-4298-a40e-99dccd13ea30` | Add recognition GTIN **4070765006483**, retaining **4067796166453**. Same dm article **3050111**, exact 200 ml Laminier-Kur, same five-minute rinse-out directions; complete ordered INCI differs only by current **Limonene** declaration. | [dm](https://www.dm.de/p/d/3050111/balea-professional-haarkur-glow-und-shine-laminier-kur), **200 ml / €2.75**, “Lieferbar”, standard shipping 2–3 working days, enabled add-to-cart. |
| Garnier Macadamia Hair Food — conditioner `4c3e1a63-4696-406a-be67-f2aacc678b0c` and leave-in `a72d630d-547a-465f-9846-3006b38af0a2` | Use the same exact **400 ml 3-in-1 jar** for both existing roles. Retain registered **3600542511612** on its existing leave-in owner; **no new identifier** and no duplicate insert on conditioner. | [Amazon DE, ASIN B0BH7ZW2T4](https://www.amazon.de/dp/B0BH7ZW2T4), **400 ml / €5.95**, single unit, one-time purchase, **sold and shipped by Amazon**, “In stock”, enabled add-to-basket. |
| Balea Natural Beauty Hibiskus — conditioner `007a0b35-2372-4836-9aa5-fd089cd588d4` | Add recognition GTIN **4058172926181**, retaining **4066447238952**. Full ordered INCI matches; same dm article **1625969**, variant, front identity and 350 ml package. This resolves recognition identity only. | [dm](https://www.dm.de/p/d/1625969/balea-conditioner-natural-beauty-bio-hibiskus-extrakt-und-cocosmilch), 350 ml / displayed €1.45, **Nicht lieferbar**, disabled add-to-cart. **Do not present this as an orderable offer or update it as newly available.** |

## Exact freshness and evidence

The authoritative observation timestamps are the per-record `checked_at` values in `identity-offers.json`, copied from the actual browser captures rather than the report creation time:

- `glow-live-state.txt`: fresh price, package, current GTIN and enabled purchase control; `glow-live.json` and `glow-registered-live.json`: full current German and registered Polish official declarations.
- `macadamia-brand-linked-amazon.json` and `.txt`: fresh exact seller, ASIN, one-time price, package and purchase control after following the brand widget.
- `hibiskus-live.json` and `hibiskus-live-state.txt`: fresh unavailable German offer; `hibiskus-registered-live.json`: registered GTIN on official dm Poland with complete matching declaration.
- `ingredient-comparisons.json`: machine-checked full ordered Hibiskus equality and Glow equality after removing only Limonene. Matching declarations do not establish concentration equality or historic manufacturing chronology.

## Why the Macadamia offer can be selected

The [official Garnier page](https://www.garnier.de/haarpflege/haarpflege-marken/fructis/hair-food/3in1-maske-fuer-trockenes-haar-angereichert-mit-macadamia) expressly describes the 400 ml 3-in-1 mask and its conditioner, mask and leave-in uses. Its current front-image URL includes registered GTIN **3600542511612**. The actual **Jetzt kaufen → Deutschland → Amazon.de** widget resolves to **B0BH7ZW2T4**, with direct Amazon seller ID **A3JWKAKR8XB7XF**. The resolved URL, widget source link and timestamps are saved in `macadamia-brand-shoplink.json` and `macadamia-brand-linked-amazon.json`.

The manufacturer and Amazon publish the same formula identifier **F.I.L. Z70014475/2** and full declaration; Amazon's English rendering introduces obvious transcription/translation errors. The dm GTIN-linked front image and Amazon front image visibly show the same brown **Macadamia Hair Food + Vitamine C,E, 3in1** jar. This is stronger than the former Douglas same-name candidate: it is a direct primary manufacturer-to-specific-offer association, supplemented by package identity. The 350 ml rinse-out-only conditioner is excluded.

A source discrepancy remains: dm's full declaration includes shea butter, glyceryl fatty esters, ascorbyl glucoside and tocopherol, while the brand/Amazon declaration includes glycerin, almond oil and guar. This exceeds fragrance/order differences. Neither declaration is silently discarded or treated as chemically equivalent. The selected offer is the exact manufacturer-linked marketed product; this research does **not** settle the ingredients of a particular delivered batch or authorize formula, category, protocol or recommendation changes. A physical rear-label photo would settle batch-level declaration certainty if that becomes required. The old Douglas mapping is not used.

Shop order was checked: dm's exact Macadamia is unorderable; Rossmann and Müller exact name/GTIN searches produced no exact current PDP (search misses are not universal absence proof); brand has a retailer widget instead of its own checkout; Amazon then supplies the direct verified offer. Lower-ranked Douglas/parfumdreams are unnecessary.

## Concrete Hibiskus replacement option

If Nick chooses a distinct preferred-shop replacement, [Balea Beauty Essentials Feuchtigkeitsspendende Spülung mit Aloe Vera & Kokosmilch](https://www.dm.de/p/d/3155215/balea-conditioner-feuchtigkeitsspendend-beauty-essentials) is live at dm: **350 ml / €1.45**, GTIN **4070765053326**, article **3155215**, enabled add-to-cart and standard shipping 2–3 working days. `hibiskus-replacement-live.json` contains complete INCI, directions, timestamp and front image; `hibiskus-replacement-live-front.img` was visually inspected.

It is a distinct product: Aloe Vera replaces the named Hibiskus variant, and the declaration changes substantively (including isopropyl palmitate/stearyl alcohol versus the former glyceryl stearate/coco-caprylate/rice protein). It is **not** another barcode for Hibiskus and not a proven successor. Selecting it needs the root's distinct-product maintenance decision; do not copy the former product's facts or repurpose its identifier ownership. No current recommendation status is changed by this sourcing result.

## Verification and limits

JSON parses successfully, all four requested IDs occur once, both selected commerce packages have fresh enabled purchase controls, and the two barcode proposals pass the official-source declaration comparisons. Old/current product fronts and the Macadamia dm/Amazon fronts were inspected visually. All raw declaration evidence is retained, including contrary evidence. Initial direct HTTP dm responses were JavaScript/security shells and Douglas returned 403; they were not promoted to product evidence. Fresh Chrome evidence supplies the offer decisions. No automated test suite is relevant to this read-only research.
