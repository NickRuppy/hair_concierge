# Main-only recompute C1–C4 tools

Status: static checks passed in the `before` phase. No repository bytes, test owners, PGlite modules, database, provider, or native test runners were executed by the tool author. Main independently reported the original seven-file native cohort green at 58/58 in `/tmp/test-audit-recompute58-main-before.tap`; that run is not agent verification.

## Scope and safeguards

- Approved proposal artifacts and 21 full snapshots are unchanged. Target 42 → 42 → 38; full existing proof cohort 58 → 58 → 54. Four original callbacks removed; one existing SQL keeper receives two assertions; the other 53 callbacks and all unrelated bytes are reconstructed exactly. Eight held F callbacks remain unchanged. No source cleanup.
- `guard.cjs` pins exact cwd and realpath, worktree Git directory/common directory, branch and HEAD (through file reads, no Git subprocess), repository Git config hash, Node binary/version/path, 34 original readset files, and 374 dependency/config/migration files. Dependencies include the nine actual SQL migration prerequisites, TypeScript parser, tsx/esbuild, Zod, and PGlite runtime JS/WASM/data. These are hash guards, not imports or dependency behavior proof.
- Both `--check` paths read/parse only and spawn no children or write anything. Both mutating modes take `/tmp/test-audit-pruning-operator-lock` with an owned UUID token in `owner.json`. They never remove another operator's token. Unique backup directories retain original bytes with read-only permissions.
- Editor reconstructs all prospective bytes, parses all 21 snapshots, verifies each original declaration, the complete assertion transfer, and all 53 unaffected callbacks before writing. It rechecks all live guards before each atomic file rename, compares exact expected current bytes, and rolls back only its own resulting bytes on an ordinary failure. Concurrent unexpected bytes are preserved with the backup receipt.
- Serial control driver permits only the pinned Node imports, test reporter, exact file and literal test-name selectors. Every phase statically has exactly one selected callback. The module-only SQL title also exists in an unselected donor file in before/transfer; raw global matches are recorded and do not imply extra execution.
- Every actual fault checks all source/dependency guards immediately before mutation, after applying the one permitted override, after restoration, and after its green control. Each native child owns a detached process group and has a 45-second deadline; only that child group can be killed. Fault restoration is in `finally`, including setup failures, timeout and handled SIGINT/SIGTERM. SIGKILL/host failure cannot execute JavaScript cleanup; original backups and the owned lock remain for main inspection, never automatic destructive recovery.
- Accepted evidence requires one selected test, no skip/cancel, green before and after, and a single red with exit 1, `ERR_ASSERTION`, `testCodeFailure`, exact expected operator/message and first assertion stack frame at the frozen keeper line. SQL, import, setup, harness, timeout and process-signal failures are rejected. All log hashes, source bytes, live source guards and outcomes are recorded. SQL fault syntax has only exact-anchor validation; main must inspect the actual runtime outcome.
- `provenance-clears-active` is explicitly a **new transferred positive oracle**. There is no original-test fault-sensitivity claim. The other six controls address preserved real owner oracles. The JSON normalization fixes the original closing-title regexp escaping in the executable command without altering the frozen `controls.json`.
- `cut` requires the complete successful seven-control transfer receipt and hashes of all 21 native logs. It does not treat a subset/debug receipt as authorization to cut. Main still owns inspection of the actual failures and native cohort gates.

## Commands (main only, from exact root)

```sh
cd /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning
node /tmp/test-audit-recompute-integration42/edit.cjs --check
node /tmp/test-audit-recompute-integration42/run-controls.cjs --check
node /tmp/test-audit-recompute-integration42/edit.cjs transfer
```

After inspecting the transfer, run the existing seven-file native proof command below. Expected: 58 pass, zero failures/skips/cancellations. Then:

```sh
node /tmp/test-audit-recompute-integration42/run-controls.cjs run
```

Read each before/fault/after log and receipt. The printed `receiptDir` is the exact argument for:

```sh
node /tmp/test-audit-recompute-integration42/edit.cjs cut /tmp/test-audit-recompute-integration42/controls-transfer-ACTUAL_SUFFIX
```

The cut command requires all seven controls in a single complete receipt. `run-controls.cjs run CONTROL_ID` is available for diagnosis but its subset receipt cannot satisfy the cut guard. After the cut, run the same native cohort, expecting 54 pass, zero failures/skips/cancellations. Main also owns broader type/CI/coverage gates.

```sh
node --import ./tests/server-only-register.cjs --import tsx --test --test-reporter=tap \
  tests/personal-plan/refinement-recompute/routine-reactivation.test.ts \
  tests/personal-plan-refinement-recompute-activation.test.ts \
  tests/personal-plan/refinement-recompute/module-driven-classification.test.ts \
  tests/personal-plan/refinement-recompute/production-deps.test.ts \
  tests/personal-plan/refinement-recompute/production-lane.test.ts \
  tests/personal-plan-refinement-recompute-activation-migration.test.ts \
  tests/personal-plan/persistence/routine-proposal-stager.test.ts
```

The donor fake RPC input is not byte-identical to valid SQL input. This approved layer change preserves the corresponding existing SQL policy scenarios plus independently retained actual TypeScript adapter admission/flag-delivery assertions. It does not establish an adapter-to-SQL end-to-end test, concurrency, Supabase JWT wiring, nonempty catalog validation or rollback-failure proof.
