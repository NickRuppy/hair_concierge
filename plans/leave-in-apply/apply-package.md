# Leave-In Calibration — Apply Package

Prepared 2026-09-14. Read-only research pass against production Supabase
(`pqdkhefxsxkyeqelqegq`) and the repo's leave-in research corpus. **Nothing has
been written to the database or the repo's migrations.** This document is the
review artifact Nick needs before any apply step runs. Machine-readable mirror:
`plans/leave-in-apply/product-mapping.json`.

## Headline finding before the table

The task brief expected "the majority" of the 15 products to already exist in
the catalog with specs, and only the 4 unseen products to be missing envelopes.
The catalog check found a **larger missing set than expected**:

- **8 of 15** are clean existing catalog matches (GTIN or unambiguous name
  match), ready to have their specs replaced directly.
- **1 of 15** (EVO Head Mistress Cuticle Sealer) exists in the catalog under a
  matching name, but its **GTIN does not match** the research record's GTIN —
  identity needs confirming before this one can be included.
- **6 of 15** do not exist in the catalog at all: **2 of the 11 "gold" products**
  (alverde Nutri-Care 2-Phasen-Sprühkur, Balea Leichtkämmspray Pure Styling) —
  despite having complete calibration envelopes and projections — plus **all 4
  unseen products** (L'Oréal Elvital Dream Length, Briogeo, ISANA Argan,
  amika The Shield).

So this is not "11 ready + 4 pending research." It is "8 ready to replace specs
today, 1 pending an identity check, and 6 pending full catalog intake" — 4 of
those 6 also still need their research envelope formally built (the values
themselves are already resolved in the corpus, see Lane recommendation below).

## Summary table (15 products)

| # | Produkt | Research-Slot | Katalog-Status | product_id | Aktiv | Empfohlen | Bild |
|---|---|---|---|---|---|---|---|
| 1 | alverde Leave-In Sprühkur Express 7in1 | gold slot-01 | ✅ exists (GTIN match) | `f9595d2c-d86d-4bdb-9758-c98d1e213f3c` | ja | **ja** | ja |
| 2 | ISANA Leave-In Hyaluron & Panthenol | gold slot-02 | ✅ exists (GTIN match) | `0b21f996-bb42-4b10-89bd-4881c4346d53` | ja | **ja** | ja |
| 3 | Cantu Leave-In Repair Creme | gold slot-03 | ✅ exists (GTIN match)¹ | `e3c4b607-8f81-462c-8a2b-e45c8b3a2976` | ja | **ja** | ja |
| 4 | alverde Nutri-Care 2-Phasen-Sprühkur | gold slot-04 | ❌ **missing** | — | — | — | — |
| 5 | EVO Head Mistress Cuticle Sealer | gold slot-05 | ⚠️ exists, **GTIN mismatch** | `118ebae1-b7a9-4a89-a2ff-6c31df28c4dc` | ja | **ja** | ja |
| 6 | Curlsmith Hydrate & Plump Leave-In | gold slot-06 | ✅ exists (name match) | `648ba537-5180-440e-81ad-2b310b447d87` | ja | **ja** | ja |
| 7 | GLISS Sprüh-Conditioner Express-Repair | gold slot-08 | ✅ exists (GTIN match) | `5dc2fae3-a0ca-4e6c-9c30-02dd192772f0` | ja | **ja** | ja |
| 8 | Redken Extreme Anti-Snap | gold slot-09 | ✅ exists (GTIN match) | `2b7db7e3-2058-4178-8a03-7d05f4a1d447` | ja | **ja** | ja |
| 9 | Olaplex N°.6 Bond Smoother | gold slot-10 | ✅ exists (name/EAN match) | `4e99706a-2232-4ee6-ba1b-9ca1029a7364` | ja | **ja** | ja |
| 10 | Balea Leichtkämmspray Pure Styling | gold slot-11 | ❌ **missing** | — | — | — | — |
| 11 | Neqi Diamond Glass Ultimate Styling Spray | gold slot-13 | ✅ exists (GTIN match) | `42a2fe20-bd7e-49a3-a880-8ae89015a5c9` | ja | nein | ja |
| 12 | L'Oréal Elvital Dream Length No Spliss Milk | unseen u1 | ❌ **missing** | — | — | — | — |
| 13 | Briogeo Avocado + Kiwi 3-in-1 Leave-In Spray | unseen u4 | ❌ **missing** | — | — | — | — |
| 14 | ISANA PROFESSIONAL Argan Leave-in Conditioner | unseen u5 | ❌ **missing** | — | — | — | — |
| 15 | amika The Shield Anti-Humidity Spray | unseen u6 | ❌ **missing** | — | — | — | — |

¹ See delta highlights below — a second, miscategorized active duplicate and an
inactive legacy duplicate also exist under this name; neither is the apply
target.

9 of 11 gold products are live and `is_chaarlie_recommended = true` today
(Neqi is the exception). A spec replacement on any of the 9 existing rows
changes an **active recommendation** immediately on apply.

## Delta highlights (current catalog spec vs. research projection)

Full field-by-field current/projected values for every product are in
`product-mapping.json` (`current_specs` / `projected_specs` / `delta_summary`
per product). Highlights below are the changes that are visible to a user or
change matching behavior materially.

### 1. alverde 7in1 Sprühkur — live, recommended
- `suitable_thicknesses` flips **fine → normal, coarse** (opposite audience).
- `roles` **extension_conditioner → replacement_conditioner**; `fit_conditioner_relationship` **booster_only → replacement_capable** (no longer just a booster — becomes a full conditioner substitute in the matcher).
- `care_benefits` narrows to moisture-only, drops detangling/anti_frizz/shine. `repair_support_level` medium → low.

### 2. ISANA Hyaluron & Panthenol — live, recommended
- **Format correction: `lotion` → `spray`** (round-4 pack-shot evidence: finger-pump/spray actuator confirmed on the EAN-matched bottle). This is user-visible — dispenser and any format-specific copy changes.
- `suitable_thicknesses` flips **fine → coarse**. `roles` extension → replacement_conditioner.

### 3. Cantu Repair Creme — live, recommended
- `care_benefits` loses **repair** and **anti_frizz**, becomes moisture-only. `repair_support_level` medium → low. This directly contradicts the manufacturer's own German-market "Repariert geschädigtes Haar" claim on cantubeauty.de — but research flags that page's INCI as possibly matching the **US variant formula** (GTIN 810006943405), not the frozen DE-pack formula this projection is built from (`identity_status: provisional_formula_conflict`). Worth a second look before applying.
- Eligibility rows **4 → 2**.
- **Two catalog wrinkles found, neither part of this apply**: a second *active* row with the identical name `Cantu Leave-In Repair Cream` (`7539ab79-…`) miscategorized under `category_key=conditioner` with no identifiers at all, and the already-known inactive `(legacy duplicate)` row (`7db2bb60-…`). See Risk notes.

### 5. EVO Head Mistress Cuticle Sealer — live, recommended, **blocked on identity**
- Catalog row's own EAN is `9349769020791`; the research record's frozen GTIN is `9349769013144` (150 ml pack). These do not match. Could be a different pack size of the same line, or a genuinely different SKU — not resolved in this pass. **Do not apply this one until identity is confirmed.**
- If confirmed: `suitable_thicknesses` flips fine → normal, coarse; weight light → medium; roles extension → replacement_conditioner (styling_prep kept); application_stage gains pre_heat + post_style.

### 6. Curlsmith Hydrate & Plump — live, recommended
- **Format correction: `lotion` → `cream`** (round-4 evidence: pump dispenser, thick white cream texture shot, on-pack label reads "Conditioning Cream").
- `suitable_thicknesses` normal → coarse; `weight` medium → rich; `roles` gains `styling_prep`.

### 7. GLISS Sprüh-Conditioner Express-Repair — live, recommended
- **Largest semantic change in the set.** `care_direction` flips **protein → moisture**, and `repair_support_level` drops **high → low**, with "repair" removed from `care_benefits` and `fit_care_benefits` entirely — for a product whose own name is "**Express-Repair**." Worth flagging to Nick explicitly before applying.
- `roles` flips too: today it's `styling_prep`-only; the projection is `replacement_conditioner`-only.
- `suitable_thicknesses` fine → normal, coarse; weight light → medium.

### 8. Redken Extreme Anti-Snap — live, recommended
- **Format correction: `lotion` → `spray`** (not called out in the original task brief — found during this pass).
- **New claim**: `provides_heat_protection` **false → true**, gains `pre_heat_application` plan role. Worth a quick evidence sanity-check given the repo's recent AD-6 binary heat-protection cutover.
- Eligibility rows **4 → 10** — a large expansion of recommended contexts.

### 9. Olaplex N°.6 Bond Smoother — live, recommended, high-visibility brand
- `repair_support_level` drops **high → low**; "repair" removed from care/fit benefits — again notable given the product is literally named "Bond Smoother." Flag alongside GLISS above.
- `care_direction` balanced → moisture; `roles` loses `styling_prep`. Eligibility rows **7 → 3** (large reduction).

### 11. Neqi Diamond Glass — not currently recommended (lower risk)
- Current row has **`care_direction`, `repair_support_level`, `plan_roles`, `functional_benefits` all NULL** — an incomplete spec row today. The projection fills all four in.
- `heat_activation_required` true → false. Roles gains `replacement_conditioner`.
- **Zero `product_application_protocols` rows exist today** — spec replacement alone does not make this product recommendation-ready; protocols still need authoring separately (see Risk notes / parked items).

## Lane recommendation

**(a) The 9 existing catalog rows (8 clean + Neqi, once EVO's identity is resolved separately):**
Recommend a **single reviewed Supabase migration**, not a new preflight/apply/verify
script triad. This is a one-time calibration batch, not a recurring enrichment
type — the repo's `scripts/product-intake/catalog-enrichment/{heat,scalp,scanner-identifier-backfill}-{preflight,apply,verify}.ts`
pattern exists for recurring batch pipelines with many waves over time; building
a fourth one here for a single ~8-row pass would be the over-engineering
CLAUDE.md tells us to avoid. The repo's own precedent for this exact shape of
change — a one-time, reviewed, batch spec correction on existing rows — is a
plain migration (e.g. the Monday coarse-extension shampoo fix, PR #449; the
AD-6 `heat_protection_max_c` cutover migration `20260914090000_leave_in_heat_protection_max_c_ad6_cutover.sql`).
Concretely: one migration file that, per `product_id`, `UPDATE`s
`product_leave_in_specs` and `product_leave_in_fit_specs` to the projected
values and replaces (`DELETE` + `INSERT`) that product's
`product_leave_in_eligibility` rows. **Nick's `--apply --confirm` equivalent
here is reviewing the migration file's diff and explicitly authorizing
`apply_migration`** — the same guarded-write posture the repo's other
migrations already use; there is no separate CLI flag to wire up.

**(b) The 6 missing products** need the full standard single-product intake
workflow (`docs/product-intake-research-ops.md`: identity → image → category
properties → commercial fields → guarded publish), because specs alone aren't
enough — they also need a catalog image, a purchase link/price, and an
application protocol, none of which exist yet for any of the 6. For the 2 gold
ones with a finished projection (alverde Nutri-Care, Balea Leichtkämmspray),
intake can start from the existing `calibration-expected-projections.json`
values pre-filled as the category-properties lane, skipping re-research. The
guarded publish step is the same one already documented: either
`npm run products:intake:approve-package -- --package <dir> --reviewed-by nick --apply --confirm`
(legacy local package flow) or the review center's final-handoff action —
never run without Nick explicitly approving that exact package.

**Smallest correct path for the 4 unseen envelopes:** extend
`scripts/leave-in-research/build-envelopes-from-key.mjs` to also read the
unseen-test corpus (`corpus/unseen-test/lane-a/records.json` for u4/u6,
`corpus/unseen-test/rederived/u1-record.json` and `rederived/u5-record.json`
for u1/u5) as its reference-key input, rather than running the 4 products
through the normal intake research worker as fresh research. All 4 already
have fully resolved, non-`unknown` per-dimension values in the corpus —
`unseen-test-report.md` confirms both independent research lanes agreed on
every field for u4/u5/u6, and u1's earlier 3-way formula-source conflict was
separately resolved by a dedicated 2026-09-13 rederivation
(`rederived/u1-record.json`, `uncertain_fields: []`). Building envelopes is
therefore a mechanical transcription step per the existing script's own
"deterministic and non-inventive" design, not new research — re-running full
intake research would duplicate work already done.

**Not recommended:** running the 4 unseen products through the normal
per-product intake research worker as if they were brand-new — that would
re-derive values the corpus has already produced and reviewed twice over.

## Risk notes

- **9 currently live-recommended products** in this set (all gold-slot matches
  except Neqi). A spec replacement changes what those products are recommended
  for immediately on apply — GLISS and Olaplex in particular lose their
  "repair" positioning despite their own product names implying repair; flag
  both explicitly to Nick before the migration is written, not just noted in
  this doc.
- **Boundary item — Kevin Murphy Young.Again Oil** (not one of the 15, follow-up
  only): live today as `category_key=leave_in`, `is_chaarlie_recommended=true`,
  and its own `roles` is already `['oil_replacement']` — the catalog's own
  spec vocabulary already hints it behaves like an oil. The Leave-In research
  program's gold set explicitly **excludes** this product (slot 12,
  `excluded_other_form`/oil). Recommend a separate follow-up to re-evaluate its
  category; **do not include it in this apply**.
- **Data-quality wrinkle — duplicate active Cantu row**: `7539ab79-…` is a
  second active "Cantu Leave-In Repair Cream" miscategorized under
  `category_key=conditioner` with zero identifiers. Found during this pass,
  not previously flagged. Separate follow-up recommended (de-duplicate or
  re-categorize); not part of this apply.
- **EVO GTIN mismatch** blocks slot-05 from this apply until resolved (see
  delta section above).
- **Parked — missing products (6)**: alverde Nutri-Care 2-Phasen-Sprühkur,
  Balea Leichtkämmspray Pure Styling, L'Oréal Elvital Dream Length, Briogeo
  Avocado+Kiwi 3-in-1, ISANA Argan Leave-in, amika The Shield. None has an
  image, purchase link, or protocol in our catalog yet — all park at "needs
  full intake," 4 of them additionally needing an envelope built first (see
  Lane recommendation). alverde Nutri-Care's own research record separately
  flags the GTIN as possibly delisted at dm.de — worth re-verifying current
  availability before spending intake effort on it.

## Open questions for Nick

1. **GLISS and Olaplex both drop "repair" positioning** (protein/high →
   moisture/low and balanced/high → moisture/low respectively) despite
   "Express-Repair" and "Bond Smoother" branding. Apply as projected, or hold
   these two for a manual re-check against the underlying INCI reasoning
   first?
2. **EVO Head Mistress GTIN mismatch** — is `118ebae1-…` (catalog EAN
   9349769020791) the same physical product as the research record (GTIN
   9349769013144, 150 ml), e.g. a different pack size, or a different SKU that
   needs its own research pass?
3. **Cantu US/DE formula conflict** — apply the DE-pack-derived projection as
   is, or resolve the `provisional_formula_conflict` first given the
   cantubeauty.de claims may reflect the US variant?
4. **Migration vs. a new catalog-enrichment script** — confirm the one-time
   reviewed-migration approach in Lane (a) is right-sized, rather than
   building a `leave-in-calibration` preflight/apply/verify triad.
5. **alverde Nutri-Care 2-Phasen** — still commercially available (dm.de may
   have delisted it), or should intake be skipped for this one entirely?
6. **Kevin Murphy Young.Again** and the **duplicate Cantu row** — confirmed
   as separate follow-ups, correctly excluded from this apply?

---

Both deliverables written: this document
(`plans/leave-in-apply/apply-package.md`) and the machine-readable mapping
(`plans/leave-in-apply/product-mapping.json`, 15 product entries + the 2
boundary follow-ups).
