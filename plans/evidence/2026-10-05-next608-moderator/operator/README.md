# Moderator183 main-only operator handoff

Frozen proposal: `/tmp/test-audit-moderator-fieldtest183`. Manifest SHA256 `736ce42f2cc6dcb915680facd3c0e0b52bb2c22a4fe5616a4abfe53425089288`; proposal handoff SHA256 `baabc8f3a6c49edfa848a1b99915929a34bec147f96283682470cf3e588d3dab`.

Tool pin SHA256: `40b28a91dfe702eb9b16efdd9fef248075a84be66444db1312ae701928b07d61`.

## Review surface

Approved shared template: `/tmp/test-audit-offer87-tools-j3gv5ax6`. Read `shared-tools.diff` for every changed branch of the five shared files; it is an exact unnormalized diff, including pin literals. `prepare-pins.diff` compares the preparer separately; review the complete final preparer because closure and metadata handling differ substantially. `tool-code-hashes.json` pins final code, data, documentation and static logs. No automatic apply or test run occurs on loading or checking these tools.

The guard reconstructs 27 files across 81 snapshots, 183→183→182 registrations, 181 unchanged callbacks, one strengthened keeper, one removed donor and its unused direct-leaf import. All 13 held F callbacks are identical. The old keeper's three assertions followed by the donor's two assertions must equal the full new ordered assertion list. No new owner invocation or fixture row is introduced.

The proof gate requires both actual-owner controls in order, exact single selected keeper, ERR_ASSERTION, expected operator/message and first test stack frame: C1-copy transfer93/cut92, C1-payment transfer94/cut93. Every control runs clean1 → actual leaf fault red1 → byte-exact source restoration → clean1. A wrong assertion, import failure, timeout, skip, cancellation, todo, wrong test or nonzero clean run refuses the cut. The cut rereads all six TAP logs and six exact command receipts, their hashes, source/restoration/readset attestations and all27 transfer test hashes.

## Main execution order

Main must first close every checkout runner and writer, review this code and preserve the shared checkout lock discipline. Current baseline was run by main: 183 pass, zero fail/skip/cancel/todo, 115318.9ms; worker only read its TAP and command receipt. The existing baseline includes `--test-concurrency=1`.

Every command below must run from:

```sh
cd /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning
```

Read-only checks (safe while tests are frozen; preload rejects filesystem mutations and child creation, permits stdout/stderr descriptors only):

```sh
node --require /tmp/test-audit-moderator183-tools-p18tq7i2/operator-readonly-preload.cjs /tmp/test-audit-moderator183-tools-p18tq7i2/operator-edit.cjs --check
node --require /tmp/test-audit-moderator183-tools-p18tq7i2/operator-readonly-preload.cjs /tmp/test-audit-moderator183-tools-p18tq7i2/operator-run-controls.cjs --check
```

Main-only mutation and proof sequence, once no runner remains:

```sh
node /tmp/test-audit-moderator183-tools-p18tq7i2/operator-edit.cjs transfer
node --import ./tests/server-only-register.cjs --import tsx --test --test-concurrency=1 tests/moderator-account-maintenance.test.ts tests/moderator-account-reset-execution.test.ts tests/moderator-account-reset.test.ts tests/moderator-hosted-activation-probe.test.ts tests/moderator-hosted-auth-probe.test.ts tests/moderator-organic-fresh-start.test.ts tests/moderator-quiz-draft-scope.test.ts tests/personal-plan-field-test-activation-route.test.ts tests/personal-plan-field-test-activation.test.ts tests/personal-plan-field-test-analytics.test.ts tests/personal-plan-field-test-campaign-command.test.ts tests/personal-plan-field-test-entry-route.test.ts tests/personal-plan-field-test-routing-migration.test.ts tests/personal-plan-field-test-schema.test.ts tests/personal-plan-field-test-server.test.ts tests/personal-plan-field-test-ui.test.tsx tests/personal-plan-moderator-activation-route.test.ts tests/personal-plan-moderator-contract.test.ts tests/personal-plan-moderator-journey.test.ts tests/personal-plan-moderator-schema.test.ts tests/personal-plan-moderator-sql-execution.test.ts tests/personal-plan-moderator-start-route.test.ts tests/regular-quiz-field-test-activation-route.test.ts tests/regular-quiz-field-test-activation.test.ts tests/regular-quiz-field-test-runtime.test.ts tests/regular-quiz-field-test-schema.test.ts tests/regular-quiz-field-test-ui.test.tsx
node /tmp/test-audit-moderator183-tools-p18tq7i2/operator-run-controls.cjs run
```

Inspect the complete transfer TAP and both actual fault TAPs. The driver prints its exact transfer `receiptDir` and `completionSHA256`. Pass those literal returned values to the cut; the placeholders below are not executable evidence:

```sh
node /tmp/test-audit-moderator183-tools-p18tq7i2/operator-edit.cjs cut '<returned transfer receiptDir>' '<returned completionSHA256>'
node --import ./tests/server-only-register.cjs --import tsx --test --test-concurrency=1 tests/moderator-account-maintenance.test.ts tests/moderator-account-reset-execution.test.ts tests/moderator-account-reset.test.ts tests/moderator-hosted-activation-probe.test.ts tests/moderator-hosted-auth-probe.test.ts tests/moderator-organic-fresh-start.test.ts tests/moderator-quiz-draft-scope.test.ts tests/personal-plan-field-test-activation-route.test.ts tests/personal-plan-field-test-activation.test.ts tests/personal-plan-field-test-analytics.test.ts tests/personal-plan-field-test-campaign-command.test.ts tests/personal-plan-field-test-entry-route.test.ts tests/personal-plan-field-test-routing-migration.test.ts tests/personal-plan-field-test-schema.test.ts tests/personal-plan-field-test-server.test.ts tests/personal-plan-field-test-ui.test.tsx tests/personal-plan-moderator-activation-route.test.ts tests/personal-plan-moderator-contract.test.ts tests/personal-plan-moderator-journey.test.ts tests/personal-plan-moderator-schema.test.ts tests/personal-plan-moderator-sql-execution.test.ts tests/personal-plan-moderator-start-route.test.ts tests/regular-quiz-field-test-activation-route.test.ts tests/regular-quiz-field-test-activation.test.ts tests/regular-quiz-field-test-runtime.test.ts tests/regular-quiz-field-test-schema.test.ts tests/regular-quiz-field-test-ui.test.tsx
node /tmp/test-audit-moderator183-tools-p18tq7i2/operator-run-controls.cjs run
```

The final command repeats both controls against cut line numbers, if main elects the same extra focused verification convention. Full transfer and cut cohort greens remain a main gate; the cut script mechanically gates actual transfer fault proof, not the separately run full-cohort TAP. Main then runs applicable changed/repository/campaign checks. No native control has been run by this worker, so no red/green runtime claim is made here.

## Preservation and interruption

Both editors and driver use `/tmp/test-audit-pruning-operator-lock`. Every27 test original is backed up before any repository write; the driver also backs up its unique source owner before its first child. CAS permits only exact expected bytes, writes a same-directory temporary file then renames, and restores only exact owned bytes. A peer's changed bytes are preserved. Each runtime child has its own detached process group and 45000ms timeout; cleanup targets that owned group only. SIGINT/SIGTERM restores the active owned mutation in `finally`; SIGKILL cannot execute cleanup. In that case inspect the retained `all-originals`, source/control backups, intent and failure receipts; do not delete the lock or overwrite drift blindly.

The one-shot `prepare-pins.cjs` writes only its own temporary directory, imports no product/tests, launches no children, and refuses existing outputs. Do not rerun it to adopt drift. Source, test, original111 readset and dependency drift must stop execution for explicit review.

## Exact guard scope and metadata disposition

Preserves every original111 readset. All27 tests are phase-aware. Fixed readset249 plus184-file selected local import closure (including conservative local type imports), 2192 installed dependency files in30 bounded distribution trees, exact Node v22.12.0 binary, six Git identity paths and original artifacts are guarded. No nonliteral imports were found in the selected local closure. Dependency selection follows the selected SSR keeper and tooling; unrelated26 test transitive runtime dependencies and every transitive third-party runtime file are not exhaustively closed. Hashing and syntax parsing are not semantic read credit or a vendor audit.

The only adopted old-pin drift is shared Git config: previous `2253b6840e7873e8035e82d6176ab2b7eec30374199874b551cc70fc77bbdeb1`, current `0c8e95adf438f1a7ff98d364731136030b301dc9b96d949904ed64520b12fcb0`. Main explicitly verified the other five identity pins and exact task branch/HEAD/root, then authorized this one metadata adoption. Authority: `/tmp/test-audit-next607-shared-config-disposition.json`, SHA256 `38f962fed8680aaa75a2723158c25d37669e4042e44164d878a6556463143705`. Prior config bytes are unavailable; no exact provenance claim is made. Both old identity list and disposition remain in pins. No source/test/dependency repin was authorized or performed.

Static editor and control checks exited0 with enforced attemptedWrites0/attemptedChildren0; all six tooling sources parsed with zero syntax diagnostics. An initial driver check from the primary checkout refused with `Exact real checkout required`; the corrected task-cwd check passed. No repository writes, test execution, source fault, product import, provider/DB operation or environment-file read was performed by the worker.
