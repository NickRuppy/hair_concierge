I have everything I need. All grounding is complete. Writing the verdict.

---

**Verdict:** Re-shape Task 3 first, then fix the blocker list — the data migration (Task 2) is solid, but the ingestion guard and two execution details will fail or mislead a subagent as written.

Using the reviewing-plans skill — findings below are grounded in the codebase with `file:line` citations. The migration SQL was validated against live production schema (project `pqdkhefxsxkyeqelqegq`).

**Lean shape**
- **Irreducible goal:** Correct the 7 known HAI‑124 product rows by id (incl. Gliss → Leave‑in recategorization), stop ingestion from nulling `affiliate_link`/`image_url`/`price_eur`, and add a read‑only audit for suspicious names / missing prices / bad hosts / stale prices / availability.
- **Cut or defer:**
  - `shouldPreferCandidatePrice` (Task 4) — **no consumer anywhere in the plan.** It's added with a test but nothing calls it. Pure future‑proofing; delete or defer until the audit actually does price comparison.
  - `preferredHostLane`'s `"drogerie"`/`"high_end"` lanes — the audit only branches on `=== "unknown"` (`health.ts` Task 5). The two lane labels have no consumer in this plan. Narrow to what the audit needs (or better, reuse `urlGate` — see Prior art).
  - `idx_products_availability_status` (Task 1) — speculative index on a **237‑row** table (confirmed live count). No query filters on it yet. Drop it; a seq scan over 237 rows is free.
- **Hard tradeoff the plan is avoiding:** id‑based vs `name,category`‑based product identity in ingestion. The plan hardens *commercial-field preservation* but keeps the fragile upsert key, so the renamed rows — the whole point of HAI‑124 — will still duplicate on the next ingest. See Blocker 3.

**Prior art**
- **Host allow/deny in the audit:** the repo already has the canonical shape — `urlGate` + `passesBrandDirect` (`src/lib/affiliate-research/url-gate.ts:89,76`). The plan introduces a *second, narrower* allow concept (`preferredHostLane` → `"unknown"` → `unfavored_host`) that **contradicts** the existing gate: brand‑direct hosts the gate accepts get flagged. Deviation is unjustified — reuse the gate.
- **Schema migration (expand + correct):** matches expand→correct; deploy ordering is handled (Task 8 Step 4). Missing: no documented revert for the corrections migration (it's `BEGIN/COMMIT`‑wrapped, which is good, but there's no rollback note).
- **Read‑only report job:** JSON/CSV + summary counts — fine, no idempotency concerns. The stale‑price check covers only 7 hand‑listed ids, which is correctly framed as a watchlist (acceptable bounded coverage).

**Blockers** (will fail or regress as written)

1. **Task 1 Step 3 test will fail.** `productSchema` has a `.superRefine` requiring `leave_in_specs` whenever the category is Leave‑in (`src/lib/validators/index.ts:179`). The new test calls `buildBaseProduct({ category: "Leave-in", … })` with **no** `leave_in_specs`, so `parsed.success` is `false`, and `assert.equal(parsed.success, true)` fails. Fix: use `category: null` (the default, no spec required) or supply a valid `leave_in_specs`.

2. **Wrong file path for the validator.** The plan says modify `src/lib/validators.ts` (Target File Map + Task 1 Step 2). That file does not exist — it's a directory module: `productSchema` lives in `src/lib/validators/index.ts:147`. A subagent following the path literally will not find it.

3. **The ingestion guard is built on the exact key the plan's own source doc warns against.** Task 3 Step 2 looks up the existing row via `.eq("name", product.name).eq("category", …)`, and the upsert still uses `onConflict: "name,category"` (`scripts/ingest-products.ts:547`). The corrections migration *renames* Guhl (`Guhl Panthenol*` → clean) and Gliss (renamed + moved to Leave‑in) — confirmed current names in prod are still the old ones. On the next ingest with the old sheet names, the lookup finds nothing → preserves nothing → and the upsert inserts a **duplicate** row with the old name and null commercial fields. This both fails to protect the corrected rows and breaks the promised "not silently converted into duplicate products." Counter‑proposal: match/preserve by `id` (or carry a stable external key), not `name,category`; the overview already mandates this (`docs/hai-124-product-metadata-overview.md:199`).

**High‑confidence issues** (correctness, not preference)

- **`unfavored_host` will be noisy and self‑contradictory.** `preferredHostLane` returns `"unknown"` for brand‑direct hosts that `urlGate` already accepts — e.g. `olaplex.de`, which is the Olaplex row's *own* link (confirmed not in the allowlist; `passesBrandDirect("olaplex.de","Olaplex")` is `true`). The catalog is "mostly brand‑direct" per the overview, so this flag fires on legitimate rows and contradicts the shop policy that endorses "official brand shops." Reuse `urlGate`/`passesBrandDirect` for the host verdict.
- **`product_leave_in_specs` is live‑read *and* ingest‑deleted.** The recommendation engine reads it (`src/lib/recommendation-engine/selection.ts:1350` and `:2107`), while `scripts/ingest-products.ts:577‑588` deletes it for every Leave‑in product after upserting `product_leave_in_fit_specs`. The migration inserts into it for Gliss. The plan never reconciles which table is canonical for leave‑in selection, nor that a future ingest of any Leave‑in row purges this table. At minimum state it; ideally guard the ingest delete. (Migration values themselves are constraint‑valid — verified.)
- **`productSchema` is not `.strict()`** (`src/lib/validators/index.ts:147` — plain `z.object` + `superRefine`). Zod v4 strips unknown keys, so: (a) the Step 3 test would pass even if Step 2 (adding the fields) is skipped — false confidence; and (b) if Step 2 is skipped, `availability_status`/`*_checked_at` are silently dropped by `productSchema` on the admin product routes. Make Step 2 mandatory (not "if needed") and assert the field *survives* parse (`parsed.data.availability_status === "unavailable"`), not just `success`.
- **`autoreview` (Task 8 Step 5) is not a real repo gate** — no match in `package.json`/`.claude/`/`scripts/`. The project's actual finish is `npm run ci:verify` → `codex:codex-rescue` agent on `git diff main…HEAD` → `/ship` (per `CLAUDE.md`). Replace the reference.

**Smaller / nice‑to‑haves**
- `.eq("category", product.category || null)` (Task 3 Step 2): supabase‑js `.eq(col, null)` emits `category=eq.null`, which does **not** match SQL `NULL`. Rows with a null category won't be found. Use an `.is("category", null)` branch. (All 7 target rows have categories, so low‑impact, but it's a latent bug.)
- `npm run test:node -- tests/x.test.ts` does **not** focus. `test:node` is `tsx --test tests/*.test.ts tests/*.test.tsx` (`package.json:36`); the appended path re‑runs the whole suite and duplicates the named file. The new tests already match the glob — plain `npm run test:node` suffices. Harmless, but the "focused" expectation is wrong.
- Doc/name drift: prod row `a1d705b4` is `"Hair Cleansing Cream Shampoo"`, but the overview + watchlist call it `"Redken Hair Cleansing Cream Shampoo"`. Updates are by id so it's harmless, but align the docs.

**What's verified solid (don't second‑guess these)**
- Migration Task 2 is production‑safe as written: all 7 ids exist and are active; Gliss currently has the `product_conditioner_specs` row the migration deletes; `products.updated_at` exists; `product_leave_in_fit_specs` and `product_leave_in_specs` have `product_id` PKs (so `ON CONFLICT (product_id)` is valid); every array value in both spec INSERTs satisfies the live CHECK constraints (`care_benefits`, `roles`, `application_stage`, `ingredient_flags`, `format`, the heat‑protection cross‑checks); and the migration prices exactly match the `known-price-checks.json` watchlist, so the audit won't immediately flag the corrected rows as stale. Pre‑apply "exactly 7 rows" assertion holds.

**Bottom line**
Don't ship to a subagent yet. Fix the two concrete execution blockers first (broken Leave‑in test → use `category: null`; `src/lib/validators.ts` → `src/lib/validators/index.ts`), then re‑shape Task 3 around id‑based identity — as written it doesn't deliver the "no duplicates" / "preserve commercial fields on renamed rows" promise, which is the heart of HAI‑124. Swap the audit's `preferredHostLane` host check for the existing `urlGate`, make the validator change mandatory with a survives‑parse assertion, reconcile the `product_leave_in_specs` read/delete tension, and replace the `autoreview` finish step with `ci:verify` + `codex:codex-rescue` + `/ship`. The migration (Task 2) and the health helpers' core logic are sound; the gaps are all in identity, the host‑lane reuse, and a few hand‑off details.

Want me to spec the leaner id‑based Task 3 counter‑proposal so you can compare it side‑by‑side with the current name‑based version?
