I have everything I need. All production-data claims verified accurate; the load-bearing risks are in re-ingestion and decision-deferral. Here is the review.

---

**Verdict:** Approve with revisions — the plan is well-grounded and its production evidence is accurate, but it rests on one unverified assumption (re-ingestion safety) and defers three decisions a subagent can't make for itself.

**Lean shape**
- **Irreducible goal:** Make Shampoo eligibility require explicit `shampoo_bucket_pairs` (fail loud, no silent fallback), drop the dead `suitable_hair_textures` field from the Shampoo/product-list types, and delete the 50 stale `product_list` content chunks from prod — while keeping `suitable_thicknesses` for non-Shampoo fit.
- **Cut or defer:**
  - Task 2's `research-shampoo-specs.ts` handling — it only writes a review **CSV** (`scripts/research-shampoo-specs.ts:207`), never touches the DB. It's not a production path; either leave it untouched or cut it from this plan's scope rather than agonizing over "still useful vs obsolete."
  - The plan bundles three loosely-coupled changes (strict eligibility / retire chunk ingestion / delete prod data). The plan itself notes they can ship separately (Handoff Notes) — lean move is to land Task 1 + typecheck first, then Tasks 3–4 as a separate change.
- **Hard tradeoff the plan is avoiding:** Whether removing the fallback breaks the documented re-ingestion workflow. The plan asserts "low risk once spec coverage remains zero-missing," but coverage is a property of the **live DB**, while re-ingestion reads **source files**. It never confronts that gap (see Blocker 1).

**Prior art**
- *Field deprecation + destructive data delete* → canonical expand→migrate→**contract**, gated + reversible. Plan does the gating well (explicit-approval stop-gate, count-before/count-after, `Review Gates`). **Missing invariant:** a rollback path. If Task 3 removes `ingest-product-chunks.ts` **and** Task 4 deletes the rows, the 50 `product_list` embeddings can't be regenerated. Keep the script (guarded) until after the delete is confirmed, or state re-ingestion as the rollback.
- *Fail-fast instead of silent coercion* (the core of Task 1) → matches canonical "no silent fallback." Good.
- *Kill-switch for legacy path* (`ALLOW_LEGACY_PRODUCT_LIST_CHUNKS=1`) → standard feature-flag shape, fine — but offered as one of three undecided options (see Smaller items).

**Blockers** (will fail or regress as written)
1. **Re-ingestion breakage is not actually gated.** Removing the fallback in `normalizeShampooBucketPairs` (`src/lib/shampoo/eligibility.ts:91-110`) makes `replaceCanonicalShampooPairs` throw for any Shampoo product whose **source** lacks explicit `shampoo_bucket_pairs` (`scripts/ingest-products.ts:185`). The plan's evidence and Review Gate check the live DB (`product_shampoo_specs` — verified: 49 active, 0 missing, 0 null), but `ingest-products.ts` reads `data/products.json` / `data/products-from-excel/*.json` (`scripts/ingest-products.ts:555-576`) — **none of which exist in the repo**, and which may still rely on the fallback. *Fix:* add a pre-step that confirms (or migrates) the Shampoo source files to explicit `thickness + shampoo_bucket` pairs, and reword the Review Gate to check **source content**, not DB coverage.
2. **The existing eligibility test will fail and the plan doesn't say with what.** `tests/product-list-chunks.test.ts:22-33` asserts the throw matches `/gueltige suitable_thicknesses/` — a phrase produced only by the fallback branch being deleted (`eligibility.ts:97-101`). After Task 1 the new "require explicit pairs" error won't contain it. *Fix:* specify the new error string in the plan so the test assertion is updated deterministically, not guessed.

**High-confidence issues** (correctness, not preference)
- **`scripts/research-leave-in-specs.ts` is in the blast radius but not in the plan.** It uses `suitable_hair_textures` at `:36` (local interface) and `:443` as a live fallback (`product.suitable_thicknesses ?? sourceMatch?.suitable_hair_textures`). It's a **non-Shampoo** path. The plan says "remove `suitable_hair_textures`" without scoping — an implementer who greps globally will either wrongly edit this file or miss it. *Fix:* explicitly scope the removal to `ShampooEligibilitySource` + `ProductListChunkProduct` + `ingest-products.ts`'s `ProductInput`, and state leave-in research is out of scope.
- **`ingest-products.ts` fallback is category-blind.** `normalizeProductInput` applies `suitable_hair_textures → suitable_thicknesses` for **all** categories (`scripts/ingest-products.ts:161-164`), not just Shampoo. Task 2's "remove the compatibility fallback from product normalization" would change non-Shampoo ingestion too — directly adjacent to the plan's own non-goal ("don't remove `suitable_thicknesses` from non-Shampoo"). *Fix:* confirm no non-Shampoo source uses `suitable_hair_textures` as its only thickness field before deleting line 164.
- **Two of the four named verification tests don't exercise this change.** `tests/product-matcher.spec.ts` and `tests/recommendation-engine-selection.test.ts` (Verification line 121) reference none of `normalizeShampooBucketPairs`, `buildProductListChunks`, `suitable_hair_textures`, or `product_list` (grepped — zero hits). The load-bearing checks are `tests/product-list-chunks.test.ts` plus **`npm run typecheck`**, which is what actually catches the interface-field removals across `product-list-chunks.ts:20`, `ingest-products.ts:96`, and `research-shampoo-specs.ts:21`. *Fix:* promote `npm run typecheck` to the primary gate; mark the two specs as unrelated regression coverage.

**Smaller / nice-to-haves**
- **Decision-deferral (Pass D).** Three "decide later" forks block clean hand-off: Task 3 "*Decide whether* … removed, archived, or guarded"; Task 2 "*If* still useful … *If* obsolete …"; Task 3 "Keep coverage *only if* the script remains callable." A subagent needs the choice made. Recommend committing to one (guard `ingest-product-chunks.ts` behind the env flag) so execution is deterministic — and note that "guard, don't delete" also preserves the Task 4 rollback path.
- **Dead code after retirement.** `mapShampooPairsToMetadata` (`eligibility.ts:113`) is used only by `buildProductListChunks` (grepped). Harmless to leave since Task 1 keeps the non-Shampoo chunk path working — just don't list it as needing changes.
- **Retrieval-eval coupling.** `codex-review-map.md:26` pairs these files with `npm run test:retrieval:ci` (`package.json:41`, gold-set nDCG/recall thresholds). `scripts/eval-retrieval.ts` shows no `product_list` reference, so deleting the rows is *likely* safe — worth a one-line confirmation that the gold set has no `product_list` targets before the prod delete.
- The `plans/2026-06-24-shampoo-eligibility-cleanup.claude-review.md` sidecar is an empty (0-line) file — harmless, ignore.

**Verified accurate (credit where due)**
- `products.suitable_hair_textures` is **not** in the live schema (only `suitable_concerns`, `suitable_thicknesses`) ✓
- active Shampoo = 49, missing `product_shampoo_specs` = 0, null/invalid specs = 0 ✓
- `content_chunks` `source_type='product_list'` = 50 ✓
- AgentV2 chat doesn't retrieve product-list chunks — `src/lib/rag/` no longer exists; the live path is `agent-v2/production/chat-pipeline.ts` with zero `product_list` references ✓

**Bottom line**
Don't ship to a subagent as-is — but it's close. The data evidence is solid and the destructive-delete gating is sound. Before execution: (1) verify/migrate the Shampoo **source files** to explicit pairs and re-anchor the Review Gate to source content (Blocker 1); (2) specify the new error string so the existing test updates deterministically (Blocker 2); (3) scope the `suitable_hair_textures` removal to the three Shampoo/product-list types and confirm the category-blind `ingest-products.ts` fallback removal doesn't strip non-Shampoo thicknesses; (4) resolve the three "decide later" forks and swap `npm run typecheck` in as the primary gate. With those four, it's ready.

Want me to spec the leaner counter-proposal (Task 1 + typecheck as a standalone change, with the source-file verification step written out) so you can compare side-by-side?
