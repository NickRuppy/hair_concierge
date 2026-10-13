# Slice 4 (T4.10) — Aveda damage-band cadence

Status: **prepared and rehearsed, NOT applied.** Production apply needs Nick's approval of this exact batch.

| | |
|---|---|
| Migration | `supabase/migrations/20261013170000_bondbuilder_aveda_damage_cadence.sql` (generated) |
| Batch id | `S4-catalog-completeness-aveda-damage-cadence` (receipt key `P07`) |
| Content fingerprint | `92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0` |
| Prestate capture | `2026-10-11T14:35:10.608466Z`, read-only, prod `pqdkhefxsxkyeqelqegq` (`prestate.json`) |
| Inputs | frozen P07 profile (`recommendation-promotion-2026-10-06/P07.json`, profile sha `293275ba…`, canonical bytes = prod `d2473aa1…`), D-b binding (`data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json`) |

Rollback (Codex S4-04): `rollback.sql` restores the full protocol row, `updated_at` included — it refuses unless the row's stamp still equals the receipt's apply stamp (no later revision is undone), then suspends only `set_updated_at_product_application_protocols` inside its transaction (Slice 1 precedent; `SET CONSTRAINTS ALL IMMEDIATE` first, as the trigger can only be altered without pending events). The rehearsal asserts the restored protocol and product rows equal the preimage byte for byte.

Files: `generate.ts` (no DB access; `npx tsx plans/catalog-completeness-fill/slice4/generate.ts`) → migration, `rollback.sql` (prepared, not a migration), `verify.sql` (read-only, zero rows = postimage in place), `manifest.json`. Offline freshness check: `node --import tsx plans/catalog-completeness-fill/slice4/generate.ts --check` (no writes and no new prestate capture). Rehearsal: `tests/bondbuilder-aveda-damage-cadence-postgres.test.ts` (PGlite: real P07 bundle + real 2026-10-06 promotion migration, protocol id aligned to prod → apply, replay no-op, verify, rollback, reapply, tamper refusals, fresh-DB skip, files equal generator output).

## Writes

| Table | Row | Change |
|---|---|---|
| `product_application_protocols` | `f8d9cf57` (Aveda, `specialized_bond_treatment`) | `cadence` NULL → `damage_branched` (create-only CAS: cadence NULL, captured `updated_at` 2026-10-07T09:52:51.582864Z, source binding, payload hashes, single protocol, profile bytes) |
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

## Code rollback limitation (S4 timing answer)

Once a member saves the Feinschliff answer, `care_habits.bondbuilderTiming` is persisted. `careHabitsV1Schema` is `.strict()` on the pre-S4 code, so reverting the S4 code after the first saved answer makes the strict care-habits readers reject that row. A code rollback therefore needs a compatibility fix (accept and ignore the key) — forward-fix only. Keep the PR revertable until the first answer is saved: verify on a preview deployment before promoting.
