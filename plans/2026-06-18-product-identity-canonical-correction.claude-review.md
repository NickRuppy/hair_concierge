**Verdict:** Re-shape first — do not ship to subagents yet.

The plan fuses a safe, additive identity re-pointing with a `products.name` rename that the project's own spec explicitly defers, and the rename's mitigating "display helper" is unbuildable as scoped. One row also fails the existing validator outright.

---

**Lean shape**
- **Irreducible goal:** Production identity tables stop treating retailer/line names (`Fructis`, `Gliss`, `Wahre Schätze`, generic `L'Oréal`, `Monday Haircare`) as canonical brands; aliases still resolve old user wording.
- **Cut or defer:** Split into two phases. **Phase A (ship now, additive):** edit `data/product-catalog-normalization.json`, retarget `brand_id`/`product_line_id`, re-point/delete aliases and orphan brand/line rows. **Phase B (defer, per spec):** `products.name` cleanup + the display helper + client-side canonical hydration + RAG re-ingest, done together in one release window *after* `ingest-products.ts` is id-stable. Task 3 (display helper) and the `products.name` column of the correction table belong entirely to Phase B.
- **Hard tradeoff the plan avoids:** Either make `scripts/ingest-products.ts` id-stable *before* renaming names, or don't rename names yet. The plan renames now and never addresses the `onConflict: "name,category"` upsert key (`scripts/ingest-products.ts:661`).

**Prior art**
- **Expand→backfill→contract migration:** Phase 0 correctly did expand+backfill additively (`apply-normalization.ts:590-594` writes only `brand_id`/`product_line_id`/`category_key`; `:639` prints "Rename products.name: no"). The plan jumps to a contract-style name rewrite while the documented preconditions (id-stable ingest, chunk refresh) are unmet — `docs/product-identity-normalization.md:308-316`. Deviation is **unjustified**.
- **Alias re-pointing:** canonical shape is delete-then-insert (or update) under the unique `normalized_alias`. Existing path *refuses* re-pointing (`apply-normalization.ts:505-549`); the plan needs its own delete-first order — gestured at (Task 4) but not specified.

**Blockers** (will fail or regress as written)

1. **`products.name` rename contradicts the spec and breaks re-ingest** — plan Task 4 (`:136`) + correction table (`:66-87`). `scripts/ingest-products.ts:661` upserts on `(name, category)`; renaming `Gliss Kur Aqua Revive Conditioner` → `Conditioner` means the next Excel ingest of these drugstore rows inserts **duplicate products** (this is exactly gotcha #3 in the ingredient-flags recipe memory). Also desyncs RAG: `src/lib/product-matching/product-list-chunks.ts:84-87,106` embeds `product.name` into chunk text/metadata. — *Fix: defer name cleanup to Phase B (spec already mandates this).*

2. **The display helper cannot recompose the title client-side** — Task 3 assumes canonical brand+line is available. It is not: `Product` carries only legacy `brand: string | null` (`src/lib/types.ts:246`), chat fetches with `select("*")`/`products:product_id(*)` and no brands/product_lines join (`src/lib/product-matching/matcher.ts:187,267`; `src/lib/recommendation-engine/selection.ts:1437`; `src/app/api/products/route.ts:24`). Cards render `{product.name}` + legacy `{product.brand}` (`src/components/chat/product-card.tsx:68,71-73`; `product-detail-drawer.tsx:61`; `product-popover.tsx:127`). After the rename, cards show the **legacy (uncorrected) brand + a bare type word** — e.g. `Fructis / Hair Food Aloe Vera`, `Balea / Aqua Hyaluron` (losing "Professional"), `Monday / Moisture Conditioner`. Wiring canonical identity to the client (join + type + serialization across chat/profile/intake) is real work and is entirely unscoped. — *Fix: defer; or scope the hydration explicitly as its own task.*

3. **One row fails `products:identity:validate-reviewed`** — plan line 77: `Glisskur Liquid Silk` → `product_line = "Liquid Silk"`, `clean_name = "Liquid Silk"`. `validate-normalization.ts:297-299` rejects a `clean_name` that duplicates `product_line` (`normalizeText` both → `liquid silk`; `startsWithCanonicalPrefix` true). Tasks 2 and 5 both run this validator and will error. — *Fix: set `clean_name` to a non-duplicating value (e.g. drop to `null`/a distinct variant) or keep the line null for this inactive row.*

**High-confidence issues** (correctness, not preference)

- **`clean_name` ≠ `products.name`.** The correction table header "Target `products.name` / `clean_name`" (`:66`) conflates two decoupled fields. `clean_name` lives only in the JSON and drives validation + alias matching; `apply-normalization.ts` never writes it to the DB. `products.name` is the live display string and the ingest upsert key. Phase 0 deliberately keeps them decoupled — the plan silently collapses that.
- **Shared Gliss aliases risk cross-row validator conflicts.** `Gliss`, `GLISS`, `Gliss Kur`, `Glisskur`, `Schwarzkopf Gliss` are added across all 4 Gliss rows, which now have *different* lines (Aqua Revive / Ultimate Repair / Liquid Silk). They must be authored brand-only (`resolves_to: "brand"`, `product_line: null`) on **every** Gliss row or `validate-normalization.ts:417-441` throws "Alias conflict". Task 2's flat alias list doesn't specify scope — a hand-off hazard for a subagent.
- **`L'Oréal` apostrophe + normalization collision.** Generic brand is stored curly `L'Oréal` → `loreal`; `L'Oréal Paris` → `loreal paris`; `L'Oreal Professionnel` → `loreal professionnel` (`normalize.ts:13`). Adding bare `L'Oréal`/`L'Oreal` aliases (→ `loreal`) pointing at L'Oréal Paris is defensible but should be an explicit documented decision, and the plan's mixed straight/curly apostrophes (`:43,:80-81,:106`) must be authored as the exact DB bytes or the stale-mapping guard (`apply-normalization.ts:333-349`) will reject the apply.

**Smaller / nice-to-haves**
- **Orphan reference-check is actually complete** — Task 4 (`:137`) lists products / product_lines / brand_aliases; confirmed via schema that `brand_id`/`product_line_id` exist *only* on those three tables. Good. (No `product_submissions` FK risk.)
- **Inactive-row coverage:** `Glisskur Liquid Silk` is `is_active=false`. Confirm `validateNormalizationAgainstSnapshot` / the snapshot export includes inactive rows, or the coverage check will error with "references unknown product".
- **Finish step missing:** Verification (Task 5/6) omits the project standard `npm run ci:verify` and the mandated `codex:codex-rescue` agent review before push (CLAUDE.md). The Execution Handoff mentions `branch-gate` + subagent-driven-development but not the finish gate.

**Bottom line**
The identity-correction half is sound and grounded — the data exists exactly as the table claims (verified: Gliss 4, Glisskur 1, Fructis 2, Wahre Schätze 4, Monday/Monday Haircare 1 each, L'Oréal generic 2, L'Oreal Professionnel 1). But the plan bolts a `products.name` rewrite onto it that the spec explicitly defers (`docs/product-identity-normalization.md:308-316`), that breaks re-ingest and RAG, and that relies on a display helper which has no canonical data to read on the client. Re-shape into Phase A (additive re-pointing, ship now) and Phase B (name cleanup + client hydration + re-ingest, one release window, after `ingest-products.ts` is id-stable). Fix the `Glisskur Liquid Silk` validator failure and the alias-scope ambiguity regardless.

Want me to spec the leaner Phase-A-only counter-proposal so you can compare side-by-side?
