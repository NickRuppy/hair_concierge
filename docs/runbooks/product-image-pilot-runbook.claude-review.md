All checks done. Here is the verdict report.

---

**Verdict:** Approve with revisions

**Lean shape**

- Irreducible goal: a repeatable, audited pipeline to publish reviewed 1200×1200 product images to Supabase and `products.image_url`, batch by batch.
- Cut or defer: nothing major — the runbook documents work that already exists and resists scope creep well (it explicitly defers the admin page, source-search helper, and contact-sheet command to "Known Follow-Ups"). The "Scaling Recommendation" section partially repeats "Before Scaling Beyond the Pilot" (both list the batch-id/count generalization); could be merged, but that's cosmetic.
- Hard tradeoff the plan is avoiding: none — it names the real one (manual review doesn't scale linearly) and chooses controlled 50-product batches.

**Prior art**

- Immutable hash-versioned storage paths: matches content-addressed asset pattern — OK (`scripts/product-images/manifest.ts:184` includes a 12-char SHA prefix; verified by `tests/product-images-manifest.spec.ts:17`).
- Publish with compensation: upload → RPC → delete-on-failure (`publish-pilot-images.ts:130,150`) is a correct saga/compensation shape for the cross-system write (Storage + DB can't share a transaction). The DB side (`UPDATE products.image_url` + audit upsert) is atomic inside the RPC (`supabase/migrations/20260610120000_product_image_assets.sql:60–130`) — OK.
- Idempotency: re-running publish re-uploads the same hash-versioned path and the RPC upserts on `product_id` (`...sql:48` unique index), so replays converge — OK, though the runbook doesn't say re-runs are safe; worth one sentence.
- Dry-run before mutation: matches canonical gated-publish — OK (`publish-pilot-images.ts:14`).
- Migration handling deviates from canonical `supabase db push` (applied surgically, marked applied) — the runbook discloses this honestly, which is the right call given divergent history.

**Blockers** (will fail or mislead as written)

1. The manifest spec isn't wired into any test script — `package.json:36` runs `tsx --test tests/*.test.ts tests/*.test.tsx`, but the new file is `tests/product-images-manifest.spec.ts`, so neither `test:node` nor `test:contracts` ever runs it (and plain `node --test` fails on it — only `tsx --test` passes, 7/7). Either rename to `.test.ts` or add it to a script; otherwise the validation logic the runbook leans on is unprotected in CI.
2. Step 8 implies the publisher checks "the bucket … preflight" — it doesn't. `preflightDatabase` (`publish-pilot-images.ts:67–90`) checks products and the audit table only; there is no bucket or RPC existence check before upload. A missing bucket fails mid-upload, a missing RPC fails after upload (compensated, but noisy). Either soften the runbook claim or add the preflight.

**High-confidence issues**

- The runbook says "expected count … update the constants deliberately" but doesn't say _where_: `expectedCount` is a function option (`manifest.ts:191,227`) that `publish-pilot-images.ts` never sets or exposes via CLI — for a 50-batch you must edit `manifest.ts:191`'s default of `20` _and_ `PRODUCT_IMAGE_BATCH_ID` at `manifest.ts:6` (which also changes storage paths, `manifest.ts:184`). Name both exact edit sites in the runbook so the next operator doesn't hunt.
- Step 9's check "product image URLs are loaded from the Supabase public storage bucket" works because `next.config.ts:46` allowlists `pqdkhefxsxkyeqelqegq.supabase.co` and CSP `img-src` allows `https://*.supabase.co` (`next.config.ts:11`) — fine, but the runbook should note this dependency: a future project-ref change silently breaks images.
- Fallback folder names are load-bearing: `generate-pilot-manifest.ts:100–103` hardcodes exactly `fallback`–`fallback4`. The runbook shows these as an "example" — say explicitly that a `fallback5/` round will be silently ignored by manifest generation until the script is updated.

**Smaller / nice-to-haves**

- Step 3's localStorage warning is correct and the JSON-as-source-of-truth instruction matches `serve-review.ts:46` (POST endpoint writes `review-state.json`). Good.
- The `--input-dir` semantics in Step 6 match `process-selected-images.ts:10–11` (implies `skipBackgroundRemoval`) and per-product file matching by id (`:211,265–267`). Verified.
- `product_image_assets` has RLS enabled with no policies (`...sql:135`) — service-role-only by design; one line in Step 8 noting "audit table is not client-readable; that's intentional" would pre-empt the question.
- "Each file name must include the product id" (Step 5) is accurate but could cite the matcher (`process-selected-images.ts:265`) so it doesn't read like superstition.

**Bottom line**
This is an unusually honest, well-grounded runbook — every script, flag, folder, and validation it cites exists and behaves as described, and it correctly flags its own pilot-specific hardcodes. Fix two things before treating it as the scaling playbook: wire `tests/product-images-manifest.spec.ts` into a test script (it currently runs nowhere), and either correct or implement the claimed bucket/RPC preflight in Step 8. With those plus naming the exact constants to edit for a 50-batch, ship it.
