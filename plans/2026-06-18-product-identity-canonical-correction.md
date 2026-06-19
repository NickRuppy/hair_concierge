# Product Identity Canonical Correction Plan

Spec link: `docs/product-identity-normalization.md`

User situation: after the Phase 0 product identity backfill, production now has normalized brand, product-line, and alias rows, but review of the first 75 brands found several retailer-style or line-style names promoted into canonical brands. This would pollute onboarding/chat brand search and future product-submission matching.

Promised end-state: production and repo normalization data use one clean identity model: `display title = brand + optional line + clean product name`; aliases remain forgiving for user input; incorrect standalone brand rows are removed once unused; product cards and product-intake lookup still show full understandable product titles.

Claude review outcome: split the work. Phase A corrects canonical identity and aliases additively. Phase B performs live `products.name` cleanup only after the app can hydrate canonical brand/line data everywhere product names are displayed and after catalog ingest is id-stable.

## Chosen Approach

Use a two-phase guarded correction pass rather than manual database edits.

- **Phase A: canonical identity correction.** Update reviewed normalization data, docs, tests, aliases, `products.brand_id`, and `products.product_line_id`. Do not write `products.name`.
- **Phase B: display-name cleanup.** Clean `products.name`, wire canonical brand/line hydration into product display DTOs, make catalog ingest id-stable, and refresh product/RAG chunks in one coordinated release window.
- Add a guarded Phase A correction script that performs retargeting in a deterministic order.
- Dry-run and review before applying any production write.

## Scope Boundaries

In scope:

- Phase A: correct the affected canonical brand/product-line mappings found after the first backfill.
- Retarget brand aliases so user-entered old names still resolve correctly.
- Update reviewed `clean_name` values in `data/product-catalog-normalization.json` where they duplicate the new brand/line.
- Delete old orphan identity rows only after verifying nothing references them.
- Document Phase B prerequisites for live `products.name` cleanup and central product display composition.

Out of scope:

- Broad catalog metadata cleanup unrelated to these identity rows.
- Dropping legacy `products.brand` / `products.category` columns; that remains Phase 7.
- Recategorizing products or changing recommendation/category spec properties.
- Rewriting realistic chat/eval fixtures that mention old user language such as `Gliss Kur`.
- Phase A: writing live `products.name`, changing display DTOs, refreshing product/RAG chunks, or changing catalog ingest upsert keys.

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

Phase A files:

- Modify: `data/product-catalog-normalization.json`
- Modify: `docs/product-identity-normalization.md`
- Create: `scripts/product-identity/correct-canonical-identities.ts`
- Modify: `package.json` script entry, e.g. `products:identity:correct`
- Modify tests:
  - `tests/product-catalog-normalization.test.ts`
  - `tests/product-identity-resolution.test.ts`
  - script dry-run/unit test if feasible without live Supabase

Phase B files, not part of the first correction apply:

- Modify or create: central product display helper, likely near `src/components/chat/product-display-model.ts` or `src/lib/product-catalog/`
- Modify product DTO/fetch paths so canonical `brands.name` and `product_lines.name` are available where needed:
  - chat product cards
  - profile product usage rows
  - product-intake product lookup/review displays
  - any recommendation/product matching payload that currently serializes only `products.name` plus legacy `products.brand`
- Modify `scripts/ingest-products.ts` so product ingest is id-stable before any live `products.name` cleanup.
- Refresh product list/RAG chunks after the live name cleanup.
- Add product display/helper tests.

## Phase A Correction Table

Phase A updates reviewed normalization `clean_name` and production `brand_id` / `product_line_id`. It does **not** write live `products.name`.

| Product row                                         | Active? | Current normalized identity | New normalized identity               | Reviewed `clean_name` in JSON         | Phase A writes `products.name`? |
| --------------------------------------------------- | ------- | --------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------- |
| `Gliss Kur Aqua Revive Conditioner`                 | yes     | `Gliss > Kur`               | `Schwarzkopf GLISS > Aqua Revive`     | `Conditioner`                         | no                              |
| `Monday Moisture Conditioner`                       | yes     | `Monday`                    | `MONDAY`                              | `Moisture Conditioner`                | no                              |
| `Balea Aqua Hyaluron 3in1`                          | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron 3in1`                  | no                              |
| `Gliss Ultimate Repair Sprüh-Conditioner`           | yes     | `Gliss`                     | `Schwarzkopf GLISS > Ultimate Repair` | `Sprüh-Conditioner`                   | no                              |
| `Balea Aqua Hyaluron 3 in 1`                        | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron 3 in 1`                | no                              |
| `Fructis Hair Food Aloe Vera`                       | yes     | `Fructis`                   | `Garnier > Fructis`                   | `Hair Food Aloe Vera`                 | no                              |
| `Fructis Hair Food Papaya`                          | yes     | `Fructis`                   | `Garnier > Fructis`                   | `Hair Food Papaya`                    | no                              |
| `Gliss Aqua Revive`                                 | yes     | `Gliss`                     | `Schwarzkopf GLISS > Aqua Revive`     | `4-in-1 Bonding Haarmaske`            | no                              |
| `Gliss Liquid Silk Glanz 4-in-1 Bonding Haarmaske`  | yes     | `Gliss`                     | `Schwarzkopf GLISS > Liquid Silk`     | `Glanz 4-in-1 Bonding Haarmaske`      | no                              |
| `Glisskur Liquid Silk`                              | no      | `Glisskur`                  | `Schwarzkopf GLISS`                   | `Liquid Silk`                         | no                              |
| `Wahre Schätze 1-Minute Haarkur Argan & Camelia Öl` | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `1-Minute Haarkur Argan & Camelia Öl` | no                              |
| `Wahre Schätze Avocado`                             | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Avocado`                             | no                              |
| `L’Oréal Elvital Öl Magique Jojoba`                 | yes     | `L’Oréal`                   | `L'Oréal Paris > Elvital`             | `Öl Magique Jojoba`                   | no                              |
| `L’Oréal Öl Magique Midnight Serum`                 | yes     | `L’Oréal`                   | `L'Oréal Paris > Elvital`             | `Öl Magique Midnight Serum`           | no                              |
| `Balea Aqua Hyaluron`                               | yes     | `Balea > Aqua`              | `Balea > Professional`                | `Aqua Hyaluron`                       | no                              |
| `Monday Haircare Volume Kraft & Fülle Shampoo`      | yes     | `Monday Haircare`           | `MONDAY`                              | `Volume Kraft & Fülle Shampoo`        | no                              |
| `Wahre Schätze Aktivkohle`                          | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Aktivkohle`                          | no                              |
| `Wahre Schätze Sanfte Hafermilch`                   | yes     | `Wahre Schätze`             | `Garnier > Wahre Schätze`             | `Sanfte Hafermilch`                   | no                              |
| `Serie Expert Metal DX Shampoo`                     | yes     | `L'Oreal Professionnel`     | `L'Oréal Professionnel > Metal DX`    | `Shampoo`                             | no                              |

Implementation notes:

- `clean_name` is reviewed normalization data only. It must not be treated as the live DB `products.name` until Phase B.
- The inactive `Glisskur Liquid Silk` row stays on brand-only `Schwarzkopf GLISS` in Phase A because `Liquid Silk` as both product line and `clean_name` would fail the duplicate-prefix validator.

## Task 1: Update Canonical Policy Docs

- [ ] Update `docs/product-identity-normalization.md` so `product_line` is a durable one-level family, not every nested range.
- [ ] Change examples from `Garnier > Fructis Hair Food` to `Garnier > Fructis` with `Hair Food ...` in `clean_name`.
- [ ] Add examples for `Schwarzkopf GLISS`, `MONDAY`, `L'Oréal Paris > Elvital`, `L'Oréal Professionnel > Metal DX`, and `Balea > Professional`.
- [ ] Document the display contract: product display title is `brand + optional line + clean product name`.
- [ ] Document that Phase A intentionally leaves live `products.name` unchanged because ingest still uses `(name, category)` and product chunks include `product.name`.

## Task 2: Update Reviewed Normalization Data

- [ ] Edit the 19 affected rows in `data/product-catalog-normalization.json`.
- [ ] Retarget aliases so old user/shop wording still resolves to the corrected identity.
- [ ] Add aliases for common spellings with explicit scope:
  - Brand-only aliases for `Garnier`: `Fructis`, `Garnier Fructis`, `Garnier Hair Food`, `Garnier Fructis Hair Food`, `Wahre Schätze`, `Wahre Schaetze`, `Garnier Wahre Schätze`.
  - Brand-only aliases for `Schwarzkopf GLISS`: `Gliss`, `GLISS`, `Gliss Kur`, `Glisskur`, `Schwarzkopf Gliss`, `Schwarzkopf GLISS`.
  - Brand-only aliases for `MONDAY`: `Monday`, `MONDAY`, `Monday Haircare`, `MONDAY Haircare`.
  - Documented intentional brand aliases for `L'Oréal Paris`: bare `L’Oréal` / `L'Oreal` for the affected Elvital oil rows; this is intentionally not used for `L'Oréal Professionnel`.
  - Brand/line or line-aware aliases for `L'Oréal Professionnel > Metal DX`: `L'Oreal Professionnel`, `L'Oréal Professionnel Paris`, `Serie Expert Metal DX`.
  - Brand/line aliases for Balea lines: `Balea Aqua` -> `Balea > Professional`; keep existing `Balea med` -> `Balea > Med`; keep existing `Balea Natural Beauty` -> `Balea > Natural Beauty`.
- [ ] Ensure shared aliases that could apply across several rows resolve at brand scope rather than conflicting line scope.
- [ ] Run `npm run products:identity:validate-reviewed`.

## Task 3: Add Guarded Phase A Correction Script

Create `scripts/product-identity/correct-canonical-identities.ts`.

- [ ] Dry-run by default.
- [ ] Require `--apply --confirm-project=pqdkhefxsxkyeqelqegq` for writes.
- [ ] Load `.env.local` and assert the Supabase URL targets project `pqdkhefxsxkyeqelqegq`.
- [ ] Verify current production rows match expected product IDs and old normalized identity before writing.
- [ ] Upsert required canonical brands and product lines.
- [ ] Retarget or replace stale aliases in a deterministic delete-then-insert/update order because the current generic apply path refuses alias re-pointing.
- [ ] Update affected `products.brand_id` and `products.product_line_id`.
- [ ] Assert the script does not write `products.name`.
- [ ] Delete old orphan identity rows only after verifying no references remain from `products`, `product_lines`, or `brand_aliases`.
- [ ] Print a before/after summary:
  - affected products
  - aliases retargeted
  - brands inserted/reused
  - lines inserted/reused
  - orphan brands/lines deleted or skipped

## Task 4: Phase A Tests And Dry Run

- [ ] Add normalization tests that fail if standalone `Fructis`, `Wahre Schätze`, `Glisskur`, `Monday Haircare`, or generic `L’Oréal` remain canonical brands for affected rows.
- [ ] Add brand-resolution tests for the corrected aliases.
- [ ] Add a test or assertion that no Phase A script path writes live `products.name`.
- [ ] Add script dry-run tests if the current test harness can mock Supabase cleanly; otherwise keep logic units exported and test the plan builder.
- [ ] Run:

```bash
npm run products:identity:validate-reviewed
npx tsx --test tests/product-catalog-normalization.test.ts tests/product-identity-resolution.test.ts <script-plan-test>
npm run products:identity:correct
```

## Task 5: Phase A Review And Production Apply Gate

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
  - no live `products.name` value changed.
- [ ] Record the production correction in the plan or PR handoff.

## Phase B Follow-Up: Live Product Name Cleanup

Do not start Phase B until Phase A has shipped or is deliberately bundled into the same release window with the prerequisites below.

- [ ] Make `scripts/ingest-products.ts` id-stable so future imports update existing products even if `products.name` changes.
- [ ] Locate current product display helpers and card formatting.
- [ ] Add or reuse one central helper that composes `brand + optional line + name` without duplicating repeated tokens.
- [ ] Ensure canonical `brand` and `product_line` data is available in DTOs that feed:
  - chat product cards
  - product detail drawer/popover
  - profile/routine owned product rows
  - product-intake lookup/review displays
  - product matching/recommendation payloads where display titles are serialized
- [ ] Clean affected live `products.name` values only after the helper and DTO hydration are in place.
- [ ] Refresh product list/RAG chunks after live `products.name` cleanup.
- [ ] Add display helper tests:
  - `Garnier + Fructis + Hair Food Aloe Vera` -> `Garnier Fructis Hair Food Aloe Vera`
  - `Balea + Professional + Aqua Hyaluron 3in1` -> `Balea Professional Aqua Hyaluron 3in1`
  - `MONDAY + null + Volume Kraft & Fülle Shampoo` -> `MONDAY Volume Kraft & Fülle Shampoo`
  - `L'Oréal Paris + Elvital + Öl Magique Jojoba` -> `L'Oréal Paris Elvital Öl Magique Jojoba`

## Verification

Automated:

- `npm run products:identity:validate-reviewed`
- Product normalization tests
- Brand-resolution tests
- Phase A correction script dry-run/unit tests
- `npm run ci:verify` or the current repo-wide verification command before final handoff, unless the branch owner explicitly scopes a narrower run and documents why
- `git diff --check`
- Prettier on changed files

Manual/read-only production checks before apply:

- List the dry-run correction table and compare it to this plan.
- Confirm no unexpected product IDs are included.
- Confirm all affected products have current production names/brands/categories matching the reviewed baseline.

Manual/read-only production checks after apply:

- Brand search for `Fructis`, `Wahre Schätze`, `Glisskur`, `MONDAY Haircare`, `Elvital`, `Balea Aqua` returns corrected options.
- Sample product cards are unchanged in live product name text for Phase A, while brand lookup/search uses corrected canonical identities.
- `products.brand` and `products.category` legacy fields remain unchanged.
- `products.name` values remain unchanged in Phase A.

## Execution Handoff

Recommended next skill: `branch-gate`, then subagent-driven implementation if available in the session.

Use a new stacked branch/worktree from `codex/product-intake-phase-5` so PR #181 remains reviewable and this canonical correction can be reviewed separately.
