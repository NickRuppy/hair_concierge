# Prospective dormant rollout closure

Read `layer-plan.md`, `complete.diff`, `candidates.json`, then `controls.json`. `manifest.json` freezes all 30 full phase files; transfer is byte-identical to before. `complete-ledger.json` and `assertion-accounting.json` provide full per-registration/body/assertion mapping. `read-scope.json`, `closure-inventory.json`, and `history-retirement.txt` distinguish source closure from read/runtime limits.

No edits or tests have been applied/run. Root must inspect and independently review this conditional six-D packet before guarded execution. Atomic source/test retirement is required; deleting tests alone is invalid. Main may use its existing guarded CAS/lock operator infrastructure, never blindly copy snapshots over changed files.

Main-only bounded baseline/cut native command from the exact worktree:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-journey-access-loader.test.ts tests/personal-plan-stage3-release.test.ts tests/auth-middleware-personal-plan-routine.test.ts tests/freemium-enrollment-admission.test.ts tests/personal-plan-trial-stage1-journey.test.ts tests/personal-plan-field-test-access.test.ts tests/personal-plan-rollout-access.test.ts
```

Expected registration counts are 103 before/transfer and 97 cut, with no skip/cancel/todo. These are static expectations, not observed TAP. Use each control's exact keeper title with an anchored, regex-escaped `--test-name-pattern`; require precisely one selected keeper and its intended first frame. All 14 controls are UNRUN.

`prepare.cjs` / `finalize.cjs` are TMP-only static authoring scripts. They do not install changes, execute product code, compile, spawn child processes or run tests. `handoff-receipt.json` freezes their output after independent static validation. No operator-proof attestation or actual mutation receipt is implied.
