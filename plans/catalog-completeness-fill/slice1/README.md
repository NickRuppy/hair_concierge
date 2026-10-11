# Slice 1 — guarded one-shot catalogue migration

Status: **prepared and rehearsed, NOT applied.** Production apply needs Nick's approval of this exact batch (fingerprint below).

| | |
|---|---|
| Migration | `supabase/migrations/20261011140000_catalog_completeness_fill_slice1.sql` (sorts after #660's `20261011120000`) |
| Batch id (ledger receipts + evidence) | `S5R-06-catalog-completeness-slice1` |
| Disposition batch (Garnier) | `S5-24-catalog-completeness-slice1` |
| Content fingerprint | `4398744e32e5b643a6e509969d09d936aed0260bbb7c4e5bc1dca6cc33647ca9` |
| Artifact manifest combined sha256 | `d25587b3ff000e7c01b083db0d8909bfa419f3c415ad40a4002a8129b649c804` |
| Prestate capture | `2026-10-11T13:48:49.533788Z` (read-only, prod `pqdkhefxsxkyeqelqegq`) |
| Schema capture | `2026-10-11T13:52:02.549733Z` (`fixtures/prod-schema-2026-10-11.json`) |

Files: `generate.ts` (generator, no DB access) → `target-state.json`, `rollback.sql` (prepared, not a migration), `verify.sql` (read-only zero-row post-apply proof), the migration, `artifact-manifest.json`. Inputs: `prestate.json`, `fixtures/`, `amendments/`, `inputs/`, `../research/**`. Capture queries: `capture/`.

## F01 — recapture after #654/#655/#660

- Prod ledger on 2026-10-11 has #660 step 1 (`20261011132316 bondbuilder_relax_intensity_contract`) and the profiles lock; #660 step 2 (`20261011120000`, drops `product_bondbuilder_specs.bond_repair_intensity`) is **not applied yet**.
- Prestate: `capture/prestate.sql` re-run as an md5-per-section query. Every section equals the 2026-10-09 capture byte for byte. `products` differs only in numeric scale that JSON transport always loses (e.g. `net_content_value` 75.0 vs 75); `updated_at` stamps are identical. `captured_at` was moved to the recapture time, which changes the fingerprint.
- Schema: object-by-object md5 of every captured table (columns, constraints, indexes, triggers) and function. The only change is `bondbuilder_research_contract_v1`, relaxed by step 1. It is replaced verbatim. The ledger now has 376 rows (+2), and its md5 is verified. The fixture also carries `bondbuilder_write_spec_v1` and `bondbuilder_research_enrich_v1` (md5-verified), because step 2 rewrites them.
- The migration never reads or writes `bond_repair_intensity`. Bondbuilder spec rows are guarded by key + `updated_at` only, which a `DROP COLUMN` leaves unchanged. Apply order works either way: the rehearsal applies the real step-2 file before Slice 1 (default harness), and one test applies Slice 1 first and then step 2.

## Per-group counts

| Group | Inserts | Updates | Deletes |
|---|---|---|---|
| A leave-in heat | 8 leave-in heat eligibility rows | 6 leave-in specs, 8 protocols (German source re-point) | — |
| B Bondbuilder | 1 identifier (Aveda GTIN) | 5 products (`category`), 1 protocol (OGX cadence) | — |
| C retirement | 1 `replaced_by`, 1 disposition (Garnier) | 2 products, 1 identifier (Midnight GTIN → leave-in) | — |
| D user-submitted | 14 protocols, 1 identifier (Balea GTIN), 1 scalp-care spec (Neqi) | 5 products, 3 leave-in specs, 3 leave-in fit specs, 1 mask spec, 1 identifier (Pantene GTIN) | 42 leave-in eligibility, 3 oil eligibility, 3 thickness eligibility |
| E identity | — | 2 products (net content) | — |

Plus 6 trigger effects (thickness projections), 51 evidence rows, 31 ledger receipts (one per written product) and 18 curated-publication re-asserts in the postflight. The F04 Neqi member rows (1 submission, 1 usage) are moved oil → scalp_care.

## Blocked (in the batch inputs, deliberately not written)

| Item | Wanted change | Reason |
|---|---|---|
| K18 `38dace91` protocol cadence (ruling B3) | „Nach einer Salonbehandlung vier bis sechs Haarwäschen hintereinander, danach nach Bedarf." → „Die ersten vier Haarwäschen hintereinander anwenden, danach bei jeder vierten Haarwäsche." (k18-hair.de, DE) | K18's curated-publication authority is its reviewed preserved bundle (`bondbuilder_research_preserved_bundle`), which pins the exact product and protocol rows. Its v0.5 profile has 3 protocol holds, so the strict fallback refuses it. Read-only prod proof (2026-10-11): `bondbuilder_curated_facts_ready_v1` = true today; with the new cadence the protected image ≠ saved bundle. #660 removes only the intensity key from that comparison. Any write would make the deferred gate reject the whole migration. Needs the Bondbuilder research lane to re-seal the bundle or adjudicate the holds (S4). Amendment kept at `amendments/k18-cadence-de.json` (`status: blocked`). |
| Epres `f8a63590` net content 30 ml (Group E) | `net_content_value/unit` NULL → 30 / ml | Same mechanism: preserved bundle, 2 protocol holds; the same prod proof shows the bundle stops matching with 30 ml written. Also S4. |

Deferred by ruling (not in this batch): Pantene 7in1 leave-in row `f8f3b51d` (S5), Neqi Diamond Glass spray protocols (S3), Aveda damage-band cadence (S4). Balea Tiefenreinigung keeps both rows (Shampoo v1.6 R6). After apply, still to do: re-embed `products.embedding` for Neqi Rosemary Oil, and the provenance debt for Balea Hydra Volume, Balea 2in1 Urea and Nivea Volumen & Kraft.

## F02 coverage

- K18 German cadence: in the batch inputs and blocked, see above.
- OGX cadence: create-only, source-bound amendment (`amendments/ogx-cadence-uk.json`, UK manufacturer page, B2). It pins the frozen profile digest and the profile's own cadence source C03-P06-1; the research profile is not rewritten.
- Neqi recategorisation: see Group D.
- Evidence rows, ledger receipts and postflight cover every group.

## F03 — rinse-off density scalp care (code, test-first)

- `stage5-v2-builder.ts`: `density_claim_tonic` may use `rinse_off_scalp_care` when V1 states it. Leave-on stays the default, and unrelated families are refused.
- `shared-templates-v2.ts`: `scalp.rinse-off.v2` moves to protocol v3. Steps: „Scheitelweise auf die Kopfhaut geben und sanft einmassieren." → „{{contact_time_de}} einwirken lassen." → „Anschließend mit Shampoo auswaschen."
  - The superseded v2 stays in the artifact-freeze registry.
  - The only two live rinse-off scalp products (Balea and Isana Kopfhautpeeling) also say „einmassieren … mit Shampoo ausspülen" in their manufacturer/retailer directions (R3 §3; Stage 5 v1 candidate payload). So the new copy is source-backed for them too.
- Neqi renders: einmassieren → „Mindestens 10 Minuten einwirken lassen." → mit Shampoo auswaschen → cosmetic-limitation line. No growth, minoxidil or peptide wording.
- `tests/personal-plan-scalp-rinse-off-density.test.ts`: red without the code change (4/5 fail), green with it.

## F04 — Neqi Smooth Strength Rosemary Oil `010cf825` reference inventory (read-only, re-verified 2026-10-11)

| Reference | Count |
|---|---|
| `user_products`, plan drafts, portfolio/routine versions, routine proposals, refinement drafts | 0 |
| `product_submissions` (approved) | 1: `da654fc1`, category oil, approved, linked to usage `9769d546` |
| `user_product_usage` | 1: `9769d546`, category oil, matched |
| Owner already has a scalp-care usage | no |

The migration moves both member rows to `scalp_care` in the same transaction (unlink → recategorise → relink), so every intermediate state passes the production triggers. The guards refuse if a new owner, a plan reference or a changed link appears.

## Before → after (for Nick)

| Product | Field | Before | After | Source |
|---|---|---|---|---|
| Alcina Hyaluron 2.0 | Hitzeschutz | nein | ja (+ Hitze-Eignung) | alcina.com DE |
| Neqi Build Boost Leave-In Balm | Hitzeschutz | nein | ja | neqi-hair.com DE |
| Neqi Moisture Mystery | Hitzeschutz | nein | ja | neqi-hair.com DE |
| Pantene Bonding Leave-In | Hitzeschutz / Anwendung | nein / handtuchtrocken | ja / handtuchtrocken + trockenes Haar | haircode.io (P&G DE) |
| Pantene HEAT&GLOW | Hitzeschutz / Anwendung | nein / handtuchtrocken | ja / handtuchtrocken + vor dem Föhnen + trockenes Haar | deutsche Packungsrückseite |
| Urban Alchemy Repair & Revive | Hitzeschutz | nein | ja | urban-alchemy.com |
| 8 Hitzeschutz-Leave-ins (oben + Gliss, Olaplex No.6) | Quelle der Vor-Hitze-Anleitung | EN/UK/CH-Seiten | deutsche Herstellerseiten | R1 |
| Aveda, Kérastase, Elvital, OGX, Redken (Bondbuilder) | Kategorie-Text | leer | „Bondbuilder" | Ruling B4 |
| Aveda Botanical Repair | Barcode | – | 018084067994 | R2 (parfumdreams JSON-LD) |
| OGX Bond Protein Repair | Rhythmus | – | „Ein- bis zweimal pro Woche anwenden." | ogxbeauty.co.uk (B2) |
| L'Oréal Midnight Serum (Öl-Zeile) | Status | aktiv, empfohlen | ausgelaufen, ersetzt durch die Leave-in-Zeile; Barcode 3600524135805 → Leave-in | loreal-paris.de, dm |
| Garnier Fructis Sleek & Stay | Empfehlung | empfohlen | nicht mehr im Plan (an Styling übergeben) | garnier.de |
| Syoss Fullness, Syoss Volume, Elvital Ultimate Shampoo | Anwendung | keine (Scan: „Noch nicht einschätzbar") | Standard-Shampoo-Anleitung | Hersteller / dm |
| Jean&Len Colorglow, John Frieda, Neqi Diamond Glass, Pantene Moisture Boost, GLISS Liquid Silk | Anwendung | keine | Standard-Spülungs-Anleitung | Hersteller / Müller |
| Pantene Moisture Boost Pflegespülung | Barcode | 08700216939140 (800-ml-Pumpe) | 8700216939508 (200 ml) | dm (U3) |
| AUSSIE SOS Leave-In | Leave-in-Profil | Booster, kein Pflegeprofil | ersetzt Spülung, ausgewogen, normal/kräftig; Nach-dem-Waschen-Anleitung | Leave-In v1.1 (U2), dm |
| Balea Brilliant Blond Hair Sealer | Leave-in-Profil / Barcode | Booster, alle Haardicken / – | ersetzt Spülung, reichhaltig, nur kräftiges Haar, mit Hitzeschutz; Anleitung nach dem Waschen + vor Hitze / 4070765027518 | Leave-In v1.1 (U2), dm |
| Bali Curls N°3 | Leave-in-Profil | Booster, alle Haardicken | ersetzt Spülung, Feuchtigkeit, normal/kräftig, **kein** Hitzeschutz (H4); Nach-dem-Waschen-Anleitung | Leave-In v1.1, bali-care.com |
| Jean&Len Rosemary/Ginger Maske | Maskenprofil / Haardicke / Anleitung | hoch konzentriert, keine Haardicke, keine Anleitung | mittel, Feuchtigkeit, wenig Reparatur, alle Haardicken; 5–30 Min. einwirken | Masken-Standard v1.0 (U4), jeanlen.de |
| Neqi Smooth Strength Rosemary Oil | Kategorie | Öl | Kopfhautpflege (Dichte-Tonic, Öl, wird ausgewaschen); Anleitung: einmassieren, mind. 10 Min., mit Shampoo auswaschen | neqi-hair.com How-tos, dm (U5/D-g) |
| Balea Aqua Hyaluron 3in1 (Maske + Leave-in) | Inhalt | – | 150 ml | dm DAN 1417521 |
| K18, Epres | — | unverändert (blockiert, s. o.) | — | — |

## Commands and results (2026-10-11)

| Command | Result |
|---|---|
| `npx tsx plans/catalog-completeness-fill/slice1/generate.ts --check` | validator green, fingerprint as above |
| `node --import ./tests/server-only-register.cjs --import tsx --test tests/catalog-completeness-fill-slice1-postgres.test.ts` | 13/13 pass |
| `… --test tests/personal-plan-scalp-rinse-off-density.test.ts tests/supabase-migration-version-uniqueness.test.ts tests/supabase-select-columns-contract.test.ts tests/personal-plan/products/stage3-authority.test.ts` | 126/126 pass |
| `npm run test:personal-plan-stage5` | 356/356 pass |
| Template/scalp/expansion suites (15 files touching `shared-templates-v2` / `stage5-v2-builder`) | 209/209 pass |
| `npx tsc --noEmit -p .` | pass |

The 13 rehearsal tests cover:
- exact target state, and replay as a no-op;
- drift refusal and NULL-tamper refusal;
- partial-catalogue refusal and fresh-DB skip;
- rollback: refuses a tampered target, restores the exact prestate, then re-apply;
- armed negative controls;
- Stage-3: Group A pre-heat and Bali post-wash only; Group D unknown → known; Neqi scalp guidance;
- the prerequisite chain incl. #660, both #660 orders, and the F04 refusals.

## Apply (only after Nick approves fingerprint `4398744e…47ca9`)

1. Confirm the prod ledger still matches. Step 2 of #660 may be applied before or after this migration.
2. Apply the migration. Run `verify.sql` and expect zero rows.
3. Re-embed Neqi Rosemary Oil.
4. Run the T1.7 audits.

`rollback.sql` restores the exact 2026-10-11 preimage and refuses unless the live state is the generated target.
