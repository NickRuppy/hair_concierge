# Round 4 — Evidence Gap Closure (packet items 1–2)

Date: 2026-09-13 · Closes round-4-report.md residue items 1 ("packet evidence gap" — `product_form` unknown/guessed on slots 2, 6, 9, 10) and 2 ("packet evidence gap" — slot 9 `application_stage` frozen directions name no stage). No classification is performed here; scope is presentation-form (dispenser/consistency) confirmation and one verbatim German directions capture, per the round-4 report's own prescribed closure ("Evidence pass: pack-shot/retailer form evidence → packet amendment").

Identity for all four items was read from `calibration-packet.json` first and matched by exact GTIN/Art.-Nr./pack size before any evidence was gathered — see each item below for the confirmed identity, including one correction to the task brief's assumed pack size.

## Gap 1 — presentation form

### Item 1 — Slot 2: ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol

**Packet identity (not the brief's):** 100 ml, GTIN 4305615946733, rossmann.de Art.-Nr. 124771. (The task brief mentioned "150 ml" — that does not match this record's frozen identity; the packet's own 100 ml / GTIN 4305615946733 is what was verified below. No packet field was changed by this correction — it is a note for the record only.)

**Evidence:** rossmann.de product page, same URL already frozen in this record's `source_urls` (`https://www.rossmann.de/.../p/4305615946733`). Fetched two full-resolution packshots directly from the page's media CDN:
- `MAM_53599009_SHOP_IMAGE_1.4.png` (front angle, 1200×1200): shows a light-purple ~100 ml bottle topped with a **black finger-pump/trigger spray actuator** — round push-button on top of a vertical stem feeding a horizontal spray nozzle, under a clear plastic overcap.
- `MAM_53599100_SHOP_IMAGE_1.4.png` (three-quarter angle, 1200×1200): confirms the identical head from a second angle, and additionally shows the **on-pack EAN barcode reading 4305615946733** — an exact match to this record's frozen GTIN, confirming the correct SKU was inspected.

This is the same head style already adjudicated as `spray` for the sibling ISANA PROFESSIONAL Argan Leave-in Conditioner in `plans/leave-in-inci/research/unseen-test/u5-format-evidence.md` (identical brand sub-line, identical cap geometry).

**Verdict: spray — confidence high.** Two independent angles of the manufacturer/house-brand's own packshot, with an exact barcode match confirming SKU identity, leave no ambiguity.

### Item 2 — Slot 6: Curlsmith Hydrate & Plump Leave-In

**Packet identity:** 237 ml, no GTIN on file, matched via exact product name + pack size against lockenbox.com (German/EU curl-specialty retailer, already frozen in this record).

**Identity check (per the brief's "verify exact SKU" instruction):** confirmed this is the **Hydrate & Plump Leave-In** SKU, distinct from Curlsmith's separate "Weightless Air Dry Cream" product — the manufacturer's own page (curlsmith.com) lists "Hydrate & Plump Leave-In" as its own product with its own URL slug and its own Product Specifications block, matching this record's `exact_product_name` and 237 ml `pack_size` exactly. No SKU-identity correction needed.

**Evidence:**
- lockenbox.com CDN packshots (same retailer already frozen in `source_urls`): the primary bottle photo shows a dark amber glass bottle with a **lotion/cream-style pump dispenser** (wide pump collar, round push-top, no spray nozzle) and a printed label reading "Conditioning Cream" directly under the product name. A second marketing image shows a **texture-callout swatch**: a thick, opaque white cream dispensed onto the pump top, unambiguously a cream consistency rather than a thin liquid or mist.
- curlsmith.com (manufacturer's own site, non-German-market): the "Product Specifications" field states verbatim — **"Format: Light Cream."**

**Verdict: cream — confidence high.** Manufacturer's own explicit format field plus a retailer packshot showing both the pump dispenser and a visible thick-cream texture swatch agree unambiguously.

### Item 3 — Slot 9: Redken Extreme Anti-Snap Leave-In Treatment

See Gap 2 below — both the presentation-form and application-stage evidence for this item came from the same fetch and are reported together there.

### Item 4 — Slot 10: Olaplex N°.6 Bond Smoother

**Packet identity:** 100 ml, douglas.de Art. 1111439 (already frozen in this record).

**Evidence:**
- douglas.de, navigated directly by Art.-Nr. (`https://www.douglas.de/de/p/1111439`): the page title and packshot confirm "Leave-In-Conditioner für Unisex Olaplex Bond Maintenance No.6 Bond Smoother® 100 ml" — exact identity match. The full-resolution packshot shows a **squat, opaque white airless-pump bottle** with a flat push-dome top — no spray nozzle, no flip-cap, no visible tube — consistent with a cream/lotion pump dispenser, and the label itself reads "100 mL / 3.3 fl. oz."
- olaplex.com (manufacturer's own site, non-German-market — record-only per this packet's claim-authority hierarchy, but product identity for this record is already cross-market-verified via the 2026-09-10 T14 amendment on file: 46-ingredient INCI set-for-set match + EAN corroboration): product copy states verbatim — **"An anti-frizz styling cream to smooth, hydrate, and reduce breakage"** with directions "Apply one pump to clean, damp hair."

**Verdict: cream — confidence high.** Matches the round-3 reference-key value already on file for this slot (the only one of the four where round-3's "lotion" guess is absent — round-3 already had this one as cream); this pass adds packshot-grade and manufacturer-copy confirmation.

## Gap 2 — Redken slot 9: application-stage directions + presentation form

**Does redken.de exist?** `redken.de` redirects to `https://www.redken.eu/de-de/`, Redken/L'Oréal's German-market site (locale `de-de`). The exact product page was located at:

`https://www.redken.eu/de-de/produkte/haarpflege/extreme/extreme-anti-snap`

This is a **C2 manufacturer-German page** per this packet's own claim-authority hierarchy (manufacturer, German-market locale).

**Presentation form:** the page's product photography (image filenames embed GTIN `884486453402`, an exact match to one of this record's two `gtin_candidates`, confirming SKU identity) shows an unambiguous **black spray-trigger pump head** with a horizontal atomizing nozzle on the 250 ml bottle — the same fine-mist trigger-spray geometry as slot 2's ISANA packshot, clearly not a lotion pump.

**Verdict (form): spray — confidence high.**

**Application-stage directions (verbatim, C2 manufacturer German source, fetched 2026-09-13):**

> „Nach dem Extreme Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht ausspülen. Wie gewohnt stylen."

This is the manufacturer's own "GEBRAUCHSANWEISUNG & SICHERHEITSINFORMATIONEN" (usage & safety information) tab content on the German-market product page. It names the application stage explicitly: **„Ins handtuchtrockenen Haar geben"** — "apply to towel-dried hair."

**Verdict (stage): `towel_dry` is now evidenced on a C2 source — confidence high.** The frozen `directions_of_use` in this record (sourced from douglas.de, tier C3, "Auf einzelne brüchige Haarstellen oder auf dem ganzen Haar verteilen und einmassieren. Ohne ausspülen, direkt die Haare wie gewohnt stylen...") is genuinely silent on stage, which is exactly why round 4 found `[]` from the packet alone — that reading was correct given only the frozen text. This new C2 manufacturer capture is a stronger, independent source and closes the gap honestly: the stage wording exists and is authoritative, it was simply not in the frozen packet text. (No genuinely-absent-evidence case applies here — the wording was found on the manufacturer's own German site.)

## Summary table

| Slot | Product | Round-3 value | This pass's verdict | Change? | Confidence |
|---|---|---|---|---|---|
| 2 | ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | lotion | **spray** | correction | high |
| 6 | Curlsmith Hydrate & Plump Leave-In | lotion | **cream** | correction | high |
| 9 | Redken Extreme Anti-Snap Leave-In Treatment | lotion | **spray** | correction | high |
| 10 | Olaplex N°.6 Bond Smoother | cream | **cream** | confirmed | high |
| 9 (stage) | Redken Extreme Anti-Snap Leave-In Treatment | `['towel_dry']` (key, unevidenced in packet) | **`towel_dry` confirmed on C2 source** | confirmed | high |

Three of the four round-3 `lotion` guesses do not survive pack-shot inspection. This is consistent with the pattern already seen in the u5-Argan precedent: "lotion" reads as a generic default for leave-in liquids in the absence of dispenser evidence, and packshot inspection tends to resolve it one way or the other (spray vs. cream) rather than confirm a true pourable-lotion consistency. None of the four items in this pass turned out to actually be a pourable lotion.

## Amendments made

- `plans/leave-in-inci/research/gold-set/calibration-packet.json`: appended one `source_urls` entry each to slots 2, 6, 9, 10 (the slot-9 entry covers both the presentation-form and application-stage findings), plus one dated `amendment_log` entry (2026-09-13).
- `plans/leave-in-inci/research/gold-set/blind-packet.json`: identical `source_urls` additions to the same four slots, plus one dated `amendment_log` entry (2026-09-13).
- No `raw_inci`, `normalized_ingredients`, `rawInciSha256`, `formulaFingerprintSha256`, `directions_of_use`, `claims`, or any other field was changed. Verified by hash recomputation: all 13 `rawInciSha256` values in `calibration-packet.json` still match their `raw_inci` strings after the amendment.
- Both JSON files verified to parse (`json.load`) after the amendment.
