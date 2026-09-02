# Shampoo Wave Extension — PROPOSAL for Nick's skim-approval

Generated 2026-09-02. **Draft ledger, not applied to the database.** This extends `selection-batch1-draft.json`'s shampoo coverage (8 pilot + 31 backlog = 39 shampoo entries) with **15 additional shampoo-only candidates**, toward the ~50-SKU shampoo research wave. Companion machine-readable file: `shampoo-wave-extension.json`.

**I did not touch `selection-batch1-draft.json` / `.md`** — another agent owns those; I only read them for dedupe. Ranks here continue from 153 (the existing files' highest used rank is 152).

---

## The 15 candidates

| Rank | Brand | Product | Size | EAN | Retailer | Reviews | Why |
|---|---|---|---|---|---|---|---|
| 153 | Schwarzkopf Gliss | Shampoo Full Hair Magic | 250 ml | ✅ 4015100861723 | dm | 1266 | Highest-reviewed new find; no Gliss product under this name anywhere in the ledger |
| 154 | L'Oréal Paris Elvital | Shampoo Bond Repair Anti-Haarschäden | 200 ml | ✅ 3600524074654 | dm | 1131 | Completes the Bond Repair line (conditioner + leave-in already pilot) |
| 155 | schauma | Shampoo For Men | 400 ml | ✅ 4015100890792 | dm | 838 | schauma only has Anti-Schuppen (catalog) + Repair & Pflege (backlog) |
| 156 | Pantene Pro-V | Shampoo Grow Abundant Anti-Haarverlust | 290 ml | ✅ 8006530060042 | dm | 693 | Shampoo half of the Grow Abundant line (conditioner already backlog #67) — keep cosmetic framing |
| 157 | Schwarzkopf Gliss | Shampoo scalp balance Tiefenreinigung | 200 ml | ✅ 4015100893007 | dm | 568 | Scalp-focused deep-cleanse variant, distinct from other 3 Gliss shampoos in ledger |
| 158 | Plantur 21 | Shampoo Nutri-Coffein #langehaare | 200 ml | ✅ 4008666755520 | dm | 450 | Distinct Dr. Wolff sub-brand from Plantur 39 (catalog) / DMG Clinical (backlog #54) — cosmetic framing caution |
| 159 | Garnier Fructis | Shampoo Keratin Sleek | 200 ml | ✅ 3600542638777 | dm | 444 | Distinct Fructis line vs. Locken Methode (pilot) / Coco Water (backlog #34) |
| 160 | Isana MED | Shampoo Totes Meer | 200 ml | ❌ none | rossmann | 405 | Third Isana MED variant (backlog only has Jeden Tag + pH5.5) |
| 161 | Balea PROFESSIONAL | Shampoo Plex Care | 250 ml | ✅ 4070765006285 | dm | 314 | Distinct dm private-label sub-brand from plain Balea/Balea med |
| 162 | Isana PROFESSIONAL | Shampoo Keratin & Repair | 250 ml | ❌ none | rossmann | 195 | First Isana Professional *shampoo* (only oil/conditioner in ledger so far) |
| 163 | Isana PROFESSIONAL | Plex Shampoo | 250 ml | ❌ none | rossmann | 166 | Second Isana Professional shampoo (bond/plex positioning) |
| 164 | Isana MEN | Shampoo Energy Effect | 300 ml | ❌ none | rossmann | 162 | Men's Isana sub-brand, not represented anywhere else in the ledger |
| 165 | Garnier Wahre Schätze | Shampoo Kokosmilch & Macadamia | 250 ml | ❌ none | rossmann | 160 | Third/fourth Wahre Schätze variant, distinct from Aktivkohle/Hafermilch (catalog) + Honig Schätze (pilot) |
| 166 | John Frieda Sheer Blonde | Sheer Blonde Refresh & Shine Shampoo | 250 ml | ⚠️ 5037156296105 (URL-derived, unverified) | rossmann | 94 | Completes the Sheer Blonde pairing (conditioner already backlog #77) |
| 167 | AUSSIE | Shampoo Bouncy Curls | 300 ml | ✅ 8006530325530 | dm | 88 | Category completion — Aussie has leave-in (catalog) + conditioner (backlog #68) but no shampoo yet |

**EAN coverage: 9/15 (60%) confirmed from a dm `GTIN:` field, all mod-10 validated. 1/15 (John Frieda Sheer Blonde) is a moderate-confidence, URL-derived EAN (mod-10 valid, but not read off an explicit GTIN field — same method/caveat the original draft used for "Being Big Hair Shampoo"). 5/15 (all Rossmann-only Isana/Wahre Schätze picks) have no EAN: Rossmann's shampoo-category listing cards did not expose a GTIN field in this pass, matching the limitation `selection-batch1-draft.md` already documented for Rossmann-sourced items.**

No invented EANs anywhere — every non-empty `eans` value was either read directly from a dm product page's `GTIN:` field (9 items, mod-10 validated) or explicitly flagged ⚠️ as URL-derived/unverified (1 item); empty `eans: []` means "not found," never "doesn't exist."

---

## Near-duplicate judgment calls (excluded, with reasons)

These were seriously considered and excluded rather than risking a silent duplicate. Full list with review counts in `shampoo-wave-extension.json`'s `considered_and_rejected` array — summary:

- **Balea med Ultra Sensitive variants** (4 SKUs) — name-match existing catalog Balea/Balea med entries.
- **Elvital Glycolic Gloss shampoo** (dm 200ml, rossmann 300ml) — already in the catalog under the truncated name "Ultimate Shampoo" per the other draft's Corrections section.
- **Herbal Essences "Limettenduft, Tiefenreinigung & Glanz"** — judged a likely rename of the existing catalog's "Herbal Essences Tiefenreinigung" entry; excluded on suspicion rather than confirmed, flagged for a human check.
- **Herbal Essences Dolce Vita / Feuchtigkeit Aloe Vera / Repair Arganöl** — genuinely new, NOT duplicates, but left out to avoid over-weighting one brand (3 other Herbal Essences shampoos already in the ledger). Good candidates for a follow-up wave.
- **sebamed (3 SKUs) / Salthouse (2 SKUs) / OGX (1 SKU)** — existing catalog lists these brands only as a bare count ("Sebamed 4x" etc.) with no variant names, so any specific dm/Rossmann listing carries unresolvable duplicate risk. Excluded rather than guessed.
- **head&shoulders Derma x Pro (shampoo)** — same product line as the Derma x Pro leave-in Nick already parked as `scalp_care`; kept out for consistency, not re-litigated here.
- **Guhl Frische & Leichtigkeit Anti Fett** (cross-confirmed dm 273 / rossmann 36 reviews) and 4 other Guhl SKUs — same "5x, no names given" risk as sebamed/Salthouse. This one is the strongest of the excluded Guhl picks if Nick wants to spend a manual catalog check on it.
- **NIVEA Express 2in1** — near-duplicate of existing catalog "Nivea 2in1."
- **Plantur "DMG Clinical"** (dm listing, no "Dr. Wolff" prefix) — same product already in the backlog as "Dr. Wolff Plantur DMG Clinical" (rank 54).
- **LANGHAARMÄDCHEN "Lovely Long"** — the other draft's own conditioner notes (rank 69) name "Lovely Long" as one of the two existing-catalog Langhaarmädchen variants; too risky without a category check. "Hydrate & Shine" (22 reviews) wasn't worth the same risk for so few reviews.
- **John Frieda "Go Blonder" shampoo** (88 rossmann reviews) — genuinely new, not a duplicate, but dropped to keep John Frieda's share of this wave to one item (Sheer Blonde, which had a slightly higher review count).
- **Pantene 3in1 Repair & Care / Locken Pur** — not confirmed duplicates, but held back in favor of the higher-value Grow Abundant pick, partly because "Pantene 5x" in the existing catalog carries the same unresolved-variant-name risk as sebamed/Guhl/Salthouse/OGX above.

---

## Method

- **dm.de**: `dm.de/search?query=shampoo`, default sort (Beliebtheit). The first ~30 results duplicate what `selection-batch1-draft.json` already covers (confirmed by cross-reading both), so I used the page's "Mehr laden" control (clicked via a scoped `document.querySelector` + `.click()` call, purely to page a public search-results listing for reading — no state was submitted or changed) to load two further batches, reaching ~85+ rendered results before extracting new candidates. Each dm product page exposes a `GTIN:` field on its own detail page; all EANs in this file marked ✅ were read from that field directly and separately validated with the EAN-13 mod-10 checksum.
- **rossmann.de**: `rossmann.de/de/pflege-und-duft/haarpflege/shampoo/c/olcat3_4133099`, browsed pages 1-2 of the paginated category listing (5 pages total, ~24 items/page). Rossmann's listing cards show a review count next to each product but — as `selection-batch1-draft.md` already found — do not expose a GTIN on the listing itself, and most Rossmann product detail pages don't surface one either (checked directly for the John Frieda Sheer Blonde pick: no `GTIN`/`EAN` text anywhere on the page, only Rossmann's own internal `Artikelnummer`).
- **No web search** was used for orientation this pass — went straight to the two retailer sites, since the original pass already established that lifestyle-article "bestseller lists" aren't a reliable ranking source.
- **Dedupe** was done by hand against (a) the exact brand+variant list supplied in the task brief for the existing catalog, and (b) a full read of `selection-batch1-draft.json`'s pilot + backlog shampoo entries (39 items) and the corresponding `selection-batch1-draft.md` prose (including its Corrections and "existing_product_new_eans" sections, which flagged the Glycolic Gloss/"Ultimate Shampoo" collision I relied on here).

## Confidence & honest gaps

- **Popularity signal** is the same dm.de/rossmann.de review-count proxy the original draft used — real, retailer-reported, not a guess. All 15 candidates here have at least 88 reviews; the top 7 have 400+.
- **EAN capture bias toward dm**: 9 of 9 GTIN-confirmed EANs came from dm; 0 came from Rossmann's listing UI directly (matches the prior pass's finding). If Nick wants full EAN coverage on the 5 Isana + 1 Wahre Schätze rossmann-only items, that requires visiting each individual Rossmann product page by hand/URL — not attempted here to keep this pass scoped to shampoo.
- **Duplicate risk is asymmetric by brand**: for brands where the existing-catalog brief only gave a bare count with no variant names (Sebamed, Salthouse, Head&Shoulders, OGX, Guhl, Pantene, Langhaarmädchen), I erred toward excluding plausible-but-unconfirmed matches rather than guessing — meaning some of the 15 picks skew toward brands with clearer catalog visibility (Gliss, Elvital, schauma, Plantur, Fructis, Balea, Isana, Wahre Schätze, John Frieda, Aussie). This is a conservative bias, not a completeness gap — the excluded items are listed above and in the JSON's `considered_and_rejected` array if Nick wants to unblock any of them with a quick Supabase name check.
- **Category placement**: two picks (Pantene Grow Abundant, Plantur 21) sit near hair-growth/anti-hair-loss marketing claims. Both have an existing precedent already in the catalog/backlog (Plantur 39 Coffein, Dr. Wolff Plantur DMG Clinical, Pantene Grow Abundant conditioner) with the same "keep cosmetic framing" caution already applied there — carried forward here, not a new call.
- **Not independently verified**: true bestseller rank vs. review count as proxy, current in-stock status, and whether any of these 15 quietly duplicates an existing catalog row under a different name beyond what I could check by name alone (same caveat the original draft carries for its own 39 shampoo entries).
