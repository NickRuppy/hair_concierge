# S5 — One catalogue row per category for multi-use products (slice plan)

**Status:** Rev. 1 (2026-10-09), implementation-ready. Open: §12 Q1–Q3 (product-level; Q1 gates S5d research only, Q2 gates T5.12 scope only, Q3 gates T5.5b only — none blocks T5.1–T5.5). Program plan: `../plan.md` §2, §8b S5, §11 F12–F15. Rulings: `../decisions.md` M1, M2, O1–O4, X2, X3. Mockups: `../mockups/mockup-2-scan-multi-use.html` (scan + save), `../mockups/mockup-3-plan-same-package.html` (plan, variant 1). Where X2 (first round) and O1/O2 (third round) differ — X2's sheet „Wofür verwendest du es?" with footer „Zurück zur Auswahl" | „Trotzdem speichern" — the later O1/O2 wording and mockup frames 1–4 govern.

**Baseline.** Worktree `.worktrees/catalog-completeness-fill`, branch `codex/catalog-completeness-fill`, HEAD `57ae223f` (origin/main merged: #654 Budget + Profi `746bf6df`, #655 market-segment backfill `320940f4`, #657 Shampoo v1.6 lock `d4e67ffd`). S5 builds on S1 applied in production (`supabase/migrations/20261009190000_catalog_completeness_fill_slice1.sql`: Midnight Serum oil row `21a94166` tombstoned → leave-in `6b01025d`, GTIN 3600524135805 moved; Balea Aqua 3in1 150 ml on both rows). Every file:line below is against this HEAD; every live count is a read-only prod SELECT of 2026-10-09.

**Sources read.** `research/x1-multi-use/facts.md`, `research/x4-migration-pattern/facts.md`, `research/r3-identity-cadence-duplicates/findings.{md,json}`, `docs/catalog-authority.md`, scan web + mobile + iOS code, `budget-policy.ts`, intake matching/apply, engine charters. Three read-only mapping lanes (Sonnet) were used for the GTIN-owner inventory, the mobile/iOS contract and the plan/commerce counting sites; their findings are folded in below with file:line.

---

## 0. Summary of the design

1. **A package is a table row; products point at it.** New `product_packages` table + nullable `products.package_id`. Unique `(package_id, category_key)` ⇒ at most one row per category per package. Single-use products stay `package_id = NULL` (no churn for ~370 rows).
2. **The barcode stays on exactly one row of the package (the "identifier holder").** The global unique GTIN owner index is **unchanged**. Siblings are reached from the holder via `package_id`. This keeps every single-owner reader (scan lookup, intake matching, expansion apply, retailer search, price audit, mobile history, scanner backfill, Bondbuilder validator — 15+ sites, §1.3) correct without rewriting them.
3. **Sibling ≠ replacement.** Siblings are active peers linked by `package_id`; `replaced_by` keeps meaning "tombstone → keeper". A tombstone may not stay in a package.
4. **Scan**: lookup → holder → package expansion → evaluate every use → show one (saved use, else needed use, else best fit) + `packageUses[]` for the „Auch nutzbar als" line and the save sheet. Additive contract fields only; mobile `contractVersion` stays 1.
5. **Plan**: selection stays independent per slot (no bonus, no penalty). When two slots land on one package, the second card says „Dieselbe Packung wie beim …", the header and every purchase/budget count use a **purchase key** = `package_id ?? product_id`.
6. **Pantene 7in1 leave-in row** `f8f3b51d` is tombstoned into the oil row `5827a3b9`; the single owner row moves to the oil row (same bottle), frozen history stays frozen; the 7 active routines that plan it either get a re-picked leave-in (recommended, new reusable lane T5.5b) or degrade that one step (today's behaviour) — §12 Q3.
7. **Four sub-PRs** (S5a identity + data foundations, S5b scan/save, S5c plan, S5d intake + research batch), behind one server flag `CATALOG_PACKAGES_ENABLED` for the user-facing parts.

---

## 1. Identity schema (F12)

### 1.1 Entity: table + FK column (chosen)

```sql
CREATE TABLE public.product_packages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_label text NOT NULL CHECK (btrim(internal_label) <> ''),   -- e.g. 'garnier-hair-food-macadamia-400ml'
  source_batch  text NOT NULL CHECK (source_batch ~ '^S5P-[0-9]{2}-[a-z0-9-]+$'),
  reviewed_by   text NOT NULL CHECK (reviewed_by = 'nick'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_packages ENABLE ROW LEVEL SECURITY;   -- admin SELECT policy only (mirror product_relationships_admin_*); runtime reads go through products.package_id with the admin client
ALTER TABLE public.products ADD COLUMN package_id uuid NULL REFERENCES public.product_packages(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX products_package_category_unique ON public.products (package_id, category_key) WHERE package_id IS NOT NULL;
CREATE INDEX products_package_id_idx ON public.products (package_id) WHERE package_id IS NOT NULL;
-- + set_updated_at_product_packages trigger
```

Rejected alternatives:
- *New `product_relationships` type `same_package_as`*: pairwise edges need n·(n−1)/2 rows for a 3-in-1, have no natural "one row per category" constraint, and every relationship reader would have to learn a peer edge (`selection.ts:121-128` already excludes *any* outgoing edge of the two existing types by literal; a third type is ignored, but the package query becomes a graph walk). Also needs the CHECK in `20260503123000:19-21` dropped/re-added and `src/lib/types.ts:237-239` widened.
- *Column only (`package_key text`)*: no FK, nowhere to hang the review receipt; same query shape as the chosen option otherwise.
- *Commerce moved onto the package row*: correct in theory, but every reader of `products.price_eur/affiliate_link/image_url` (routine commerce, scan presentation, wishlist, chat, admin, price audit) would change. Out of proportion for ~22 packages; commerce equality is enforced instead (§1.4).

### 1.2 Invariants (DB, deferred constraint trigger `validate_product_package_v1`)

`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` on `products` (INSERT; UPDATE OF package_id, category_key, is_active, lifecycle_status) and on `product_identifiers` (INSERT/UPDATE OF product_id/DELETE), asserting at COMMIT for each touched package:

| ID | Invariant | Why |
|---|---|---|
| P1 | ≥ 2 members, every member `is_active AND lifecycle_status='active'` | a one-member or retired-member package is meaningless; retirement must clear `package_id` in the same transaction |
| P2 | members have pairwise distinct `category_key` | also enforced by the unique index; trigger gives a readable error |
| P3 | all barcode identifiers (`canonical_gtin14 IS NOT NULL`) of the package sit on **one** member (the identifier holder); zero is allowed | keeps the global owner index and makes the holder well-defined |
| P4 | no member is the source of a `replaced_by` edge | sibling ≠ tombstone |
| P5 | if a member has a Bondbuilder `research_profile`, it is the holder | `bondbuilder_validate_bound_row_v1` (`20261002132306:451`) needs the profile GTIN on the same product; none of the 22 candidates is a Bondbuilder, so this is a guard, not a migration |

Commerce/identity equality is **audit-enforced, not DB-enforced** (§1.4), because a DB rule would make today's single-row writers (price audit `scripts/price-audit/run.ts:239-255` CAS update per id, admin product edit, image corrections) fail on packaged rows before they are made package-aware.

### 1.3 GTIN ownership: identifier holder, owner index unchanged (chosen)

`idx_product_identifiers_canonical_gtin14_owner (canonical_gtin14)` (`20260826142200:49-51`) stays. The package's barcode(s) live on one member. Lookup resolves holder → `package_id` → siblings.

Why not "one GTIN row per member" (unique on `(canonical_gtin14, product_id)` or `(canonical_gtin14, category_key)`): these single-owner sites would all need rewrites (mapping lane, verified samples):
- `src/lib/scan/identifier-lookup.ts:67-74` (>1 active owner → `scan_identifier_collision` → null = every scan misses);
- `src/lib/mobile/scan-service.ts:415-448` (any non-resolved owner rows → `unavailable`, dm never called);
- `src/lib/mobile/history-service.ts:238-275` (barcode reopen `available` only when `matches.length === 1`);
- `src/app/api/scan/search-retailer/route.ts:213-243` (`singleProductId` else dm-only);
- `src/lib/product-intake/product-matching.ts:439` (`identifierMatches.length === 1` for auto-link), `:268-286`, `:459-464`;
- `src/lib/product-intake/expansion-apply.ts:260-263` (single-valued `identifierOwners` map), `:346`, `:601`;
- `src/lib/product-intake/catalog-enrichment/scanner-identifier-backfill.ts:660-667`, `:742-744`;
- `scripts/price-audit/run.ts:201-214` (`productsByGtin`, skips `size !== 1`);
- SQL: `product_identifier_assert_canonical_owner_available` (`20260826142100:4-42`), `apply_scan_expansion_batch_v1` (`20260902160000:437-443`), `apply_scanner_existing_identifier_backfill_v1`, `bondbuilder_internal_admit_v1` (`20261006143746:82`), `mobile_scan_history` `UNIQUE (user_id, barcode_gtin14)` (`20260919130450:16`).

With the holder model only three places learn about packages: the scan resolver (expansion), intake matching/link-existing (§4.1), and the price audit (sibling write-through, §1.4). Every other single-owner reader stays correct because it still sees exactly one owner.

Holder choice in the backfill = the row that owns the GTIN today (no identifier moves). When a holder is later retired, the GTIN moves to another member in the same transaction (existing S1 tombstone pattern) — P3 then still holds.

`retailer_sku` on siblings (R3 proposal "add `retailer_sku dm:…` to the sibling") is **superseded**: siblings are found by package, not by SKU.

### 1.4 Commerce and identity equality (audit + writers)

Package-level fields must be equal across members: `affiliate_link`, `image_url`, `thumbnail_image_url`, `price_eur`, `currency`, `price_checked_at`, `purchase_link_status`, `net_content_value`, `net_content_unit`, `brand_id`, `product_line_id`, `brand`, `name`, `market_segment` (#655: required for recommended rows).

- **Audit** (`src/lib/catalog-authority/audit.ts`, `audit-reader.ts`): new findings `package_member_inactive`, `package_single_member`, `package_identifiers_split`, `package_member_superseded` (all also DB-blocked — audit mirrors for snapshot replays), `package_commerce_divergent`, `package_identity_divergent`. Reader loads `product_packages` + `products.package_id`. The audit today has no identifier checks (mapping lane: grep `identifier|gtin` in `src/lib/catalog-authority` empty), so `package_identifiers_split` is the first; it needs `product_identifiers` added to the declared relations.
- **Price audit write-through** (`scripts/price-audit/run.ts:225-255`): after a successful CAS update of the holder, update every sibling with the same values in the same request (`.in("id", siblingIds)` with each row's CAS on the old price). Siblings have no GTIN, so the runner never selects them on its own (`:211`).
- **Docs**: `docs/catalog-authority.md` gains a "Packages (multi-use products)" section: package entity, holder rule, sibling vs tombstone, equality list.

### 1.5 Backfill: the known pairs (state after S1 apply)

| Package | Members (category, id) | Holder (GTIN) | Recommended | Harmonise | Ruling |
|---|---|---|---|---|---|
| PKG-1 Garnier Hair Food Macadamia 400 ml | conditioner `4c3e1a63`, leave_in `a72d630d` | `a72d630d` (03600542511612) | both | nothing (link, image, price 5.95, 400 ml already equal) | keep both (R3 §4, garnier.de Spülung/Maske/Leave-In) |
| PKG-2 Garnier Hair Food Aloe Vera 400 ml | leave_in `0307c903`, mask `52264c47` | `52264c47` (03600542511049) | both | brand „Fructis"→Garnier brand/line ids, name → one manufacturer name, image → holder's | keep both (garnier.de Kopfmassage/Maske/Leave-In) |
| PKG-3 Balea Aqua Hyaluron 3in1 150 ml | leave_in `c6e80f39`, mask `55727898` | `55727898` (04066447668315) | neither | name „3in1"/„3 in 1" → one, image → holder's (net content set by S1) | keep both (dm: Haarmaske, Leave-in, Over-Night) |
| PKG-4 Guhl Panthenol + Reparatur 2in1 200 ml | conditioner `11d42d9d`, mask `8ef172f7` | `11d42d9d` (04072600703403) | both | image → holder's | keep both (dm: Spülung / Kur; Mask R1) |
| PKG-5 Balea Tiefenreinigung 250 ml | shampoo `0f71ff9d`, deep_cleansing_shampoo `375ee7a0` | `375ee7a0` (04070765001020) | both | name „Balea Tiefenreinigung"/„Shampoo Tiefenreinigung" → one, image → holder's | keep both (Shampoo v1.6 R6) — coordinate the name with the v1.6 program |

Not packages: Midnight Serum (S1 tombstone), Pantene 7in1 (retired in §5). Live check 2026-10-09: none of the 10 rows has scan wishlist/history entries; owners: `0307c903` 1, `55727898` 1; no draft/routine contains both rows of a pair (X1 §3).

Image rule: holder's `image_url`/`thumbnail_image_url` win unless the sibling's asset is a processed packshot and the holder's is not (generator prints both; Nick's batch approval covers the choice). Name rule: `brand_id` + `product_line_id` + clean name per `docs/product-catalog-identity-rules.md`; `UNIQUE(name, category)` is unaffected (different categories). Renames make `products.embedding` and product `content_chunks` stale → follow-up re-embed (`scripts/ingest-products.ts`, KM plan §8 precedent).

### 1.6 Types, RPCs, readers

- `src/lib/types.ts`: `Product.package_id: string | null`, `ProductPackage`. Supabase select-column contract test (`tests/supabase-select-columns-contract.test.ts:129`) replays the ADD COLUMN.
- New module `src/lib/catalog/packages.ts`: `loadPackageMembers(client, productId) → PackageMember[]` (holder's or any member's id in; active, lifecycle-active members out, ordered by `PERSONAL_PLAN_PRODUCT_CATEGORIES` order), `purchaseKey({productId, packageId})`, `isSamePackage(a, b)`. One keyed query (`products` where `package_id = (select package_id from products where id = $1)`).
- No new read RPC. Writes: S5a data only by guarded one-shot migrations; S5d sibling creation by the same generator pattern (§4.3).

### 1.7 Migrations, rollback, rehearsal

- **M-S5a-1 schema** `supabase/migrations/2026101xxxxxxx_product_packages.sql`: table, column, indexes, `validate_product_package_v1()` + two constraint triggers, RLS + admin policy, grants (service_role). Pure DDL, no data; fresh DB safe. Rollback = `plans/catalog-completeness-fill/s5/rollback-schema.sql` (drop triggers/fn/indexes/column/table; refuses if any `package_id` is non-null).
- **M-S5a-2 backfill** `..._catalog_packages_backfill_s5a.sql`, generated by `plans/catalog-completeness-fill/s5/generate.ts` (KM structure: prestate JSON, `--check`, fingerprint, `artifact-manifest.json`, `rollback.sql`, `verify.sql`): shared advisory lock `catalog-enrichment:product-apply` first; `SET LOCAL lock_timeout/TimeZone`; P08-style fresh-DB skip (return when none of the 10 ids exist); preimage CAS on every touched products row (incl. `updated_at`) and on the 5 holder identifier rows; INSERT 5 `product_packages` (fixed uuids from the generator); UPDATE harmonised fields + `package_id`; evidence rows (`fact_key='product.package'`, manufacturer source per pair from R3) + receipt rows in `catalog_enrichment_applied_items` (batch `S5P-01-known-pairs`, `reviewed_by='nick'`); `SET CONSTRAINTS ALL IMMEDIATE`; postflight TARGET_CHECKS + `assert_personal_plan_curated_publication(id)` for the 8 recommended rows. Rollback restores prestate byte-exactly (disables only `set_updated_at_products`, KM rollback pattern), deletes the 5 packages.
- **M-S5a-3 Pantene retirement** (§5), same generator, batch `S5P-02-pantene-7in1`.
- **Rehearsal tests** (PGlite, `migratedDatabase()` from `tests/scan-expansion-batch-postgres.test.ts:332`, real prerequisite chain incl. S1 migration):
  - `tests/product-packages-schema-postgres.test.ts`: P1–P5 each rejected at COMMIT (one-member package; inactive member; duplicate category; GTIN on two members — impossible via owner index, so test "GTIN on member A, second GTIN on member B"; `replaced_by` source in package); single-use products unaffected; `SET CONSTRAINTS ALL IMMEDIATE` surfaces the error inside a migration.
  - `tests/catalog-packages-backfill-s5a-postgres.test.ts`: seeded prestate → forward → verify.sql zero rows → rollback → byte-exact prestate → reapply → receipt replay refuses → preimage tamper refuses → fresh-DB no-op.
  - `tests/pantene-7in1-retirement-postgres.test.ts`: §5 assertions.
  - Command pattern: `node --import ./tests/server-only-register.cjs --import tsx --test tests/<file>.test.ts`.
- Apply is Nick-gated per batch fingerprint, targeted (never blanket `db push`); ledger version alignment per X4 §A.12.

---

## 2. Scan and save end to end (F13)

### 2.1 Lookup → package expansion

`lookupCatalogProductByIdentifier` is unchanged (returns the holder). New step in both resolvers (web `src/app/api/scan/resolve/route.ts:356-425`, mobile `src/lib/mobile/scan-service.ts:118-152`), after the quarantine check:

```
members = flag ? loadPackageMembers(client, hit.productId) : []
members = members.filter(m => !quarantined(m))          // loadQuarantinedProductIdsAmong, one query
if members.length < 2 → today's single-product path (byte-identical)
```

The **productId** path (search tap, alternative tap, per-use navigation, history reopen) expands the same way. It takes a new optional body field `pick: "exact" | "auto"` (default `"exact"`): `exact` displays the requested member (alternative cards and „Auch nutzbar als" links must open exactly that use); `auto` applies §2.2 (grouped search rows send `auto`).

### 2.2 Which use is shown (exact rule, identifier path and `pick:"auto"`)

Every member is evaluated with the existing `loadScanVerdictForProduct` (in parallel; each against its own category decision from `context.snapshot.decisions`). Then the displayed member is the first by:

1. **Saved use** — a member with an owned+matched `user_products` row (any intake source). Several → category order. (Ruling: "after saving, the result shows the saved use".)
2. **Needed use** — members whose decision is needed (`!isNotNeeded(decision)`, `src/lib/scan/resolve-verdict.ts:119-124`); `needTier` `basis` before `optional` before null-tier-with-target.
3. **Best fit** within the group from (2), or across all members when none is needed: verdict rank `ideal < supportive < unknown < mismatch`, then coverage matches, then caution count — the existing `compareRoleEvaluations` (`src/lib/scan/role-selection.ts:45-56`), exported as `compareScanEvaluations` and reused, not copied.
4. Ties → category order (`PERSONAL_PLAN_PRODUCT_CATEGORIES`), then id.

No plan (no evaluation context) → today's `profile_missing`/`profile_required`, unchanged. All members not needed → step 3 compares `not_needed` payloads equal, so step 4 picks; the result is a normal `not_needed` sheet with the other-uses line.

Example (Nick's mockup): fine, dry lengths; conditioner `basis`, mask `optional`, leave-in `basis`. Conditioner = ideal, leave-in = mismatch (too heavy) → both needed+basis, best fit = conditioner → conditioner shown; line „Auch nutzbar als Maske › · Leave-in ›".

### 2.3 Payload (additive)

Web `ScanResolvedVerdictResult` and `ScanMaskedVerdictResult` (`src/lib/scan/types.ts:179`, `masked-alternative.ts`) gain:

```ts
packageUses?: {
  productId: string
  category: PersonalPlanCategory
  categoryLabel: string
  verdict: ScanVerdict | "not_needed" | "deferred"
  verdictLabel: string          // „Passt" | „Passt mit Einschränkung" | „Passt nicht" | „Unklar" | „Nicht nötig"
  displayed: boolean
}[]                              // absent for single-use products → byte-identical responses
savedState: ScanSavedStatePayload & { savedProductId?: string }   // package-scoped, see 2.5
```

Mobile (`src/lib/mobile/scan-contracts.ts:54-143`): optional `packageUses` with the same shape on `assessment`, `not_needed`, `profile_decision_deferred`. **`contractVersion` stays `1`**: the Swift decoder ignores unknown keys (`MobileClient.swift:307-309`, default `JSONDecoder`), while any new `kind`, new `verdict` value or `contractVersion: 2` throws `DecodingError` → generic „Die Verbindung ist gerade nicht verfügbar" (`AppModel.swift:521-526`), and there is no app-version header or minimum-version gate to steer old builds. Old builds therefore keep showing one verdict and simply do not render the line. Fixture `tests/fixtures/mobile/scan-v1.json` + iOS copy `ios/ChaarlieTests/Fixtures/scan-v1.json` get a packaged example; old-shape fixture kept.

Alternatives: a packaged product's siblings are excluded from its own alternatives list (same package ≠ an alternative). Alternatives of other products that are package members render as normal products (their own category).

### 2.4 Per-use navigation (O1, mockup frame 2)

Web: the line renders under the verdict header in `src/components/scan/scan-verdict-sections.tsx` (new `ScanPackageUsesLine`), one link per non-displayed use: „Auch nutzbar als Maske › · Leave-in ›". Tap → `POST /api/scan/resolve {productId: member, pick: "exact"}` → full result of that use in the same sheet with a two-button footer „Zurück" (primary, returns to the previous use's result from client state, no refetch) | „Speichern" (secondary; opens the save sheet). Buttons follow ChaarlieButton style (mockup). The per-use view does **not** dispatch the reducer's `resolved` action; a new `package_use_opened` action swaps the displayed result without touching `categoriesScanned`, `consecutiveMismatches`, the proactive trigger or `zweiScansGleicheKategorie` (`src/lib/scan/scan-flow-state.ts:323-372`) — one physical scan stays one scan.

iOS (`ios/Chaarlie/Assessment/AssessmentSheet.swift:26-130`): new `PackageUsesLine` view under the verdict; tap → `resolve(ScanRequest(productId:, pick: .exact, recordHistory: false))`; the use's `AssessmentSheet` is pushed with a footer „Zurück" (`ChaarlieButton(outline: true)`, `App/Theme.swift:50`). iOS has **no save, Merkliste or routine endpoint and no save UI today** (mapping lane) → the iOS footer has no „Speichern" (see §12 Q2). Decoding: `packageUses` is a lossy optional array (`[PackageUse]?` with a per-element `try?` wrapper, `verdict` decoded as `String` mapped to a local enum with an `.other` fallback) so a future value never fails the whole result.

### 2.5 Save into the chosen sibling (O2, mockup frames 3–4)

Sheet (`src/components/scan/scan-save-sheet.tsx`): when `packageUses.length > 1` the sheet renders title „Wohin speichern?", group label „Benutze ich schon als …", one row per use (category label + verdict chip from `packageUses[i].verdictLabel`, chip tone from the status token), then „Auf die Merkliste" (sub „Zum später Kaufen"). One tap saves, no confirm step. The row matching `savedState.savedProductId` shows the active state with „Entfernen" (today's pattern, `:220`). Single-use products: today's two-row sheet, unchanged.

Server: `POST /api/scan/save {productId: member, kind}` (schema unchanged, `src/app/api/scan/save/route.ts:18-23`). `scan_move_saved_product` (`20260904150000`) is replaced in a new migration with the **same signature**, package-scoped:

- lock key `scan_move_saved_product:<user>:<coalesce(package_id, product_id)>` (serialises moves across siblings);
- `routine` → insert owned `user_products` for **the chosen member** with `category = member.category_key` (the same-category trigger `validate_user_product_submission_link` is satisfied by construction), delete `scan_wishlist` rows of **all** members, and delete scan-owned (`intake_source='scan'`) owned rows of the **other** members (switching „als Conditioner" → „als Maske" is a move; Stage-3/intake-owned rows of other members are left standing, as today);
- `merkliste` → insert wishlist row for the chosen member unless any member is already wishlisted; delete scan-owned owned rows of all members;
- returned `savedState` is package-scoped: `merkliste` if any member wishlisted, else `routine` if any member owned (with `savedProductId` = first owned member in category order), else null; `managedByScan` as today.

`loadScanSavedState` (`src/lib/scan/saved-state.ts:31-52`) becomes package-scoped with the same priority; `removeScanRoutineProduct`/`removeScanWishlistProduct` act on the given member only. `parseSavedState` accepts the optional `savedProductId`.

After saving, the client re-resolves with `{productId: savedProductId, pick: "exact"}` only if the displayed use differs from the saved one (frame 4: „Gespeichert – als Conditioner in deiner Routine"). Copy: „Gespeichert – als {Kategorie} in deiner Routine" / „Auf deiner Merkliste".

### 2.6 Wishlist, history, free reveal, analytics

- **Auto-save** (premium resolve, `route.ts:529-549`, `saved-state.ts:147-162`): skip when any member is owned or wishlisted; otherwise insert the displayed member. Per-use navigation therefore never adds a second sibling.
- **Merkliste listing** (`src/app/api/scan/wishlist/route.ts`): one entry per package (dedupe by purchase key, keep the newest row); the entry opens with `pick:"auto"`.
- **Free reveal** (`src/app/api/scan/reveal/route.ts:183-199`): the lifetime credit is per package — `ledgered.productId === active.id` becomes `isSamePackage(ledgered.productId, active.id)`, so revealing alternatives on the leave-in view after the conditioner view does not consume or deny.
- **Mobile history** (`src/lib/mobile/history-service.ts`): `mobile_scan_history_touch` records the displayed member (unchanged call). Reopen by barcode keeps `matches.length === 1` (holder) and re-runs §2.2 (`pick:"auto"`); the entry's `productId`/`categoryLabel` use `row.product_id` when it is a member of the holder's package (`:252-255`).
- **Search** (web `src/app/api/scan/search/route.ts:121-153`, mobile `scan-service.ts:271-312`, shared `src/lib/scan/catalog-search.ts`): group members into one result (`id` = holder, `categoryLabel` = „Conditioner · Leave-in", `packageId`) so siblings do not eat the 8-result cap; tap sends `pick:"auto"`. Stage-3 per-category product search (owned-product capture) is category-filtered and stays per row.
- **Retailer search** (`search-retailer/route.ts:213-243`): holder model keeps `singleProductId` correct; the catalog row returned is the holder → opened with `pick:"auto"`.
- **Telemetry** `scan_resolve_events.matched_product_id` = holder (the identifier match), unchanged meaning.
- **Analytics** (`src/lib/scan/scan-analytics.ts`, `src/lib/analytics/events.ts:668-725`): `scan_result_shown` + `packageUseCount` (1 for single-use), `scan_saved` + `category`, new `scan_package_use_opened {fromCategory, toCategory}`. iOS has no analytics (unchanged).

### 2.7 Single-use regression

Flag off or `package_id IS NULL` ⇒ no `packageUses` key, same queries plus one cheap `package_id` read (folded into the existing presentation-row load), same save RPC semantics (lock key reduces to the product id). Tests pin byte-identical web and mobile payloads for a single-use fixture.

---

## 3. Plan: one package in two slots (F14)

### 3.1 Selection

Each slot keeps choosing independently (fit → budget policy). A package lands in two slots only when it is each slot's own pick — no bonus for "already chosen elsewhere", no penalty (O4: allowed edge case). No new guard in Stage-3 selection; the only selection-side changes are counting (3.3) and preserving the existing per-category candidate pools (siblings are ordinary candidates of their own category).

### 3.2 Cards and product sheet (X3, mockup 3 variant 1)

- Two routine cards remain two items (item keys are per assignment, `routine-candidate-compiler.ts:~262-263`, so they are already distinct), each with its own schedule. The **later** card in routine order replaces its role subtitle with „Dieselbe Packung wie beim {Kategorie im Dativ}" (copy map: „beim Conditioner", „beim Leave-in", „bei der Maske", „beim Shampoo", „beim Tiefenreinigungsshampoo", „beim Öl", „beim Trockenshampoo", „bei der Kopfhautpflege", „beim Bondbuilder", „beim Hitzeschutz"; Opus copy pass).
- **Derived at view time, never stored.** `loadActiveRoutineCatalogProductPresentation` (`routine/repository.ts:160-178`, used by `load-view.ts:72-105`) adds `packageId` to each catalog presentation row; `routine-item-card.tsx:107-122` (`catalogPresentationFor`) groups included items by purchase key. Frozen routine/portfolio payloads (immutable tables, `20260808062602:203`, `20260808062603:~85`) carry no package key and need none — absent package = no sharing. The routine compiler (`routine-candidate-compiler.ts:219-261`) is deliberately not changed.
- Header „Deine Routine mit N Produkten" (`routine-page.tsx:161-163`, copy `:240-242`): today counts included items; becomes included items with a product counted once per purchase key, plus items without a product as before (mockup: 5 cards → „4 Produkten").
- Over-budget notice (`routine/budget-gate.ts:33-40` `plannedRoutineProductIds`, `:69-80` `countRoutineProductsOverBudget`; shown at `routine-page.tsx:181`, `personal-plan-routine-client.tsx:422`): Set by purchase key.
- Product sheet: the card opens `/api/personal-plan/routine/items/${itemKey}` (`personal-plan-routine-client.tsx:704-722` → `product-detail-service.ts:161`, product row `:109-140`) rendered by `routine-product-detail.tsx`. For a packaged product the service also returns the other included items of the same routine sharing the purchase key; the sheet shows chips „Conditioner · Maske", „So nutzt du es" with one block per use („Als Conditioner …", „Als Maske …" from each item's application guidance), one price/size line, „Eine Packung für beide Anwendungen.", one „Zum Produkt" button. Either card opens the same content.

### 3.3 Counting by package (purchase key)

`purchaseKey = package_id ?? product_id`, a new field on `BudgetCandidate` (`budget-policy.ts:10-22`), populated where candidates are built: plan selection `computeProposalAllocation` (`production-persistence-gateway.ts:642-710`; include the purchase keys in its memo key `:606-640`), Stage-1 previews `allocateProposal` (`product-previews.ts:327-363`), fixtures (`fixture-gateway.ts:539`). The candidate pool is category-scoped (`authority/catalog-facts.ts:189`, `:242`), so two roles never see each other's rows — only the counts change:

- `uniqueCount` (`:190-192`) takes purchase keys ⇒ capped allowance `max(1, floor(0.25·N))` (`:186-188`, `:431-441`, `:501-506`) and the uncapped 60/40 rule (`targetFor = round(0.6·N)` `:542`, `highPriceCount` `:535-536`, swap pass `:543-554`) both use N = distinct packages. Today two members of one package count 2.
- `findPreserved`/`withPreserved` (`:213-228`) stay keyed by product id (a preserved choice is a specific category row).
- `inferBudgetSuggestion` (`:597-604`) and `capturedBudgetSuggestion` (`production-persistence-gateway.ts:1731-1758`, dedupe at `:1735-1741`) dedupe by purchase key.
- Scan (`resolve-verdict.ts:254`) and chat (`agent/tools/chat-budget.ts:95`) use ordering only (`orderStandaloneAlternatives`) — unchanged.
- Consult runsheet „Summe neu" (`lib/discovery/runsheet/locked-in.ts:111-117`, rendered in `components/discovery/cockpit/runsheet-locked-in.tsx:26`) sums per swap step — dedupe by purchase key.
- A role whose pick shares a package with a product the user already owns (any member owned) is treated like `ownedKept` for counting (not in N); the card shows the same-package line referencing the owned use and no „Kaufen".
- No cart or shopping-list total exists in the Personal Plan (mapping lane); `commerce.ts` (`presentCatalogCommerce`) is per-product presentation and needs no change beyond the shared sheet.

### 3.4 Ownership reconciliation

- `user_products` stays one row per (category, product) (`user_products_live_catalog_identity_key (user_id, category, catalog_product_id)`, `20260808062602:93-95`; `personal_plan_create_or_reuse_user_product` requires `products.category_key = p_category`, `20260811212000:260-290`; portfolio SQL validation requires owned/planned items to match their category, `20260808062603:~226-281`). Owning the conditioner member does **not** fill the mask slot.
- If Stage-3 independently picks the mask member while the user owns the conditioner member: the mask slot stays `planned` with „Dieselbe Packung wie beim Conditioner" and is not a purchase (3.3). No `user_products` row for the mask member is created automatically (it would claim a use the user never stated).
- „Gekauft" on one card (`planned-items/[itemKey]/acquire`, `routine/acquisition.ts`, RPC `personal_plan_acquire_catalog_product_for_routine` `20260808071000:224-256`) records ownership of that card's member only; the reconciler (`routine/source-reconciler.ts:35-62`, `:83-91`) flips planned assignments of that `plannedPurchaseId` within the category, as today. The other card then reads as owned package (no „Kaufen") through 3.3.
- Scan save of a member creates exactly that member's row (§2.5); the existing `user_products` trigger enqueues the `user_product` source change as today.

### 3.5 Recompute

Nothing is stored ⇒ no forced recompute for S5c. The counting change affects only newly computed allocations (#654 never silently replaces chosen products). The S5a backfill changes 10 product rows (names/images); routine presentation reads live rows.

---

## 4. Intake (F15) and engine standards

### 4.1 Matching and link-existing

- `product-matching.ts:421-466`: before the category-mismatch branch, expand identifier hits by package; if a member exists in `submission.category`, match that member (`matched`, same-category evidence = 1) instead of `identifier_category_mismatch_review`. The `identifierMatches.length === 1` clause (`:439`) counts packages, not rows.
- `product_intake_link_existing_product` (`20260826142100:194-257`) inserts a `source='scan'` identifier when the target lacks it; for a package member that would violate the owner index via `product_identifier_assert_canonical_owner_available`. New migration: allow the link when the GTIN's owner is a member of the target's package and skip the identifier insert.
- `submissions.ts:1035-1055` (`already_in_catalog` on scan submit): a GTIN owned by a package counts as in catalog for every member's category.
- A GTIN whose holder has **no** member in the submitted category stays `identifier_category_mismatch_review` (unchanged) and routes to the sibling research lane (4.3); the web review app has no link UI (`apps/product-intake-review` shows only brand candidates) — the CLI `scripts/product-intake/review.ts:100-129` prints the candidate.

### 4.2 Engine standard amendments (versioned overlays, never rewrites)

| Engine | Today | Amendment | Artifact |
|---|---|---|---|
| Conditioner v1.0 | charter `:22` and standard `:45`, `:281` (G0) exclude multi-use formulas; charter `:58` calls Guhl "one immediate rinse-out mode" | **v1.1 overlay**: mode-scoped multi-use, mirroring Mask R1 — a multi-use product is in scope for its manufacturer-named immediate-rinse Spülung mode only; envelope `multi_use`, `multi_use_covered_mode: "post_shampoo_rinse_out_conditioner"`, `multi_use_uncovered_modes`, `multi_use_directions_source_id`; never a comparison input; Guhl line corrected to "Spülung mode in scope; the 2–3-min Kur mode is Mask-engine territory (Mask R1)" | `docs/research/conditioner-inci/v1.1/conditioner-classification-overlay.v1.1.md` + `rule-changes.md` entry + lock receipt + manifest (pattern: `docs/research/leave-in-inci/v1.1/`) |
| Leave-In v1.1 | `dual_use_directions` flag + human review (`:185`, `:1764`); no multi_use envelope | **v1.2 overlay amendment** (S3 already opens v1.2; add one clause, no second version): when a sibling row of another category covers the rinse-out mode, the leave-in profile covers the leave-on mode only, envelope gains the same `multi_use_*` fields; `dual_use_directions` stays a review trigger only when no sibling covers the other mode | inside S3's v1.2 overlay; coordinate |
| Mask v1.0 | already mode-scoped (charter `:20`, standard `:113-138`); `:62` parks "cross-category multi-row architecture" | **no logic change**; README/charter note that the parked program is now S5 (scan disambiguation, double-slot, sibling intake) | `docs/research/mask-inci/README.md` note |
| Shampoo v1.6 | locked; R6 dual listing deep cleanser | none; PKG-5 name harmonisation coordinated with `.worktrees/shampoo-v16` | — |
| Oil | no engine | sibling oil rows follow the oil decision contract (`docs/personal-plan/categories/oil/decision.md`) with manually sourced facts, as for every current oil row | — |

### 4.3 Sibling creation path

Research → per-category engine envelope + production projection + protocol rows → generator (`plans/catalog-completeness-fill/s5/generate.ts`, batch `S5P-NN-…`) → guarded one-shot migration that, per package: CAS-guards the existing row, creates the package (or reuses), INSERTs the new member row (commerce/identity copied from the holder; `origin='curated'`; `market_segment` set), its category specs + eligibility (`expand_*` outputs written explicitly), V1+V2 protocols (`buildExpansionProtocolRow` / `buildProductApplicationPointerV2`), evidence, receipts, sets `package_id` on all members, `SET CONSTRAINTS ALL IMMEDIATE`, postflight publication assert. No new reusable executor (X4 §A.13: generic executors cannot take specs; volume ~20 rows does not justify one).

---

## 5. Pantene 7in1 leave-in row retirement (exact mechanism)

Live 2026-10-09: `f8f3b51d` leave_in active/recommended/curated; no identifiers (GTIN 08700216178402 already on oil `5827a3b9`); 1 owned `user_products` row (leave_in, `catalog_search`); 0 usage, wishlist, history, reveals, submissions, relationships, dispositions, discovery rows; protocols `post_wash_leave_in` ×2, `pre_heat_protection`; 1 evidence row; drafts: 13 `completed` + 1 `stale`, 0 `active`; routine versions: 12 rows / 7 users, **7 active routines** carry it as `planned {productId, plannedPurchaseId}`; portfolio versions: 13 (8 linked to active routines); 73 chat `messages.product_recommendations`; 0 proposals, refinement drafts, scanner contexts, content chunks.

Migration M-S5a-3 (batch `S5P-02-pantene-7in1`), in one transaction:

1. Shared advisory lock; `LOCK TABLE personal_plan_product_drafts, personal_plan_routine_proposals, personal_plan_refinement_drafts, user_products IN SHARE ROW EXCLUSIVE MODE`; CAS on the products row, the owner row and the oil row.
2. **Abort** if any `active` draft, pending proposal or refinement draft references `f8f3b51d` (today 0) — those would need the OGX path-patch; re-plan if live state changed.
3. Tombstone: `is_chaarlie_recommended=false, is_active=false, lifecycle_status='discontinued'` in one UPDATE; INSERT `product_relationships(f8f3b51d → 5827a3b9, 'replaced_by')` (cross-category edge; schema and audit allow it, `audit.ts:394-401`). Children (specs, protocols, evidence) stay — tombstones are exempt from facts (`docs/catalog-authority.md:63`), no deletes.
4. **Owner**: UPDATE the one `user_products` row to `category='oil', catalog_product_id='5827a3b9'` (same bottle; the same-category trigger passes because both columns change together; unique `(user, oil, 5827a3b9)` pre-checked free). The `personal_plan_user_products_enqueue_source_change` trigger fires for that plan.
5. **Plans with an active routine planning the leave-in row (7)**: nothing in SQL. What exists today: the routine outbox (`personal_plan_enqueue_routine_source_change`, `20260808062603:138-158`) only reconciles `user_product` sources (`source-sync-service.ts:151-158`; other kinds are terminal or ignored) and never re-runs Stage-3 selection; the headless recompute (`refinement-recompute/orchestrator.ts:65-80`) returns `unchanged` when the refined version did not change; the authority-repair view (`load-view.ts:157-226`) is about category order, not retired products. The existing behaviour for a retired planned product is graceful degradation of that one step: `application-adapter.ts:355-375` marks it `catalog_unavailable` („One unavailable catalog identity must degrade its own step only"), and the card loses its buy link (`product-detail-service.ts:138-140` filters active+recommended). The rest of the routine stays readable. Re-picking a new leave-in for these 7 plans is §12 Q3; the recommended path is T5.5b (below). The one owner's plan gets a `user_product` source change from step 4 automatically (the existing trigger), which the reconciler handles today.
6. **Frozen history stays frozen**: completed/stale drafts (frozen since 20260815110000), routine and portfolio versions (hashed payloads), chat messages — not rewritten.
7. Evidence row (`fact_key='product.lifecycle.replaced_by'`, source: the pack/retailer "Haaröl Spray, nicht ausspülen" per R3), receipt, postflight: tombstone shape, edge, owner row moved, oil row publication assert.

Rollback (`plans/catalog-completeness-fill/s5/rollback-pantene.sql`): restores the products row and the owner row byte-exactly, deletes the edge, evidence and receipt; the owner's outbox entry is an idempotent re-evaluation and is left.

**T5.5b (if Q3 = re-pick).** Add a `catalog_retirement` reason to the headless recompute (`recomputeRoutineAfterHabitsCompletion`): skip the `unchanged` short-circuit when the active routine contains a product that is now a `replaced_by` source, drop that product from the rehydrated intents (all other decisions preserved), complete and activate through `personal_plan_complete_draft_activate_v2` exactly as the habits lane does, and raise the existing plan-updated signal (`routine/plan-updated-signal.ts`). Run once for the 7 plans via `scripts/personal-plan/repick-retired-products.ts --product f8f3b51d --dry-run|--apply` (owner-scoped, idempotent, prints plan ids only as hashes). Test: `tests/personal-plan/refinement-recompute/catalog-retirement-repick.test.ts` (retired planned leave-in → new leave-in, other slots unchanged, second run `unchanged`). This lane is reusable for every later tombstone of a planned product (it also closes X4 §C.5's open "routine versions have no repair precedent").

---

## 6. Research workplan: ~22 multi-use candidates (M1, M2)

**Scope.** (a) The 15 flagged single-row candidates (X1 §5B): Balea 3 in 1 Intensivmaske `d5d67009` (mask, rec), Balea Natural Beauty 3in1 Locken `f212a8ff` (mask), Garnier Fructis Banana Hair Food 3in1 `4a7b5b38` (mask), Isana 3in1 Milchprotein & Mandel `47795618` (mask), Balea Professional Plex Care 2in1 `9d7141bf` (mask, rec), Curlsmith Multitasking Conditioner 3 in 1 `2bafeb7e` (leave_in, rec), alverde Sprühkur Express 7in1 `f9595d2c` (leave_in, rec), HASK Keratin 5-in-1 `5a9f4b7b` (leave_in, rec), Balea 2 in 1 Urea 5% `b000d235` (shampoo, rec), ISANA Shampoo & Spülung 2 in 1 `22f95dcb`, Nivea Shampoo&Conditioner 2in1 `f033afbe` (shampoo, rec), Herbal Essences Fiji `57848cf2` and Limettenduft `240c4e9d` (conditioner), Pantene Repair & Care Conditioner `2781bccb`, Garnier Fructis Wunderöl Hitzeschutzspray `4eddfc54` (oil). (b) The 5 backfilled packages: check for a third use (Garnier Hair Food names three: Spülung/Maske/Leave-In ⇒ PKG-1 likely gains a mask member, PKG-2 a conditioner member; Balea Aqua „Over-Night"). (c) A full-catalogue sweep of the remaining active products for manufacturer-named further uses (M1 "all catalogue products"): text cues (`in1`, `in-1`, `Multi`, „auch als", „oder als", „Kur", „Leave-in" in conditioner/mask directions) first, manufacturer page check for every hit.

**Lane 1 — use confirmation (Sonnet subagents, read-only, ~5 packages each).** Per package: German manufacturer page (else pack), verbatim direction sentences per use, stated contact time, M2 verdict per use. A **separate use** requires its own manufacturer direction (an application step with its own instruction). A combined-function claim inside one step („Shampoo & Spülung in einem") is not a second use (see §12 Q1). Output `research/s5-multi-use/<slug>/uses.json`:
`{existingProductIds, holderId, gtin, sources:[{url,label,source_type,checked_at,quote}], uses:[{category, verdict:"keep"|"new_sibling"|"not_named", direction_quote, contact_time_s?, source_id}], notes}` + one-line `summary.md` row. Opus spot-check of every `new_sibling` and every rejected use; Nick approves the list (plain-language table) before Lane 2.

**Lane 2 — category research for each new use (Sonnet, engine-locked).** Mask v1.0 (mode-scoped), Conditioner v1.1 (after the 4.2 overlay locks), Leave-In v1.2 (with S3), Shampoo/Deep Cleansing v1.6 (via the shampoo-v16 program), oil: decision contract facts. Output per new member under `research/s5-multi-use/<slug>/<category>/`: engine envelope (with `multi_use_*`), `adapter/production-projection.json`, protocol rows (V1 template id + slots), evidence list. Same layout as `research/r4-user-submitted-14/`.

**Lane 3 — apply.** Generator batch per ≤10 packages (`S5P-03…`), rehearsal, Nick approves the fingerprint, targeted apply, post-apply audit + scan replay of each package's GTIN.

---

## 7. Ordered tasks

Sub-PRs (each its own Codex whole-branch review and `/ship`; merges and prod applies are separate go-aheads):

- **S5a Identity foundations + data** (no user-visible change except Pantene): T5.1–T5.6 (+T5.5b)
- **S5b Scan + save** (web, mobile contract, iOS line): T5.7–T5.12 — needs S5a merged + applied
- **S5c Plan same-package**: T5.13–T5.16 — needs S5a; parallel to S5b
- **S5d Intake + engines + research batches**: T5.17–T5.21 — research starts immediately; apply after S5b+S5c are live with the flag on

### S5a

**T5.1 Schema migration (test-first).** Consumes: §1.1–1.2. Produces: `supabase/migrations/<v>_product_packages.sql`, `plans/catalog-completeness-fill/s5/rollback-schema.sql`, `tests/product-packages-schema-postgres.test.ts`. Done: P1–P5 rejection tests red→green; single-use fixture unaffected; select-column contract test green. (Sonnet)

**T5.2 Package library + types.** Produces: `src/lib/catalog/packages.ts`, `src/lib/types.ts` additions, `tests/catalog/packages.test.ts` (`loadPackageMembers` ordering, inactive/quarantine excluded, `purchaseKey`, `isSamePackage`). (Sonnet)

**T5.3 Audit findings + doc.** Produces: `src/lib/catalog-authority/{audit.ts,audit-reader.ts}` six findings, snapshot fixtures, `tests/catalog-authority/package-audit.test.ts`, `docs/catalog-authority.md` section. Done: snapshot with each defect yields exactly its finding; live audit `--allow-issues` lists the 5 pairs as `package_*` only before backfill and none after. (Sonnet)

**T5.4 Price-audit write-through.** Produces: `scripts/price-audit/run.ts` sibling update, `tests/price-audit/package-write-through.test.ts`. (Sonnet)

**T5.5 Backfill + Pantene generator.** Produces: `plans/catalog-completeness-fill/s5/{generate.ts,prestate.json,target-state.json,rollback.sql,rollback-pantene.sql,verify.sql,artifact-manifest.json}`, migrations M-S5a-2/3, `tests/catalog-packages-backfill-s5a-postgres.test.ts`, `tests/pantene-7in1-retirement-postgres.test.ts`. Done: forward/verify/rollback/reapply/tamper/fresh-DB green; `--check` stable. (Opus — judgement on harmonised names/images, reference handling)

**T5.5b Re-pick lane for retired planned products** (only if Q3 = a): see §5. (Opus; main session writes the test.)

**T5.6 Apply S5a (Nick-gated).** Order: schema → backfill → Pantene → (T5.5b script `--dry-run`, then `--apply`). After each: `verify.sql` zero rows, `npm run catalog:authority:audit -- --pretty --allow-issues`, `npm run personal-plan:stage3:coverage-audit`, live scan of the 5 holder GTINs (still single verdict — flag off), outbox terminal codes for the owner's plan, active routines no longer referencing `f8f3b51d` (if Q3 = a), Sentry check.

### S5b

**T5.7 Resolver expansion + use selection (test-first).** Produces: `src/lib/scan/package-uses.ts` (`selectDisplayedUse`, `buildPackageUses`), export of `compareScanEvaluations` from `role-selection.ts`, changes in `src/app/api/scan/resolve/route.ts`, `src/lib/scan/types.ts`, `masked-alternative.ts`, `product-presentation.ts` (sibling exclusion from alternatives). Tests: `tests/scan/package-use-selection.test.ts` (rules 1–4 incl. saved use, basis vs optional, none needed, ties), `tests/scan/resolve-route-package.test.ts` (identifier path, `pick:"exact"`, `pick:"auto"`, quarantined sibling dropped, flag off byte-identical). (Opus implements to the main-session test design)

**T5.8 Save/wishlist/reveal/history server.** Produces: migration replacing `scan_move_saved_product` (same signature, package lock + cleanup), `saved-state.ts`, `wishlist/route.ts` dedupe, `reveal/route.ts` same-package credit, `history-service.ts` member display. Tests: `tests/scan-move-saved-package-postgres.test.ts` (move between uses, merkliste↔routine across members, Stage-3 row of another member untouched, single-use unchanged), `tests/scan/wishlist-package-dedupe.test.ts`, `tests/scan/reveal-same-package.test.ts`, `tests/mobile/history-package.test.ts`. (Sonnet)

**T5.9 Search grouping.** `catalog-search.ts`, web + mobile search routes; `tests/scan/catalog-search-package.test.ts`. (Sonnet)

**T5.10 Web UI.** `ScanPackageUsesLine` in `scan-verdict-sections.tsx`, per-use view + footer „Zurück" | „Speichern" (`scan-action-footer.tsx` variant), `scan-save-sheet.tsx` multi-use rows, `scan-flow-state.ts` `package_use_opened` action, analytics events. Tests: `tests/scan/scan-flow-state-package.test.ts` (no trigger/category double count), component tests for sheet rows and chips; Playwright check at 375 px against mockup frames 1–4. German copy pass (Opus).

**T5.11 Mobile contract.** `scan-contracts.ts` optional `packageUses`, `scan-service.ts` expansion + `pick`, request schema; fixtures `tests/fixtures/mobile/scan-v1-package.json` + iOS copy; `tests/mobile/scan-contract-package.test.ts` (old fixture still valid). (Sonnet)

**T5.12 iOS.** `ScanContract.swift` lossy `packageUses` + `pick`, `PackageUsesLine`, pushed use sheet with „Zurück"; `ios/ChaarlieTests/MobileContractTests.swift` decodes both fixtures; simulator walkthrough with the Macadamia fixture. (Sonnet; UI review in main session)

### S5c

**T5.13 Purchase key in budget policy (test-first).** `budget-policy.ts` (`purchaseKey` on `BudgetCandidate`, `uniqueCount`, `inferBudgetSuggestion`), candidate builders `production-persistence-gateway.ts` (allocation, memo key, `capturedBudgetSuggestion`), `product-previews.ts`, `fixture-gateway.ts`. Tests extend the #654 suite: two roles on one package ⇒ N counts 1; capped allowance and 60/40 target on N distinct packages; owned-package pick excluded from N. (Opus to green; main session writes the tests)

**T5.14 Routine presentation + consult sum.** Same-package line, header count, over-budget count, shared product sheet: `src/lib/personal-plan/routine/{repository.ts,load-view.ts,budget-gate.ts,product-detail-service.ts}`, `src/components/routine/personal-plan/{routine-page.tsx,routine-item-card.tsx,routine-product-detail.tsx}`, `src/lib/discovery/runsheet/locked-in.ts`. Tests: `tests/personal-plan/routine/same-package-presentation.test.ts` (later card gets the line, dative map complete for all 10 categories, header counts packages, one buy button). Copy (Opus).

**T5.15 Ownership edge.** Owned member + other member picked ⇒ no purchase, line references the owned use; fixture test in the same suite.

**T5.16 Verification.** Field-test profile whose plan picks Guhl conditioner + Guhl mask (fixture gateway), screenshot vs mockup 3; flag-off regression.

### S5d

**T5.17 Intake matching + link-existing.** `product-matching.ts`, `submissions.ts`, migration for `product_intake_link_existing_product`; tests `tests/product-intake/package-matching.test.ts`, `tests/product-intake-link-existing-package-postgres.test.ts`. (Sonnet)

**T5.18 Engine overlays.** Conditioner v1.1 overlay + lock receipt + manifest; Leave-In v1.2 clause (with S3); Mask README note. Nick locks the overlays. (Opus draft)

**T5.19 Research Lane 1** (§6) → Nick approves the use table.

**T5.20 Research Lane 2** → per-member envelopes/projections/protocols.

**T5.21 Apply batches** S5P-03…; post-apply: audit, scan replay of every packaged GTIN (web + mobile), plan fixture replay.

## 8. Verification

- `npm run ci:verify` per sub-PR; targeted suites named above; PGlite rehearsals per migration.
- Live after each apply: `verify.sql`, catalogue authority audit, Stage-3 coverage audit, scan-readiness query from the 2026-10-09 audit, Sentry (`haircare-fw/hair-concierge`, last hour).
- Manual: web scan of Garnier Macadamia GTIN as premium and free test users (frames 1–4), save into each use, Merkliste listing; iOS simulator line + „Zurück"; Personal Plan with a two-slot package.

## 9. Rollout

- `CATALOG_PACKAGES_ENABLED` (server env, default off) gates: package expansion in web+mobile resolve, search grouping, save-sheet multi-use rows, package-scoped saved state/auto-save, routine same-package presentation, purchase-key counting. Schema, audit, price-audit write-through and data migrations are not flagged. Flag on in preview → Nick walkthrough → production → remove the flag one release later.
- Package-scoped save RPC is behaviour-identical for `package_id IS NULL`, so it ships unflagged.
- Old iOS builds: additive keys only; they keep today's single verdict.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Price audit leaves sibling prices stale | T5.4 write-through + `package_commerce_divergent` audit |
| A writer retires a holder without moving its GTIN | P1/P3 deferred trigger fails the transaction |
| Parallel evaluation of 2–3 uses adds DB load on scan | uses evaluated in parallel; packages ≤ ~25; measure p95 on the preview with the Macadamia GTIN before flag-on |
| Old iOS builds hit a new kind/verdict | none introduced; `contractVersion` stays 1 |
| Legacy chat engine recommends two siblings in one answer | chat selection excludes only tombstones; follow-up (dedupe by package in `recommendation-engine/selection.ts`) recorded in the residual ledger, not S5 |
| Pantene: 7 active routines plan the retired row; the owner's reconciler may park with `terminal_category_mismatch` (`source-sync-service.ts:155`) | Q3 (a) → T5.5b re-pick for all affected plans incl. the owner's; (b) → documented degraded step; post-apply read of outbox terminal codes |
| Name harmonisation collides with Shampoo v1.6 (PKG-5) or research envelopes keyed by name | coordinate with shampoo-v16; envelopes are keyed by product id; generator prints all renames for review |
| Renamed rows have stale embeddings/RAG chunks | re-embed follow-up after S5a apply |

## 11. Proposals (one recommendation per technical choice)

1. Package entity = `product_packages` table + nullable `products.package_id` + unique `(package_id, category_key)`.
2. GTIN stays on one member (identifier holder); global owner index unchanged; siblings reached via `package_id`.
3. Siblings are not `product_relationships`; `replaced_by` stays tombstone-only; tombstones leave packages (P4).
4. Structural package invariants in a deferred DB trigger; commerce/identity equality audit-enforced with price-audit write-through.
5. Backfill exactly PKG-1…PKG-5; holder = current GTIN owner; harmonise names/images/brand ids in the same migration.
6. Displayed use: saved → needed (basis before optional) → best fit (existing scan comparator) → category order.
7. Additive `packageUses` on web and mobile; mobile `contractVersion` stays 1; iOS lossy decode.
8. Per-use navigation reuses `/resolve` with `pick:"exact"`; it never counts as a new scan, never auto-saves.
9. Save stays `/api/scan/save {productId, kind}`; `scan_move_saved_product` becomes package-scoped (same signature); switching use = move among scan-owned rows.
10. Merkliste, free reveal, search results, history display are per package.
11. Plan selection unchanged; counting by `purchaseKey = package_id ?? product_id` wherever a package could be counted twice (#654 N for the 60/40 rule and the 25 % allowance, budget suggestion, over-budget notice, routine header, consult „Summe neu"); same-package display derived at view time, never stored.
12. Owning one member never fills another slot; a pick sharing an owned package is not a purchase.
13. Pantene: tombstone + cross-category `replaced_by`, owner row moved to the oil row (category + product updated together), frozen history untouched; re-pick lane T5.5b for the 7 planned routines (pending Q3).
14. Sibling rows created by generator + guarded migration per batch (no new reusable executor).
15. Conditioner v1.1 mode-scoped overlay; Leave-In clause folded into S3's v1.2; Mask unchanged.
16. Four sub-PRs S5a → (S5b ∥ S5c) → S5d, flag `CATALOG_PACKAGES_ENABLED`.

## 12. Questions for Nick

**Q1 — Does "Shampoo & Spülung in einem" count as two uses?** Example: Nivea Shampoo&Conditioner 2in1 (`f033afbe`, recommended). The manufacturer gives one step: lather, rinse — the conditioning happens in the same wash. Your rule M2 says a row per use the manufacturer names. My recommendation: **no conditioner row** for these 2in1 shampoos (3 products: Nivea, Isana, Balea Urea), because a conditioner row would let the plan put the same wash step into the conditioner slot too („Dieselbe Packung wie beim Shampoo" — but there is no second step to do). A second row only when the manufacturer gives a separate conditioner direction (as Guhl does for Spülung vs. Kur). Agree?

**Q2 — iPhone app: line only, no „Speichern"?** The iPhone app has no saving or Merkliste at all today (only the scan history). With S5 it would show the „Auch nutzbar als Maske › · Leave-in ›" line and open each use's full result with „Zurück", but no „Speichern" — saving stays a web feature as today. Adding saving to the iPhone app is a separate feature. OK to leave it out of S5?

**Q3 — 7 people have the Pantene 7in1 planned as their leave-in. What happens when that row is retired?** Their routines still show „Pantene Pro-V Miracles 7in1" as the leave-in they should buy. After retirement (the bottle is an oil spray, ruled M2), there are two ways:
- **(a) Re-pick (recommended):** their plan quietly picks the next-best leave-in for their hair; everything else in the routine stays; they see the usual „Plan aktualisiert" signal. Costs one small reusable lane (T5.5b) that also covers every future retirement.
- **(b) Leave it:** the leave-in card stays, without buy link, and the Anwendung step for it is marked unavailable until their plan is recomputed for some other reason.
The one person who already owns the bottle keeps it — listed as their oil, not their leave-in.
