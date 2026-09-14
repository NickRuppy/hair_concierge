# Catalog extract — current Leave-in SKUs (DB, 2026-09-03)

Source: `products` (category = 'Leave-in') joined to `product_leave_in_specs`, Supabase project `pqdkhefxsxkyeqelqegq`. ~66 rows incl. 3 inactive/legacy. Raw data re-queryable; this file records calibration-relevant observations only. Existing spec values are legacy heuristics, NOT research-engine output — do not treat them as ground truth.

## Format distribution (active SKUs)

- spray: ~18 · lotion: ~20 · cream: ~12 · serum: ~10 · two_phase: **0**
- Note: DB `format` enum is `spray | milk→(absent) | lotion | cream | serum`; handover lean profile wants `spray | milk | lotion | cream | two_phase`. `serum` exists in DB but is an exclusion candidate under the handover boundary (anhydrous serums → oil/serum category). Enum reconciliation is a Phase-5 adapter decision.

## Boundary-suspect SKUs (handover: anhydrous oils/silicone serums are excluded; ruling #4 = flag in research only, DB untouched)

| SKU | Signal |
| --- | --- |
| Kevin Murphy Young Again | format serum, role oil_replacement, silicones+oils |
| L'Oréal Paris Midnight Serum | serum, oil_replacement, rich, silicones+oils |
| L'Oréal Elvital Leave-In Haarserum Bond Repair | serum, oil_replacement |
| L'Oréal Elvital Leave-In Serum Glycolic Gloss | serum, oil_replacement |
| Wahre Schätze Haarserum Honig | serum, oil_replacement |
| AUSSIE SOS Leave-In Haarserum | serum (water-based? verify formula) |
| Balea Professional serums (Brilliant Blond Sealer, Plex Care) | serum format; verify anhydrous vs emulsion |
| Schwarzkopf Gliss Night Elixier | serum |
| Neqi Diamond Glass Ultimate Styling Spray | styling_prep-only role — leave-in vs styling boundary |
| K18 Molecular Repair Hair Mist | styling_prep-only role, bond claim — treatment vs leave-in boundary |

Boundary rule of the standard (function + directions + architecture) must decide each; water-based serums may stay in-category.

## Heat-protection claims in current data (adversarial-candidate pool)

14+ SKUs carry `provides_heat_protection = true`, several with `heat_protection_max_c` 221–232 (EVO Day of Grace 221; Olaplex No.5/No.6, OUAI 232; Gliss/Redken/Wella/Neqi/Wahre Schätze 230). Herbal Essences sprays, HASK, Pantene 7in1, Moroccanoil, It's a 10, Color WOW claim heat protection with no °C. The handover treats heat protection as low-confidence from formula alone → these are prime `claim_only` vs `formula_plausible` vs `product_tested` test cases, and the existing boolean spec field will need remapping to the 4-state evidence model.

## Handover archetype coverage from catalog (gold set is archetype-first per ruling #3; catalog products listed as candidates only)

| # | Archetype | Catalog candidates |
| --- | --- | --- |
| 1 | Ultra-light fine-hair detangling spray | It's a 10 Lite, Isana Feuchtigkeits, alverde 7in1 |
| 2 | Mainstream general milk/lotion | Garnier Hair Food Aloe, Balea Aqua Hyaluron |
| 3 | Rich cream for dry/damaged | Cantu Repair Cream, Being Major Moisture |
| 4 | Two-phase spray | **none in catalog** — external pick needed (e.g. drugstore two-phase) |
| 5 | Silicone-rich smoother | Color WOW Money Mist, EVO Head Mistress |
| 6 | Silicone-free strongly cationic/polymeric | Curlsmith Hydrate & Plump, Garnier Fructis Air Dry (verify INCI) |
| 7 | Curl cream with meaningful hold polymer | Paul Mitchell Full Circle, Maria Nila Coils & Curls, Garnier Fructis Locken (verify hold polymer) |
| 8 | Heat-protective blow-dry primer | Gliss Sprüh-Conditioner, Wella Ultimate Repair, Redken One United |
| 9 | Protein/surface-repair | HASK Keratin 5-in-1, Curlsmith Weightless Protein (legacy name), Redken Extreme Anti-Snap |
| 10 | Bond-repair claim | Olaplex No.5, Pantene Bonding, K18 Mist (also boundary), Bali Curls Bonding N°3 |
| 11 | Fragrance-free / sensitive-positioned | **none flagged in catalog** — external pick likely needed |
| 12 | Boundary / source-conflict case | Kevin Murphy Young Again or Neqi Diamond Glass (styling boundary) |

Gaps requiring external German-market picks: #4 two-phase, #11 sensitive-positioned; #6/#7 need INCI verification before selection.

## Legacy-data quality notes

- 3 inactive rows (Cantu legacy duplicate, Maria Nila Structure Repair, True Soft).
- `ingredient_flags` empty on some rows (alverde, Living Proof, Paul Mitchell, Neqi Balm) — likely never backfilled, not silicone-free evidence.
- Many rows carry `needs_review_fields` for heat fields in the older review table — consistent with heat being the weakest legacy data.
