# Leave-In calibration batch v2-t20 — apply runbook

**Status: prepared, not applied.** Nothing in this worktree has written to the database. Every step below that touches production has its own gate, and approving one gate does not approve the next.

- Batch: `leave-in-research-calibration-v2-t20`
- Executor migration: `supabase/migrations/20260929214731_catalog_enrichment_leave_in_calibration_v2_t20_executor.sql` (RPC `public.apply_catalog_enrichment_leave_in_calibration_v2_t20`)
- Manifest: `plans/leave-in-moisture-balanced/leave-in-research-enrichment-manifest-v2-t20.json`
- Production delta and reasoning: `plans/leave-in-moisture-balanced/t20-catalog-delta.md`
- Model: the batch-v1 lane (`plans/leave-in-apply/apply-runbook.md`, migration `20260914163000`)

| Pin | Value |
|---|---|
| Batch fingerprint | `059cdca2fb98bde5b4c3b70d0920e93f78bb22eb993f0f207e669b848b1ddd4c` |
| Cohort-index (content) fingerprint | `3a63acc89c081080bda4e4157254836103336a9490d067dd3cf148203727baed` |
| Reviewer | `nick` |

## 1. What the batch does

Batch v1 applied the v1.0 projection to nine products on 2026-09-14. Standard v1.1 (T20) and the AD-3a revision change **three `product_leave_in_specs` columns on five of those products, and nothing else**:

| Product | `product_id` | Columns written |
|---|---|---|
| EVO Head Mistress | `118ebae1-b7a9-4a89-a2ff-6c31df28c4dc` | `functional_benefits` |
| Gliss Express-Repair | `5dc2fae3-a0ca-4e6c-9c30-02dd192772f0` | `care_direction`, `care_benefits`, `functional_benefits` |
| Redken Extreme Anti-Snap | `2b7db7e3-2058-4178-8a03-7d05f4a1d447` | `functional_benefits` |
| Olaplex No.6 | `4e99706a-2232-4ee6-ba1b-9ca1029a7364` | `care_direction`, `care_benefits`, `functional_benefits` |
| Neqi Diamond Glass | `42a2fe20-bd7e-49a3-a880-8ae89015a5c9` | `care_direction`, `care_benefits`, `functional_benefits` |

The batch has **no eligibility delete and no eligibility write**, no fit-spec write and no `products` update. Each manifest plans exactly one `product_leave_in_specs` upsert. The executor goes further than the manifest: it only `UPDATE`s the declared columns, and it refuses the batch unless all of the following hold:

- the declared columns are exactly the projected columns that differ from the pinned state;
- every declared column is one of the three allowlisted ones;
- the projected fit row, eligibility set and `suitable_thicknesses` equal the pinned ones;
- after the write, the eligibility row count and set are unchanged.

The other four calibration products (alverde 7in1, ISANA Hyaluron, Cantu, Curlsmith) have no field change and are not in the batch.

## 2. Fingerprint guard, in brief

Each manifest's `target_fingerprint` pins the product's live state as read on 2026-09-29, which is batch v1's applied output. It covers the product columns, the full spec row, the fit row and the eligibility set. The fingerprint is the same `buildLeaveInCalibrationSnapshot` that batch v1 used. The executor re-reads that snapshot under `FOR UPDATE` row locks and refuses with `target drifted since review` if anything moved. Any regeneration (`generate:v2-t20`) changes both pinned fingerprints, and the RPC then refuses the batch until a new reviewed migration pins the new values. That refusal is the guard working, not a defect.

Lock order inside the RPC:

1. the shared cross-executor lock `hashtextextended('catalog-enrichment:product-apply', 0)`, taken first and shared with `20260914170000`;
2. the batch lock;
3. a per-product lock;
4. row locks on `products`, then the spec row, the fit row and the eligibility rows.

## 3. The sequence — every Nick gate marked

| # | Step | Writes prod? | Gate |
|---|---|---|---|
| 0 | Read-only checks: validate, preflight, tests | no | none |
| 1 | Merge the PR | no | **Nick: "merge it"** |
| 2 | Apply executor migration `20260929214731` | schema only, zero rows | **Nick authorizes `apply_migration`** |
| 3 | Preflight — must be green on a first apply | no | **Nick reads the output** (go / no-go for step 4) |
| 4 | Apply | yes | **Nick: `--apply --confirm …`** |
| 5 | Verify | no | **Nick reads the output** (closes the batch) |

**Cross-branch notes (recorded 2026-09-29, no code change):**

- **Migration-ordering allowlists.** The Kevin Murphy branch adds migration `20260929120000`. Whichever branch merges second must add the other's version to the later-version allowlists in the discovery migration tests (`tests/discovery-call-sheets-migration.test.ts`, `…-call-decisions-per-item-…`, `…-admin-item-usage-styling-…`, `…-intake-frequency-heat-…`).
- **Concurrent v1/v2 applies.** v2-t20 takes the shared `catalog-enrichment:product-apply` advisory lock before any row lock, but the batch-v1 executor (`20260914163000`) does not take it yet. That changes when the separate v1-hardening session lands. Until then, calibration applies stay **operator-sequenced**: never run a v1 replay and the v2-t20 apply at the same time.

Before step 4: Gliss and Neqi carry T20 confidence `low` with the review triggers `moisture_leg_subordinate` and `glycol_only_leg`. Nick accepted the four flips on 2026-09-29. Clearing those two `care_direction` rows in the Lab (now on the v1.1 fixture) is the review record and is recommended before the apply. It is not a technical precondition.

### Step 0 — read-only

```bash
npm run products:intake:leave-in-calibration:validate:v2-t20
npm run products:intake:leave-in-calibration:preflight:v2-t20
npm run test:catalog-enrichment:leave-in-calibration:v2-t20
```

`generate:v2-t20` is read-only (SELECT only), but running it re-pins the fingerprints. Run it only to cut a new batch, never just to refresh the existing one.

### Step 2 — executor migration → prod

The migration creates two functions and nothing else: the RPC and the helper `public.leave_in_calibration_v2_t20_comparable(jsonb)`. It reuses batch v1's helpers (`leave_in_calibration_current_target`, `…_normalize_target`, `…_sorted_text_array`), which are already live. **Zero data changes.** Grants go to `service_role` only.

Timestamp `20260929214731` was chosen to avoid collisions. The latest committed migration is `20260929120000_kevin_murphy_young_again_oil_recategorization.sql`, and a hardening session may be adding more; confirm there is no collision at merge time.

### Step 3 — preflight

First establish the mode from the ledger:

```sql
select product_key, product_id, reviewed_by, batch_fingerprint, content_fingerprint
from catalog_enrichment_applied_items
where batch_id = 'leave-in-research-calibration-v2-t20'
order by product_key;   -- 0 rows = first apply · 5 rows = replay · 1-4 = resolve by hand
```

| | **First apply** | **Replay** |
|---|---|---|
| Ledger for `…-v2-t20` | empty | all 5 products |
| Preflight `ok` | **must be `true`** | `false` is expected |
| `target fingerprint is stale` | must not appear | expected: the previous apply changed the rows |
| `no spec column changes — the product has no delta` | must not appear | expected: live already equals the projection |
| Any other error or invariant violation | blocks | blocks |
| What proves correctness | the green preflight | the RPC's own re-assertion (`conflicting or partial retry` on divergence) |

```bash
npm run products:intake:leave-in-calibration:preflight:v2-t20
```

The recorded dry run of 2026-09-29, read-only against production, is in `plans/leave-in-moisture-balanced/preflight-output-v2-t20.json`. It shows `ok: true`, 5/5 products ok, 0 stale fingerprints, 0 publication blockers, 0 invariant violations and 0 eligibility operations. The apply dry run classifies the run as `first_apply`.

### Step 4 — apply

```bash
npm run products:intake:leave-in-calibration:apply:v2-t20 -- \
  --apply \
  --confirm \
  --confirm-batch leave-in-research-calibration-v2-t20 \
  --reviewed-by nick \
  --reviewed-head <40-char-sha-of-the-reviewed-commit> \
  --expect-migration=applied \
  --expected-batch-fingerprint 059cdca2fb98bde5b4c3b70d0920e93f78bb22eb993f0f207e669b848b1ddd4c \
  --expected-content-fingerprint 3a63acc89c081080bda4e4157254836103336a9490d067dd3cf148203727baed
```

Without `--apply` the script only prints a dry run. With `--apply` it refuses unless all of the following hold:

- every flag is present and exact;
- the run classifies as first apply or replay;
- the built package matches both the reviewed fingerprints and the migration-pinned ones;
- the checkout is the exact clean reviewed head.

It then calls the RPC once. The RPC runs per product, all in one transaction:

1. checks: null-safe reviewer, fingerprint, header and approved key/id mapping;
2. locks;
3. ledger replay check;
4. package self-consistency (declared delta, fit, eligibility and thicknesses unchanged);
5. drift guard;
6. AD-6 check;
7. `UPDATE` of the declared columns;
8. post-write check: eligibility unchanged, full state equals the batch, and written arrays in projection order;
9. ledger insert.

### Step 5 — verify

```bash
npm run products:intake:leave-in-calibration:verify:v2-t20
npm run products:intake:leave-in-calibration:preflight:v2-t20   # now stale BY DESIGN
```

`verify` checks that all 12 projected spec columns, the fit row, the eligibility set and `suitable_thicknesses` equal the full v1.1 projection for each product.

```sql
-- Expect 5 rows; Gliss/Olaplex/Neqi balanced, EVO balanced, Redken protein, none with moisture_softness.
select p.name, s.care_direction, s.care_benefits, s.functional_benefits
from products p join product_leave_in_specs s on s.product_id = p.id
where p.id in ('118ebae1-b7a9-4a89-a2ff-6c31df28c4dc','5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
               '2b7db7e3-2058-4178-8a03-7d05f4a1d447','4e99706a-2232-4ee6-ba1b-9ca1029a7364',
               '42a2fe20-bd7e-49a3-a880-8ae89015a5c9');

-- Eligibility untouched: expect 4 / 6 / 10 / 3 / 6 rows (EVO / Gliss / Redken / Olaplex / Neqi).
select product_id, count(*) from product_leave_in_eligibility
where product_id in ( /* the five ids */ ) group by product_id;
```

## 4. Rollback — restore target is batch v1

The executor applies the whole batch in one transaction. A failed apply writes nothing, so it needs no rollback; the PGlite harness asserts that a refused batch leaves zero ledger rows and no spec change.

Rollback is only for a successful apply that Nick later wants undone. The restore target is **batch v1's written values**: the `category_payload` in `plans/leave-in-apply/leave-in-research-enrichment-manifest.json`, which is also each v2 manifest's `current_catalog_target` / `t20_delta.before`. In batch v1's stored order:

```sql
update product_leave_in_specs set functional_benefits = array['moisture_softness','smooth_anti_frizz']
  where product_id = '118ebae1-b7a9-4a89-a2ff-6c31df28c4dc';                    -- EVO
update product_leave_in_specs set care_direction = 'moisture',
  care_benefits = array['moisture','anti_frizz'],
  functional_benefits = array['moisture_softness','smooth_anti_frizz','heat_protect']
  where product_id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';                    -- Gliss
update product_leave_in_specs set
  functional_benefits = array['moisture_softness','smooth_anti_frizz','heat_protect','repair_support']
  where product_id = '2b7db7e3-2058-4178-8a03-7d05f4a1d447';                    -- Redken
update product_leave_in_specs set care_direction = 'moisture',
  care_benefits = array['moisture','anti_frizz'],
  functional_benefits = array['moisture_softness','smooth_anti_frizz','heat_protect']
  where product_id = '4e99706a-2232-4ee6-ba1b-9ca1029a7364';                    -- Olaplex
update product_leave_in_specs set care_direction = 'moisture',
  care_benefits = array['moisture','anti_frizz'],
  functional_benefits = array['moisture_softness','smooth_anti_frizz','heat_protect']
  where product_id = '42a2fe20-bd7e-49a3-a880-8ae89015a5c9';                    -- Neqi
-- Then, not optional:
delete from catalog_enrichment_applied_items
where batch_id = 'leave-in-research-calibration-v2-t20';
```

There is nothing to roll back for eligibility, fit or `products`, because the batch never writes them.

**The ledger and the rollback interact.** The rules are the same as batch v1 §8:

- Roll back the rows but leave the ledger rows: the next run classifies as a replay, re-asserts the live state, finds it reverted, and raises `conflicting or partial retry`. It does not silently re-apply.
- Delete only some of the ledger rows: the CLI reports `partial state, resolve by hand` and the RPC raises `partial ledger state`.
- Delete all five ledger rows and roll back all five products: preflight goes green again, because every `target_fingerprint` matches byte for byte. That is the proof the rollback is exact.

Rolling back one product alone is possible (restore that product's row and delete its ledger row), but it leaves a partial ledger. So a single-product rollback commits you to rolling back the rest, or to cutting a new batch.

## 5. Evidence

- `tests/leave-in-calibration-v2-t20-executor-postgres.test.ts` — PGlite, running the real v1 and v2-t20 migrations. It covers: happy path, replay, hand-reverted replay, ledger content conflict, partial ledger, drift (a product column and an eligibility row), reviewer / NULL / fingerprint / unapproved payload, the null-safe guard red proof, eligibility / fit / thickness / non-allowlisted / undeclared / empty / unmapped refusals, an eligibility change injected during the apply, the real curated-publication gate, and the pins.
- `tests/product-intake-catalog-enrichment-leave-in-calibration-v2-t20.test.ts` — manifest shape, package pins, package refusals, preflight green and stale paths, flag gate, run classification, the single RPC call, and verify.
