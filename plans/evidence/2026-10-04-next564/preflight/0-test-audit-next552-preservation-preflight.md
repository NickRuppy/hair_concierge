# Independent preservation preflight — next 3 + zero-quota alias

**Verdict: CONDITIONAL PASS for image C1, chat C1, chat C2 and alias closure. Chat C3 remains RETAIN / FAIL as a removal.** No new static preservation gap found in the accepted scope. Runtime controls and final coverage acceptance remain pending main. This is not a completed-cut receipt.

Reviewed live checkout `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. No repository edits, runner, source fault, provider, DB, environment-file read, or reviewer dispatch performed. Only this report and adjacent pins JSON were written in /tmp. Existing unrelated dirty work was preserved.

## Image C1 — conditional PASS

Donor `tests/product-images-batch-run.test.ts:52-60`; keeper `:142-154`. Read the complete live test file, both helpers, complete `scripts/product-images/batch-run.ts`, CLI helper, and the relevant installed Sharp PNG/raw/alpha implementation.

Complete donor assertion union is one `score < 0.02` assertion with diagnostic. Transfer exactly that assertion and local alias to the existing keeper's `result.metrics.halo_score`, preserving its status/reason/path assertions. No new fixture, input, invocation, or loop is needed.

Inputs differ in size/margin (30/8 vs 900/20), not in operative bright predicate. `buildSquareSubject` at :16-36 produces transparent zeroed exterior and opaque RGB 235/230/225 interior. Owner :210-277 uses default radius 5, nonempty boundary, luminance 230.925, saturation 10. Every colored boundary pixel fails `lum < 200` at :274. Geometry changes denominator but leaves numerator zero; no small-image special branch exists. This equivalence is specifically homogeneous bright nonempty subjects, not arbitrary geometry equivalence.

Keeper's scratch helper :95-114 writes actual PNG; owner :119-126 copies it, :331-345 reads alpha and re-encodes PNG, :187-189 reads actual RGBA, :372-388 calls actual alpha/halo functions, :468 returns calculated score. Installed Sharp defaults `pngPalette:false`/`pngBitdepth:8` (constructor :331/:334), PNG implementation output.js :570-650 and pipeline.cc :1143-1156, raw path pipeline.cc :1064-1084 and ensureAlpha channel.js :61 support this actual pixel path. No score mock is involved.

Required control: owner :277 adds `Math.max(0.03, warmDark / boundaryTotal)` only for positive denominator. The keeper must fail at the transferred `<0.02` oracle, while status/reason/path remain valid because 0.03 is below `HALO_FLAG=0.05` (:49) and trigger 0.12 (:46). Selected keeper pass → intended assertion fail → byte-exact restore → pass, then full cohort and refreshed global proof.

Retain warm-ring (:62), neutral-dark (:76), empty (:90), alpha-empty (:39), and density (:44) tests. Warm geometry differs materially; neutral dark independently reaches saturation exclusion; empty input is rejected before processItem halo evaluation (:375-386); density 0.25 is not the existing keeper's density. No helper export retirement justified. Current CLI main invokes processItem :508 and serializes metrics :527-529, so this is live operator behavior.

## Chat C1 — conditional PASS

Donor `tests/user-memory.spec.ts:490-518`; keeper :418-451. Complete live file including fake query and fixtures read; complete `src/lib/chat-runtime/user-memory.ts` read. Donor asserts nonnull result and persisted id/content/manual source. Keeper already asserts its original exact new content/manual source plus removed metadata/evidence/conversation and exact rebuilt cache. Capture the existing awaited result, add nonnull and id assertions only.

Owner :431-451 trims ordinary nonempty strings, reads current kind and computes normalized key. Both fixtures contain only user-1/memory-1; collision query :453-460 excludes that id, leaving no rows regardless of their different old/new keys and preference versus product_experience prefix. `normalizeMemoryKey` :62-68 has no kind-specific branch. Both proceed through the same update :466-479, cache rebuild :488, return :489. Neither donor nor proposed keeper asserts exact normalized-key output, so do not claim new key-calibration proof.

Fake query :154-206 applies actual owner filters and payloads; it does not manufacture manual source, metadata clearing, cache contents, or return policy. Its projections/order/cardinality/errors differ from real PostgREST, so this is owner orchestration preservation, not SQL/RLS/concurrency proof. Installed PostgREST filter/transform source confirms eq/neq and single/maybeSingle protocol; migration `20260408130000_add_user_memory.sql:17-52` supplies actual active default/partial uniqueness. No live DB inference.

Required controls: (1) replace owner :489 return with null; transferred nonnull assertion must fail after successful writes; (2) add wrong id to actual owner update payload at :468, transferred stored-id comparison must fail. In the fake, matching happens before assignment (:171-178), so wrong-id does not accidentally make the update lookup miss; this reaches the intended oracle. Restore exact source between controls. Keep collision rejection :453-488 unchanged. API `src/app/api/memory/[id]/route.ts:38-43` uses the returned row/null for real response behavior.

## Chat C2 — conditional PASS

Donor `tests/message-context.test.ts:78-90`; keeper :37-51. Complete file and complete owner read. Donor's union is exact canonical output, preserved id and no rag_context. Replace keeper context-only deep equality with exact whole output containing its original id, cleaned content and canonical context. Its content assertion and explicit sources absence stay. Exact whole-object equality detects the removed legacy key for these ordinary own-property inputs; no new invocation or input.

Owner `src/lib/chat-runtime/message-context.ts:36-43` always clones row, removes both context columns, adds canonical result; :15-20 chooses current-or-legacy and removes sources. Keeper and donor both use null current and answer_direct legacy. Extra source/content only activates :45-52, which modifies content and does not govern id or context-column projection. Thus the projection input differences are in nonbranching ids plus independently retained content cleanup. Keep precedence, null fallback, compatibility-backfill markers, no-source bracket preservation and dual-write tests unchanged. Live ordinary chat route :86 and production history loader :105 call normalizeMessageContextRows; compatibility is still live.

Required controls: omit owner :37 legacy-key deletion and separately delete preserved id after :38. Each must fail keeper's transferred exact object oracle, not content setup or a mock. Old content/context-only assertions would permit both faults. Run each with baseline and exact restoration.

## Chat C3 — RETAIN / removal FAIL

Parent correctly rejected original artifact's third proposed cut. `tests/user-memory.spec.ts:295-307` supplies archived entries directly to formatter; owner :99 rejects them independently of active DB query :223. Existing insertion/cache keeper goes through both filters and cannot detect loss of formatter defense alone. Two simultaneous filter removals are not equivalent preservation of the single-filter privacy guard. Preserve callback/import/source; do not run or count C3 as part of next3. This is a material false positive corrected from the original candidate ledger.

## Alias — conditional PASS, zero declaration credit

Complete live readiness test (all six callbacks) and export owner read. Exact symbol search over source/scripts/apps/tests/.github/package and repository non-evidence documentation found only definition :154 and test import :5 plus calls :84/:96/:121. Other export-module references are type-only ledger imports or operator documentation; no namespace/dynamic caller found in the search scope.

Each existing call explicitly supplies `has_barcode:false`. Canonical owner `readiness-export.ts:121-150` then returns only blocked or ready_for_ean_research, already with false barcode. Wrapper :153-168 merely reassigns the same barcode/status after that call. Retarget the three callee identifiers/import and delete only wrapper. Existing production baseline :209 already calls canonical owner, and its candidate projection :223-231 stays. All six callbacks, fixtures, expectations and call counts remain unchanged; no dead-feature claim or count credit.

Require immediate source/hash and caller-closure refresh, scope release from overlapping coverage guards, syntactic/type checks and native focused proof. No injected fault needed merely to show removal of an identity projection; existing canonical blocker/status assertions still execute.

## History, routing, limits

Read relevant historical additions: image test and owner intent in b6d146af (#509); canonical context tests in 5ee54b61 (#210); readiness export in 457c64be (#499); memory ca5491aa under old `src/lib/rag/user-memory.ts` path, with rename dccff6f7. Initial modern-path lookup at ca5491aa failed and was corrected. History provides origin, not permission to remove continuing contracts.

Current `package.json:49` includes all three native files through tests/*.test.ts; :69 explicitly includes user-memory.spec.ts. CI runs these commands at `.github/workflows/ci.yml:158,180`. Main should keep no-env isolated Playwright config for memory tests; no app server/provider needed. Read Supabase skill as contextual guidance and local dependency source only; no Supabase implementation or remote feature assertion is made.

Pins: `/tmp/test-audit-next552-preservation-pins.json`. Inputs were inspected from live files; frozen artifact snapshots do not count as source-read proof. This review covers the accepted donor/keeper files and operative sources, not a repeat of all unrelated image19 retained files or broad production/SQL architecture. Parent-supplied local549 global coverage/26 baseline-failure receipt was not re-executed or independently certified. Refresh both 2pp guards against the final next552 state before acceptance. No additional gap found; controlled runtime failure and final diff inspection remain required.
