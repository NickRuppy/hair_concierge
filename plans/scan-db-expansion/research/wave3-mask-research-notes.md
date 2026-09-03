# Wave 3 — Mask research notes

Research lane: `category_key="mask"` items from `A_backlog_remainder` and `B_topup_new` in
`plans/scan-db-expansion/wave3-selection.json`. Manifest:
`plans/scan-db-expansion/research/wave3-mask-manifest.json`. Validated **PASS** (10/10 products,
`npm run products:intake:expansion:validate`), 2026-09-03.

## Counts

- **Selected for research:** 11 mask items (6 from A_backlog_remainder, 5 from B_topup_new).
- **Researched → complete (in manifest):** 10.
- **Excluded (dedupe, not a new product):** 1 — HASK Argan Conditioning Treatment Haarkur.
- **Recategorized:** 0 (all 10 are genuine rinse-out masks; no leave-in/spray mislabels found this
  wave, unlike the 2 wave-2 cases the brief flagged as a watch-item).
- **Deviation-flagged:** 1 — Bali Curls Deep Repair Mask (`conditioner_after` instead of the
  default `replaces_conditioner`; see below).
- **Parked for Nick (not stampable / needs a decision):** 0 hard blockers, but see "Open questions"
  — one naming call (Bali Curls) and one thickness-eligibility judgment call (Being Mega Shine) are
  flagged as lower-confidence rather than parked outright, since both are schema-valid either way.

## HASK dedupe verdict: SAME product — excluded from `products`

**Verdict: the wave-3 backlog item "HASK Argan Conditioning Treatment Haarkur" (Rossmann, 50 ml,
GTIN 0071164333068) is the SAME physical product as the catalog's existing "Hask Argan Oil
Repairing Deep Conditioner" (mask, `is_chaarlie_recommended: true`, product_id
`7c057f58-3e9b-4347-b4c1-f04cc4213f94`).** It has been **excluded from `products`** in the manifest
per the task brief; `existing_product_updates` was intentionally left empty (per the brief: "write
the finding + evidence ... for the orchestrator to apply as `existing_product_updates`" — not
applied here directly).

Evidence:

1. **Identical GTIN already on file for the existing product.** A prior research pass
   (`data/scanner-catalog-coverage/2026-08-26/existing-catalog-gtin-research-update-2026-08-31.json`)
   already resolved this exact product/EAN pair:
   ```json
   {"product_id": "7c057f58-3e9b-4347-b4c1-f04cc4213f94", "product": "HASK Argan Oil Repairing Deep Conditioner",
    "variants": [{"gtin": "071164333068", "package": "50 ml sachet", "disposition": "candidate_for_existing_product"}],
    "sources": ["https://www.beautyplaza.com/de-de/p/argan-oil-repairing-deep-conditioner/10734/"]}
   ```
   `071164333068` normalizes to the 13-digit GTIN `0071164333068` — the **exact same number**
   the wave-3 selection's Rossmann source URL uses:
   `https://www.rossmann.de/de/pflege-und-duft-hask-argan-conditioning-treatment-haarkur/p/0071164333068`.
   Also referenced (name only, same product) in
   `plans/2026-08-28-remaining-barcode-resolution-rules.md:32/42` as "Hask Argan Oil Deep
   Conditioner sachet ... GTIN 0071164333068".
2. **Same format/size**: both are the 50 ml single-use sachet deep conditioner — matches the
   wave-3 selection's own size note ("50 ml, Rossmann") and the existing analysis's "50 ml sachet"
   package note.
3. This disposition was `candidate_for_existing_product` (i.e., researched but not yet confirmed
   applied) as of 2026-08-31 — I could not query the live Supabase catalog in this session
   (Supabase MCP requires interactive OAuth, unavailable here) to confirm whether the GTIN is
   already attached to the live row. **Orchestrator action needed:** verify via
   `mcp__supabase__execute_sql` (or the catalog UI) whether product `7c057f58-3e9b-4347-b4c1-f04cc4213f94`
   already carries GTIN `0071164333068`; if not, apply it as an `existing_product_updates` entry:
   ```json
   {
     "product_id": "7c057f58-3e9b-4347-b4c1-f04cc4213f94",
     "add_identifiers": [{
       "type": "ean", "value": "0071164333068", "cross_source_agreement": true,
       "source_urls": [
         "https://www.rossmann.de/de/pflege-und-duft-hask-argan-conditioning-treatment-haarkur/p/0071164333068",
         "https://www.beautyplaza.com/de-de/p/argan-oil-repairing-deep-conditioner/10734/"
       ],
       "excluded_from_apply": false
     }]
   }
   ```
4. **Current shelf name for a possible rename**: Rossmann's live listing (source in wave-3
   selection) shows it under **"HASK Argan Conditioning Treatment Haarkur"** — differs from the
   catalog's current name "Hask Argan Oil Repairing Deep Conditioner". Whether that's a genuine
   Rossmann-side rename (→ candidate `rename` entry, W6) or just a different retailer's shelf label
   for the same international product (the item ships in English on the sachet — "Argan Oil
   Repairing Deep Conditioner" is the printed product name; Rossmann's own listing title may be a
   category-driven relabel, not a formulation rename) needs a quick look at the current
   `product.name` on the live row before deciding. Flagged for Nick/orchestrator, not decided here.
   Rossmann's listing also states **"Nur in der Filiale verfügbar"** (in-store only online) at
   research time — does not affect the dedupe verdict, just availability.

## Recategorizations (R-A)

None. All 10 researched items are genuine `post_shampoo_rinse_out_mask` formulas — tub/jar rinse-out
treatments with a stated (or W3-fallback) contact time and a rinse step. No sachet/1-minute-format
items turned out to be leave-in sprays this wave (the brief's watch-item from wave 2 did not
recur).

## Contact times: found vs. W3 fallback

All 10 products carry a **sourced** contact time from their own retailer page — **no W3 fallback
was needed this wave**. Breakdown:

| Product | Contact time (sourced) | Form |
| --- | --- | --- |
| Isana Professional Plex Maske | 5–10 Min. | range |
| Isana Professional Haarmaske Locken Traum | 3–5 Min. | range |
| Bali Curls Deep Repair Mask | 2–3 Min. (extendable) | range |
| Balea Haarkur Feuchtigkeit | 3–5 Min. | range |
| Being Mega Moisture Haarmaske | 10 Min. | **exact** (seconds=600) |
| Being Mega Shine Haarmaske | 10 Min. | **exact** (seconds=600) |
| alverde Haarmaske Hydro Feuchtigkeit | 5–10 Min. | range |
| alverde Haarkur 4in1 Repair & Care Wunderkur | 5–10 Min. | range |
| MONDAY Deep Moisture Haarmaske | 10 Min. | **exact** (seconds=600) |
| OGX Coconut Miracle Oil Haarmaske | 3–5 Min. | range |

Note on the Bali Curls product specifically: Rossmann's own page has **no** "Anwendung und
Gebrauch" section at all (verified — only Produktdetails + Inhaltsstoffe accordions exist on that
page); the contact time was sourced from **dm.de's** listing of the same GTIN instead (see deviation
note below), not from a W3 fallback.

## Deviation: Bali Curls Deep Repair Mask — `conditioner_after`, not the P5 default

dm.de's Verwendungshinweise for GTIN 4262391990001 explicitly sequences a conditioner **after**
the mask:

> "Trage die Haarmaske in die Längen und Spitzen des gewaschenen, handtuchtrockenen Haare auf und
> lasse sie 2-3 Minuten einwirken. Spüle sie dann im Anschluss gründlich aus. Für eine noch tiefe
> Pflege kannst du sie auch etwas länger einwirken lassen. **Fahre nun mit einem Conditioner, wie
> unserem MOISTURISING CONDITIONER fort um die Schuppenschicht deines Haares zu schließen und zu
> versiegeln.**"

Per protocol-templates.md's TPL-MASK "typical deviations" list, this is exactly the documented
exception ("`conditioner_after` — only when the source explicitly sequences a conditioner after the
mask"). Recorded as a `deviation` object on the product's TPL-MASK protocol row in the manifest;
the manifest schema doesn't have a `conditionerRelationship` field to flip directly (that lives in
the V1 payload the research engine stamps downstream), so this is flagged for the engine/Nick to
apply `conditioner_after` instead of `replaces_conditioner` when stamping this product's protocol
payload.

## W6 naming call: Bali Curls "Deep Repair Mask" vs. Rossmann's "Deep Hydration Mask"

Rossmann's live listing (the wave-3 selection's sourced retailer) still shows this product as
**"Deep Hydration Mask"**. Every other current source I found for the identical GTIN
(4262391990001) — dm.de ("Haarmaske Deep Repair"), the manufacturer's own site bali-care.com
("Deep Repair Mask"), and multiple other EU retailers (Superdrug, Lockenbox, CurlyTools, Bellapil,
oh feliz) — calls it **"Deep Repair Mask"**. Only Rossmann.de (and its Danish sibling rossmann.dk)
still shows "Deep Hydration". I judged Rossmann's name to be the stale one and used **"Deep Repair
Mask"** as `product.name` in the manifest, documenting the discrepancy in `field_rationales`. This
reverses the usual "backlog retailer's name wins" default (unlike the wave-2 Pantene case, where
Rossmann had the *newer* name and dm was stale) — **flagged for Nick to confirm**, since it's a
judgment call between "trust the sourced retailer" and "trust the majority + manufacturer".

## Low-confidence field: Being Mega Shine — thickness_eligibility includes `fine`

Being Mega Shine Haarmaske has essentially the same oil+polymer-rich INCI as its sibling Mega
Moisture (which I scoped to `normal, coarse` only, per the usual buildup-risk precedent for rich
silicone/oil/polymer formulas). But Mega Shine's own Rossmann copy explicitly states **"ist für
alle Haartypen geeignet"** ("suitable for all hair types") — an explicit source claim Mega Moisture
does not carry (Mega Moisture is scoped to curl types 3A–4C instead). I weighted the explicit
source claim over the formula-based buildup-risk inference and included `fine`. This is a real
tension worth Nick's eyes: the more conservative, formula-consistent call would exclude `fine` here
too, matching Mega Moisture.

## Cross-source EAN evidence (R-B / W5)

- **Retailer-exclusive, single source sufficient (W5):** Isana Professional (×2), Balea, alverde
  (×2) — all Rossmann- or dm-exclusive private label. Single Rossmann/dm source used per product.
- **Cross-sourced (2 independent sources, per the brief's rule for Being/MONDAY/Bali
  Curls/OGX):**
  - Bali Curls: Rossmann + dm.de (identical GTIN in dm's URL path).
  - Being Mega Moisture / Mega Shine: Rossmann + hagel-shop.de (EAN field on hagel-shop's product
    data table matches exactly).
  - MONDAY Deep Moisture: Rossmann + idealo.de (idealo aggregates 5 independent shop offers under
    the same GTIN, confirmed via the GTIN appearing in idealo's page data).
  - OGX Coconut Miracle Oil: Rossmann + dm.de (identical GTIN in dm's URL path).
- All 10 GTINs pass the GS1 mod-10 check digit (verified independently in Python before writing the
  manifest, matching what the schema's own `validateEanInput` check would do).

## Images

All 10 candidate images are packshots (tub/jar/tube only, no cartons), ≥800px on the long edge:
- Rossmann-sourced images use the `?width=2000&height=2000&fit=bounds&auto=webp&format=webply&canvas=2000,2000&quality=90`
  query pattern (matches the wave-2 exemplar).
- dm-sourced images use the `f_auto,q_auto,c_fit,h_3000,w_3000` CDN path pattern (matches the
  wave-2 exemplar).

## Open questions for Nick

1. **HASK dedupe application** — confirm the live catalog row for
   `7c057f58-3e9b-4347-b4c1-f04cc4213f94` doesn't already carry GTIN `0071164333068`, then apply
   the `existing_product_updates` entry above (and decide whether a `rename` is also warranted —
   see point 4 in the HASK section).
2. **Bali Curls naming** — confirm "Deep Repair Mask" over Rossmann's live "Deep Hydration Mask"
   label (W6 judgment call, evidence above), or override to keep the sourced-retailer's name.
3. **Bali Curls `conditioner_after` deviation** — confirm the downstream protocol stamp should use
   `conditioner_after` instead of the P5 default `replaces_conditioner` for this one product.
4. **Being Mega Shine thickness_eligibility** — confirm whether the explicit "für alle Haartypen"
   source claim should override the formula-based buildup-risk exclusion of `fine` hair (I included
   `fine`; the more conservative/consistent call would exclude it like its sibling Mega Moisture).
5. **Supabase access** — this session had no working Supabase MCP connection (requires interactive
   OAuth); the HASK GTIN-attachment check above needs to be run by whoever has DB access.

## Sources referenced (repo-internal, for the HASK dedupe)

- `data/scanner-catalog-coverage/2026-08-26/existing-catalog-gtin-research-update-2026-08-31.json`
- `plans/2026-08-28-remaining-barcode-resolution-rules.md`
- `plans/2026-08-28-existing-gtin-enrichment-receipt.md` (confirms Hask/Isana/alverde as existing
  canonical brand joins in the catalog)
