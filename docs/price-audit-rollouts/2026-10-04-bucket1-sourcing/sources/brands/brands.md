# Bucket 1 — five brand products

Checked 2026-10-04T08:52:05.033179+00:00. Research only; no activation or product-property changes.

| Existing product | Result | Offer / candidate |
|---|---|---|
| Gliss Aqua Revive | Same regional variant commerce candidate | Nutritienda400ml **€4.50**,GTIN8410436457873,in stock; printed HaptIQ/4-in-1/Hyaluron/normal-dry/level1 bridge. |
| Hair Biology Revitalize & Soothe | Exact offer unavailable | dm Guhl Kopfhaut Sensitiv250ml **€3.95**,GTIN4072600283172,prepared separate replacement. |
| Nivea Volumen & Kraft conditioner | Exact offer unresolved/no live purchase | dm Nivea Power Repair200ml **€2.95**,GTIN4006000192598,prepared separate replacement. |
| Garnier Aktivkohle mask | Exact dm offer unavailable | dm Wahre Schätze Traube340ml **€4.95**,GTIN3600542656191,prepared separate replacement. |
| Sante Intense Hydration mask | Exact **backorder** offer | Taleoo150ml **€6.64**,GTIN4055297220682,enabled cart but restock delay. Optional dm Aloe Hair Food400ml **€5.95** separate replacement. |

Every amount is a whole-package price; shipping is additional. Enabled controls were inspected without adding anything to baskets.

## Gliss Aqua Revive 4-in-1 Bonding Haarmaske

safe_commerce_candidate

[Chosen offer](https://www.nutritienda.com/de/gliss/gliss-aqua-revive-4-in-1-maske-400-ml): 400 ml, €4.50; checked 2026-10-04T08:47:43.291Z; in_stock.

- [removed_from_assortment](https://www.rossmann.de/de/pflege-und-duft-gliss-aqua-revive-feuchtigkeit-4-in-1-bonding-haarmaske/p/4015100813555), 2026-10-04T08:39:00Z: Browser redirects to category and explicitly says article no longer in assortment; timestamp minute precision.
- [marketplace_partner_rejected](https://www.douglas.de/de/p/m003070896), 2026-10-04T08:37:00Z: Browser works despite earlier HTTP400. Online auf Lager, enabled cart, but Versand durch Douglas Partner; marketplace-only fails intake source rule. Timestamp minute precision.
- [available_direct_fallback](https://www.nutritienda.com/de/gliss/gliss-aqua-revive-4-in-1-maske-400-ml), 2026-10-04T08:47:43.291Z: Browser works despite HTTP403 fetch; seller Nutritienda; normal public German checkout storefront.

Identity bridge: Current catalog raw front visibly HaptIQ System + Hyaluron-Komplex, Aqua Revive Feuchtigkeit, 4-in-1 Bonding Haarmaske, normal-to-dry hair, Gentle Care level 1. Nutritienda front visibly Spanish regional HaptIQ + Complejo Hialurónico, 4-in-1 Hidratación Bond-Building Hair Mask, normal/dry hair, Gentle Care level 1, same blue/gold jar and layout. Nutritienda Product JSON-LD explicitly associates gtin13 8410436457873 with named Aqua Revive 4-in-1 400 ml. Full retailer ingredient declaration available; distinctive hydroxypropylgluconamide + hydroxypropylammonium gluconate + dimethylsilanol hyaluronate list corroborated on exact-EAN PerfumesClub and German Douglas Aqua Revive mask.

Regional package association for commerce and recognition. No concentration equivalence or historical formula-unchanged assertion. No archived full catalog INCI. Evidence supports named/printed regional variant association, not a formula-change determination.

## Hair Biology Shampoo Revitalize & Soothe

reviewed_replacement_candidate

- [unavailable](https://www.dm.de/p/d/1588828/hair-biology-shampoo-revitalize-und-soothe), 2026-10-04T08:48:05.732Z: Exact GTIN,250ml; Nicht lieferbar; disabled cart; Keine Anzeige für Verfügbarkeit im dm-Markt möglich.
- [unavailable](https://www.drogeriedepot.de/haarpflege-farben/haar-shampoo/hair-biology-shampoo-revitalize-soothe-pr-067146), 2026-10-04T08:40:54Z: Browser: Nicht mehr verfügbar.

Guhl is a distinct shampoo for sensitive/dry scalp, not Hair Biology Meno Balance and not a same-formula or volume-effect equivalent. Existing product properties and recommendation status remain untouched.

No current exact orderable offer verified. Search misses do not prove universal discontinuation.

## Nivea Conditioner Volumen & Kraft

reviewed_replacement_candidate

- [no_product_result](https://www.dm.de/nivea-conditioner-volumen-und-kraft-p4005900918031.html), 2026-10-04T08:48:26.569Z: Browser: Leider konnten für Deine Anfrage keine Produkte gefunden werden. Not a bot block.

Nivea Power Repair preserves brand and rinse-out conditioner category but targets repair, not volume; different GTIN/formula. Nivea Volumen & Kraft shampoo was rejected as wrong category.

No current exact orderable offer verified; old Onfy/Volume Sensation listings not enough to establish matching product and live cart.

## Garnier Wahre Schätze Aktivkohle 1-Minute Haarmaske

reviewed_replacement_candidate

- [unavailable](https://www.dm.de/p/d/1679241/wahre-schaetze-haarkur-1-minute-aktivkohle-fettige-kopfhaut), 2026-10-04T08:48:20.899Z: Exact GTIN,340ml; Nicht lieferbar, cart disabled, market availability cannot display.

Traube keeps brand, mask category,1-minute use and340ml size. Different formula/positioning; contains Amodimethicone unlike silicone-free Aktivkohle. Do not transfer scalp/charcoal or no-silicone properties.

No exact current orderable offer verified. International Botanic Therapy Charcoal names were not assumed identical without barcode/variant bridge.

## Sante Intense Hydration 1-Minute Wonder Maske Hyaluron

exact_backorder_commerce_candidate_plus_reviewed_replacement

[Chosen offer](https://taleoo.de/sante-intense-hydration-maske-hyaluron-150ml-63237): 150 ml, €6.64; checked 2026-10-04T08:48:44.624Z; backorder_restock_delay.

- [unavailable_both_sizes](https://www.sante.de/intense-hydration-maske-1-minute-wonder-mask-hyaluron/40762), 2026-10-04T08:48:50.450Z: Primary page explicitly offers20ml and150ml variants, both Diese Option ist zurzeit nicht verfügbar. Selected20ml€1.79; do not assign that price to150ml.
- [removed_from_assortment](https://www.rossmann.de/de/pflege-und-duft-sante-intense-hydration-haarmaske/p/4025089005896), 2026-10-04T08:39:37Z: Explicit no longer assortment. Old URL barcode refers20ml sachet, not registered150ml.
- [unavailable](https://www.ecco-verde.at/sante-naturally/intense-hydration-maske), 2026-10-04T08:40:00Z: Browser: Ausverkauft, Produkt wird in unserem Shop nicht mehr angeboten; timestamp minute precision.
- [unavailable](https://www.bio-naturel.de/pl/maska-intensywnie-nawilzajaca-sante/), 2026-10-04T08:40:44Z: Browser: Niestety ten produkt nie jest dostępny. Older indexed stock claims rejected.

Aloe Hair Food is a concrete available moisture-mask alternative; different brand/formula and no certified-natural or three-protein-complex equivalence. Prefer exact Taleoo150ml if a restock-delay purchase link is acceptable.

Taleoo date is non-specific; not verified immediate dispatch. No need to substitute Sante Conditioner, which is a different product.

## Prepared replacement records

Full INCI, directions, raw front source and local image, GTIN, exact pack price, cart proof, and timestamps are in [brands.json](brands.json). These are distinct candidates for review; their formula/claims are not copied onto old product rows.

- [GUHL Shampoo Kopfhaut Sensitiv, 250 ml](https://www.dm.de/p/d/1446989/guhl-shampoo-kopfhaut-sensitiv): GTIN 4072600283172, €3.95; [raw front](guhl-front.webp); live cart enabled 2026-10-04T08:49:05.304Z.
- [NIVEA Conditioner Power Repair, 200 ml](https://www.dm.de/p/d/1620990/nivea-conditioner-power-repair): GTIN 4006000192598, €2.95; [raw front](nivea-power-repair-front.webp); live cart enabled 2026-10-04T08:43:20.492Z.
- [Wahre Schätze Haarkur 1-Minute Traube, 340 ml](https://www.dm.de/p/d/3115711/wahre-schaetze-haarkur-1-minute-traube): GTIN 3600542656191, €4.95; [raw front](garnier-traube-front.webp); live cart enabled 2026-10-04T08:43:42.851Z.
- [GARNIER FRUCTIS Haarmaske Aloe Vera Hair Food 3in1, trockenes Haar, 400 ml](https://www.dm.de/p/d/1676340/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar): GTIN 3600542511049, €5.95; [raw front](garnier-aloe-front.webp); live cart enabled 2026-10-04T08:44:10.073Z.

## Source decision and limits

Douglas is reachable and stocked but explicitly fulfilled by a Douglas Partner; reject that marketplace-only offer. Its prior HTTP400 was a transport failure, not evidence of absence. Nutritienda is reachable in Chrome despite HTTP403 fetch and identifies itself as the seller. Preferred-shop name/GTIN searches are recorded in JSON; empty indexed searches never become unavailable claims.

Sante brand confirms both20ml and150ml as unavailable. Taleoo exact150ml remains orderable with a restock delay. The optional Aloe candidate gives up Sante brand/certified-natural/protein positioning. Nivea Power Repair gives up the volume positioning; Garnier Traube contains amodimethicone whereas Aktivkohle is silicone-free. Guhl is not the Hair Biology Meno Balance line.

No concentration/formula-unchanged assertion, scientific reassessment, catalog merge, recommendation status change, publishing, queue work or production writes performed. Browser temporarily downloaded raw Gliss front to /Users/nick/Downloads/public.avif before copying into this evidence directory.
