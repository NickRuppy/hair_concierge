I have enough grounding. Here is the verdict report.

---

**Verdict:** Re-shape first (lean hard). The plan is ~3–4× larger than its own goal, it re-introduces an abstraction CLAUDE.md forbids, and at least one task as written will **regress existing passing tests**. The committed one-line patch already achieves most of the user-visible goal; the migration + docs are the only other load-bearing pieces.

---

**Lean shape**

- **Irreducible goal:** Users never see `Conditioner (Drogerie)`; the canonical key stays `conditioner`; the old string remains an accepted alias at boundaries.
- **The goal is already ~80% met by the uncommitted patch.** The *only* place that actually leaked the legacy string to users was `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner` rendered at `src/components/chat/product-intake-card.tsx:242`. The committed change `src/lib/product-identity/index.ts:41` (`"Conditioner (Drogerie)"` → `"Conditioner"`) fixes that path. Every other display path I checked *already* emitted "Conditioner":
  - `src/components/chat/product-display-model.ts:48-71` maps both `conditioner` and `conditioner-drogerie` → `"Conditioner"` (proven by passing test `tests/product-display-model.test.ts:357`).
  - `src/lib/onboarding/product-options.ts:5` maps `conditioner` → `"Conditioner"`.
  - `src/components/chat/product-card.tsx:27` maps `conditioner-drogerie` → `product-conditioner` icon.
- **Cut or defer:**
  - **Task 1 (central registry)** — speculative abstraction. The plan itself says "export derived constants so existing callers do not need broad rewrites," i.e. *no external behavior change*. That is exactly the "no over-engineering / no speculative abstractions" CLAUDE.md prohibits. Cut.
  - **Task 2 — `product-display-model.ts` + `product-card.tsx` rewrites** — pure dedup of maps that already satisfy the goal, and one variant is a test-breaking regression (see Blockers). Defer.
  - **Task 2 — `from-persistence.ts` alias normalization** — guards against input the DB makes impossible (see below). Cut.
  - **Task 3 — hand-edits to `data/product-catalog-snapshot.json` and `data/product-catalog-normalization.json`** — both are *generated* artifacts (`snapshot.json:3` `"exported_at"`, produced by `scripts/product-identity/export-catalog.ts:25`; `normalization.json:5` "Generated from … snapshot after production re-baseline"). Editing them by hand pre-migration makes `current_category` lie about present DB state and diverge from regeneration. Defer to a post-migration re-export. The validator does **not** require it: `scripts/product-identity/validate-normalization.ts:160,279` accept any value where `normalizeCategoryKey(x) !== null`, so both old and new strings already pass.
  - **Task 3 — `schema.json` enum edit** (`data/product-catalog-normalization.schema.json:44,94`) — documentation only; nothing loads the JSON-Schema enum at runtime or in tests. Optional, cosmetic.
- **Minimal surviving shape:** (1) the committed `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner` line; (2) a forward-only data migration for `product_categories.display_name_de` and `products.category`; (3) `docs/product-identity-normalization.md`; (4) keep the existing alias in `normalizeCategoryKey` + `CONDITIONER_DB_CATEGORIES`. Optionally keep the committed `derived.ts`/`product-usage-rows.ts` normalization as belt-and-suspenders for `products.category` free-text, but recognize it as defensive, not goal-driving.
- **Hard tradeoff the plan avoids:** Until the migration is actually *applied*, `products.category` (~43 rows, `data/product-catalog-snapshot.json:91…721`) and `product_categories.display_name_de` (`supabase/migrations/20260612120000_…sql:84`) still hold `Conditioner (Drogerie)`. The plan defers application behind approval — so "Done when active data no longer treats it as preferred" is **not** achieved by this PR alone. The plan should say so explicitly.

---

**Prior art**

- **Schema/label migration + alias compatibility** → canonical shape is expand → backfill → contract, with the alias retained at the boundary. The chosen direction (keep `Conditioner (Drogerie)` in `normalizeCategoryKey`, change the display label, forward-only data UPDATE) **matches** the canonical shape well. ✅
- **Reverse key→display-text map** (`CONDITIONER_DB_CATEGORIES`, `constants.ts:21-25`) → this is a sibling of `OIL_DB_CATEGORIES`, `BONDBUILDER_DB_CATEGORIES`, etc., all consumed by `matcher.ts:23-32` to build a `products.category IN (...)` filter. The plan's alternative "replace live callers with `normalizeCategoryKey`" **deviates wrongly**: `normalizeCategoryKey` goes text→key; the matcher needs key→[possible texts]. Renaming just this one constant also breaks symmetry with its siblings for zero behavior gain.

---

**Blockers** (will fail/regress as written)

1. **Task 2 "replace local category display map with shared helper" breaks existing passing tests.** `tests/product-display-model.test.ts:358-359` assert `getProductCategoryLabel("Öle") === "Öl"` and `getProductCategoryLabel("deep_cleansing_shampoo") === "Tiefenreinigung"`. The shared `getProductCategoryDisplayLabel` (`src/lib/product-identity/index.ts:102-109`) returns `"Öle"` and `"Tiefenreinigungsshampoo"` for those — *different strings*. Swapping `product-display-model.ts:291-294` to the shared helper makes these tests fail. — *Fix: don't replace this map; if dedup is truly wanted, preserve label parity first.*
2. **`getProductCategoryDisplayLabel` returns `""` for `peeling`/`serum`/`scrub`** (unsupported keys, not in `PRODUCT_CATEGORY_DISPLAY_LABELS`), whereas `product-display-model.ts:70` returns `"Peeling"`. Routing the drawer/compact-fact label through the shared helper drops the category label for peeling products. — *Fix: keep the local map for unsupported categories, or add a fallback.*

---

**High-confidence issues** (correctness, not preference)

- **Legacy-text normalization in the profile/recommendation paths defends against impossible input.** `user_product_usage.category` is FK-constrained to canonical keys: `supabase/migrations/20260612130000_product_intake_submissions.sql:164-165` (`FOREIGN KEY (category) REFERENCES public.product_categories(key)`, validated at `:173`), and `product_categories.key` holds keys, not display text (`20260612120000_…sql:84`). The earlier CHECK constraint already restricted it to keys (`20260409_onboarding_v2_extras.sql:4-9`). So `derived.ts`/`product-usage-rows.ts`/`from-persistence.ts` never receive `"Conditioner (Drogerie)"`. The committed tests (`tests/hair-profile-derived.test.ts` +`tests/profile-product-usage-rows.test.ts`) feed that string directly to the function, bypassing the DB — they prove handling of a value the schema forbids. Not harmful, but not load-bearing; Task 2's `from-persistence.ts` addition (`canonicalizeInventoryCategory`, `from-persistence.ts:132-138`) is pure future-proofing.
- **The matcher caller is unnamed.** Plan's Target File Map says modify `constants.ts` but never lists `src/lib/product-matching/matcher.ts:25`, the actual consumer. After the migration sets `products.category = 'Conditioner'`, the matcher still works because `"Conditioner"` is already in `CONDITIONER_DB_CATEGORIES` (`constants.ts:22`) — so *no change is needed here at all.*
- **`isConditionerCategory` (`constants.ts:36`) has 8 live callers** (admin pages, `api/admin/products/*`, `validators/index.ts:174`, `concern-taxonomy.ts:137`) the plan never mentions. It uses `startsWith("conditioner")`, so it tolerates both strings — fine to leave, but it contradicts the Source-Context claim that `product-identity/index.ts` "owns category keys." Category identity is spread across several `is*Category` helpers.

---

**Smaller / nice-to-haves**

- **Verification references a non-existent test.** `npx tsx --test tests/recommendation-engine-adapters.test.ts` (plan line 213) — no such file exists; it's only created in Task 5. Running the focused block before Task 5 errors.
- **Migration test won't cover the new migration.** `tests/product-identity-schema.test.ts:7-8` hard-targets the file ending `_product_identity_normalization.sql`; the new `_conditioner_category_label_cleanup.sql` is invisible to it. Task 5's "Add or update migration/schema tests" is too vague to guarantee coverage.
- **`tests/product-catalog-normalization.test.ts:455` loads the real `data/product-catalog-normalization.json`** — low risk (validator accepts both strings) but confirms that JSON is test-coupled, another reason to leave the generated file alone rather than hand-edit.
- **Fuzzy either/or verbs invite the regressive branch.** "Move … to one category registry **or** registry-derived constants" and "Rename … **or** replace live callers with `normalizeCategoryKey`" leave the choice to the implementing subagent; a reasoning model may pick the test-breaking option.

---

**Bottom line**

Don't ship this plan to a subagent as written: Task 2 will red existing tests, Task 1 adds a forbidden abstraction, and Tasks 2–4 mostly defend against data the DB FK already makes impossible or hand-edit generated artifacts. The leanest correct version is small: keep the committed `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner = "Conditioner"` line (it fixes the one real leak at `product-intake-card.tsx:242`), add the forward-only data migration for `product_categories.display_name_de` + `products.category`, update the doc, and keep the alias in `normalizeCategoryKey`/`CONDITIONER_DB_CATEGORIES`. State plainly that the legacy string only disappears from the DB once the migration is *applied*. Drop the registry, the `product-display-model`/`product-card` rewrites, the `from-persistence` change, and the snapshot/normalization JSON hand-edits.

Want me to spec the leaner counter-proposal as a side-by-side so you can compare before re-issuing to a subagent?
