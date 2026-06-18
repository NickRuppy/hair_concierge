# Product Identity Canonical Correction Plan

Spec link: `docs/product-identity-normalization.md`

User situation: after the Phase 0 product identity backfill, production now has normalized brand, product-line, and alias rows, but review of the first 75 brands found several retailer-style or line-style names promoted into canonical brands. This would pollute onboarding/chat brand search and future product-submission matching.

Promised end-state: production and repo normalization data use one clean identity model: `display title = brand + optional line + clean product name`; aliases remain forgiving for user input; incorrect standalone brand rows are removed once unused; product cards and product-intake lookup still show full understandable product titles.

## Chosen Approach

Use a small, guarded correction pass rather than manual database edits.

- Update the reviewed normalization document and identity docs.
- Add/extend tests for canonical brand/line policy and display-name composition.
- Add a guarded correction script that performs the retargeting in a deterministic order.
- Dry-run and review before applying to production.

## Scope Boundaries

In scope:

- Correct the affected canonical brand/product-line mappings found after the first backfill.
- Retarget brand aliases so user-entered old names still resolve correctly.
- Clean affected `products.name` values where they duplicate the new brand/line.
- Delete old orphan identity rows only after verifying nothing references them.
- Add or reuse a central product display helper for `brand + optional line + name`.

Out of scope:

- Broad catalog metadata cleanup unrelated to these identity rows.
- Dropping legacy `products.brand` / `products.category` columns; that remains Phase 7.
- Recategorizing products or changing recommendation/category spec properties.
- Rewriting realistic chat/eval fixtures that mention old user language such as `Gliss Kur`.

## Canonical Decisions

| Current shape                            | Correct canonical shape                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Fructis` as brand                       | `Garnier > Fructis`; `Hair Food` stays in product name, not the one-level line                |
| `Wahre Schätze` as brand                 | `Garnier > Wahre Schätze`                                                                     |
| `Gliss` / `Glisskur` as brands           | `Schwarzkopf GLISS`; lines such as `Aqua Revive`, `Liquid Silk`, `Ultimate Repair` when clear |
| `Monday` / `Monday Haircare` split       | `MONDAY`; no line for current products                                                        |
| `L’Oréal` generic brand for Elvital oils | `L'Oréal Paris > Elvital`                                                                     |
| `L'Oreal Professionnel`                  | `L'Oréal Professionnel > Metal DX` for the current deep-cleansing product                     |
| `Balea > Aqua`                           | `Balea > Professional`; `Aqua Hyaluron` stays in product name                                 |

## Target File Map

- Modify: `data/product-catalog-normalization.json`
- Modify: `docs/product-identity-normalization.md`
- Modify or create: central product display helper, likely near `src/components/chat/product-display-model.ts` or `src/lib/product-catalog/`
- Modify call sites that currently render only `products.name` when normalized identity is available:
  - chat product cards
  - profile product usage rows
  - product-intake product lookup/review displays where applicable
- Create: `scripts/product-identity/correct-canonical-identities.ts`
- Modify: `package.json` script entry, e.g. `products:identity:correct`
- Modify tests:
  - `tests/product-catalog-normalization.test.ts`
  - `tests/product-identity-resolution.test.ts`
  - product display/helper test, existing or new
  - script dry-run/unit test if feasible without live Supabase

## Correction Table

| Product row                                         | Active? | Current normalized identity | New normalized identity               | Target `products.name` / `clean_name` | Expected composed display title                                |
| --------------------------------------------------- | ------- | --------------------------- | ------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `Gliss Kur Aqua Revive Conditioner`                 | yes     | `Gliss > Kur`               | `Schwarzkopf GLISS > Aqua Revive`     | `Conditioner`                         | `Schwarzkopf GLISS Aqua Revive Conditioner`                    |
| `Monday Moisture Conditioner`                       | yes     | `Monday`                    | `MONDAY`                              | `Moisture Conditioner`                | `MONDAY Moisture Conditioner`                                  |
| `Balea Aqua Hyaluron 3in1`                          | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron 3in1`                  | `Balea Professional Aqua Hyaluron 3in1`                        |
| `Gliss Ultimate Repair Sprüh-Conditioner`           | yes     | `Gliss`                     | `Schwarzkopf GLISS > Ultimate Repair` | `Sprüh-Conditioner`                   | `Schwarzkopf GLISS Ultimate Repair Sprüh-Conditioner`          |
| `Balea Aqua Hyaluron 3 in 1`                        | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron 3 in 1`                | `Balea Professional Aqua Hyaluron 3 in 1`                      |
| `Fructis Hair Food Aloe Vera`                       | yes     | `Fructis`                   | `Garnier > Fructis`                   | `Hair Food Aloe Vera`                 | `Garnier Fructis Hair Food Aloe Vera`                          |
| `Fructis Hair Food Papaya`                          | yes     | `Fructis`                   | `Garnier > Fructis`                   | `Hair Food Papaya`                    | `Garnier Fructis Hair Food Papaya`                             |
| `Gliss Aqua Revive`                                 | yes     | `Gliss`                     | `Schwarzkopf GLISS > Aqua Revive`     | `4-in-1 Bonding Haarmaske`            | `Schwarzkopf GLISS Aqua Revive 4-in-1 Bonding Haarmaske`       |
| `Gliss Liquid Silk Glanz 4-in-1 Bonding Haarmaske`  | yes     | `Gliss`                     | `Schwarzkopf GLISS > Liquid Silk`     | `Glanz 4-in-1 Bonding Haarmaske`      | `Schwarzkopf GLISS Liquid Silk Glanz 4-in-1 Bonding Haarmaske` |
| `Glisskur Liquid Silk`                              | no      | `Glisskur`                  | `Schwarzkopf GLISS > Liquid Silk`     | `Liquid Silk`                         | `Schwarzkopf GLISS Liquid Silk`                                |
| `Wahre Schätze 1-Minute Haarkur Argan & Camelia Öl` | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `1-Minute Haarkur Argan & Camelia Öl` | `Garnier Wahre Schätze 1-Minute Haarkur Argan & Camelia Öl`    |
| `Wahre Schätze Avocado`                             | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Avocado`                             | `Garnier Wahre Schätze Avocado`                                |
| `L’Oréal Elvital Öl Magique Jojoba`                 | yes     | `L’Oréal`                   | `L'Oréal Paris > Elvital`             | `Öl Magique Jojoba`                   | `L'Oréal Paris Elvital Öl Magique Jojoba`                      |
| `L’Oréal Öl Magique Midnight Serum`                 | yes     | `L’Oréal`                   | `L'Oréal Paris > Elvital`             | `Öl Magique Midnight Serum`           | `L'Oréal Paris Elvital Öl Magique Midnight Serum`              |
| `Balea Aqua Hyaluron`                               | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron`                       | `Balea Professional Aqua Hyaluron`                             |
| `Monday Haircare Volume Kraft & Fülle Shampoo`      | yes     | `Monday Haircare`           | `MONDAY`                              | `Volume Kraft & Fülle Shampoo`        | `MONDAY Volume Kraft & Fülle Shampoo`                          |
| `Wahre Schätze Aktivkohle`                          | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Aktivkohle`                          | `Garnier Wahre Schätze Aktivkohle`                             |
| `Wahre Schätze Sanfte Hafermilch`                   | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Sanfte Hafermilch`                   | `Garnier Wahre Schätze Sanfte Hafermilch`                      |
| `Serie Expert Metal DX Shampoo`                     | yes     | `L'Oreal Professionnel`     | `L'Oréal Professionnel > Metal DX`    | `Shampoo`                             | `L'Oréal Professionnel Metal DX Shampoo`                       |

Implementation note: these target names assume the display helper is wired before production apply. If the helper is not wired, do not apply the name cleanup yet because product cards would become too bare.

## Task 1: Update Canonical Policy Docs

- [ ] Update `docs/product-identity-normalization.md` so `product_line` is a durable one-level family, not every nested range.
- [ ] Change examples from `Garnier > Fructis Hair Food` to `Garnier > Fructis` with `Hair Food ...` in `clean_name`.
- [ ] Add examples for `Schwarzkopf GLISS`, `MONDAY`, `L'Oréal Paris > Elvital`, `L'Oréal Professionnel > Metal DX`, and `Balea > Professional`.
- [ ] Document the display contract: product display title is `brand + optional line + clean product name`.

## Task 2: Update Reviewed Normalization Data

- [ ] Edit the 19 affected rows in `data/product-catalog-normalization.json`.
- [ ] Retarget aliases so old user/shop wording still resolves to the corrected identity.
- [ ] Add aliases for common spellings:
  - `Fructis`, `Garnier Fructis`, `Garnier Hair Food`, `Garnier Fructis Hair Food`
  - `Wahre Schätze`, `Wahre Schaetze`, `Garnier Wahre Schätze`
  - `Gliss`, `GLISS`, `Gliss Kur`, `Glisskur`, `Schwarzkopf Gliss`, `Schwarzkopf GLISS`
  - `Monday`, `MONDAY`, `Monday Haircare`, `MONDAY Haircare`
  - `L’Oréal`, `L'Oreal`, `L'Oréal Paris`, `Elvital`
  - `L'Oreal Professionnel`, `L'Oréal Professionnel Paris`, `Serie Expert Metal DX`
  - `Balea Aqua`, `Balea Professional`, `Balea med`, `Balea Natural Beauty`
- [ ] Run `npm run products:identity:validate-reviewed`.

## Task 3: Add Product Display Helper

- [ ] Locate current product display helpers and card formatting.
- [ ] Add or reuse one central helper that composes `brand + optional line + name` without duplicating repeated tokens.
- [ ] Ensure the helper handles both joined DB rows and existing flat product DTOs.
- [ ] Patch high-impact display paths that would otherwise show only cleaned `products.name`:
  - chat product cards
  - profile/routine owned product rows
  - product-intake lookup/review displays where normalized identity is available
- [ ] Add tests for duplicate prevention:
  - `Garnier + Fructis + Hair Food Aloe Vera` -> `Garnier Fructis Hair Food Aloe Vera`
  - `Balea + Professional + Aqua Hyaluron 3in1` -> `Balea Professional Aqua Hyaluron 3in1`
  - `MONDAY + null + Volume Kraft & Fülle Shampoo` -> `MONDAY Volume Kraft & Fülle Shampoo`
  - `L'Oréal Paris + Elvital + Öl Magique Jojoba` -> `L'Oréal Paris Elvital Öl Magique Jojoba`

## Task 4: Add Guarded Correction Script

Create `scripts/product-identity/correct-canonical-identities.ts`.

- [ ] Dry-run by default.
- [ ] Require `--apply --confirm-project=pqdkhefxsxkyeqelqegq` for writes.
- [ ] Load `.env.local` and assert the Supabase URL targets project `pqdkhefxsxkyeqelqegq`.
- [ ] Verify current production rows match expected product IDs and old normalized identity before writing.
- [ ] Upsert required canonical brands and product lines.
- [ ] Retarget or replace stale aliases in a deterministic order.
- [ ] Update affected `products.brand_id`, `products.product_line_id`, and `products.name`.
- [ ] Delete old orphan identity rows only after verifying no references remain from `products`, `product_lines`, or `brand_aliases`.
- [ ] Print a before/after summary:
  - affected products
  - aliases retargeted
  - brands inserted/reused
  - lines inserted/reused
  - orphan brands/lines deleted or skipped

## Task 5: Tests And Dry Run

- [ ] Add normalization tests that fail if standalone `Fructis`, `Wahre Schätze`, `Glisskur`, `Monday Haircare`, or generic `L’Oréal` remain canonical brands for affected rows.
- [ ] Add brand-resolution tests for the corrected aliases.
- [ ] Add script dry-run tests if the current test harness can mock Supabase cleanly; otherwise keep logic units exported and test the plan builder.
- [ ] Run:

```bash
npm run products:identity:validate-reviewed
npx tsx --test tests/product-catalog-normalization.test.ts tests/product-identity-resolution.test.ts <display-helper-test>
npm run products:identity:correct
```

## Task 6: Review And Production Apply Gate

- [ ] Run local checks and final code review on the correction diff.
- [ ] Run a dry-run against production and review the exact output with Nick.
- [ ] Only after explicit approval, run:

```bash
npm run products:identity:correct -- --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

- [ ] Verify production state:
  - no affected product remains on old canonical brand rows;
  - corrected aliases resolve to the intended brand/line;
  - old wrong brand rows are absent or explicitly reported as skipped because still referenced;
  - product display title examples render correctly.
- [ ] Record the production correction in the plan or PR handoff.

## Verification

Automated:

- `npm run products:identity:validate-reviewed`
- Product normalization tests
- Brand-resolution tests
- Product display helper tests
- Correction script dry-run/unit tests
- `git diff --check`
- Prettier on changed files

Manual/read-only production checks before apply:

- List the dry-run correction table and compare it to this plan.
- Confirm no unexpected product IDs are included.
- Confirm all affected products have current production names/brands/categories matching the reviewed baseline.

Manual/read-only production checks after apply:

- Brand search for `Fructis`, `Wahre Schätze`, `Glisskur`, `MONDAY Haircare`, `Elvital`, `Balea Aqua` returns corrected options.
- Sample product cards show full display names with no duplication.
- `products.brand` and `products.category` legacy fields remain unchanged.

## Execution Handoff

Recommended next skill: `branch-gate`, then `superpowers:subagent-driven-development`.

Use a new stacked branch/worktree from `codex/product-intake-phase-5` so PR #181 remains reviewable and this canonical correction can be reviewed separately.
