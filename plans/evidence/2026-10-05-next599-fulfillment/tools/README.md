# Fulfillment C1: main-only guarded operators

Prepared for `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, branch `codex/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`.

Original accepted proposal remains `/tmp/test-audit-one-time-fulfillment75/`; none of its files were modified. This toolkit changes only `tests/one-time-recovery-command.test.ts` when the main operator explicitly invokes a mutation mode. The worker ran only static parsing and preload-enforced checks.

## Conservation and boundaries

- Eight original test files: **75 → 75 → 74 declaration sites**. One current four-row registration makes the anticipated native totals **78 → 78 → 77**, subject to actual main-run output.
- One existing keeper receives the complete privacy/amount/currency assertion union from the identical-input donor. No new owner invocation, input, row, fixture, or declaration.
- All 73 other retained callbacks and all ten held F callbacks remain byte-identical. No F repair, source cleanup, export removal, provider call, or production behavior change.
- Only the changed test has physical before/transfer/cut copies in this toolkit (`operator-{before,transfer,cut}.ts`). Seven unchanged tests are pinned against all three phases and read as live immutable bytes. Full-file exact reconstruction establishes unchanged support and outside-callback bytes.
- Original 49 readset records retained verbatim. Fixed guard set adds the selected local import/support closure: 140 source/config/support files outside the eight phase-aware tests. Static traversal includes type-only and untaken literal imports conservatively; 110 local closure files, no nonliteral imports found by the bounded traversal.
- 88 installed files pinned: bounded loader/transpiler subtrees, parser, selected SDK resolved entries/manifests, original Zod pins. **SDK transitive internals are not exhaustively pinned**. Lockfile, selected entries and the main's frozen runtime supplement this bounded guard; this is not an all-vendor closure claim. `operator-selected-closure.json` records exact paths/edges.
- Exact physical cwd, Node version/binary hash, Git worktree identity/config/ref, root/branch/HEAD, artifacts and phase bytes must match. Shared token lock: `/tmp/test-audit-pruning-operator-lock`.

## Commands (main only)

Run from the exact checkout above using the pinned Node binary. Read the scripts before invoking mutation modes.

```sh
node --require /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-readonly-preload.cjs /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-edit.cjs --check
node --require /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-readonly-preload.cjs /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-run-controls.cjs --check
node /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-edit.cjs transfer
```

Then run the native eight-file transfer cohort using the existing campaign wrapper, or the exact command below. This is deliberately outside the editor and control driver; the worker has not executed it.

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/stripe-one-time-confirmation.test.ts tests/one-time-recovery-command.test.ts tests/billing-one-time-fulfillment-reconcile.test.ts tests/one-time-activation-status-route.test.ts tests/personal-plan-one-time-confirmation.test.ts tests/one-time-paid-pending-ux.test.ts tests/one-time-payment-recovery-migration.test.ts tests/personal-plan-one-time-first-access.test.ts
node /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-run-controls.cjs run
```

The control runner prints `receiptDir` and `completionSHA256`. Only a complete **transfer-phase** six-control receipt is eligible for cut. Supply both literal values:

```sh
node /tmp/test-audit-fulfillment75-tools-7ouif76e/operator-edit.cjs cut <receiptDir> <completionSHA256>
```

Repeat the unchanged eight-file native command after cut. Optional control rerun after cut uses the same `run` command; it cannot replace the mandatory transfer receipt. `run <control-id>` is available for diagnosis, but a partial control receipt is never cut-eligible.

## Six controls and strict evidence

All fault splices are inside the complete hash-pinned `runOneTimeRecoveryCommand` function in `scripts/billing/one-time-recover.ts`.

| ID | Expected keeper assertion | Proof scope |
| --- | --- | --- |
| `receipt-email-leak` | line 353: sensitive-value loop, `leaked buyer@example.com` | transferred donor privacy |
| `receipt-fixed-amount` | line 355: `29.99` remains in serialized output | transferred donor amount |
| `receipt-fixed-currency` | line 356: `EUR` remains in serialized output | transferred donor currency |
| `apply-mode` | line 342: actual receipt mode is apply | original keeper |
| `apply-guard-receipt` | line 343: apply guard receipt true | original keeper |
| `activation-after-receipt` | line 344: complete verify→activate→read order array | original keeper |

Each command selects the existing keeper `applies only when confirmation exactly matches the target`, exactly once in the selected test file; no new case is created. Complete function/from uniqueness, prospective source SHA, TS syntax, full assertion AST text/start line, keeper SHA and command argv are statically validated. Lines are identical in transfer/cut.

Each runtime control must establish clean one-pass → actual source fault → one `ERR_ASSERTION` with exact operator, message fragment, and first keeper stack frame → byte-exact owned restore → clean one-pass. All six produce 18 child runs (12 clean, six intended red). Setup/import/SQL errors, skips, cancellation, unexpected assertions and timeouts fail the proof. First three controls exercise the donor union; last three protect the existing keeper. No original false-pass proof or provider/DB/default-wiring proof is claimed.

Before any child, all eight test bytes and the unique source owner are backed up read-only to a unique run directory. Before every child/source write and after every restore, the phase and complete guarded readset are rechecked. Each detached child owns a 45-second timer and process group; only that group is terminated. Faults restore in `finally` using exact-byte CAS. An unexpected concurrent source is preserved and reported, not overwritten. SIGINT/SIGTERM abort and restore; SIGKILL/power loss cannot guarantee `finally`, so immutable originals remain for main inspection.

The editor stages/parses/reconstructs all phases before mutation, rechecks before first write, backs all eight test originals, and rolls back only bytes it owns. Cut rereads/revalidates the complete TAP logs, command files, six source restoration records, all test hashes and full readset records; it does not accept a bare success boolean.

## Verification limits

Both `--check` entrypoints passed under a preload that rejects filesystem mutations and child creation: zero attempted writes/children. Prospective parsing is not typechecking or runtime proof. No test, source fault, owner import, provider call, DB action or repository write was executed by the preparer. Parent remains responsible for actual control output, native before/transfer/after results, independent preservation, and full campaign gates. Ten F findings remain held with zero deletion credit.
