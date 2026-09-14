# Leave-In Calibration — Apply Runbook

**Status:** prepared, **not applied**. Review pending.
**Writes performed while producing this package: none.** Every Supabase access in
generate / validate / preflight is a `SELECT`.
**Supabase project:** `pqdkhefxsxkyeqelqegq` (production).
**Batch:** `leave-in-research-calibration-v1`
**Manifest:** `plans/leave-in-apply/leave-in-research-enrichment-manifest.json`
**Preflight receipt:** `plans/leave-in-apply/preflight-output.txt`
**Executor migration:** `supabase/migrations/20260914163000_catalog_enrichment_leave_in_calibration_v1_executor.sql` (functions only, zero data changes)
**Stage-5 protocol batch (review artifact, not yet routed):** `plans/leave-in-apply/S5-14-leave-in-calibration.json` — see §6 step 4
**Lane:** shared `existing_product_enrichment` catalog-enrichment contract
(`src/lib/product-intake/catalog-enrichment/index.ts`) — Nick's 2026-09-14 ruling 1.

Scope: nine already-catalogued leave-in products get the frozen
`leave-in-inci-v1.0` production projection. Nothing else. The six products that
are not in the catalog, the EVO identity question, the duplicate Cantu row and
the Kevin Murphy boundary item all stay out (see `apply-package.md`).

---

## 1. What the batch does

| Slot | Product | `update_product` | eligibility DELETE | eligibility upsert | specs / fit upsert |
| --- | --- | --- | --- | --- | --- |
| 01 | alverde Leave-In Sprühkur Express 7in1 | yes | 4 | 4 | 1 / 1 |
| 02 | ISANA PROFESSIONAL Leave-In Hyaluron & Panthenol | yes | 2 | 2 | 1 / 1 |
| 03 | Cantu Leave-In Repair Cream | — | 2 | 2 | 1 / 1 |
| 05 | EVO Head Mistress | yes | 4 | 4 | 1 / 1 |
| 06 | Curlsmith Hydrate & Plump Leave-In | yes | 2 | 2 | 1 / 1 |
| 08 | Gliss Ultimate Repair Sprüh-Conditioner | yes | 5 | 6 | 1 / 1 |
| 09 | Redken Extreme Anti-Snap | yes | 0 | 10 | 1 / 1 |
| 10 | Olaplex No.6 Bond Smoother | yes | 7 | 3 | 1 / 1 |
| 13 | Neqi Diamond Glass Ultimate Styling Spray | yes | 1 | 6 | 1 / 1 |
| | **total** | **8** | **27** | **39** | **9 / 9** |

57 upsert rows, 27 deletes, across 9 products.

### Per-product delta headlines

Field-by-field current/projected values are in `product-mapping.json`; the
user-visible or matcher-visible changes are:

- **01 alverde** — `suitable_thicknesses` fine → normal + coarse (opposite
  audience); `roles` extension_conditioner → replacement_conditioner;
  `fit.conditioner_relationship` booster_only → replacement_capable;
  `care_benefits` narrows to moisture only; `repair_support_level` medium → low.
- **02 ISANA** — **format `lotion` → `spray`** (user-visible);
  `suitable_thicknesses` fine → coarse; roles → replacement_conditioner.
- **03 Cantu** — `care_benefits` loses repair and anti_frizz (moisture only);
  `repair_support_level` medium → low; eligibility 4 → 2. ⚠️ Contradicts the
  German-market "Repariert geschädigtes Haar" claim; the research record flags
  the source INCI as possibly the **US variant**
  (`identity_status: provisional_formula_conflict`).
- **05 EVO** — thicknesses fine → normal + coarse; weight light → medium; roles →
  replacement_conditioner + styling_prep; application_stage gains pre_heat and
  post_style. ⚠️ **Identity unresolved**: catalog EAN `9349769020791` vs research
  GTIN `9349769013144`. The row is in the batch; do not apply slot 05 until Nick
  settles the identity question.
- **06 Curlsmith** — **format `lotion` → `cream`**; thicknesses normal → coarse;
  weight medium → rich; roles gains styling_prep.
- **08 GLISS** — ⚠️ largest semantic change: `care_direction` protein → moisture,
  `repair_support_level` high → low, repair removed from care and fit benefits —
  for a product named "Express-Repair". Roles styling_prep → replacement_conditioner.
- **09 Redken** — **format `lotion` → `spray`**; **`provides_heat_protection`
  false → true** (new claim, gains `pre_heat_application`); eligibility 4 → 10.
  The new heat claim makes `pre_heat_protection` a required protocol role it has
  no row for — see §4.
- **10 Olaplex** — ⚠️ `repair_support_level` high → low, repair removed, for a
  product named "Bond Smoother"; `care_direction` balanced → moisture; roles
  loses styling_prep; eligibility 7 → 3.
- **13 Neqi** — fills four NULL columns (`care_direction`,
  `repair_support_level`, `plan_roles`, `functional_benefits`);
  `heat_activation_required` true → false; roles gains replacement_conditioner.
  Has **no protocol rows at all** today — see §4.

Eight of the nine are live and `is_chaarlie_recommended = true`, so the apply
changes active recommendations the moment it runs. Neqi is the exception.

---

## 2. The eligibility DELETE, and why it exists

The production projection is **recommended-only**: it lists the eligibility rows
a product should have, not the rows it should gain. So the projection *replaces*
the live set. Any live row the projection no longer contains has to be removed,
or the product keeps being recommended for a context the research has dropped.

Nick's ruling 2 gave the lane that capability. The contract's `delete` operation
(`src/lib/product-intake/catalog-enrichment/index.ts`) is deliberately narrow:

1. **Table allowlist** — `product_leave_in_eligibility` only. Any other table is
   rejected as "not an allowlisted catalog delete target".
2. **Full natural key** — every delete row must carry exactly
   `product_id + thickness + need_bucket + styling_context`. A partial key, an
   extra key or an empty value all fail, so a delete can never widen into a set
   operation.
3. **Lifecycle** — only `existing_product_enrichment` may plan deletes.
4. **Own target only** — every delete row's `product_id` must equal the
   manifest's `target_product_id`.
5. **No self-contradiction** — a row may not be both deleted and upserted in the
   same manifest; duplicates within one delete op are rejected.

`orderCatalogEnrichmentOperations()` fixes execution order: the product row
first, then every delete, then every upsert — **delete-then-upsert per product**,
so a replaced set is cleared before the projection's rows land. Preflight prints
that order per product and the delete rows verbatim.

---

## 3. Fingerprint guard

Each manifest pins `target_fingerprint` = `catalogEnrichmentFingerprint()` over a
narrow snapshot of exactly the rows the apply reads or writes:

```
{ product_id,
  products:                     name, brand, category_key, origin, is_active,
                                lifecycle_status, is_chaarlie_recommended,
                                suitable_thicknesses, image_url
  product_leave_in_specs:       all 15 live columns (incl. heat_protection_max_c)
  product_leave_in_fit_specs:   weight, conditioner_relationship, care_benefits
  product_leave_in_eligibility: sorted natural keys }
```

`product_application_protocols` is deliberately **not** in it. The enrichment
apply neither reads nor writes protocol rows, and step 2 below writes one
*before* this apply — including protocols would make the sequence invalidate its
own pinned batch. The protocol precondition is checked live instead (§4).

The snapshot is embedded in each manifest as `current_catalog_target`, so the
guard is auditable without a database, and the executor rebuilds the same shape
in SQL (`public.leave_in_calibration_current_target`) and compares it as `jsonb`.
Preflight does the same check client-side. Any drift in that set →
`target fingerprint is stale` client-side and
`leave-in calibration target drifted since review` in the RPC.

Current batch fingerprints (pinned in the executor migration):

- batch: `eaffe5481438c6639de05040c48937a17280fc6c2e9e192f64d3d8d569979ba6`
- cohort index: `78260563c2e818f23a14b74096c7b7c0e423a176cbe8327a93651357df98c06d`

**Regenerating the manifest changes both, and the RPC then refuses the batch.**
That is the guard working: a new batch needs a new reviewed migration. Never
hand-edit a fingerprint.

---

## 4. Hard ordering: the protocol step must run first

`assert_personal_plan_curated_publication` is a DEFERRABLE constraint trigger on
`products` and `product_leave_in_specs`. For a curated-active **or** recommended
product it requires that every role derived from
`product_leave_in_specs.plan_roles` (with `pre_heat_application` mapped to
`pre_heat_protection`) already has a `product_application_protocols` row whose
`guidance_payload_v2` is a valid, unblocked product pointer.

This apply changes `plan_roles`. For **Redken** it adds `pre_heat_application`,
and Redken has no `pre_heat_protection` row — so the enrichment transaction would
be **rejected at COMMIT**. Verified read-only against production: of the nine, only
Redken's `pre_heat_protection` lacks a valid V2 pointer. Neqi is
`origin = user_submitted` and not recommended, so the validator returns early and
Neqi is not a blocker for this apply.

The enrichment preflight now fails closed on exactly this, so the dependency is
caught before the apply rather than at COMMIT:

```
slot-09  publication dependency: role "pre_heat_protection" has no protocol row
         with a valid guidance_payload_v2 pointer; the deferred
         curated-publication trigger will reject this apply
```

Recorded preflight (2026-09-14, `plans/leave-in-apply/preflight-output.txt`):
`ok: false`, 9/9 fingerprints current, 0 stale, 8/9 products clear,
**1 publication blocker (slot-09)**, 57 upsert rows, 27 delete rows. It turns
green once steps 2 and 2b below are done — a test pins that transition.

---

## 5. `products.suitable_thicknesses` is carried outside `planned_operations`

Eight of nine products change `suitable_thicknesses`. The shared contract's
`update_product` operation is pinned to exactly `{type, table}` and carries no
payload, so each manifest carries

```json
"products_field_updates": {
  "suitable_thicknesses": { "current": [...], "projected": [...],
                            "carried_outside_planned_operations": true }
}
```

and the executor reads the value from the apply package's `suitable_thicknesses`
field. **Flagged, not forced** — moving it inside the operation is a separate
contract change to the `update_product` allowlist.

---

## 6. The full sequence, with every Nick-gate marked

Steps 0, 3, 5 and 7 are read-only; step 1 is repo-only. Steps 2, 4, 4b, 6 and 8
touch production and each needs its own explicit authorization — one gate never
carries to the next.

| # | Step | Writes prod? | Gate |
| --- | --- | --- | --- |
| 0 | Read-only checks (validate / preflight / tests) | no | none |
| 1 | Merge the PR | no | **Nick: "merge it"** |
| 2 | Apply the executor migration (`20260914163000`) | schema only, zero rows | **Nick authorizes `apply_migration`** |
| 3 | Stage-5 protocol manifest prepared (review artifact) | no | none |
| 4 | Redken `pre_heat_protection` protocol | yes | **Nick: `--apply --confirm` on batch `S5-14-leave-in-calibration`** |
| 4b | Stage-5 V2 pointer + reverse-coverage entry | yes | **Nick: separate apply** |
| 5 | Enrichment preflight — green on a first apply; stale-only on a replay (§6 steps 5/6) | no | none |
| 6 | Enrichment apply | yes | **Nick: `--apply --confirm`** |
| 7 | Verify scripts | no | none |
| 8 | Optional EVO `add_identifiers` | yes | **Nick, separate decision (§10)** |

### Step 0 — read-only

```bash
npm run products:intake:leave-in-calibration:generate    # rebuild from projection + live rows (SELECT only)
npm run products:intake:leave-in-calibration:validate    # offline schema validation
npm run products:intake:leave-in-calibration:protocol-batch  # rebuild the Stage-5 manifest (review artifact)
npm run products:intake:leave-in-calibration:preflight | tee plans/leave-in-apply/preflight-output.txt
npm run test:catalog-enrichment:leave-in-calibration
```

### Step 2 — executor migration → prod

`supabase/migrations/20260914163000_catalog_enrichment_leave_in_calibration_v1_executor.sql`
creates five functions and nothing else: the RPC
`public.apply_catalog_enrichment_leave_in_calibration_v1` plus four helpers
(`leave_in_calibration_sorted_text_array`, `…_current_target`,
`…_normalize_target`, `…_applied_state`). **Zero data changes.** It reuses the
existing `public.catalog_enrichment_applied_items` ledger created by the Heat
executor. Apply it the way the repo applies reviewed migrations, with Nick's
explicit authorization.

### Step 4 — Redken's `pre_heat_protection` protocol — **DECIDED: live carry-forward, implemented in this branch**

**Decision (2026-09-14): the V2 record arrives as a live protocol carry-forward,
mirroring the k18 precedent. Done in this branch; only the production write of the
protocol row itself is still gated.**

Implemented here:

- `data/catalog-enrichment/personal-plan-stage5-v1/S5R-05-leave-in-calibration-protocol-carry-forward.json`
  — new reviewed manifest carrying the authored Redken `pre_heat_protection`
  payload **verbatim** from `S5-14-leave-in-calibration.json`, alongside its
  machine-derived V2 pointer.
- `scripts/product-intake/catalog-enrichment/stage5-v2-generate.ts` — one new
  schema + one source function (`leaveInProtocolCarryForwardSources`), modelled
  line-for-line on `k18LiveProtocolSource`: it rebuilds the pointer from the
  authored payload and refuses the file on any mismatch
  (`leave_in_carry_forward_v2_pointer_mismatch`, `…_scope_mismatch`). The rows are
  layered onto the frozen baseline exactly like the k18 row.
- The artifact gains **exactly one entry** — 309 → 310 rows, `leave_in` 79 → 80,
  `composable_rows` 310, `blocked_rows` 0, `products` unchanged at 240 (Redken was
  already present via its `post_wash_leave_in` row). The audit now reports
  "2 live protocol carry-forwards".
- `application-pointer-baseline-2026-08-12.json` and the three manifests pinning
  its `sha256` (`leave-in-use-cases-2026-08-14.json`, `S5-22-…`, `S5-23-…`) are
  **byte-unchanged**, verified before/after and now locked by a regression test in
  `tests/personal-plan-stage5-v2-activation.test.ts`.

The manifest holds a list, so Neqi's rows join the same file — no further code
change — once they are unblocked (see step 4b).

#### Why not the other routes — measured, not assumed

The three authored rows are prepared in the Stage-5 protocol-research shape and
validated through that lane's own validator:

- manifest: `plans/leave-in-apply/S5-14-leave-in-calibration.json`
- built apply batch + fingerprint: `plans/leave-in-apply/stage5-protocol-batch.json`
  (`86b51da65bccc2ca56f0e5dd241b7349a3cca038b092e58f172b0f3513c3868f`, 1 applicable protocol)

**Neither of the two obvious Stage-5 extension points accepts this batch as-is**
— which is what sent the decision to the carry-forward above. Both were tried and
measured, not assumed:

| Route | Why it does not work |
| --- | --- |
| `data/catalog-enrichment/personal-plan-stage5-v1/protocol-research/` | Baseline-pinned. `stage5-v2-generate.ts:246` compares that directory's exact file set + sha256 against `application-pointer-baseline-2026-08-12.json`. Dropping the file in makes `npm run personal-plan:application-audit` throw `application_pointer_baseline_source_fingerprint_mismatch` — confirmed: the audit passes on a clean tree (309 rows) and fails with the file present. |
| `data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/` | Every item requires an `expected_disposition` the preflight matches against a live `personal_plan_product_search_dispositions` row. Redken has none. That lane supersedes a *parked* product; it is not a way to add a protocol to a never-parked one. |

There is a second, downstream consequence every route has to answer: the V2 pass
(step 4b) enforces reverse coverage — `preflightStage5V2ApplicationArtifact`
requires every active curated protocol row to appear in
`application-pointer-backfill.json`, so Redken's new row also needs a reviewed
entry there, and that artifact's bytes are pinned by
`tests/personal-plan-stage5-v2-activation.test.ts`. **The carry-forward above
satisfies exactly this**, and that pin has been refreshed to the +1 artifact
(`7afa162b…`).

##### Re-baseline was ruled first — and then measured as not implementable

Nick picked option 1 (re-baseline). Reading the lane end to end before executing
found that option 1, **as it was written above, cannot work**. Four findings, each
reproduced against this tree rather than argued:

1. **There is no re-baseline mechanism.** `stage5-v2-generate.ts` reads the
   baseline verbatim (`baseline: baselineText`, line 240) and writes it back
   unchanged (line 367) — the write is a no-op. The code that *derived* the
   baseline from the source files (`loadRows`) was deleted in #406
   (`53c15176`), the same PR that froze the file. `--check` only compares. There
   is no `--rebaseline` flag and no dated-baseline convention: the filename is
   pinned as a `z.literal(...)` in `leave-in-use-case-manifest.ts` and
   `stage5-protocol-amendments.ts`, so a new dated file is itself a code change.
2. **The baseline is no longer byte-reproducible.** Restoring the #406-era
   derivation and running it over today's source files reproduces 272/272 keys
   but **not** the bytes: `family_templates` (`SHARED_APPLICATION_TEMPLATES_V2`)
   has drifted since 2026-08-12, and two rows' `after_visible_step_fingerprint`
   changed (Redken One United `post_wash_leave_in`, Pantene Pro-V Miracles 7in1
   `post_wash_leave_in`). Re-baselining would silently fold that unrelated drift
   into the frozen review anchor.
3. **`protocol-research/` cannot carry this row anyway.** The historical loader
   skips `leave_in`, `mask`, `oil` and `deep_cleansing_shampoo` in that directory
   (`bundledCategories`); all 61 leave-in baseline rows come from
   `exact-bundles/`. Dropping `S5-14-leave-in-calibration.json` into
   `protocol-research/` adds a `source_files` entry and **zero** items.
4. **Re-baselining forces hand-edited fingerprints.** Three reviewed manifests
   pin `baseline.sha256 = db2e7bbe…`:
   `leave-in-use-cases-2026-08-14.json`, `protocol-amendments/S5-22-…json` and
   `protocol-amendments/S5-23-…json`. A new baseline makes all three throw
   (`…_baseline_fingerprint_mismatch`). Re-pointing them is exactly the
   hand-edit this lane forbids, and it would silently re-approve S5-22/S5-23
   against content Nick never reviewed.

**The leave-in use-case override lane was also measured, and is ruled out on
product grounds, not schema grounds.** Redken *is* already a reviewed leave-in in
the baseline (`reviewed_product_ids` contains it, no override yet), so an override
adding a `pre_heat_protection` use parses. But `buildLeaveInUseCasePointerDelta`
synthesizes its own generic payload instead of accepting the authored one:

| | authored (S5-14, §7.3) | use-case lane would emit |
| --- | --- | --- |
| steps | `apply-pre-heat`, `tool-pre-heat` | `apply` (one generic step) |
| `reapplication` | `each_separate_heat_event` | `none` |
| `applicationArea` | `lengths_ends` | `all_hair` / `root_to_tip_hair` |
| `source_fingerprint` | `8e1b1bbc…` | `5ba06b12…` |

Losing `each_separate_heat_event` drops the "Vor jedem weiteren Hitzestyling
erneut auftragen" instruction from a heat-protection row — a safety-relevant
regression, not a formatting one. And the fingerprints differ, so step 4b would
fail closed with `source_protocol_diverged:<key>` against the row the S5-14 batch
writes (`stage5-v2-application.ts:248`).

##### The two remaining alternatives, and why the carry-forward beat them

- **Generalize the amendment lane to `leave_in`** — widen
  `stage5ProtocolAmendmentManifestSchema`'s `category_key` and make
  `expected_disposition` optional for a never-parked product. Bigger blast
  radius: that schema also drives the disposition-resolution batch.
- **Give Redken a disposition row first**, then use the amendment lane as
  designed. Writes a production catalog row that exists only to be released again.

The carry-forward was the only route satisfying all three constraints at once —
one added entry, no hand-edited fingerprint, authored copy preserved — which is
why it was taken.

**The repo side of this is now done; the production write is not.** The V2 record
exists in the reviewed artifact, but the enrichment apply (step 6) still cannot run
until the protocol **row** lands in production via steps 4 and 4b: §4 shows the
deferred curated-publication trigger rejects it at COMMIT without that row, the
preflight fails closed on it, and the Postgres harness proves both halves — the
apply is rejected while the row is missing and commits once it exists. The
preflight staying red until then is expected, not a defect.

Neqi's two rows are separately blocked in the same manifest with the lane's own
`research_status: "blocked_identity_or_commercial"`: the Stage-5 preflight
refuses any product whose `origin` is not `curated`
(`product_origin_mismatch`), and Neqi's catalog row is `user_submitted`. Their
authored copy is preserved in the enrichment manifest's `authored_protocols` and
in §7. Unblocking Neqi is a third, independent decision (leave it — Neqi is not
recommended, so nothing breaks; or promote its `origin`, which also changes its
fingerprint and re-subjects it to the publication validator).

### Step 4b — V2 pointer for the new row

`apply_personal_plan_stage5_protocol_batch_v1` writes `guidance_payload` but not
`guidance_payload_v2`, and the publication validator requires V2. So whichever
route step 4 takes, the new Redken row still needs a V2 pointer before the
enrichment apply, plus the reverse-coverage entry described above:

```bash
npm run products:intake:stage5-v2-application:preflight
npm run products:intake:stage5-v2-application:apply -- --apply --confirm-project=pqdkhefxsxkyeqelqegq ...
```

`application_family` needs no action — it is a generated column derived from
`role` + `guidance_payload`, and both authored heat rows resolve to
`pre_heat_damp`, exactly as authored.

Step 4b is the **standard** `stage5-v2-apply` run against
`application-pointer-backfill.json` — no special mode. Whichever route step 4
takes must leave that artifact carrying a Redken `pre_heat_protection` entry whose
`source_fingerprint` equals `stage5V2SourceFingerprint("pre_heat_protection",
<the payload the protocol row actually holds>)` (`8e1b1bbc…` for the authored
S5-14 payload). Preflight fails closed on any other value
(`source_protocol_diverged`), and `--apply` additionally requires the artifact
fingerprint pinned at review time plus the exact clean reviewed head.

**Neqi follows this same path if it is ever unblocked.** Its two rows carry no
`guidance_payload` at all in `S5-14-leave-in-calibration.json`
(`research_status: "blocked_identity_or_commercial"`), so unblocking it means
authoring the payloads first, then routing them through whichever step-4 route is
chosen — plus promoting its `origin` from `user_submitted` to `curated`, which
changes its fingerprint and re-subjects it to the publication validator. Nothing
about Neqi is required for this batch: it is not recommended, so it is not a
publication blocker today.

### Steps 5 and 6 — enrichment preflight, then apply

**Which prerequisite applies depends on whether the ledger already holds this
batch.** `classifyLeaveInCalibrationRun` decides, and the two modes have
*different* green conditions — an operator who assumes "preflight must be green"
in both will stop short of the supported replay after a committed-but-lost
response (the RPC succeeded, the reply never arrived).

| | **First apply** | **Replay** |
| --- | --- | --- |
| Ledger for `leave-in-research-calibration-v1` | **empty** | **all 9 products present** |
| Preflight `ok` | **must be `true`** | **`false` is expected** |
| `target fingerprint is stale` | must not appear | **EXPECTED — that is what the previous apply changed** |
| Any other preflight error | blocks | blocks (`unexpected preflight error: …`) |
| Ledger fingerprints | n/a | every row must match this batch's `batch_fingerprint`, the product's `content_fingerprint`, its `product_id`, and `reviewed_by = nick` |
| What actually proves correctness | the green preflight | **the RPC's own re-assertion**: it re-checks live state against the batch per product and raises `conflicting or partial retry` if anything diverged |

A ledger holding *some* of the nine is neither mode: the CLI refuses with
`partial state, resolve by hand` before any RPC call. Do not "fix" that by
deleting ledger rows selectively — see §8, where rollback and the ledger interact.

So: run the preflight below and read it against the correct column. **Do not
re-run the apply merely because the preflight is red** — first establish which
mode you are in by checking the ledger:

```sql
select product_key, product_id, reviewed_by, batch_fingerprint, content_fingerprint
from catalog_enrichment_applied_items
where batch_id = 'leave-in-research-calibration-v1'
order by product_key;   -- 0 rows = first apply · 9 rows = replay · 1-8 = resolve by hand
```

```bash
npm run products:intake:leave-in-calibration:preflight
# first apply -> must be ok: true
# replay      -> ok: false with ONLY "target fingerprint is stale" errors

npm run products:intake:leave-in-calibration:apply -- \
  --apply \
  --confirm \
  --confirm-batch leave-in-research-calibration-v1 \
  --reviewed-by nick \
  --reviewed-head <40-char-sha-of-the-reviewed-commit> \
  --expect-migration=applied \
  --expected-batch-fingerprint eaffe5481438c6639de05040c48937a17280fc6c2e9e192f64d3d8d569979ba6 \
  --expected-content-fingerprint 78260563c2e818f23a14b74096c7b7c0e423a176cbe8327a93651357df98c06d
```

Without `--apply` the script prints a dry run and writes nothing. With `--apply`
it refuses unless every other flag is present and exact, the run classifies as
**first apply or replay** per the table above, the built package matches both
reviewed fingerprints **and** the migration-pinned approved fingerprint, and the
worktree is the exact clean reviewed head. Only then does it call the RPC once,
with the canonical package JSON.

Inside the RPC, per product, in one transaction: reviewer + fingerprint + header
+ approved key/id mapping checks → advisory locks → ledger replay check →
drift guard against `current_catalog_target` → AD-6 `heat_protection_max_c`
invariant → `UPDATE products.suitable_thicknesses` → `DELETE` the stale
eligibility rows (row count must equal the plan) → upsert specs, fit, eligibility
→ post-write self-check that the live state equals the batch → ledger insert.
Re-running it is a no-op: the ledger short-circuits each product after
re-asserting that the live state still matches.

### Step 7 — verify

```bash
npm run products:intake:leave-in-calibration:verify
npm run products:intake:leave-in-calibration:preflight   # target fingerprints are now stale BY DESIGN
```

`verify` asserts, per product, that the live spec/fit values equal the
projection, that the eligibility set is exactly the projection's, that
`suitable_thicknesses` matches, and that no row the batch deleted survived. Plus
the SQL checks in §9.

---

## 7. Authored protocol copy (for review)

### 7.1 Neqi — `post_wash_leave_in` / `post_wash_damp_conditioning`

Template TPL-LEAVEIN-DAMP with the spray deviation.
Source: `https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray`
(C2, manufacturer, checked 2026-09-03).
`source_text` (verbatim): *"Das Haar in Abschnitte unterteilen. Das Spray
großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen.
Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen."*

Columns: `application_stage: damp_leave_on`, `application_state: null`,
`placement: lengths_ends`, `contact_time_seconds: null`,
`rinse_action: leave_in`, `reapplication: not_stated`.
`amount: { kind: "qualitative", copyDe: "Großzügig und gleichmäßig sprühen." }`

> **towel-dry** (`section`)
> Das Haar nach dem Waschen mit dem Handtuch sanft ausdrücken, nicht rubbeln – nasses Haar bricht leichter. Danach in Abschnitte unterteilen.

> **apply** (`apply_product`)
> Großzügig und gleichmäßig ins handtuchtrockene – nicht nasse – Haar sprühen, Längen und Spitzen abdecken und den Ansatz aussparen. Zum Verteilen mit einem grobzinkigen Kamm durchkämmen. Nicht ausspülen.

### 7.2 Neqi — `pre_heat_protection` / `pre_heat_damp`

Template TPL-LEAVEIN-HEAT, damp family. P9: the source names the towel-dry state
and explicitly excludes wet hair ("handtuchtrockene (nicht nasse)"), so
`pre_heat_damp`, not `either_state_protection`. P7: `reapplication: required`.
Same source and checked date as 7.1.

Columns: `application_stage: damp_leave_on`, `application_state: damp`,
`placement: lengths_ends`, `rinse_action: leave_in`, `reapplication: required`,
`protocolFacts.reapplication: each_separate_heat_event`.

> **apply-pre-heat** (`apply_product`)
> Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar sprühen, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt.

> **tool-pre-heat** (`tool`)
> Danach die einzelnen Partien mit Wärme und auf Spannung föhnen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.

### 7.3 Redken — `pre_heat_protection` / `pre_heat_damp`

Template TPL-LEAVEIN-HEAT, damp family.
Source: `https://www.redken.eu/de-de/produkte/haarpflege/extreme/extreme-anti-snap`
(C2, manufacturer-German, checked 2026-09-13).
`source_text` (verbatim, as captured in the frozen packet): *"Nach dem Extreme
Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht
ausspuelen. Wie gewohnt stylen."*

Columns as 7.2.

> **apply-pre-heat** (`apply_product`)
> Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar sprühen, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt.

> **tool-pre-heat** (`tool`)
> Danach wie gewohnt mit Wärme stylen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.

### Authoring notes

- Both products are sprays in the projection, so both carry the template's spray
  `amount` deviation. Redken's format flips `lotion → spray` in this very batch,
  which is what makes the spray copy correct.
- **No temperature is named in any copy.** AD-6 keeps heat protection binary; the
  template permits (does not require) appending a sourced degree sentence. Neqi's
  page claims "intensivem Hitzeschutz bis 230°" and Redken's C2 page gives no
  figure at all. Left out for consistency — say so if you want Neqi's figure in
  the `tool` step.
- Neqi's `heat_activation_required` flips true → false in this batch, so the
  template's "must not imply it works without heat" caveat does not apply.
- Per the doc's R-D dry-use rule, a spray at `weight: medium` would also default
  to a TPL-LEAVEIN-DRYCARE row. Not authored — the required-role set does not
  include it and Neqi's source positions damp application only. Flagging it as an
  optional third Neqi row rather than adding it unasked.

---

## 8. Rollback

The executor applies **the whole batch in one transaction** — it is a single RPC
call, so either all nine products land or none do. A mid-apply failure therefore
needs no rollback; it leaves the catalog untouched (the Postgres harness asserts
exactly that: a refused batch writes zero ledger rows and no spec change).

Rollback is only for a *successful* apply that Nick later wants undone.
`product-mapping.json` holds every product's **complete pre-apply values**
(`current_specs`, and the live eligibility set), and each manifest's
`current_catalog_target` holds the same rows in fingerprint form. To roll a
product back:

1. `UPDATE product_leave_in_specs` and `product_leave_in_fit_specs` back to the
   `current_specs` values in `product-mapping.json` for that `product_id`.
2. `DELETE FROM product_leave_in_eligibility WHERE product_id = <id>` then
   re-insert exactly the rows in that manifest's
   `current_catalog_target.product_leave_in_eligibility`.
3. `UPDATE products SET suitable_thicknesses = <products_field_updates.suitable_thicknesses.current>`.
4. **Delete that product's ledger row**:
   `DELETE FROM catalog_enrichment_applied_items WHERE batch_id = 'leave-in-research-calibration-v1' AND product_id = <id>;`
5. Re-run preflight: the product's `target_fingerprint` must match again. If it
   does, the rollback is byte-exact.

**Rollback and the ledger interact — step 4 is not optional.** The ledger is what
makes a retry idempotent, so a hand-rollback that leaves the ledger row in place
puts the batch into a state the executor deliberately refuses:

- Leave the ledger row and the rows rolled back → the next run classifies as a
  *replay*, the executor re-asserts the live state against the batch, finds it
  reverted, and raises `conflicting or partial retry`. It will not silently
  re-apply. (Covered by the Postgres harness.)
- Delete *some* ledger rows → `classifyLeaveInCalibrationRun` reports
  `partial state, resolve by hand` and the CLI refuses before any RPC call.
- Delete all nine ledger rows and roll all nine products back → the batch is
  back to a clean first-apply state and preflight goes green again.

Protocol rows are not written by this batch, so nothing to roll back there. The
Stage-5 protocol row from step 4 and its V2 pointer from step 4b are separate
lanes with their own ledger entries and their own rollback.

---

## 9. Post-apply verification

```sql
-- 1. Eligibility set is exactly the projection (expect 0 rows).
with expected(product_id, thickness, need_bucket, styling_context) as (
  values -- paste from each manifest's product_leave_in_eligibility upsert
)
select 'unexpected_live_row' as issue, e.*
from product_leave_in_eligibility e
join (select distinct product_id from expected) t using (product_id)
where not exists (
  select 1 from expected x
  where x.product_id = e.product_id and x.thickness = e.thickness
    and x.need_bucket = e.need_bucket and x.styling_context = e.styling_context)
union all
select 'missing_projected_row', x.*
from expected x
where not exists (
  select 1 from product_leave_in_eligibility e
  where e.product_id = x.product_id and e.thickness = x.thickness
    and e.need_bucket = x.need_bucket and e.styling_context = x.styling_context);

-- 2. No leave-in spec column is NULL where the projection filled it (expect 0 rows).
select id, name from products p
join product_leave_in_specs s on s.product_id = p.id
where p.id in ( /* the nine ids */ )
  and (s.care_direction is null or s.repair_support_level is null
       or s.plan_roles is null or s.functional_benefits is null);

-- 3. Protocol coverage for every product that now claims heat protection
--    (expect Redken + Neqi to appear until steps 4/4b are done).
select p.name, s.provides_heat_protection,
       array_agg(distinct a.role) filter (where a.role is not null) as roles
from products p
join product_leave_in_specs s on s.product_id = p.id
left join product_application_protocols a on a.product_id = p.id
where p.id in ( /* the nine ids */ )
group by p.name, s.provides_heat_protection
having s.provides_heat_protection
   and not ('pre_heat_protection' = any(array_agg(a.role)));

-- 4. suitable_thicknesses matches the projection.
select id, name, suitable_thicknesses from products where id in ( /* the nine ids */ );
```

Then re-run `npm run products:intake:leave-in-calibration:preflight`. After a
successful apply every manifest's `target_fingerprint` will be **stale by
design** — that is the expected end state, and the regenerated fingerprint is the
new baseline.

---

## 10. Optional follow-up — EVO `add_identifiers`

If Nick confirms the catalog row `118ebae1-b7a9-4a89-a2ff-6c31df28c4dc` ("EVO
Head Mistress", catalog EAN `9349769020791`) and the research record
(GTIN `9349769013144`, 150 ml) are the **same formulation in different pack
sizes**, the research GTIN should be added rather than replacing the catalog's.
That is the expansion lane's F-09 same-formulation identity rule, not this batch:

```jsonc
// scripts/product-intake/expansion — existing_product_updates entry
{
  "product_id": "118ebae1-b7a9-4a89-a2ff-6c31df28c4dc",
  "add_identifiers": [{
    "type": "ean",
    "value": "9349769013144",
    "cross_source_agreement": true,
    "source_urls": ["https://www.evohair.com/us/hair-styling/styling-format/cream/evo-head-mistress-cuticle-sealer-150ml-39268/"],
    "excluded_from_apply": false
  }]
}
```

If they are **different SKUs**, slot 05 leaves this batch and needs its own
research pass instead. Evidence for both readings is in `evo-gtin-evidence.md`.

---

**Nothing in this package has been applied.** The branch authors one migration
(`20260914163000`, functions only — it creates the executor RPC and its three
helpers and changes zero rows) and one Stage-5 protocol input file; no migration
has been run against production, no RPC has been called, and no catalog row has
been written. Applying the migration and running the data apply are separate,
later, explicitly authorized steps — see the gate table in §6.
