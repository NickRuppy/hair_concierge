# Olive-oil replacement draft

**Current resolution:** the existing dmBio product now has the confirmed **EUR 6.95 price for its 750 ml bottle**, a fresh price stamp and the current dm link. Nick approved this after the link-only change; Moroccanoil was similarly corrected to EUR 16.00 for its 50 ml mini. Product properties and scanner aliases were preserved. See the [updated correction receipt](2026-10-01-link-and-size-checks.md). Earlier snapshots below describe the intermediate state, not the current price.

**2026-10-01 resolution:** Nick requested changing only the underlying dm link. Live `product_identifiers` inspection confirms this existing row already has GTIN 4066447918687, matching the current PDP; the legacy link also redirects to that exact PDP. The link-only correction was applied and verified. The current package is therefore reconciled to the existing catalog identity for this link change; no replacement row or property rewrite is needed. All other product fields except the automatic `updated_at` audit timestamp were preserved, including the stale EUR 3.75 price. This supersedes the unresolved-identity disposition below. See [correction receipt](2026-10-01-link-and-size-checks.md).

Nick's final display preference is **dm-listed, extra virgin, with the price for the actual package size**. Unit prices were used during comparison only; catalog price_eur remains the whole-package price. No cheaper qualifying plain olive-oil bottle was found in the reviewed current dm assortment. The prepared current option is **dmBio Natives Olivenöl extra, 750 ml, EUR 6.95 per bottle**. Prepare its exact identity for reconciliation rather than introducing the ALDI candidate or claiming a price saving.

## Verified dm options

Sources checked on 2026-10-01: [dm oil category](https://www.dm.de/ernaehrung/sosse-gewuerze/oel-und-essig) and direct product pages.

| Option | Package size | Package price | Assessment |
|---|---:|---:|---|
| [dmBio Natives Olivenöl extra](https://www.dm.de/p/d/1459848/dmbio-natives-olivenoel-extra) | 750 ml | 6.95 | Selected current dm identity; online deliverable |
| [dmBio natives Olivenöl, unfiltered](https://www.dm.de/p/d/1512947/dmbio-natives-olivenoel) | 500 ml | 7.45 | Extra virgin confirmed in product details; higher package price |
| dmBio Griechisches Olivenöl | 500 ml | 6.95 | Same package price for a smaller bottle; not selected |
| [LaSelva extra virgin, ausgewogen](https://www.dm.de/p/d/1711479/laselva-natives-olivenoel-extra-ausgewogen) | 500 ml | 9.95 | Higher package price |

The current dmBio 750 ml PDP confirms article 1459848, GTIN **4066447918687**, 100% organic extra-virgin olive oil, mechanical extraction and online delivery. Price excludes shipping. This is a current identity proposal, not a cheaper replacement. The earlier BELLASAN proposal is excluded by Nick's dm preference. Taris Riviera is excluded by retailer and refined/native processing. Flavoured olive oils are not plain-oil substitutes.

## Existing catalog identity

A live search across active and inactive products returned one olive-oil row on 2026-10-01: id 9bfe0a67-72ad-4951-bb99-9f2f5d5c724a, name dmBio natives Olivenöl extra, brand dmBio, stored EUR 3.75, active, link https://www.dm.de/dmbio-natives-olivenoel-extra-p4066447423761.html. No second olive-named product or link containing the current GTIN was found. This name/link search is not an exhaustive identifier-table duplicate check.

The stored link encodes **4066447423761**, different from the current PDP. Packaging continuity and identity must be reconciled before changing its identifier or link, or deciding to create a replacement row. The current EUR 6.95 is about 85% above the stored EUR 3.75; it cannot be presented as a saving or written automatically across an unresolved identity difference. No catalog fields changed during this preparation.

## Prepared package and disposition

Product Intake owns later publication: [canonical contract](../product-intake-research-ops.md). The local draft is `ops/product-intake-research/2026-10-01/olive-oil-replacement-draft/candidate-draft.json` in this worktree (gitignored; no user submission fabricated).

Catalog intake ready: **false**. Global recommendation ready: **false**. Remaining work before any catalog change: reconcile legacy/current GTIN and exact product continuity, check identifier-level duplicates, finalize and review the current image, review oil authority/eligibility and exact application protocol, then validate the final payload and obtain the applicable final handoff. The dm comparison and current-identity draft are complete; no cheaper match was found and no product, recommendation or intake-worker state changed.
