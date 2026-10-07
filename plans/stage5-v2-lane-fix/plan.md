# Stage-5 V2 pointer lane fix — delta executor + honest retirement (Option 2)

**Ruling (Nick, 2026-09-14):** Option 2 — retire the full-registry apply, add a small
incremental pointer-delta lane. Immediate goal: write Redken Extreme Anti-Snap's
`pre_heat_protection` V2 pointer through a reviewed lane so the leave-in enrichment
apply (runbook `plans/leave-in-apply/apply-runbook.md` §6 step 6) can run.

## Measured state (all verified against production 2026-09-14)

- Runtime reads `product_application_protocols.guidance_payload_v2` only
  (`src/lib/routines/personal-plan/application/product-protocol-adapter.ts`); nothing
  at runtime reads `application-pointer-backfill.json`.
- Exactly TWO rows in prod have NULL `guidance_payload_v2`: Olaplex No.0
  (`aadbbab5…`, discontinued/inactive — out of scope) and Redken `2b7db7e3-2058-4178-8a03-7d05f4a1d447`
  role `pre_heat_protection` / family `pre_heat_damp` (written today by S5-14,
  fp `86b51da6…`). Live V1 payload fingerprint = `8e1b1bbc51ce497047f75891d18bc5b87125dbe6a0b20b01a95f7b5f8fa7b8cb`
  — byte-equal to the reviewed artifact entry's `source_fingerprint`.
- The full-apply RPC `apply_personal_plan_stage5_v2_artifact_v1` was reset by
  migration each time the artifact grew (ledger batches: `…2026-08-12` 273 rows,
  `…2026-08-14-use-case-coverage` 289, `…2026-09-01-protocol-amendment` 309; artifact
  now 310 items → live RPC refuses "ledger is partial").
- Artifact snapshot 2026-09-01 predates: (a) migration
  `20260903083832_simplify_oil_heat_capability.sql` (deleted 8 `pre_heat_protection`
  oil rows the artifact still lists → `source_protocol_missing` ×8; edited 13 V1
  payloads without artifact update → `source_protocol_diverged` ×7), and (b) the
  scan-DB-expansion waves (~90 products whose pointers are written at intake by
  `product_intake_approve_reviewed_product` via
  `src/lib/product-intake/category-validators.ts:1071` → 128
  `active_protocol_missing_from_artifact` blockers; the reverse-coverage check in
  `src/lib/product-intake/catalog-enrichment/stage5-v2-application.ts:263-283` has no
  exemption mechanism).
- Conclusion: every lane except the Stage-5 V1 protocol batch writes pointers at
  write time. The backfill machine's ongoing purpose is gone; its "artifact covers
  every live row" claim is structurally dead.

## Deliverables

1. **Migration** `supabase/migrations/<ts>_personal_plan_stage5_v2_pointer_delta_executor.sql`:
   `public.apply_personal_plan_stage5_v2_pointer_delta_v1(p_delta_json text,
   p_expected_delta_fingerprint text, p_reviewed_by text)`.
   Semantics copied from `20260813060630_personal_plan_stage5_v2_artifact_executor.sql`
   per-item branch, applied to a SHORT reviewed list instead of the full artifact:
   - reviewer pinned `'nick'`; sha256(p_delta_json) must equal expected fingerprint;
   - header: `schema_version = 'personal-plan-stage5-v2-pointer-delta-v1'`, non-empty
     `batch_id` matching `^S5V2D-[0-9]{2}-[a-z0-9-]+$`, `items` array 1..20, observed
     count field must match;
   - per item: pointer shape checks (schemaVersion 2, contractKind product_pointer,
     scope.kind product, scope.productId = item product_id, sourceRole = source_role);
     product exists + category matches pointer scope + origin curated + is_active +
     lifecycle active; live source protocol row exists with non-null `guidance_payload`;
     recompute source fingerprint via `public.personal_plan_stage5_v2_canonical_json_v1`
     and require equality with `item.source_fingerprint`;
     then: live `guidance_payload_v2 IS NULL` → guarded UPDATE (WHERE v2 IS NULL,
     assert FOUND); equal to item pointer → no-op; different → raise authority conflict;
   - ledger `catalog_enrichment_applied_items`: batch_id = delta batch_id, product_key
     `'v2-delta:' || product_id || ':' || source_role`; per-item replay: existing ledger
     row must match batch fingerprint + content fingerprint + product_id + reviewer,
     else raise; partial ledger is fine (per-item idempotency, unlike the old RPC);
   - advisory xact lock on batch_id; SECURITY DEFINER; `SET search_path = ''`;
     REVOKE ALL / GRANT EXECUTE to service_role only. Single transaction.
2. **Delta manifest** `data/catalog-enrichment/personal-plan-stage5-v2/pointer-deltas/S5V2D-01-leave-in-calibration-redken.json`
   (+ `.gitignore` allowlist entries for the new dir + file, following the existing
   per-file allowlist pattern at lines 261-268): batch_id `S5V2D-01-leave-in-calibration-redken`,
   one item = the Redken entry with `source_fingerprint` and `guidance_payload_v2`
   copied BYTE-EXACTLY from the corresponding item in
   `data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json`
   (which came from reviewed S5R-05). The artifact file itself stays byte-unchanged.
3. **Lib** `src/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta.ts`:
   zod schema, canonical fingerprint helper (reuse existing canonicalization),
   `buildStage5V2PointerDelta` cross-check that every delta item is byte-equal
   (`canonicalJson`) to the matching backfill-artifact item (id + source_role +
   source_fingerprint + guidance_payload_v2) — a delta can never drift from reviewed
   content; delta-scoped preflight (product state + live source row + fingerprint,
   classifying NULL→will_write / equal→already_applied / different→conflict);
   arg parser mirroring `parseStage5V2ApplicationApplyArgs` (`--apply`,
   `--confirm-project=pqdkhefxsxkyeqelqegq`, `--reviewed-head=`, `--expected-fingerprint=`).
4. **Scripts** `scripts/product-intake/catalog-enrichment/stage5-v2-pointer-delta-preflight.ts`
   and `…-apply.ts` (npm scripts `products:intake:stage5-v2-pointer-delta:{preflight,apply}`):
   dry-run default; apply additionally requires `ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE=1`
   (same env gate via `isStage5V2ProductionWriteAuthorized`), exact clean reviewed
   head, fingerprint match; reuse `stage5ProtocolClientAdapters` read side; RPC call +
   post-apply verify (re-read row, assert pointer equals item).
5. **Retirement**: `stage5-v2-apply.ts` refuses at top with a clear message naming the
   delta lane and why (artifact generations were migration-reset 273/289/309; catalog
   outgrew the registry 2026-09-03); `stage5-v2-preflight.ts` gets the same banner but
   stays runnable read-only for the historical record. New audit script
   `scripts/product-intake/catalog-enrichment/stage5-v2-pointer-coverage-audit.ts`
   (npm `personal-plan:pointer-coverage-audit`) implementing the REAL invariant: no
   active+curated product may have a protocol row with non-null `guidance_payload`
   and NULL `guidance_payload_v2`; prints offending rows; exit 1 when any.
   (Today it must report exactly the Redken row; after the delta apply, zero.)
6. **Tests** (all runnable via the server-only-register + tsx invocation):
   - `tests/personal-plan-stage5-v2-pointer-delta.test.ts`: schema/validator/builder
     unit tests incl. byte-equality cross-check red cases (mutated pointer, wrong
     fingerprint, unknown item), arg parser, preflight classification;
   - `tests/personal-plan-stage5-v2-pointer-delta-postgres.test.ts`: PGlite harness
     modeled on `tests/leave-in-calibration-executor-postgres.test.ts` — execute the
     REAL migration file, then: happy path writes pointer + ledger; wrong reviewer /
     wrong batch fingerprint / missing source row / diverged source fingerprint /
     conflicting existing pointer each refuse with zero writes; equal pointer no-ops;
     replay short-circuits via ledger; ledger row mismatch on replay raises;
   - pin that the retired `stage5-v2-apply.ts` refuses (source-text or execution test);
   - `tests/personal-plan-stage5-v2-activation.test.ts` byte pins must stay GREEN and
     UNTOUCHED (artifact and baseline unchanged is an explicit acceptance check).
7. **Docs**: amendment section at the end of `plans/leave-in-apply/apply-runbook.md`
   ("§6 step 4b — superseded 2026-09-14"): measured findings + the delta-lane commands
   that replace the standard pass; keep the original text intact above it.

## Non-goals

- No artifact regeneration, no baseline change, no edits to the 15 stale artifact
  items (frozen historical record).
- No changes to the full-apply RPC in the database (it stays; nothing calls it).
- No Neqi work, no expansion-lane changes, no publication-trigger changes.

## Acceptance

- `npm run test:node` — only the known-pre-broken billing-plan-change failure.
- New PGlite suite green; activation-test pins byte-identical to main.
- Delta dry-run against prod classifies the Redken item `will_write`, everything
  else untouched; coverage audit lists exactly the Redken row pre-apply.
- Codex whole-branch review before push (read-only brief), findings fixed.

## Gates after merge (each separately Nick-authorized)

1. Apply the delta-executor migration (functions only, zero rows).
2. `products:intake:stage5-v2-pointer-delta:apply -- --apply --confirm-project=…`
   (writes ONE pointer).
3. `products:intake:leave-in-calibration:preflight` → must be `ok: true`.
4. The nine-product enrichment apply (runbook §6 step 6) — Nick's separate confirm.
