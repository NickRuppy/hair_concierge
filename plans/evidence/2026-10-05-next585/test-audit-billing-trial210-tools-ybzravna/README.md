# Billing trial210 main-only operator handoff

All code and proposal snapshots require main inspection and independent semantic acceptance before a mutation command. These tools were only statically checked. No candidate test, source fault, product import, database, or provider call was executed by this worker.

Run from the exact worktree:

```sh
cd /Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning
node --require /tmp/test-audit-billing-trial210-tools-ybzravna/operator-readonly-preload.cjs /tmp/test-audit-billing-trial210-tools-ybzravna/operator-edit.cjs --check
node --require /tmp/test-audit-billing-trial210-tools-ybzravna/operator-readonly-preload.cjs /tmp/test-audit-billing-trial210-tools-ybzravna/operator-run-controls.cjs --check
```

Only main, after acceptance and after every other runner/editor closes, may execute the following sequence. Pause for review of every receipt; a failed step is a stop, not authorization to continue or repin.

```sh
node /tmp/test-audit-billing-trial210-tools-ybzravna/operator-edit.cjs transfer
node /tmp/test-audit-billing-trial210-tools-ybzravna/operator-run-controls.cjs run
node /tmp/test-audit-billing-trial210-tools-ybzravna/operator-edit.cjs cut
node /tmp/test-audit-billing-trial210-tools-ybzravna/operator-run-controls.cjs run
```

The driver supports an optional exact control ID after `run` or `--check`. Without it, all four controls run serially. Each control requires one named clean test, one named ERR_ASSERTION with the intended operator/message and FIRST stack frame at the exact keeper assertion, byte-exact owner restoration, and the same one clean test. Timeouts, imports, SQL/setup errors, skipped/zero/multiple selections, signals and unrelated assertions do not qualify. Each detached child has a 45-second deadline; only that child process group can be killed.

All 31 test originals and three unique owner originals are backed up with exclusive creation before the driver's first child/write. The editor backs up all 31 test files before the first write. Both use `/tmp/test-audit-pruning-operator-lock` with a random owner token and never force-clear another operator's lock. Every run has a unique `/tmp` receipt directory. The tools reject root, branch, HEAD, Node, Git identity/local-config, installed dependency, source-readset, proposal/artifact or phase drift. Source mutants are unique complete-function patches and full TypeScript parse checks precede runtime.

The proposal stays exact: 31 files, 93 phase snapshots, 210 → 210 → 207 declarations; 206 unrelated retained declarations byte-exact. Only C2 adds the one original receipt assertion; C1/C3 keepers are unchanged. No new nonassertion call, fixture, row, or skip is introduced. No source cleanup or F repair credit.

Read `static-receipt.json` for immutable SHA values, guard counts and limits. Read `operator-controls-normalized.json` for complete fault bytes, function hashes, commands and phase assertion oracles. Actual runtime proof, candidate acceptance and campaign count/coverage decisions remain with main.
