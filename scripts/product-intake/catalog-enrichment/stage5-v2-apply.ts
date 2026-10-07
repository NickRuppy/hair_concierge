/**
 * RETIRED 2026-09-14 — the full-registry Stage-5 V2 apply.
 *
 * This lane applied ONE frozen artifact covering every curated protocol row. It
 * cannot run any more, for two independent reasons:
 *
 * 1. The executor ledger was reset by migration each time the artifact grew
 *    (batches of 273 / 289 / 309 rows against a 310-item artifact), so the live
 *    RPC `apply_personal_plan_stage5_v2_artifact_v1` refuses with
 *    "Stage 5 V2 ledger is partial".
 * 2. Since 20260903083832 (which deleted eight `pre_heat_protection` oil rows and
 *    edited thirteen V1 payloads) and the scan-DB expansion waves (~90 products
 *    whose pointers are written at intake), the live catalog holds curated
 *    protocol rows the frozen artifact never listed. The reverse-coverage check
 *    in `stage5-v2-application.ts` has no exemption mechanism, so the preflight
 *    cannot go green either.
 *
 * The artifact stays frozen as the reviewed historical record — it is not
 * regenerated, and `stage5-v2-preflight.ts` still reads it. Pointer writes now go
 * through the incremental, per-item delta lane, and coverage is audited by the
 * invariant the runtime actually depends on.
 *
 * The retirement is kept as an executable refusal rather than a deleted file so
 * an operator following an older runbook gets the replacement commands instead of
 * "command not found".
 */

const RETIREMENT_NOTICE = [
  "products:intake:stage5-v2-application:apply is RETIRED and refuses to run.",
  "",
  "The full-registry apply cannot succeed: its ledger was migration-reset (273/289/309 rows",
  "against a 310-item artifact), and the catalog outgrew the registry on 2026-09-03.",
  "",
  "Use the pointer-delta lane instead:",
  "  npm run products:intake:stage5-v2-pointer-delta:preflight",
  "  npm run products:intake:stage5-v2-pointer-delta:apply -- --apply \\",
  "    --confirm-project=pqdkhefxsxkyeqelqegq --reviewed-head=<40-char-sha> \\",
  "    --expected-fingerprint=<sha256>",
  "",
  "And audit pointer coverage with the real invariant (every live curated protocol row",
  "that has V1 guidance must also carry a V2 pointer):",
  "  npm run personal-plan:pointer-coverage-audit",
].join("\n")

console.error(RETIREMENT_NOTICE)
process.exitCode = 1
