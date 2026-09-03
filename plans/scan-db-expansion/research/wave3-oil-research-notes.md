# Wave 3 — Oil Research Notes

Batch: `scan-db-expansion-wave3-oil-2026-09-03`. Validator: **PASS** (1/1 products, 1/1 existing_product_updates).

Candidates researched from `plans/scan-db-expansion/wave3-selection.json` `A_backlog_remainder` + `B_topup_new`, `category_key="oil"` (3 total).

## Outcome summary

| # | Candidate | Outcome |
| - | --------- | ------- |
| 1 | Gliss Hitzeschutz Öl-Spray Oil Nutritive | New product, manifest — **category judgment: kept as `oil` (W1)** |
| 2 | Alterra Haar- und Kopfhautöl | **Excluded — scalp-primary product, flagged per instructions. See below.** |
| 3 | OGX Haaröl Moroccan Argan Penetrating Oil | **Dedupe — SAME as existing "OGX Argan Oil". Rename applied via existing_product_updates. Open question re: a third Rossmann-only SKU, see below.** |

1 new product manifested, 2 excluded (1 dedupe/rename, 1 scalp-primary exclusion).

---

## Dedupe verdict: OGX Haaröl Moroccan Argan Penetrating Oil

**Verdict: SAME product as catalog's "OGX Argan Oil" (`1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf`), via the dm.de source.**

Evidence:

- Catalog row's existing EAN: `3574661563312`.
- Live-fetched dm.de page (`https://www.dm.de/ogx-haaroel-moroccan-argan-penetrating-oil-p3574661563312.html`) shows the structured field **"GTIN: 3574661563312"** — an exact, direct match, not just a URL-slug coincidence.
- dm price 7,95 € vs. catalog's stale 8,95 € — a price refresh, does not change product identity (GTIN is the ground-truth identifier).

**Action taken:** `existing_product_updates` carries a `rename` entry for `product_id: 1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf` (from "OGX Argan Oil" to the current dm shelf name "OGX Haaröl Moroccan Argan Penetrating Oil"). No `add_identifiers` needed — EAN already correct in catalog.

### Open question: a third, distinct Rossmann SKU under the same nominal product name

The wave3-selection.json entry listed **both** a dm URL and a Rossmann URL for this one candidate:

- dm: `.../p3574661563312.html` → GTIN `3574661563312` = catalog's "OGX Argan Oil" ✅ (used for the dedupe verdict above)
- Rossmann: `.../ogx-renewing-argan-oil-of-morocco-extra-penetrating-oil/p/3574661563336` → **a different GTIN, `3574661563336`**

I fetched the Rossmann page directly. It's titled **"ogx renewing+ Argan Oil of Morocco Extra Penetrating Oil"**, 100 ml, 7,99 €, and its INCI is **silicone-based** (Dimethicone, Isopropyl Myristate, Dimethiconol, C12-15 Alkyl Benzoate, Argania Spinosa Kernel Oil, ...) — visibly different from a plain-oil profile and not something I independently verified against the dm product's own INCI (I did not pull dm's Inhaltsstoffe accordion for this one, since the GTIN match alone was sufficient for the dedupe call). This EAN also doesn't match either catalog EAN (`3574661563312` "OGX Argan Oil" or `3574661563350` "OGX Argan weightless Öl").

This looks like a genuinely separate Rossmann-exclusive SKU or reformulated generation of the same nominal product line, not the same GTIN as anything currently in the catalog. **I did not research or manifest this third SKU** — it's outside what "dedupe-check the dm-sourced candidate" asked for, and creating a new product from it would need its own full research pass (2-source EAN, INCI, protocols). Flagging for Nick to decide whether it's worth a follow-up research item.

---

## Category judgment: Gliss Hitzeschutz Öl-Spray Oil Nutritive — kept as `oil` (W1: formula beats marketing)

Full INCI (live-fetched from Rossmann):

> Isododecane, Caprylic/Capric Triglyceride, Dicaprylyl Carbonate, Helianthus Annuus (Sunflower) Seed Oil, Prunus Armeniaca (Apricot) Kernel Oil, Sclerocarya Birrea Seed Oil (Marula), Parfum, Linalool, Limonene, Alpha-Isomethyl Ionone, Geraniol, Benzyl Alcohol, Tocopherol, CI 40800.

**No `Aqua` at all** — this is a fully anhydrous formula: a volatile silicone-free carrier (Isododecane) + ester emollients + three real plant/nut oils + antioxidant + colorant. There are **zero silicones** in the INCI, which is notable for a Schwarzkopf heat-protectant spray (most drugstore heat sprays in this price tier lean on Amodimethicone/Cyclopentasiloxane). Per W1, this is substantively an oil, packaged in a spray-with-pump-nozzle format — kept in `oil` category with heat capability as a researched fact (`role_support: ["pre_heat_protection"]`), not recast to `heat_protectant`.

**Narrow `role_support`.** The entire sourced application text ("Für optimalen Hitzeschutz vor dem Föhnen und Glätten...") is framed exclusively around heat-protection use — there's no separate "use any time as a finishing oil" sentence. I therefore stamped only `TPL-OIL-HEAT` (`role_support: ["pre_heat_protection"]`), not `TPL-OIL-DRYFINISH`/`TPL-OIL-LEAVEON`, to avoid inventing a general-finish use case the source doesn't state. Family = `either_state_protection` (`usable_on_dry_hair: true`) — the source explicitly says "ins handtuchtrockene ODER trockene Haar sprühen," a literal either/or for the heat-protection application itself (not just a general preference statement), satisfying P9's bar directly.

**Two-source EAN.** Gliss/Schwarzkopf is not a Rossmann or dm house brand, so W5 requires 2 independent sources. Confirmed: Rossmann URL GTIN `4015100813876` matches dm.de's own product URL (`hitzeschutz-oel-spray-oil-nutritive-p4015100813876.html`) — two independent retailers, `cross_source_agreement: true`.

---

## Excluded: Alterra Haar- und Kopfhautöl — scalp-primary product, flagged per instructions

Live-fetched the Rossmann page (`https://www.rossmann.de/de/pflege-und-duft-alterra-haar--und-kopfhautoel/p/4068134009579`). Full application text:

> "**Erfrischende Kopfhautpflege vor dem Waschen**: Das Haar- und Kopfhautöl Bio-Rosmarin pflegt die Kopfhaut vor dem Waschen. Je nach Haarlänge 1 bis 2 Pumphübe auf das trockene, nicht nasse Haar **von der Kopfhaut** bis zu den Spitzen auftragen, einmassieren und 10-15 Minuten einwirken lassen. Anschließend wie gewohnt die Haare waschen."

And the product description leads with: "Rosmarin: 'Tau des Meeres'... verleiht **Ihrem Haar UND Ihrer Kopfhaut** neue Vitalität."

Three signals together made this a clear scalp-primary product, not a cosmetic hair oil with merely scalp-tolerant use:

1. **Name itself**: "Haar- **und Kopfhautöl**" (hair-**and-scalp**-oil), not just "Haaröl."
2. **Marketing framing**: leads with "Kopfhautpflege" (scalp care) and scalp vitality, not hair-fiber benefits.
3. **Application instruction explicitly starts at the scalp**: "von der Kopfhaut bis zu den Spitzen" — this directly contradicts TPL-OIL-PREWASH's mandatory placement rule (P8: "Kopfhaut und Ansatz aussparen" — scalp and roots are excluded by rule, not by choice). The product's own instructions cannot be reconciled with the template without either overriding a hard rule (not permitted — R-C reserves the deviation mechanism for structural category mismatches, and a scalp-first product genuinely is one) or silently dropping the scalp instruction (would misrepresent the product's actual, evidenced use).

Per the brief's own framing ("if it is marketed primarily as a scalp treatment, flag it — scalp products are out of scope"), I parked this rather than force-fitting a `TPL-OIL-PREWASH` stamp with a scalp-placement deviation that would just get kicked back to Nick anyway. `scalp_care` is explicitly out of scope for this pilot per `protocol-templates.md` §4.

INCI captured for reference (natural, silicone-free): Glycine Soja Oil, Helianthus Annuus Seed Oil, Coco-Caprylate, Prunus Amygdalus Dulcis Oil, Olea Europaea Fruit Oil, Persea Gratissima Oil, Tocopherol, Rosmarinus Officinalis Leaf Oil + natural essential-oil terpenes. 50 ml, 3,49 €, Rossmann-exclusive (Alterra is a Rossmann private label, single-source EAN would have sufficed per W5 had this gone forward).

**Not counted as a manifest product; not in `existing_product_updates`.**

---

## Open questions for Nick

1. **Third OGX Rossmann SKU** (`3574661563336`, silicone-based INCI, "renewing+ Argan Oil of Morocco Extra Penetrating Oil") — worth its own research pass, or drop entirely? Not currently in the catalog under any name.
2. **Alterra Haar- und Kopfhautöl** — confirmed scalp-primary (see above). Fully excluded from this wave; would need a `scalp_care` category to be opened before it could be considered, per the pilot's explicit scope boundary.
3. Net oil-category yield for this wave is thin: **1 new product** out of 3 candidates (2 excluded for principled reasons, not researched shortcuts). Worth flagging to Nick in case backlog composition for future oil waves should skew more toward plain finishing/leave-on oils and less toward heat-protectant-adjacent or scalp-adjacent products, which keep failing the category boundaries on inspection.
