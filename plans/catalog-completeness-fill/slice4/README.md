# Slice 4 (T4.10) — Aveda damage-band cadence

Status: **prepared and rehearsed, NOT applied.** Production apply needs Nick's approval of this exact batch.

| | |
|---|---|
| Migration | `supabase/migrations/20261011170000_bondbuilder_aveda_damage_cadence.sql` (generated) |
| Batch id | `S4-catalog-completeness-aveda-damage-cadence` (receipt key `P07`) |
| Content fingerprint | `4a3498972ba6fa8f769625134a1f05ecfeaeb45ea9f131653c5355e197f3669c` |
| Prestate capture | `2026-10-11T14:35:10.608466Z`, read-only, prod `pqdkhefxsxkyeqelqegq` (`prestate.json`) |
| Inputs | frozen P07 profile (`recommendation-promotion-2026-10-06/P07.json`, profile sha `293275ba…`, canonical bytes = prod `d2473aa1…`), D-b binding (`data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json`) |

Files: `generate.ts` (no DB access; `npx tsx plans/catalog-completeness-fill/slice4/generate.ts`) → migration, `rollback.sql` (prepared, not a migration), `verify.sql` (read-only, zero rows = postimage in place), `manifest.json`. Rehearsal: `tests/bondbuilder-aveda-damage-cadence-postgres.test.ts` (PGlite: real P07 bundle + real 2026-10-06 promotion migration, protocol id aligned to prod → apply, replay no-op, verify, rollback, reapply, tamper refusals, fresh-DB skip, files equal generator output).

## Writes

| Table | Row | Change |
|---|---|---|
| `product_application_protocols` | `f8d9cf57` (Aveda, `specialized_bond_treatment`) | `cadence` NULL → `damage_branched` (create-only CAS: cadence NULL, source binding, payload hashes, single protocol, profile bytes) |
| `personal_plan_catalog_fact_evidence` | `bondbuilder.protocol.cadence` | +1 (aveda.de, manufacturer, profile source C03-P07-1, rulings B1/D-b) |
| `catalog_enrichment_applied_items` | batch above, `P07` | +1 receipt (`reviewed_by = nick`) |

Gates: `bondbuilder_curated_facts_ready_v1` passes on Aveda today through the strict profile fallback (no preserved bundle, 0 protocol holds) and does not read `cadence`; the postflight re-asserts it and `assert_personal_plan_curated_publication`. Runtime order is safe either way: before the S4 code ships, an unknown cadence kind already renders the generic line.

## Before → after (for Nick)

| Plan damage band (`structuralLevel`) | Prod members with a Bondbuilder need (2026-10-09) | Aveda card today | Aveda card after apply |
|---|---|---|---|
| none / low | 0 | „Nach Herstellerangabe" | „Nach Herstellerangabe" (unchanged, no band invented) |
| moderate | 6 | „Nach Herstellerangabe" | „Einmal pro Woche anwenden." |
| high | 14 | „Nach Herstellerangabe" | „An jedem Waschtag anwenden." |
| severe | 37 | „Nach Herstellerangabe" | „An jedem Waschtag anwenden." |

Aveda is in 0 active routines today, so no live routine changes on apply; the line appears when Aveda is picked (e.g. under a budget or by the user). Source: aveda.de „ANWENDUNG" — mild-to-moderate damage weekly, moderate-to-severe each wash day; the overlap at „moderate" is resolved by D-b.

After apply: run `verify.sql` (expect zero rows), re-read the protocol row, and replay a moderate and a severe fixture through the compiler (`tests/personal-plan-routine-candidate-compiler.test.ts` S4 case).
