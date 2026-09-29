# Kevin Murphy YOUNG.AGAIN — Leave-in → Öl (Recategorization Plan)

**Status:** prepared for Nick's review · nothing applied · Codex review findings P1-1…P2-6 (2026-09-29) addressed
**Ruling (Nick, 2026-09-29):** "switch category and research with the respective oil data and put it into oils. It's a leave-in oil, but this is also true for all other oils we have in our oil category."
**Product:** `products.id = 6ad82861-d68e-4e70-a976-78c0f35d087b` ("Kevin Murphy Young Again")
**Worktree:** `.worktrees/kevin-murphy-oil-migration` on `codex/kevin-murphy-oil-migration` (base `66b03bcc`)

Artifacts in this folder:

| File                                                                                         | What it is                                                                                         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `prestate-2026-09-29.json`                                                                   | Read-only SELECT snapshot of every row the swap touches (the rollback source of truth)             |
| `generate.ts`                                                                                | Deterministic generator: stamps the ruled templates, derives V2 pointers, validates, emits the SQL |
| `target-state.json`                                                                          | Reviewable target rows, the fingerprinted preimage guards, and the content fingerprint             |
| `rollback.sql`                                                                               | Prepared rollback (not a migration)                                                                |
| `verify.sql`                                                                                 | Read-only post-apply proof; every query must return zero rows                                      |
| `artifact-manifest.json`                                                                     | sha256 of the snapshot input and every emitted file, plus a combined hash                          |
| `oil-thickness-comparison.md`                                                                | Ingredient comparison behind the all-three-thickness ruling                                        |
| `../../supabase/migrations/20260929120000_kevin_murphy_young_again_oil_recategorization.sql` | The prepared, **unapplied** migration (generated — do not hand-edit)                               |

Content fingerprint: `c0dafc1dbc7bde13fe37f9ac04666b9596576ef4c40276464a94a431a2039728`. Artifact manifest combined hash: `07fae3cd8259a357b086e414d15b48a825c3c05fbdfbb74ce9bbd2f2beb91e6d`.

- Since the Codex-review revision, the fingerprint covers both the target and the preimage guards (snapshot rows, `captured_at`, pinned timestamps), so a re-captured snapshot changes the receipt fingerprint.
- Previous fingerprints: `54cebf31…` (Codex round 1, before deterministic protocol ids), `3b9410d5…` (all three thicknesses, target-only hash) and `6b34dcb7…` (`normal` only).
- The two Oil protocol rows get deterministic ids derived from the batch, product and role (`2f7fe5d8-…` leave-on, `649e906e-…` dry finish), so the exact-target checks can pin them.
- `npx tsx plans/kevin-murphy-oil-migration/generate.ts --check` re-generates in memory and fails if any emitted file, the manifest or the snapshot hash has drifted.

---

## 1. Identity: the row is the YOUNG.AGAIN treatment oil

**Verdict: high confidence.** The catalog row is Kevin Murphy's YOUNG.AGAIN Immortelle-infused treatment oil, 100 ml. There's no evidence that it meant any other KM product.

The evidence:

- **The row's own purchase link** (Hagel, `…/kevin-murphy-young-again-leave-in-treatment-100-ml.html`) is the 100 ml oil. Hagel calls it "Leave-In Treatment", and the row's `leave_in` category most likely came from that name. The 43 € price matches KM's EU price for the oil.
- **The live EAN** `9339341020356` (`product_identifiers`, source `scanner-catalog-coverage-2026-08-26`) points to the oil at several independent EU retailers:
  - Hagel (DE) and symphonya.eu ("Hair Oil Treatment 100 ml"), both recorded in `data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e5-v1.json`.
  - salling.dk ("Young Again Leave-In Olie, 100 ml").
  - fresh-store.eu ("Hair Oil Treatment … 100 ml", with the EAN in the URL).
  - This meets R-B (≥2 independent sources).
- **The manufacturer (EU, DE page)** says: "YOUNG.AGAIN ist ein schwereloses Leave-in-Öl, angereichert mit Immortelle." It also lists "Für alle Haartypen geeignet" and a price of 43,00 €.
- **KM's other products named YOUNG.AGAIN** carry their own suffix: WASH (shampoo) and RINSE (conditioner), both found in retail, and DRY.CONDITIONER, named in the KM article. The bare "YOUNG.AGAIN" is the oil.

| Field                    | Value                                                                                                                                                                                                   | Source (checked 2026-09-29)                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Exact name               | KEVIN.MURPHY **YOUNG.AGAIN** (retail naming varies: "Treatment Oil", "Immortelle Infused Treatment Oil", Hagel "Leave-In Treatment")                                                                    | kevinmurphy.com.au (DE + US pages)                                                    |
| Pack size                | 100 ml (only size found in DE/EU retail)                                                                                                                                                                | KM DE page, Hagel, lyko, salling.dk                                                   |
| GTIN (DE/EU)             | **9339341020356** (already live)                                                                                                                                                                        | Hagel, symphonya.eu, salling.dk, fresh-store.eu                                       |
| GTIN (US/legacy)         | 9339341001744                                                                                                                                                                                           | upcitemdb, hbastore.com (US) — **not** proposed for the EU catalog row                |
| Heat claim               | "…Hitze bis zu 230 °C schützen" (DE); "450F / 230°C" (US)                                                                                                                                               | KM DE page; KM US page; KM blog                                                       |
| Directions               | "add a few pumps to damp hair before air-dry or heat styling. Then, once dry add a few more to finish" / "use daily on damp or dry hair. Apply before styling and again on dry hair to smooth flyaways" | KM blog `the-leave-in-treatment-designed-for-all-hair-types-blog.html` (manufacturer) |
| Directions (retail echo) | "Apply YOUNG.AGAIN to freshly washed hair and before any styling products. Once dried, you can apply a small amount … to dry hair …"                                                                    | lyko.com (EU), cultbeauty.com (UK)                                                    |

**INCI: EU manufacturer list** (KM DE page, labelled "EU HERSTELLER"):

> Cyclopentasiloxane, Dimethicone, Dimethiconol, Bis-Cetearyl Amodimethicone, Helichrysum Stoechas Flower Extract\*, Pyrus Malus (Apple) Fruit Extract, Camellia Sinensis Leaf Extract, Carthamus Tinctorius (Safflower) Seed Oil, Citrus Limon (Lemon) Peel Oil, Citrus Limon (Lemon) Fruit Extract, Vitis Vinifera (Grape) Seed Extract, Saccharum Officinarum (Sugarcane) Extract, Ginkgo Biloba Leaf Extract, Glycerin, Hydrolyzed Soy Protein, Water (Aqua) (Eau), Hexylene Glycol, Butylene Glycol, Cyclohexasiloxane, Betaine, Vanillyl Butyl Ether, Behentrimonium Chloride, Quaternium-91, Myristyl Myristate, Hexapeptide-11, Cetearyl Alcohol, Ethylhexyl Methoxycinnamate, Phenoxyethanol, Potassium Sorbate, Sodium Benzoate, Fragrance (Parfum), Linalool, Limonene, Geraniol, Violet 2 (CI 60725)

**Conflicts, recorded but not resolved:**

- **KM US page and beautyshop24.de:** the same ingredients, but Sugarcane sits in position 7 rather than 12, and **BHT** appears after Ethylhexyl Methoxycinnamate. The EU manufacturer list has no BHT.
- **cultbeauty.com (UK):** a visibly older formula. The order differs, "Vinyl Butyl Ether" appears (probably a typo for Vanillyl), there is no Sodium Benzoate, and it includes **Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde** (HICC/Lyral, banned in the EU). Treated as a stale non-EU listing.
- **One secondary summary** (bestehaarkur-style review text) mentions heat protection "up to 200°F/93°C". This contradicts every manufacturer page. It doesn't matter here because heat is stored as a binary only (AD-6).
- ⚠️ **Coming reformulation.** The EU INCI still leads with **Cyclopentasiloxane (D5)** and contains **Cyclohexasiloxane (D6)**. Regulation (EU) 2024/1328 limits D5/D6 in _leave-on_ cosmetics to 0.1 % from **6 June 2027**, so an EU reformulation before then is near-certain. **Re-verify the INCI and weight after it ships.** It doesn't block anything now.

## 2. What the live row carries today (pre-state, full detail in `prestate-2026-09-29.json`)

- **`products`:**
  - `category_key=leave_in`, `category='Leave-in'`, `tags={leave-in}`
  - `suitable_thicknesses={normal}`, `suitable_concerns={performance,tangling}`
  - `is_chaarlie_recommended=true`, origin `curated`, active
  - `updated_at 2026-08-15T07:47:38.210968Z`
- **`product_leave_in_specs`** (1 row): format `serum`, weight `medium`, `provides_heat_protection=false`. That last value contradicts the manufacturer's heat claim.
- **`product_leave_in_fit_specs`:** 1 row.
- **`product_leave_in_eligibility`:** 4 rows, all `normal`.
- **`product_application_protocols`:** 4 leave-in rows:
  - DAMP
  - DRYCARE, with a `leave-in-use-case-…` guidanceKey and `do_not_rinse`
  - `post_style_finish`, a parked family
  - an `either_state_protection` heat row
- **`product_thickness_eligibility`:** 1 row (`leave_in`).
- **`product_concern_eligibility`:** 2 rows (`leave_in`).
- **`personal_plan_catalog_fact_evidence`:** 1 row, `leave_in.authority_facts`.
- **No Oil rows** of any kind.
- **No references** in Personal Plans (drafts, routine versions, proposals, portfolio versions, plans, refinement drafts), `user_products` or `user_product_usage`. No disposition, no relationship. Scanned 2026-09-29.
- **Ledger rows, left untouched:**
  - 10 `catalog_enrichment_applied_items` receipts
  - 1 `scanner_identifier_backfill_items` row
  - 1 `product_image_assets` row

## 3. Proposed Oil data (each value with its reasoning)

All values are in `generate.ts` and pass the Product Intake Oil validator (`validateProductIntakeCategorySpecs("oil", …)`).

### 3.1 `product_oil_specs`

| Column                     | Proposed                                    | Reasoning                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weight`                   | `light`                                     | Silicone-led, anhydrous-dominant formula (positions 1–4 are silicones); KM calls it "schwerelos/weightless". Matches every comparable silicone treatment oil in the catalog: Olaplex No.7, Gliss Öl-Elixier, Neqi Opulent and Maria Nila are all `light`. The old leave-in `medium` was on the leave-in scale. |
| `role_support`             | `{leave_on_fibre_conditioning, dry_finish}` | Manufacturer directions name exactly two uses: into damp hair after washing, before air-drying or heat styling, and then on dry hair to finish or smooth flyaways. There's no pre-wash source, and a silicone serum is not a pre-wash oiling oil, so there's no `pre_wash_fibre_treatment`.                    |
| `provides_heat_protection` | `true`                                      | Manufacturer description claim (DE page: "Hitze bis zu 230 °C"). R-E says a manufacturer description claim is enough. It's stored as a binary only; the 230 °C figure is never stored as a fact (AD-6). It creates **no** heat role or protocol (20260903083832).                                              |

### 3.2 `product_oil_eligibility` (one row)

| thickness                                 | oil_subtype   | oil_purpose      | ingredient_flags    |
| ----------------------------------------- | ------------- | ---------------- | ------------------- |
| `coarse`, `fine`, `normal` (one row each) | `styling-oel` | `styling_finish` | `{silicones, oils}` |

- **`styling-oel` / `styling_finish` (ruled by Nick 2026-09-29):** positioned on smoothing, flyaways, shine and heat, which are the engine's "styling finish" signals. That's the same slot as Olaplex No.7, Maria Nila and Garnier Wunderöl.
- **`{silicones, oils}`:** safflower seed oil and lemon peel oil are real plant oils in the INCI. This is the same flag set the leave-in spec already carried. Not added: `proteins` (hydrolysed soy protein and hexapeptide sit after water, at trace level) and `humectants` (trace glycerin).
- **All three thicknesses (ruled by Nick 2026-09-29):** see `oil-thickness-comparison.md`. YOUNG.AGAIN is D5-led (volatile) silicone, at least as light as the fine-eligible Olaplex No.7; its INCI twins (Herbal Essences, Pantene Argan, Gliss) carry all three, and the curated sheet itself places the same architecture on coarse (Sleek & Stay, Pantene Coconut, Urban Alchemy). Light-on-coarse is graded by `weight` (adjacent), not excluded by the thickness gate (decision.md: no double-counting). The prepared `normal`-only variant is recoverable by reverting the two generator constants.

### 3.3 `products` fields

| Column                                                                           | From → To                                                                                                                                                                  | Note                                                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `category_key`                                                                   | `leave_in` → `oil`                                                                                                                                                         | The ruling                                                                                                |
| `category`                                                                       | `Leave-in` → `Öle`                                                                                                                                                         | Legacy display/matcher field; `isOilCategory()` keys on "Öle"                                             |
| `tags`                                                                           | `{leave-in}` → `{öle}`                                                                                                                                                     | Curated Oil convention                                                                                    |
| `suitable_concerns`                                                              | `{performance,tangling}` → `{styling-oel}`                                                                                                                                 | Curated Oil convention: concern = subtype                                                                 |
| `suitable_thicknesses`                                                           | `{normal}` → `{coarse,fine,normal}`                                                                                                                                        | Named in the UPDATE, so the compat triggers re-project thickness/concern eligibility for `oil`            |
| `description`                                                                    | → "Leichtes Pflegeöl auf Silikonbasis mit Immortelle-Extrakt – nach der Wäsche in handtuchtrockene Längen und Spitzen oder als Finish ins trockene Haar. Mit Hitzeschutz." | ⚖️ Copy for Nick. The old text said "ist ein Leave-in".                                                   |
| `net_content_value/unit`                                                         | `NULL` → `100 ml`                                                                                                                                                          | Sourced (KM, Hagel, lyko). K18 precedent.                                                                 |
| `name`, `brand`, `affiliate_link`, `price_eur`, image, `is_chaarlie_recommended` | unchanged                                                                                                                                                                  | ⚖️ Keeps the name "Kevin Murphy Young Again". X4 doesn't force a rename because the DE shelf name varies. |

### 3.4 `personal_plan_catalog_fact_evidence` (`oil.authority_facts`, 2 rows)

1. **KM DE manufacturer page** → `{weight, provides_heat_protection, ingredient_flags, inci_basis}`. The quote includes the "schwereloses Leave-in-Öl" sentence, the heat sentence and the full EU INCI.
2. **KM how-to article** → `{role_support}`, with the verbatim direction quotes.

The old `leave_in.authority_facts` row is deleted; rollback restores it exactly. Both new rows carry the batch `S5R-03-km-young-again-oil-recategorization` and the content fingerprint.

## 4. Protocols (TPL-OIL-LEAVEON + TPL-OIL-DRYFINISH)

**How they were built:**

- Stamped through `buildExpansionProtocolRow` (the same code the scan-expansion lane uses) with the real product uuid.
- No hand-written payloads, so the §2.6 guidanceKeys are correct: `product-oil-<id>-leave-on` and `product-oil-<id>-dry`.
- Each V2 pointer is derived by `buildProductApplicationPointerV2({sourceRole, guidancePayload, applicationState})`, exactly as `category-validators.ts` does at the Product Intake boundary.

**Generator checks:**

- V1 parses.
- V1 family = V2 family = template family (§2.2).
- Scope is the product plus `oil`.
- `evidence[].sourceUrl = source_url`, which the publication gate needs.
- Role set = `role_support`.

**Runtime check (outside the migration):** both pointers resolve against `SHARED_APPLICATION_TEMPLATES_V2` via `composeProductApplicationProtocolsV2`.

**German copy.** This is Nick's ruled template text, transcribed byte for byte. No archaic imperatives; everything is infinitive or statement form.

**`leave_on_fibre_conditioning`** (`damp_leave_on`, `lengths_ends`, `leave_in`, `not_stated`; compatible days: wash, intensive care, bond repair, clarifying)

1. "Wenige Tropfen zwischen den Handflächen verreiben und anwärmen, bis beide Hände dünn benetzt sind."
2. "Zuerst in die handtuchtrockenen Spitzen einarbeiten, dann den Rest über die Längen streichen. Den Ansatz aussparen, nicht ausspülen."
   - Amount: "Wenige Tropfen verwenden." → V2 `few_drops`

**`dry_finish`** (`dry_finish`, `lengths_ends`, `leave_in`, `not_stated`; compatible days: wash, intensive care, styling, between-wash)

1. "Wenige Tropfen zwischen den Handflächen verreiben und anwärmen, bis beide Hände dünn benetzt sind."
2. "Zuerst in die trockenen Spitzen einarbeiten, dann den Rest über die Längen streichen. Den Ansatz aussparen, nicht ausspülen."
   - Amount: "Wenige Tropfen verwenden." → V2 `few_drops`

**Per-protocol values:**

- Source: the KM how-to article, labelled `KEVIN.MURPHY Hersteller-Artikel (Anwendung YOUNG.AGAIN)`, `sourceType manufacturer`, checked 2026-09-29.
- Deviation: `null`. The source contradicts no template rule.
- V2 heat facts: `null`. Heat is a spec capability, not a protocol role.

**Note for Nick (runtime reality):** the V2 compiler renders the _shared family template_ copy, not the stamped V1 step text. Users will see:

- Leave-on: "Sparsam in handtuchtrockene Längen und Spitzen verteilen. Nicht ausspülen."
- Dry finish: "Mit 1 Tropfen oder einer sehr kleinen Menge beginnen, …"

This is identical to every other Oil.

**Pump dispenser vs. "Tropfen" copy (ruled by Nick 2026-09-29: accepted as-is).** YOUNG.AGAIN is dosed by pump ("a few pumps"). X6 only parks _spray_ oils, and the Gliss Öl-Elixier (dosed as "1-2 Pumpstöße") already carries the same droplet template. A dispenser-neutral rewording of the template stays parked (§9).

**Removed leave-in rows.** DAMP, DRYCARE, `post_style_finish` (a parked family) and the leave-in heat row. None has an Oil equivalent beyond the two above.

## 5. Execution lane: a reviewed one-shot SQL migration

**Precedent search:**

- No live category flip exists in the repo.
- The closest reviewed patterns are:
  - `20260901090000_k18_molecular_repair_hair_mist_readiness.sql`: a one-product correction with an exact preimage, a receipt in `catalog_enrichment_applied_items` and replay idempotency.
  - `20260903083832_simplify_oil_heat_capability.sql`: an Oil role rewrite with Personal Plan SHARE locks, a collision proof and `SET CONSTRAINTS ALL IMMEDIATE` before the postflight.
  - `20260914170000_personal_plan_stage5_v2_pointer_delta_executor.sql`: the shared advisory lock taken before product row locks, plus post-write self-verification.
- The expansion executor and the v2-delta executor both refuse a recategorized product by design. The pointer delta raises `…missing, inactive, or recategorized`.
- Retired Oil repair apply CLI (`oil_repair_apply_retired_use_oil_heat_capability_migration`) → no TS apply lane fits.

That leaves a generated, reviewed one-shot migration in the K18 style.

**The schema forces this order:**

1. Every category table references `products(id, category_key)` **ON UPDATE RESTRICT**, which is checked immediately. That covers leave-in specs and eligibility, protocols (via the generated `category_key`), and thickness and concern eligibility. So every `(id,'leave_in')` child must be deleted **before** the `category_key` UPDATE. Oil children can only be inserted **after** it, because their FK needs `(id,'oil')`.
2. `product_thickness_eligibility` and `product_concern_eligibility` are projected by the `aa_/zz_catalog_authority_sync_product_eligibility_compat_v1` triggers. Those fire only on `UPDATE OF suitable_thicknesses, suitable_concerns`, so the UPDATE names both columns. Oil eligibility's BEFORE-INSERT trigger adds the thickness row too, with `ON CONFLICT DO NOTHING`.
3. The curated-publication gate is a **DEFERRABLE INITIALLY DEFERRED** constraint trigger. Every delete, the category transition and every insert queues a check, and all of them see the final Oil state. `SET CONSTRAINTS ALL IMMEDIATE` flushes the checks inside the migration, and the postflight then calls `assert_personal_plan_curated_publication()` explicitly.

**Migration shape** (`BEGIN … COMMIT`, one product):

1. **Locks:**
   - `SET LOCAL lock_timeout='5s'`
   - Shared advisory lock `pg_advisory_xact_lock(hashtextextended('catalog-enrichment:product-apply', 0))`, taken **before** any row lock.
   - `LOCK TABLE … IN SHARE MODE` on the Personal Plan and ownership sources, as in the heat migration.
2. **Replay:** if a matching receipt exists (same fingerprint, `reviewed_by='nick'`), skip to the postflight. A receipt for the batch under any other key aborts.
3. **Preimage guards.** These are the generator's shared `PRESTATE_CHECKS`, emitted as `IF (…) IS NOT TRUE THEN RAISE`, so a NULL predicate fails closed:
   - `FOR UPDATE` on the product, then on every child table.
   - Product identity and every field that changes, including `updated_at`.
   - Exact jsonb content equality of every child preimage against the snapshot, with timestamps excluded. The protocols' `max(updated_at)` is still pinned.
   - No existing Oil rows.
   - No disposition, and no plan or owner reference.
4. **Deletes**, each with a checked `ROW_COUNT`: 4 protocols, 4 eligibility rows, 1 spec, 1 fit spec, 2 concern rows, 1 thickness row, 1 evidence row.
5. **Category flip:** the products UPDATE, guarded `WHERE category_key='leave_in'` with `ROW_COUNT = 1`.
6. **Inserts:** Oil spec, eligibility, 2 protocols with V1 and V2, 2 evidence rows, and the receipt `S5R-03-km-young-again-oil-recategorization` / `oil-recategorization:<id>`.
7. **Postflight:**
   - `SET CONSTRAINTS ALL IMMEDIATE`.
   - Run the generator's shared `TARGET_CHECKS`, the same list that `verify.sql` and the rollback precheck use. Each check proves byte-exact (jsonb-normalized) equality with `target-state.json` for:
     - the product row
     - no surviving leave-in authority
     - the Oil spec and eligibility
     - both protocols, including the V1 and V2 payloads
     - the thickness and concern projection
     - both provenance rows, including fact values, source text and fingerprints
     - the receipt
   - `PERFORM assert_personal_plan_curated_publication(id)`.

**Re-apply coherence.**

- **After a rollback:** `rollback.sql` restores `products.updated_at` and every child row exactly (asserted), and deletes the receipt. The forward guards match again, and a re-run takes the fresh path with the same fingerprint.
- **After an intact apply:** a re-run takes the receipt path.
- **Supabase migration history:** it records the version on the first apply, so a post-rollback re-apply runs this same file as a targeted step. It does not get a new migration version.

**Apply lane (Nick-gated, later):**

- Targeted, reviewed application of this single file. Per the runbook convention: no blanket `supabase db push`, never through the MCP.
- The preimage guards make a stale apply abort instead of writing.
- Before applying:
  1. Run the Codex whole-branch review (`request-code-review`).
  2. Re-capture the pre-state read-only and confirm `prestate-2026-09-29.json` is unchanged. The guards enforce this anyway.
  3. Get Nick's explicit go.

**Not verified here, and why:**

- No local Postgres or Docker daemon was available, and a production dry-run would be a write, so the SQL has had **no execution rehearsal**.
- Recommended before apply: rehearse on a Supabase branch database or a local stack. `SET CONSTRAINTS`, the trigger ordering and the jsonb-equality guards are the parts most worth exercising.

## 6. Verification: exact read-only proof (run after the Nick-gated apply)

Run `plans/kevin-murphy-oil-migration/verify.sql` read-only against production. It is generated, and its checks are the migration postflight's own `TARGET_CHECKS`. Nothing in it is inspected by eye; every check is an exact-equality predicate.

**Expected output:**

| Query                   | Expected                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| 1. Full target proof    | **zero rows.** Any row returned names a failing check.                                      |
| 2. Plan/owner reference | **zero rows**                                                                               |
| 3. Scanner identifier   | **zero rows.** The EAN set is still exactly `{09339341020356}`.                             |
| 4. Publication gate     | exactly one row with an empty (void) value and **no error**; the function raises on failure |

**What query 1 proves**, with each check compared byte-exactly (jsonb-normalized) against `target-state.json`:

- **`product_target`:** the **full** product row (`to_jsonb`) equals the snapshot row with exactly the reviewed fields overridden: category, legacy category, tags, all three thicknesses, concern, description and net content. Every other column must still hold its snapshot value.
  - Two columns are governed omissions, not silent ones.
  - `updated_at` is bumped by the updated-at trigger on the apply and again on the planned embedding refresh (§8), so it can't identify the target.
  - `embedding` is never written by the migration and isn't in the snapshot; the rollback clears it (§7).
- **`oil_rows_untouched_since_apply`:** every `created_at` and `updated_at` on the Oil rows equals the receipt's `created_at`. That covers the spec, eligibility, protocols, evidence and thickness/concern rows. All of them are written in the apply transaction with `now()`, so any later rewrite breaks the equality.
- **`no_leave_in_spec`, `no_leave_in_fit_spec`, `no_leave_in_eligibility`:** no leave-in authority survived.
- **`oil_spec_target`, `oil_eligibility_target`:** exact rows, with no extras.
- **`protocols_target`:** every protocol row of the product, including its **deterministic row id**, the full V1 `guidance_payload` and V2 `guidance_payload_v2`, source label, URL and text, and the generated family. A replaced row with identical content but a new id fails.
- **`thickness_eligibility_target`, `concern_eligibility_target`:** exactly `oil:coarse, oil:fine, oil:normal` and `oil:styling-oel`, across all categories.
- **`fact_evidence_target`:** every evidence row of the product, including fact values, source label, URL, text and type, `checked_at`, `batch_id` and both fingerprints.
- **`receipt_target`:** exactly one receipt for the batch, with the matching fingerprints and `reviewed_by='nick'`.

**Also after apply:**

- Run `npx tsx scripts/catalog-authority/audit.ts`, expecting no new issue for this product.
- Run the V2 pointer coverage audit (`scripts/product-intake/catalog-enrichment/stage5-v2-pointer-coverage-audit.ts`).
- Drive an Oil recommendation for each thickness and check the Anwendung view shows the two Oil cards.
- Scan EAN 9339341020356 in the Produkt-Scan.
- Check Sentry for new errors (CLAUDE.local.md).

## 7. Rollback

`rollback.sql` is a prepared transaction, not a migration. It is generated alongside the migration and covered by the artifact manifest. What it does, in order:

1. **Locks and duration bounds** (P1-2, round-2 P2):
   - `TimeZone UTC`.
   - `lock_timeout 5s`, which bounds only lock **acquisition** waits.
   - The ACCESS EXCLUSIVE **hold** from step 3 is limited, but not strictly capped:
     - `statement_timeout 10s` caps every statement; each DO block is one statement.
     - `idle_in_transaction_session_timeout 5s` terminates the session, and so rolls everything back, if the client stalls between statements.
     - On PostgreSQL ≥ 17, `transaction_timeout 30s` caps the transaction while its timer is armed. It's set conditionally on `server_version_num`, because the local stack is 17 but the production version isn't verified here.
     - **These timeouts are not a wall-clock guarantee on blocked product reads.** They cover the timed statements and idle gaps (~6 × (10 s + 5 s) ≈ 90 s of coverable time), but PostgreSQL disarms the statement timer before commit processing — and PG 17 disarms the transaction timer before the durable commit — while the lock is still held, so a slow `COMMIT` sits outside every timeout. The operational bound is the reviewed expectation (well under 1 s: one product, keyed lookups, small Personal Plan tables), which the mandatory branch-database rehearsal must confirm by measuring the actual lock-hold time before any production run.
   - The same shared advisory lock and the same Personal Plan and owner `SHARE` table locks as the forward migration, taken **before** the reference check. A plan can no longer acquire an Oil reference between the check and the commit.
2. **Trigger precheck** (P1-1): `products` has exactly one non-internal trigger calling `update_updated_at_column()`, namely `set_updated_at_products`, and it is enabled.
3. **Disable the trigger:** `ALTER TABLE public.products DISABLE TRIGGER set_updated_at_products`, before any DML, so `products` has no pending trigger events.
   - **Precedent:** `20260812143000_personal_plan_legacy_quiz_source.sql` and `20260814191843_…_stage5_v2_authority_reconciliation.sql` both disable one named trigger inside the migration transaction.
   - **Why it's safe:**
     - `ALTER TABLE` holds ACCESS EXCLUSIVE on `products` until COMMIT, so no other session can write products while the trigger is off.
     - A failure rolls the trigger state back with the transaction.
     - `session_replication_role = replica` is deliberately **not** used, because it would also silence FK enforcement and the eligibility compat triggers the restore relies on.
   - **Trade-off:** reads of **all** products block while the lock is held.
   - **Operational expectation (reviewed):** the hold stays well under 1 second (one product, keyed lookups, Personal Plan tables of a few hundred rows). Run it in a low-traffic maintenance moment, as a single `psql` file (`-v ON_ERROR_STOP=1 -f`), never interactively.
4. **Target precheck** (P1-3): the generator's `TARGET_CHECKS`, the same list as the postflight and `verify.sql`.
   - The complete live Oil state must equal `target-state.json` byte-exactly: the full product row, spec, eligibility, protocols including **row ids**, payloads and pointers, evidence including fact values, source text and fingerprints, receipt, and thickness/concern rows. Every Oil row's timestamps must still equal the apply transaction's time.
   - Any post-apply revision makes the rollback refuse instead of silently destroying it.
   - The plan/owner reference check runs under the locks from step 1.
5. **Delete** the Oil rows and the receipt. Every delete has a checked row count, including the 3 thickness rows and 1 concern row (round-2 P3).
6. **Restore the exact pre-values:**
   - `products`: the old category, tags, concerns and description, `net_content NULL`, and `updated_at 2026-08-15T07:47:38.210968+00`. The timestamp sticks because the trigger is off.
   - `products.embedding` is set to **NULL**. It isn't in the snapshot, so it can't be restored exactly. After the planned refresh it would be an Oil vector, and silently keeping it on the restored Leave-in description is the one wrong option.
   - Every deleted leave-in row, re-inserted with its **original ids and timestamps** from `prestate-2026-09-29.json`:
     - 1 spec
     - 1 fit spec
     - 4 eligibility rows
     - 4 protocols: `058cd3f2…`, `f013b935…`, `40edd227…`, `4a4e0bd1…`
     - 1 thickness row
     - 2 concern rows
     - 1 `leave_in.authority_facts` row
7. **Re-enable:** `SET CONSTRAINTS ALL IMMEDIATE` flushes the deferred gate and FK events, then `ENABLE TRIGGER set_updated_at_products`.
8. **Verify:**
   - The trigger is enabled again (`tgenabled='O'`).
   - The forward migration's own `PRESTATE_CHECKS` pass, which proves re-apply coherence.
   - Full-row equality, timestamps included, of the product row (minus `embedding`) and every restored child row against the snapshot.
   - `embedding IS NULL`.
   - No forward receipt remains.
   - The publication gate passes.

9. **Mandatory post-rollback step: regenerate the embedding.** This is a separate, Nick-gated one-row write after the rollback commits.
   - Embed the restored description with the same model and dimensions as `generateEmbedding()` in `scripts/ingest-products.ts` (`text-embedding-3-large`).
   - Write it to `products.embedding` for this id.
   - Until then the product is absent from vector search only: `match_products` filters `embedding IS NOT NULL`. The structured leave-in matchers are unaffected.
   - `scripts/backfill-null-embeddings.ts` covers `content_chunks` only, not `products`, so it does **not** do this.

**Fail-closed caveat:** if an unrelated `products` column (e.g. price) changed after the apply, the full-row check aborts the rollback. The snapshot must then be re-captured and the artifacts regenerated. That's intended: an exact restore over newer data would be a lie.

## 8. Out of scope: follow-ups this change surfaces (not done)

1. **RAG chunk still says Leave-in.** `content_chunks` id `9cb5fa01-…` (`produktmatrix/leave-in`, normal/performance) lists "Kevin Murphy Young Again". It's regenerated from the Excel product matrix by `scripts/ingest-product-chunks.ts`, which also means the Excel/JSON source still carries the leave-in row. The source needs editing, then a re-ingest.
2. **`products.embedding` becomes stale.** The description changes, but the migration leaves the embedding alone, and `backfill-null-embeddings.ts` only covers `content_chunks`. Re-embed deliberately with the `ingest-products.ts` model. Doing so bumps `products.updated_at`, which the exact-target checks deliberately don't pin. If a rollback ever follows, it clears the embedding and §7 step 9 regenerates it.
3. **Historical data artifacts stay leave-in:** `data/catalog-enrichment/personal-plan-stage5-*/*.json`, the scanner coverage JSONs, and `tests/personal-plan-leave-in-use-case-manifest.test.ts`. They're file-based and unaffected by the DB, so the test stays green. The receipt and ledger rows (10 + 1) stay as history, and any replay of those old batches would now fail its guards. That's intended.
4. **Gliss Öl-Elixier (`e93d522b…`) bugs seen while reading references.** Its live Oil protocols carry `guidanceKey "product-oil-__PRODUCT_ID__-leave-on"` / `"…-dry"`: the expansion executor substitutes `scope.productId` but not the key. Its leave-on row also lists `styling_day` in `compatibleDayTypes`, which contradicts the ruled TPL-OIL-LEAVEON day set. It's worth checking every expansion Oil for the same two issues.
5. **YOUNG.AGAIN reformulation.** The EU D5/D6 deadline is 6 June 2027, so INCI and weight need re-verifying once KM reformulates.

## 9. Settled rulings (Nick, 2026-09-29)

- **Category:** YOUNG.AGAIN moves from `leave_in` to `oil`, researched to the Oil standard ("It's a leave-in oil, but this is also true for all other oils we have in our oil category.").
- **Thickness:** all three (`coarse`, `fine`, `normal`). Evidence: `oil-thickness-comparison.md`.
- **Slot:** `styling-oel` / `styling_finish`.
- **Dosing copy:** the ruled "Wenige Tropfen" TPL-OIL copy is accepted as-is for this pump-dispensed oil, following the Gliss precedent.

## 10. Open questions for Nick (⚖️ recommendation first)

1. **Dispenser-neutral template rewording** (parked): should TPL-OIL's droplet dosing line get a dispenser-neutral variant for pump oils? This is a template ruling for all oils, not for this migration.
2. **Product copy:** approve the new `description` text, and keep the name "Kevin Murphy Young Again" (recommended) rather than renaming to "Kevin Murphy Young.Again Treatment Oil".
3. **`is_chaarlie_recommended`:** stays `true`, as the ruling implies. Confirm it should now compete in the Styling-Öl Oil slot across all three thicknesses.
4. **Follow-ups (§8):** spin off the RAG re-ingest, the embedding refresh and the Gliss guidanceKey/day-type fix as separate tasks?
5. **Rehearsal:** run the migration, `verify.sql` and `rollback.sql` once end-to-end on a Supabase branch database before the production apply? Recommended, because nothing has had an execution rehearsal yet (§5).
