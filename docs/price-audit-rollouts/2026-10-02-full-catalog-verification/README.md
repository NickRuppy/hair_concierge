# Full active-catalog offer verification — 3 October 2026

347 active catalog rows were investigated, including 238 recommended rows. The 24 inactive rows are outside this pass. Duplicate category rows count separately; this is not 347 unique physical products.

## Result

| Outcome | Catalog rows |
|---|---:|
| Complete exact selected offers ready for full-manifest review | 292 |
| Verified offers requiring price/retailer alignment | 18 |
| Held: barcode/formula continuity | 17 |
| Held: unavailable at verified sources | 13 |
| Held: base-package decision | 4 |
| Held: no qualifying exact price/offer verified | 2 |
| Held: supplier-stock/preorder decision | 1 |
| Total | 347 |

Every ready offer's final selected price/package/stock check is dated **3 October 2026**. Earlier identity research and some held/exception candidates are dated 2 October; per-row timestamps distinguish them. This is a research and review receipt, not a claim of permanently fixed price or stock.

The 292-row proposal contains **71 changed prices**, **221 unchanged prices**, **131 replacement links**, and **193 package fills**. Existing non-null base packages are preserved. All ready rows would receive their actual observed price-check timestamp if later approved. No catalog, identifier, deployment, intake-worker, SSH, or timer mutation was made by this full verification pass.

## Review artifacts

- [Complete 347-row review (CSV)](catalog-verification-review.csv) and [JSON](catalog-verification-review.json): baseline, proposed offer, package, barcode evidence, source, status and reasons.
- [292-row ready offer manifest](ready-offer-manifest.json): exact guarded before-values, proposed fields and evidence. This is a read-only proposal, **not an executed transaction dry run**.
- [71 ready price changes](ready-price-changes.csv).
- [55 excluded rows and recommended actions](decisions.md), with [structured decisions](decisions.json).
- [Read-only baseline guard receipt](baseline-guard-check.json) and [full live readback](catalog-readback-final.json).
- [Evidence validation](validation-receipt.json).

## Retailer and identity policy

The owning retailer policy is [product-intake research ops](../../product-intake-research-ops.md), Preferred retailer order. For shampoo/conditioner/mask/dry/deep research: dm, Rossmann, Müller, manufacturer, Amazon DE. Leave-in research prefers dm, manufacturer, Rossmann, Amazon DE. Oils prefer manufacturer, Amazon DE, dm, Rossmann. Reputable German/EU specialists are allowed; professional/high-end products may use brand/specialist sources. Preferred-source checks and unsuccessful recovery attempts remain in the original category evidence.

One base offer is one exact product/variant, one package, one whole-package EUR price and one direct purchase URL. Public unconditional sale prices count; coupons, subscriptions, bulk-unit prices, shipping thresholds, reference prices and UVP do not. No unit-price normalization was used to replace the package price. Availability must support an online purchase; store-only, preload controls, hidden templates and cached search results are insufficient.

Existing recognition aliases do not establish which package an offer represents. The 17 barcode/formula holds retain all existing identifiers; no automatic barcode replacement/addition is proposed. Similar name/size alone does not bridge an observed formula conflict.

## Material corrections from the final source checks

- K18 selected 50 ml mask: €56.25 at Flaconi; €75 is UVP, optional coupon excluded.
- Moroccanoil All In One selected 50 ml Mini: €12.80 at Douglas; €16 is UVP and €16.99 is a reference price.
- Eucerin exact 100 ml: €16.95 at dm-med, registered GTIN 4005800036620 and PZN 09508065. The former €18.39 Shop Apotheke candidate is superseded.
- NEQI Diamond Glass **Ultimate** exact 180 ml: €12.95 at dm, registered GTIN 4063528094575. Hagel €9.95 is GTIN 4063528078469, a different Diamond Glass variant, and is excluded.
- Curlsmith Weightless selected **237 ml** is €21; generic JSON-LD €11 describes the 59 ml mini and is excluded.
- Müller Garnier Sanfte Hafermilch 300 ml: visible selected offer €1.95 supersedes stale JSON-LD €2.79.
- Syoss Intense Keratin 400 ml recovered at Rossmann €4.99; Pantene Grow Abundant conditioner 250 ml recovered at Rossmann €7.99. Exact registered GTINs retained.
- Herbal Essences Blütensanft: Rossmann 300 ml €4.99 is unavailable. Office Partner exact single bottle €5.58 is a held retailer exception; its bulk €4.99 is excluded.
- Epres starter kit is €48, spray bottle plus two 15 ml concentrates. €29 was a shipping threshold. Kit storage/display remains a separate package decision.

## Database and apply boundary

The **2026-10-03 10:32:25 UTC** live SQL readback matched all 347 baseline IDs and guarded commercial fields with **zero drift**, after numeric/timestamp normalization. EAN, GTIN and barcode identifiers are included; PZN is not treated as a GTIN. The full identifiers are preserved in the readback and every ready manifest before-state. This does not verify ingredients, triggers, or an UPDATE path and does not authorize a write.

The handover's explicit human review gate applies to the new full-catalog manifest: [rollout handover](/Users/nick/AI_work/hair_conscierge/.claude/worktrees/vigilant-chandrasekhar-fffb22/plans/price-audit-rollout-handover.md). Its GPT guard is price_eur + price_checked_at only; link replacements remain review-only. No approval of a prior run is carried over to unseen offers in this new manifest. URL/package changes in this report require a separately reviewed catalog-correction apply, not the GPT audit's automatic writer.

Before an approved apply: refresh the database guard and selected-source offers, reject changed guarded rows, material price/package/identity changes or lost stock, and show the concrete final correction result. The proposal only contains price_eur, price_checked_at, affiliate_link and missing net-content fields. It contains no purchase_link_status/stamp, category, formula, recommendation, lifecycle, activation or identifier change.

## Evidence precedence and limitations

Original category files are discovery/audit history. Latest `integrated-offer-evidence.json` overrides them, and `catalog-verification-review.json` is the canonical current classification. The `*-final-*` source refresh files and selected-variant proof resolve misleading cached/mini/reference/stock observations. An unavailable result means unavailable at the checked source, not proven unavailable worldwide.

`dm-final-price-refresh.json` was an unsuccessful GTIN-query refresh attempt; it is superseded by exact selected DAN/GTIN matches in `dm-final-name-refresh.json`, `dm-final-short-name-refresh.json` and `dm-final-matched-refresh.json`. `pre-apply-catalog-readback.json` used incomplete gtin-only filtering and is superseded by `catalog-readback-final.json`; do not use it as an apply guard. Failed GET/browser refreshes are retained as failed attempts and are not current-price evidence.

All sources are public commercial product evidence. Product properties, INCI/classification and barcode transition continuity were not rewritten. Some catalog rows still require real research or a package/retailer decision before coverage can be completed.

## Ready selected sources

| Source | Ready catalog rows |
|---|---:|
| www.dm.de | 183 |
| www.rossmann.de | 48 |
| www.hagel-shop.de | 21 |
| www.mueller.de | 15 |
| www.number-one.de | 3 |
| neqi-hair.com | 2 |
| olaplex.de | 2 |
| www.beautykaufen.de | 2 |
| urban-alchemy.com | 2 |
| www.flaconi.de | 1 |
| theordinary.com | 1 |
| www.ohfeliz.de | 1 |
| www.jeanlen.de | 1 |
| www.cocooncenter.de | 1 |
| eu.curlsmith.com | 1 |
| www.look-beautiful.de | 1 |
| www.cosmeterie.de | 1 |
| mapeja.de | 1 |
| www.douglas.de | 1 |
| www.bellaffair.de | 1 |
| ellashaarshop.de | 1 |
| www.korodrogerie.de | 1 |
| de.nuxe.com | 1 |

## Active catalog category coverage

| Category | Investigated rows |
|---|---:|
| conditioner | 73 |
| shampoo | 68 |
| leave_in | 65 |
| mask | 55 |
| oil | 53 |
| dry_shampoo | 10 |
| scalp_care | 8 |
| heat_protectant | 7 |
| deep_cleansing_shampoo | 5 |
| bondbuilder | 3 |
