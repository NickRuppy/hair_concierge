# Wave 3 — Leave-In Research Notes

Batch: `scan-db-expansion-wave3-leave-in-2026-09-03`. Validator: **PASS** (6/6 products, 1/1 existing_product_updates).

Candidates researched from `plans/scan-db-expansion/wave3-selection.json` `A_backlog_remainder` + `B_topup_new`, `category_key="leave_in"` (8 total).

## Outcome summary

| # | Candidate | Outcome |
| - | --------- | ------- |
| 1 | Afrolocke Leave-In Haarkur, für lockiges Haar | New product, manifest |
| 2 | Aussie Oh My Gloss Leave-In Haarserum | New product, manifest (EAN excluded_from_apply — single-source) |
| 3 | Pantene Pro-V Leave-In Spray Sunkiss Glow | New product, manifest |
| 4 | Plantur 39 Leave-In Sprühkur | New product, manifest |
| 5 | Isana Professional Haarfluid Wunder Express | **Excluded — category mismatch (rinse-out, not leave-in). See below.** |
| 6 | alverde Haarserum Nutri-Care | New product, manifest |
| 7 | MONDAY Moisture Leave-In Conditioner | New product, manifest |
| 8 | ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | **Dedupe — SAME as existing "Isana Feuchtigkeits Leave-In (Hyaluron)". Rename applied via existing_product_updates.** |

6 new products manifested, 2 excluded (1 dedupe/rename, 1 category mismatch).

---

## Dedupe verdict: ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol

**Verdict: SAME product as catalog's "Isana Feuchtigkeits Leave-In (Hyaluron)" (`0b21f996-bb42-4b10-89bd-4881c4346d53`).**

Evidence:

- Catalog row's existing EAN: `4305615946733`.
- Rossmann URL for the wave3 candidate: `https://www.rossmann.de/de/pflege-und-duft-isana-professional-leave-in-conditioner-hyaluron-und-panthenol-feuchtigkeitsspendend-silikonfrei-trockenes-haar/p/4305615946733` — the URL's trailing path segment (Rossmann's confirmed GTIN-in-URL convention, cross-checked against multiple other Rossmann products in this batch) is the **exact same EAN**.
- Live-fetched Rossmann page confirms: 100 ml, **2,49 €** (1L = 24,90 €) — matches the catalog row's `price_eur: 2.49` exactly.
- Current shelf name: **"ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol, feuchtigkeitsspendend, silikonfrei, trockenes Haar"** — clearly a rebrand/rename of the catalog's stale "Isana Feuchtigkeits Leave-In (Hyaluron)" (old brand "Isana" → current "Isana Professional").

**Action taken:** `existing_product_updates` in the manifest carries a `rename` entry (`from`/`to`/`reason`) for `product_id: 0b21f996-bb42-4b10-89bd-4881c4346d53`. No `add_identifiers` needed — the EAN is already correct in the catalog. No new product row created. This mirrors the precedent in `wave2-mask-manifest.json` (L'Oréal Elvital Haarmaske Hydra Hyaluronic rename, same mechanism).

Full INCI captured for reference (not needed for the rename, but useful if the row is ever re-verified): Aqua, Cetearyl Alcohol, Glycerin, Dicaprylyl Ether, Guar Hydroxypropyltrimonium Chloride, Betaine, Cetrimonium Chloride, Distearoylethyl Hydroxyethylmonium Methosulfate, Sodium Benzoate, Parfum, Panthenol, Sodium Hyaluronate, Lactic Acid, Potassium Sorbate, ... (silicone-free, confirms "silikonfrei" marketing).

---

## Excluded: Isana Professional Haarfluid Wunder Express — category mismatch, not a leave-in

Live-fetched the Rossmann page (`https://www.rossmann.de/de/pflege-und-duft-isana-professional-haarfluid-wunder-express/p/4305615886602`). The **Anwendung und Gebrauch** text is:

> "Vor Gebrauch schütteln. Sanft unter der Dusche auf die nassen Haarlängen auftragen. 7 Sekunden einmassieren. **Gut Ausspülen** und dabei Kontakt mit den Augen vermeiden."

This is a **rinse-out** express treatment applied in the shower and washed out after 7 seconds — not a leave-in product at all (`rinse: leave_in` is a hard invariant of every `TPL-LEAVEIN-*` template; this product's own instructions are `rinse_out`). Per R-A ("selection categories are provisional... category is finalized by research"), this candidate does not belong in the `leave_in` manifest.

It doesn't cleanly fit any of the five categories this expansion contract covers either — closest would be a rinse-out quick-conditioner/express-Kur, but recategorizing it as `conditioner` or `mask` is a scope call I'm not authorized to make unilaterally per this brief's remit (leave-in + oil only).

**Recommendation for Nick:** either drop this candidate from wave 3 entirely, or hand it to a conditioner/mask research lane if it's still wanted (200 ml, 2,99 €, Rossmann, 218 reviews — reasonable volume). INCI captured for reference: Glycerin, Alcohol Denat., Aqua, Myristyl Alcohol, Behentrimonium Chloride, Cetrimonium Chloride, Isopropyl Alcohol, Hydroxypropyltrimonium Hydrolyzed Wheat Protein, Dicaprylyl Carbonate, Citric Acid, Parfum, Limonene, Phenoxyethanol.

**Not counted as a manifest product; not in `existing_product_updates`.**

---

## R-D dry-use stamps chosen (TPL-LEAVEIN-DRYCARE)

| Product | Format/weight | R-D basis |
| ------- | -------------- | --------- |
| Afrolocke | cream/light | Explicit dry-refresh marketing: "Perfekt zur täglichen Anwendung und Auffrischung geeignet" + pre-dampen-before-applying instruction. Cream alone would be damp-only by default; the explicit claim is what qualifies it. |
| Aussie Oh My Gloss | serum/light | Explicit: usage instruction #2 names "an haarwaschfreien Tagen" (on wash-free days) as its own use case. |
| Pantene Sunkiss Glow | spray/light | Explicit: "auf feuchtes ODER trockenes Haar sprühen" — literal either/or in the one application sentence. |
| Plantur 39 | spray/light | Explicit: "ins trockene ODER ins feuchte Haar sprühen" — literal either/or. |
| alverde Nutri-Care | serum/medium | Explicit: "Für extra Pflege im trockenen Haar verwenden" as its own sentence, separate from the damp-application instruction. |
| MONDAY Leave-In | lotion/light | **Format default only (R-D: format=lotion ∧ weight=light) — no explicit dry-hair text on the sourced Rossmann page.** Flagged below as the one non-explicit DRYCARE stamp in this batch. |

MONDAY is the one case where I stamped DRYCARE purely off the format/weight default rule, not an explicit source claim — worth a second look if Nick wants DRYCARE reserved for explicitly-evidenced products only, since R-D's own wording treats the format default and the explicit-marketing exception as two independently sufficient paths, and I followed that literally.

## Heat-protection stamps

Only **alverde Haarserum Nutri-Care** carries `provides_heat_protection: true` (explicit "Hitzeschutz bis zu 230 °C" claim, `heat_protection_max_c: 230`) and gets `TPL-LEAVEIN-HEAT`. Family = `pre_heat_damp` (`usable_on_dry_hair: false`) — the only heat-specific application sentence is "ins feuchte Haar verteilen... vor der Nutzung heißer Stylinggeräte trocknen"; the separate "für extra Pflege im trockenen Haar" sentence is general care, not stated as a heat-protection-on-dry-hair permission, so I did not read it as `either_state_protection`.

Pantene Sunkiss Glow explicitly does **not** get a heat-protection stamp: its "Sonnen-Schutzspray" claim is UV/sun/salt/chlorine protection, a different concept from heat-styling protection, and I kept those separate rather than conflating them.

---

## Low-confidence / flagged fields (uncertainty discipline)

- **MONDAY Leave-In Conditioner, `product_leave_in_fit_specs.care_benefits: ["detangle_smooth"]`.** The sourced Rossmann DE copy only claims moisture + shine (via a hyaluronic-acid moisture-sealing layer); there is no literal "entwirrt"/"kämmbar" wording. The schema requires ≥1 value from `{heat_protect, curl_definition, repair, detangle_smooth}` and none is a clean fit — `detangle_smooth` is the least-overclaiming choice (a moisture-sealing film is a defensible, if indirect, smoothing mechanism), but this is a schema-forced pick, not a literal claim match. Flagged for Nick; a schema change (allowing an empty fit-benefits array, or adding a plain "moisture"/"shine" fit bucket) would remove the need to force a value here.
- **Pantene Sunkiss Glow, `repair_support_level: low` despite the "Pflegt und repariert" marketing bullet.** No hydrolyzed protein or bond-builder actives in the INCI (only non-hydrolyzed "Silk Extract"), so I kept potency conservative while still reflecting the claim in `care_benefits`/`concern_eligibility`. Consistent with the wave2 Herbal Essences Arganöl Elixir precedent (disclaimer-qualified repair claim → low support level).
- **alverde Nutri-Care `weight: medium`.** No explicit "leicht"/"beschwert nicht" claim either way; classified by analogy to the wave2 Balea Professional Plex Care precedent (protein serum, similar richness signal). Low-to-moderate confidence.

## Open questions for Nick

1. **Isana Professional Haarfluid Wunder Express** — confirmed rinse-out, not leave-in (see above). Drop from wave 3, or route to a different category lane?
2. **MONDAY Leave-In DRYCARE stamp** — accept the pure format-default basis (no explicit source text), or hold format-default-only DRYCARE stamps to a higher bar going forward?
3. **Aussie Oh My Gloss EAN** — single-source only (dm.de structured GTIN field), no independent second source found (product appears to be a recent SKU not yet indexed elsewhere). `excluded_from_apply: true` per R-B; will need either a second retailer listing or a physical scan before it can go live with a barcode.

## Sources checked but not used

- `hautschutzengel.de` for Afrolocke (INCI-only page, no EAN shown — used ecco-verde.com instead for the second EAN source).
- `superdrug.com`/`boots.com` UK listings for Pantene (returned 403 to WebFetch; used target.com's UPC listing instead, which loaded).
